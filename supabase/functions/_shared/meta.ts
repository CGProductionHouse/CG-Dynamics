// ============================================================================
// _shared/meta.ts — generic Meta connector helper
//
// Runtime metric-discovery engine: for each candidate Facebook Page / Instagram
// account metric it makes an isolated request, classifies the outcome into an
// explicit availability state, and writes normalized facts + provenance
// snapshots. Missing / unsupported values are NEVER coerced to zero.
//
// Generic: no client IDs, page IDs, IG IDs, asset names or per-client values are
// encoded. The same contract runs for every linked client.
// ============================================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Graph API version resolution ─────────────────────────────────────────────
// One controlled server-side source. The version is NEVER silently assumed.
// Meta Developers is the authority for the verified production value; code does
// not carry a second version allowlist that can silently become stale.

export class MetaConfigurationError extends Error {
  constructor(message: string) {
    super(`Internal Meta configuration error: ${message}`)
    this.name = 'MetaConfigurationError'
  }
}

export function resolveMetaGraphConfig(): { version: string; baseUrl: string } {
  const raw = (Deno.env.get('META_GRAPH_VERSION') ?? '').trim()
  if (!raw) {
    throw new MetaConfigurationError('META_GRAPH_VERSION is missing. Refusing to call Meta without an explicitly configured version.')
  }
  if (!/^v\d+\.\d+$/.test(raw)) {
    throw new MetaConfigurationError(`META_GRAPH_VERSION "${raw}" is invalid. Refusing to call Meta.`)
  }
  return { version: raw, baseUrl: `https://graph.facebook.com/${raw}` }
}

export const META_CONNECTOR_VERSION = 'meta-connector-v3'
export const META_INSIGHTS_TIMEZONE = 'America/Los_Angeles'

export type Availability =
  | 'complete'
  | 'valid_zero'
  | 'unavailable'
  | 'permission_blocked'
  | 'partial'
  | 'error'
  | 'stale'

// ── Token-safe redaction ─────────────────────────────────────────────────────
export function redact(text: string, tokens: Array<string | null | undefined>): string {
  let out = text
  for (const t of tokens) if (t && t.length >= 8) out = out.split(t).join('[redacted]')
  return out
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[redacted]')
    .replace(/client_secret=[^&\s"']+/gi, 'client_secret=[redacted]')
    .replace(/code=[^&\s"']+/gi, 'code=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

// ── fetch with timeout + bounded retry/backoff on transient failures ─────────
const RETRYABLE = new Set([429, 500, 502, 503, 504])
const BACKOFF = [500, 1200]

export async function metaFetch(
  url: string,
  initOrTimeout: RequestInit | number = {},
  requestedTimeoutMs = 12_000,
): Promise<Response> {
  const init = typeof initOrTimeout === 'number' ? {} : initOrTimeout
  const timeoutMs = typeof initOrTimeout === 'number' ? initOrTimeout : requestedTimeoutMs
  const canRetry = !init.method || ['GET', 'HEAD'].includes(init.method.toUpperCase())
  const backoff = canRetry ? BACKOFF : []
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (res.ok || !RETRYABLE.has(res.status)) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
    }
    if (attempt < backoff.length) await new Promise(r => setTimeout(r, backoff[attempt]))
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export interface MetaErrorInfo {
  code: string | null
  subcode: string | null
  message: string
  type: string | null
  trace: string | null
}

export async function readMetaError(
  res: Response,
  tokens: Array<string | null | undefined>,
): Promise<MetaErrorInfo> {
  try {
    const body = await res.json()
    const e = body?.error ?? {}
    return {
      code: e.code !== undefined ? String(e.code) : null,
      subcode: e.error_subcode !== undefined && e.error_subcode !== null ? String(e.error_subcode) : null,
      message: redact(String(e.message ?? `HTTP ${res.status}`), tokens),
      type: e.type ? String(e.type) : null,
      trace: e.fbtrace_id ? String(e.fbtrace_id) : null,
    }
  } catch {
    return { code: null, subcode: null, message: `HTTP ${res.status}`, type: null, trace: null }
  }
}

// Maps a Meta error to an availability state. A missing/unsupported metric is
// `unavailable` (not an error); a permission/token problem is `permission_blocked`;
// rate limits and unexpected failures are transient `error` (never destroy a
// previously verified value).
export function classifyError(err: MetaErrorInfo): Availability {
  const code = err.code ?? ''
  const sub = err.subcode ?? ''
  const msg = err.message.toLowerCase()
  // Token / permission problems → the account cannot serve this metric right now.
  if (['190', '102', '463', '467'].includes(code)) return 'permission_blocked'
  if (['10', '200', '3', '278', '294'].includes(code)) return 'permission_blocked'
  // Nonexistent / deprecated / unsupported metric for this object or version.
  if (code === '100' && (
    sub === '33'
    || msg.includes('nonexisting')
    || msg.includes('does not support')
    || msg.includes('unsupported')
    || msg.includes('deprecat')
    || msg.includes('valid insights metric')
  )) {
    return 'unavailable'
  }
  if (msg.includes('does not exist') || msg.includes('cannot be accessed')) return 'unavailable'
  // Rate limit / transient.
  if (['4', '17', '32', '613', '341'].includes(code) || (code === '4' && sub === '2069032')) return 'error'
  return 'error'
}

function classifyValue(value: number | null): Availability {
  if (value === null) return 'unavailable'
  if (value === 0) return 'valid_zero'
  return 'complete'
}

// Parses an insight response array into a single summed/total number, or null
// when the provider returned no numeric value. For unique metrics the caller
// must use total_value (summing a daily-unique series over-counts people).
function parseInsight(data: Array<Record<string, unknown>>, valueKey?: string): number | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const d = data[0]
  const total = d.total_value as {
    value?: unknown
    breakdowns?: Array<{
      results?: Array<{ dimension_values?: unknown[]; value?: unknown }>
    }>
  } | undefined
  if (total && typeof total.value === 'number') return total.value
  if (total && valueKey && total.value && typeof total.value === 'object') {
    const entries = Object.entries(total.value as Record<string, unknown>)
    const match = entries.find(([key, value]) => key.toLowerCase() === valueKey.toLowerCase() && typeof value === 'number')
    if (match && typeof match[1] === 'number') return match[1]
  }
  if (total && valueKey && Array.isArray(total.breakdowns)) {
    const wanted = valueKey.toLowerCase()
    for (const breakdown of total.breakdowns) {
      for (const result of breakdown.results ?? []) {
        const labels = (result.dimension_values ?? []).map(value => String(value).toLowerCase().replace(/[^a-z]/g, ''))
        const positiveFollow = wanted === 'follows'
          && labels.some(label => ['follow', 'follows', 'follower'].includes(label))
          && labels.every(label => !label.includes('unfollow') && !label.includes('nonfollower'))
        if ((labels.includes(wanted) || positiveFollow) && typeof result.value === 'number') return result.value
      }
    }
  }
  const values = d.values as Array<{ value?: unknown }> | undefined
  if (values && values.length > 0) {
    let sum = 0, any = false
    for (const v of values) if (typeof v.value === 'number') { sum += v.value; any = true }
    return any ? sum : null
  }
  return null
}

// ── Page access tokens (in-memory only, never stored/logged) ─────────────────
export async function fetchPageTokens(baseUrl: string, userToken: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let url: string | null = `${baseUrl}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`
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

// ── Metric specification ─────────────────────────────────────────────────────
export type MetricMode = 'total_value' | 'period_day_sum' | 'page_field' | 'ig_field'

export interface MetricSpec {
  metricKey: string          // canonical (metric_registry.metric_key)
  sourceMetric: string       // provider metric / field
  fallbackField?: string     // e.g. fan_count when followers_count absent
  mode: MetricMode
  allowPeriodDayFallback?: boolean // additive metrics only (never for unique)
  includesPaid: 'organic' | 'paid' | 'both' | 'unknown'
  aggregation: 'sum' | 'unique' | 'snapshot' | 'reconstructed'
  comparableGroup: string
  breakdown?: string
  valueKey?: string
}

// Facebook Page account-level candidates (Business-Suite-aligned).
export const FB_ACCOUNT_METRICS: MetricSpec[] = [
  { metricKey: 'brand_views', sourceMetric: 'page_media_view', mode: 'total_value', allowPeriodDayFallback: true, includesPaid: 'both', aggregation: 'sum', comparableGroup: 'fb_media_views_v2' },
  { metricKey: 'unique_viewers', sourceMetric: 'page_total_media_view_unique', mode: 'total_value', includesPaid: 'both', aggregation: 'unique', comparableGroup: 'fb_media_viewers_v2' },
  { metricKey: 'content_interactions', sourceMetric: 'page_post_engagements', mode: 'total_value', allowPeriodDayFallback: true, includesPaid: 'both', aggregation: 'sum', comparableGroup: 'fb_interactions_v1' },
  { metricKey: 'follows_gained', sourceMetric: 'page_daily_follows', mode: 'period_day_sum', includesPaid: 'organic', aggregation: 'sum', comparableGroup: 'fb_follows_gained_v2' },
  { metricKey: 'page_visits', sourceMetric: 'page_views_total', mode: 'period_day_sum', includesPaid: 'both', aggregation: 'sum', comparableGroup: 'fb_page_visits_v1' },
  { metricKey: 'current_followers', sourceMetric: 'followers_count', fallbackField: 'fan_count', mode: 'page_field', includesPaid: 'organic', aggregation: 'snapshot', comparableGroup: 'fb_followers_snapshot_v1' },
]

// Instagram professional account candidates.
export const IG_ACCOUNT_METRICS: MetricSpec[] = [
  { metricKey: 'brand_views', sourceMetric: 'views', mode: 'total_value', includesPaid: 'both', aggregation: 'sum', comparableGroup: 'ig_views_v1' },
  { metricKey: 'reach', sourceMetric: 'reach', mode: 'total_value', includesPaid: 'both', aggregation: 'unique', comparableGroup: 'ig_reach_v1' },
  { metricKey: 'content_interactions', sourceMetric: 'total_interactions', mode: 'total_value', includesPaid: 'both', aggregation: 'sum', comparableGroup: 'ig_interactions_v1' },
  { metricKey: 'profile_visits', sourceMetric: 'profile_views', mode: 'total_value', includesPaid: 'both', aggregation: 'sum', comparableGroup: 'ig_profile_visits_v1' },
  { metricKey: 'website_clicks', sourceMetric: 'website_clicks', mode: 'total_value', includesPaid: 'both', aggregation: 'sum', comparableGroup: 'ig_website_clicks_v1' },
  { metricKey: 'follows_gained', sourceMetric: 'follows_and_unfollows', mode: 'total_value', includesPaid: 'organic', aggregation: 'sum', comparableGroup: 'ig_follows_gained_v2', breakdown: 'follow_type', valueKey: 'follows' },
  { metricKey: 'current_followers', sourceMetric: 'followers_count', mode: 'ig_field', includesPaid: 'organic', aggregation: 'snapshot', comparableGroup: 'ig_followers_snapshot_v1' },
]

function addUtcDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function zonedStartEpoch(date: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const utcGuess = Date.UTC(year, month - 1, day)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcGuess))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.floor((utcGuess - (representedAsUtc - utcGuess)) / 1000)
}

export function metaInsightsBounds(periodStart: string, periodEnd: string): { since: string; until: string } {
  return {
    since: String(zonedStartEpoch(periodStart, META_INSIGHTS_TIMEZONE)),
    until: String(zonedStartEpoch(addUtcDays(periodEnd, 1), META_INSIGHTS_TIMEZONE)),
  }
}

export interface MetricProbe {
  metricKey: string
  sourceMetric: string
  platform: string
  value: number | null
  availability: Availability
  responseShape: string
  metricType: string
  rawSnapshot?: unknown
  error?: MetaErrorInfo
}

function tokenSafeSnapshot(value: unknown, tokens: Array<string | null | undefined>): unknown {
  try {
    return JSON.parse(redact(JSON.stringify(value), tokens))
  } catch {
    return null
  }
}

// Probes a single metric in isolation. One failing metric never affects another.
export async function probeMetric(
  baseUrl: string,
  objectId: string,
  token: string,
  platform: string,
  spec: MetricSpec,
  since: string,
  until: string,
  tokens: Array<string | null | undefined>,
): Promise<MetricProbe> {
  const base = { metricKey: spec.metricKey, sourceMetric: spec.sourceMetric, platform }

  // Field-mode metrics (snapshots) read an object field, not the insights edge.
  if (spec.mode === 'page_field' || spec.mode === 'ig_field') {
    const fields = spec.fallbackField ? `${spec.sourceMetric},${spec.fallbackField}` : spec.sourceMetric
    try {
      const res = await metaFetch(`${baseUrl}/${objectId}?fields=${fields}&access_token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        const err = await readMetaError(res, tokens)
        return { ...base, value: null, availability: classifyError(err), responseShape: 'error', metricType: 'field', error: err }
      }
      const body = await res.json()
      const primaryValue = body[spec.sourceMetric]
      const fallbackValue = spec.fallbackField ? body[spec.fallbackField] : undefined
      const v = typeof primaryValue === 'number'
        ? primaryValue
        : (typeof fallbackValue === 'number' ? fallbackValue : null)
      const sourceMetric = typeof primaryValue === 'number'
        ? spec.sourceMetric
        : (typeof fallbackValue === 'number' && spec.fallbackField ? spec.fallbackField : spec.sourceMetric)
      return { ...base, sourceMetric, value: v, availability: classifyValue(v), responseShape: 'field', metricType: 'field', rawSnapshot: tokenSafeSnapshot(body, tokens) }
    } catch (e) {
      return { ...base, value: null, availability: 'error', responseShape: 'error', metricType: 'field', error: { code: null, subcode: null, message: redact(String(e), tokens), type: null, trace: null } }
    }
  }

  // Insights metrics: try the primary shape, then (additive only) a period=day sum.
  const attempts: Array<{ metricType: string; qs: string }> = []
  const breakdown = spec.breakdown ? `&breakdown=${encodeURIComponent(spec.breakdown)}` : ''
  if (spec.mode === 'total_value') {
    attempts.push({ metricType: 'total_value', qs: `metric=${spec.sourceMetric}&metric_type=total_value&period=day&since=${since}&until=${until}${breakdown}` })
    if (spec.allowPeriodDayFallback) attempts.push({ metricType: 'time_series', qs: `metric=${spec.sourceMetric}&period=day&since=${since}&until=${until}` })
  } else {
    // period_day_sum
    attempts.push({ metricType: 'time_series', qs: `metric=${spec.sourceMetric}&period=day&since=${since}&until=${until}` })
    attempts.push({ metricType: 'total_value', qs: `metric=${spec.sourceMetric}&metric_type=total_value&period=day&since=${since}&until=${until}` })
  }

  let lastErr: MetaErrorInfo | undefined
  for (const attempt of attempts) {
    try {
      const res = await metaFetch(`${baseUrl}/${objectId}/insights?${attempt.qs}&access_token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        lastErr = await readMetaError(res, tokens)
        const cls = classifyError(lastErr)
        // Unsupported/permission are definitive for this attempt shape — but try
        // the next shape before giving up (a metric may only work one way).
        if (cls === 'error') continue
        // keep trying other shape; remember classification
        continue
      }
      const body = await res.json()
      const value = parseInsight(body.data as Array<Record<string, unknown>>, spec.valueKey)
      if (value !== null) {
        return { ...base, value, availability: classifyValue(value), responseShape: attempt.metricType, metricType: attempt.metricType, rawSnapshot: tokenSafeSnapshot(body, tokens) }
      }
      // ok but empty → try next shape
    } catch (e) {
      lastErr = { code: null, subcode: null, message: redact(String(e), tokens), type: null, trace: null }
    }
  }

  const availability = lastErr ? classifyError(lastErr) : 'unavailable'
  return { ...base, value: null, availability, responseShape: 'error', metricType: attempts[0]?.metricType ?? 'total_value', error: lastErr }
}

// ── Fact persistence with preserve-verified-on-failure ───────────────────────
const DEFINITIVE: Availability[] = ['complete', 'valid_zero']

// Upserts one monthly fact. A non-definitive incoming state (unavailable /
// permission_blocked / error) must NEVER overwrite a previously verified value —
// a failed re-sync may not destroy the last verified dataset.
export async function upsertMonthlyFact(
  sb: SupabaseClient,
  fact: {
    clientId: string; assetId: string | null; platform: string
    periodMonth: string; periodStart: string; periodEnd: string
    metricKey: string; sourceMetric: string; value: number | null
    availability: Availability; includesPaid: string; aggregation: string
    comparableGroup: string; apiVersion: string; sourceTimezone: string | null
    provenance: Record<string, unknown>; syncRunId: string | null
  },
): Promise<'inserted' | 'updated' | 'kept_verified'> {
  // Phase20e contract: the RPC owns the unique-key upsert and atomically keeps a
  // prior complete/valid_zero fact when the incoming value is non-definitive.
  const { data, error } = await sb.rpc('upsert_platform_metric_fact_preserving_verified', {
    p_client_id: fact.clientId,
    p_asset_id: fact.assetId,
    p_platform: fact.platform,
    p_period_month: fact.periodMonth,
    p_period_start: fact.periodStart,
    p_period_end: fact.periodEnd,
    p_metric_key: fact.metricKey,
    p_source_metric: fact.sourceMetric,
    p_value: fact.value,
    p_availability: fact.availability,
    p_includes_paid: fact.includesPaid,
    p_aggregation: fact.aggregation,
    p_comparable_group: fact.comparableGroup,
    p_api_version: fact.apiVersion,
    p_connector_version: META_CONNECTOR_VERSION,
    p_source_timezone: fact.sourceTimezone,
    p_provenance: fact.provenance,
    p_sync_run_id: fact.syncRunId,
    p_verified_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Failed to upsert ${fact.platform}/${fact.metricKey} fact: ${error.message} (${error.code ?? 'unknown'})`)
  const result = Array.isArray(data) ? data[0] : data
  const action = typeof result === 'string'
    ? result
    : (result && typeof result === 'object' && 'outcome' in result
      ? String(result.outcome)
      : (result && typeof result === 'object' && 'action' in result ? String(result.action) : 'updated'))
  if (action === 'inserted' || action === 'kept_verified') {
    return action
  }
  return 'updated'
}

export interface AccountFactsResult {
  platform: string
  syncRunId: string | null
  healthState: string
  probes: MetricProbe[]
  facts: Record<string, { value: number | null; availability: Availability; sourceMetric: string }>
}

// Runs the full account-level metric discovery for one platform + object, writes
// snapshots + facts, and returns the per-metric result for the parity matrix.
export async function syncAccountFacts(
  sb: SupabaseClient,
  args: {
    clientId: string; assetId: string | null; connectionId: string | null
    platform: 'facebook' | 'instagram'; objectId: string; token: string
    baseUrl: string; apiVersion: string
    periodMonth: string; periodStart: string; periodEnd: string
    tokens: Array<string | null | undefined>
    tokenClass: 'page' | 'user' | 'system_user'
    runType: 'manual' | 'scheduled' | 'historical_resync'
    reconstructInteractions?: number | null // fallback FB content interactions from post sums
  },
): Promise<AccountFactsResult> {
  const specs = args.platform === 'facebook' ? FB_ACCOUNT_METRICS : IG_ACCOUNT_METRICS
  const insightBounds = metaInsightsBounds(args.periodStart, args.periodEnd)

  // 1. Open a sync run row.
  const { data: runRow, error: runInsertError } = await sb.from('platform_sync_runs').insert({
    client_id: args.clientId, asset_id: args.assetId, connection_id: args.connectionId,
    platform: args.platform, run_type: args.runType, period_month: args.periodMonth,
    period_start: args.periodStart, period_end: args.periodEnd,
    api_version: args.apiVersion, connector_version: META_CONNECTOR_VERSION,
    token_class: args.tokenClass, requested_bounds: { since: args.periodStart, until: args.periodEnd },
    business_timezone: 'Africa/Johannesburg', status: 'running', health_state: 'sync_error',
    started_at: new Date().toISOString(),
  }).select('id').single()
  if (runInsertError || !runRow?.id) {
    throw new Error(`Failed to create ${args.platform} sync run: ${runInsertError?.message ?? 'missing run id'} (${runInsertError?.code ?? 'unknown'})`)
  }
  const syncRunId = runRow.id as string

  const probes: MetricProbe[] = []
  const facts: AccountFactsResult['facts'] = {}

  try {
    for (const spec of specs) {
    let probe = await probeMetric(args.baseUrl, args.objectId, args.token, args.platform, spec, insightBounds.since, insightBounds.until, args.tokens)

    // FB content interactions fallback: reconstruct from post engagement sums when
    // the Page metric is unavailable. Stored as reconstructed, never claimed as
    // Business Suite parity.
    let sourceMetric = probe.sourceMetric
    let aggregation = spec.aggregation
    if (args.platform === 'facebook' && spec.metricKey === 'content_interactions'
        && probe.availability !== 'complete' && typeof args.reconstructInteractions === 'number' && args.reconstructInteractions > 0) {
      probe = { ...probe, sourceMetric: 'reconstructed_post_engagements', value: args.reconstructInteractions, availability: 'partial', responseShape: 'reconstructed_sum', metricType: 'reconstructed' }
      sourceMetric = 'reconstructed_post_engagements'
      aggregation = 'reconstructed'
    }

    probes.push(probe)
    // 2. Provenance snapshot for every attempt (definitive or not).
    const retrievedAt = new Date().toISOString()
    const safeSnapshot = {
      metric_key: spec.metricKey,
      source_metric: sourceMetric,
      endpoint_mode: spec.mode,
      response_shape: probe.responseShape,
      metric_type: probe.metricType,
      availability: probe.availability,
      value: probe.value,
      error: probe.error ? {
        code: probe.error.code,
        subcode: probe.error.subcode,
        message: redact(probe.error.message, args.tokens),
        type: probe.error.type,
        trace: probe.error.trace,
      } : null,
      source_response: probe.rawSnapshot ?? null,
    }
    const { data: snapshotRow, error: snapshotError } = await sb.from('platform_metric_snapshots').insert({
      sync_run_id: syncRunId, client_id: args.clientId, asset_id: args.assetId, platform: args.platform,
      source_endpoint: spec.mode === 'page_field' || spec.mode === 'ig_field' ? `/${args.platform}-object` : `/${args.platform}-object/insights`,
      source_metric: sourceMetric, api_version: args.apiVersion, token_class: args.tokenClass,
      period_month: args.periodMonth, period_start: args.periodStart, period_end: args.periodEnd,
      metric_type: probe.metricType, response_shape: probe.responseShape,
      value: probe.value, availability: probe.availability,
      error_code: probe.error?.code ?? null, error_subcode: probe.error?.subcode ?? null,
      error_message: probe.error ? redact(probe.error.message, args.tokens) : null, trace_id: probe.error?.trace ?? null,
      raw_snapshot: safeSnapshot, retrieved_at: retrievedAt,
    }).select('id').single()
    if (snapshotError || !snapshotRow?.id) {
      throw new Error(`Failed to persist ${args.platform}/${spec.metricKey} snapshot: ${snapshotError?.message ?? 'missing snapshot id'} (${snapshotError?.code ?? 'unknown'})`)
    }

    // 3. Normalized fact (preserve-verified on failure).
    await upsertMonthlyFact(sb, {
      clientId: args.clientId, assetId: args.assetId, platform: args.platform,
      periodMonth: args.periodMonth, periodStart: args.periodStart, periodEnd: args.periodEnd,
      metricKey: spec.metricKey, sourceMetric, value: probe.value, availability: probe.availability,
      includesPaid: spec.includesPaid, aggregation, comparableGroup: spec.comparableGroup,
      apiVersion: args.apiVersion, sourceTimezone: META_INSIGHTS_TIMEZONE,
      provenance: {
        endpoint: spec.mode, token_class: args.tokenClass, response_shape: probe.responseShape,
        snapshot_id: snapshotRow.id, sync_run_id: syncRunId, retrieved_at: retrievedAt,
        error_code: probe.error?.code ?? null,
      },
      syncRunId,
    })

      facts[spec.metricKey] = { value: probe.value, availability: probe.availability, sourceMetric }
    }
  } catch (error) {
    const safeError = redact(error instanceof Error ? error.message : String(error), args.tokens)
    const { error: failureUpdateError } = await sb.from('platform_sync_runs').update({
      status: 'failed',
      health_state: 'sync_error',
      finished_at: new Date().toISOString(),
      summary: {
        facts,
        connector: META_CONNECTOR_VERSION,
        graph_version: args.apiVersion,
        persistence_error: safeError,
      },
    }).eq('id', syncRunId)
    if (failureUpdateError) {
      throw new Error(`${safeError}; failed to mark sync run failed: ${failureUpdateError.message} (${failureUpdateError.code ?? 'unknown'})`)
    }
    throw new Error(safeError)
  }

  // 4. Finalize run health.
  const states = probes.map(probe => probe.availability)
  const hasDefinitive = states.some(state => DEFINITIVE.includes(state))
  const hasPartial = states.includes('partial')
  const hasError = states.includes('error')
  const hasPermissionBlock = states.includes('permission_blocked')
  const allDefinitive = states.length > 0 && states.every(state => DEFINITIVE.includes(state))
  const healthState = allDefinitive
    ? 'verified'
    : (hasDefinitive || hasPartial)
      ? 'verified_partial'
      : hasError
        ? 'sync_error'
        : hasPermissionBlock
          ? 'permission_blocked'
          : 'sync_error'
  const status = allDefinitive ? 'success' : (hasDefinitive || hasPartial) ? 'partial' : 'failed'
  const { error: runUpdateError } = await sb.from('platform_sync_runs').update({
    status, health_state: healthState, finished_at: new Date().toISOString(),
    summary: {
      facts,
      connector: META_CONNECTOR_VERSION,
      graph_version: args.apiVersion,
    },
  }).eq('id', syncRunId)
  if (runUpdateError) {
    throw new Error(`Failed to finalize ${args.platform} sync run: ${runUpdateError.message} (${runUpdateError.code ?? 'unknown'})`)
  }

  return { platform: args.platform, syncRunId, healthState, probes, facts }
}
