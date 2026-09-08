import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveTiktokConfig } from '../_shared/tiktok.ts'

// TikTok Login Kit scopes for Display API and Content Posting API.
// user.info.basic — profile identity (required)
// user.info.profile — bio, verification
// user.info.stats — follower/following/likes counts
// video.list — video listing with metrics
// video.upload — upload content as draft
// video.publish — direct post to TikTok
const SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.upload',
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

async function requireStaff(req: Request, sb: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return { userId: null, error: jsonResponse({ ok: false, error: 'Authentication required.' }, 401) }

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return { userId: null, error: jsonResponse({ ok: false, error: 'Authentication required.' }, 401) }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return { userId: null, error: jsonResponse({ ok: false, error: 'Staff access required.' }, 403) }
  }

  return { userId: user.id as string, error: null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      ok: false,
      error: 'TikTok integration is not configured. Ask an admin to set TikTok and Supabase Edge Function secrets.',
    }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const auth = await requireStaff(req, sb)
  if (auth.error) return auth.error
  if (!auth.userId) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  // Generate CSRF state
  const stateBytes = new Uint8Array(32)
  crypto.getRandomValues(stateBytes)
  const state = base64Url(stateBytes)
  const stateHash = await sha256Hex(state)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const { error: stateError } = await sb
    .from('tiktok_oauth_states')
    .insert({
      state_hash: stateHash,
      user_id: auth.userId,
      expires_at: expiresAt,
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
    state,
  })

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  return jsonResponse({
    ok: true,
    url,
  })
})
