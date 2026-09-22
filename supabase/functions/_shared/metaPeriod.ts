export const META_INSIGHTS_TIMEZONE = 'America/Los_Angeles'

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
    // Insights treats `until` as an inclusive report date and returns the daily
    // bucket ending on the following midnight.
    until: String(zonedStartEpoch(periodEnd, META_INSIGHTS_TIMEZONE)),
  }
}

export function metaPostBounds(periodStart: string, periodEnd: string): { since: string; until: string } {
  return {
    since: String(zonedStartEpoch(periodStart, META_INSIGHTS_TIMEZONE)),
    until: String(zonedStartEpoch(addUtcDays(periodEnd, 1), META_INSIGHTS_TIMEZONE)),
  }
}

export function metaProviderPeriod(periodStart: string, periodEnd: string): {
  timezone: typeof META_INSIGHTS_TIMEZONE
  start: string
  endExclusive: string
} {
  const bounds = metaPostBounds(periodStart, periodEnd)
  return {
    timezone: META_INSIGHTS_TIMEZONE,
    start: new Date(Number(bounds.since) * 1000).toISOString(),
    endExclusive: new Date(Number(bounds.until) * 1000).toISOString(),
  }
}

export function isWithinMetaProviderPeriod(timestamp: string, periodStart: string, periodEnd: string): boolean {
  const time = Date.parse(timestamp)
  const period = metaProviderPeriod(periodStart, periodEnd)
  return Number.isFinite(time) && time >= Date.parse(period.start) && time < Date.parse(period.endExclusive)
}

// Returns the current Meta calendar month (YYYY-MM) in America/Los_Angeles.
// This is the canonical month for Meta provider-period membership and
// incremental/reconciliation scheduling. Must NOT use UTC month arithmetic.
export function currentMetaMonth(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: META_INSIGHTS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  return `${year}-${month}`
}

// Returns the previous completed Meta calendar month (YYYY-MM) in America/Los_Angeles.
// Uses the canonical Meta provider calendar, not UTC.
export function previousMetaMonth(offset = 1): string {
  const now = new Date()
  // Get current month in Meta timezone, then subtract offset months
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: META_INSIGHTS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  let year = Number(parts.find(p => p.type === 'year')?.value ?? '0')
  let month = Number(parts.find(p => p.type === 'month')?.value ?? '0')
  month -= offset
  while (month <= 0) {
    month += 12
    year -= 1
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

// Returns the latest completed Meta reporting date (YYYY-MM-DD) for incremental
// month-to-date work. This is yesterday in America/Los_Angeles: Meta's daily
// insight buckets have a ~24h reporting lag, so today's bucket is not yet
// available when the scheduler runs. Using yesterday avoids requesting future
// daily buckets that cannot exist, which would cause
// incomplete_or_out_of_range_daily_coverage rejections.
//
// This is intentionally NOT a completed month. Month-to-date facts are presented
// as partial and must never be treated as a fully completed period.
export function incrementalMonthEnd(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: META_INSIGHTS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )
  const today = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  return addUtcDays(today, -1)
}

// Returns the provider window bounds for current-month incremental work, or
// null when no completed reporting day exists yet in the current month.
//
// On the 1st of a month, incrementalMonthEnd() returns the last day of the
// previous month. Clamping that to month-01 would fabricate a completed
// reporting bucket for a day that has not finished yet. Instead, returning
// null signals that current-month incremental work is not yet eligible.
//
// On the 2nd+, periodStart = month-01, periodEnd = yesterday (latest completed
// Meta reporting date). This prevents the worker from expecting future daily
// buckets while still covering all available month-to-date data.
//
// The canonical period_month remains the full current month — these bounds
// control only the insight/probe window, not the monthly identity.
export function incrementalMonthBounds(month: string): { periodStart: string; periodEnd: string } | null {
  const end = incrementalMonthEnd()
  const monthPrefix = month.slice(0, 7)
  // If yesterday is in a previous month, no current-month reporting day
  // has completed yet. Do not fabricate month-01.
  if (!end.startsWith(monthPrefix)) return null
  return {
    periodStart: `${month}-01`,
    periodEnd: end,
  }
}

// Returns true when the current Meta month has at least one completed
// reporting day for incremental month-to-date work. Equivalent to
// incrementalMonthBounds(currentMetaMonth()) !== null but avoids
// recomputing the bounds.
export function currentMonthHasIncrementalWindow(): boolean {
  return incrementalMonthBounds(currentMetaMonth()) !== null
}

// Each requested Pacific calendar day must have exactly one ending bucket.
// Calendar arithmetic preserves 23/25-hour days across daylight-saving changes.
export function expectedMetaDailyEnds(since: string, until: string): number[] {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: META_INSIGHTS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  let day = formatter.format(new Date(Number(since) * 1000))
  const last = formatter.format(new Date(Number(until) * 1000))
  const ends: number[] = []
  while (day <= last && ends.length < 367) {
    day = addUtcDays(day, 1)
    ends.push(zonedStartEpoch(day, META_INSIGHTS_TIMEZONE) * 1000)
  }
  return ends
}
