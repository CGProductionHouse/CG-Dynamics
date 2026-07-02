import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_GRAPH_VERSION = 'v22.0'
const SYNC_ENGINE_VERSION = 'meta-sync-worker-v1'
const BATCH_SIZE = 5
const INSIGHT_TIMEOUT_MS = 70_000

function describeDbError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return 'unknown database error'
  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.code) parts.push(`code ${err.code}`)
  return parts.length > 0 ? parts.join(' — ') : 'unknown database error'
}

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

async function metaFetch(url: string, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

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

  let body: { batchId?: string; maxItems?: number } = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  // Get Meta access token
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

  // Pick queued items
  let itemsQuery = sb
    .from('meta_sync_batch_items')
    .select('id, batch_id, client_id, client_name, month')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(body.maxItems ?? BATCH_SIZE)

  if (body.batchId) {
    itemsQuery = itemsQuery.eq('batch_id', body.batchId)
  }

  const { data: items, error: itemsError } = await itemsQuery

  if (itemsError) {
    return jsonResponse({ ok: false, error: 'Could not read queue items.' }, 500)
  }

  if (!items || items.length === 0) {
    return jsonResponse({ ok: true, processed: 0, message: 'No queued items to process.' })
  }

  const processed: Array<{ itemId: string; clientName: string; month: string; status: string; postsSynced: number; error?: string }> = []
  const batchIds = new Set(items.map(i => i.batch_id))

  for (const item of items) {
    // Mark running
    const now = new Date().toISOString()
    const { data: currentItem } = await sb.from('meta_sync_batch_items').select('attempts').eq('id', item.id).single()
    const currentAttempts = (currentItem?.attempts ?? 0)
    await sb.from('meta_sync_batch_items').update({
      status: 'running',
      attempts: currentAttempts + 1,
      started_at: now,
    }).eq('id', item.id)

    // Skip current/future months
    if (item.month >= currentMonthStr()) {
      await sb.from('meta_sync_batch_items').update({
        status: 'skipped',
        error: 'Month is not yet completed.',
        finished_at: new Date().toISOString(),
      }).eq('id', item.id)
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
        continue
      }

      // ── Get page tokens ──
      const pageTokenMap = new Map<string, string>()
      {
        let url: string | null = `${baseUrl}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(accessToken)}`
        let guard = 0
        while (url && guard < 10) {
          guard++
          const res = await metaFetch(url)
          if (!res.ok) break
          const data = await res.json()
          for (const p of (data.data as Array<{ id?: string; access_token?: string }> ?? [])) {
            if (p.id && p.access_token) pageTokenMap.set(p.id, p.access_token)
          }
          url = (data.paging?.next as string | undefined) ?? null
        }
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

      // ── Sync Facebook posts ──
      if (facebookPageId) {
        const pageToken = pageTokenMap.get(facebookPageId) ?? accessToken
        try {
          const params = new URLSearchParams({
            access_token: pageToken,
            fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true),attachments',
            since: periodStart,
            until: `${periodEnd}T23:59:59Z`,
            limit: '100',
          })
          const res = await metaFetch(`${baseUrl}/${facebookPageId}/posts?${params.toString()}`)
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

              const postPayload = {
                report_id: reportId,
                platform: 'facebook',
                meta_post_id: metaPostId,
                publish_time: publishTime,
                caption,
                permalink,
                views: 0,
                reach: 0,
                reactions,
                comments,
                shares,
                raw: { source: 'meta_sync', platform: 'facebook', meta_payload: raw, ...(fullPicture ? { full_picture: fullPicture } : {}) },
              }

              if (existing && existing.length > 0) {
                if (existing[0].post_id) {
                  await sb.from('posts').update(postPayload).eq('id', existing[0].post_id)
                }
                await sb.from('meta_content_mappings').update({ last_synced_at: new Date().toISOString(), report_id: reportId }).eq('id', existing[0].id)
              } else {
                const { data: newPost } = await sb.from('posts').insert(postPayload).select('id').single()
                if (newPost) {
                  await sb.from('meta_content_mappings').insert({
                    client_id: item.client_id, report_id: reportId, post_id: newPost.id,
                    platform: 'facebook', meta_object_id: metaPostId, last_synced_at: new Date().toISOString(),
                  })
                }
              }
              postsSynced++
            }
          } else {
            warnings.push(`Facebook posts fetch failed (HTTP ${res.status})`)
          }
        } catch (e) {
          warnings.push(`Facebook sync error: ${String(e)}`)
        }
      }

      // ── Sync Instagram media ──
      if (instagramAccountId) {
        const pageToken = facebookPageId ? (pageTokenMap.get(facebookPageId) ?? accessToken) : accessToken
        try {
          const params = new URLSearchParams({
            access_token: pageToken,
            fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
            limit: '100',
          })
          const res = await metaFetch(`${baseUrl}/${instagramAccountId}/media?${params.toString()}`)
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

              const postPayload = {
                report_id: reportId,
                platform: 'instagram',
                meta_post_id: metaPostId,
                publish_time: timestamp,
                caption: (raw.caption as string | null) ?? null,
                permalink: (raw.permalink as string | null) ?? null,
                views: 0,
                reach: 0,
                reactions: likes,
                comments: igComments,
                shares: 0,
                raw: { source: 'meta_sync', platform: 'instagram', meta_payload: raw, ...(raw.thumbnail_url ? { thumbnail_url: raw.thumbnail_url as string } : {}), ...(raw.media_url ? { media_url: raw.media_url as string } : {}) },
              }

              if (existing && existing.length > 0) {
                if (existing[0].post_id) {
                  await sb.from('posts').update(postPayload).eq('id', existing[0].post_id)
                }
                await sb.from('meta_content_mappings').update({ last_synced_at: new Date().toISOString(), report_id: reportId }).eq('id', existing[0].id)
              } else {
                const { data: newPost } = await sb.from('posts').insert(postPayload).select('id').single()
                if (newPost) {
                  await sb.from('meta_content_mappings').insert({
                    client_id: item.client_id, report_id: reportId, post_id: newPost.id,
                    platform: 'instagram', meta_object_id: metaPostId, last_synced_at: new Date().toISOString(),
                  })
                }
              }
              postsSynced++
            }
          } else {
            warnings.push(`Instagram media fetch failed (HTTP ${res.status})`)
          }
        } catch (e) {
          warnings.push(`Instagram sync error: ${String(e)}`)
        }
      }

      if (postsSynced === 0 && warnings.length === 0 && !facebookPageId && !instagramAccountId) {
        itemStatus = 'skipped'
        warnings.push('No Facebook Page or Instagram account linked.')
      }

      // Record per-client run in existing meta_sync_runs table
      await sb.from('meta_sync_runs').insert({
        client_id: item.client_id,
        connection_id: connections[0].id,
        sync_type: 'previous_completed_month',
        period_start: periodStart,
        period_end: periodEnd,
        status: itemStatus === 'failed' ? 'failed' : itemStatus === 'skipped' ? 'failed' : 'success',
        summary: { postsSynced, warnings, reportsCreated, reportsReused },
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }).catch(() => {})

    } catch (e) {
      itemStatus = 'failed'
      itemError = String(e)
    }

    // Update item status
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

    processed.push({
      itemId: item.id,
      clientName: item.client_name,
      month: item.month,
      status: itemStatus,
      postsSynced,
      error: itemError ?? undefined,
    })
  }

  // Update batch progress for all affected batches
  for (const batchId of batchIds) {
    const { count: total } = await sb.from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
    const { count: completed } = await sb.from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .in('status', ['completed', 'warning', 'skipped'])
    const { count: failed } = await sb.from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'failed')

    const newStatus = completed === total
      ? (failed > 0 ? 'completed' : 'completed')
      : 'running'

    await sb.from('meta_sync_batches').update({
      status: newStatus,
      completed_items: completed ?? 0,
      failed_items: failed ?? 0,
      started_at: new Date().toISOString(),
      finished_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', batchId)
  }

  return jsonResponse({
    ok: true,
    syncEngineVersion: SYNC_ENGINE_VERSION,
    processed: processed.length,
    items: processed,
  })
})
