import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildInstagramAuthorizationUrl,
  INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER,
  isInstagramStandaloneActivationEnabled,
} from '../_shared/instagramLogin.ts'
import { classifySocialProviderEligibility } from '../../../src/lib/socialProviderEligibility.ts'

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  if (!isInstagramStandaloneActivationEnabled(Deno.env.get('INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED'))) {
    return jsonResponse({ ok: false, error: INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER }, 503)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appId = Deno.env.get('INSTAGRAM_APP_ID')
  const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI')
  if (!supabaseUrl || !serviceRoleKey || !appId || !redirectUri) {
    return jsonResponse({ ok: false, error: 'Instagram Login is not configured.' }, 500)
  }

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await sb.auth.getUser(bearer)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const { data: profile } = await sb
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile?.is_active || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  let clientId: string
  try {
    const body = await req.json() as { clientId?: unknown }
    clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return jsonResponse({ ok: false, error: 'A valid clientId is required.' }, 400)
  }

  const [{ data: client }, { data: mappedRows }] = await Promise.all([
    sb.from('clients').select('id, active, package_settings').eq('id', clientId).single(),
    sb.from('meta_client_assets').select('id').eq('client_id', clientId).eq('is_active', true).not('instagram_account_id', 'is', null).limit(1),
  ])
  if (!client?.active) return jsonResponse({ ok: false, error: 'Client is inactive or does not exist.' }, 404)
  const eligibility = classifySocialProviderEligibility(client.package_settings)
  if (eligibility.state !== 'eligible') {
    return jsonResponse({ ok: false, error: eligibility.reason, eligibility: eligibility.state }, 409)
  }
  if (mappedRows?.length) {
    return jsonResponse({ ok: false, error: 'This client already has a canonical Instagram mapping.' }, 409)
  }

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const state = base64Url(bytes)
  const { error: stateError } = await sb.from('meta_instagram_oauth_states').insert({
    state_hash: await sha256Hex(state),
    user_id: user.id,
    client_id: clientId,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  if (stateError) return jsonResponse({ ok: false, error: 'Could not start Instagram Login.' }, 500)

  return jsonResponse({
    ok: true,
    url: buildInstagramAuthorizationUrl({ appId, redirectUri, state }),
  })
})
