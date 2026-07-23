import type { Availability, PlatformFact } from '../overviewModel'

// Shared normalized fact shape. Database access is intentionally implemented in
// reportingTruth.ts through report-bound RPCs so clients cannot query draft
// months or connector metadata directly.
export interface PlatformMetricFactShape {
  platform: string
  period_month: string
  period_start: string
  period_end: string
  metric_key: string
  source_metric: string | null
  value: number | null
  availability: Availability
  includes_paid: string | null
  aggregation: string | null
  comparable_group: string | null
}

export function rowToFact(row: PlatformMetricFactShape): PlatformFact {
  return {
    platform: row.platform,
    metricKey: row.metric_key,
    sourceMetric: row.source_metric,
    value: row.value,
    availability: row.availability,
    includesPaid: row.includes_paid,
    aggregation: row.aggregation,
    comparableGroup: row.comparable_group,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  }
}
