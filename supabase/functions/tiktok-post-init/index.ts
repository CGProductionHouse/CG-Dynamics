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
//      approved/scheduled production_status.
//   2. An approved content_review_versions record must exist for this
//      deliverable, with 'tiktok' in its channels array.
//   3. The publishable media URL is resolved SERVER-SIDE from the approved
//      review version's asset_path (signed URL).
//   4. The content guideline is DERIVED SERVER-SIDE from the approved review
//      version's source JSONB → content_guide_ideas → content_guidelines.
//      Caller-supplied contentGuidelineId is NOT trusted.
//   5. A durable local publish receipt is created BEFORE calling TikTok.
//
// SEPARATION OF APPROVAL AND PERMISSION:
//   An approved/scheduled item is NOT publishable merely because an admin/
//   manager invokes this function. The caller must provide an explicit
//   publishNowConfirmed=true assertion — a separately recorded "publish now"
//   consent for this exact approved version. This prevents arbitrary Edge
//   Function calls from publishing future scheduled content early.
//
// APPROVAL IDENTITY:
//   approvedBy is derived from the authenticated JWT (user.id), NEVER from the
//   request body.
//
// POST body: {
//   clientId: string,
//   monthlyDeliverableId: string,
//   contentReviewVersionId: string,
//   publishNowConfirmed: true,           // explicit "publish now" consent
//   title?: string,
//   privacyLevel: string,              // explicit creator selection; no default
//   disableDuet: boolean,
//   disableStitch: boolean,
//   disableComment: boolean,
//   brandContentToggle?: boolean,
//   brandOrganicToggle?: boolean,
// }
// ──────────────────────────────────────────────────────────────────────────

interface PostInitBody {
  clientId: string
  monthlyDeliverableId: string
  contentReviewVersionId: string
  publishNowConfirmed: boolean
  title?: string
  privacyLevel: string
  disableDuet: boolean
  disableStitch: boolean
  disableComment: boolean
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

  // Direct Post remains unavailable until CA deliberately enables the rollout
  // after TikTok app review, URL ownership, and compliant publish UX are proven.
  if (Deno.env.get('TIKTOK_PUBLISHING_ENABLED') !== 'true') {
    return jsonResponse({
      ok: false,
      error: 'TikTok publishing is not enabled for this environment.',
    }, 503)
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
  // - contentGuidelineId is NOT in the body (derived server-side from review version source)
  // - videoUrl is NOT in the body (resolved server-side from review version asset_path)
  // - publishNowConfirmed must be explicitly true (separates approval from permission)
  if (!body.clientId || !body.monthlyDeliverableId || !body.contentReviewVersionId) {
    return jsonResponse({
      ok: false,
      error: 'clientId, monthlyDeliverableId, and contentReviewVersionId are required.',
    }, 400)
  }

  if (body.publishNowConfirmed !== true) {
    return jsonResponse({
      ok: false,
      error: 'publishNowConfirmed must be true. An approved item is not publishable without explicit "publish now" consent.',
    }, 400)
  }

  if (
    !body.privacyLevel ||
    typeof body.disableDuet !== 'boolean' ||
    typeof body.disableStitch !== 'boolean' ||
    typeof body.disableComment !== 'boolean'
  ) {
    return jsonResponse({
      ok: false,
      error: 'Choose a privacy level and explicitly confirm Comment, Duet, and Stitch settings before publishing.',
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
  if (!APPROVED_DELIVERABLE_STATUSES.has(deliverable.production_status)) {
    return jsonResponse({
      ok: false,
      error: `Deliverable is not approved for publishing (current status: ${deliverable.production_status}). Complete the Content Review approval workflow first.`,
    }, 400)
  }

  // ── PUBLISHING GATE 2: Verify approved content review version ──

  const { data: reviewVersion, error: rvError } = await sb
    .from('content_review_versions')
    .select('id, deliverable_id, client_id, asset_path, media_type, channels, state, source')
    .eq('id', body.contentReviewVersionId)
    .single()

  if (rvError || !reviewVersion) {
    return jsonResponse({ ok: false, error: 'Content review version not found.' }, 400)
  }

  if (reviewVersion.deliverable_id !== body.monthlyDeliverableId) {
    return jsonResponse({ ok: false, error: 'Content review version does not belong to this deliverable.' }, 400)
  }

  if (reviewVersion.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Content review version does not belong to this client.' }, 400)
  }

  if (!APPROVED_REVIEW_STATES.has(reviewVersion.state)) {
    return jsonResponse({
      ok: false,
      error: `Content review is not approved (current state: ${reviewVersion.state}). Complete the Content Review approval workflow first.`,
    }, 400)
  }

  const channels = Array.isArray(reviewVersion.channels) ? reviewVersion.channels : []
  if (!channels.includes('tiktok')) {
    return jsonResponse({
      ok: false,
      error: 'Content review was not approved for TikTok publishing. Resubmit with TikTok in the channels list.',
    }, 400)
  }

  // ── PUBLISHING GATE 3: Derive content guideline server-side ──

  // contentGuidelineId is NOT caller-controlled. Derive from the approved
  // review version's source JSONB → content_guide_ideas → content_guidelines.
  const source = reviewVersion.source as Record<string, unknown> | null
  const videoId = source?.type === 'content_guideline_video' ? source.video_id as string : null

  if (!videoId) {
    return jsonResponse({
      ok: false,
      error: 'Approved review version does not reference a canonical content guide video.',
    }, 400)
  }

  const { data: guideIdea, error: giError } = await sb
    .from('content_guide_ideas')
    .select('id, content_guideline_id, client_id')
    .eq('id', videoId)
    .single()

  if (giError || !guideIdea) {
    return jsonResponse({ ok: false, error: 'Canonical content guide video not found.' }, 400)
  }

  if (guideIdea.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Content guide video does not belong to this client.' }, 400)
  }

  if (!guideIdea.content_guideline_id) {
    return jsonResponse({ ok: false, error: 'Content guide video is not linked to a Content Guideline.' }, 400)
  }

  // Validate the derived guideline belongs to this client
  const { data: guideline, error: guideError } = await sb
    .from('content_guidelines')
    .select('id, client_id')
    .eq('id', guideIdea.content_guideline_id)
    .single()

  if (guideError || !guideline) {
    return jsonResponse({ ok: false, error: 'Derived Content Guideline not found.' }, 400)
  }

  if (guideline.client_id !== body.clientId) {
    return jsonResponse({ ok: false, error: 'Derived Content Guideline does not belong to this client.' }, 400)
  }

  const contentGuidelineId = guideline.id

  // ── PUBLISHING GATE 4: Resolve media URL server-side ───────

  const assetPath = reviewVersion.asset_path as string
  if (!assetPath) {
    return jsonResponse({ ok: false, error: 'Approved review version has no asset path.' }, 500)
  }

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
  const privacyLevel = body.privacyLevel
  if (!creator.privacy_level_options.includes(privacyLevel)) {
    return jsonResponse({
      ok: false,
      error: `Privacy level "${privacyLevel}" is not available for this account. Options: ${creator.privacy_level_options.join(', ')}`,
    }, 400)
  }

  // ── DURABLE LOCAL INTENT: Create publish receipt BEFORE TikTok call ──

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
      content_guideline_id: contentGuidelineId,
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
