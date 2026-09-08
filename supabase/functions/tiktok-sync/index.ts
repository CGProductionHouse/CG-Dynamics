import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTiktokAccessToken,
  getTiktokUserInfo,
  getTiktokVideos,
  refreshTiktokToken,
  resolveTiktokConnectionForClient,
  type TiktokVideo,
} from '../_shared/tiktok.ts'

// ── TikTok Analytics Sync ──────────────────────────────────────────────────
// Fetches user profile + video list from TikTok Display API and upserts
// metrics into the shared platform_metric_facts_monthly table.
//
// TikTok Display API truth:
//   - Video metrics (view_count, like_count, etc.) are CUMULATIVE
//     lifetime snapshots at time of API call, not period deltas.
//   - follower_count is a current snapshot, not a period value.
//   - We filter videos by create_time to identify which videos were
//     published in the requested period, then store their CURRENT
//     cumulative metrics. Re-syncing the same month later WILL change
//     these numbers because videos accumulate engagement over time.
//
// Labeling: metrics for period videos are stored with
//   availability='partial' and notes describing them as
//   "cumulative as-of snapshot for videos published in period".
//   Profile snapshots are stored as-is for the sync date.
//
// Missing/error data is NEVER coerced to zero.
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

function getMonthBounds(periodMonth: string): { start: number; end: number } {
  const [year, month] = periodMonth.split('-').map(Number)
  // Unix seconds boundaries
  const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
  const end = Math.floor(new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000)
  return { start, end }
}

function getMonthDateBounds(periodMonth: string): { periodStart: string; periodEnd: string } {
  const [year, month] = periodMonth.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    periodStart: `${year}-${pad(month)}-01`,
    periodEnd: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
  }
}

function isVideoInPeriod(video: TiktokVideo, periodMonth: string): boolean {
  // create_time is int64 Unix epoch in seconds
  if (!video.create_time) return false
  const { start, end } = getMonthBounds(periodMonth)
  return video.create_time >= start && video.create_time <= end
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

  // EXPLICIT client-account resolution — never use "first connected"
  const { connectionId, error: connError } = await resolveTiktokConnectionForClient(sb, body.clientId)
  if (!connectionId) {
    return jsonResponse({ ok: false, error: connError ?? 'No active TikTok connection for this client.' }, 400)
  }

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
      } else {
        // Token refresh failed — cannot proceed
        return jsonResponse({ ok: false, error: 'TikTok token refresh failed. Please reconnect.' }, 401)
      }
    }
  }

  const accessToken = tokenData.accessToken

  // Track sync health — partial on any error
  let syncHealth: 'verified' | 'partial' | 'sync_error' = 'verified'
  const syncErrors: string[] = []

  // Create sync run record — start as 'running', finalize only after sync completes.
  // Interrupted executions must never remain 'success'.
  const { data: syncRun } = await sb
    .from('platform_sync_runs')
    .insert({
      client_id: body.clientId,
      connection_id: connectionId,
      platform: 'tiktok',
      run_type: 'manual',
      period_month: periodMonth,
      status: 'running',
      health_state: 'partial',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const syncRunId = syncRun?.id

  // Fetch user profile
  const { user: profileData, error: profileError } = await getTiktokUserInfo(accessToken)

  if (profileError) {
    syncErrors.push(`Profile fetch failed: ${profileError.message}`)
    syncHealth = 'sync_error'
  }

  // Fetch all videos (paginate) — track pagination health
  const allVideos: TiktokVideo[] = []
  let cursor: string | null = null
  let hasMore = true
  let paginationComplete = true

  while (hasMore) {
    const result = await getTiktokVideos(accessToken, 20, cursor ?? undefined)
    if (result.error) {
      syncErrors.push(`Video list error: ${result.error.message}`)
      syncHealth = 'partial'
      paginationComplete = false
      break
    }
    allVideos.push(...result.videos)
    cursor = result.cursor
    hasMore = result.hasMore

    // TikTok caps at 20 per page; if we hit 200+ and hasMore, note truncation
    if (allVideos.length >= 200 && hasMore) {
      syncErrors.push('Video list truncated at 200 — some older videos may be missing.')
      syncHealth = 'partial'
      paginationComplete = false
      break
    }
  }

  // Filter to period — using Unix second create_time comparison
  const periodVideos = allVideos.filter(v => isVideoInPeriod(v, periodMonth))

  // Compute metrics — preserve null for missing values, never coerce to zero
  const totals = periodVideos.reduce(
    (acc, v) => ({
      views: acc.views + (v.view_count ?? 0),
      likes: acc.likes + (v.like_count ?? 0),
      comments: acc.comments + (v.comment_count ?? 0),
      shares: acc.shares + (v.share_count ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  )

  // Truthful labeling:
  // - Video metrics are "cumulative as-of snapshot for videos published in period"
  // - Profile metrics are "current snapshot at sync time"
  // - These are NOT "monthly performance" — they're point-in-time cumulative snapshots
  const videoMetricNotes = `Cumulative as-of snapshot for ${periodVideos.length} video(s) published in ${periodMonth}. These numbers will change if re-synced later because videos accumulate engagement over time.`
  const profileMetricNotes = `Current snapshot at sync time (${new Date().toISOString().split('T')[0]}). Not attributable to any specific period.`

  const { periodStart, periodEnd } = getMonthDateBounds(periodMonth)

  // Upsert monthly facts for each metric
  // Must match the full 19-parameter signature of upsert_platform_metric_fact_preserving_verified
  // (see phase-20e-facts-client-access-and-curation.sql / _shared/meta.ts)
  const TIKTOK_CONNECTOR_VERSION = 'tiktok-v1'
  const facts = [
    { metricKey: 'views', sourceMetric: 'view_count', value: totals.views, aggregation: 'sum', comparableGroup: 'tiktok_organic' },
    { metricKey: 'likes', sourceMetric: 'like_count', value: totals.likes, aggregation: 'sum', comparableGroup: 'tiktok_organic' },
    { metricKey: 'comments', sourceMetric: 'comment_count', value: totals.comments, aggregation: 'sum', comparableGroup: 'tiktok_organic' },
    { metricKey: 'shares', sourceMetric: 'share_count', value: totals.shares, aggregation: 'sum', comparableGroup: 'tiktok_organic' },
    { metricKey: 'current_followers', sourceMetric: 'follower_count', value: profileData?.follower_count ?? null, aggregation: 'snapshot', comparableGroup: 'tiktok_profile' },
    { metricKey: 'following_count', sourceMetric: 'following_count', value: profileData?.following_count ?? null, aggregation: 'snapshot', comparableGroup: 'tiktok_profile' },
    { metricKey: 'total_likes', sourceMetric: 'likes_count', value: profileData?.likes_count ?? null, aggregation: 'snapshot', comparableGroup: 'tiktok_profile' },
    { metricKey: 'video_count', sourceMetric: 'video_count', value: profileData?.video_count ?? null, aggregation: 'snapshot', comparableGroup: 'tiktok_profile' },
  ]

  let upsertFailures = 0
  for (const fact of facts) {
    // Cumulative video metrics are 'partial' snapshots; profile metrics that
    // are null become 'unavailable'; non-null profile snapshots are 'partial'
    // because they are point-in-time, not period-truth.
    const availability = fact.value !== null ? 'partial' : 'unavailable'

    const { error } = await sb.rpc('upsert_platform_metric_fact_preserving_verified', {
      p_client_id: body.clientId,
      p_asset_id: null,
      p_platform: 'tiktok',
      p_period_month: periodMonth,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_metric_key: fact.metricKey,
      p_source_metric: fact.sourceMetric,
      p_value: fact.value,
      p_availability: availability,
      p_includes_paid: 'unknown',
      p_aggregation: fact.aggregation,
      p_comparable_group: fact.comparableGroup,
      p_api_version: 'v2',
      p_connector_version: TIKTOK_CONNECTOR_VERSION,
      p_source_timezone: null,
      p_provenance: { source: 'tiktok_display_api', sync_date: new Date().toISOString() },
      p_sync_run_id: syncRunId,
      p_verified_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`Failed to upsert metric ${fact.metricKey}:`, error.message)
      upsertFailures++
      syncErrors.push(`Metric ${fact.metricKey} upsert failed: ${error.message}`)
    }
  }

  if (upsertFailures > 0) {
    syncHealth = 'partial'
  }

  // Upsert video content mappings
  let mappingFailures = 0
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
      mappingFailures++
    }
  }

  if (mappingFailures > 0) {
    syncHealth = 'partial'
    syncErrors.push(`${mappingFailures} content mapping(s) failed to upsert.`)
  }

  // Determine final status based on actual health
  const finalStatus = syncHealth === 'sync_error' ? 'failed' : 'success'

  // Update sync run
  if (syncRunId) {
    await sb.from('platform_sync_runs')
      .update({
        status: finalStatus,
        health_state: syncHealth,
        finished_at: new Date().toISOString(),
        summary: {
          periodMonth,
          videosFound: allVideos.length,
          videosInPeriod: periodVideos.length,
          paginationComplete,
          totalViews: totals.views,
          totalLikes: totals.likes,
          followerCount: profileData?.follower_count ?? null,
          errors: syncErrors.length > 0 ? syncErrors : undefined,
        },
      })
      .eq('id', syncRunId)
  }

  return jsonResponse({
    ok: syncHealth !== 'sync_error',
    health: syncHealth,
    periodMonth,
    videosSynced: periodVideos.length,
    paginationComplete,
    metrics: {
      views: totals.views,
      likes: totals.likes,
      comments: totals.comments,
      shares: totals.shares,
      followers: profileData?.follower_count ?? null,
    },
    errors: syncErrors.length > 0 ? syncErrors : undefined,
  })
})
