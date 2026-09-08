import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveTiktokConfig, tiktokFetch, getTiktokUserInfo, redact } from '../_shared/tiktok.ts'

const REQUESTED_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.publish',
]

function redirect(to: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: to },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')
  const errorDesc = url.searchParams.get('error_description')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://cg-dynamics.vercel.app'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('TikTok OAuth missing Supabase server config')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  if (errorParam) {
    console.error('TikTok OAuth provider error:', redact(`${errorParam} ${errorDesc ?? ''}`, [code]))
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  if (!state) {
    console.error('TikTok OAuth callback missing state param')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  if (!code) {
    console.error('TikTok OAuth callback missing code param')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  // Verify state — extract clientId from the state row
  const stateHash = await sha256Hex(state)
  const { data: consumedState, error: stateError } = await sb
    .from('tiktok_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('state_hash', stateHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, user_id, client_id')
    .single()

  if (stateError || !consumedState) {
    console.error('TikTok OAuth invalid, used or expired state')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  const clientId = consumedState.client_id as string | null
  if (!clientId) {
    console.error('TikTok OAuth state missing client_id')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  // Exchange authorization code for tokens
  let config
  try {
    config = resolveTiktokConfig()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Internal TikTok configuration error.')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=config_error`)
  }

  const tokenParams = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  })

  let tokenResponse: Response
  try {
    // CORRECT ENDPOINT: /v2/oauth/token/ (not /oauth/token/)
    tokenResponse = await tiktokFetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })
  } catch (err) {
    console.error('TikTok token exchange network error:', redact(err instanceof Error ? err.message : String(err), [config.clientSecret, code]))
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  if (!tokenResponse.ok) {
    console.error('TikTok token exchange error:', tokenResponse.status)
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  // CORRECT PARSE: TikTok returns token fields at TOP LEVEL, not nested under data
  const tokenData = await tokenResponse.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    open_id?: string
    scope?: string
    token_type?: string
    error?: { message?: string; code?: string }
  }

  if (tokenData.error?.code && tokenData.error.code !== 'ok') {
    console.error('TikTok token exchange returned error:', tokenData.error.message)
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  const accessToken = tokenData.access_token
  const refreshToken = tokenData.refresh_token
  const expiresIn = tokenData.expires_in
  const openId = tokenData.open_id
  const grantedScopeStr = tokenData.scope ?? ''
  const grantedScopes = grantedScopeStr.split(',').map(s => s.trim()).filter(Boolean)

  if (!accessToken) {
    console.error('TikTok token exchange missing access_token')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  // Check missing scopes
  const missingScopes = REQUESTED_SCOPES.filter(scope => !grantedScopes.includes(scope))
  const connectionStatus = missingScopes.length === 0 ? 'connected' : 'needs_reauth'
  const permissionError = missingScopes.length > 0
    ? `Missing required TikTok permissions: ${missingScopes.join(', ')}. Reconnect TikTok and grant them.`
    : null

  // Fetch user info for display
  const { user: tiktokUser } = await getTiktokUserInfo(accessToken)

  // Upsert connection — explicitly bound to this clientId
  const { data: existing } = await sb
    .from('tiktok_connections')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)

  let connectionId: string | null = null

  if (existing && existing.length > 0) {
    const { error: updateError } = await sb
      .from('tiktok_connections')
      .update({
        connected_by: consumedState.user_id,
        tiktok_open_id: openId ?? tiktokUser?.open_id,
        display_name: tiktokUser?.display_name,
        avatar_url: tiktokUser?.avatar_url,
        profile_deep_link: tiktokUser?.profile_deep_link,
        status: connectionStatus,
        scopes: grantedScopes,
        last_error: permissionError,
        last_connected_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id)

    if (!updateError) connectionId = existing[0].id
  } else {
    const { data: inserted, error: insertError } = await sb
      .from('tiktok_connections')
      .insert({
        connected_by: consumedState.user_id,
        client_id: clientId,
        tiktok_open_id: openId ?? tiktokUser?.open_id,
        display_name: tiktokUser?.display_name,
        avatar_url: tiktokUser?.avatar_url,
        profile_deep_link: tiktokUser?.profile_deep_link,
        status: connectionStatus,
        scopes: grantedScopes,
        last_error: permissionError,
        last_connected_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert tiktok_connections:', insertError.code ?? 'unknown')
      return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
    }
    connectionId = inserted.id
  }

  if (!connectionId) {
    console.error('Could not determine TikTok connection ID')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  // Store tokens server-only
  const { error: tokenError } = await sb
    .from('tiktok_connection_tokens')
    .upsert({
      connection_id: connectionId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
    }, { onConflict: 'connection_id' })

  if (tokenError) {
    console.error('Failed to store TikTok token:', tokenError.code ?? 'unknown')
    return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=error`)
  }

  return redirect(`${appUrl}/admin/integrations/tiktok?tiktok=${missingScopes.length > 0 ? 'permissions_missing' : 'connected'}`)
})
