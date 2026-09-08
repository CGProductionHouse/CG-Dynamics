import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getTiktokAccessToken, getTiktokPublishStatus } from '../_shared/tiktok.ts'

// ── TikTok Publish Status ──────────────────────────────────────────────────
// Polls TikTok for the status of a pending publish.
//
// Current TikTok status values (Sep 2026):
//   PROCESSING_UPLOAD   — upload in progress (FILE_UPLOAD source)
//   PROCESSING_DOWNLOAD — download in progress (PULL_FROM_URL source)
//   SENDING_TO_USER_INBOX — notification sent to creator's inbox
//   PUBLISH_COMPLETE    — content posted (direct post) or user posted via inbox
//   FAILED              — error occurred
//
// Public post ID: TikTok returns publicaly_available_post_id[] (note the typo is TikTok's)
// Only available for recent publishes; for older ones, fall back to /v2/video/list/ lookup.
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

  // Map TikTok status to our internal status
  // Current TikTok values: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SENDING_TO_USER_INBOX, FAILED, PUBLISH_COMPLETE
  let mappedStatus: string
  switch (status.status) {
    case 'PUBLISH_COMPLETE':
      mappedStatus = 'published'
      break
    case 'FAILED':
      mappedStatus = 'failed'
      break
    case 'PROCESSING_UPLOAD':
    case 'PROCESSING_DOWNLOAD':
    case 'SENDING_TO_USER_INBOX':
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

  // TikTok returns publicaly_available_post_id[] (note: TikTok's actual field name)
  // NOT status.video.id
  const publicPostIds = status.publicaly_available_post_id ?? []
  if (publicPostIds.length > 0) {
    updateFields.tiktok_video_id = publicPostIds[0]
  }

  await sb
    .from('tiktok_publish_receipts')
    .update(updateFields)
    .eq('publish_id', body.publishId)

  // If published, create content mapping using the public post ID
  if (mappedStatus === 'published' && publicPostIds.length > 0) {
    await sb
      .from('tiktok_content_mappings')
      .upsert({
        client_id: clientId,
        tiktok_video_id: publicPostIds[0],
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id,tiktok_video_id' })
  }

  return jsonResponse({
    ok: true,
    status: mappedStatus,
    tiktokStatus: status.status,
    publicPostIds,
    failReason: status.fail_reason ?? null,
    uploadedBytes: status.uploaded_bytes ?? null,
  })
})
