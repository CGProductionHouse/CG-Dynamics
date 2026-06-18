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
