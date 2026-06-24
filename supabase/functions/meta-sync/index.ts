import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_GRAPH_VERSION = 'v22.0'
const SYNC_ENGINE_VERSION = 'live-runtime-failure-fix'

type ErrorPhase = 'auth' | 'env' | 'request_parse' | 'connection' | 'assets' | 'sync' | 'unknown'

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
  accountTotals: Record<string, Record<string, number | null>>
  unavailableMetrics: Array<{ platform: string; metrics: string[]; reason: string }>
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

// Full calendar-month bounds for a specific YYYY-MM (used by the optional
// `month` parameter so a baseline month — e.g. April when syncing May — can be
// synced for comparison without changing the default behaviour).
function monthBoundsFor(month: string): { periodStart: string; periodEnd: string; month: string } {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) // 1-12
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return {
    periodStart: `${month}-01`,
    periodEnd: `${month}-${String(lastDay).padStart(2, '0')}`,
    month,
  }
}

// Current calendar month as YYYY-MM (UTC). Used to reject syncing an
// incomplete (current/future) month.
function currentMonthStr(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
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

function normalizeContentType(value: string | null | undefined): string {
  const t = (value ?? '').toLowerCase()
  if (t.includes('reel')) return 'reel'
  if (t.includes('story')) return 'story'
  if (t.includes('live')) return 'live'
  if (t.includes('carousel') || t.includes('album')) return 'carousel'
  if (t.includes('video')) return 'video'
  if (t.includes('photo') || t.includes('image')) return 'photo'
  if (t.includes('post')) return 'post'
  return 'unknown'
}

function facebookImageUrl(raw: Record<string, unknown>): string | null {
  if (typeof raw.full_picture === 'string' && raw.full_picture) return raw.full_picture
  const attachment = (raw.attachments as { data?: Array<{ media?: { image?: { src?: string } } }> } | undefined)?.data?.[0]
  return attachment?.media?.image?.src ?? null
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

// ── Token-safe Meta helpers ──────────────────────────────────
// Removes any access token from a string so tokens never appear in warnings,
// summaries, logs or responses.
function redact(text: string, tokens: Array<string | null | undefined>): string {
  let out = text
  for (const t of tokens) {
    if (t && t.length >= 8) out = out.split(t).join('[redacted]')
  }
  return out
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

function safeJsonResponse(data: Record<string, unknown>, status = 200): Response {
  return jsonResponse({ syncEngineVersion: SYNC_ENGINE_VERSION, ...data }, status)
}

function failureResponse(
  phase: ErrorPhase,
  error: unknown,
  status = 500,
  tokens: Array<string | null | undefined> = [],
  extras: Record<string, unknown> = {},
): Response {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown error')
  const safeError = redact(raw, tokens).slice(0, 600)
  return safeJsonResponse({
    ok: false,
    status: 'failed',
    phase,
    error: safeError || 'Sync failed.',
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
    ...extras,
  }, status)
}

// Reads a Meta Graph API error response into a safe, detailed, token-free string
// (message, type, code, subcode, fbtrace_id).
async function readMetaError(res: Response, tokens: Array<string | null | undefined>): Promise<string> {
  let detail = `HTTP ${res.status}`
  try {
    const body = await res.json()
    const e = body?.error
    if (e && typeof e === 'object') {
      const parts: string[] = []
      if (e.message) parts.push(String(e.message))
      if (e.type) parts.push(`type ${e.type}`)
      if (e.code !== undefined) parts.push(`code ${e.code}`)
      if (e.error_subcode !== undefined && e.error_subcode !== null) parts.push(`subcode ${e.error_subcode}`)
      if (e.fbtrace_id) parts.push(`trace ${e.fbtrace_id}`)
      if (parts.length > 0) detail = parts.join(', ')
    }
  } catch {
    // keep HTTP status
  }
  return redact(detail, tokens)
}

// fetch with a hard timeout so a slow/hung Meta request can never stall the
// whole function (which would blow the Edge runtime wall-clock limit).
async function metaFetch(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function sumInsightValue(v: { values?: Array<{ value?: number }> }): number | null {
  if (!v.values || v.values.length === 0) return null
  let sum = 0
  let any = false
  for (const entry of v.values) {
    if (typeof entry.value === 'number') {
      sum += entry.value
      any = true
    }
  }
  return any ? sum : null
}

interface InsightFetchResult {
  values: Record<string, number>
  error: string | null
}

function igInsightMetricsForType(postType: string): string[] {
  const normalized = normalizeContentType(postType)
  if (normalized === 'reel' || normalized === 'video') {
    return ['reach', 'plays', 'saved', 'shares', 'total_interactions']
  }
  return ['reach', 'saved', 'shares', 'total_interactions']
}

// Resilient insight fetch: tries the whole metric batch. When `split` is true
// and the batch fails (often because ONE metric is unsupported), it retries each
// metric individually so the supported metrics still come through.
//
// IMPORTANT: `split` defaults to FALSE. Per-post insight calls must NOT split,
// or 85 posts × ~5 metrics becomes a request storm that times out the function.
// Per-metric splitting is only used for the handful of account/page-level calls.
async function fetchInsights(
  baseUrl: string,
  objectId: string,
  metrics: string[],
  token: string,
  extra: Record<string, string>,
  tokens: Array<string | null | undefined>,
  opts: { split?: boolean } = {},
): Promise<InsightFetchResult> {
  const split = opts.split === true
  const values: Record<string, number> = {}

  const runBatch = async (ms: string[]): Promise<{ ok: boolean; error: string | null }> => {
    const params = new URLSearchParams({ access_token: token, metric: ms.join(','), ...extra })
    try {
      const res = await metaFetch(`${baseUrl}/${objectId}/insights?${params.toString()}`)
      if (!res.ok) return { ok: false, error: await readMetaError(res, tokens) }
      const data = await res.json()
      for (const v of (data.data as Array<{ name: string; values?: Array<{ value?: number }> }> ?? [])) {
        const val = sumInsightValue(v)
        if (val !== null) values[v.name] = val
      }
      return { ok: true, error: null }
    } catch (e) {
      return { ok: false, error: redact(`request failed: ${String(e)}`, tokens) }
    }
  }

  const batch = await runBatch(metrics)
  if (batch.ok) return { values, error: null }
  if (!split) return { values, error: batch.error }

  // Split: try each metric on its own so one bad metric doesn't lose the rest.
  const errors: string[] = []
  for (const m of metrics) {
    const single = await runBatch([m])
    if (!single.ok && single.error) errors.push(`${m} (${single.error})`)
  }
  return { values, error: errors.length > 0 ? errors.join('; ') : batch.error }
}

// Fetches Facebook Page access tokens for the connected user. Page endpoints
// (Page posts/insights) and the IG Business endpoints behind a page generally
// require the PAGE access token, not the user token. Tokens are used in-memory
// only and never stored or logged.
async function fetchPageTokens(baseUrl: string, userToken: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let url: string | null =
    `${baseUrl}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`
  let guard = 0
  while (url && guard < 10) {
    guard++
    const res = await metaFetch(url)
    if (!res.ok) break
    const data = await res.json()
    for (const p of (data.data as Array<{ id?: string; access_token?: string }> ?? [])) {
      if (p.id && p.access_token) map.set(p.id, p.access_token)
    }
    url = (data.paging?.next as string | undefined) ?? null
  }
  return map
}

interface SyncedMetric {
  clientId: string
  month: string
  platform: string
  views: number
  reach: number
  engagements: number
  profileVisits: number
  externalLinkTaps: number
  followers: number
  createdBy: string | null
}

// Upserts Meta-synced account totals into manual_platform_metrics using a VALID
// source_type ('other' — the table CHECK constraint does not allow a custom
// 'meta_business_sync'). Caller only invokes this when real data exists, so we
// never write a fake all-zero row. Errors surface as warnings, never silently.
async function upsertSyncedPlatformMetric(
  sb: ReturnType<typeof createClient>,
  m: SyncedMetric,
  warnings: string[],
  tokens: Array<string | null | undefined>,
) {
  const payload = {
    client_id: m.clientId,
    month: m.month,
    platform: m.platform,
    source_type: 'other',
    views: m.views,
    reach: m.reach,
    engagements: m.engagements,
    accounts_engaged: 0,
    profile_visits: m.profileVisits,
    external_link_taps: m.externalLinkTaps,
    followers: m.followers,
    top_content_notes: null,
    content_type_split_notes: null,
    general_notes: `Meta sync account totals (${new Date().toISOString().slice(0, 10)})`,
    created_by: m.createdBy,
  }
  const { data: existing } = await sb
    .from('manual_platform_metrics')
    .select('id')
    .eq('client_id', m.clientId)
    .eq('month', m.month)
    .eq('platform', m.platform)
    .limit(1)
  const res = existing && existing.length > 0
    ? await sb.from('manual_platform_metrics').update(payload).eq('id', existing[0].id)
    : await sb.from('manual_platform_metrics').insert(payload)
  if (res.error) {
    warnings.push(redact(`Could not store ${m.platform} account totals: ${describeDbError(res.error)}`, tokens))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    return await handleRequest(req)
  } catch (err) {
    return failureResponse('unknown', err, 500)
  }
})

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return safeJsonResponse({ ok: true, service: 'meta-sync', status: 'deployed' })
  }

  if (req.method !== 'POST') {
    return failureResponse('request_parse', 'Method not allowed', 405)
  }

  // Safe operational trail returned in the response for admin debugging. Never
  // contains tokens. `tokensForRedaction` is filled once tokens are known so the
  // top-level catch can scrub them from any unexpected error message.
  const steps: string[] = []
  const tokensForRedaction: string[] = []
  let phase: ErrorPhase = 'auth'

  // Top-level boundary: the function must ALWAYS return valid JSON with CORS,
  // even on an unexpected crash, so the frontend can show the real reason
  // instead of a generic "could not reach service".
  try {
    // ── Auth ─────────────────────────────────────────────────
    phase = 'auth'
    const authHeader = req.headers.get('Authorization') ?? ''
    phase = 'env'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
      return failureResponse('env', 'Server configuration error.', 500)
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)

  phase = 'auth'
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)

  if (authError || !user) {
    return failureResponse('auth', 'Authentication required.', 401)
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'team'].includes(profile.role)) {
    return failureResponse('auth', 'Staff access required.', 403)
  }
  steps.push('auth ok')

  // ── Parse body ───────────────────────────────────────────
  phase = 'request_parse'
  let body: { mode?: string; clientId?: string; month?: string } = {}
  try {
    body = await req.json()
  } catch {
    return failureResponse('request_parse', 'Invalid JSON body.', 400)
  }

  if (body.mode !== 'previous_completed_month') {
    return safeJsonResponse({
      ok: false,
      status: 'failed',
      phase: 'request_parse',
      error: `Unsupported mode "${body.mode ?? ''}". Only "previous_completed_month" is supported.`,
    }, 400)
  }

  // ── Calculate period ─────────────────────────────────────
  // Default: previous completed calendar month. An optional `month` (YYYY-MM)
  // lets the caller target a specific completed month (e.g. an April baseline
  // when syncing May). Current/future months are rejected.
  let periodStart: string
  let periodEnd: string
  let month: string
  if (typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)) {
    if (body.month >= currentMonthStr()) {
      return safeJsonResponse({
        ok: false,
        status: 'failed',
        phase: 'request_parse',
        error: `Month ${body.month} is not a completed calendar month yet.`,
      }, 400)
    }
    ;({ periodStart, periodEnd, month } = monthBoundsFor(body.month))
  } else {
    ;({ periodStart, periodEnd, month } = getPreviousMonthBounds())
  }

  // ── Get Meta token ───────────────────────────────────────
  phase = 'connection'
  const { data: connections } = await sb
    .from('meta_connections')
    .select('id')
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1)

  if (!connections || connections.length === 0) {
    return failureResponse('connection', 'Meta is not connected.', 400, tokensForRedaction, { steps })
  }
  steps.push('connection loaded')

  const { data: tokenRows } = await sb
    .from('meta_connection_tokens')
    .select('encrypted_access_token')
    .eq('connection_id', connections[0].id)
    .limit(1)

  if (!tokenRows || tokenRows.length === 0 || !tokenRows[0].encrypted_access_token) {
    return failureResponse('connection', 'Meta connection token is missing. Reconnect Meta.', 400, tokensForRedaction, { steps })
  }

  const accessToken = tokenRows[0].encrypted_access_token
  const baseUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}`

  steps.push('meta token loaded')

  // Page access tokens (in-memory only, never stored) for Page + IG endpoints.
  // Falls back to the user token per endpoint if a page token is unavailable.
  let pageTokenMap = new Map<string, string>()
  try {
    pageTokenMap = await fetchPageTokens(baseUrl, accessToken)
  } catch (_err) {
    // Non-fatal — endpoints will fall back to the user token.
  }
  steps.push(`page tokens loaded (${pageTokenMap.size})`)
  // Used to scrub any token from warnings/errors before they are stored/returned.
  const knownTokens: string[] = [accessToken, ...pageTokenMap.values()]
  tokensForRedaction.push(...knownTokens)

  // ── Load linked clients ──────────────────────────────────
  phase = 'assets'
  let linkedAssetsQuery = sb
    .from('meta_client_assets')
    .select('id, client_id, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, ad_account_id')
    .eq('is_active', true)

  if (body.clientId) {
    linkedAssetsQuery = linkedAssetsQuery.eq('client_id', body.clientId)
  }

  const { data: linkedAssets } = await linkedAssetsQuery

  if (!linkedAssets || linkedAssets.length === 0) {
    steps.push('linked assets loaded (0)')
    return safeJsonResponse({
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
      steps,
    })
  }
  steps.push(`linked assets loaded (${linkedAssets.length})`)

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
  phase = 'sync'
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

  // Hard time budget for all best-effort insight fetching. Posts (and their
  // engagements/images) are always saved; once this deadline passes we stop
  // fetching optional insights so the function returns well under the Edge
  // runtime wall-clock limit instead of being killed.
  const insightDeadline = Date.now() + 70_000

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
      accountTotals: {},
      unavailableMetrics: [],
    }

    // Page + IG Business endpoints generally need the Page access token. Fall
    // back to the user token when a page token isn't available.
    const pageToken = client.facebookPageId
      ? (pageTokenMap.get(client.facebookPageId) ?? accessToken)
      : accessToken
    const igToken = pageToken

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
      steps.push(`${client.clientName}: report ${result.reportCreated ? 'created' : 'reused'}`)

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
        rawPayload: Record<string, unknown>
      }> = []

      if (client.facebookPageId) {
        try {
          const fbParams = new URLSearchParams({
            access_token: pageToken,
            fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true),attachments',
            since: periodStart,
            until: `${periodEnd}T23:59:59Z`,
            limit: '100',
          })

          const fbRes = await metaFetch(`${baseUrl}/${client.facebookPageId}/posts?${fbParams.toString()}`)
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
                fullPicture: facebookImageUrl(raw),
                rawPayload: raw,
              })
            }

            result.warnings.push('Facebook views and reach are not synced. Page Insights (page_impressions, page_impressions_unique) consistently return errors through the current API. Post-level content interactions and current follower count are synced instead.')
          } else {
            result.warnings.push(`Could not fetch Facebook posts: ${await readMetaError(fbRes, knownTokens)}`)
          }
        } catch (err) {
          result.warnings.push(redact(`Error fetching Facebook posts: ${String(err)}`, knownTokens))
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
        totalInteractions: number | null
        thumbnailUrl: string | null
        mediaUrl: string | null
        rawPayload: Record<string, unknown>
      }> = []

      if (client.instagramAccountId) {
        try {
          const igParams = new URLSearchParams({
            access_token: igToken,
            fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
            limit: '100',
          })

          const igRes = await metaFetch(`${baseUrl}/${client.instagramAccountId}/media?${igParams.toString()}`)
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
                totalInteractions: null,
                thumbnailUrl: (raw.thumbnail_url as string | null) ?? null,
                mediaUrl: (raw.media_url as string | null) ?? null,
                rawPayload: raw,
              })
            }

            // Per-media insights (best-effort). One batch request per media with
            // the same circuit breaker + time budget as Facebook, so a broken
            // insights permission can't storm the function into a timeout.
            // likes/comments come from the media fields above, not insights.
            let igInsightErr: string | null = null
            for (const post of igPosts) {
              if (Date.now() > insightDeadline) {
                igInsightErr = igInsightErr ?? 'time budget reached — remaining media insights skipped'
                break
              }
              const { values, error } = await fetchInsights(
                baseUrl,
                post.metaPostId,
                igInsightMetricsForType(post.postType),
                igToken,
                {},
                knownTokens,
              )
              if (error) {
                igInsightErr = error
                break
              }
              if (typeof values.reach === 'number') post.reach = values.reach
              if (typeof values.views === 'number') post.impressions = values.views
              if (typeof values.plays === 'number') post.impressions = values.plays
              if (typeof values.saved === 'number') post.saves = values.saved
              if (typeof values.shares === 'number') post.shares = values.shares
              if (typeof values.total_interactions === 'number') post.totalInteractions = values.total_interactions
            }
            if (igInsightErr) {
              result.warnings.push(`Instagram media insights unavailable (views/reach shown as not available): ${igInsightErr}`)
            }
          } else {
            result.warnings.push(`Could not fetch Instagram media: ${await readMetaError(igRes, knownTokens)}`)
          }
        } catch (err) {
          result.warnings.push(redact(`Error fetching Instagram media: ${String(err)}`, knownTokens))
        }
      }

      // ── Upsert posts and mappings ──────────────────────
      // Normalize each post to availability-aware metrics:
      //   viewsValue / reachValue are number | null (null = Meta did not return)
      //   engagementsValue is always a number (from likes/comments/etc.)
      const allPosts = [
        ...fbPosts.map(p => ({
          ...p,
          platform: 'facebook' as const,
          viewsValue: typeof p.impressions === 'number' ? p.impressions : null,
          reachValue: typeof p.impressionsUnique === 'number' ? p.impressionsUnique : null,
          engagementsValue: p.reactions + p.comments + p.shares + (p.clicks ?? 0),
        })),
        ...igPosts.map(p => ({
          ...p,
          platform: 'instagram' as const,
          viewsValue: typeof p.impressions === 'number' ? p.impressions : null,
          reachValue: typeof p.reach === 'number' ? p.reach : null,
          engagementsValue: typeof p.totalInteractions === 'number'
            ? p.totalInteractions
            : p.reactions + p.comments + (p.saves ?? 0) + (p.shares ?? 0),
        })),
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
              views: post.viewsValue ?? 0,
              reach: post.reachValue ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: ('clicks' in post && typeof post.clicks === 'number') ? post.clicks : 0,
              raw: {
                source: 'meta_sync',
                platform: post.platform,
                content_type: normalizeContentType(post.postType),
                synced_at: new Date().toISOString(),
                // True availability: number when Meta returned it, null otherwise.
                views: post.viewsValue,
                reach: post.reachValue,
                engagements: post.engagementsValue,
                metric_availability: {
                  views: typeof post.viewsValue === 'number',
                  reach: typeof post.reachValue === 'number',
                  content_interactions: true,
                  source: post.platform === 'facebook' ? 'direct_fields' : 'media_insights',
                },
                meta_payload: post.rawPayload,
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
              views: post.viewsValue ?? 0,
              reach: post.reachValue ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: ('clicks' in post && typeof post.clicks === 'number') ? post.clicks : 0,
              raw: {
                source: 'meta_sync',
                platform: post.platform,
                content_type: normalizeContentType(post.postType),
                synced_at: new Date().toISOString(),
                // True availability: number when Meta returned it, null otherwise.
                views: post.viewsValue,
                reach: post.reachValue,
                engagements: post.engagementsValue,
                metric_availability: {
                  views: typeof post.viewsValue === 'number',
                  reach: typeof post.reachValue === 'number',
                  content_interactions: true,
                  source: post.platform === 'facebook' ? 'direct_fields' : 'media_insights',
                },
                meta_payload: post.rawPayload,
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
              views: post.viewsValue ?? 0,
              reach: post.reachValue ?? 0,
              reactions: post.reactions,
              comments: post.comments,
              shares: post.shares ?? 0,
              total_clicks: ('clicks' in post && typeof post.clicks === 'number') ? post.clicks : 0,
              raw: {
                source: 'meta_sync',
                platform: post.platform,
                content_type: normalizeContentType(post.postType),
                synced_at: new Date().toISOString(),
                // True availability: number when Meta returned it, null otherwise.
                views: post.viewsValue,
                reach: post.reachValue,
                engagements: post.engagementsValue,
                metric_availability: {
                  views: typeof post.viewsValue === 'number',
                  reach: typeof post.reachValue === 'number',
                  content_interactions: true,
                  source: post.platform === 'facebook' ? 'direct_fields' : 'media_insights',
                },
                meta_payload: post.rawPayload,
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

      // ── Fetch Facebook Page data (reliable fields only) ──
      // Facebook Page-level insights (page_impressions, page_impressions_unique,
      // page_engaged_users) are NOT requested because they consistently return
      // "invalid" errors through the current API version and token permissions.
      // Instead we rely on post-level data (reactions, comments, shares) for
      // content interactions, and Page fields for current follower count. Views
      // and reach are not available for Facebook through this API path.
      if (client.facebookPageId && Date.now() < insightDeadline) {
        try {
          const fbValues: Record<string, number> = {}

          // Post-level content interaction sum
          const fbContentInteractions = fbPosts.reduce(
            (sum, post) => sum + post.reactions + post.comments + post.shares + (post.clicks ?? 0),
            0,
          )

          // Current follower count from Page fields
          let currentFollowers = 0
          try {
            const pageParams = new URLSearchParams({ access_token: pageToken, fields: 'fan_count,followers_count' })
            const pageRes = await metaFetch(`${baseUrl}/${client.facebookPageId}?${pageParams.toString()}`)
            if (pageRes.ok) {
              const pageData = await pageRes.json()
              currentFollowers =
                typeof pageData.followers_count === 'number'
                  ? pageData.followers_count
                  : typeof pageData.fan_count === 'number'
                    ? pageData.fan_count
                    : 0
            }
          } catch {
            // non-fatal
          }

          const anyPositive = fbContentInteractions > 0 || currentFollowers > 0

          if (anyPositive) {
            await upsertSyncedPlatformMetric(sb, {
              clientId: client.clientId,
              month,
              platform: 'facebook',
              views: 0,
              reach: 0,
              engagements: fbContentInteractions,
              profileVisits: 0,
              externalLinkTaps: 0,
              followers: currentFollowers,
              createdBy: user.id,
            }, result.warnings, knownTokens)
          }

          result.accountTotals.facebook = {
            views: null,
            viewers: null,
            content_interactions: fbContentInteractions,
            visits: null,
            current_followers: currentFollowers > 0 ? currentFollowers : null,
          }

          result.unavailableMetrics.push({
            platform: 'facebook',
            metrics: ['views', 'viewers'],
            reason: 'Facebook Page Insights did not return page_impressions or page_impressions_unique through the current API version and token permissions. Post-level interactions and follower count are synced instead.',
          })
        } catch (err) {
          result.warnings.push(redact(`Error fetching Facebook account data: ${String(err)}`, knownTokens))
        }
      }

      // ── Fetch Instagram account monthly totals (best-effort) ──
      // Instagram insight metrics have different param requirements:
      //   - reach works with period=day
      //   - views, total_interactions, profile_views, website_clicks need metric_type=total_value
      // We split into safe groups to avoid "should be specified with parameter" errors.
      if (client.instagramAccountId && Date.now() < insightDeadline) {
        try {
          const igValues: Record<string, number> = {}
          const igErrors: string[] = []

          // Group 1: reach (no special params needed)
          const reachResult = await fetchInsights(
            baseUrl,
            client.instagramAccountId,
            ['reach'],
            igToken,
            { period: 'day', since: periodStart, until: periodEnd },
            knownTokens,
          )
          if (reachResult.error) {
            igErrors.push(`reach (${reachResult.error})`)
          }
          Object.assign(igValues, reachResult.values)

          // Group 2: metrics requiring metric_type=total_value
          const totalValueResult = await fetchInsights(
            baseUrl,
            client.instagramAccountId,
            ['views', 'total_interactions', 'profile_views', 'website_clicks'],
            igToken,
            { period: 'day', since: periodStart, until: periodEnd, metric_type: 'total_value' },
            knownTokens,
            { split: true },
          )
          if (totalValueResult.error) {
            igErrors.push(totalValueResult.error)
          }
          Object.assign(igValues, totalValueResult.values)

          // followers_count is a lifetime metric fetched separately (best-effort).
          let igFollowers = 0
          try {
            const fParams = new URLSearchParams({ access_token: igToken, fields: 'followers_count' })
            const fRes = await metaFetch(`${baseUrl}/${client.instagramAccountId}?${fParams.toString()}`)
            if (fRes.ok) {
              const fData = await fRes.json()
              if (typeof fData.followers_count === 'number') igFollowers = fData.followers_count
            }
          } catch {
            // non-fatal
          }

          const combinedError = igErrors.length > 0 ? igErrors.join('; ') : null

          if (combinedError && Object.keys(igValues).length === 0 && igFollowers === 0) {
            result.warnings.push(`Instagram account insights unavailable (follower/profile totals may be missing): ${combinedError}`)
          } else if (combinedError && (Object.keys(igValues).length > 0 || igFollowers > 0)) {
            result.warnings.push(`Some Instagram account insights had errors: ${combinedError}`)
          }

          const anyPositive =
            (['views', 'reach', 'total_interactions', 'profile_views', 'website_clicks'].some(k => typeof igValues[k] === 'number' && igValues[k] > 0)) ||
            igFollowers > 0
          if (anyPositive) {
            await upsertSyncedPlatformMetric(sb, {
              clientId: client.clientId,
              month,
              platform: 'instagram',
              views: igValues.views ?? 0,
              reach: igValues.reach ?? 0,
              engagements: igValues.total_interactions ?? 0,
              profileVisits: igValues.profile_views ?? 0,
              externalLinkTaps: igValues.website_clicks ?? 0,
              followers: igFollowers,
              createdBy: user.id,
            }, result.warnings, knownTokens)
          }
          result.accountTotals.instagram = {
            views: igValues.views ?? null,
            reach: igValues.reach ?? null,
            content_interactions: igValues.total_interactions ?? null,
            visits: igValues.profile_views ?? null,
            website_clicks: igValues.website_clicks ?? null,
            current_followers: igFollowers > 0 ? igFollowers : null,
          }
          const missingIg = ['views', 'reach', 'total_interactions', 'profile_views', 'website_clicks']
            .filter(metric => typeof igValues[metric] !== 'number')
          if (missingIg.length > 0) {
            result.unavailableMetrics.push({
              platform: 'instagram',
              metrics: missingIg,
              reason: combinedError ?? 'Meta did not return this metric for the requested month.',
            })
          }
        } catch (err) {
          result.warnings.push(redact(`Error fetching Instagram account insights: ${String(err)}`, knownTokens))
        }
      }

      result.status = 'success'
      steps.push(`${client.clientName}: account totals ${JSON.stringify(result.accountTotals)}`)
      if (result.unavailableMetrics.length > 0) {
        steps.push(`${client.clientName}: unavailable metrics ${JSON.stringify(result.unavailableMetrics)}`)
      }
      steps.push(`${client.clientName}: ${result.postsSynced} posts synced`)
      clientsSynced++
    } catch (err) {
      result.status = 'failed'
      // Our thrown errors already carry the detailed message; redact defensively.
      result.error = redact(err instanceof Error ? err.message : String(err), knownTokens)
      steps.push(`${client.clientName}: failed`)
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
          accountTotals: result.accountTotals,
          unavailableMetrics: result.unavailableMetrics,
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

  return safeJsonResponse({
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
    steps,
    // Backward-compatible field used by the existing UI.
    clientsSynced,
    details: results,
  })
  } catch (err) {
    // Any unhandled error still returns valid JSON (with CORS via jsonResponse)
    // so the UI shows the real reason rather than a transport failure. Status is
    // 200 so the Supabase client surfaces it through `data`, not a thrown error.
    const rawMsg = err instanceof Error ? err.message : String(err)
    const safeMsg = redact(`Sync failed unexpectedly: ${rawMsg}`, tokensForRedaction).slice(0, 600)
    return safeJsonResponse({
      ok: false,
      status: 'failed',
      phase,
      error: safeMsg,
      message: 'Sync failed unexpectedly.',
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
      steps,
    }, 200)
  }
}
