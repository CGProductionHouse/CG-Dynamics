import { corsHeaders } from '../_shared/cors.ts'

// Server-side Supabase client using the service_role key.
// This bypasses RLS — only Edge Functions should ever use this.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function redirect(to: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: to },
  })
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

  // If Meta returned an error, redirect back to the app with ?meta=error.
  if (errorParam) {
    console.error('Meta OAuth error:', errorParam, errorDesc)
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  if (!code) {
    console.error('Meta OAuth callback missing code param')
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
    tokenResponse = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?${tokenParams.toString()}`,
      { method: 'POST' },
    )
  } catch (err) {
    console.error('Meta token exchange network error:', err)
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text()
    console.error('Meta token exchange error:', tokenResponse.status, body)
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const tokenData = await tokenResponse.json()
  const accessToken: string | undefined = tokenData.access_token

  if (!accessToken) {
    console.error('Meta token exchange missing access_token in response')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // ── Store connection metadata and token in database ──────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

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
        status: 'connected',
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id)

    if (updateError) {
      console.error('Failed to update meta_connections:', updateError)
    } else {
      connectionId = existing[0].id
    }
  } else {
    // Create new connection.
    const { data: inserted, error: insertError } = await sb
      .from('meta_connections')
      .insert({
        status: 'connected',
        last_connected_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert meta_connections:', insertError)
      return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
    }
    connectionId = inserted.id
  }

  if (!connectionId) {
    console.error('Could not determine connection ID')
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // Store the token in the server-only tokens table.
  // TODO: Replace with proper encryption (e.g. pgcrypto / pgsodium)
  // before production app review. The value stored here is the raw
  // Meta access token, but it lives in meta_connection_tokens which
  // has RLS with NO frontend policies — only service_role keys can
  // read it.
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
    console.error('Failed to store token:', tokenError)
    return redirect(`${appUrl}/admin/integrations/meta?meta=error`)
  }

  // Success — redirect back to the app.
  return redirect(`${appUrl}/admin/integrations/meta?meta=connected`)
})
