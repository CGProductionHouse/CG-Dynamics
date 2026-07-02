import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Scopes required for future Meta asset discovery and reporting:
// - pages_show_list          - list Facebook Pages the connected user manages
// - pages_read_engagement    - read Facebook Page posts, engagement and follower fields
// - instagram_basic          - discover Instagram Business accounts linked to Pages
// - instagram_manage_insights - read Instagram media/account insights for reports
// - business_management      - discover Business Manager-owned pages/ad accounts
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
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

  const appId = Deno.env.get('META_APP_ID')
  const redirectUri = Deno.env.get('META_REDIRECT_URI')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!appId || !redirectUri || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      ok: false,
      error: 'Meta integration is not configured. Ask an admin to set Meta and Supabase Edge Function secrets.',
    }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const auth = await requireStaff(req, sb)
  if (auth.error) return auth.error
  if (!auth.userId) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const stateBytes = new Uint8Array(32)
  crypto.getRandomValues(stateBytes)
  const state = base64Url(stateBytes)
  const stateHash = await sha256Hex(state)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const { error: stateError } = await sb
    .from('meta_oauth_states')
    .insert({
      state_hash: stateHash,
      user_id: auth.userId,
      expires_at: expiresAt,
    })

  if (stateError) {
    console.error('Meta OAuth state insert failed:', stateError.code ?? 'unknown')
    return jsonResponse({ ok: false, error: 'Could not start Meta connection.' }, 500)
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: SCOPES.join(','),
  })

  const url = `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`

  return jsonResponse({
    ok: true,
    url,
  })
})
