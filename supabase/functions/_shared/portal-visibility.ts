// Shared month-visibility rule for Brand Hub (#396).
//
// The next calendar month is visible and active on the 1st of the prior month.
// CG business timezone: Africa/Johannesburg (SAST, UTC+2, no DST).
//
// Pure function — no network, no Deno, no React.

/** CG business timezone for portal visibility. */
export const PORTAL_VISIBILITY_TIMEZONE = 'Africa/Johannesburg' as const

/**
 * Return the set of { year, month } pairs currently visible to a client.
 * Always includes the current month; always includes the next calendar month.
 * Year boundary: Dec -> Jan rolls the year.
 */
export function visiblePortalMonths(now = new Date()): Array<{ year: number; month: number }> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PORTAL_VISIBILITY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  const year = get('year')
  const month = get('month')
  const months: Array<{ year: number; month: number }> = [{ year, month }]
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  months.push({ year: nextYear, month: nextMonth })
  return months
}
