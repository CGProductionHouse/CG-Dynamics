export const BUSINESS_TIME_ZONE = 'Africa/Johannesburg'

function parts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(values.map(part => [part.type, part.value]))
}

export function businessDateKey(value: Date | string = new Date()): string {
  const valueParts = parts(value)
  return valueParts ? `${valueParts.year}-${valueParts.month}-${valueParts.day}` : ''
}

export function businessMonthKey(value: Date | string = new Date()): string {
  return businessDateKey(value).slice(0, 7)
}

export function businessMinutes(value: Date | string): number | null {
  const valueParts = parts(value)
  return valueParts ? Number(valueParts.hour) * 60 + Number(valueParts.minute) : null
}

export function formatBusinessTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatBusinessDate(value: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: BUSINESS_TIME_ZONE }).format(new Date(value))
}

export function businessDayBoundaryIso(dateKey: string, offsetDays = 0): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, day + offsetDays, -2, 0, 0, 0)
  return new Date(utc).toISOString()
}

export function addBusinessDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
