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
  const { data, error } = await supabase.rpc('get_report_metric_facts', {
    p_report_id: reportId,
  })
  return { data: (data ?? []) as ReportMetricFact[], error }
}

export async function loadReportPlatformFacts(reportId: string, currentMonth: string, previousMonth: string | null) {
  const [result, statusResult] = await Promise.all([
    loadReportMetricFacts(reportId),
    supabase.rpc('get_report_metric_fact_status', { p_report_id: reportId }),
  ])
  const rows = result.data
  const status = ((statusResult.data ?? [])[0] ?? null) as ReportMetricFactStatus | null
  return {
    facts: rows.filter(row => row.period_month === currentMonth).map(rowToFact),
    previousFacts: previousMonth
      ? rows.filter(row => row.period_month === previousMonth).map(rowToFact)
      : [],
    normalizedAttempted: status?.normalized_attempted === true,
    readyFactCount: Number(status?.ready_fact_count ?? 0),
    error: result.error ?? statusResult.error,
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
