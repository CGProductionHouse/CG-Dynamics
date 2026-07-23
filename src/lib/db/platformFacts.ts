import { supabase } from '../supabase'
import type { Availability, PlatformFact } from '../overviewModel'

// Row shape from platform_metric_facts_monthly (phase-20d).
export interface PlatformMetricFactRow {
  id: string
  client_id: string
  platform: string
  period_month: string
  metric_key: string
  source_metric: string | null
  value: number | null
  availability: Availability
  includes_paid: string | null
  aggregation: string | null
  comparable_group: string | null
  api_version: string | null
  connector_version: string | null
  source_timezone: string | null
  verified_at: string | null
}

export function rowToFact(row: PlatformMetricFactRow): PlatformFact {
  return {
    platform: row.platform,
    metricKey: row.metric_key,
    value: row.value,
    availability: row.availability,
    comparableGroup: row.comparable_group,
    aggregation: row.aggregation,
    includesPaid: row.includes_paid,
    sourceMetric: row.source_metric,
  }
}

// Loads normalized monthly facts for a client + month ('YYYY-MM'). RLS scopes
// this to staff; client-facing routes fetch through server-mediated queries.
export async function listPlatformFactsForClientMonth(clientId: string, month: string) {
  const { data, error } = await supabase
    .from('platform_metric_facts_monthly')
    .select('id, client_id, platform, period_month, metric_key, source_metric, value, availability, includes_paid, aggregation, comparable_group, api_version, connector_version, source_timezone, verified_at')
    .eq('client_id', clientId)
    .eq('period_month', month)

  const rows = (data ?? []) as PlatformMetricFactRow[]
  return { rows, facts: rows.map(rowToFact), error }
}

// Latest sync run per client/platform — powers the admin data-health panel.
export async function listRecentSyncRuns(clientId: string) {
  const { data, error } = await supabase
    .from('platform_sync_runs')
    .select('platform, period_month, status, health_state, api_version, connector_version, finished_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  return { data: data ?? [], error }
}
