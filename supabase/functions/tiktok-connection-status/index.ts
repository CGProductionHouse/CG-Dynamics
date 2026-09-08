import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REQUIRED_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.upload',
  'video.publish',
]

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

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  // Check schema readiness
  const [{ error: oauthStateSchemaError }, { error: tokenSchemaError }] = await Promise.all([
    sb.from('tiktok_oauth_states').select('id', { head: true }).limit(1),
    sb.from('tiktok_connection_tokens').select('id', { head: true }).limit(1),
  ])
  const schemaReady = !oauthStateSchemaError && !tokenSchemaError

  // Read latest connection
  const { data: connections } = await sb
    .from('tiktok_connections')
    .select('id, tiktok_open_id, display_name, avatar_url, status, scopes, last_error, last_connected_at')
    .order('last_connected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      message: 'TikTok is not connected yet.',
    })
  }

  const latest = connections[0]
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

  if (missingScopes.length > 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: `TikTok needs to be reconnected with: ${missingScopes.join(', ')}.`,
      missingScopes,
      schemaReady,
    })
  }

  // Verify token row exists
  const { data: tokenRows } = await sb
    .from('tiktok_connection_tokens')
    .select('id, token_expires_at')
    .eq('connection_id', latest.id)
    .limit(1)

  if (!tokenRows || tokenRows.length === 0) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'needs_reauth',
      message: 'TikTok needs to be reconnected.',
    })
  }

  const tokenExpiry = tokenRows[0]?.token_expires_at as string | null
  const tokenExpired = tokenExpiry ? new Date(tokenExpiry) < new Date() : false

  return jsonResponse({
    ok: true,
    connected: true,
    status: tokenExpired ? 'needs_refresh' : 'connected',
    message: tokenExpired ? 'TikTok token needs refresh.' : 'TikTok is connected.',
    missingScopes: [],
    schemaReady,
    connection: {
      id: latest.id,
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
