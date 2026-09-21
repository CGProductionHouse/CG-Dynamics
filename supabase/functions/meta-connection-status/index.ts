import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REQUIRED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'read_insights',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Verify the caller is authenticated and has staff-level access.
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

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  // Count active linked assets (independent of connection status).
  const { count: linkedAssetsCount } = await sb
    .from('meta_client_assets')
    .select('*', { head: true, count: 'exact' })
    .eq('is_active', true)

  const [{ error: oauthStateSchemaError }, { error: tokenSchemaError }] = await Promise.all([
    sb.from('meta_oauth_states').select('id', { head: true }).limit(1),
    sb.from('meta_connection_tokens').select('id', { head: true }).limit(1),
  ])
  const schemaReady = !oauthStateSchemaError && !tokenSchemaError

  const { data: verifiedRuns } = await sb
    .from('platform_sync_runs')
    .select('platform, period_month, health_state, finished_at')
    .in('health_state', ['verified', 'verified_partial'])
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const lastVerifiedInsight = verifiedRuns?.[0] ?? null

  // Read the latest connection ordered by last_connected_at desc nulls last.
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id, meta_business_id, meta_business_name, status, scopes, last_error, last_connected_at')
    .order('last_connected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      message: 'Meta is not connected yet.',
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  const latest = connections[0]
  const grantedScopes = Array.isArray(latest.scopes)
    ? latest.scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  const missingScopes = REQUIRED_SCOPES.filter(scope => !grantedScopes.includes(scope))

  // Statuses that clearly indicate no valid connection.
  const terminalStatuses = ['not_connected', 'needs_reauth', 'revoked', 'error']
  if (terminalStatuses.includes(latest.status)) {
    const messages: Record<string, string> = {
      not_connected: 'Meta is not connected yet.',
      needs_reauth: 'Meta needs to be reconnected.',
      revoked: 'Meta access was revoked.',
      error: 'Meta connection has an error.',
    }
    return jsonResponse({
      ok: true,
      connected: false,
      status: latest.status,
      message: latest.last_error || messages[latest.status] || 'Meta is not connected.',
      missingScopes,
      schemaReady,
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  if (missingScopes.length > 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: `Meta needs to be reconnected with: ${missingScopes.join(', ')}.`,
      missingScopes,
      schemaReady,
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  // Status is 'connected' — verify a token row exists (but don't return its value).
  const { data: tokenRows } = await sb
    .from('meta_connection_tokens')
    .select('id')
    .eq('connection_id', latest.id)
    .limit(1)

  if (!tokenRows || tokenRows.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: 'Meta needs to be reconnected.',
      linkedAssetsCount: linkedAssetsCount ?? 0,
    })
  }

  return jsonResponse({
    ok: true,
    connected: true,
    status: 'connected',
    message: 'Meta is connected.',
    missingScopes: [],
    schemaReady,
    tokenSecurity: {
      encryptedAtRest: false,
      state: 'server_only_plaintext',
    },
    connection: {
      id: latest.id,
      metaBusinessId: latest.meta_business_id,
      metaBusinessName: latest.meta_business_name,
      lastConnectedAt: latest.last_connected_at,
      grantedScopes,
      lastVerifiedInsight: lastVerifiedInsight ? {
        platform: lastVerifiedInsight.platform,
        periodMonth: lastVerifiedInsight.period_month,
        healthState: lastVerifiedInsight.health_state,
        finishedAt: lastVerifiedInsight.finished_at,
      } : null,
    },
    linkedAssetsCount: linkedAssetsCount ?? 0,
  })
})
