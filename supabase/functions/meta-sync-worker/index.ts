import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  META_CONNECTOR_VERSION,
  MetaSyncDeadlineError,
  metaPostBounds,
  metaFetch,
  readMetaError,
  redact,
  resolveMetaGraphConfig,
  syncAccountFacts,
} from '../_shared/meta.ts'
import { upsertMetaReportPost } from '../_shared/metaPostMerge.ts'

// Scheduled/background syncing shares the SAME truth contract as manual syncing:
// configurable Graph version, shared connector engine (syncAccountFacts) writing
// normalized facts + provenance, shared retry/backoff and token handling.
const BATCH_SIZE = 1
const META_COLLECTION_PAGE_CAP = 25
const MAX_WORK_MS = 40_000
const PAGE_FETCH_RESERVE_MS = 8_000
const MIN_PAGE_REQUEST_BUDGET_MS = 4_000

class RetryableIncompleteError extends Error {}

function monthBounds(month: string): { periodStart: string; periodEnd: string } {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return {
    periodStart: `${month}-01`,
    periodEnd: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7))
  const y = Number(month.slice(0, 4))
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

async function parseMetaError(
  res: Response,
  context: string,
  tokens: Array<string | null | undefined>,
): Promise<string> {
  const error = await readMetaError(res, tokens)
  const detail = [
    error.message,
    error.type ? `type: ${error.type}` : null,
    error.code ? `code: ${error.code}` : null,
    error.subcode ? `subcode: ${error.subcode}` : null,
  ].filter(Boolean).join(', ')
  return redact(`${context} failed (HTTP ${res.status}): ${detail}`, tokens)
}

interface MetaCollectionResult {
  pagesFetched: number
  complete: boolean
  error: string | null
  retryable: boolean
}

type MetaSyncState = 'pending' | 'facts_pending' | 'complete' | 'failed' | 'not_applicable'
const TERMINAL_META_STATES = new Set<MetaSyncState>(['complete', 'failed', 'not_applicable'])

function assertWorkBudget(deadline: number, context: string): void {
  if (Date.now() >= deadline - PAGE_FETCH_RESERVE_MS) {
    throw new RetryableIncompleteError(`${context} paused to preserve the worker lease budget.`)
  }
}

function safePagingCursor(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) return null
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 31 || codePoint === 127) return null
  }
  return value
}

async function fetchMetaCollection(
  initialUrl: string,
  resumeCursor: string | null,
  context: string,
  tokens: Array<string | null | undefined>,
  deadline: number,
  processPage: (items: Array<Record<string, unknown>>) => Promise<number>,
  checkpoint: (nextCursor: string | null, complete: boolean, pagePostsSynced: number) => Promise<void>,
): Promise<MetaCollectionResult> {
  const expectedOrigin = new URL(initialUrl).origin
  let nextCursor = resumeCursor
  let pagesFetched = 0

  while (pagesFetched < META_COLLECTION_PAGE_CAP) {
    const remainingMs = deadline - Date.now()
    if (remainingMs < MIN_PAGE_REQUEST_BUDGET_MS + PAGE_FETCH_RESERVE_MS) {
      return {
        pagesFetched,
        complete: false,
        error: `${context} paused before page ${pagesFetched + 1} to preserve the worker lease budget.`,
        retryable: true,
      }
    }
    // metaFetch can make three bounded attempts. Keep each attempt short enough
    // that retries plus backoff cannot consume the rest of this invocation.
    const requestTimeoutMs = Math.max(1_000, Math.min(3_000, Math.floor((remainingMs - PAGE_FETCH_RESERVE_MS) / 3)))
    const requestUrl = new URL(initialUrl)
    if (nextCursor) requestUrl.searchParams.set('after', nextCursor)
    const res = await metaFetch(requestUrl.toString(), requestTimeoutMs)
    pagesFetched++
    if (!res.ok) {
      return { pagesFetched, complete: false, error: await parseMetaError(res, `${context} page ${pagesFetched}`, tokens), retryable: false }
    }
    const page = await res.json()
    const nextUrl = typeof page.paging?.next === 'string' ? page.paging.next : null
    if (nextUrl) {
      try {
        if (new URL(nextUrl).origin !== expectedOrigin) {
          return { pagesFetched, complete: false, error: `${context} returned an invalid paging URL.`, retryable: false }
        }
      } catch {
        return { pagesFetched, complete: false, error: `${context} returned an invalid paging URL.`, retryable: false }
      }
    }
    const candidateCursor = nextUrl ? safePagingCursor(page.paging?.cursors?.after) : null
    if (nextUrl && !candidateCursor) {
      return { pagesFetched, complete: false, error: `${context} returned an unsafe or missing paging cursor.`, retryable: false }
    }
    const pagePostsSynced = await processPage((page.data as Array<Record<string, unknown>> | undefined) ?? [])
    await checkpoint(candidateCursor, !nextUrl, pagePostsSynced)
    if (!nextUrl) return { pagesFetched, complete: true, error: null, retryable: false }
    nextCursor = candidateCursor
  }

  return {
    pagesFetched,
    complete: false,
    error: `${context} reached the ${META_COLLECTION_PAGE_CAP}-page invocation cap and will resume from its saved cursor.`,
    retryable: true,
  }
}

/**
 * Durable "a worker is alive and holding this batch" marker.
 *
 * MUST NOT throw. supabase-js query builders are thenable but do NOT implement
 * `.catch()`, so `sb.rpc(...).catch(...)` raises a TypeError that escapes as an
 * unhandled rejection and kills the invocation — which strands exactly the
 * items this call exists to protect. A real try/catch is the only safe form,
 * and a missed heartbeat is harmless: the reaper simply revives the batch a
 * minute later.
 */
async function touchBatch(sb: ReturnType<typeof createClient>, batchId: string): Promise<void> {
  try {
    await sb.rpc('meta_sync_touch_batch', { p_batch_id: batchId })
  } catch {
    // Heartbeat is best-effort by design.
  }
}

/* ---------- Auth ---------- */

async function authorizeWorker(
  req: Request,
  sb: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  // 1. Internal worker secret (preferred for cron / enqueue triggers)
  const workerSecret = Deno.env.get('META_SYNC_WORKER_SECRET') ?? ''
  const headerSecret = req.headers.get('x-worker-secret') ?? ''
  if (workerSecret && headerSecret === workerSecret) {
    return { ok: true }
  }

  // 2. Staff JWT (for manual invocations)
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (token) {
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (!authError && user) {
      const { data: profile } = await sb
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single()
      if (profile?.is_active === true && ['admin', 'manager'].includes(profile.role)) {
        return { ok: true }
      }
    }
  }

  return { ok: false, status: 401, body: { ok: false, error: 'Unauthorized. Provide x-worker-secret header or a valid staff JWT.' } }
}

/* ---------- Main handler ---------- */

Deno.serve(async (req) => {
  const startedAt = Date.now()
  const invocationDeadline = startedAt + MAX_WORK_MS
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

  const auth = await authorizeWorker(req, sb)
  if (!auth.ok) return jsonResponse(auth.body, auth.status)

  let graphConfig: ReturnType<typeof resolveMetaGraphConfig>
  try {
    graphConfig = resolveMetaGraphConfig()
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Internal Meta configuration error.' }, 500)
  }

  let body: { batchId?: string; maxItems?: number }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  // ── Get Meta access token ──────────────────────────────────
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
    return jsonResponse({ ok: false, error: 'Meta connection token is missing.' }, 400)
  }

  const accessToken = tokenRows[0].encrypted_access_token
  const { baseUrl, version: graphVersion } = graphConfig

  // ── Fetch page token map once per invocation ──────────────
  const pageTokenMap = new Map<string, string>()
  let pageTokenRateLimited = false
  let pageTokenBudgetExhausted = false
  {
    let url: string | null = `${baseUrl}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(accessToken)}`
    let guard = 0
    while (url && guard < 10 && !pageTokenRateLimited) {
      const remainingMs = invocationDeadline - Date.now()
      if (remainingMs < MIN_PAGE_REQUEST_BUDGET_MS + PAGE_FETCH_RESERVE_MS) {
        pageTokenBudgetExhausted = true
        break
      }
      guard++
      const requestTimeoutMs = Math.max(1_000, Math.min(3_000, Math.floor((remainingMs - PAGE_FETCH_RESERVE_MS) / 3)))
      const res = await metaFetch(url, requestTimeoutMs)
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        if (errBody?.error && (errBody.error.code === 4 || errBody.error.error_subcode === 2069032)) {
          pageTokenRateLimited = true
        }
        break
      }
      const data = await res.json()
      for (const p of (data.data as Array<{ id?: string; access_token?: string }> ?? [])) {
        if (p.id && p.access_token) pageTokenMap.set(p.id, p.access_token)
      }
      url = (data.paging?.next as string | undefined) ?? null
    }
  }

  // ── Process items in chunks (continuation loop) ─────────────
  const MAX_CHUNKS = 5
  // Stay well under the platform function timeout so a slow Meta API call can
  // never kill the invocation mid-chunk and strand claimed items as "running".
  // If we run out of budget we stop claiming and let the self-trigger below
  // pick up the next chunk (leases make this safe under concurrency).
  const processed: Array<{ itemId: string; clientName: string; month: string; status: string; postsSynced: number; error?: string }> = []
  const batchIds = new Set<string>()
  let claimCount = 0
  let claimFailed = false
  let budgetDeferred = false
  // Every item this invocation has claimed, and every item it actually reached.
  // The difference is released at the end so an abandoned claim never burns a
  // retry attempt — that is what used to force-fail clients the worker never
  // even looked at.
  const claimedIds = new Set<string>()
  const settledIds = new Set<string>()

  while (claimCount < MAX_CHUNKS) {
    if (Date.now() >= invocationDeadline - PAGE_FETCH_RESERVE_MS || pageTokenBudgetExhausted) break
    const { data: items, error: claimError } = await sb.rpc('claim_sync_batch_items', {
      p_limit: body.maxItems ?? BATCH_SIZE,
      p_batch_id: body.batchId ?? null,
    })

    if (claimError) {
      // RPC may not exist yet — process what we have so far
      claimFailed = true
      break
    }

    if (!items || !Array.isArray(items) || items.length === 0) break

    claimCount++

    for (const item of items) {
      batchIds.add(item.batch_id)
      claimedIds.add(item.id)
      // Durable proof that a worker is alive and holding this batch. The cron
      // reaper reads this to tell a working batch from an abandoned one.
      await touchBatch(sb, item.batch_id)

      // ── Skip current/future months ──
      if (item.month >= currentMonthStr()) {
        await sb.from('meta_sync_batch_items').update({
          status: 'skipped',
          error: 'Month is not yet completed.',
          finished_at: new Date().toISOString(),
        }).eq('id', item.id)
        settledIds.add(item.id)
        processed.push({ itemId: item.id, clientName: item.client_name, month: item.month, status: 'skipped', postsSynced: 0 })
        continue
      }

      const { periodStart, periodEnd } = monthBounds(item.month)
      const postBounds = metaPostBounds(periodStart, periodEnd)
      let postsSynced = Number(item.posts_synced ?? 0)
      let reportsCreated = Number(item.reports_created ?? 0)
      let reportsReused = Number(item.reports_reused ?? 0)
      const warnings: string[] = Array.isArray(item.warnings)
        ? item.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
        : []
      const providerPaging: Record<string, { pagesFetched: number; complete: boolean; pageCap: number }> = {}
      let itemError: string | null = null
      let itemStatus = 'completed'

      try {
        // ── Find or create report ──
        const { data: existingReports } = await sb
          .from('reports')
          .select('id')
          .eq('client_id', item.client_id)
          .is('platform', null)
          .gte('period_end', periodStart)
          .lte('period_end', periodEnd)
          .order('created_at', { ascending: false })
          .limit(1)

        let reportId: string | null = null
        if (existingReports && existingReports.length > 0) {
          reportId = existingReports[0].id
          reportsReused = 1
        } else {
          const { data: newReport, error: insertError } = await sb
            .from('reports')
            .insert({
              client_id: item.client_id,
              platform: null,
              period_start: periodStart,
              period_end: periodEnd,
              status: 'draft',
              report_title: `${item.client_name} ${monthLabel(item.month)} Report`,
            })
            .select('id')
            .single()
          if (!insertError && newReport) {
            reportId = newReport.id
            reportsCreated = 1
          }
        }

        if (!reportId) {
          itemStatus = 'failed'
          itemError = 'Could not create or find report'
          // Fall through to terminal update — do not continue
        }

        // ── Get linked assets for this client ──
        const { data: linkedAssets } = await sb
          .from('meta_client_assets')
          .select('id, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, instagram_not_applicable')
          .eq('client_id', item.client_id)
          .eq('is_active', true)

        if ((linkedAssets?.length ?? 0) > 1) {
          throw new Error('Multiple active Meta asset mappings require review. Configure one active Page/Instagram mapping row for this client.')
        }

        const asset = linkedAssets?.[0]
        const facebookPageId = asset?.facebook_page_id ?? null
        const instagramAccountId = (asset?.instagram_not_applicable === true) ? null : (asset?.instagram_account_id ?? null)

        const now = new Date().toISOString()
        let facebookState = (item.facebook_sync_state ?? 'pending') as MetaSyncState
        let instagramState = (item.instagram_sync_state ?? 'pending') as MetaSyncState
        let facebookCursor = (item.facebook_next_cursor as string | null | undefined) ?? null
        let instagramCursor = (item.instagram_next_cursor as string | null | undefined) ?? null

        const savePlatformState = async (
          platform: 'facebook' | 'instagram',
          state: MetaSyncState,
          cursor: string | null,
          completedPagePosts = 0,
        ): Promise<void> => {
          const checkpointedPostsSynced = postsSynced + completedPagePosts
          const { error } = await sb.from('meta_sync_batch_items').update({
            [`${platform}_sync_state`]: state,
            [`${platform}_next_cursor`]: cursor,
            posts_synced: checkpointedPostsSynced,
          }).eq('id', item.id).eq('status', 'running')
          if (error) throw new Error(`Could not checkpoint ${platform} sync: ${error.message}`)
          postsSynced = checkpointedPostsSynced
          if (platform === 'facebook') {
            facebookState = state
            facebookCursor = cursor
          } else {
            instagramState = state
            instagramCursor = cursor
          }
        }

        if (!reportId) {
          await savePlatformState('facebook', 'failed', null)
          await savePlatformState('instagram', 'failed', null)
        }

        // Page checkpoints happen only after every post on that page has been
        // idempotently upserted. If budget expires mid-loop, the page repeats.
        if (!facebookPageId && !TERMINAL_META_STATES.has(facebookState)) {
          await savePlatformState('facebook', 'not_applicable', null)
        } else if (facebookPageId && reportId && facebookState === 'pending') {
          if (pageTokenRateLimited) {
            const message = 'Facebook sync paused because Meta rate-limited the Page token request.'
            if (item.attempts < 3) throw new RetryableIncompleteError(message)
            warnings.push(message)
            itemStatus = 'failed'
            itemError = message
            await savePlatformState('facebook', 'failed', null)
          }
          const pageToken = pageTokenMap.get(facebookPageId)
          if (facebookState === 'pending' && !pageToken) {
            const message = 'Facebook page token unavailable for linked page. Relink Meta or verify page access.'
            warnings.push(message)
            itemStatus = 'failed'
            itemError = message
            await savePlatformState('facebook', 'failed', null)
          } else if (facebookState === 'pending' && pageToken) {
            try {
              const params = new URLSearchParams({
                access_token: pageToken,
                fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)',
                since: postBounds.since,
                until: postBounds.until,
                limit: '100',
              })
              const fbCollection = await fetchMetaCollection(
                `${baseUrl}/${facebookPageId}/posts?${params.toString()}`,
                facebookCursor,
                'Facebook posts fetch',
                [accessToken, ...pageTokenMap.values()],
                invocationDeadline,
                async rawPosts => {
                  let pagePostsSynced = 0
                  for (const raw of rawPosts) {
                    assertWorkBudget(invocationDeadline, 'Facebook post upserts')
                    const metaPostId = String(raw.id ?? '')
                    if (!metaPostId) continue
                    const publishTime = raw.created_time ? new Date(raw.created_time as string).toISOString() : null
                    const caption = (raw.message as string | null) ?? null
                    const permalink = (raw.permalink_url as string | null) ?? null
                    const reactions = (raw.reactions as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
                    const comments = (raw.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
                    const shares = (raw.shares as { count?: number })?.count ?? 0
                    const fullPicture = raw.full_picture as string | null ?? null
                    await upsertMetaReportPost(sb, {
                      clientId: item.client_id,
                      metaObjectId: metaPostId,
                      payload: {
                        report_id: reportId, platform: 'facebook', meta_post_id: metaPostId,
                        publish_time: publishTime, caption, permalink, views: null, reach: null,
                        reactions, comments, shares,
                        raw: {
                          source: 'meta_sync', platform: 'facebook', synced_at: now,
                          views: null, reach: null, engagements: { reactions, comments, shares },
                          metric_availability: { views: false, reach: false, content_interactions: true, source: 'direct_fields' },
                          meta_payload: raw, ...(fullPicture ? { full_picture: fullPicture } : {}),
                        },
                      },
                    })
                    pagePostsSynced++
                  }
                  return pagePostsSynced
                },
                async (cursor, complete, pagePostsSynced) => savePlatformState('facebook', complete ? 'facts_pending' : 'pending', cursor, pagePostsSynced),
              )
              providerPaging.facebook = { pagesFetched: fbCollection.pagesFetched, complete: fbCollection.complete, pageCap: META_COLLECTION_PAGE_CAP }
              if (!fbCollection.complete) {
                const message = fbCollection.error ?? 'Facebook posts result was incomplete.'
                warnings.push(message)
                if (fbCollection.retryable) throw new RetryableIncompleteError(message)
                itemStatus = 'failed'
                itemError = message
                await savePlatformState('facebook', 'failed', null)
              }
            } catch (e) {
              if (e instanceof RetryableIncompleteError && item.attempts < 3) throw e
              const message = redact(`Facebook sync error: ${String(e)}`, [accessToken, ...pageTokenMap.values()])
              providerPaging.facebook = { pagesFetched: 0, complete: false, pageCap: META_COLLECTION_PAGE_CAP }
              warnings.push(message)
              itemStatus = 'failed'
              itemError = message
              await savePlatformState('facebook', 'failed', null)
            }
          }
        }

        if (!instagramAccountId && !TERMINAL_META_STATES.has(instagramState)) {
          await savePlatformState('instagram', 'not_applicable', null)
        } else if (instagramAccountId && reportId && instagramState === 'pending') {
          const pageToken = facebookPageId ? (pageTokenMap.get(facebookPageId) ?? accessToken) : accessToken
          try {
            const params = new URLSearchParams({
              access_token: pageToken,
              fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
              limit: '100',
            })
            const igCollection = await fetchMetaCollection(
              `${baseUrl}/${instagramAccountId}/media?${params.toString()}`,
              instagramCursor,
              'Instagram media fetch',
              [accessToken, ...pageTokenMap.values()],
              invocationDeadline,
              async rawMedia => {
                let pagePostsSynced = 0
                for (const raw of rawMedia) {
                  assertWorkBudget(invocationDeadline, 'Instagram post upserts')
                  const metaPostId = String(raw.id ?? '')
                  if (!metaPostId) continue
                  const timestamp = raw.timestamp ? new Date(raw.timestamp as string).toISOString() : null
                  if (!timestamp) continue
                  const ts = new Date(timestamp)
                  const pStart = new Date(Number(postBounds.since) * 1000)
                  const pEnd = new Date(Number(postBounds.until) * 1000)
                  if (ts < pStart || ts >= pEnd) continue
                  const likes = (raw.like_count as number) ?? 0
                  const igComments = (raw.comments_count as number) ?? 0
                  const mediaType = (raw.media_type as string) ?? ''
                  const mediaProductType = raw.media_product_type as string | undefined
                  let postType = mediaType
                  if (mediaProductType === 'REELS') postType = 'Reel'
                  else if (mediaType === 'CAROUSEL_ALBUM') postType = 'Carousel'
                  else if (mediaType === 'VIDEO') postType = 'Video'
                  else if (mediaType === 'IMAGE') postType = 'Photo'
                  await upsertMetaReportPost(sb, {
                    clientId: item.client_id,
                    metaObjectId: metaPostId,
                    metaObjectType: postType,
                    payload: {
                      report_id: reportId, platform: 'instagram', meta_post_id: metaPostId,
                      publish_time: timestamp, caption: (raw.caption as string | null) ?? null,
                      permalink: (raw.permalink as string | null) ?? null, views: null, reach: null,
                      reactions: likes, comments: igComments, shares: 0,
                      raw: {
                        source: 'meta_sync', platform: 'instagram', synced_at: now,
                        content_type: postType, views: null, reach: null,
                        engagements: { likes, comments: igComments },
                        metric_availability: { views: false, reach: false, content_interactions: true, source: 'media_fields' },
                        meta_payload: raw,
                        ...(raw.thumbnail_url ? { thumbnail_url: raw.thumbnail_url as string } : {}),
                        ...(raw.media_url ? { media_url: raw.media_url as string } : {}),
                      },
                    },
                  })
                  pagePostsSynced++
                }
                return pagePostsSynced
              },
              async (cursor, complete, pagePostsSynced) => savePlatformState('instagram', complete ? 'facts_pending' : 'pending', cursor, pagePostsSynced),
            )
            providerPaging.instagram = { pagesFetched: igCollection.pagesFetched, complete: igCollection.complete, pageCap: META_COLLECTION_PAGE_CAP }
            if (!igCollection.complete) {
              const message = igCollection.error ?? 'Instagram media result was incomplete.'
              warnings.push(message)
              if (igCollection.retryable) throw new RetryableIncompleteError(message)
              itemStatus = 'failed'
              itemError = message
              await savePlatformState('instagram', 'failed', null)
            }
          } catch (e) {
            if (e instanceof RetryableIncompleteError && item.attempts < 3) throw e
            const message = redact(`Instagram sync error: ${String(e)}`, [accessToken, ...pageTokenMap.values()])
            providerPaging.instagram = { pagesFetched: 0, complete: false, pageCap: META_COLLECTION_PAGE_CAP }
            warnings.push(message)
            itemStatus = 'failed'
            itemError = message
            await savePlatformState('instagram', 'failed', null)
          }
        }

        // Account facts are separately resumable after post pagination. Check
        // budget before each sequential stage so the lease has time to requeue.
        const allTokens = [accessToken, ...pageTokenMap.values()]
        if (facebookState === 'facts_pending' && facebookPageId) {
          const fbPageToken = pageTokenMap.get(facebookPageId)
          if (!fbPageToken) {
            warnings.push('Facebook account facts failed: Page access token unavailable.')
            itemStatus = 'failed'
            itemError = 'Normalized Facebook account facts failed. Post content was preserved, but reporting truth is incomplete.'
            await savePlatformState('facebook', 'failed', null)
          } else {
            try {
              assertWorkBudget(invocationDeadline, 'Facebook account facts')
              await syncAccountFacts(sb, {
                clientId: item.client_id, assetId: asset?.id ?? null, connectionId: connections[0].id,
                platform: 'facebook', objectId: facebookPageId, token: fbPageToken,
                baseUrl, apiVersion: graphVersion, periodMonth: item.month, periodStart, periodEnd,
                tokens: allTokens, tokenClass: 'page', reconstructInteractions: null, runType: 'scheduled',
                deadline: invocationDeadline - PAGE_FETCH_RESERVE_MS,
              })
              await savePlatformState('facebook', 'complete', null)
            } catch (e) {
              if (e instanceof MetaSyncDeadlineError) {
                throw new RetryableIncompleteError(e.message)
              }
              if (e instanceof RetryableIncompleteError && item.attempts < 3) throw e
              warnings.push(redact(`Facebook account facts error: ${String(e)}`, allTokens))
              itemStatus = 'failed'
              itemError = 'Normalized Facebook account facts failed. Post content was preserved, but reporting truth is incomplete.'
              await savePlatformState('facebook', 'failed', null)
            }
          }
        }
        if (instagramState === 'facts_pending' && instagramAccountId) {
          const igToken = facebookPageId ? (pageTokenMap.get(facebookPageId) ?? accessToken) : accessToken
          try {
            assertWorkBudget(invocationDeadline, 'Instagram account facts')
            await syncAccountFacts(sb, {
              clientId: item.client_id, assetId: asset?.id ?? null, connectionId: connections[0].id,
              platform: 'instagram', objectId: instagramAccountId, token: igToken,
              baseUrl, apiVersion: graphVersion, periodMonth: item.month, periodStart, periodEnd,
              tokens: allTokens, tokenClass: facebookPageId && pageTokenMap.get(facebookPageId) ? 'page' : 'user',
              reconstructInteractions: null, runType: 'scheduled',
              deadline: invocationDeadline - PAGE_FETCH_RESERVE_MS,
            })
            await savePlatformState('instagram', 'complete', null)
          } catch (e) {
            if (e instanceof MetaSyncDeadlineError) {
              throw new RetryableIncompleteError(e.message)
            }
            if (e instanceof RetryableIncompleteError && item.attempts < 3) throw e
            warnings.push(redact(`Instagram account facts error: ${String(e)}`, allTokens))
            itemStatus = 'failed'
            itemError = 'Normalized Instagram account facts failed. Post content was preserved, but reporting truth is incomplete.'
            await savePlatformState('instagram', 'failed', null)
          }
        }

        if (!TERMINAL_META_STATES.has(facebookState) || !TERMINAL_META_STATES.has(instagramState)) {
          throw new RetryableIncompleteError('Meta platform stages are incomplete and will resume from their saved checkpoints.')
        }
        if (facebookState === 'failed' || instagramState === 'failed') {
          itemStatus = 'failed'
          itemError ??= 'One or more Meta platform stages failed. Completed platform data was preserved.'
        }

        if (postsSynced === 0 && warnings.length > 0) {
          itemStatus = 'failed'
          if (!itemError) itemError = warnings.join('; ')
        } else if (postsSynced === 0 && warnings.length === 0 && !facebookPageId && !instagramAccountId) {
          itemStatus = 'skipped'
          warnings.push('No Facebook Page or Instagram account linked.')
        }

        try {
          const { error: runError } = await sb.from('meta_sync_runs').insert({
            client_id: item.client_id,
            connection_id: connections[0].id,
            sync_type: 'previous_completed_month',
            period_start: periodStart,
            period_end: periodEnd,
            status: itemStatus === 'failed' ? 'failed' : itemStatus === 'skipped' ? 'failed' : 'success',
            summary: { postsSynced, warnings, reportsCreated, reportsReused, providerPaging, worker: META_CONNECTOR_VERSION },
            started_at: now,
            finished_at: now,
          })
          if (runError) {
            warnings.push(`Sync run audit log failed: ${runError.message}`)
          }
        } catch (e) {
          warnings.push(redact(`Sync run audit log failed: ${String(e)}`, [accessToken, ...pageTokenMap.values()]))
        }

      } catch (e) {
        const message = redact(String(e), [accessToken, ...pageTokenMap.values()])
        if (e instanceof RetryableIncompleteError && item.attempts < 3) {
          itemStatus = 'queued'
          itemError = message
          budgetDeferred = true
        } else {
          itemStatus = 'failed'
          itemError = e instanceof RetryableIncompleteError
            ? `${message} Incomplete pagination exhausted 3 bounded attempts.`
            : message
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: itemStatus,
        posts_synced: postsSynced,
        reports_created: reportsCreated,
        reports_reused: reportsReused,
        finished_at: itemStatus === 'queued' ? null : new Date().toISOString(),
      }
      if (itemStatus === 'queued') updatePayload.started_at = null
      if (warnings.length > 0) updatePayload.warnings = warnings
      if (itemError) updatePayload.error = String(itemError).slice(0, 1000)
      await sb.from('meta_sync_batch_items').update(updatePayload).eq('id', item.id)
      settledIds.add(item.id)
      // Heartbeat after every item too, so a long batch never looks abandoned
      // to the reaper while it is genuinely progressing.
      await touchBatch(sb, item.batch_id)

      // Keep the parent batch counters live after EVERY item so the UI never
      // shows a stale 0/N while this worker is mid-chunk. Safe while items
      // remain queued/running — the RPC only completes the batch when nothing
      // is left. The final per-batch recalc below stays as a safety net.
      try {
        await sb.rpc('recalculate_batch_status', { p_batch_id: item.batch_id })
      } catch {
        // RPC may not exist yet — final recalculation below still runs.
      }

      processed.push({
        itemId: item.id,
        clientName: item.client_name,
        month: item.month,
        status: itemStatus,
        postsSynced,
        error: itemError ?? undefined,
      })
    }
    if (budgetDeferred) break
  }

  // ── Return anything claimed but never reached ───────────────
  // Running out of invocation budget is not an attempt. Releasing these at
  // their original attempt count is what stops untouched clients being
  // force-failed by the stale-lease sweep, and it makes the work immediately
  // visible as 'queued' to the reaper instead of waiting out a 5-minute lease.
  // ── Back off when Meta throttles us ─────────────────────────
  // A rate limit is a wait, not a failure. Without this the reaper retries
  // every minute, no item can settle, and the bounded no-progress budget would
  // eventually force-fail every remaining client for a temporary throttle.
  const rateLimited = processed.some(p => /rate.?limit/i.test(p.error ?? ''))
  if (rateLimited) {
    // A client that only failed because Meta throttled us has not really
    // failed. Put it back on the queue at its original attempt count so a
    // throttle can never burn through the retry budget and permanently mark a
    // client failed for something that had nothing to do with its data.
    const throttled = processed
      .filter(p => p.status === 'failed' && /rate.?limit/i.test(p.error ?? ''))
      .map(p => p.itemId)
    if (throttled.length > 0) {
      try {
        await sb.from('meta_sync_batch_items')
          .update({ status: 'queued', started_at: null, finished_at: null, error: null })
          .in('id', throttled)
        await sb.rpc('meta_sync_release_items', { p_item_ids: throttled })
      } catch {
        // Left failed; the operator can retry the client explicitly.
      }
      for (const entry of processed) {
        if (throttled.includes(entry.itemId)) entry.status = 'queued'
      }
    }

    for (const batchId of batchIds) {
      try {
        await sb.rpc('meta_sync_begin_cooldown', {
          p_batch_id: batchId,
          p_seconds: 900,
          p_reason: 'Meta rate-limited the sync. Waiting before retrying - no work has been lost.',
        })
      } catch {
        // Best effort; the reaper simply retries sooner.
      }
    }
  }

  const abandoned = [...claimedIds].filter(id => !settledIds.has(id))
  if (abandoned.length > 0) {
    // supabase-js query builders are thenable but expose no .catch(), so this
    // must be a real try/catch — a rejection here would kill the invocation and
    // strand the very items it is trying to hand back.
    try {
      await sb.rpc('meta_sync_release_items', { p_item_ids: abandoned })
    } catch {
      // Left 'running'; the stale-lease sweep reclaims them.
    }
  }

  // ── Recalculate parent batch statuses ──────────────────────
  for (const batchId of batchIds) {
    try {
      await sb.rpc('recalculate_batch_status', { p_batch_id: batchId })
    } catch {
      // RPC may not exist yet — batch stays in current state
    }
  }

  // ── Trigger next worker if items remain ─────────────────────
  // Counts BOTH still-queued items and stale running leases: the claim RPC
  // requeues expired leases on the next invocation, so a stalled batch must
  // keep self-triggering until every item is drained.
  let selfTriggered = false
  let workRemaining = false
  if (body.batchId) {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count: remaining } = await sb
      .from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', body.batchId)
      .eq('status', 'queued')

    const { count: staleRunning } = await sb
      .from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', body.batchId)
      .eq('status', 'running')
      .lt('started_at', staleBefore)

    workRemaining = (remaining ?? 0) > 0 || (staleRunning ?? 0) > 0
    // Never self-amplify when the claim RPC is missing/failing (avoids an
    // infinite trigger loop against a broken deployment).
    if (!claimFailed && workRemaining) {
      const workerUrl = Deno.env.get('META_SYNC_WORKER_URL') ?? `${supabaseUrl}/functions/v1/meta-sync-worker`
      const workerSecret = Deno.env.get('META_SYNC_WORKER_SECRET') ?? ''
      // Hand off WITHOUT waiting for the next generation to finish.
      //
      // This used to keep the outbound promise alive with EdgeRuntime.waitUntil
      // and race it for 5s. Because the callee only responds after its own
      // ~35s of work, every generation stayed alive holding all of its
      // ancestors open. The nesting hit the platform's resource ceiling after
      // two or three hops and the whole chain died mid-flight, stranding the
      // rest of the queue with no worker — the production stall in #161.
      //
      // Now the request is aborted as soon as the next worker has certainly
      // picked up the job (it claims and heartbeats within the first second),
      // so this invocation can return immediately. Correctness no longer
      // depends on the chain surviving at all: the per-minute cron reaper in
      // background-worker revives any batch whose heartbeat goes stale.
      selfTriggered = true
      try {
        await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': workerSecret,
          },
          body: JSON.stringify({ batchId: body.batchId }),
          signal: AbortSignal.timeout(2_000),
        })
      } catch (error) {
        // An abort here is the expected, healthy path — the next worker is
        // already running. Anything else means the hand-off did not land, and
        // the reaper will pick the batch up within a minute.
        if (!(error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))) {
          selfTriggered = false
        }
      }
    }
  }

  return jsonResponse({
    ok: true,
    syncEngineVersion: META_CONNECTOR_VERSION,
    chunksProcessed: claimCount,
    processed: processed.length,
    items: processed,
    // Honest report of what this invocation actually did, so "Restart worker"
    // can say whether a worker really ran instead of silently doing nothing.
    workerRan: claimCount > 0,
    itemsReleased: abandoned.length,
    workRemaining,
    handedOff: selfTriggered,
    claimFailed,
    rateLimited,
  })
})
