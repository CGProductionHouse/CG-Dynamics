import { listTasks, type CommandCentreTask } from './commandCentre'
import {
  getEffectiveScheduleDate,
  listMonthlyDeliverablesByMonth,
  monthKey,
  normalizeScheduleStatus,
  type MonthlyDeliverable,
} from './planner'
import { listCompanyEvents, EVENT_TYPE_LABELS, type CompanyCalendarEvent } from './companyCalendar'
import { listActiveClients } from './commandCentre'
import type { Profile } from './db/profiles'

export type MyDaySource = 'planner_task' | 'calendar_event' | 'client_deliverable'

export interface MyDayItem {
  id: string
  source: MyDaySource
  title: string
  clientName: string | null
  date: string | null
  timeLabel: string | null
  statusLabel: string
  priority: 'client_request' | 'urgent' | 'normal'
  assignedTo: string | null
  helperNames: string[]
  href: string
  sortRank: number
  durationMinutes?: number
  startMinutes?: number | null
  nativePlannerId?: string | null
  deliverableId?: string
  eventId?: string
}

export type MyDayTimelineBlockKind = 'fixed' | 'focus' | 'buffer' | 'overload'

export interface MyDayTimelineBlock {
  id: string
  kind: MyDayTimelineBlockKind
  label: string
  startLabel: string
  endLabel: string
  item: MyDayItem | null
  href: string | null
  sourceLabel: string
}

export interface MyDaySummary {
  currentTask: MyDayItem | null
  nextTask: MyDayItem | null
  suggestedNextAction: string
  workloadWarning: string | null
  plannedMinutes: number
  availableMinutes: number
}

export interface MyDayContext {
  today: string
  todayLabel: string
  userName: string | null
  tasks: MyDayItem[]
  events: MyDayItem[]
  deliverables: MyDayItem[]
  timeline: MyDayItem[]
  timelineBlocks: MyDayTimelineBlock[]
  summary: MyDaySummary
  overdue: MyDayItem[]
  dueToday: MyDayItem[]
  upcoming: MyDayItem[]
  diagnostics: {
    profileNameMissing: boolean
    companyEventsMissing: boolean
    errors: string[]
  }
}

const ACTIVE_TASK_STATUSES = new Set(['to_do', 'in_progress', 'blocked', 'waiting_client'])
const WORKDAY_START_MINUTES = 8 * 60
const WORKDAY_END_MINUTES = 17 * 60
const DEFAULT_TASK_MINUTES = 45
const DEFAULT_DELIVERABLE_MINUTES = 60
const DEFAULT_EVENT_MINUTES = 60

function localDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function localDateKeyFromIso(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return localDateKey(date)
}

function minutesToLabel(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDayIso(dateKey: string) {
  return `${dateKey}T00:00:00`
}

function nextMonthStartKey(date: Date) {
  return monthKey(new Date(date.getFullYear(), date.getMonth() + 1, 1))
}

function eventDurationMinutes(event: CompanyCalendarEvent) {
  if (event.all_day) return DEFAULT_EVENT_MINUTES
  const start = new Date(event.start_at)
  const end = event.end_at ? new Date(event.end_at) : null
  if (!end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return DEFAULT_EVENT_MINUTES
  }
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  return Math.max(30, Math.min(minutes, 240))
}

function itemDurationMinutes(item: MyDayItem) {
  if (item.source === 'calendar_event') return DEFAULT_EVENT_MINUTES
  if (item.source === 'client_deliverable') return DEFAULT_DELIVERABLE_MINUTES
  return DEFAULT_TASK_MINUTES
}

function nameMatches(value: string | null | undefined, userName: string | null) {
  if (!value || !userName) return false
  return value.trim().toLowerCase() === userName.trim().toLowerCase()
}

function helperMatches(values: string[] | undefined, userName: string | null) {
  if (!values || !userName) return false
  return values.some(value => nameMatches(value, userName))
}

function userMatches(
  assignedUserId: string | null | undefined,
  assignedName: string | null | undefined,
  helperNames: string[] | undefined,
  profile: Profile | null,
) {
  if (assignedUserId && profile?.id && assignedUserId === profile.id) return true
  const userName = profile?.full_name?.trim() || null
  return nameMatches(assignedName, userName) || helperMatches(helperNames, userName)
}

function localMinutesFromIso(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}

function formatDateLabel(value: string | null, today: string) {
  if (!value) return 'Unscheduled'
  if (value < today) return 'Overdue'
  if (value === today) return 'Today'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function formatTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function taskStatusLabel(status: CommandCentreTask['status']) {
  if (status === 'in_progress') return 'In progress'
  if (status === 'blocked') return 'Blocked'
  if (status === 'waiting_client') return 'Waiting client'
  return 'To do'
}

function deliverableStatusLabel(raw: MonthlyDeliverable['production_status']) {
  const status = normalizeScheduleStatus(raw)
  if (status === 'in_progress') return 'In progress'
  if (status === 'ready_review') return 'Ready for review'
  if (status === 'awaiting_client') return 'Awaiting client'
  if (status === 'meta_drafts') return 'Meta drafts'
  if (status === 'scheduled_posted') return 'Scheduled / posted'
  return 'Not started'
}

function taskSortRank(task: CommandCentreTask, today: string) {
  if (task.priority === 'client_request') return 0
  if (task.priority === 'urgent') return 1
  if (task.due_date && task.due_date < today) return 2
  if (task.due_date === today) return 3
  if (task.status === 'in_progress') return 4
  return 7
}

function toTaskItem(task: CommandCentreTask, today: string): MyDayItem {
  return {
    id: task.id,
    nativePlannerId: task.data_origin === 'planner_tasks' ? task.native_id ?? null : null,
    source: 'planner_task',
    title: task.title,
    clientName: task.client_name,
    date: task.due_date,
    timeLabel: null,
    statusLabel: taskStatusLabel(task.status),
    priority: task.priority,
    assignedTo: task.assigned_to_name,
    helperNames: task.helper_names ?? [],
    href: '/admin/planner',
    sortRank: taskSortRank(task, today),
  }
}

function toDeliverableItem(
  deliverable: MonthlyDeliverable,
  clientNameById: Map<string, string>,
  today: string,
): MyDayItem {
  const date = getEffectiveScheduleDate(deliverable)
  const status = normalizeScheduleStatus(deliverable.production_status)
  const sortRank = date && date < today ? 2 : date === today ? 3 : status === 'in_progress' ? 4 : 8
  return {
    id: `deliverable:${deliverable.id}`,
    deliverableId: deliverable.id,
    source: 'client_deliverable',
    title: deliverable.title,
    clientName: clientNameById.get(deliverable.client_id) ?? null,
    date,
    timeLabel: null,
    statusLabel: deliverableStatusLabel(deliverable.production_status),
    priority: deliverable.priority,
    assignedTo: deliverable.assigned_to_name,
    helperNames: deliverable.helper_names ?? [],
    href: '/admin/client-schedule?view=calendar',
    sortRank,
  }
}

function toEventItem(event: CompanyCalendarEvent, today: string): MyDayItem {
  const date = localDateKeyFromIso(event.start_at) ?? event.start_at.slice(0, 10)
  const sortRank = date < today ? 2 : date === today ? 3 : 6
  const startMinutes = event.all_day ? WORKDAY_START_MINUTES : localMinutesFromIso(event.start_at)
  return {
    id: `event:${event.id}`,
    eventId: event.id,
    source: 'calendar_event',
    title: event.title,
    clientName: event.client_name,
    date,
    timeLabel: event.all_day ? 'All day' : formatTime(event.start_at),
    statusLabel: EVENT_TYPE_LABELS[event.event_type] ?? event.event_type,
    priority: event.event_type === 'deadline' ? 'urgent' : 'normal',
    assignedTo: event.assigned_to_name,
    helperNames: [],
    href: '/admin/cg-calendar',
    sortRank,
    durationMinutes: eventDurationMinutes(event),
    startMinutes,
  }
}

function buildTimelineBlocks(todayItems: MyDayItem[], now = new Date()): MyDayTimelineBlock[] {
  const fixedItems = todayItems
    .filter(item => item.source === 'calendar_event')
    .sort((a, b) => (a.startMinutes ?? WORKDAY_START_MINUTES) - (b.startMinutes ?? WORKDAY_START_MINUTES))
  const flexibleItems = todayItems
    .filter(item => item.source !== 'calendar_event')
    .sort((a, b) => {
      if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank
      return a.title.localeCompare(b.title)
    })

  const eventBlocks: Array<{ item: MyDayItem; start: number; end: number }> = fixedItems.map(item => {
    const parsedStart = item.startMinutes ?? WORKDAY_START_MINUTES
    const duration = item.durationMinutes ?? DEFAULT_EVENT_MINUTES
    return {
      item,
      start: Math.max(WORKDAY_START_MINUTES, Math.min(parsedStart, WORKDAY_END_MINUTES)),
      end: Math.max(WORKDAY_START_MINUTES + 30, Math.min(parsedStart + duration, WORKDAY_END_MINUTES)),
    }
  })
    .sort((a, b) => a.start - b.start)

  const blocks: MyDayTimelineBlock[] = []
  let cursor = WORKDAY_START_MINUTES
  let flexIndex = 0

  function addFlexibleUntil(limit: number) {
    while (flexIndex < flexibleItems.length) {
      const item = flexibleItems[flexIndex]
      const duration = itemDurationMinutes(item)
      if (cursor + duration > limit) break
      blocks.push({
        id: `block:${item.id}:${cursor}`,
        kind: 'focus',
        label: item.title,
        startLabel: minutesToLabel(cursor),
        endLabel: minutesToLabel(cursor + duration),
        item,
        href: item.href,
        sourceLabel: sourceLabel(item.source),
      })
      cursor += duration
      flexIndex += 1
    }

    if (limit - cursor >= 30) {
      blocks.push({
        id: `buffer:${cursor}:${limit}`,
        kind: 'buffer',
        label: 'Open planning time',
        startLabel: minutesToLabel(cursor),
        endLabel: minutesToLabel(limit),
        item: null,
        href: null,
        sourceLabel: 'Available',
      })
    }
    cursor = Math.max(cursor, limit)
  }

  for (const eventBlock of eventBlocks) {
    addFlexibleUntil(eventBlock.start)
    const end = Math.max(eventBlock.end, eventBlock.start + 30)
    blocks.push({
      id: `block:${eventBlock.item.id}:${eventBlock.start}`,
      kind: 'fixed',
      label: eventBlock.item.title,
      startLabel: minutesToLabel(eventBlock.start),
      endLabel: minutesToLabel(end),
      item: eventBlock.item,
      href: eventBlock.item.href,
      sourceLabel: sourceLabel(eventBlock.item.source),
    })
    cursor = Math.max(cursor, end)
  }

  addFlexibleUntil(WORKDAY_END_MINUTES)

  if (flexIndex < flexibleItems.length) {
    const remaining = flexibleItems.length - flexIndex
    blocks.push({
      id: 'overload:remaining-work',
      kind: 'overload',
      label: `${remaining} assigned item${remaining === 1 ? '' : 's'} will not fit into a normal workday`,
      startLabel: 'After 17:00',
      endLabel: 'Move or delegate',
      item: flexibleItems[flexIndex],
      href: flexibleItems[flexIndex]?.href ?? null,
      sourceLabel: 'Capacity',
    })
  }

  const currentMinute = now.getHours() * 60 + now.getMinutes()
  if (currentMinute < WORKDAY_START_MINUTES || currentMinute > WORKDAY_END_MINUTES) {
    return blocks
  }

  return blocks
}

function buildSummary(
  timelineBlocks: MyDayTimelineBlock[],
  focusItems: MyDayItem[],
  now = new Date(),
): MyDaySummary {
  const workBlocks = timelineBlocks.filter(block => block.item)
  const currentMinute = now.getHours() * 60 + now.getMinutes()
  const currentBlock = workBlocks.find(block => {
    const start = Number(block.startLabel.slice(0, 2)) * 60 + Number(block.startLabel.slice(3, 5))
    const end = Number(block.endLabel.slice(0, 2)) * 60 + Number(block.endLabel.slice(3, 5))
    return currentMinute >= start && currentMinute < end
  })
  const nextBlock = workBlocks.find(block => {
    const start = Number(block.startLabel.slice(0, 2)) * 60 + Number(block.startLabel.slice(3, 5))
    return start > currentMinute
  })
  const currentTask = currentBlock?.item ?? focusItems[0] ?? null
  const nextTask = nextBlock?.item && nextBlock.item.id !== currentTask?.id
    ? nextBlock.item
    : focusItems.find(item => item.id !== currentTask?.id) ?? null
  const plannedMinutes = workBlocks.reduce((total, block) => {
    if (!/^\d{2}:\d{2}$/.test(block.startLabel) || !/^\d{2}:\d{2}$/.test(block.endLabel)) return total
    const start = Number(block.startLabel.slice(0, 2)) * 60 + Number(block.startLabel.slice(3, 5))
    const end = Number(block.endLabel.slice(0, 2)) * 60 + Number(block.endLabel.slice(3, 5))
    return total + Math.max(0, end - start)
  }, 0)
  const overloadBlock = timelineBlocks.find(block => block.kind === 'overload')

  return {
    currentTask,
    nextTask,
    suggestedNextAction: currentTask
      ? `Start with ${currentTask.title}.`
      : nextTask
        ? `Next up: ${nextTask.title}.`
        : 'No assigned focus work is due right now.',
    workloadWarning: overloadBlock
      ? overloadBlock.label
      : null,
    plannedMinutes,
    availableMinutes: WORKDAY_END_MINUTES - WORKDAY_START_MINUTES,
  }
}

export function sourceLabel(source: MyDaySource) {
  if (source === 'calendar_event') return 'CG Calendar'
  if (source === 'client_deliverable') return 'Client Schedule'
  return 'Planner'
}

export function sourceAccent(source: MyDaySource) {
  if (source === 'calendar_event') return 'border-sky-300/25 bg-sky-300/10 text-sky-200'
  if (source === 'client_deliverable') return 'border-brand-teal/25 bg-brand-teal/[0.08] text-[#2dd4bf]'
  return 'border-white/10 bg-white/[0.04] text-brand-primary'
}

export async function getMyDayContext(profile: Profile | null, baseDate = new Date()): Promise<MyDayContext> {
  const today = localDateKey(baseDate)
  const weekEnd = localDateKey(addDays(baseDate, 7))
  const userName = profile?.full_name?.trim() || null
  const errors: string[] = []

  const currentMonth = monthKey(baseDate)
  const finalMonth = nextMonthStartKey(addDays(baseDate, 7))
  const monthKeys = currentMonth === finalMonth ? [currentMonth] : [currentMonth, finalMonth]

  const [tasksResult, clientsResult, ...deliverableResults] = await Promise.all([
    listTasks(),
    listActiveClients(),
    ...monthKeys.map(key => listMonthlyDeliverablesByMonth(key)),
  ])

  if (tasksResult.error) errors.push(tasksResult.error.message)
  if (clientsResult.error) errors.push(clientsResult.error.message)

  const tasks = ((tasksResult.data ?? []) as CommandCentreTask[])
    .filter(task => ACTIVE_TASK_STATUSES.has(task.status))
    .filter(task => userMatches(task.assigned_to_user_id, task.assigned_to_name, task.helper_names, profile))
    .filter(task => !task.due_date || task.due_date <= weekEnd)
    .map(task => toTaskItem(task, today))

  const clientNameById = new Map((clientsResult.data ?? []).map(client => [client.id, client.name]))
  const deliverables = deliverableResults.flatMap(result => {
    if (result.error) errors.push(result.error.message)
    return ((result.data ?? []) as MonthlyDeliverable[])
  })
    .filter(deliverable => {
      const status = normalizeScheduleStatus(deliverable.production_status)
      return status !== 'scheduled_posted' && status !== 'meta_drafts'
    })
    .filter(deliverable => userMatches(deliverable.assigned_to_user_id, deliverable.assigned_to_name, deliverable.helper_names, profile))
    .filter(deliverable => {
      const date = getEffectiveScheduleDate(deliverable)
      return !date || date <= weekEnd
    })
    .map(deliverable => toDeliverableItem(deliverable, clientNameById, today))

  const eventsResult = await listCompanyEvents(startOfDayIso(today), startOfDayIso(localDateKey(addDays(baseDate, 8))))
  if (eventsResult.error) errors.push(eventsResult.error.message)

  const events = ((eventsResult.data ?? []) as CompanyCalendarEvent[])
    .filter(event => event.status !== 'cancelled')
    .filter(event => {
      const eventDate = localDateKeyFromIso(event.start_at)
      return eventDate === today || nameMatches(event.assigned_to_name, userName)
    })
    .map(event => toEventItem(event, today))

  const allItems = [...events, ...tasks, ...deliverables].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank
    const dateCompare = (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
    if (dateCompare !== 0) return dateCompare
    const timeCompare = (a.startMinutes ?? Number.MAX_SAFE_INTEGER) - (b.startMinutes ?? Number.MAX_SAFE_INTEGER)
    if (timeCompare !== 0) return timeCompare
    return (a.timeLabel ?? '').localeCompare(b.timeLabel ?? '')
  })

  const timeline = allItems.filter(item => item.date === today)
  const focusItems = [...allItems.filter(item => item.date !== null && item.date < today), ...timeline]
  const timelineBlocks = buildTimelineBlocks(timeline, baseDate)
  const summary = buildSummary(timelineBlocks, focusItems, baseDate)

  return {
    today,
    todayLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(baseDate),
    userName,
    tasks,
    events,
    deliverables,
    timeline,
    timelineBlocks,
    summary,
    overdue: allItems.filter(item => item.date !== null && item.date < today),
    dueToday: allItems.filter(item => item.date === today),
    upcoming: allItems.filter(item => item.date === null || (item.date > today && item.date <= weekEnd)),
    diagnostics: {
      profileNameMissing: !userName,
      companyEventsMissing: eventsResult.tableMissing,
      errors,
    },
  }
}

export function myDayDateLabel(item: MyDayItem, today: string) {
  return formatDateLabel(item.date, today)
}
