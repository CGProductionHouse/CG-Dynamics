import type { CompanyCalendarEvent } from './companyCalendar'
import { addBusinessDays, businessDateKey, businessDayBoundaryIso, formatBusinessDate } from './businessTime'

export interface HubCalendarDay {
  date: string
  isToday: boolean
  events: CompanyCalendarEvent[]
}

export function buildHubSevenDayCalendar(
  events: CompanyCalendarEvent[],
  today = businessDateKey(),
): HubCalendarDay[] {
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: addBusinessDays(today, index),
    isToday: index === 0,
    events: [] as CompanyCalendarEvent[],
  }))
  const daysByDate = new Map(days.map(day => [day.date, day]))

  for (const event of events) {
    if (event.status === 'cancelled') continue
    const day = daysByDate.get(businessDateKey(event.start_at))
    if (day) day.events.push(event)
  }

  for (const day of days) {
    day.events.sort((left, right) => {
      const timeDifference = Date.parse(left.start_at) - Date.parse(right.start_at)
      return timeDifference || left.title.localeCompare(right.title)
    })
  }

  return days
}

export function formatHubCalendarDay(date: string): string {
  return formatBusinessDate(businessDayBoundaryIso(date), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).replace(',', '').toUpperCase()
}
