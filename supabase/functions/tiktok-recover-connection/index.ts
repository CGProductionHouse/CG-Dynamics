import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refreshTiktokToken } from '../_shared/tiktok.ts'

interface RecoveryBody {
  clientId?: unknown
  expectedConnectionId?: unknown
  expectedTiktokOpenId?: unknown
  mode?: unknown
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await sb.auth.getUser(bearer)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const { data: profile } = await sb.from('profiles').select('role,is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  let body: RecoveryBody
  try { body = await req.json() } catch { return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400) }

  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const connectionId = typeof body.expectedConnectionId === 'string' ? body.expectedConnectionId.trim() : ''
  const expectedOpenId = typeof body.expectedTiktokOpenId === 'string' ? body.expectedTiktokOpenId.trim() : ''
  const mode = body.mode === 'apply' ? 'apply' : 'preflight'
  if (!clientId || !connectionId || !expectedOpenId) {
    return jsonResponse({ ok: false, error: 'Exact client, connection and TikTok identity are required.' }, 400)
  }

  const [{ data: connection }, { data: tokenRow }] = await Promise.all([
    sb.from('tiktok_connections')
      .select('id,client_id,tiktok_open_id,status')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .eq('tiktok_open_id', expectedOpenId)
      .maybeSingle(),
    sb.from('tiktok_connection_tokens')
      .select('connection_id,token_expires_at,refresh_token')
      .eq('connection_id', connectionId)
      .maybeSingle(),
  ])

  if (!connection) return jsonResponse({ ok: false, error: 'Exact TikTok connection identity does not match.' }, 409)
  if (connection.status !== 'needs_reauth') {
    return jsonResponse({ ok: false, error: 'Connection is not in the recoverable needs_reauth state.', status: connection.status }, 409)
  }
  const refreshable = typeof tokenRow?.refresh_token === 'string' && tokenRow.refresh_token.length > 0
  if (!refreshable) return jsonResponse({ ok: false, error: 'No stored refresh token is available for this exact connection.' }, 409)

  if (mode === 'preflight') {
    return jsonResponse({
      ok: true,
      mode,
      clientId,
      connectionId,
      status: connection.status,
      refreshTokenPresent: true,
      tokenExpired: tokenRow?.token_expires_at ? new Date(tokenRow.token_expires_at) < new Date() : null,
    })
  }

  const refreshed = await refreshTiktokToken(sb, connectionId, tokenRow.refresh_token, expectedOpenId)
  if (!refreshed) {
    return jsonResponse({ ok: false, error: 'Stored TikTok authorization could not be silently recovered.' }, 409)
  }

  const { data: restored, error: restoreError } = await sb.from('tiktok_connections')
    .update({ status: 'connected', last_error: null })
    .eq('id', connectionId)
    .eq('client_id', clientId)
    .eq('tiktok_open_id', expectedOpenId)
    .eq('status', 'needs_reauth')
    .select('id')
    .maybeSingle()

  if (restoreError || !restored) {
    return jsonResponse({ ok: false, error: 'TikTok token refreshed but the exact connection state could not be restored safely.' }, 500)
  }

  return jsonResponse({ ok: true, mode, clientId, connectionId, status: 'connected' })
})
