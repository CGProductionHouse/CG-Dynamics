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
// One controlled server-side source. The version is NEVER silently assumed:
//  • an explicit META_GRAPH_VERSION override must be a supported version, else we
//    fail fast with a clear configuration error (no obsolete silent fallback);
//  • when unset we use DEFAULT_GRAPH_VERSION, and expose `configured: false` so
//    connector health can flag that the production version is still the default
//    pending confirmation.
// The exact production version is confirmed against Meta Developers by Codex; the
// code refuses to run on an unrecognised/typo'd version.
export const SUPPORTED_GRAPH_VERSIONS = ['v21.0', 'v22.0', 'v23.0', 'v24.0'] as const
// Last version verified working for this app's post + insight sync. Codex confirms
// / bumps this against the live Meta app configuration and sets the secret.
const DEFAULT_GRAPH_VERSION = 'v22.0'

export function resolveGraphVersion(): { version: string; configured: boolean } {
  const raw = (Deno.env.get('META_GRAPH_VERSION') ?? '').trim()
  if (raw) {
    if (!/^v\d+\.\d+$/.test(raw) || !SUPPORTED_GRAPH_VERSIONS.includes(raw as typeof SUPPORTED_GRAPH_VERSIONS[number])) {
      throw new Error(
        `META_GRAPH_VERSION "${raw}" is not a supported Meta Graph API version ` +
        `(supported: ${SUPPORTED_GRAPH_VERSIONS.join(', ')}). Refusing to run on an unverified version.`,
      )
    }
    return { version: raw, configured: true }
  }
  return { version: DEFAULT_GRAPH_VERSION, configured: false }
}

const RESOLVED_GRAPH = resolveGraphVersion()
export const META_GRAPH_VERSION = RESOLVED_GRAPH.version
export const META_GRAPH_VERSION_CONFIGURED = RESOLVED_GRAPH.configured
export const META_CONNECTOR_VERSION = 'meta-connector-v2'

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
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

// ── fetch with timeout + bounded retry/backoff on transient failures ─────────
const RETRYABLE = new Set([429, 500, 502, 503, 504])
const BACKOFF = [500, 1200]

export async function metaFetch(url: string, timeoutMs = 12_000): Promise<Response> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok || !RETRYABLE.has(res.status)) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
    }
    if (attempt < BACKOFF.length) await new Promise(r => setTimeout(r, BACKOFF[attempt]))
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
  if (code === '100' && (sub === '33' || msg.includes('nonexisting') || msg.includes('does not support') || msg.includes('unsupported') || msg.includes('deprecat'))) {
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
function parseInsight(data: Array<Record<string, unknown>>): number | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const d = data[0]
  const total = d.total_value as { value?: unknown } | undefined
  if (total && typeof total.value === 'number') return total.value
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
}

// Facebook Page account-level candidates (Business-Suite-aligned).
export const FB_ACCOUNT_METRICS: MetricSpec[] = [
  { metricKey: 'brand_views', sourceMetric: 'page_impressions', mode: 'total_value', allowPeriodDayFallback: true, includesPaid: 'both', aggregation: 'sum', comparableGroup: 'fb_views_v1' },
  { metricKey: 'unique_viewers', sourceMetric: 'page_impressions_unique', mode: 'total_value', includesPaid: 'both', aggregation: 'unique', comparableGroup: 'fb_viewers_v1' },
  { metricKey: 'content_interactions', sourceMetric: 'page_post_engagements', mode: 'total_value', allowPeriodDayFallback: true, includesPaid: 'both', aggregation: 'sum', comparableGroup: 'fb_interactions_v1' },
  { metricKey: 'follows_gained', sourceMetric: 'page_daily_follows_unique', mode: 'period_day_sum', includesPaid: 'organic', aggregation: 'sum', comparableGroup: 'fb_follows_gained_v1' },
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
  { metricKey: 'follows_gained', sourceMetric: 'follower_count', mode: 'period_day_sum', includesPaid: 'organic', aggregation: 'sum', comparableGroup: 'ig_follows_gained_v1' },
  { metricKey: 'current_followers', sourceMetric: 'followers_count', mode: 'ig_field', includesPaid: 'organic', aggregation: 'snapshot', comparableGroup: 'ig_followers_snapshot_v1' },
]

export interface MetricProbe {
  metricKey: string
  sourceMetric: string
  platform: string
  value: number | null
  availability: Availability
  responseShape: string
  metricType: string
  error?: MetaErrorInfo
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
      const v = typeof body[spec.sourceMetric] === 'number'
        ? body[spec.sourceMetric]
        : (spec.fallbackField && typeof body[spec.fallbackField] === 'number' ? body[spec.fallbackField] : null)
      return { ...base, value: v, availability: classifyValue(v), responseShape: 'field', metricType: 'field' }
    } catch (e) {
      return { ...base, value: null, availability: 'error', responseShape: 'error', metricType: 'field', error: { code: null, subcode: null, message: redact(String(e), tokens), type: null, trace: null } }
    }
  }

  // Insights metrics: try the primary shape, then (additive only) a period=day sum.
  const attempts: Array<{ metricType: string; qs: string }> = []
  if (spec.mode === 'total_value') {
    attempts.push({ metricType: 'total_value', qs: `metric=${spec.sourceMetric}&metric_type=total_value&period=day&since=${since}&until=${until}` })
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
      const value = parseInsight(body.data as Array<Record<string, unknown>>)
      if (value !== null) {
        return { ...base, value, availability: classifyValue(value), responseShape: attempt.metricType, metricType: attempt.metricType }
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
  const { data: existing } = await sb
    .from('platform_metric_facts_monthly')
    .select('id, availability')
    .eq('client_id', fact.clientId)
    .eq('platform', fact.platform)
    .eq('period_month', fact.periodMonth)
    .eq('metric_key', fact.metricKey)
    .limit(1)

  const incomingDefinitive = DEFINITIVE.includes(fact.availability)
  const row = {
    client_id: fact.clientId, asset_id: fact.assetId, platform: fact.platform,
    period_month: fact.periodMonth, period_start: fact.periodStart, period_end: fact.periodEnd,
    metric_key: fact.metricKey, source_metric: fact.sourceMetric,
    value: fact.value, availability: fact.availability,
    includes_paid: fact.includesPaid, aggregation: fact.aggregation,
    comparable_group: fact.comparableGroup, api_version: fact.apiVersion,
    connector_version: META_CONNECTOR_VERSION, source_timezone: fact.sourceTimezone,
    provenance: fact.provenance, sync_run_id: fact.syncRunId, verified_at: new Date().toISOString(),
  }

  if (existing && existing.length > 0) {
    const prevVerified = DEFINITIVE.includes(existing[0].availability as Availability)
    if (!incomingDefinitive && prevVerified) {
      return 'kept_verified' // preserve last verified dataset
    }
    await sb.from('platform_metric_facts_monthly').update(row).eq('id', existing[0].id)
    return 'updated'
  }
  await sb.from('platform_metric_facts_monthly').insert(row)
  return 'inserted'
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
    reconstructInteractions?: number | null // fallback FB content interactions from post sums
  },
): Promise<AccountFactsResult> {
  const specs = args.platform === 'facebook' ? FB_ACCOUNT_METRICS : IG_ACCOUNT_METRICS

  // 1. Open a sync run row.
  const { data: runRow } = await sb.from('platform_sync_runs').insert({
    client_id: args.clientId, asset_id: args.assetId, connection_id: args.connectionId,
    platform: args.platform, run_type: 'manual', period_month: args.periodMonth,
    period_start: args.periodStart, period_end: args.periodEnd,
    api_version: args.apiVersion, connector_version: META_CONNECTOR_VERSION,
    token_class: args.tokenClass, requested_bounds: { since: args.periodStart, until: args.periodEnd },
    business_timezone: 'Africa/Johannesburg', status: 'success', health_state: 'verified',
    started_at: new Date().toISOString(),
  }).select('id').single()
  const syncRunId = (runRow?.id as string) ?? null

  const probes: MetricProbe[] = []
  const facts: AccountFactsResult['facts'] = {}
  let anyPermissionBlock = false
  let anyComplete = false
  let anyUnavailable = false

  for (const spec of specs) {
    let probe = await probeMetric(args.baseUrl, args.objectId, args.token, args.platform, spec, args.periodStart, args.periodEnd, args.tokens)

    // FB content interactions fallback: reconstruct from post engagement sums when
    // the Page metric is unavailable. Stored as reconstructed, never claimed as
    // Business Suite parity.
    let sourceMetric = spec.sourceMetric
    let aggregation = spec.aggregation
    if (args.platform === 'facebook' && spec.metricKey === 'content_interactions'
        && probe.availability !== 'complete' && typeof args.reconstructInteractions === 'number' && args.reconstructInteractions > 0) {
      probe = { ...probe, value: args.reconstructInteractions, availability: 'partial', responseShape: 'reconstructed_sum', metricType: 'reconstructed' }
      sourceMetric = 'reconstructed_post_engagements'
      aggregation = 'reconstructed'
    }

    probes.push(probe)
    if (probe.availability === 'permission_blocked') anyPermissionBlock = true
    if (probe.availability === 'complete') anyComplete = true
    if (probe.availability === 'unavailable') anyUnavailable = true

    // 2. Provenance snapshot for every attempt (definitive or not).
    await sb.from('platform_metric_snapshots').insert({
      sync_run_id: syncRunId, client_id: args.clientId, asset_id: args.assetId, platform: args.platform,
      source_endpoint: spec.mode === 'page_field' || spec.mode === 'ig_field' ? `/${args.platform}-object` : `/${args.platform}-object/insights`,
      source_metric: sourceMetric, api_version: args.apiVersion, token_class: args.tokenClass,
      period_month: args.periodMonth, period_start: args.periodStart, period_end: args.periodEnd,
      metric_type: probe.metricType, response_shape: probe.responseShape,
      value: probe.value, availability: probe.availability,
      error_code: probe.error?.code ?? null, error_subcode: probe.error?.subcode ?? null,
      error_message: probe.error?.message ?? null, trace_id: probe.error?.trace ?? null,
      raw_snapshot: null, retrieved_at: new Date().toISOString(),
    })

    // 3. Normalized fact (preserve-verified on failure).
    await upsertMonthlyFact(sb, {
      clientId: args.clientId, assetId: args.assetId, platform: args.platform,
      periodMonth: args.periodMonth, periodStart: args.periodStart, periodEnd: args.periodEnd,
      metricKey: spec.metricKey, sourceMetric, value: probe.value, availability: probe.availability,
      includesPaid: spec.includesPaid, aggregation, comparableGroup: spec.comparableGroup,
      apiVersion: args.apiVersion, sourceTimezone: null,
      provenance: {
        endpoint: spec.mode, token_class: args.tokenClass, response_shape: probe.responseShape,
        sync_run_id: syncRunId, retrieved_at: new Date().toISOString(),
        error_code: probe.error?.code ?? null,
      },
      syncRunId,
    })

    facts[spec.metricKey] = { value: probe.value, availability: probe.availability, sourceMetric }
  }

  // 4. Finalize run health.
  const healthState = anyPermissionBlock
    ? 'permission_blocked'
    : anyComplete && anyUnavailable
      ? 'verified_partial'
      : anyComplete
        ? 'verified'
        : 'sync_error'
  const status = anyComplete ? (anyUnavailable || anyPermissionBlock ? 'partial' : 'success') : 'failed'
  if (syncRunId) {
    await sb.from('platform_sync_runs').update({
      status, health_state: healthState, finished_at: new Date().toISOString(),
      summary: {
        facts,
        connector: META_CONNECTOR_VERSION,
        graph_version: args.apiVersion,
        graph_version_configured: META_GRAPH_VERSION_CONFIGURED,
      },
    }).eq('id', syncRunId)
  }

  return { platform: args.platform, syncRunId, healthState, probes, facts }
}
