const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

export interface DetectedReportPeriod {
  start: string
  end: string
  source: 'publish_time' | 'filename'
}

function inputDateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseFilenameDate(token: string) {
  const parts = token
    .replace(/\.[^.]+$/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)

  for (let index = 0; index <= parts.length - 3; index += 1) {
    const month = MONTHS[parts[index].toLowerCase()]
    const day = Number(parts[index + 1])
    const year = Number(parts[index + 2])

    if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) continue
    if (day < 1 || day > 31 || year < 1900 || year > 2200) continue

    const parsed = new Date(Date.UTC(year, month, day))
    if (parsed.getUTCMonth() !== month || parsed.getUTCDate() !== day) continue
    return parsed
  }

  return null
}

export function detectReportPeriod(
  publishTimes: Array<string | null | undefined>,
  fileName?: string | null
): DetectedReportPeriod | null {
  const dates = publishTimes
    .map(parseDateValue)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length > 0) {
    return {
      start: inputDateValue(dates[0]),
      end: inputDateValue(dates[dates.length - 1]),
      source: 'publish_time',
    }
  }

  if (!fileName) return null

  const filenameDates = fileName
    .split(/[_\s]+/)
    .map(parseFilenameDate)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (filenameDates.length === 0) return null

  return {
    start: inputDateValue(filenameDates[0]),
    end: inputDateValue(filenameDates[filenameDates.length - 1]),
    source: 'filename',
  }
}

// Manual platform metrics are keyed by calendar month (YYYY-MM). A monthly
// report whose period starts on, say, 30 April still belongs to May, so we
// match manual metrics to the month of the report END date. We read the
// YYYY-MM prefix directly so an invalid day (e.g. 2026-06-31) still resolves
// to a reliable month (2026-06) rather than rolling over.
export function reportMonth(periodEnd: string) {
  const match = /^(\d{4})-(\d{2})/.exec(periodEnd)
  return match ? `${match[1]}-${match[2]}` : periodEnd.slice(0, 7)
}

export function previousReportMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1))
  return date.toISOString().slice(0, 7)
}

export function formatReportPeriod(period: Pick<DetectedReportPeriod, 'start' | 'end'>) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `${formatter.format(new Date(`${period.start}T00:00:00`))} - ${formatter.format(new Date(`${period.end}T00:00:00`))}`
}

// Returns the first and last calendar day of a YYYY-MM month string.
export function calendarMonthBounds(month: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return { start: `${month}-01`, end: `${month}-01` }
  const year = Number(match[1])
  const monthIndex = Number(match[2])
  const end = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10)
  return { start: `${month}-01`, end }
}

// True only when the last day of the month is strictly before today (UTC).
export function isMonthComplete(month: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return false
  const year = Number(match[1])
  const monthIndex = Number(match[2])
  const lastDay = new Date(Date.UTC(year, monthIndex, 0))
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  return lastDay < todayUtc
}

// "May 2026" — long month name + year for display headings.
export function monthDisplayLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month || 'Unknown month'
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00`))
}

// ─── Calendar-month integrity helpers ────────────────────────────────────────
//
// Reports must represent a single full calendar month. Old reports created
// before this rule may carry partial ranges (e.g. 21 May - 10 June). These
// helpers resolve, validate and normalize a report to its intended month.

// Accepts either a "YYYY-MM" month or a full "YYYY-MM-DD" date.
export function getCalendarMonthBounds(value: string): { start: string; end: string } {
  return calendarMonthBounds(value.length > 7 ? value.slice(0, 7) : value)
}

// True when a stored period is exactly the first→last day of one calendar month.
export function isFullCalendarMonth(periodStart: string, periodEnd: string): boolean {
  if (!periodStart || !periodEnd) return false
  const bounds = calendarMonthBounds(periodStart.slice(0, 7))
  return periodStart === bounds.start && periodEnd === bounds.end
}

// True only when the calendar month has fully elapsed (alias of isMonthComplete,
// named for the task's vocabulary).
export function isCompletedMonth(month: string): boolean {
  return isMonthComplete(month)
}

// The calendar month a report belongs to. Derived from period_start so that a
// partial range like 21 May - 10 June resolves to May (the intended month).
export function getReportMonthFromPeriod(report: { period_start: string }): string {
  return report.period_start.slice(0, 7)
}

// Full calendar-month bounds for a report, derived from its intended month.
export function normalizeReportToCalendarMonth(report: { period_start: string }): { month: string; start: string; end: string } {
  const month = getReportMonthFromPeriod(report)
  return { month, ...calendarMonthBounds(month) }
}

// Best-effort export coverage from the CSV filename, e.g.
// "May-01-2026_May-31-2026.csv" or "report_2026-05-01_2026-05-31.csv". Handles
// both textual (Month-Day-Year) and ISO (YYYY-MM-DD) date formats. Returns the
// earliest and latest dates found.
export function detectFilenameDateRange(fileName?: string | null): { start: string; end: string } | null {
  if (!fileName) return null

  const dates: Date[] = []

  // ISO dates anywhere in the name.
  const isoMatches = fileName.match(/\d{4}-\d{2}-\d{2}/g) ?? []
  isoMatches.forEach(iso => {
    const parsed = new Date(`${iso}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime())) dates.push(parsed)
  })

  // Textual Month-Day-Year segments.
  fileName.split(/[_\s]+/).forEach(segment => {
    const parsed = parseFilenameDate(segment)
    if (parsed) dates.push(parsed)
  })

  if (dates.length === 0) return null
  dates.sort((a, b) => a.getTime() - b.getTime())
  return { start: inputDateValue(dates[0]), end: inputDateValue(dates[dates.length - 1]) }
}

// True when a known export range spans the whole calendar month.
export function monthFullyCoveredByRange(month: string, range: { start: string; end: string } | null): boolean {
  if (!range) return false
  const { start, end } = calendarMonthBounds(month)
  return range.start <= start && range.end >= end
}

// Reduce a raw report list to the client-facing set: only reports whose intended
// month is a completed calendar month, deduped to one report per month. When a
// month has duplicates, the latest updated (then master, then newest) wins.
export function selectMonthlyReports<
  T extends { period_start: string; period_end: string; platform?: unknown; updated_at?: string | null; created_at: string }
>(reports: T[]): T[] {
  const byMonth = new Map<string, T>()
  for (const report of reports) {
    const month = getReportMonthFromPeriod(report)
    if (!isCompletedMonth(month)) continue
    const existing = byMonth.get(month)
    if (!existing) {
      byMonth.set(month, report)
      continue
    }
    if (preferReport(report, existing)) byMonth.set(month, report)
  }
  return [...byMonth.values()].sort((a, b) =>
    getReportMonthFromPeriod(b).localeCompare(getReportMonthFromPeriod(a))
  )
}

// Pick the better of two same-month reports: latest updated wins; ties break to
// the master report (platform === null), then to the most recently created.
function preferReport(
  candidate: { platform?: unknown; updated_at?: string | null; created_at: string },
  current: { platform?: unknown; updated_at?: string | null; created_at: string }
): boolean {
  const candidateUpdated = candidate.updated_at ?? candidate.created_at
  const currentUpdated = current.updated_at ?? current.created_at
  if (candidateUpdated !== currentUpdated) return candidateUpdated > currentUpdated
  const candidateMaster = candidate.platform === null || candidate.platform === undefined
  const currentMaster = current.platform === null || current.platform === undefined
  if (candidateMaster !== currentMaster) return candidateMaster
  return candidate.created_at > current.created_at
}
