import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTiktokAccessToken,
  refreshTiktokToken,
  queryTiktokCreatorInfo,
  initTiktokDirectPost,
  type TiktokCreatorInfo,
} from '../_shared/tiktok.ts'

// ── TikTok Publish Init ────────────────────────────────────────────────────
// Initializes a TikTok content publish (direct post or draft upload).
// Requires video.publish scope for direct post, video.upload for draft.
//
// POST body: {
//   clientId: string,
//   videoUrl: string,
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
  videoUrl: string
  title?: string
  privacyLevel?: string
  disableDuet?: boolean
  disableStitch?: boolean
  disableComment?: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
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

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  let body: PostInitBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
  }

  if (!body.clientId || !body.videoUrl) {
    return jsonResponse({ ok: false, error: 'clientId and videoUrl are required.' }, 400)
  }

  // Validate URL format
  try {
    new URL(body.videoUrl)
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid videoUrl format.' }, 400)
  }

  // Find active TikTok connection
  const { data: connections } = await sb
    .from('tiktok_connections')
    .select('id')
    .eq('status', 'connected')
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({ ok: false, error: 'No active TikTok connection.' }, 400)
  }

  const connectionId = connections[0].id

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

  // Store publish receipt
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
      status: 'processing',
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
  })
})
