import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyTiktokHealth, TIKTOK_READ_SCOPES, type TiktokRunEvidence } from '../_shared/tiktokFreshness.ts'
import { classifySocialProviderEligibility } from '../../../src/lib/socialProviderEligibility.ts'

const READ_SCOPES = [...TIKTOK_READ_SCOPES]

const REQUIRED_SCOPES = Deno.env.get('TIKTOK_PUBLISHING_ENABLED') === 'true'
  ? [...READ_SCOPES, 'video.publish']
  : READ_SCOPES

interface StatusBody {
  clientId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  // Use canonical admin|manager role check for integration management
  const { data: profile } = await sb
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  let body: StatusBody
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Check schema readiness
  const [{ error: oauthStateSchemaError }, { error: tokenSchemaError }] = await Promise.all([
    sb.from('tiktok_oauth_states').select('id', { head: true }).limit(1),
    sb.from('tiktok_connection_tokens').select('id', { head: true }).limit(1),
  ])
  const schemaReady = !oauthStateSchemaError && !tokenSchemaError

  // Per-client connection resolution — never global/first-connected
  if (!body.clientId) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      message: 'clientId is required.',
      schemaReady,
    })
  }

  const { data: activeClient, error: clientError } = await sb
    .from('clients')
    .select('id, package_settings')
    .eq('id', body.clientId)
    .eq('active', true)
    .maybeSingle()

  if (clientError) {
    return jsonResponse({ ok: false, connected: false, status: 'unavailable', message: 'Client eligibility could not be verified.', missingScopes: [], schemaReady }, 503)
  }
  if (!activeClient) {
    return jsonResponse({ ok: false, connected: false, status: 'ineligible', message: 'Only active clients are eligible for TikTok.', missingScopes: [], schemaReady }, 403)
  }
  const eligibility = classifySocialProviderEligibility(activeClient.package_settings)
  if (eligibility.state !== 'eligible') {
    return jsonResponse({ ok: false, connected: false, status: 'ineligible', message: eligibility.reason, eligibility: eligibility.state, missingScopes: [], schemaReady }, 403)
  }

  // Management must include reconnect-required rows; the sync path separately
  // continues to require status=connected for provider reads.
  const { data: rows, error: latestError } = await sb
    .from('tiktok_connections')
    .select('id, client_id, tiktok_open_id, display_name, avatar_url, status, scopes, last_error, last_connected_at')
    .eq('client_id', body.clientId)
    .order('last_connected_at', { ascending: false, nullsFirst: false })
    .limit(1)

  if (latestError) {
    return jsonResponse({
      ok: false,
      connected: false,
      status: 'unavailable',
      error: latestError.message,
      message: 'TikTok connection status could not be verified.',
      missingScopes: [],
      schemaReady,
    }, 503)
  }

  if (!rows?.length) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      message: 'TikTok connection not found.',
      schemaReady,
    })
  }

  const latest = rows[0]

  const grantedScopes = Array.isArray(latest.scopes)
    ? latest.scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  const missingScopes = REQUIRED_SCOPES.filter(scope => !grantedScopes.includes(scope))

  const terminalStatuses = ['not_connected', 'needs_reauth', 'revoked', 'error']
  if (terminalStatuses.includes(latest.status)) {
    const messages: Record<string, string> = {
      not_connected: 'TikTok is not connected yet.',
      needs_reauth: 'TikTok needs to be reconnected.',
      revoked: 'TikTok access was revoked.',
      error: 'TikTok connection has an error.',
    }
    return jsonResponse({
      ok: true,
      connected: false,
      status: latest.status,
      message: latest.last_error || messages[latest.status] || 'TikTok is not connected.',
      missingScopes,
      schemaReady,
    })
  }

  const runFields = 'status,health_state,period_month,started_at,finished_at,summary'
  const [{ data: attemptedRows, error: attemptedError }, { data: successfulRows, error: successfulError }] = await Promise.all([
    sb.from('platform_sync_runs')
      .select(runFields)
      .eq('client_id', body.clientId)
      .eq('connection_id', latest.id)
      .eq('platform', 'tiktok')
      .order('started_at', { ascending: false })
      .limit(1),
    sb.from('platform_sync_runs')
      .select(runFields)
      .eq('client_id', body.clientId)
      .eq('connection_id', latest.id)
      .eq('platform', 'tiktok')
      .in('status', ['success', 'partial'])
      .in('health_state', ['verified', 'verified_partial'])
      .order('finished_at', { ascending: false })
      .limit(1),
  ])

  if (attemptedError || successfulError) {
    return jsonResponse({
      ok: false,
      connected: true,
      status: 'health_unavailable',
      error: attemptedError?.message ?? successfulError?.message,
      message: 'TikTok is connected, but analytics freshness could not be verified.',
      missingScopes,
      schemaReady,
    }, 503)
  }

  // Verify token row exists
  const { data: tokenRows, error: tokenError } = await sb
    .from('tiktok_connection_tokens')
    .select('id, token_expires_at, refresh_token')
    .eq('connection_id', latest.id)
    .limit(1)

  if (tokenError) {
    return jsonResponse({
      ok: false,
      connected: true,
      status: 'unavailable',
      error: tokenError.message,
      message: 'TikTok token status could not be verified.',
      missingScopes,
      schemaReady,
    }, 503)
  }

  if (!tokenRows || tokenRows.length === 0) {
    const health = classifyTiktokHealth({
      connectionStatus: latest.status,
      missingScopes,
      tokenPresent: false,
      tokenExpired: false,
      tokenRefreshable: false,
      latestAttempt: (attemptedRows?.[0] as TiktokRunEvidence | undefined) ?? null,
      latestSuccessful: (successfulRows?.[0] as TiktokRunEvidence | undefined) ?? null,
    })
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: 'TikTok needs to be reconnected.',
      missingScopes,
      schemaReady,
      health,
    })
  }

  const tokenExpiry = tokenRows[0]?.token_expires_at as string | null
  const tokenExpired = tokenExpiry ? new Date(tokenExpiry) < new Date() : false
  const tokenRefreshable = typeof tokenRows[0]?.refresh_token === 'string' && tokenRows[0].refresh_token.length > 0

  const health = classifyTiktokHealth({
    connectionStatus: latest.status,
    missingScopes,
    tokenPresent: true,
    tokenExpired,
    tokenRefreshable,
    latestAttempt: (attemptedRows?.[0] as TiktokRunEvidence | undefined) ?? null,
    latestSuccessful: (successfulRows?.[0] as TiktokRunEvidence | undefined) ?? null,
  })

  return jsonResponse({
    ok: true,
    connected: missingScopes.length === 0,
    status: missingScopes.length > 0 ? 'needs_reauth' : tokenExpired ? 'needs_refresh' : 'connected',
    message: missingScopes.length > 0
      ? `TikTok needs to be reconnected with: ${missingScopes.join(', ')}.`
      : tokenExpired ? 'TikTok token refresh will be attempted automatically.' : 'TikTok is connected.',
    missingScopes,
    schemaReady,
    health,
    connection: {
      id: latest.id,
      clientId: latest.client_id,
      tiktokOpenId: latest.tiktok_open_id,
      displayName: latest.display_name,
      avatarUrl: latest.avatar_url,
      lastConnectedAt: latest.last_connected_at,
      grantedScopes,
      tokenExpiresAt: tokenExpiry,
      tokenExpired,
    },
  })
})
