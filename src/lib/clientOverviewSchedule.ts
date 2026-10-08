import type { ClientMonthAhead } from './clientPortalCalendar'

export type ClientOverviewSchedule = {
  scheduledCount: number
  unscheduledCount: number
  state: 'scheduled' | 'planning' | 'empty' | 'unavailable'
}

/** Never turn a failed read or an undated post into a confirmed schedule. */
export function summarizeClientOverviewSchedule(calendar: ClientMonthAhead | null): ClientOverviewSchedule {
  if (!calendar || calendar.loadFailed) {
    return { scheduledCount: 0, unscheduledCount: 0, state: 'unavailable' }
  }

  const scheduledCount = calendar.posts.filter(post => post.date !== null).length + calendar.events.length
  const unscheduledCount = calendar.posts.filter(post => post.date === null).length
  return {
    scheduledCount,
    unscheduledCount,
    state: scheduledCount > 0 ? 'scheduled' : unscheduledCount > 0 ? 'planning' : 'empty',
  }
}
