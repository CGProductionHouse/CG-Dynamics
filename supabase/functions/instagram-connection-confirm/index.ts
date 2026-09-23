import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER,
  isInstagramStandaloneActivationEnabled,
} from '../_shared/instagramLogin.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ID = /^\d+$/
const USERNAME = /^[A-Za-z0-9._]{1,30}$/

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  if (!isInstagramStandaloneActivationEnabled(Deno.env.get('INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED'))) {
    return jsonResponse({ ok: false, error: INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER }, 503)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await sb.auth.getUser(bearer)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  const { data: profile } = await sb.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : ''
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const instagramAccountId = typeof body.instagramAccountId === 'string' ? body.instagramAccountId.trim() : ''
  const instagramUsername = typeof body.instagramUsername === 'string' ? body.instagramUsername.trim() : ''
  if (!UUID.test(connectionId) || !UUID.test(clientId) || !PROVIDER_ID.test(instagramAccountId) || !USERNAME.test(instagramUsername)) {
    return jsonResponse({ ok: false, error: 'Exact pending Instagram identity is required.' }, 400)
  }

  const { data, error } = await sb.rpc('confirm_instagram_login_connection', {
    p_connection_id: connectionId,
    p_client_id: clientId,
    p_instagram_account_id: instagramAccountId,
    p_instagram_username: instagramUsername,
    p_reviewed_by: user.id,
  })
  if (error) {
    const conflict = error.code === '23505' || /already|changed|pending|exact/i.test(error.message)
    return jsonResponse({ ok: false, error: conflict ? error.message : 'Could not confirm Instagram connection.' }, conflict ? 409 : 500)
  }

  const result = Array.isArray(data) ? data[0] : data
  return jsonResponse({ ok: true, assetId: result?.asset_id ?? result ?? null })
})
