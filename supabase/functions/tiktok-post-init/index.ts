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
// PUBLISHING GATE (canonical approval must be proven before TikTok is called):
//   1. Monthly deliverable must exist, belong to the client, and be in an
//      approved/scheduled production_status (the canonical schedule-level
//      approval truth from the Content Review pipeline).
//   2. Content guideline must exist and belong to the same client.
//   3. An approved content_review_versions record must exist for this
//      deliverable, with 'tiktok' in its channels array. This is the
//      canonical content-level approval truth.
//   4. The publishable media URL is resolved SERVER-SIDE from the approved
//      review version's asset_path (signed URL). Caller-supplied videoUrl
//      is NOT trusted.
//   5. A durable local publish receipt is created BEFORE calling TikTok.
//      If receipt creation fails, TikTok is NOT called. If TikTok fails,
//      the failure is recorded against the pre-existing receipt.
//
// APPROVAL IDENTITY:
//   approvedBy is derived from the authenticated JWT (user.id), NEVER from the
//   request body. A caller cannot forge the approval identity. The role check
//   (admin | manager) runs before any content validation.
//
// POST body: {
//   clientId: string,
//   contentGuidelineId: string,
//   monthlyDeliverableId: string,
//   contentReviewVersionId: string,   // links to the approved creative asset
//   title?: string,
//   privacyLevel?: string,
//   disableDuet?: boolean,
//   disableStitch?: boolean,
//   disableComment?: boolean,
//   brandContentToggle?: boolean,
//   brandOrganicToggle?: boolean,
// }
// ──────────────────────────────────────────────────────────────────────────

interface PostInitBody {
  clientId: string
  contentGuidelineId: string
  monthlyDeliverableId: string
  contentReviewVersionId: string
  title?: string
  privacyLevel?: string
  disableDuet?: boolean
  disableStitch?: boolean
  disableComment?: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
}

/** Deliverable statuses that constitute canonical approval for publishing. */
const APPROVED_DELIVERABLE_STATUSES = new Set(['approved', 'scheduled'])

/** Content review states that constitute canonical content approval. */
const APPROVED_REVIEW_STATES = new Set(['approved'])

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

  // Validate required fields (videoUrl is NOT in the body — resolved server-side)
  if (!body.clientId || !body.contentGuidelineId || !body.monthlyDeliverableId || !body.contentReviewVersionId) {
    return jsonResponse({
      ok: false,
      error: 'clientId, contentGuidelineId, monthlyDeliverableId, and contentReviewVersionId are required.',
    }, 400)
  }

  // ── PUBLISHING GATE 1: Validate canonical deliverable ──────

  const { data: deliverable, error: delError } = await sb
    .from('monthly_deliverables')
    .select('id, client_id, production_status, deliverable_type')
    .eq('id', body.monthlyDeliverableId)
    .single()

  if (delError || !deliverable) {
    return jsonResponse({ ok: false, error: 'Monthly deliverable not found.' }, 400)
  }
  if (deliverable.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Monthly deliverable does not belong to this client.' }, 400)
  }

  // Verify the deliverable is actually in an approved/ready-to-publish state.
  // This is the canonical schedule-level approval truth from the Content Review pipeline.
  // Invoking the provider function does NOT itself constitute approval.
  if (!APPROVED_DELIVERABLE_STATUSES.has(deliverable.production_status)) {
    return jsonResponse({
      ok: false,
      error: `Deliverable is not approved for publishing (current status: ${deliverable.production_status}). Complete the Content Review approval workflow first.`,
    }, 400)
  }

  // ── PUBLISHING GATE 2: Validate content guideline ──────────

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

  // ── PUBLISHING GATE 3: Verify approved content review version ──

  const { data: reviewVersion, error: rvError } = await sb
    .from('content_review_versions')
    .select('id, deliverable_id, client_id, asset_path, media_type, channels, state')
    .eq('id', body.contentReviewVersionId)
    .single()

  if (rvError || !reviewVersion) {
    return jsonResponse({ ok: false, error: 'Content review version not found.' }, 400)
  }

  // Review version must belong to this deliverable
  if (reviewVersion.deliverable_id !== body.monthlyDeliverableId) {
    return jsonResponse({ ok: false, error: 'Content review version does not belong to this deliverable.' }, 400)
  }

  // Review version must belong to this client
  if (reviewVersion.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Content review version does not belong to this client.' }, 400)
  }

  // Review version must be in an approved state — this is the canonical content-level approval truth
  if (!APPROVED_REVIEW_STATES.has(reviewVersion.state)) {
    return jsonResponse({
      ok: false,
      error: `Content review is not approved (current state: ${reviewVersion.state}). Complete the Content Review approval workflow first.`,
    }, 400)
  }

  // Review version must include 'tiktok' in its channels
  const channels = Array.isArray(reviewVersion.channels) ? reviewVersion.channels : []
  if (!channels.includes('tiktok')) {
    return jsonResponse({
      ok: false,
      error: 'Content review was not approved for TikTok publishing. Resubmit with TikTok in the channels list.',
    }, 400)
  }

  // ── PUBLISHING GATE 4: Resolve media URL server-side ───────

  // The publishable video URL is resolved from the approved review version's
  // asset_path. Caller-supplied videoUrl is NOT trusted.
  const assetPath = reviewVersion.asset_path as string
  if (!assetPath) {
    return jsonResponse({ ok: false, error: 'Approved review version has no asset path.' }, 500)
  }

  // Generate a signed URL for the approved asset (24-hour expiry for publish window)
  const { data: signedUrlData, error: signedUrlError } = await sb.storage
    .from('content-review-snapshots')
    .createSignedUrl(assetPath, 60 * 60 * 24)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('Failed to create signed URL for approved asset:', signedUrlError?.message ?? 'unknown')
    return jsonResponse({ ok: false, error: 'Could not resolve the approved media URL.' }, 500)
  }

  const resolvedVideoUrl = signedUrlData.signedUrl

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

  // ── DURABLE LOCAL INTENT: Create publish receipt BEFORE TikTok call ──

  // The receipt is the durable local publish intent. If it cannot be created,
  // TikTok is NOT called. If TikTok fails, the failure is recorded against
  // this pre-existing receipt.
  const publishId = `pending_${crypto.randomUUID()}`
  const { data: receipt, error: receiptCreateError } = await sb
    .from('tiktok_publish_receipts')
    .insert({
      client_id: body.clientId,
      connection_id: connectionId,
      publish_id: publishId,
      post_mode: 'direct_post',
      source_type: 'pull_from_url',
      source_url: resolvedVideoUrl,
      privacy_level: privacyLevel,
      title: body.title,
      status: 'pending',
      content_guideline_id: body.contentGuidelineId,
      monthly_deliverable_id: body.monthlyDeliverableId,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (receiptCreateError || !receipt) {
    console.error('Failed to create publish receipt (TikTok NOT called):', receiptCreateError?.code ?? 'unknown')
    return jsonResponse({ ok: false, error: 'Could not create local publish intent. TikTok was NOT called.' }, 500)
  }

  // ── CALL TIKTOK: Only after durable local intent exists ────

  const { result, error: postError } = await initTiktokDirectPost(
    accessToken,
    resolvedVideoUrl,
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

  if (postError || !result?.publish_id) {
    // TikTok failed — record failure against the pre-existing receipt
    const errorMessage = postError?.message ?? 'TikTok did not return a publish_id.'
    await sb
      .from('tiktok_publish_receipts')
      .update({
        status: 'failed',
        provider_error: errorMessage,
      })
      .eq('id', receipt.id)

    return jsonResponse({ ok: false, error: `TikTok publish error: ${errorMessage}` }, 502)
  }

  // TikTok succeeded — update the pre-existing receipt with the real publish_id
  await sb
    .from('tiktok_publish_receipts')
    .update({
      publish_id: result.publish_id,
      status: 'pending',
    })
    .eq('id', receipt.id)

  return jsonResponse({
    ok: true,
    publishId: result.publish_id,
    receiptId: receipt.id,
    creatorInfo: {
      privacyLevelOptions: creator.privacy_level_options,
      maxVideoDuration: creator.max_video_post_duration_sec,
    },
    message: 'Publish initiated. Poll status to track progress.',
  })
})
