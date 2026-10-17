import { supabase } from '../supabase'
import type { Availability } from '../overviewModel'
import { rowToFact, type PlatformMetricFactShape } from './platformFacts'

export interface ReportMetricFact extends PlatformMetricFactShape {
  platform: string
  period_month: string
  period_start: string
  period_end: string
  metric_key: string
  source_metric: string | null
  value: number | null
  availability: Availability
  includes_paid: string
  aggregation: string | null
  comparable_group: string | null
}

export interface ReportFactHealth {
  period_month: string
  platform: string
  attempted: boolean
  successful: boolean
  latest_run_status: string | null
  latest_health_state: string | null
  latest_attempted_at: string | null
  last_successful_at: string | null
  api_version: string | null
  connector_version: string | null
  metric_key: string | null
  fact_value: number | null
  fact_availability: Availability | null
  source_metric: string | null
  aggregation: string | null
  comparable_group: string | null
  includes_paid: string | null
  fact_verified_at: string | null
  permission_blocked: boolean
  partial_error_or_stale: boolean
  comparison_eligible: boolean
  safe_reference: string | null
  ready_for_client_reporting: boolean
}

export interface ReportContentExclusion {
  platform: string
  meta_object_id: string
  excluded: boolean
}

interface ReportMetricFactStatus {
  normalized_attempted: boolean
  current_fact_count: number
  ready_fact_count: number
}

const FACTS_UNAVAILABLE = { message: 'Verified reporting facts could not be loaded safely.' }
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const nonnegativeCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function realDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function projectReportFacts(data: unknown): ReportMetricFact[] | null {
  if (!Array.isArray(data)) return null
  const rows: ReportMetricFact[] = []
  for (const row of data) {
    if (!record(row) || typeof row.platform !== 'string' || !row.platform.trim()
      || typeof row.metric_key !== 'string' || !row.metric_key.trim()
      || typeof row.period_month !== 'string' || !MONTH.test(row.period_month)
      || !realDate(row.period_start) || !realDate(row.period_end) || row.period_end < row.period_start
      || !(row.value === null || (typeof row.value === 'number' && Number.isFinite(row.value)))
      || !['complete', 'valid_zero', 'unavailable', 'permission_blocked', 'partial', 'error', 'stale'].includes(row.availability as string)
      || !['organic', 'paid', 'both', 'unknown'].includes(row.includes_paid as string)
      || !['source_metric', 'aggregation', 'comparable_group'].every(key => row[key] === null || typeof row[key] === 'string')) return null
    rows.push({
      platform: row.platform, period_month: row.period_month, period_start: row.period_start, period_end: row.period_end,
      metric_key: row.metric_key, value: row.value, availability: row.availability as Availability,
      includes_paid: row.includes_paid as string, source_metric: row.source_metric as string | null,
      aggregation: row.aggregation as string | null, comparable_group: row.comparable_group as string | null,
    })
  }
  return rows
}

function projectReportFactStatus(data: unknown): ReportMetricFactStatus | null {
  // The existing aggregate RPC returns exactly one row, even for a genuine
  // legacy report. A missing row is not proof that normalized sync never ran.
  if (!Array.isArray(data) || data.length !== 1 || !record(data[0])) return null
  const row = data[0]
  if (typeof row.normalized_attempted !== 'boolean' || !nonnegativeCount(row.current_fact_count)
    || !nonnegativeCount(row.ready_fact_count) || row.ready_fact_count > row.current_fact_count
    || (!row.normalized_attempted && row.current_fact_count !== 0)) return null
  return { normalized_attempted: row.normalized_attempted, current_fact_count: row.current_fact_count, ready_fact_count: row.ready_fact_count }
}

export interface SetReportContentExclusionInput {
  reportId: string
  clientId: string
  postId: string
  platform: string
  metaObjectId: string
  excluded: boolean
  reason?: string | null
}

export async function loadReportMetricFacts(reportId: string) {
  try {
    const { data, error } = await supabase.rpc('get_report_metric_facts', { p_report_id: reportId })
    const rows = projectReportFacts(data)
    return error || !rows ? { data: [], error: FACTS_UNAVAILABLE } : { data: rows, error: null }
  } catch {
    return { data: [], error: FACTS_UNAVAILABLE }
  }
}

export async function loadReportPlatformFacts(reportId: string, currentMonth: string, previousMonth: string | null) {
  const unavailable = { facts: [], previousFacts: [], normalizedAttempted: false, readyFactCount: 0, error: FACTS_UNAVAILABLE }
  try {
    const [result, statusResult] = await Promise.all([
      loadReportMetricFacts(reportId),
      supabase.rpc('get_report_metric_fact_status', { p_report_id: reportId }),
    ])
    const status = projectReportFactStatus(statusResult.data)
    if (result.error || statusResult.error || !status) return unavailable
    const rows = result.data
    return {
      facts: rows.filter(row => row.period_month === currentMonth).map(rowToFact),
      previousFacts: previousMonth
        ? rows.filter(row => row.period_month === previousMonth).map(rowToFact)
        : [],
      normalizedAttempted: status.normalized_attempted,
      readyFactCount: status.ready_fact_count,
      error: null,
    }
  } catch {
    return unavailable
  }
}

// Technical sync state and provider source details are available to staff only.
export async function loadReportFactHealth(reportId: string) {
  const { data, error } = await supabase.rpc('get_report_fact_health', {
    p_report_id: reportId,
  })
  return { data: (data ?? []) as ReportFactHealth[], error }
}

export async function loadReportContentExclusions(reportId: string) {
  const { data, error } = await supabase.rpc('get_report_content_exclusions', {
    p_report_id: reportId,
  })
  return { data: (data ?? []) as ReportContentExclusion[], error }
}

export async function setReportContentExclusion(input: SetReportContentExclusionInput) {
  const { data, error } = await supabase.rpc('set_report_content_exclusion', {
    p_report_id: input.reportId,
    p_client_id: input.clientId,
    p_post_id: input.postId,
    p_platform: input.platform,
    p_meta_object_id: input.metaObjectId,
    p_excluded: input.excluded,
    p_reason: input.reason ?? null,
  })
  return { data: ((data ?? [])[0] ?? null) as ReportContentExclusion | null, error }
}
