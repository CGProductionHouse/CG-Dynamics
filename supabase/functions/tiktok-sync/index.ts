import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTiktokAccessToken,
  getTiktokUserInfo,
  getTiktokVideos,
  refreshTiktokToken,
  type TiktokVideo,
} from '../_shared/tiktok.ts'

// ── TikTok Analytics Sync ──────────────────────────────────────────────────
// Fetches user profile + video list from TikTok Display API and upserts
// monthly facts into the shared platform_metric_facts_monthly table.
//
// Uses TikTok's native metric definitions — no invented or relabeled metrics.
// Missing data is recorded as 'unavailable', never coerced to zero.
//
// POST body: { clientId: string, periodMonth?: string }
// periodMonth defaults to previous completed month (YYYY-MM).
// ──────────────────────────────────────────────────────────────────────────

interface SyncBody {
  clientId: string
  periodMonth?: string
}

function getPreviousMonth(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}

function getMonthBounds(periodMonth: string): { start: Date; end: Date } {
  const [year, month] = periodMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

function isVideoInPeriod(video: TiktokVideo, periodMonth: string): boolean {
  if (!video.create_time) return false
  const videoDate = new Date(video.create_time)
  const { start, end } = getMonthBounds(periodMonth)
  return videoDate >= start && videoDate <= end
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

  let body: SyncBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
  }

  if (!body.clientId) {
    return jsonResponse({ ok: false, error: 'clientId is required.' }, 400)
  }

  const periodMonth = body.periodMonth ?? getPreviousMonth()

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

  // Check if token needs refresh
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

  // Create sync run record
  const { data: syncRun } = await sb
    .from('platform_sync_runs')
    .insert({
      client_id: body.clientId,
      connection_id: connectionId,
      platform: 'tiktok',
      run_type: 'manual',
      period_month: periodMonth,
      status: 'success',
      health_state: 'verified',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const syncRunId = syncRun?.id

  // Fetch user profile
  const { user: profileData, error: profileError } = await getTiktokUserInfo(accessToken)

  if (profileError) {
    console.error('TikTok user info fetch failed:', profileError.message)
    if (syncRunId) {
      await sb.from('platform_sync_runs')
        .update({ status: 'failed', health_state: 'sync_error', summary: { error: profileError.message } })
        .eq('id', syncRunId)
    }
    return jsonResponse({ ok: false, error: `TikTok API error: ${profileError.message}` }, 502)
  }

  // Fetch all videos (paginate)
  const allVideos: TiktokVideo[] = []
  let cursor: string | null = null
  let hasMore = true

  while (hasMore && allVideos.length < 200) {
    const result = await getTiktokVideos(accessToken, 20, cursor ?? undefined)
    if (result.error) {
      console.error('TikTok video list error:', result.error.message)
      break
    }
    allVideos.push(...result.videos)
    cursor = result.cursor
    hasMore = result.hasMore
  }

  // Filter to period
  const periodVideos = allVideos.filter(v => isVideoInPeriod(v, periodMonth))

  // Compute metrics from video data
  const totals = periodVideos.reduce(
    (acc, v) => ({
      views: acc.views + (v.view_count ?? 0),
      likes: acc.likes + (v.like_count ?? 0),
      comments: acc.comments + (v.comment_count ?? 0),
      shares: acc.shares + (v.share_count ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  )

  // Upsert monthly facts for each metric
  const facts = [
    { metricKey: 'views', sourceMetric: 'view_count', value: totals.views, aggregation: 'sum', crossPlatform: true },
    { metricKey: 'likes', sourceMetric: 'like_count', value: totals.likes, aggregation: 'sum', crossPlatform: true },
    { metricKey: 'comments', sourceMetric: 'comment_count', value: totals.comments, aggregation: 'sum', crossPlatform: true },
    { metricKey: 'shares', sourceMetric: 'share_count', value: totals.shares, aggregation: 'sum', crossPlatform: true },
    { metricKey: 'current_followers', sourceMetric: 'follower_count', value: profileData?.follower_count ?? null, aggregation: 'snapshot', crossPlatform: true },
    { metricKey: 'following_count', sourceMetric: 'following_count', value: profileData?.following_count ?? null, aggregation: 'snapshot', crossPlatform: false },
    { metricKey: 'total_likes', sourceMetric: 'likes_count', value: profileData?.likes_count ?? null, aggregation: 'snapshot', crossPlatform: false },
    { metricKey: 'video_count', sourceMetric: 'video_count', value: profileData?.video_count ?? null, aggregation: 'snapshot', crossPlatform: false },
  ]

  for (const fact of facts) {
    const { error } = await sb.rpc('upsert_platform_metric_fact_preserving_verified', {
      p_client_id: body.clientId,
      p_platform: 'tiktok',
      p_metric_key: fact.metricKey,
      p_source_metric: fact.sourceMetric,
      p_period_month: periodMonth,
      p_value: fact.value,
      p_availability: fact.value !== null ? 'complete' : 'unavailable',
      p_sync_run_id: syncRunId,
      p_aggregation: fact.aggregation,
      p_cross_platform_additive: fact.crossPlatform,
    })

    if (error) {
      console.error(`Failed to upsert metric ${fact.metricKey}:`, error.message)
    }
  }

  // Upsert video content mappings
  for (const video of periodVideos) {
    const { error } = await sb
      .from('tiktok_content_mappings')
      .upsert({
        client_id: body.clientId,
        tiktok_video_id: video.id,
        title: video.title,
        share_url: video.share_url,
        embed_link: video.embed_link,
        duration: video.duration,
        cover_image_url: video.cover_image_url,
        view_count: video.view_count,
        like_count: video.like_count,
        comment_count: video.comment_count,
        share_count: video.share_count,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'client_id,tiktok_video_id' })

    if (error) {
      console.error(`Failed to upsert content mapping for video ${video.id}:`, error.message)
    }
  }

  // Update sync run
  if (syncRunId) {
    await sb.from('platform_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        summary: {
          videosSynced: periodVideos.length,
          totalViews: totals.views,
          totalLikes: totals.likes,
          followerCount: profileData?.follower_count ?? null,
        },
      })
      .eq('id', syncRunId)
  }

  return jsonResponse({
    ok: true,
    periodMonth,
    videosSynced: periodVideos.length,
    metrics: {
      views: totals.views,
      likes: totals.likes,
      comments: totals.comments,
      shares: totals.shares,
      followers: profileData?.follower_count ?? null,
    },
  })
})
