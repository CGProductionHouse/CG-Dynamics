import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface LinkInput {
  clientId?: string
  facebookPageId?: string | null
  facebookPageName?: string | null
  instagramAccountId?: string | null
  instagramUsername?: string | null
  adAccountId?: string | null
  adAccountName?: string | null
  allowOverwrite?: boolean
  instagramNotApplicable?: boolean
}

interface ExistingLink {
  id: string
  client_id: string
  facebook_page_id: string | null
  instagram_account_id: string | null
  ad_account_id: string | null
}

function differs(existing: ExistingLink, input: LinkInput): boolean {
  return (
    (existing.facebook_page_id ?? '') !== (input.facebookPageId ?? '') ||
    (existing.instagram_account_id ?? '') !== (input.instagramAccountId ?? '') ||
    (existing.ad_account_id ?? '') !== (input.adAccountId ?? '')
  )
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
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const auth = await requireStaff(req, sb)
  if (auth.error) return auth.error

  let body: { action?: string; link?: LinkInput; links?: LinkInput[]; assetId?: string } = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  if (body.action === 'deactivate') {
    if (!body.assetId) return jsonResponse({ ok: false, error: 'assetId is required.' }, 400)
    const { error } = await sb
      .from('meta_client_assets')
      .update({ is_active: false })
      .eq('id', body.assetId)
    if (error) return jsonResponse({ ok: false, error: 'Could not deactivate asset link.' }, 500)
    return jsonResponse({ ok: true, deactivated: 1 })
  }

  const links = body.links ?? (body.link ? [body.link] : [])
  if (links.length === 0) return jsonResponse({ ok: false, error: 'No links supplied.' }, 400)

  const { data: connections } = await sb
    .from('meta_connections')
    .select('id')
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1)

  const connectionId = connections?.[0]?.id ?? null
  const results: Array<{ clientId: string | null; status: 'linked' | 'skipped' | 'failed'; message: string }> = []

  for (const link of links) {
    const clientId = link.clientId ?? null
    if (!clientId) {
      results.push({ clientId, status: 'failed', message: 'Missing clientId.' })
      continue
    }

    const { data: client } = await sb
      .from('clients')
      .select('id, active')
      .eq('id', clientId)
      .single()

    if (!client?.active) {
      results.push({ clientId, status: 'skipped', message: 'Client is inactive or does not exist.' })
      continue
    }

    if (!link.facebookPageId && !link.instagramAccountId && !link.adAccountId && !link.instagramNotApplicable) {
      results.push({ clientId, status: 'skipped', message: 'No Meta asset ids supplied.' })
      continue
    }

    const { data: existingRows } = await sb
      .from('meta_client_assets')
      .select('id, client_id, facebook_page_id, instagram_account_id, ad_account_id')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .limit(1)

    const existing = existingRows?.[0] as ExistingLink | undefined
    if (existing && differs(existing, link) && !link.allowOverwrite) {
      results.push({ clientId, status: 'skipped', message: 'Existing active link differs. Explicit overwrite approval required.' })
      continue
    }

    const isIgNa = link.instagramNotApplicable === true
    const payload = {
      client_id: clientId,
      connection_id: connectionId,
      facebook_page_id: link.facebookPageId || null,
      facebook_page_name: link.facebookPageName || null,
      instagram_account_id: isIgNa ? null : (link.instagramAccountId || null),
      instagram_username: isIgNa ? null : (link.instagramUsername || null),
      ad_account_id: link.adAccountId || null,
      ad_account_name: link.adAccountName || null,
      instagram_not_applicable: isIgNa,
      instagram_not_applicable_updated_at: new Date().toISOString(),
      is_active: true,
    }

    const result = existing
      ? await sb.from('meta_client_assets').update(payload).eq('id', existing.id)
      : await sb.from('meta_client_assets').insert(payload)

    if (result.error) {
      results.push({ clientId, status: 'failed', message: 'Could not save link.' })
    } else {
      results.push({ clientId, status: 'linked', message: existing ? 'Updated active link.' : 'Created active link.' })
    }
  }

  return jsonResponse({
    ok: results.every(result => result.status !== 'failed'),
    linked: results.filter(result => result.status === 'linked').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'failed').length,
    results,
  })
})
