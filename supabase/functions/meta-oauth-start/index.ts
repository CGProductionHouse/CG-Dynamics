import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveMetaGraphConfig } from '../_shared/meta.ts'
import { createMetaOAuthRequest } from '../_shared/metaOAuthRequest.ts'

async function requireStaff(req: Request, sb: SupabaseClient) {
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

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { userId: null, error: jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403) }
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

  let graphVersion: string
  try {
    graphVersion = resolveMetaGraphConfig().version
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Internal Meta configuration error.',
    }, 500)
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

  // Reporting reconnects retain their exact scope list. A future, separately
  // approved publishing setup must explicitly request the additional permission;
  // the existing Connect Meta button never opts into this mode.
  const requestParams = new URL(req.url).searchParams
  const publishingRequested = requestParams.has('purpose') || requestParams.has('confirm_permission_request')
  if (publishingRequested) {
    if (requestParams.get('purpose') !== 'facebook_photo_publishing'
      || requestParams.get('confirm_permission_request') !== 'true'
      || requestParams.getAll('purpose').length !== 1 || requestParams.getAll('confirm_permission_request').length !== 1
      || [...requestParams.keys()].some(key => !['purpose', 'confirm_permission_request'].includes(key))) {
      return jsonResponse({ ok: false, code: 'META_PUBLISHING_CONSENT_REQUEST_INVALID', error: 'Confirm the exact Facebook publishing permission request.' }, 400)
    }
  }

  const result = await createMetaOAuthRequest(sb, auth.userId, {
    appId, redirectUri, graphVersion, publishing: publishingRequested,
  }, name => Deno.env.get(name))
  if (!result.ok) {
    const { status, ...body } = result
    return jsonResponse(body, status)
  }
  return jsonResponse(result)
})
