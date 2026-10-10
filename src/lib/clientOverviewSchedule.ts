import type { ClientMonthAhead } from './clientPortalCalendar'
import { businessDateKey } from './businessTime'

export type ClientOverviewSchedule = {
  scheduledCount: number
  unscheduledCount: number
  state: 'scheduled' | 'planning' | 'empty' | 'unavailable'
}

/** Only work still ahead belongs in the Overview's "Coming up" summary. */
export function summarizeClientOverviewSchedule(calendar: ClientMonthAhead | null, now = new Date()): ClientOverviewSchedule {
  if (!calendar || calendar.loadFailed) {
    return { scheduledCount: 0, unscheduledCount: 0, state: 'unavailable' }
  }

  const today = businessDateKey(now)
  const scheduledCount = calendar.posts.filter(post => post.date !== null && post.date >= today && post.status !== 'posted').length
    + calendar.events.filter(event => event.allDay
      ? event.endAt ? Date.parse(event.endAt) > now.getTime() : businessDateKey(event.startAt) >= today
      : Date.parse(event.endAt ?? event.startAt) >= now.getTime()).length
  const unscheduledCount = calendar.posts.filter(post => post.date === null && post.status !== 'posted').length
  return {
    scheduledCount,
    unscheduledCount,
    state: scheduledCount > 0 ? 'scheduled' : unscheduledCount > 0 ? 'planning' : 'empty',
  }
}
