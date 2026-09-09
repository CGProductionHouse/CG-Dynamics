// Interpret the returned provider shape, never the shape requested in the URL.
export interface InsightResult {
  value: number | null
  responseShape: 'total_value' | 'time_series' | 'empty'
  reason: string | null
}

export function parseMetaInsight(
  data: unknown,
  metric: string,
  allowDailySum: boolean,
  valueKey?: string,
  expectedDailyEnds?: number[],
): InsightResult {
  const unknown = (reason: string, responseShape: InsightResult['responseShape'] = 'empty'): InsightResult => ({ value: null, responseShape, reason })
  if (!Array.isArray(data)) return unknown('missing_metric_data')
  const matches = data.filter(row => row?.name === metric)
  if (matches.length !== 1) return unknown('missing_or_ambiguous_metric')
  const row = matches[0]
  const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
  if (row.total_value) {
    // A combined total cannot substitute for one requested breakdown component.
    if (valueKey) {
      const aliases: Record<string, string[]> = {
        follows: ['FOLLOWER', 'FOLLOW', 'FOLLOWS'],
        unfollows: ['NON_FOLLOWER', 'UNFOLLOW', 'UNFOLLOWS'],
      }
      const labels = aliases[valueKey] ?? [valueKey.toUpperCase()]
      const values: number[] = []
      for (const breakdown of row.total_value.breakdowns ?? []) {
        const index = breakdown.dimension_keys?.indexOf('follow_type')
        if (index === undefined || index < 0) continue
        for (const result of breakdown.results ?? []) {
          if (labels.includes(String(result.dimension_values?.[index]).toUpperCase()) && numeric(result.value)) values.push(result.value)
        }
      }
      if (values.length === 1) return { value: values[0], responseShape: 'total_value', reason: null }
      return unknown('missing_or_ambiguous_breakdown', 'total_value')
    }
    if (numeric(row.total_value.value)) return { value: row.total_value.value, responseShape: 'total_value', reason: null }
    return unknown('missing_numeric_total', 'total_value')
  }
  if (Array.isArray(row.values) && row.values.length) {
    if (!allowDailySum) return unknown('daily_unique_series_not_summable', 'time_series')
    if (valueKey) return unknown('missing_breakdown', 'time_series')
    if (row.period !== 'day') return unknown('unexpected_series_period', 'time_series')
    const ends = row.values.map((entry: { end_time?: string }) => Date.parse(entry.end_time ?? ''))
    if (ends.some((end: number) => !Number.isFinite(end)) || new Set(ends).size !== ends.length) return unknown('invalid_or_duplicate_daily_bucket', 'time_series')
    if (expectedDailyEnds && (ends.length !== expectedDailyEnds.length || ends.some((end: number) => !expectedDailyEnds.includes(end)))) {
      return unknown('incomplete_or_out_of_range_daily_coverage', 'time_series')
    }
    if (!row.values.every((entry: { value?: unknown }) => numeric(entry.value))) return unknown('incomplete_numeric_series', 'time_series')
    return { value: row.values.reduce((sum: number, entry: { value: number }) => sum + entry.value, 0), responseShape: 'time_series', reason: null }
  }
  return unknown('empty_provider_response')
}
