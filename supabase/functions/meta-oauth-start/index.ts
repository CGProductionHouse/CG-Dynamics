import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

// Scopes required for future Meta asset discovery and reporting:
// - pages_show_list      — list Facebook Pages the user manages
// - pages_read_engagement — read page-level engagement metrics
// - instagram_basic       — access Instagram accounts linked to pages
// - instagram_manage_insights — read Instagram insights
// - business_management   — access Business Manager asset list
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const appId = Deno.env.get('META_APP_ID')
  const redirectUri = Deno.env.get('META_REDIRECT_URI')

  if (!appId || !redirectUri) {
    return jsonResponse({
      ok: false,
      error: 'Meta integration is not configured. Ask an admin to set META_APP_ID and META_REDIRECT_URI.',
    }, 500)
  }

  // Generate a random state value for CSRF protection.
  // TODO: In a future phase, persist this state server-side and verify
  // it on the callback before exchanging the code for a token.
  const state = crypto.randomUUID()

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
    state,
  })
})
