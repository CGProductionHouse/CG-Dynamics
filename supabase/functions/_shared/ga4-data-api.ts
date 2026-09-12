// ga4-data-api.ts — GA4 Data API (v1beta) request/response helpers for #335.
// Pure and import-free apart from the contract types, so the request shapes and parsing are unit
// tested without Deno and without calling Google. The Edge Function stays a thin auth+fetch shell.
//
// Property identity is ALWAYS a numeric property id resolved from client_ga4_properties for the
// exact client_id. There is deliberately no property-name lookup anywhere in this module: a name
// search is exactly the fuzzy matching #335 forbids.

import type { Ga4JoinDecision, Ga4Metadata } from './ga4-contract.ts'

export const GA4_DATA_API_ROOT = 'https://analyticsdata.googleapis.com/v1beta'

/** GA4 property ids are numeric. Anything else is rejected rather than sent to Google. */
export function normalizeGa4PropertyId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim().replace(/^properties\//i, '')
  return /^\d{6,20}$/.test(raw) ? raw : null
}

export function ga4MetadataUrl(propertyId: string): string {
  return `${GA4_DATA_API_ROOT}/properties/${propertyId}/metadata`
}

export function ga4RunReportUrl(propertyId: string): string {
  return `${GA4_DATA_API_ROOT}/properties/${propertyId}:runReport`
}

/** Extract the property's actual supported field names from a getMetadata response. */
export function parseGa4Metadata(payload: unknown): Ga4Metadata {
  const root = (payload ?? {}) as Record<string, unknown>
  const names = (value: unknown): string[] => Array.isArray(value)
    ? value
      .map(entry => (entry as Record<string, unknown> | null)?.apiName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
    : []
  return { dimensions: names(root.dimensions), metrics: names(root.metrics) }
}

/** GA4 reports in the property timezone; surfaced so Ads↔GA4 period differences can be explained. */
export function parseGa4PropertyTimeZone(payload: unknown): string | null {
  const tz = ((payload ?? {}) as Record<string, unknown>).timeZone
  return typeof tz === 'string' && tz.trim() !== '' ? tz.trim() : null
}

// ── request building ────────────────────────────────────────────────────────

export interface Ga4DateRange { startDate: string; endDate: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
export function validGa4Date(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value)
}

/** Google paid mediums. Deliberately narrow so organic google traffic can never be included. */
export const GOOGLE_PAID_MEDIUMS = ['cpc', 'ppc', 'paid'] as const
const PAID_SOURCE_MEDIUMS = GOOGLE_PAID_MEDIUMS.map(medium => `google / ${medium}`)

type FilterExpression = Record<string, unknown>

/**
 * Build the dimension filter that isolates ONE exact Google Ads campaign's paid sessions.
 *
 * With the Google Ads campaign dimension the campaign id alone is unambiguous. With the generic
 * sessionCampaignId fallback the campaign id must be combined with a paid source/medium filter,
 * because that dimension also carries utm_campaign values from non-Ads traffic.
 */
export function buildPaidCampaignFilter(
  join: Ga4JoinDecision,
  campaignId: string,
): FilterExpression | null {
  if (join.strategy === 'unavailable') return null
  if (!/^\d{1,20}$/.test(campaignId)) return null

  const exact = (fieldName: string, value: string): FilterExpression => ({
    filter: { fieldName, stringFilter: { matchType: 'EXACT', value, caseSensitive: false } },
  })
  const inList = (fieldName: string, values: readonly string[]): FilterExpression => ({
    filter: { fieldName, inListFilter: { values: [...values], caseSensitive: false } },
  })

  if (join.strategy === 'google-ads-campaign-id') {
    return exact('sessionGoogleAdsCampaignId', campaignId)
  }

  const expressions: FilterExpression[] = [exact('sessionCampaignId', campaignId)]
  if (join.dimensions.includes('sessionSourceMedium')) {
    expressions.push(inList('sessionSourceMedium', PAID_SOURCE_MEDIUMS))
  } else {
    expressions.push(exact('sessionSource', 'google'))
    expressions.push(inList('sessionMedium', GOOGLE_PAID_MEDIUMS))
  }
  return { andGroup: { expressions } }
}

export interface Ga4ReportRequestInput {
  range: Ga4DateRange
  join: Ga4JoinDecision
  campaignId: string
  /** Already validated against the property's metadata. */
  dimensions: string[]
  metrics: string[]
  limit?: number
}

/**
 * Build a runReport body. Returns null when the request could not be made truthfully — an invalid
 * date, an unusable join, or no supported metric — so the caller reports unavailable instead of
 * sending a request that would produce a misleading empty result.
 */
export function buildGa4ReportRequest(input: Ga4ReportRequestInput): Record<string, unknown> | null {
  if (!validGa4Date(input.range?.startDate) || !validGa4Date(input.range?.endDate)) return null
  if (input.range.endDate < input.range.startDate) return null
  if (!Array.isArray(input.metrics) || input.metrics.length === 0) return null

  const dimensionFilter = buildPaidCampaignFilter(input.join, input.campaignId)
  if (dimensionFilter === null) return null

  return {
    dateRanges: [{ startDate: input.range.startDate, endDate: input.range.endDate }],
    dimensions: (input.dimensions ?? []).map(name => ({ name })),
    metrics: input.metrics.map(name => ({ name })),
    dimensionFilter,
    limit: typeof input.limit === 'number' && input.limit > 0 ? Math.min(input.limit, 1000) : 100,
    keepEmptyRows: false,
  }
}

// ── response parsing ────────────────────────────────────────────────────────

export interface Ga4Row {
  dimensions: Record<string, string>
  metrics: Record<string, number | null>
}

function headerNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map(entry => (entry as Record<string, unknown> | null)?.name)
      .filter((name): name is string => typeof name === 'string')
    : []
}

/** A metric that is absent or non-numeric becomes null, never 0. */
function metricNumber(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseGa4ReportRows(payload: unknown): Ga4Row[] {
  const root = (payload ?? {}) as Record<string, unknown>
  const dimensionHeaders = headerNames(root.dimensionHeaders)
  const metricHeaders = headerNames(root.metricHeaders)
  const rawRows = Array.isArray(root.rows) ? root.rows : []

  return rawRows.map(rawRow => {
    const row = (rawRow ?? {}) as Record<string, unknown>
    const dimensionValues = Array.isArray(row.dimensionValues) ? row.dimensionValues : []
    const metricValues = Array.isArray(row.metricValues) ? row.metricValues : []
    const dimensions: Record<string, string> = {}
    const metrics: Record<string, number | null> = {}
    dimensionHeaders.forEach((name, index) => {
      const cell = (dimensionValues[index] ?? {}) as Record<string, unknown>
      dimensions[name] = typeof cell.value === 'string' ? cell.value : ''
    })
    metricHeaders.forEach((name, index) => {
      const cell = (metricValues[index] ?? {}) as Record<string, unknown>
      metrics[name] = metricNumber(cell.value)
    })
    return { dimensions, metrics }
  })
}

/** Sum one metric across rows. Returns null when NO row supplied it, so absent stays absent. */
export function sumGa4Metric(rows: Ga4Row[], metricName: string): number | null {
  let total = 0
  let seen = false
  for (const row of rows) {
    const value = row.metrics?.[metricName]
    if (value === null || value === undefined) continue
    total += value
    seen = true
  }
  return seen ? total : null
}

/** Weighted rate recomputation is unsafe across rows; only a single-row rate is trusted. */
export function singleRowGa4Metric(rows: Ga4Row[], metricName: string): number | null {
  if (rows.length !== 1) return null
  const value = rows[0]?.metrics?.[metricName]
  return value === undefined ? null : value
}
