// #269 existing Business status seam, using the reviewed encrypted credential
// path. Does not touch consumer analytics OAuth or publish/schedule content.
import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { businessOAuthConfig } from '../_shared/tiktokBusinessOAuthConfig.ts'
import { refreshBusinessAuthorization } from '../_shared/tiktokBusinessRefresh.ts'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)
  try {
    const { clientId, connectionId } = await request.json()
    const sb = auth.value.supabase
    const [actor, client, connection] = await Promise.all([
      sb.from('profiles').select('is_active').eq('id', auth.value.user.id).maybeSingle(),
      sb.from('clients').select('id').eq('id', clientId).eq('active', true).maybeSingle(),
      sb.from('tiktok_connections').select('id').eq('id', connectionId).eq('client_id', clientId).eq('status', 'connected').maybeSingle(),
    ])
    if (actor.error || client.error || connection.error || !actor.data?.is_active || !client.data || !connection.data) return jsonResponse({ ok: false, error: 'Exact active client/account unavailable.' }, 403)
    const read = () => sb.from('tiktok_business_authorizations')
      .select('id,client_id,connection_id,status,account_handle,token_expires_at,granted_permissions,refresh_fence')
      .eq('client_id', clientId).eq('connection_id', connectionId).maybeSingle()
    let result = await read()
    if (result.error) return jsonResponse({ ok: false, error: 'Business connection setup unavailable.' }, 503)
    if (result.data?.status === 'connected' && Date.parse(result.data.token_expires_at)<=Date.now()+600000
      && Deno.env.get('TIKTOK_BUSINESS_OAUTH_ENABLED') === 'true') {
      await refreshBusinessAuthorization(sb, result.data.id, businessOAuthConfig(name => Deno.env.get(name)))
      result = await read()
      if (result.error) return jsonResponse({ ok: false, error: 'Business connection refresh could not be verified.' }, 503)
    }
    const row = result.data
    const data = row ? { client_id: row.client_id, connection_id: row.connection_id, status: row.status,
      account_handle: row.account_handle, token_expires_at: row.token_expires_at, granted_permissions: row.granted_permissions,
      refresh_pending: row.status === 'connected' && row.refresh_fence !== null } : null
    return new Response(JSON.stringify({ ok: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch { return jsonResponse({ ok: false, error: 'Business connection check unavailable.' }, 503) }
})
