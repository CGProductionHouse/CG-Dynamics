import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_GRAPH_VERSION = 'v22.0'
const SYNC_ENGINE_VERSION = 'meta-sync-worker-v1'
const BATCH_SIZE = 5

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

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])
const RETRY_DELAYS = [750, 1500]

async function retryMetaFetch(url: string, timeoutMs = 30_000): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) return res
      if (RETRYABLE_STATUSES.has(res.status)) {
        lastError = new Error(`Meta API HTTP ${res.status} ${res.statusText}`)
      } else {
        return res
      }
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof TypeError || (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError')) {
        lastError = e instanceof Error ? e : new Error(String(e))
      } else {
        throw e
      }
    }
    if (attempt < RETRY_DELAYS.length) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
    }
  }

  const msg = lastError?.name === 'AbortError'
    ? `Meta API request timed out after ${timeoutMs}ms and ${RETRY_DELAYS.length + 1} attempt(s)`
    : `Meta API request failed after retries: ${lastError?.message ?? 'unknown error'}`
  throw new Error(msg)
}

async function parseMetaError(res: Response, context: string): Promise<string> {
  let detail = ''
  try {
    const body = await res.json()
    if (body?.error) {
      const parts: string[] = []
      if (body.error.message) parts.push(body.error.message)
      if (body.error.type) parts.push(`type: ${body.error.type}`)
      if (body.error.code) parts.push(`code: ${body.error.code}`)
      if (body.error.error_subcode) parts.push(`subcode: ${body.error.error_subcode}`)
      if (parts.length > 0) detail = `: ${parts.join(', ')}`
    }
  } catch {
    // Response body not JSON — ignore
  }
  return `${context} failed (HTTP ${res.status})${detail}`
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
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile && ['admin', 'team'].includes(profile.role)) {
        return { ok: true }
      }
    }
  }

  return { ok: false, status: 401, body: { ok: false, error: 'Unauthorized. Provide x-worker-secret header or a valid staff JWT.' } }
}

/* ---------- Main handler ---------- */

Deno.serve(async (req) => {
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

  let body: { batchId?: string; maxItems?: number } = {}
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
  const baseUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}`

  // ── Fetch page token map once per invocation ──────────────
  const pageTokenMap = new Map<string, string>()
  let pageTokenRateLimited = false
  {
    let url: string | null = `${baseUrl}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(accessToken)}`
    let guard = 0
    while (url && guard < 10 && !pageTokenRateLimited) {
      guard++
      const res = await retryMetaFetch(url)
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
  const processed: Array<{ itemId: string; clientName: string; month: string; status: string; postsSynced: number; error?: string }> = []
  const batchIds = new Set<string>()
  let claimCount = 0

  while (claimCount < MAX_CHUNKS) {
    const { data: items, error: claimError } = await sb.rpc('claim_sync_batch_items', {
      p_limit: body.maxItems ?? BATCH_SIZE,
      p_batch_id: body.batchId ?? null,
    })

    if (claimError) {
      // RPC may not exist yet — process what we have so far
      break
    }

    if (!items || !Array.isArray(items) || items.length === 0) break

    claimCount++

    for (const item of items) {
      batchIds.add(item.batch_id)

      // ── Skip current/future months ──
      if (item.month >= currentMonthStr()) {
        await sb.from('meta_sync_batch_items').update({
          status: 'skipped',
          error: 'Month is not yet completed.',
          finished_at: new Date().toISOString(),
        }).eq('id', item.id)
        processed.push({ itemId: item.id, clientName: item.client_name, month: item.month, status: 'skipped', postsSynced: 0 })
        continue
      }

      const { periodStart, periodEnd } = monthBounds(item.month)
      let postsSynced = 0
      let reportsCreated = 0
      let reportsReused = 0
      let warnings: string[] = []
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
          .select('facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, instagram_not_applicable')
          .eq('client_id', item.client_id)
          .eq('is_active', true)
          .limit(1)

        const asset = linkedAssets?.[0]
        const facebookPageId = asset?.facebook_page_id ?? null
        const instagramAccountId = (asset?.instagram_not_applicable === true) ? null : (asset?.instagram_account_id ?? null)

        const now = new Date().toISOString()

      // ── Sync Facebook posts ──
      if (facebookPageId && reportId) {
          if (pageTokenRateLimited) {
            warnings.push('Facebook sync skipped: Meta API rate limit reached (will retry on next sync cycle).')
          } else {
            const pageToken = pageTokenMap.get(facebookPageId)
            if (!pageToken) {
              warnings.push('Facebook page token unavailable for linked page. Relink Meta or verify page access.')
            } else {
              try {
                const params = new URLSearchParams({
                  access_token: pageToken,
                  fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)',
                  since: periodStart,
                  until: `${periodEnd}T23:59:59Z`,
                  limit: '100',
                })
                const res = await retryMetaFetch(`${baseUrl}/${facebookPageId}/posts?${params.toString()}`)
                if (res.ok) {
                  const fbData = await res.json()
                  const rawPosts: Array<Record<string, unknown>> = fbData.data ?? []
                  for (const raw of rawPosts) {
                    const metaPostId = String(raw.id ?? '')
                    if (!metaPostId) continue
                    const { data: existing } = await sb
                      .from('meta_content_mappings')
                      .select('id, post_id')
                      .eq('client_id', item.client_id)
                      .eq('platform', 'facebook')
                      .eq('meta_object_id', metaPostId)
                      .limit(1)

                    const publishTime = raw.created_time ? new Date(raw.created_time as string).toISOString() : null
                    const caption = (raw.message as string | null) ?? null
                    const permalink = (raw.permalink_url as string | null) ?? null
                    const reactions = (raw.reactions as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
                    const comments = (raw.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
                    const shares = (raw.shares as { count?: number })?.count ?? 0
                    const fullPicture = raw.full_picture as string | null ?? null

                    const postPayload: Record<string, unknown> = {
                      report_id: reportId,
                      platform: 'facebook',
                      meta_post_id: metaPostId,
                      publish_time: publishTime,
                      caption,
                      permalink,
                      views: null,
                      reach: null,
                      reactions,
                      comments,
                      shares,
                      raw: {
                        source: 'meta_sync',
                        platform: 'facebook',
                        synced_at: now,
                        views: null,
                        reach: null,
                        engagements: { reactions, comments, shares },
                        metric_availability: {
                          views: false,
                          reach: false,
                          content_interactions: true,
                          source: 'direct_fields',
                        },
                        meta_payload: raw,
                        ...(fullPicture ? { full_picture: fullPicture } : {}),
                      },
                    }

                    if (existing && existing.length > 0) {
                      if (existing[0].post_id) {
                        await sb.from('posts').update(postPayload).eq('id', existing[0].post_id)
                      }
                      await sb.from('meta_content_mappings').update({ last_synced_at: now, report_id: reportId }).eq('id', existing[0].id)
                    } else {
                      const { data: newPost } = await sb.from('posts').insert(postPayload).select('id').single()
                      if (newPost) {
                        await sb.from('meta_content_mappings').insert({
                          client_id: item.client_id, report_id: reportId, post_id: newPost.id,
                          platform: 'facebook', meta_object_id: metaPostId, last_synced_at: now,
                        })
                      }
                    }
                    postsSynced++
                  }
                } else {
                  warnings.push(await parseMetaError(res, 'Facebook posts fetch'))
                }
              } catch (e) {
                warnings.push(`Facebook sync error: ${String(e)}`)
              }
            }
          }
        }

      // ── Sync Instagram media ──
      if (instagramAccountId && reportId) {
          const pageToken = facebookPageId ? (pageTokenMap.get(facebookPageId) ?? accessToken) : accessToken
          try {
            const params = new URLSearchParams({
              access_token: pageToken,
              fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
              limit: '100',
            })
            const res = await retryMetaFetch(`${baseUrl}/${instagramAccountId}/media?${params.toString()}`)
            if (res.ok) {
              const igData = await res.json()
              const rawMedia: Array<Record<string, unknown>> = igData.data ?? []
              for (const raw of rawMedia) {
                const metaPostId = String(raw.id ?? '')
                if (!metaPostId) continue
                const timestamp = raw.timestamp ? new Date(raw.timestamp as string).toISOString() : null
                if (!timestamp) continue
                const ts = new Date(timestamp)
                const pStart = new Date(periodStart + 'T00:00:00Z')
                const pEnd = new Date(periodEnd + 'T23:59:59Z')
                if (ts < pStart || ts > pEnd) continue

                const { data: existing } = await sb
                  .from('meta_content_mappings')
                  .select('id, post_id')
                  .eq('client_id', item.client_id)
                  .eq('platform', 'instagram')
                  .eq('meta_object_id', metaPostId)
                  .limit(1)

                const likes = (raw.like_count as number) ?? 0
                const igComments = (raw.comments_count as number) ?? 0
                const mediaType = (raw.media_type as string) ?? ''
                const mediaProductType = raw.media_product_type as string | undefined
                let postType = mediaType
                if (mediaProductType === 'REELS') postType = 'Reel'
                else if (mediaType === 'CAROUSEL_ALBUM') postType = 'Carousel'
                else if (mediaType === 'VIDEO') postType = 'Video'
                else if (mediaType === 'IMAGE') postType = 'Photo'

                const postPayload: Record<string, unknown> = {
                  report_id: reportId,
                  platform: 'instagram',
                  meta_post_id: metaPostId,
                  publish_time: timestamp,
                  caption: (raw.caption as string | null) ?? null,
                  permalink: (raw.permalink as string | null) ?? null,
                  views: null,
                  reach: null,
                  reactions: likes,
                  comments: igComments,
                  shares: 0,
                  raw: {
                    source: 'meta_sync',
                    platform: 'instagram',
                    synced_at: now,
                    content_type: postType,
                    views: null,
                    reach: null,
                    engagements: { likes: likes, comments: igComments },
                    metric_availability: {
                      views: false,
                      reach: false,
                      content_interactions: true,
                      source: 'media_fields',
                    },
                    meta_payload: raw,
                    ...(raw.thumbnail_url ? { thumbnail_url: raw.thumbnail_url as string } : {}),
                    ...(raw.media_url ? { media_url: raw.media_url as string } : {}),
                  },
                }

                if (existing && existing.length > 0) {
                  if (existing[0].post_id) {
                    await sb.from('posts').update(postPayload).eq('id', existing[0].post_id)
                  }
                  await sb.from('meta_content_mappings').update({ last_synced_at: now, report_id: reportId }).eq('id', existing[0].id)
                } else {
                  const { data: newPost } = await sb.from('posts').insert(postPayload).select('id').single()
                  if (newPost) {
                    await sb.from('meta_content_mappings').insert({
                      client_id: item.client_id, report_id: reportId, post_id: newPost.id,
                      platform: 'instagram', meta_object_id: metaPostId, last_synced_at: now,
                    })
                  }
                }
                postsSynced++
              }
            } else {
              warnings.push(await parseMetaError(res, 'Instagram media fetch'))
            }
          } catch (e) {
            warnings.push(`Instagram sync error: ${String(e)}`)
          }
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
            summary: { postsSynced, warnings, reportsCreated, reportsReused, worker: SYNC_ENGINE_VERSION },
            started_at: now,
            finished_at: now,
          })
          if (runError) {
            warnings.push(`Sync run audit log failed: ${runError.message}`)
          }
        } catch (e) {
          warnings.push(`Sync run audit log failed: ${String(e)}`)
        }

      } catch (e) {
        itemStatus = 'failed'
        itemError = String(e)
      }

      const updatePayload: Record<string, unknown> = {
        status: itemStatus,
        posts_synced: postsSynced,
        reports_created: reportsCreated,
        reports_reused: reportsReused,
        finished_at: new Date().toISOString(),
      }
      if (warnings.length > 0) updatePayload.warnings = warnings
      if (itemError) updatePayload.error = String(itemError).slice(0, 1000)
      await sb.from('meta_sync_batch_items').update(updatePayload).eq('id', item.id)

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
  if (body.batchId && processed.length > 0) {
    const { count: remaining } = await sb
      .from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', body.batchId)
      .eq('status', 'queued')

    if (remaining && remaining > 0) {
      const workerUrl = Deno.env.get('META_SYNC_WORKER_URL') ?? `${supabaseUrl}/functions/v1/meta-sync-worker`
      const workerSecret = Deno.env.get('META_SYNC_WORKER_SECRET') ?? ''
      const triggerPromise = fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': workerSecret,
        },
        body: JSON.stringify({ batchId: body.batchId }),
      })
      // Keep runtime alive until the trigger completes
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        EdgeRuntime.waitUntil(triggerPromise)
      }
      try {
        await Promise.race([triggerPromise, new Promise(resolve => setTimeout(resolve, 5_000))])
      } catch {
        // Trigger failed — batch stays running, next poll / retry will continue
      }
    }
  }

  return jsonResponse({
    ok: true,
    syncEngineVersion: SYNC_ENGINE_VERSION,
    chunksProcessed: claimCount,
    processed: processed.length,
    items: processed,
  })
})
