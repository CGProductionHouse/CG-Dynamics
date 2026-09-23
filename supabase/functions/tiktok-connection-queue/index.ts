import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TIKTOK_READ_SCOPES } from '../_shared/tiktokFreshness.ts'
import { fetchAllRows } from '../_shared/paginatedRows.ts'

const REQUIRED_SCOPES = Deno.env.get('TIKTOK_PUBLISHING_ENABLED') === 'true'
  ? [...TIKTOK_READ_SCOPES, 'video.publish']
  : [...TIKTOK_READ_SCOPES]

type Row = Record<string, unknown>

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const { data: profile } = await sb.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  try {
    const [clientResult, connectionResult, tokenResult] = await Promise.all([
      fetchAllRows<Row>((from, to) => sb.from('clients').select('id, name').eq('active', true).order('name').range(from, to)),
      fetchAllRows<Row>((from, to) => sb.from('tiktok_connections')
        .select('id, client_id, tiktok_open_id, display_name, avatar_url, status, scopes, last_error, last_connected_at')
        .not('client_id', 'is', null).order('last_connected_at', { ascending: false, nullsFirst: false }).range(from, to)),
      fetchAllRows<Row>((from, to) => sb.from('tiktok_connection_tokens')
        .select('connection_id, token_expires_at, refresh_token').range(from, to)),
    ])
    const readError = clientResult.error ?? connectionResult.error ?? tokenResult.error
    if (readError) throw new Error(readError.message)
    const clients = clientResult.data
    const connections = connectionResult.data
    const tokens = tokenResult.data

    const activeIds = new Set(clients.map(row => String(row.id)))
    const latestByClient = new Map<string, Row>()
    for (const connection of connections) {
      const clientId = String(connection.client_id ?? '')
      if (activeIds.has(clientId) && !latestByClient.has(clientId)) latestByClient.set(clientId, connection)
    }
    const tokenByConnection = new Map(tokens.map(row => [String(row.connection_id), row]))

    const items = clients.map(client => {
      const clientId = String(client.id)
      const connection = latestByClient.get(clientId)
      if (!connection) {
        return { clientId, clientName: String(client.name), state: 'not_connected', account: null, diagnostic: 'Connect the exact client TikTok account through TikTok OAuth.' }
      }

      const scopes = Array.isArray(connection.scopes) ? connection.scopes.filter(scope => typeof scope === 'string') as string[] : []
      const missingScopes = REQUIRED_SCOPES.filter(scope => !scopes.includes(scope))
      const tokenRow = tokenByConnection.get(String(connection.id))
      const expiresAt = typeof tokenRow?.token_expires_at === 'string' ? tokenRow.token_expires_at : null
      const tokenExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false
      const refreshable = typeof tokenRow?.refresh_token === 'string' && tokenRow.refresh_token.length > 0
      const providerStatus = String(connection.status ?? 'error')
      const needsReconnect = ['needs_reauth', 'revoked', 'error', 'not_connected'].includes(providerStatus)
        || !tokenRow || missingScopes.length > 0 || (tokenExpired && !refreshable)
      const state = needsReconnect ? 'reconnect_required' : tokenExpired ? 'refresh_pending' : 'connected'

      return {
        clientId,
        clientName: String(client.name),
        state,
        account: {
          displayName: typeof connection.display_name === 'string' ? connection.display_name : null,
          avatarUrl: typeof connection.avatar_url === 'string' ? connection.avatar_url : null,
          lastConnectedAt: typeof connection.last_connected_at === 'string' ? connection.last_connected_at : null,
        },
        missingScopes,
        tokenExpiresAt: expiresAt,
        diagnostic: needsReconnect
          ? (typeof connection.last_error === 'string' && connection.last_error) || 'Reconnect this exact account through TikTok OAuth.'
          : tokenExpired ? 'The daily freshness worker will attempt the stored refresh token automatically.' : 'Connected and eligible for automatic daily freshness.',
      }
    })

    return jsonResponse({
      ok: true,
      items,
      summary: {
        activeClients: items.length,
        connected: items.filter(item => item.state === 'connected' || item.state === 'refresh_pending').length,
        reconnectRequired: items.filter(item => item.state === 'reconnect_required').length,
        notConnected: items.filter(item => item.state === 'not_connected').length,
      },
    })
  } catch (error) {
    console.error('TikTok connection queue could not be read')
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'TikTok connection queue unavailable.' }, 503)
  }
})
