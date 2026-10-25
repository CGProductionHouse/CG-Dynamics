// One pure supported-rule contract for the staff UI, materialiser and MCP creator.
export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  byDays: number[]
  byMonthDay: number | null
  // Explicit monthly position only: never infer it from an observed due date.
  byOrdinalDay?: { ordinal: number; day: number }
}
const DAY_TOKENS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
export function parseRecurrenceRule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null
  const parts = new Map<string, string>()
  for (const piece of raw.split(';')) {
    const [key, value, extra] = piece.split('=')
    if (!key?.trim() || !value?.trim() || extra !== undefined || parts.has(key.trim().toUpperCase())) return null
    parts.set(key.trim().toUpperCase(), value.trim().toUpperCase())
  }
  const freq = parts.get('FREQ')
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null
  if ([...parts.keys()].some(key => !['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY'].includes(key))) return null
  if (freq !== 'MONTHLY' && parts.has('BYMONTHDAY')) return null
  if (parts.has('BYMONTHDAY') && parts.has('BYDAY')) return null
  const interval = Number(parts.get('INTERVAL') ?? '1')
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) return null
  let byOrdinalDay: RecurrenceRule['byOrdinalDay']
  if (freq === 'MONTHLY' && parts.has('BYDAY')) {
    // Bounded supported subset of RFC5545: one nth weekday per monthly rule.
    // Bare weekdays, mixed ordinals, BYSETPOS and count-based series stay held.
    const match = /^(-?[1-5])(SU|MO|TU|WE|TH|FR|SA)$/.exec(parts.get('BYDAY')!)
    if (!match) return null
    byOrdinalDay = { ordinal: Number(match[1]), day: DAY_TOKENS[match[2]] }
  } else if (parts.has('BYDAY') && parts.get('BYDAY')!.split(',').some(token => DAY_TOKENS[token.trim()] === undefined)) return null
  const byDays = byOrdinalDay ? [] : (parts.get('BYDAY') ?? '').split(',').map(token => DAY_TOKENS[token.trim()]).filter((day): day is number => typeof day === 'number')
  const rawDay = Number(parts.get('BYMONTHDAY') ?? '')
  if (parts.has('BYMONTHDAY') && (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 28)) return null
  return { freq, interval, byDays, byMonthDay: parts.has('BYMONTHDAY') ? rawDay : null, ...(byOrdinalDay ? { byOrdinalDay } : {}) }
}
