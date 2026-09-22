import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  INSTAGRAM_LOGIN_TOKEN_URL,
  missingInstagramLoginScopes,
  parseInstagramProfessionalIdentity,
  parseInstagramShortLivedToken,
  resolveInstagramGraphConfig,
} from '../_shared/instagramLogin.ts'

function redirect(appUrl: string, status: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: `${appUrl}/admin/integrations/meta?instagram=${status}` },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function boundedFetch(url: string, init?: RequestInit): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) })
}

Deno.serve(async req => {
  const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://cg-dynamics.vercel.app'
  const requestUrl = new URL(req.url)
  if (requestUrl.searchParams.get('error')) return redirect(appUrl, 'denied')

  const state = requestUrl.searchParams.get('state')
  const code = requestUrl.searchParams.get('code')?.replace(/#_$/, '')
  if (!state || !code) return redirect(appUrl, 'error')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appId = Deno.env.get('INSTAGRAM_APP_ID')
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')
  const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI')
  if (!supabaseUrl || !serviceRoleKey || !appId || !appSecret || !redirectUri) {
    console.error('Instagram Login callback is missing server configuration.')
    return redirect(appUrl, 'config_error')
  }

  let graphBaseUrl: string
  try {
    graphBaseUrl = resolveInstagramGraphConfig(Deno.env.get('INSTAGRAM_GRAPH_VERSION')).baseUrl
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid Instagram Graph configuration.')
    return redirect(appUrl, 'config_error')
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data: oauthState, error: stateError } = await sb
    .from('meta_instagram_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('state_hash', await sha256Hex(state))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('client_id, user_id')
    .single()
  if (stateError || !oauthState) return redirect(appUrl, 'invalid_state')

  try {
    const shortBody = new FormData()
    shortBody.set('client_id', appId)
    shortBody.set('client_secret', appSecret)
    shortBody.set('grant_type', 'authorization_code')
    shortBody.set('redirect_uri', redirectUri)
    shortBody.set('code', code)
    const shortResponse = await boundedFetch(INSTAGRAM_LOGIN_TOKEN_URL, { method: 'POST', body: shortBody })
    if (!shortResponse.ok) throw new Error(`Instagram short-lived token exchange failed with HTTP ${shortResponse.status}.`)
    const shortToken = parseInstagramShortLivedToken(await shortResponse.json())

    const longUrl = new URL(`${graphBaseUrl.replace(/\/v\d+\.\d+$/, '')}/access_token`)
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('access_token', shortToken.accessToken)
    const longResponse = await boundedFetch(longUrl.toString())
    if (!longResponse.ok) throw new Error(`Instagram long-lived token exchange failed with HTTP ${longResponse.status}.`)
    const longBody = await longResponse.json() as { access_token?: unknown; expires_in?: unknown }
    if (typeof longBody.access_token !== 'string' || !longBody.access_token) throw new Error('Instagram long-lived token is missing.')

    const identityUrl = new URL(`${graphBaseUrl}/me`)
    identityUrl.searchParams.set('fields', 'id,user_id,username,account_type')
    identityUrl.searchParams.set('access_token', longBody.access_token)
    const identityResponse = await boundedFetch(identityUrl.toString())
    if (!identityResponse.ok) throw new Error(`Instagram identity verification failed with HTTP ${identityResponse.status}.`)
    const identity = parseInstagramProfessionalIdentity(await identityResponse.json())
    if (identity.appScopedUserId !== shortToken.appScopedUserId) {
      throw new Error('Instagram token and verified account identity do not match.')
    }

    const missingScopes = missingInstagramLoginScopes(shortToken.permissions)
    if (missingScopes.length) throw new Error(`Instagram Login is missing required reporting permissions: ${missingScopes.join(', ')}.`)

    const expiresIn = typeof longBody.expires_in === 'number' && Number.isFinite(longBody.expires_in)
      ? longBody.expires_in
      : null
    const { error: saveError } = await sb.rpc('complete_instagram_login_connection', {
      p_client_id: oauthState.client_id,
      p_connected_by: oauthState.user_id,
      p_app_scoped_user_id: identity.appScopedUserId,
      p_instagram_account_id: identity.instagramAccountId,
      p_instagram_username: identity.username,
      p_account_type: identity.accountType,
      p_scopes: shortToken.permissions,
      p_access_token: longBody.access_token,
      p_token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    })
    if (saveError) throw new Error(`Instagram connection persistence failed (${saveError.code ?? 'unknown'}).`)

    // Deliberately not written to meta_client_assets here. A staff reviewer must
    // confirm exact-client identity before canonical reporting can use it.
    return redirect(appUrl, 'review_required')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Instagram Login callback failed.')
    return redirect(appUrl, 'error')
  }
})
