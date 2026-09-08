import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveTiktokConfig } from '../_shared/tiktok.ts'

const SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.publish',
]

function base64Url(bytes: Uint8Array): string {
  const raw = btoa(String.fromCharCode(...bytes))
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
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

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Use canonical admin|manager role check
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      ok: false,
      error: 'TikTok integration is not configured. Ask an admin to set Edge Function secrets.',
    }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  // Parse request body for clientId
  let body: { clientId?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (!body.clientId) {
    return jsonResponse({ ok: false, error: 'clientId is required. Select a client to connect TikTok to.' }, 400)
  }

  // Validate the client exists
  const { data: client } = await sb
    .from('clients')
    .select('id, name')
    .eq('id', body.clientId)
    .single()

  if (!client) {
    return jsonResponse({ ok: false, error: 'Client not found.' }, 400)
  }

  let config
  try {
    config = resolveTiktokConfig()
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Internal TikTok configuration error.',
    }, 500)
  }

  // Generate CSRF state with embedded clientId
  const stateBytes = new Uint8Array(32)
  crypto.getRandomValues(stateBytes)
  const rawState = base64Url(stateBytes)
  const stateHash = await sha256Hex(rawState)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // Store state with clientId so callback can resolve the exact TikTok ↔ client pair
  const { error: stateError } = await sb
    .from('tiktok_oauth_states')
    .insert({
      state_hash: stateHash,
      user_id: user.id,
      expires_at: expiresAt,
      client_id: body.clientId,
    })

  if (stateError) {
    console.error('TikTok OAuth state insert failed:', stateError.code ?? 'unknown')
    return jsonResponse({ ok: false, error: 'Could not start TikTok connection.' }, 500)
  }

  const params = new URLSearchParams({
    client_key: config.clientKey,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: config.redirectUri,
    state: rawState,
  })

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  return jsonResponse({
    ok: true,
    url,
    clientName: client.name,
  })
})
