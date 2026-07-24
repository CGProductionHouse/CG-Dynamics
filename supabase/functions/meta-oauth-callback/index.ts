import { corsHeaders } from '../_shared/cors.ts'
import { metaFetch, readMetaError, redact, resolveMetaGraphConfig } from '../_shared/meta.ts'

// Server-side Supabase client using the service_role key.
// This bypasses RLS — only Edge Functions should ever use this.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REQUESTED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'read_insights',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
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

async function safeMetaError(res: Response, tokens: Array<string | null | undefined>): Promise<string> {
  const error = await readMetaError(res, tokens)
  return [
    error.message,
    error.type ? `type ${error.type}` : null,
    error.code ? `code ${error.code}` : null,
    error.subcode ? `subcode ${error.subcode}` : null,
    error.trace ? `trace ${error.trace}` : null,
  ].filter(Boolean).join(', ')
}

async function fetchGrantedScopes(graphBaseUrl: string, accessToken: string): Promise<string[]> {
  try {
    const response = await metaFetch(
      `${graphBaseUrl}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,
    )
    if (!response.ok) {
      console.error('Meta permission verification failed:', await safeMetaError(response, [accessToken]))
      return []
    }

    const body = await response.json() as {
      data?: Array<{ permission?: unknown; status?: unknown }>
    }
    return (body.data ?? [])
      .filter(item => item.status === 'granted' && typeof item.permission === 'string')
      .map(item => item.permission as string)
  } catch (error) {
    console.error(
      'Meta permission verification network error:',
      redact(error instanceof Error ? error.message : String(error), [accessToken]),
    )
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Parse query params from the Meta OAuth redirect.
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')
  const errorDesc = url.searchParams.get('error_description')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') || 'https://cg-dynamics.vercel.app'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Meta OAuth missing Supabase server config')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  let graphBaseUrl: string
  try {
    graphBaseUrl = resolveMetaGraphConfig().baseUrl
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Internal Meta configuration error.')
    return redirect(`${appUrl}/admin/integrations/meta?meta=config_error`)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // If Meta returned an error, redirect back to the app with ?meta=error.
  if (errorParam) {
    console.error('Meta OAuth provider error:', redact(`${errorParam} ${errorDesc ?? ''}`, [code]))
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  if (!state) {
    console.error('Meta OAuth callback missing state param')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  if (!code) {
    console.error('Meta OAuth callback missing code param')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const stateHash = await sha256Hex(state)
  const { data: consumedState, error: stateError } = await sb
    .from('meta_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('state_hash', stateHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, user_id')
    .single()

  if (stateError || !consumedState) {
    console.error('Meta OAuth invalid, used or expired state')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // Exchange the authorization code for a long-lived access token.
  const appId = Deno.env.get('META_APP_ID')
  const appSecret = Deno.env.get('META_APP_SECRET')
  const redirectUri = Deno.env.get('META_REDIRECT_URI')

  if (!appId || !appSecret || !redirectUri) {
    console.error('Meta OAuth missing server config (META_APP_ID, META_APP_SECRET or META_REDIRECT_URI)')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const tokenParams = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code,
  })

  let tokenResponse: Response
  try {
    tokenResponse = await metaFetch(
      `${graphBaseUrl}/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      },
    )
  } catch (err) {
    console.error('Meta token exchange network error:', redact(err instanceof Error ? err.message : String(err), [appSecret, code]))
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  if (!tokenResponse.ok) {
    console.error('Meta token exchange error:', await safeMetaError(tokenResponse, [appSecret, code]))
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const tokenData = await tokenResponse.json()
  const accessToken: string | undefined = tokenData.access_token

  if (!accessToken) {
    console.error('Meta token exchange missing access_token in response')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const grantedScopes = await fetchGrantedScopes(graphBaseUrl, accessToken)
  const missingScopes = REQUESTED_SCOPES.filter(scope => !grantedScopes.includes(scope))
  const connectionStatus = missingScopes.length === 0 ? 'connected' : 'needs_reauth'
  const permissionError = missingScopes.length > 0
    ? `Missing required Meta permissions: ${missingScopes.join(', ')}. Reconnect Meta and grant them.`
    : null

  // ── Store connection metadata and token in database ──────────
  // Upsert: use the first existing connection, or create a new one.
  // For now, we always create/update a single global connection row.
  const { data: existing } = await sb
    .from('meta_connections')
    .select('id')
    .limit(1)

  let connectionId: string | null = null

  if (existing && existing.length > 0) {
    // Update existing connection.
    const { error: updateError } = await sb
      .from('meta_connections')
      .update({
        connected_by: consumedState.user_id,
        status: connectionStatus,
        scopes: grantedScopes,
        last_error: permissionError,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id)

    if (updateError) {
      console.error('Failed to update meta_connections:', updateError.code ?? 'unknown')
    } else {
      connectionId = existing[0].id
    }
  } else {
    // Create new connection.
    const { data: inserted, error: insertError } = await sb
      .from('meta_connections')
      .insert({
        connected_by: consumedState.user_id,
        status: connectionStatus,
        scopes: grantedScopes,
        last_error: permissionError,
        last_connected_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert meta_connections:', insertError.code ?? 'unknown')
      return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
    }
    connectionId = inserted.id
  }

  if (!connectionId) {
    console.error('Could not determine connection ID')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // Store the token in the server-only tokens table.
  // IMPORTANT: This legacy column still stores the raw Meta token. It is
  // protected by RLS/no frontend policies and service_role-only access, but
  // production-ready encryption is still required before Meta app review.
  const { error: tokenError } = await sb
    .from('meta_connection_tokens')
    .upsert({
      connection_id: connectionId,
      encrypted_access_token: accessToken,
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
    }, { onConflict: 'connection_id' })

  if (tokenError) {
    console.error('Failed to store token:', tokenError.code ?? 'unknown')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // Success — redirect back to the app.
  return redirect(`${appUrl}/admin/integrations/meta?meta=${missingScopes.length > 0 ? 'permissions_missing' : 'connected'}`)
})
