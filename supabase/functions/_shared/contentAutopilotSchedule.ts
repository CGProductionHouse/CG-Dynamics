export const CONTENT_AUTOPILOT_ENABLED_FLAG = 'CONTENT_AUTOPILOT_ENABLED'
export const CONTENT_AUTOPILOT_TIME_ZONE = 'Africa/Johannesburg'

export function contentAutopilotOperatingDate(
  now: Date = new Date(),
  timeZone = CONTENT_AUTOPILOT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function contentAutopilotIdempotencyKey(operatingDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operatingDate)) throw new Error('Invalid content autopilot operating date.')
  return `content-autopilot:${operatingDate}`
}
