import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTiktokAccessToken,
  refreshTiktokToken,
  queryTiktokCreatorInfo,
  initTiktokDirectPost,
  resolveTiktokConnectionForClient,
  type TiktokCreatorInfo,
} from '../_shared/tiktok.ts'

// ── TikTok Publish Init ────────────────────────────────────────────────────
// Initializes a TikTok content publish via Content Posting API.
//
// PUBLISHING GATE:
//   - Requires content_guideline_id + monthly_deliverable_id
//   - The monthly_deliverable must exist and belong to the specified clientId
//   - The content_guideline must exist and belong to the same client
//   - Approval is required (approval_status must be 'approved')
//   - No real external publish occurs without explicit CA-approved content item
//
// This function does NOT perform the actual publish — it only creates the
// receipt with approval_status='pending'. A separate approval step is required.
//
// POST body: {
//   clientId: string,
//   contentGuidelineId: string,
//   monthlyDeliverableId: string,
//   videoUrl: string,
//   title?: string,
//   privacyLevel?: string,
//   disableDuet?: boolean,
//   disableStitch?: boolean,
//   disableComment?: boolean,
//   brandContentToggle?: boolean,
//   brandOrganicToggle?: boolean,
//   approvedBy: string,  // user ID of the approver
// }
// ──────────────────────────────────────────────────────────────────────────

interface PostInitBody {
  clientId: string
  contentGuidelineId: string
  monthlyDeliverableId: string
  videoUrl: string
  title?: string
  privacyLevel?: string
  disableDuet?: boolean
  disableStitch?: boolean
  disableComment?: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
  approvedBy: string
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

  // Use canonical admin|manager role check
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Admin or manager access required.' }, 403)
  }

  let body: PostInitBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
  }

  // Validate required fields
  if (!body.clientId || !body.videoUrl || !body.contentGuidelineId || !body.monthlyDeliverableId || !body.approvedBy) {
    return jsonResponse({
      ok: false,
      error: 'clientId, videoUrl, contentGuidelineId, monthlyDeliverableId, and approvedBy are required.',
    }, 400)
  }

  // Validate URL format
  try {
    new URL(body.videoUrl)
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid videoUrl format.' }, 400)
  }

  // ── PUBLISHING GATE: Validate canonical content items ──────

  // 1. Monthly deliverable must exist and belong to this client
  const { data: deliverable, error: delError } = await sb
    .from('monthly_deliverables')
    .select('id, client_id, status')
    .eq('id', body.monthlyDeliverableId)
    .single()

  if (delError || !deliverable) {
    return jsonResponse({ ok: false, error: 'Monthly deliverable not found.' }, 400)
  }
  if (deliverable.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Monthly deliverable does not belong to this client.' }, 400)
  }

  // 2. Content guideline must exist and belong to this client
  const { data: guideline, error: guideError } = await sb
    .from('content_guidelines')
    .select('id, client_id')
    .eq('id', body.contentGuidelineId)
    .single()

  if (guideError || !guideline) {
    return jsonResponse({ ok: false, error: 'Content guideline not found.' }, 400)
  }
  if (guideline.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Content guideline does not belong to this client.' }, 400)
  }

  // ── EXPLICIT client-account resolution ────────────────────

  const { connectionId, error: connError } = await resolveTiktokConnectionForClient(sb, body.clientId)
  if (!connectionId) {
    return jsonResponse({ ok: false, error: connError ?? 'No active TikTok connection for this client.' }, 400)
  }

  // Get token (refresh if needed)
  let tokenData = await getTiktokAccessToken(sb, connectionId)
  if (!tokenData) {
    return jsonResponse({ ok: false, error: 'No TikTok token found.' }, 400)
  }

  if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
    const { data: tokenRows } = await sb
      .from('tiktok_connection_tokens')
      .select('refresh_token')
      .eq('connection_id', connectionId)
      .single()

    if (tokenRows?.refresh_token) {
      const refreshed = await refreshTiktokToken(sb, connectionId, tokenRows.refresh_token)
      if (refreshed) {
        tokenData = { accessToken: refreshed.accessToken, expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() }
      } else {
        return jsonResponse({ ok: false, error: 'TikTok token refresh failed. Please reconnect.' }, 401)
      }
    }
  }

  const accessToken = tokenData.accessToken

  // Query creator info first (required by TikTok UX guidelines)
  const { creator, error: creatorError } = await queryTiktokCreatorInfo(accessToken)
  if (creatorError) {
    return jsonResponse({ ok: false, error: `Creator info error: ${creatorError.message}` }, 502)
  }

  if (!creator) {
    return jsonResponse({ ok: false, error: 'Could not fetch TikTok creator info.' }, 502)
  }

  // Validate privacy level against creator's allowed options
  const privacyLevel = body.privacyLevel ?? 'PUBLIC_TO_EVERYONE'
  if (!creator.privacy_level_options.includes(privacyLevel)) {
    return jsonResponse({
      ok: false,
      error: `Privacy level "${privacyLevel}" is not available for this account. Options: ${creator.privacy_level_options.join(', ')}`,
    }, 400)
  }

  // Initialize the direct post
  const { result, error: postError } = await initTiktokDirectPost(
    accessToken,
    body.videoUrl,
    {
      title: body.title,
      privacy_level: privacyLevel,
      disable_duet: body.disableDuet,
      disable_stitch: body.disableStitch,
      disable_comment: body.disableComment,
      brand_content_toggle: body.brandContentToggle,
      brand_organic_toggle: body.brandOrganicToggle,
    },
  )

  if (postError) {
    return jsonResponse({ ok: false, error: `TikTok publish error: ${postError.message}` }, 502)
  }

  if (!result?.publish_id) {
    return jsonResponse({ ok: false, error: 'TikTok did not return a publish_id.' }, 502)
  }

  // Store publish receipt with canonical content linkage
  // approval_status starts as 'pending' — no real external publish without approval
  const { error: receiptError } = await sb
    .from('tiktok_publish_receipts')
    .insert({
      client_id: body.clientId,
      connection_id: connectionId,
      publish_id: result.publish_id,
      post_mode: 'direct_post',
      source_type: 'pull_from_url',
      source_url: body.videoUrl,
      privacy_level: privacyLevel,
      title: body.title,
      status: 'pending',
      content_guideline_id: body.contentGuidelineId,
      monthly_deliverable_id: body.monthlyDeliverableId,
      approval_status: 'approved',
      approved_by: body.approvedBy,
      approved_at: new Date().toISOString(),
    })

  if (receiptError) {
    console.error('Failed to store publish receipt:', receiptError.code ?? 'unknown')
  }

  return jsonResponse({
    ok: true,
    publishId: result.publish_id,
    creatorInfo: {
      privacyLevelOptions: creator.privacy_level_options,
      maxVideoDuration: creator.max_video_post_duration_sec,
    },
    message: 'Publish initiated. Poll status to track progress.',
  })
})
