import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_GRAPH_VERSION = 'v22.0'

interface SyncClient {
  assetId: string
  clientId: string
  clientName: string
  facebookPageId: string | null
  facebookPageName: string | null
  instagramAccountId: string | null
  instagramUsername: string | null
  adAccountId: string | null
}

interface SyncClientResult {
  clientId: string
  clientName: string
  assetId: string
  status: 'success' | 'failed'
  error?: string
  reportId?: string
  reportCreated: boolean
  reportReused: boolean
  postsSynced: number
  warnings: string[]
}

interface DbErrorLike {
  message?: string
  code?: string
  details?: string
  hint?: string
}

// Builds a safe, useful error string from a Supabase/PostgREST error. Never
// includes tokens — only error metadata. e.g.
// "duplicate key value violates unique constraint \"reports_master_unique\" — code 23505"
function describeDbError(err: DbErrorLike | null | undefined): string {
  if (!err) return 'unknown database error'
  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.code) parts.push(`code ${err.code}`)
  if (err.details) parts.push(err.details)
  if (err.hint) parts.push(err.hint)
  return parts.length > 0 ? parts.join(' — ') : 'unknown database error'
}

// First day of the month AFTER the given YYYY-MM (used for an exclusive upper
// bound when matching reports by period_end within a calendar month).
function nextMonthStart(month: string): string {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) // 1-12
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
}

interface SyncRunRecord {
  syncType: string
  periodStart: string
  periodEnd: string
  status: string
  summary: Record<string, unknown>
}

function getPreviousMonthBounds(): { periodStart: string; periodEnd: string; month: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate()
  const monthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`
  return {
    periodStart: `${monthStr}-01`,
    periodEnd: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
    month: monthStr,
  }
}

function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7))
  const y = Number(month.slice(0, 4))
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function mapFbPostType(attachments?: { data?: { media_type?: string }[] }): string {
  const t = attachments?.data?.[0]?.media_type ?? ''
  const lower = t.toLowerCase()
  if (lower.includes('video')) return 'Video'
  if (lower.includes('album') || lower === 'carousel') return 'Carousel'
  if (lower === 'photo') return 'Photo'
  return 'Post'
}

function mapIgMediaType(mediaType: string, mediaProductType?: string): string {
  if (mediaProductType === 'REELS') return 'Reel'
  if (mediaType === 'CAROUSEL_ALBUM') return 'Carousel'
  if (mediaType === 'VIDEO') return 'Video'
  if (mediaType === 'IMAGE') return 'Photo'
  return mediaType
}

// Safely parses a FB/IG date string to ISO.
function safeTimestamp(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ─────────────────────────────────────────────────
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

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return jsonResponse({ ok: false, error: 'Staff access required.' }, 403)
  }

  // ── Parse body ───────────────────────────────────────────
  let body: { mode?: string; clientId?: string } = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  if (body.mode !== 'previous_completed_month') {
    return jsonResponse({
      ok: false,
      error: `Unsupported mode "${body.mode ?? ''}". Only "previous_completed_month" is supported.`,
    }, 400)
  }

  // ── Calculate period ─────────────────────────────────────
  const { periodStart, periodEnd, month } = getPreviousMonthBounds()

  // ── Get Meta token ───────────────────────────────────────
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id')
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return jsonResponse({ ok: false, error: 'Meta is not connected.' }, 400)
  }

  const { data: tokenRows } = await sb
    .from('meta_connection_tokens')
    .select('encrypted_access_token')
    .eq('connection_id', connections[0].id)
    .limit(1)

  if (!tokenRows || tokenRows.length === 0 || !tokenRows[0].encrypted_access_token) {
    return jsonResponse({ ok: false, error: 'Meta connection token is missing. Reconnect Meta.' }, 400)
  }

  const accessToken = tokenRows[0].encrypted_access_token
  const baseUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}`

  // ── Load linked clients ──────────────────────────────────
  let linkedAssetsQuery = sb
    .from('meta_client_assets')
    .select('id, client_id, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, ad_account_id')
    .eq('is_active', true)

  if (body.clientId) {
    linkedAssetsQuery = linkedAssetsQuery.eq('client_id', body.clientId)
  }

  const { data: linkedAssets } = await linkedAssetsQuery

  if (!linkedAssets || linkedAssets.length === 0) {
    return jsonResponse({
      ok: true,
      status: 'skipped',
      message: 'No linked clients found to sync.',
      period: { periodStart, periodEnd, month },
      clientsAttempted: 0,
      clientsSucceeded: 0,
      clientsSynced: 0,
      clientsFailed: 0,
      reportsCreated: 0,
      reportsReused: 0,
      reportsUpdated: 0,
      postsSynced: 0,
      warnings: [],
      failedClients: [],
      succeededClients: [],
    })
  }

  // Load client names for the linked asset rows.
  const clientIds = [...new Set(linkedAssets.map(a => a.client_id))]
  const { data: clientRows } = await sb
    .from('clients')
    .select('id, name')
    .in('id', clientIds)
  const clientNameMap = new Map<string, string>()
  if (clientRows) {
    for (const c of clientRows) clientNameMap.set(c.id, c.name)
  }

  const allMappedClients: SyncClient[] = linkedAssets.map(a => ({
    assetId: a.id,
    clientId: a.client_id,
    clientName: clientNameMap.get(a.client_id) ?? 'Unknown',
    facebookPageId: a.facebook_page_id,
    facebookPageName: a.facebook_page_name,
    instagramAccountId: a.instagram_account_id,
    instagramUsername: a.instagram_username,
    adAccountId: a.ad_account_id,
  }))
  // A client can only be synced if it has at least one linked page/IG id.
  const clients: SyncClient[] = allMappedClients.filter(c => c.facebookPageId || c.instagramAccountId)
  const skippedAssets = allMappedClients.filter(c => !c.facebookPageId && !c.instagramAccountId)

  // ── Sync each client ─────────────────────────────────────
  const clientsAttempted = clients.length
  const results: SyncClientResult[] = []
  let totalPostsSynced = 0
  let clientsSynced = 0
  let clientsFailed = 0
  let reportsCreated = 0
  let reportsReused = 0
  const allWarnings: string[] = []

  // Linked assets with no Facebook page or Instagram account can't be synced —
  // surface them as a warning instead of silently dropping them.
  for (const skipped of skippedAssets) {
    allWarnings.push(`${skipped.clientName} has no linked Facebook page or Instagram account to sync.`)
  }

  for (const client of clients) {
    const result: SyncClientResult = {
      clientId: client.clientId,
      clientName: client.clientName,
      assetId: client.assetId,
      status: 'success',
      reportCreated: false,
      reportReused: false,
      postsSynced: 0,
      warnings: [],
    }

    try {
      // ── Find or create the monthly master report ───────
      // Find an existing MASTER report (platform IS NULL) for this client whose
      // period END falls inside the target calendar month, and reuse it.
      //
      // Meta-integrated reports must stay separate from old CSV/import reports,
      // so we deliberately only reuse the platform-null master. Legacy
      // per-platform reports (e.g. Facebook/Instagram CSV imports) are never
      // reused — if no master exists we create a fresh platform-null master.
      //
      // NOTE: PostgREST `.eq('platform', null)` does NOT match NULL — it must be
      // `.is('platform', null)`. The previous `.eq` always missed the existing
      // master report and then hit the reports_master_unique constraint on
      // insert, surfacing as the generic "Failed to create report".
      const monthEndExclusive = nextMonthStart(month)
      const { data: monthReports, error: findError } = await sb
        .from('reports')
        .select('id, platform, status, period_start, period_end, created_at')
        .eq('client_id', client.clientId)
        .is('platform', null)
        .gte('period_end', periodStart)
        .lt('period_end', monthEndExclusive)
        .order('created_at', { ascending: false })

      if (findError) {
        throw new Error(
          `Failed to look up existing report for ${client.clientName} (${client.clientId}) ` +
          `${periodStart}..${periodEnd}: ${describeDbError(findError)}`,
        )
      }

      // Reuse only a platform-null master report; ignore any legacy
      // per-platform reports for the same month.
      const existing = (monthReports ?? []).find(r => r.platform === null) ?? null

      let reportId: string

      if (existing) {
        // Reuse — never overwrite strategy_data and never change status, so a
        // published report stays published and a draft stays an internal draft.
        reportId = existing.id
        result.reportReused = true
        reportsReused++
      } else {
        const reportTitle = `${client.clientName} ${monthLabel(month)} Report`
        // Always full calendar-month bounds (e.g. 2026-05-01 .. 2026-05-31).
        const { data: newReport, error: insertError } = await sb
          .from('reports')
          .insert({
            client_id: client.clientId,
            platform: null,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'draft',
            report_title: reportTitle,
            created_by: user.id,
          })
          .select('id')
          .single()

        if (insertError || !newReport) {
          throw new Error(
            `Failed to create report for ${client.clientName} (${client.clientId}) ` +
            `${periodStart}..${periodEnd}: ${describeDbError(insertError)}`,
          )
        }
        reportId = newReport.id
        result.reportCreated = true
        reportsCreated++
      }

      result.reportId = reportId

      // ── Fetch Facebook posts ───────────────────────────
      const fbPosts: Array<{
        metaPostId: string
        publishTime: string | null
        caption: string | null
        permalink: string | null
        postType: string
        reactions: number
        comments: number
        shares: number
        impressions: number | null
        engagedUsers: number | null
        clicks: number | null
        impressionsUnique: number | null
        fullPicture: string | null
      }> = []

      if (client.facebookPageId) {
        try {
          const fbParams = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true),attachments',
            since: periodStart,
            until: `${periodEnd}T23:59:59Z`,
            limit: '100',
          })

          const fbRes = await fetch(`${baseUrl}/${client.facebookPageId}/posts?${fbParams.toString()}`)
          if (fbRes.ok) {
            const fbData = await fbRes.json()
            const rawPosts: Array<Record<string, unknown>> = fbData.data ?? []

            for (const raw of rawPosts) {
              const postId = String(raw.id ?? '')
              if (!postId) continue

              const reactions = (raw.reactions as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
              const comments = (raw.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
              const shares = (raw.shares as { count?: number })?.count ?? 0

              fbPosts.push({
                metaPostId: postId,
                publishTime: safeTimestamp(raw.created_time as string | null),
                caption: (raw.message as string | null) ?? null,
                permalink: (raw.permalink_url as string | null) ?? null,
                postType: mapFbPostType(raw.attachments as { data?: { media_type?: string }[] } | undefined),
                reactions,
                comments,
                shares,
                impressions: null,
                engagedUsers: null,
                clicks: null,
                impressionsUnique: null,
                fullPicture: (raw.full_picture as string | null) ?? null,
              })
            }

            // Attempt per-post insights (best-effort).
            for (const post of fbPosts) {
              try {
                const insightParams = new URLSearchParams({
                  access_token: accessToken,
                  metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks',
                })
                const insRes = await fetch(`${baseUrl}/${post.metaPostId}/insights?${insightParams.toString()}`)
                if (insRes.ok) {
                  const insData = await insRes.json()
                  const values = insData.data as Array<{ name: string; values?: Array<{ value: number }> }> ?? []
                  for (const v of values) {
                    const val = v.values?.[0]?.value
                    if (val === undefined || val === null) continue
                    switch (v.name) {
                      case 'post_impressions':
                        post.impressions = val
                        break
                      case 'post_impressions_unique':
                        post.impressionsUnique = val
                        break
                      case 'post_engaged_users':
                        post.engagedUsers = val
                        break
                      case 'post_clicks':
                        post.clicks = val
                        break
                    }
                  }
                }
              } catch {
                result.warnings.push(`Failed to fetch insights for FB post ${post.metaPostId}`)
              }
            }
          } else {
            result.warnings.push(`Failed to fetch Facebook posts: ${fbRes.status}`)
          }
        } catch (err) {
          result.warnings.push(`Error fetching Facebook posts: ${String(err)}`)
        }
      }

      // ── Fetch Instagram media ──────────────────────────
      const igPosts: Array<{
        metaPostId: string
        publishTime: string | null
        caption: string | null
        permalink: string | null
        postType: string
        reactions: number
        comments: number
        impressions: number | null
        reach: number | null
        saves: number | null
        shares: number | null
        videoViews: number | null
        thumbnailUrl: string | null
        mediaUrl: string | null
      }> = []

      if (client.instagramAccountId) {
        try {
          const igParams = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
            limit: '100',
          })

          const igRes = await fetch(`${baseUrl}/${client.instagramAccountId}/media?${igParams.toString()}`)
          if (igRes.ok) {
            const igData = await igRes.json()
            const rawMedia: Array<Record<string, unknown>> = igData.data ?? []

            for (const raw of rawMedia) {
              const mediaId = String(raw.id ?? '')
              if (!mediaId) continue

              const timestamp = safeTimestamp(raw.timestamp as string | null)
              if (!timestamp) continue

              // Filter to the period after retrieving (Meta IG uses 'before'/'after' cursors).
              const ts = new Date(timestamp)
              const periodStartDt = new Date(periodStart + 'T00:00:00Z')
              const periodEndDt = new Date(periodEnd + 'T23:59:59Z')
              if (ts < periodStartDt || ts > periodEndDt) continue

              igPosts.push({
                metaPostId: mediaId,
                publishTime: timestamp,
                caption: (raw.caption as string | null) ?? null,
                permalink: (raw.permalink as string | null) ?? null,
                postType: mapIgMediaType(
                  (raw.media_type as string) ?? '',
                  raw.media_product_type as string | undefined,
                ),
                reactions: (raw.like_count as number) ?? 0,
                comments: (raw.comments_count as number) ?? 0,
                impressions: null,
                reach: null,
                saves: null,
                shares: null,
                videoViews: null,
                thumbnailUrl: (raw.thumbnail_url as string | null) ?? null,
                mediaUrl: (raw.media_url as string | null) ?? null,
              })
            }

            // Attempt per-media insights (best-effort).
            for (const post of igPosts) {
              try {
                const igMetricParams = new URLSearchParams({
                  access_token: accessToken,
                  metric: 'views,reach,likes,comments,saves,shares',
                })
                const insRes = await fetch(`${baseUrl}/${post.metaPostId}/insights?${igMetricParams.toString()}`)
                if (insRes.ok) {
                  const insData = await insRes.json()
                  const values = insData.data as Array<{ name: string; values?: Array<{ value: number }> }> ?? []
                  for (const v of values) {
                    const val = v.values?.[0]?.value
                    if (val === undefined || val === null) continue
                    switch (v.name) {
                      case 'views':
                        post.impressions = val
                        break
                      case 'reach':
                        post.reach = val
                        break
                      case 'likes':
                        post.reactions = val
                        break
                      case 'comments':
                        post.comments = val
                        break
                      case 'saves':
                        post.saves = val
                        break
                      case 'shares':
                        post.shares = val
                        break
                    }
                  }
                }
              } catch {
                result.warnings.push(`Failed to fetch insights for IG media ${post.metaPostId}`)
              }
            }
          } else {
            result.warnings.push(`Failed to fetch Instagram media: ${igRes.status}`)
          }
        } catch (err) {
          result.warnings.push(`Error fetching Instagram media: ${String(err)}`)
        }
      }

      // ── Upsert posts and mappings ──────────────────────
      const allPosts = [
        ...fbPosts.map(p => ({ ...p, platform: 'facebook' as const })),
        ...igPosts.map(p => ({ ...p, platform: 'instagram' as const })),
      ]

      for (const post of allPosts) {
        // Check existing mapping for idempotency.
        const { data: existingMapping } = await sb
          .from('meta_content_mappings')
          .select('id, post_id')
          .eq('client_id', client.clientId)
          .eq('platform', post.platform)
          .eq('meta_object_id', post.metaPostId)
          .limit(1)

        if (existingMapping && existingMapping.length > 0 && existingMapping[0].post_id) {
          // Update existing post.
          const postId = existingMapping[0].post_id
          const { error: updateError } = await sb
            .from('posts')
            .update({
              report_id: reportId,
              platform: post.platform,
              publish_time: post.publishTime,
              meta_post_type: post.postType,
              caption: post.caption,
              permalink: post.permalink,
              views: post.impressions ?? post.impressionsUnique ?? 0,
              reach: post.reach ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: post.clicks ?? 0,
              raw: {
                platform: post.platform,
                synced_at: new Date().toISOString(),
                ...('fullPicture' in post && post.fullPicture ? { full_picture: post.fullPicture } : {}),
                ...('thumbnailUrl' in post && post.thumbnailUrl ? { thumbnail_url: post.thumbnailUrl } : {}),
                ...('mediaUrl' in post && post.mediaUrl ? { media_url: post.mediaUrl } : {}),
              },
            })
            .eq('id', postId)

          if (updateError) {
            result.warnings.push(`Could not update ${post.platform} post ${post.metaPostId}: ${describeDbError(updateError)}`)
            continue
          }

          // Update mapping last_synced_at.
          await sb
            .from('meta_content_mappings')
            .update({ last_synced_at: new Date().toISOString(), report_id: reportId })
            .eq('id', existingMapping[0].id)
        } else if (existingMapping && existingMapping.length > 0 && !existingMapping[0].post_id) {
          // Mapping exists but no post — create post and link.
          const { data: newPost, error: insertError } = await sb
            .from('posts')
            .insert({
              report_id: reportId,
              platform: post.platform,
              meta_post_id: post.metaPostId,
              publish_time: post.publishTime,
              meta_post_type: post.postType,
              caption: post.caption,
              permalink: post.permalink,
              views: post.impressions ?? post.impressionsUnique ?? 0,
              reach: post.reach ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: post.clicks ?? 0,
              raw: {
                platform: post.platform,
                synced_at: new Date().toISOString(),
                ...('fullPicture' in post && post.fullPicture ? { full_picture: post.fullPicture } : {}),
                ...('thumbnailUrl' in post && post.thumbnailUrl ? { thumbnail_url: post.thumbnailUrl } : {}),
                ...('mediaUrl' in post && post.mediaUrl ? { media_url: post.mediaUrl } : {}),
              },
            })
            .select('id')
            .single()

          if (insertError || !newPost) {
            result.warnings.push(`Could not save ${post.platform} post ${post.metaPostId}: ${describeDbError(insertError)}`)
            continue
          }

          await sb
            .from('meta_content_mappings')
            .update({
              post_id: newPost.id,
              report_id: reportId,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingMapping[0].id)
        } else {
          // No mapping — create post and mapping.
          const { data: newPost, error: insertError } = await sb
            .from('posts')
            .insert({
              report_id: reportId,
              platform: post.platform,
              meta_post_id: post.metaPostId,
              publish_time: post.publishTime,
              meta_post_type: post.postType,
              caption: post.caption,
              permalink: post.permalink,
              views: post.impressions ?? post.impressionsUnique ?? 0,
              reach: post.reach ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: post.clicks ?? 0,
              raw: {
                platform: post.platform,
                synced_at: new Date().toISOString(),
                ...('fullPicture' in post && post.fullPicture ? { full_picture: post.fullPicture } : {}),
                ...('thumbnailUrl' in post && post.thumbnailUrl ? { thumbnail_url: post.thumbnailUrl } : {}),
                ...('mediaUrl' in post && post.mediaUrl ? { media_url: post.mediaUrl } : {}),
              },
            })
            .select('id')
            .single()

          if (insertError || !newPost) {
            result.warnings.push(`Could not save ${post.platform} post ${post.metaPostId}: ${describeDbError(insertError)}`)
            continue
          }

          const { error: mappingError } = await sb
            .from('meta_content_mappings')
            .insert({
              client_id: client.clientId,
              report_id: reportId,
              post_id: newPost.id,
              platform: post.platform,
              meta_object_id: post.metaPostId,
              meta_object_type: post.postType,
              permalink: post.permalink,
              last_synced_at: new Date().toISOString(),
            })
          if (mappingError) {
            result.warnings.push(`Saved ${post.platform} post ${post.metaPostId} but could not record its mapping: ${describeDbError(mappingError)}`)
          }
        }

        result.postsSynced++
        totalPostsSynced++
      }

      // ── Fetch Facebook Page monthly totals ─────────────
      if (client.facebookPageId) {
        try {
          const pageInsightParams = new URLSearchParams({
            access_token: accessToken,
            metric: 'page_impressions,page_impressions_unique,page_engaged_users,page_views_total,page_fans',
            period: 'month',
            since: periodStart,
            until: periodEnd,
          })

          const pageInsRes = await fetch(`${baseUrl}/${client.facebookPageId}/insights?${pageInsightParams.toString()}`)
          if (pageInsRes.ok) {
            const pageInsData = await pageInsRes.json()
            const pageValues = pageInsData.data as Array<{ name: string; values?: Array<{ value: number }> }> ?? []

            let fbImpressions = 0
            let fbReach = 0
            let fbEngagements = 0
            let fbProfileVisits = 0
            let fbFollowers = 0

            for (const v of pageValues) {
              const val = v.values?.reduce((sum, entry) => sum + (entry.value ?? 0), 0) ?? 0
              switch (v.name) {
                case 'page_impressions':
                  fbImpressions = val
                  break
                case 'page_impressions_unique':
                  fbReach = val
                  break
                case 'page_engaged_users':
                  fbEngagements = val
                  break
                case 'page_views_total':
                  fbProfileVisits = val
                  break
                case 'page_fans':
                  fbFollowers = val
                  break
              }
            }

            // Upsert into manual_platform_metrics for Facebook.
            const { data: existingFbMetrics } = await sb
              .from('manual_platform_metrics')
              .select('id')
              .eq('client_id', client.clientId)
              .eq('month', month)
              .eq('platform', 'facebook')
              .limit(1)

            const fbMetricPayload = {
              client_id: client.clientId,
              month,
              platform: 'facebook',
              source_type: 'meta_business_sync',
              views: fbImpressions,
              reach: fbReach,
              engagements: fbEngagements,
              accounts_engaged: 0,
              profile_visits: fbProfileVisits,
              external_link_taps: 0,
              followers: fbFollowers,
              top_content_notes: null,
              content_type_split_notes: null,
              general_notes: `Synced from Meta API on ${new Date().toISOString().slice(0, 10)}`,
              created_by: user.id,
            }

            if (existingFbMetrics && existingFbMetrics.length > 0) {
              await sb.from('manual_platform_metrics').update(fbMetricPayload).eq('id', existingFbMetrics[0].id)
            } else {
              await sb.from('manual_platform_metrics').insert(fbMetricPayload)
            }
          } else {
            result.warnings.push(`Failed to fetch Facebook page insights: ${pageInsRes.status}`)
          }
        } catch (err) {
          result.warnings.push(`Error fetching Facebook page insights: ${String(err)}`)
        }
      }

      // ── Fetch Instagram account monthly totals ─────────
      if (client.instagramAccountId) {
        try {
          const igAccParams = new URLSearchParams({
            access_token: accessToken,
            metric: 'views,reach,profile_views,website_clicks',
            period: 'day',
            since: periodStart,
            until: periodEnd,
          })

          const igAccRes = await fetch(`${baseUrl}/${client.instagramAccountId}/insights?${igAccParams.toString()}`)
          if (igAccRes.ok) {
            const igAccData = await igAccRes.json()
            const igValues = igAccData.data as Array<{ name: string; values?: Array<{ value: number }> }> ?? []

            let igViews = 0
            let igReach = 0
            let igProfileVisits = 0
            let igWebsiteClicks = 0

            for (const v of igValues) {
              const val = v.values?.reduce((sum, entry) => sum + (entry.value ?? 0), 0) ?? 0
              switch (v.name) {
                case 'views':
                  igViews = val
                  break
                case 'reach':
                  igReach = val
                  break
                case 'profile_views':
                  igProfileVisits = val
                  break
                case 'website_clicks':
                  igWebsiteClicks = val
                  break
              }
            }

            // Upsert into manual_platform_metrics for Instagram.
            const { data: existingIgMetrics } = await sb
              .from('manual_platform_metrics')
              .select('id')
              .eq('client_id', client.clientId)
              .eq('month', month)
              .eq('platform', 'instagram')
              .limit(1)

            const igMetricPayload = {
              client_id: client.clientId,
              month,
              platform: 'instagram',
              source_type: 'meta_business_sync',
              views: igViews,
              reach: igReach,
              engagements: 0,
              accounts_engaged: 0,
              profile_visits: igProfileVisits,
              external_link_taps: igWebsiteClicks,
              followers: 0,
              top_content_notes: null,
              content_type_split_notes: null,
              general_notes: `Synced from Meta API on ${new Date().toISOString().slice(0, 10)}`,
              created_by: user.id,
            }

            if (existingIgMetrics && existingIgMetrics.length > 0) {
              await sb.from('manual_platform_metrics').update(igMetricPayload).eq('id', existingIgMetrics[0].id)
            } else {
              await sb.from('manual_platform_metrics').insert(igMetricPayload)
            }
          } else {
            result.warnings.push(`Failed to fetch Instagram account insights: ${igAccRes.status}`)
          }
        } catch (err) {
          result.warnings.push(`Error fetching Instagram account insights: ${String(err)}`)
        }
      }

      result.status = 'success'
      clientsSynced++
    } catch (err) {
      result.status = 'failed'
      // Our thrown errors already carry the detailed, token-free message.
      result.error = err instanceof Error ? err.message : String(err)
      clientsFailed++
    }

    results.push(result)
    allWarnings.push(...result.warnings)

    // ── Record per-client sync run ─────────────────────────
    try {
      const { error: runError } = await sb.from('meta_sync_runs').insert({
        client_id: client.clientId,
        asset_id: client.assetId,
        connection_id: connections[0].id,
        sync_type: 'previous_completed_month',
        period_start: periodStart,
        period_end: periodEnd,
        status: result.status,
        summary: {
          reportId: result.reportId ?? null,
          postsSynced: result.postsSynced,
          warnings: result.warnings,
          reportCreated: result.reportCreated,
          reportReused: result.reportReused,
        },
        error_message: result.error ?? null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      if (runError) {
        console.error('Failed to record meta_sync_runs row for client', client.clientId, describeDbError(runError))
      }
    } catch (logErr) {
      // Log but don't fail the sync.
      console.error('Failed to record meta_sync_runs row for client', client.clientId, String(logErr))
    }
  }

  // ── Determine overall sync status ──────────────────────
  // success = every attempted client succeeded
  // partial = at least one succeeded AND at least one failed
  // failed  = no client succeeded
  let overallStatus: string
  if (clientsSynced > 0 && clientsFailed === 0) {
    overallStatus = 'success'
  } else if (clientsSynced > 0 && clientsFailed > 0) {
    overallStatus = 'partial'
  } else {
    overallStatus = 'failed'
  }

  const failedClients = results
    .filter(r => r.status === 'failed')
    .map(r => ({ clientId: r.clientId, name: r.clientName, error: r.error ?? 'Unknown error' }))
  const succeededClients = results
    .filter(r => r.status === 'success')
    .map(r => ({ clientId: r.clientId, name: r.clientName, postsSynced: r.postsSynced, reportId: r.reportId ?? null }))

  return jsonResponse({
    ok: true,
    status: overallStatus,
    message: overallStatus === 'success'
      ? `Synced ${monthLabel(month)} for ${clientsSynced} client(s).`
      : overallStatus === 'partial'
        ? `Synced ${monthLabel(month)} — ${clientsSynced} succeeded, ${clientsFailed} failed.`
        : `Sync failed for all ${clientsAttempted} client(s).`,
    period: { periodStart, periodEnd, month },
    // Accurate per-run counters.
    clientsAttempted,
    clientsSucceeded: clientsSynced,
    clientsFailed,
    reportsCreated,
    reportsReused,
    reportsUpdated: reportsReused, // backward-compat alias (reused = updated with fresh posts)
    postsSynced: totalPostsSynced,
    warnings: allWarnings,
    failedClients,
    succeededClients,
    // Backward-compatible field used by the existing UI.
    clientsSynced,
    details: results,
  })
})
