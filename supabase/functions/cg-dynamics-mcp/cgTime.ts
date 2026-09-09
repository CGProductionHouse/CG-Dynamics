// cgTime.ts — CG Production House operating-day helpers. Pure and import-free so they are
// unit-tested without Deno.
//
// DEFECT FIXED (#325/#327): `get_my_day` derived "today" with
// `new Date().toISOString().slice(0, 10)`, which is UTC. CG operates in
// Africa/Johannesburg (SAST, UTC+2, no DST), so between 00:00 and 02:00 SAST the UTC date is
// still the PREVIOUS day. At 00:37 SAST on 10 Sep the brief returned 9 Sep — a whole
// operating day wrong, and silently so.
//
// Everything here is derived from the operating timezone, never from the server's UTC clock.

/** CG Production House operating timezone. SAST is UTC+2 year-round (no DST). */
export const CG_TIMEZONE = 'Africa/Johannesburg'

/**
 * The calendar date (YYYY-MM-DD) in the CG operating timezone for a given instant.
 * `en-CA` yields ISO-ordered YYYY-MM-DD, so no manual part juggling is needed.
 */
export function cgDate(instant: Date = new Date(), timeZone: string = CG_TIMEZONE): string {
  return instant.toLocaleDateString('en-CA', { timeZone })
}

/** The CG-operating-day date N days from `instant` (negative for past). */
export function cgDatePlusDays(days: number, instant: Date = new Date(), timeZone: string = CG_TIMEZONE): string {
  return cgDate(new Date(instant.getTime() + days * 86400000), timeZone)
}

/**
 * Inclusive start/end instants (as ISO strings) covering one CG operating day, for querying
 * `timestamptz` columns. The window is expressed in the operating timezone's offset so a
 * 00:30 SAST event is not attributed to the previous UTC day.
 */
export function cgDayBounds(date: string, offsetHours = 2): { start: string; end: string } {
  const sign = offsetHours >= 0 ? '+' : '-'
  const abs = Math.abs(offsetHours)
  const off = `${sign}${String(Math.floor(abs)).padStart(2, '0')}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`
  return { start: `${date}T00:00:00${off}`, end: `${date}T23:59:59.999${off}` }
}
