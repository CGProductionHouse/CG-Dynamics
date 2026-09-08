import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getTiktokAccessToken, getTiktokPublishStatus } from '../_shared/tiktok.ts'

// ── TikTok Publish Status ──────────────────────────────────────────────────
// Polls TikTok for the status of a pending publish.
//
// POST body: { publishId: string }
// ──────────────────────────────────────────────────────────────────────────

interface StatusBody {
  publishId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)
  }

  let body: StatusBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
  }

  if (!body.publishId) {
    return jsonResponse({ ok: false, error: 'publishId is required.' }, 400)
  }

  // Find connection from the publish receipt
  const { data: receipt } = await sb
    .from('tiktok_publish_receipts')
    .select('connection_id, client_id')
    .eq('publish_id', body.publishId)
    .single()

  if (!receipt) {
    return jsonResponse({ ok: false, error: 'Publish receipt not found.' }, 404)
  }

  const connectionId = receipt.connection_id as string
  const clientId = receipt.client_id as string

  const tokenData = await getTiktokAccessToken(sb, connectionId)
  if (!tokenData) {
    return jsonResponse({ ok: false, error: 'No TikTok token found.' }, 400)
  }

  const { status, error: statusError } = await getTiktokPublishStatus(tokenData.accessToken, body.publishId)

  if (statusError) {
    return jsonResponse({ ok: false, error: `TikTok status error: ${statusError.message}` }, 502)
  }

  if (!status) {
    return jsonResponse({ ok: false, error: 'Could not fetch publish status.' }, 502)
  }

  // Map TikTok status to our status
  let mappedStatus: string
  switch (status.status) {
    case 'PUBLISH_COMPLETE':
      mappedStatus = 'published'
      break
    case 'PUBLISH_FAILED':
      mappedStatus = 'failed'
      break
    case 'PROCESSING':
    case 'UPLOAD_IN_PROGRESS':
      mappedStatus = 'processing'
      break
    default:
      mappedStatus = 'pending'
  }

  // Update receipt
  const updateFields: Record<string, unknown> = {
    status: mappedStatus,
  }
  if (status.fail_reason) updateFields.provider_error = status.fail_reason
  if (status.video?.id) updateFields.tiktok_video_id = status.video.id

  await sb
    .from('tiktok_publish_receipts')
    .update(updateFields)
    .eq('publish_id', body.publishId)

  // If published, also create a content mapping
  if (mappedStatus === 'published' && status.video?.id) {
    await sb
      .from('tiktok_content_mappings')
      .upsert({
        client_id: clientId,
        tiktok_video_id: status.video.id,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id,tiktok_video_id' })
  }

  return jsonResponse({
    ok: true,
    status: mappedStatus,
    tiktokStatus: status.status,
    videoId: status.video?.id ?? null,
    failReason: status.fail_reason ?? null,
  })
})
