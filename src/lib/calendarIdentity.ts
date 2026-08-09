export interface CalendarIdentityEvent {
  id: string
  title: string
  start_at: string
  end_at: string | null
  all_day: boolean
  status?: string | null
  linked_task_id?: string | null
  microsoft_calendar_id?: string | null
  microsoft_event_id?: string | null
  microsoft_last_synced_at?: string | null
  updated_at?: string | null
}

export interface CalendarReviewCandidate<TEvent extends CalendarIdentityEvent> {
  nativeEvent: TEvent
  outlookEvent: TEvent
}

function normalizedIso(value: string | null): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? value.trim() : new Date(parsed).toISOString()
}

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-ZA')
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function outlookCalendarIdentity(event: CalendarIdentityEvent): string | null {
  const calendarId = event.microsoft_calendar_id?.trim()
  const eventId = event.microsoft_event_id?.trim()
  return calendarId && eventId ? JSON.stringify(['outlook', calendarId, eventId]) : null
}

export function calendarMaterialReviewKey(event: Pick<CalendarIdentityEvent, 'title' | 'start_at' | 'all_day'>): string {
  return JSON.stringify([
    normalizedTitle(event.title),
    normalizedIso(event.start_at),
    event.all_day,
  ])
}

function preferredOutlookEvent<TEvent extends CalendarIdentityEvent>(left: TEvent, right: TEvent): TEvent {
  const syncDifference = timestamp(right.microsoft_last_synced_at) - timestamp(left.microsoft_last_synced_at)
  if (syncDifference !== 0) return syncDifference > 0 ? right : left
  const updateDifference = timestamp(right.updated_at) - timestamp(left.updated_at)
  if (updateDifference !== 0) return updateDifference > 0 ? right : left
  return right.id.localeCompare(left.id) < 0 ? right : left
}

export function reconcileCalendarLogicalItems<
  TEvent extends CalendarIdentityEvent,
  TTask extends { id: string },
>(events: TEvent[], tasks: TTask[]) {
  const canonicalEvents: TEvent[] = []
  const outlookIndexes = new Map<string, number>()

  for (const event of events) {
    const identity = outlookCalendarIdentity(event)
    if (!identity) {
      canonicalEvents.push(event)
      continue
    }
    const existingIndex = outlookIndexes.get(identity)
    if (existingIndex === undefined) {
      outlookIndexes.set(identity, canonicalEvents.length)
      canonicalEvents.push(event)
      continue
    }
    canonicalEvents[existingIndex] = preferredOutlookEvent(canonicalEvents[existingIndex], event)
  }

  const linkedTaskIds = new Set(canonicalEvents.map(event => event.linked_task_id?.trim()).filter((id): id is string => Boolean(id)))
  const seenTaskIds = new Set<string>()
  const canonicalTasks = tasks.filter(task => {
    if (linkedTaskIds.has(task.id) || seenTaskIds.has(task.id)) return false
    seenTaskIds.add(task.id)
    return true
  })

  const nativeByReviewKey = new Map<string, TEvent[]>()
  const outlookByReviewKey = new Map<string, TEvent[]>()
  for (const event of canonicalEvents) {
    if (event.status === 'cancelled') continue
    const map = outlookCalendarIdentity(event) ? outlookByReviewKey : nativeByReviewKey
    const key = calendarMaterialReviewKey(event)
    map.set(key, [...(map.get(key) ?? []), event])
  }

  const reviewCandidates: CalendarReviewCandidate<TEvent>[] = []
  for (const [key, outlookEvents] of outlookByReviewKey) {
    for (const outlookEvent of outlookEvents) {
      for (const nativeEvent of nativeByReviewKey.get(key) ?? []) {
        reviewCandidates.push({ nativeEvent, outlookEvent })
      }
    }
  }

  return { events: canonicalEvents, tasks: canonicalTasks, reviewCandidates }
}
