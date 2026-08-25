import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  META_CONNECTOR_VERSION,
  MetaFactRetryableError,
  MetaSyncDeadlineError,
  metaPostBounds,
  metaFetch,
  readMetaError,
  redact,
  resolveMetaGraphConfig,
  syncAccountFacts,
} from '../_shared/meta.ts'
import { upsertMetaReportPost } from '../_shared/metaPostMerge.ts'
import { classifyInstagramMediaPage } from '../_shared/metaInstagramPaging.ts'
import { normalizeMetaWorkerLanes } from '../_shared/metaWorkerLanes.ts'
import { dispatchMetaWorker } from '../_shared/metaWorkerDispatch.ts'
import { metaRateLimitScope } from '../_shared/metaRateLimit.ts'

// Scheduled/background syncing shares the SAME truth contract as manual syncing:
// configurable Graph version, shared connector engine (syncAccountFacts) writing
// normalized facts + provenance, shared retry/backoff and token handling.
const BATCH_SIZE = 1
const META_COLLECTION_PAGE_CAP = 25
const MAX_WORK_MS = 40_000
const PAGE_FETCH_RESERVE_MS = 8_000
const MIN_PAGE_REQUEST_BUDGET_MS = 4_000

class RetryableIncompleteError extends Error {
  constructor(message: string, readonly refundAttempt = false) {
    super(message)
  }
}

function isMetaRateLimitError(message: string): boolean {
  return metaRateLimitScope(message) !== null
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

interface MetaProcessedPage {
  postsSynced: number
  stopAfterPage?: boolean
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
  processPage: (items: Array<Record<string, unknown>>) => Promise<number | MetaProcessedPage>,
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
      const error = await parseMetaError(res, `${context} page ${pagesFetched}`, tokens)
      return { pagesFetched, complete: false, error, retryable: isMetaRateLimitError(error) }
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
    const processedPage = await processPage((page.data as Array<Record<string, unknown>> | undefined) ?? [])
    const pagePostsSynced = typeof processedPage === 'number' ? processedPage : processedPage.postsSynced
    const stopAfterPage = typeof processedPage === 'number' ? false : processedPage.stopAfterPage === true
    await checkpoint(stopAfterPage ? null : candidateCursor, !nextUrl || stopAfterPage, pagePostsSynced)
    if (!nextUrl || stopAfterPage) return { pagesFetched, complete: true, error: null, retryable: false }
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
async function touchItemLease(
  sb: ReturnType<typeof createClient>,
  itemId: string,
  leaseGeneration: number,
): Promise<void> {
  const { error } = await sb.rpc('meta_sync_touch_item_lease', {
    p_item_id: itemId,
    p_lease_generation: leaseGeneration,
  })
  if (error) throw new Error(`Meta sync lease lost while heartbeating: ${error.message}`)
}

async function batchIsCoolingDown(
  sb: ReturnType<typeof createClient>,
  batchId: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from('meta_sync_batches')
    .select('cooldown_until')
    .eq('id', batchId)
    .maybeSingle()
  if (error || !data?.cooldown_until) return false
  return new Date(data.cooldown_until).getTime() > Date.now()
}

async function batchLaneSetAlreadyStarted(
  sb: ReturnType<typeof createClient>,
  batchId: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from('meta_sync_batches')
    .select('summary')
    .eq('id', batchId)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.summary?.parallel_lanes_started_at)
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

  // Declared outside the guarded body below so that if anything throws we can
  // still hand back whatever this invocation had claimed.
  const claimedLeases = new Map<string, number>()
  const settledIds = new Set<string>()
  let crashClient: ReturnType<typeof createClient> | null = null
  let activeLane: { batchId: string; laneId: number; generation: number } | null = null

  try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  crashClient = sb

  const auth = await authorizeWorker(req, sb)
  if (!auth.ok) return jsonResponse(auth.body, auth.status)

  let graphConfig: ReturnType<typeof resolveMetaGraphConfig>
  try {
    graphConfig = resolveMetaGraphConfig()
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Internal Meta configuration error.' }, 500)
  }

  let body: { batchId?: string; maxItems?: number; workerLane?: number; workerLanes?: number; startLanes?: boolean; laneLeaseGeneration?: number }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  let workerLane: number
  let workerLanes: number
  let startsLaneSet: boolean
  try {
    ({ workerLane, workerLanes, startsLaneSet } = normalizeMetaWorkerLanes(body))
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Invalid worker lane input.' }, 400)
  }
  let lanesStarted = 1
  let waitingForRateLimit = body.batchId ? await batchIsCoolingDown(sb, body.batchId) : false
  if (waitingForRateLimit) {
    return jsonResponse({
      ok: true,
      syncEngineVersion: META_CONNECTOR_VERSION,
      chunksProcessed: 0,
      processed: 0,
      items: [],
      workerRan: false,
      itemsReleased: 0,
      workRemaining: true,
      handedOff: false,
      claimFailed: false,
      rateLimited: true,
      waitingForRateLimit,
      workerLane,
      workerLanes,
      lanesStarted: 0,
    })
  }
  if (body.batchId && startsLaneSet
      && await batchLaneSetAlreadyStarted(sb, body.batchId)) {
    return jsonResponse({
      ok: true,
      syncEngineVersion: META_CONNECTOR_VERSION,
      chunksProcessed: 0,
      processed: 0,
      items: [],
      workerRan: false,
      itemsReleased: 0,
      workRemaining: true,
      handedOff: false,
      claimFailed: false,
      rateLimited: false,
      waitingForRateLimit: false,
      laneSetAlreadyStarted: true,
      workerLane,
      workerLanes,
      lanesStarted: 0,
    })
  }
  if (body.batchId) {
    const previousGeneration = Number.isSafeInteger(body.laneLeaseGeneration)
      ? Number(body.laneLeaseGeneration)
      : null
    const { data, error } = await sb.rpc('meta_sync_acquire_lane', {
      p_batch_id: body.batchId,
      p_lane_id: workerLane,
      p_lane_count: workerLanes,
      p_previous_generation: previousGeneration,
    })
    if (error) return jsonResponse({ ok: false, error: `Could not acquire Meta lane: ${error.message}` }, 500)
    const generation = Number(Array.isArray(data) ? data[0] : data)
    if (!Number.isSafeInteger(generation) || generation < 1) {
      return jsonResponse({
        ok: true, workerRan: false, workRemaining: true, handedOff: false,
        laneAlreadyActive: true, workerLane, workerLanes, lanesStarted: 0,
      })
    }
    activeLane = { batchId: body.batchId, laneId: workerLane, generation }
  }
  const releaseActiveLane = async (): Promise<void> => {
    if (!activeLane) return
    await sb.rpc('meta_sync_release_lane', {
      p_batch_id: activeLane.batchId,
      p_lane_id: activeLane.laneId,
      p_lease_generation: activeLane.generation,
    })
  }

  // ── Get Meta access token ──────────────────────────────────
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id')
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    await releaseActiveLane()
    return jsonResponse({ ok: false, error: 'Meta is not connected.' }, 400)
  }

  const { data: tokenRows } = await sb
    .from('meta_connection_tokens')
    .select('encrypted_access_token')
    .eq('connection_id', connections[0].id)
    .limit(1)

  if (!tokenRows || tokenRows.length === 0 || !tokenRows[0].encrypted_access_token) {
    await releaseActiveLane()
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
      // THE ORIGINAL TRIGGER OF INCIDENT #161.
      //
      // metaFetch aborts on its own timeout, and an abort throws. Nothing here
      // caught it, so when Meta was slow (which is exactly what it is while
      // throttling us) the whole invocation died as a bare platform 500 with no
      // diagnostics. Three of those exhausted the driver job's attempts, it went
      // terminally 'failed', and 70 items were left queued with nothing able to
      // start a worker.
      //
      // A timeout fetching page tokens is a transient upstream condition, not a
      // reason to lose the batch: treat it exactly like a rate limit so the
      // invocation returns cleanly, the batch cools down, and the reaper retries.
      let res: Response
      try {
        res = await metaFetch(url, requestTimeoutMs)
      } catch (error) {
        const aborted = error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name)
        if (!aborted && !/signal .*abort|abort/i.test(String(error))) throw error
        pageTokenRateLimited = true
        break
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        if (errBody?.error && ([4, 17, 32, 341, 613].includes(errBody.error.code) || errBody.error.error_subcode === 2069032)) {
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

  // ── Do not process anything without page tokens ─────────────
  // If the page-token request was throttled the map is EMPTY, so every client's
  // Facebook stage would fail for want of a token and be marked failed — 25
  // clients were wrongly failed this way before this guard existed. A throttle
  // must cost us nothing: cool the batch down, leave every item queued, and let
  // the reaper retry once Meta lets us back in.
  if (pageTokenRateLimited) {
    if (body.batchId) {
      try {
        await sb.rpc('meta_sync_begin_cooldown', {
          p_batch_id: body.batchId,
          p_seconds: 900,
          p_reason: 'Meta rate-limited the page-token request. Waiting before retrying - no work has been lost.',
        })
      } catch {
        // Best effort; the reaper simply retries sooner.
      }
    }
    await releaseActiveLane()
    return jsonResponse({
      ok: true,
      syncEngineVersion: META_CONNECTOR_VERSION,
      chunksProcessed: 0,
      processed: 0,
      items: [],
      workerRan: false,
      itemsReleased: 0,
      workRemaining: true,
      handedOff: false,
      claimFailed: false,
      rateLimited: true,
      waitingForRateLimit: true,
    })
  }

  // A root invocation starts a small, bounded set of independent lanes. Each
  // lane then hands off only to its own successor, so concurrency stays flat
  // instead of growing recursively. The claim RPC uses SKIP LOCKED, making
  // client-month work exclusive across lanes while unrelated clients progress
  // in parallel. Recovery starts only one replacement lane so two overlapping
  // recovery requests cannot each reconstruct a complete lane set.
  // Only the initial durable driver may create the lane set. Reapers, manual
  // restarts, and child continuations start one replacement lane, preventing
  // overlapping roots from multiplying the batch-wide concurrency cap.
  let mayStartLaneSet = false
  if (body.batchId && startsLaneSet) {
    const { data, error } = await sb.rpc('meta_sync_begin_lane_set', {
      p_batch_id: body.batchId,
      p_lane_count: workerLanes,
    })
    mayStartLaneSet = !error && data === true
    if (!mayStartLaneSet) {
      await releaseActiveLane()
      return jsonResponse({
        ok: true,
        syncEngineVersion: META_CONNECTOR_VERSION,
        chunksProcessed: 0,
        processed: 0,
        items: [],
        workerRan: false,
        itemsReleased: 0,
        workRemaining: true,
        handedOff: false,
        claimFailed: false,
        rateLimited: false,
        waitingForRateLimit: false,
        laneSetAlreadyStarted: true,
        workerLane,
        workerLanes,
        lanesStarted: 0,
      })
    }
  }
  if (body.batchId && mayStartLaneSet) {
    const workerUrl = Deno.env.get('META_SYNC_WORKER_URL') ?? `${supabaseUrl}/functions/v1/meta-sync-worker`
    const workerSecret = Deno.env.get('META_SYNC_WORKER_SECRET') ?? ''
    const starts = Array.from({ length: workerLanes - 1 }, (_, offset) => offset + 1)
      .map(lane => dispatchMetaWorker(workerUrl, workerSecret, {
        batchId: body.batchId, workerLane: lane, workerLanes,
      }))
    const started = await Promise.all(starts)
    lanesStarted += started.filter(Boolean).length
  }

  // ── Process items in chunks (continuation loop) ─────────────
  const MAX_CHUNKS = 5
  // Stay well under the platform function timeout so a slow Meta API call can
  // never kill the invocation mid-chunk and strand claimed items as "running".
  // If we run out of budget we stop claiming and let the self-trigger below
  // pick up the next chunk (leases make this safe under concurrency).
  const processed: Array<{ itemId: string; clientName: string; month: string; status: string; postsSynced: number; error?: string }> = []
  let claimCount = 0
  let claimFailed = false
  let budgetDeferred = false
  // claimedLeases / settledIds are declared at the top of the handler: their
  // difference is released on the way out — including on a crash — so an
  // abandoned claim never burns a retry attempt.

  while (claimCount < MAX_CHUNKS) {
    if (Date.now() >= invocationDeadline - PAGE_FETCH_RESERVE_MS || pageTokenBudgetExhausted) break
    if (body.batchId && await batchIsCoolingDown(sb, body.batchId)) {
      waitingForRateLimit = true
      break
    }
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
      const leaseGeneration = Number(item.lease_generation)
      if (!Number.isSafeInteger(leaseGeneration) || leaseGeneration < 1) {
        throw new Error('Claim RPC returned an invalid Meta sync lease generation.')
      }
      claimedLeases.set(item.id, leaseGeneration)
      // Durable proof that a worker is alive and holding this batch. The cron
      // reaper reads this to tell a working batch from an abandoned one.
      await touchItemLease(sb, item.id, leaseGeneration)
      if (activeLane) {
        const { error } = await sb.rpc('meta_sync_touch_lane', {
          p_batch_id: activeLane.batchId,
          p_lane_id: activeLane.laneId,
          p_lease_generation: activeLane.generation,
        })
        if (error) throw new Error(`Meta lane lease lost: ${error.message}`)
      }

      const settleItem = async (
        status: string,
        reportsCreated: number,
        reportsReused: number,
        warnings: string[],
        error: string | null,
        refundAttempt = false,
        cooldownSeconds: number | null = null,
        cooldownScope: 'item' | 'batch' | null = null,
      ): Promise<void> => {
        const { error: settleError } = await sb.rpc('meta_sync_settle_item', {
          p_item_id: item.id,
          p_lease_generation: leaseGeneration,
          p_status: status,
          p_reports_created: reportsCreated,
          p_reports_reused: reportsReused,
          p_warnings: warnings,
          p_error: error,
          p_refund_attempt: refundAttempt,
          p_cooldown_seconds: cooldownSeconds,
          p_cooldown_scope: cooldownScope,
        })
        if (settleError) throw new Error(`Meta sync lease lost while settling: ${settleError.message}`)
        settledIds.add(item.id)
      }

      // ── Skip current/future months ──
      if (item.month >= currentMonthStr()) {
        await settleItem('skipped', 0, 0, [], 'Month is not yet completed.')
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
      let refundAttempt = false

      try {
        // ── Find or create report ──
        const { data: reportRows, error: reportError } = await sb.rpc('meta_sync_get_or_create_report', {
          p_item_id: item.id,
          p_lease_generation: leaseGeneration,
          p_client_id: null,
          p_month: null,
          p_report_title: `${item.client_name} ${monthLabel(item.month)} Report`,
          p_created_by: null,
        })
        if (reportError) throw new Error(`Could not atomically acquire report: ${reportError.message}`)
        const reportResult = Array.isArray(reportRows) ? reportRows[0] : reportRows
        const reportId = reportResult?.report_id ? String(reportResult.report_id) : null
        if (!reportId) throw new Error('Could not atomically acquire report: missing report id')
        reportsCreated = reportResult.created === true ? 1 : 0
        reportsReused = reportResult.created === true ? 0 : 1

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
        let instagramOldestTimestamp = (item.instagram_oldest_timestamp as string | null | undefined) ?? null
        let instagramOrderingMalformed = item.instagram_ordering_malformed === true
        const instagramBoundaryEnabled = Deno.env.get('META_INSTAGRAM_DESCENDING_ORDER_VERIFIED_VERSION') === graphVersion

        const savePlatformState = async (
          platform: 'facebook' | 'instagram',
          state: MetaSyncState,
          cursor: string | null,
          completedPagePosts = 0,
          instagramOldestTimestamp: string | null = null,
          instagramOrderingMalformed: boolean | null = null,
        ): Promise<void> => {
          const { data, error } = await sb.rpc('meta_sync_checkpoint_item', {
            p_item_id: item.id,
            p_lease_generation: leaseGeneration,
            p_platform: platform,
            p_state: state,
            p_next_cursor: cursor,
            p_completed_page_posts: completedPagePosts,
            p_instagram_oldest_timestamp: instagramOldestTimestamp,
            p_instagram_ordering_malformed: instagramOrderingMalformed,
          })
          if (error) throw new Error(`Could not checkpoint ${platform} sync: ${error.message}`)
          const nextPostsSynced = Number(Array.isArray(data) ? data[0] : data)
          if (!Number.isFinite(nextPostsSynced)) throw new Error(`Could not checkpoint ${platform} sync: invalid post count`)
          postsSynced = nextPostsSynced
          if (platform === 'facebook') {
            facebookState = state
            facebookCursor = cursor
          } else {
            instagramState = state
            instagramCursor = cursor
          }
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
                      lease: { itemId: item.id, generation: leaseGeneration },
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
                if (fbCollection.retryable) throw new RetryableIncompleteError(message, fbCollection.pagesFetched > 0)
                itemStatus = 'failed'
                itemError = message
                await savePlatformState('facebook', 'failed', null)
              }
            } catch (e) {
              const message = redact(`Facebook sync error: ${String(e)}`, [accessToken, ...pageTokenMap.values()])
              if (e instanceof RetryableIncompleteError && (item.attempts < 3 || isMetaRateLimitError(message))) throw e
              if (isMetaRateLimitError(message)) throw new RetryableIncompleteError(message)
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
                const pageResult = classifyInstagramMediaPage(
                  rawMedia,
                  new Date(Number(postBounds.since) * 1000).toISOString(),
                  new Date(Number(postBounds.until) * 1000).toISOString(),
                  instagramOldestTimestamp,
                  instagramBoundaryEnabled,
                  instagramOrderingMalformed,
                )
                instagramOldestTimestamp = pageResult.oldestTimestamp
                if (!instagramOrderingMalformed && pageResult.orderingMalformed) {
                  warnings.push('Instagram media ordering was not descending; exhaustive pagination was required.')
                }
                instagramOrderingMalformed = pageResult.orderingMalformed
                let pagePostsSynced = 0
                for (const raw of pageResult.windowItems) {
                  assertWorkBudget(invocationDeadline, 'Instagram post upserts')
                  const metaPostId = String(raw.id ?? '')
                  if (!metaPostId) continue
                  const timestamp = raw.timestamp ? new Date(raw.timestamp as string).toISOString() : null
                  if (!timestamp) throw new Error('Instagram media timestamp was missing after page validation.')
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
                    lease: { itemId: item.id, generation: leaseGeneration },
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
                return { postsSynced: pagePostsSynced, stopAfterPage: pageResult.boundaryReached }
              },
              async (cursor, complete, pagePostsSynced) => savePlatformState(
                'instagram', complete ? 'facts_pending' : 'pending', cursor,
                pagePostsSynced, instagramOldestTimestamp, instagramOrderingMalformed,
              ),
            )
            providerPaging.instagram = { pagesFetched: igCollection.pagesFetched, complete: igCollection.complete, pageCap: META_COLLECTION_PAGE_CAP }
            if (!igCollection.complete) {
              const message = igCollection.error ?? 'Instagram media result was incomplete.'
              warnings.push(message)
              if (igCollection.retryable) throw new RetryableIncompleteError(message, igCollection.pagesFetched > 0)
              itemStatus = 'failed'
              itemError = message
              await savePlatformState('instagram', 'failed', null)
            }
          } catch (e) {
            const message = redact(`Instagram sync error: ${String(e)}`, [accessToken, ...pageTokenMap.values()])
            if (e instanceof RetryableIncompleteError && (item.attempts < 3 || isMetaRateLimitError(message))) throw e
            if (isMetaRateLimitError(message)) throw new RetryableIncompleteError(message)
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
              const factsResult = await syncAccountFacts(sb, {
                clientId: item.client_id, assetId: asset?.id ?? null, connectionId: connections[0].id,
                platform: 'facebook', objectId: facebookPageId, token: fbPageToken,
                baseUrl, apiVersion: graphVersion, periodMonth: item.month, periodStart, periodEnd,
                tokens: allTokens, tokenClass: 'page', reconstructInteractions: null, runType: 'scheduled',
                deadline: invocationDeadline - PAGE_FETCH_RESERVE_MS,
                checkpoint: { itemId: item.id, leaseGeneration },
              })
              if (factsResult.healthState === 'permission_blocked' || factsResult.healthState === 'sync_error') {
                throw new Error(`Facebook account facts ended in ${factsResult.healthState}.`)
              }
              await savePlatformState('facebook', 'complete', null)
            } catch (e) {
              if (e instanceof MetaSyncDeadlineError) {
                throw new RetryableIncompleteError(e.message, true)
              }
              if (e instanceof MetaFactRetryableError) throw new RetryableIncompleteError(e.message, true)
              if (e instanceof RetryableIncompleteError && (item.attempts < 3 || isMetaRateLimitError(String(e)))) throw e
              const factsError = redact(`Facebook account facts error: ${String(e)}`, allTokens)
              warnings.push(factsError)
              itemStatus = 'failed'
              itemError = factsError.includes('permission_blocked')
                ? 'Facebook account facts are permission blocked. Post content was preserved.'
                : 'Normalized Facebook account facts failed. Post content was preserved, but reporting truth is incomplete.'
              await savePlatformState('facebook', 'failed', null)
            }
          }
        }
        if (instagramState === 'facts_pending' && instagramAccountId) {
          const igToken = facebookPageId ? (pageTokenMap.get(facebookPageId) ?? accessToken) : accessToken
          try {
            assertWorkBudget(invocationDeadline, 'Instagram account facts')
            const factsResult = await syncAccountFacts(sb, {
              clientId: item.client_id, assetId: asset?.id ?? null, connectionId: connections[0].id,
              platform: 'instagram', objectId: instagramAccountId, token: igToken,
              baseUrl, apiVersion: graphVersion, periodMonth: item.month, periodStart, periodEnd,
              tokens: allTokens, tokenClass: facebookPageId && pageTokenMap.get(facebookPageId) ? 'page' : 'user',
              reconstructInteractions: null, runType: 'scheduled',
              deadline: invocationDeadline - PAGE_FETCH_RESERVE_MS,
              checkpoint: { itemId: item.id, leaseGeneration },
            })
            if (factsResult.healthState === 'permission_blocked' || factsResult.healthState === 'sync_error') {
              throw new Error(`Instagram account facts ended in ${factsResult.healthState}.`)
            }
            await savePlatformState('instagram', 'complete', null)
          } catch (e) {
            if (e instanceof MetaSyncDeadlineError) {
              throw new RetryableIncompleteError(e.message, true)
            }
            if (e instanceof MetaFactRetryableError) throw new RetryableIncompleteError(e.message, true)
            if (e instanceof RetryableIncompleteError && (item.attempts < 3 || isMetaRateLimitError(String(e)))) throw e
            const factsError = redact(`Instagram account facts error: ${String(e)}`, allTokens)
            warnings.push(factsError)
            itemStatus = 'failed'
            itemError = factsError.includes('permission_blocked')
              ? 'Instagram account facts are permission blocked. Post content was preserved.'
              : 'Normalized Instagram account facts failed. Post content was preserved, but reporting truth is incomplete.'
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

        const { error: runError } = await sb.rpc('meta_sync_record_run', {
          p_item_id: item.id,
          p_lease_generation: leaseGeneration,
          p_connection_id: connections[0].id,
          p_status: itemStatus === 'failed' || itemStatus === 'skipped' ? 'failed' : 'success',
          p_summary: { postsSynced, warnings, reportsCreated, reportsReused, providerPaging, worker: META_CONNECTOR_VERSION },
        })
        if (runError) throw new Error(`Could not record fenced Meta sync run: ${runError.message}`)

      } catch (e) {
        const message = redact(String(e), [accessToken, ...pageTokenMap.values()])
        if (e instanceof RetryableIncompleteError && (item.attempts < 3 || isMetaRateLimitError(message))) {
          itemStatus = 'queued'
          itemError = message
          refundAttempt = e.refundAttempt
          budgetDeferred = true
        } else {
          itemStatus = 'failed'
          itemError = e instanceof RetryableIncompleteError
            ? `${message} Incomplete pagination exhausted 3 bounded attempts.`
            : message
        }
      }

      const itemRateLimited = isMetaRateLimitError(itemError ?? '')
      const itemRateLimitScope = metaRateLimitScope(itemError ?? '')
      await settleItem(
        itemStatus,
        reportsCreated,
        reportsReused,
        warnings,
        itemError,
        itemRateLimited || refundAttempt,
        itemRateLimited ? 900 : null,
        itemRateLimitScope,
      )

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
  const rateLimited = processed.some(p => isMetaRateLimitError(p.error ?? ''))
  if (rateLimited) {
    waitingForRateLimit = true
    // A client that only failed because Meta throttled us has not really
    // failed. Put it back on the queue at its original attempt count so a
    // throttle can never burn through the retry budget and permanently mark a
    // client failed for something that had nothing to do with its data.
    // Item settlement atomically refunded its attempt and started cooldown.
  }

  const abandoned = [...claimedLeases.entries()]
    .filter(([id]) => !settledIds.has(id))
    .map(([itemId, leaseGeneration]) => ({ item_id: itemId, lease_generation: leaseGeneration }))
  if (abandoned.length > 0) {
    // supabase-js query builders are thenable but expose no .catch(), so this
    // must be a real try/catch — a rejection here would kill the invocation and
    // strand the very items it is trying to hand back.
    try {
      await sb.rpc('meta_sync_release_claims', { p_claims: abandoned })
    } catch {
      // Left 'running'; the stale-lease sweep reclaims them.
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
      .or(`cooldown_until.is.null,cooldown_until.lte.${new Date().toISOString()}`)

    const { count: staleRunning } = await sb
      .from('meta_sync_batch_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', body.batchId)
      .eq('status', 'running')
      .lt('started_at', staleBefore)

    workRemaining = (remaining ?? 0) > 0 || (staleRunning ?? 0) > 0
    // Never self-amplify when the claim RPC is missing/failing (avoids an
    // infinite trigger loop against a broken deployment).
    if (!claimFailed && workRemaining && !waitingForRateLimit) {
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
      // A timely successful response is the only positive acknowledgement. A
      // timeout may still have started work, but it is reported as uncertain;
      // the per-minute reaper remains the durable recovery authority.
      if (activeLane) {
        const { error } = await sb.rpc('meta_sync_prepare_lane_handoff', {
          p_batch_id: activeLane.batchId,
          p_lane_id: activeLane.laneId,
          p_lease_generation: activeLane.generation,
        })
        if (error) throw new Error(`Could not prepare Meta lane handoff: ${error.message}`)
      }
      selfTriggered = await dispatchMetaWorker(workerUrl, workerSecret, {
        batchId: body.batchId, workerLane, workerLanes,
        laneLeaseGeneration: activeLane?.generation,
      })
    }
  }

  if (activeLane && !selfTriggered) {
    await sb.rpc('meta_sync_release_lane', {
      p_batch_id: activeLane.batchId,
      p_lane_id: activeLane.laneId,
      p_lease_generation: activeLane.generation,
    })
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
    waitingForRateLimit,
    workerLane,
    workerLanes,
    lanesStarted,
  })
  } catch (error) {
    // Any unhandled throw used to escape as a bare platform 500 with no
    // diagnostics. That is exactly how this incident started: three such 500s
    // exhausted the driver job's attempts, it went terminally 'failed', and the
    // batch was left with 70 items queued and nothing able to invoke a worker.
    //
    // Now a crash (a) hands back everything this invocation had claimed, so no
    // work is stranded, and (b) reports a real message the UI and the job can
    // act on. The cron reaper picks the batch up again within the minute.
    const detail = error instanceof Error ? error.message : String(error)
    const stranded = [...claimedLeases.entries()]
      .filter(([id]) => !settledIds.has(id))
      .map(([itemId, leaseGeneration]) => ({ item_id: itemId, lease_generation: leaseGeneration }))
    if (crashClient && stranded.length > 0) {
      try {
        await crashClient.rpc('meta_sync_release_claims', { p_claims: stranded })
      } catch {
        // Left 'running'; the stale-lease sweep reclaims them.
      }
    }
    if (crashClient && activeLane) {
      await crashClient.rpc('meta_sync_release_lane', {
        p_batch_id: activeLane.batchId,
        p_lane_id: activeLane.laneId,
        p_lease_generation: activeLane.generation,
      })
    }
    return jsonResponse({
      ok: false,
      error: `Meta sync worker failed: ${detail}`.slice(0, 500),
      itemsReleased: stranded.length,
      workerRan: settledIds.size > 0,
    }, 500)
  }
})
