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
  nativePlannerId?: string | null
  deliverableId?: string
  eventId?: string
}

export interface MyDayContext {
  today: string
  todayLabel: string
  userName: string | null
  tasks: MyDayItem[]
  events: MyDayItem[]
  deliverables: MyDayItem[]
  timeline: MyDayItem[]
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

function localDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function nameMatches(value: string | null | undefined, userName: string | null) {
  if (!value || !userName) return false
  return value.trim().toLowerCase() === userName.trim().toLowerCase()
}

function helperMatches(values: string[] | undefined, userName: string | null) {
  if (!values || !userName) return false
  return values.some(value => nameMatches(value, userName))
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
  const date = event.start_at.slice(0, 10)
  const sortRank = date < today ? 2 : date === today ? 3 : 6
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
    .filter(task => nameMatches(task.assigned_to_name, userName) || helperMatches(task.helper_names, userName))
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
    .filter(deliverable => nameMatches(deliverable.assigned_to_name, userName) || helperMatches(deliverable.helper_names, userName))
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
      const eventDate = event.start_at.slice(0, 10)
      return eventDate === today || nameMatches(event.assigned_to_name, userName)
    })
    .map(event => toEventItem(event, today))

  const allItems = [...events, ...tasks, ...deliverables].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank
    const dateCompare = (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
    if (dateCompare !== 0) return dateCompare
    return (a.timeLabel ?? '').localeCompare(b.timeLabel ?? '')
  })

  return {
    today,
    todayLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(baseDate),
    userName,
    tasks,
    events,
    deliverables,
    timeline: allItems.filter(item => item.date === today),
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
