import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_GRAPH_VERSION = 'v22.0'

interface InstagramBusinessAccount {
  id: string
  username?: string
  name?: string
  profile_picture_url?: string
}

interface FbPage {
  id: string
  name: string
  category?: string
  tasks?: string[]
  instagram_business_account?: InstagramBusinessAccount
}

interface FbPageResponse {
  data: FbPage[]
}

interface AdAccount {
  id: string
  name: string
  account_status?: number
}

interface AdAccountResponse {
  data: AdAccount[]
}

function redact(text: string): string {
  return text
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Verify the caller is authenticated and has staff-level access.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  // Verify the JWT and check the user's role.
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  // Read the connected token.
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id')
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({
      ok: false,
      status: 'not_connected',
      message: 'Meta is not connected yet.',
    })
  }

  const { data: tokens } = await sb
    .from('meta_connection_tokens')
    .select('encrypted_access_token')
    .eq('connection_id', connections[0].id)
    .limit(1)

  if (!tokens || tokens.length === 0 || !tokens[0].encrypted_access_token) {
    return jsonResponse({
      ok: false,
      status: 'not_connected',
      message: 'Meta connection token is missing. Reconnect Meta.',
    })
  }

  const accessToken = tokens[0].encrypted_access_token
  const baseUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}`

  // ── Fetch Facebook Pages ─────────────────────────────────
  let pages: FbPage[] = []
  try {
    const pageParams = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,category,tasks,instagram_business_account{id,username,name,profile_picture_url}',
      limit: '100',
    })
    const pageRes = await fetch(`${baseUrl}/me/accounts?${pageParams.toString()}`)
    if (pageRes.ok) {
      const pageData: FbPageResponse = await pageRes.json()
      pages = pageData.data ?? []
    }
  } catch (err) {
    console.error('Failed to fetch Facebook Pages:', redact(err instanceof Error ? err.message : String(err)))
  }

  // ── Build Instagram accounts list ─────────────────────────
  const instagramAccounts: {
    id: string
    username: string | null
    name: string | null
    profilePictureUrl: string | null
    facebookPageId: string
    facebookPageName: string
  }[] = []

  for (const page of pages) {
    const ig = page.instagram_business_account
    if (ig?.id) {
      instagramAccounts.push({
        id: ig.id,
        username: ig.username ?? null,
        name: ig.name ?? null,
        profilePictureUrl: ig.profile_picture_url ?? null,
        facebookPageId: page.id,
        facebookPageName: page.name,
      })
    }
  }

  // ── Fetch Ad Accounts ─────────────────────────────────────
  let adAccounts: AdAccount[] = []
  let adAccountsError: string | null = null
  let adAccountsDiagnostic: Record<string, unknown> = { available: false }

  try {
    const adParams = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,account_status',
      limit: '100',
    })
    const adRes = await fetch(`${baseUrl}/me/adaccounts?${adParams.toString()}`)
    if (adRes.ok) {
      const adData: AdAccountResponse = await adRes.json()
      adAccounts = adData.data ?? []
      adAccountsDiagnostic = { available: true, count: adAccounts.length }
    } else {
      let safeMsg = `HTTP ${adRes.status}`
      try {
        const errBody = await adRes.json()
        const err = errBody?.error
        if (err && typeof err === 'object') {
          safeMsg = redact([
            err.message ? String(err.message) : null,
            err.type ? `type ${err.type}` : null,
            err.code !== undefined ? `code ${err.code}` : null,
          ].filter(Boolean).join(', ')) || safeMsg
        }
      } catch {
        // keep HTTP status fallback
      }
      adAccountsError = 'Ad account access is not available yet. The connected Meta user may lack Business Manager or ad account permissions.'
      adAccountsDiagnostic = { available: false, status: safeMsg, hint: 'Verify the connected Meta user has Business Manager access and ad account permissions. Additional Meta app review may also be required.' }
    }
  } catch (e) {
    adAccountsError = 'Ad account access is not available yet. The connected Meta user may lack Business Manager or ad account permissions.'
    adAccountsDiagnostic = { available: false, networkError: true, hint: 'Verify the connected Meta user has Business Manager access and ad account permissions. Additional Meta app review may also be required.' }
  }

  // ── Return safe response (no tokens) ──────────────────────
  return jsonResponse({
    ok: true,
    pages: pages.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      tasks: p.tasks ?? [],
      instagramAccount: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username ?? null,
            name: p.instagram_business_account.name ?? null,
            profilePictureUrl: p.instagram_business_account.profile_picture_url ?? null,
          }
        : null,
    })),
    instagramAccounts,
    adAccounts: adAccounts.map(a => ({
      id: a.id,
      name: a.name,
      accountStatus: a.account_status ?? null,
    })),
    adAccountsError,
    adAccountsDiagnostic,
  })
})
