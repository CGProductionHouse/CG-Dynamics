import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { ClientPicker } from '../../components/ClientPicker'
import { useAuth } from '../../contexts/AuthContext'
import {
  listCompanyEvents,
  createCompanyEvent,
  updateCompanyEvent,
  deleteCompanyEvent,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  type CompanyCalendarEvent,
  type CompanyEventType,
  type CompanyEventStatus,
  type CompanyEventInput,
  type CompanyEventPatch,
} from '../../lib/companyCalendar'
import {
  PLANNER_TASK_STATUS_LABELS,
  listPlannerTasksDueBetween,
  type CalendarTaskRow,
} from '../../lib/planner'
import { materializeRecurringTasks } from '../../lib/recurrence'

type EventFilter = 'all' | CompanyEventType
type CalendarViewMode = 'calendar' | 'agenda'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EVENT_ORDER: Record<CompanyEventType, number> = {
  meeting: 0,
  shoot: 1,
  content_run: 2,
  client_event: 3,
  internal: 4,
  deadline: 5,
}

function sortEvents(events: CompanyCalendarEvent[]): CompanyCalendarEvent[] {
  return [...events].sort((a, b) => {
    const dateCmp = a.start_at.localeCompare(b.start_at)
    if (dateCmp !== 0) return dateCmp
    return (EVENT_ORDER[a.event_type] ?? 99) - (EVENT_ORDER[b.event_type] ?? 99)
  })
}

function formatEventTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (eventDate.getTime() - now.getTime()) / 86400000
  const datePart = diff === 0 ? 'Today'
    : diff === 1 ? 'Tomorrow'
    : diff < 0 && diff > -2 ? 'Yesterday'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return { datePart, timePart, full: `${datePart} · ${timePart}` }
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function localMonthKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return monthKey(date)
}

function isoToLocalDateTimeInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function localDateTimeInputToIso(value: string): string {
  return new Date(value).toISOString()
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + amount, 1))
}

function formatMonthHeading(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function statusStyle(status: CompanyEventStatus) {
  switch (status) {
    case 'confirmed': return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    case 'completed': return 'border-brand-teal/25 bg-brand-teal/10 text-[#2dd4bf]'
    case 'cancelled': return 'border-red-400/25 bg-red-400/10 text-red-300'
    default: return 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  }
}

function eventTypeStyle(eventType: CompanyEventType) {
  switch (eventType) {
    case 'meeting': return 'border-sky-400/25 bg-sky-400/10 text-sky-300'
    case 'shoot': return 'border-purple-400/25 bg-purple-400/10 text-purple-300'
    case 'content_run': return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    case 'client_event': return 'border-brand-accent/25 bg-brand-accent/10 text-[#f2b66f]'
    case 'deadline': return 'border-red-400/25 bg-red-400/10 text-red-300'
    default: return 'border-white/20 bg-white/10 text-white/70'
  }
}

// Optional operational layer: dated Planner tasks. Client Schedule package
// deliverables stay in Client Schedule / Master Schedule, not CG Calendar.
const TASK_CHIP_CLS = 'border-amber-300/25 bg-amber-300/[0.08] text-amber-200'

interface CalendarLayers {
  events: boolean
  tasks: boolean
}

interface DayPanelData {
  date: string
  events: CompanyCalendarEvent[]
  tasks: CalendarTaskRow[]
}

function nextMonthStart(key: string) {
  const [year, m] = key.split('-').map(Number)
  return `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
}

export default function CompanyCalendarPage() {
  const { profile } = useAuth()
  const [events, setEvents] = useState<CompanyCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()))
  const [viewMode, setViewMode] = useState<CalendarViewMode>('calendar')
  const [drawerEvent, setDrawerEvent] = useState<CompanyCalendarEvent | null>(null)
  const [layers, setLayers] = useState<CalendarLayers>({ events: true, tasks: false })
  const [monthTasks, setMonthTasks] = useState<CalendarTaskRow[]>([])
  const [dayPanel, setDayPanel] = useState<DayPanelData | null>(null)
  const [layerErrors, setLayerErrors] = useState<{ tasks: string | null; recurrence: string | null }>({ tasks: null, recurrence: null })
  const [recurrenceMigrationNeeded, setRecurrenceMigrationNeeded] = useState(false)

  const isAdmin = profile?.role === 'admin'

  async function load() {
    setLoading(true)
    setError(null)
    setTableMissing(false)
    try {
      const result = await listCompanyEvents()
      if (result.tableMissing) {
        setTableMissing(true)
        setEvents([])
        return
      }
      if (result.error) {
        setError(result.error.message)
        setEvents([])
        return
      }
      setEvents(result.data ?? [])
    } catch {
      setError('Could not load events.')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  // Task layer reloads per month. Best-effort and independent: a failure in
  // tasks (or events) never blanks the other layer — errors surface as diagnostics.
  useEffect(() => {
    let cancelled = false
    async function loadLayers() {
      const monthStart = `${selectedMonth}-01`
      setLayerErrors({ tasks: null, recurrence: null })
      setRecurrenceMigrationNeeded(false)
      const recurrenceResult = await materializeRecurringTasks()
      if (cancelled) return
      if (recurrenceResult.migrationNeeded) {
        setRecurrenceMigrationNeeded(true)
      } else if (recurrenceResult.error) {
        setLayerErrors(prev => ({ ...prev, recurrence: recurrenceResult.error ?? null }))
      }
      const taskResult = await listPlannerTasksDueBetween(monthStart, nextMonthStart(selectedMonth))
      if (cancelled) return
      setLayerErrors(prev => ({
        ...prev,
        tasks: taskResult.error?.message ?? null,
      }))
      if (taskResult.error) {
        setMonthTasks([])
      } else {
        // History (completed/approved) does not clutter the active task layer.
        setMonthTasks(((taskResult.data ?? []) as CalendarTaskRow[]).filter(task => task.status !== 'approved'))
      }
    }
    void loadLayers()
    return () => { cancelled = true }
  }, [selectedMonth])

  useEffect(() => {
    if (!drawerEvent) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerEvent(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerEvent])

  const filtered = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled')
    if (filter === 'all') return sortEvents(active)
    return sortEvents(active.filter(e => e.event_type === filter))
  }, [events, filter])

  const monthEvents = useMemo(
    () => filtered.filter(event => localMonthKey(event.start_at) === selectedMonth),
    [filtered, selectedMonth],
  )

  const visibleTasks = useMemo(() => (layers.tasks ? monthTasks : []), [layers.tasks, monthTasks])
  const visibleEvents = useMemo(() => (layers.events ? monthEvents : []), [layers.events, monthEvents])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTaskRow[]>()
    for (const task of visibleTasks) {
      if (!map.has(task.due_date)) map.set(task.due_date, [])
      map.get(task.due_date)!.push(task)
    }
    return map
  }, [visibleTasks])

  // Agenda groups: union of all visible layers per day, sorted by date.
  const grouped = useMemo(() => {
    const days = new Set<string>()
    for (const event of visibleEvents) days.add(localDateKey(event.start_at))
    for (const date of tasksByDate.keys()) days.add(date)
    return [...days].sort().map(day => ({
      day,
      events: visibleEvents.filter(event => localDateKey(event.start_at) === day),
      tasks: tasksByDate.get(day) ?? [],
    }))
  }, [visibleEvents, tasksByDate])

  const counts = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled')
    return {
      all: active.length,
      meeting: active.filter(e => e.event_type === 'meeting').length,
      shoot: active.filter(e => e.event_type === 'shoot').length,
      content_run: active.filter(e => e.event_type === 'content_run').length,
      client_event: active.filter(e => e.event_type === 'client_event').length,
      deadline: active.filter(e => e.event_type === 'deadline').length,
    }
  }, [events])

  const handleCreateEvent = useCallback((date?: string) => {
    const start = date ? `${date}T09:00` : ''
    setDrawerEvent({ id: '', title: '', event_type: 'internal', client_id: null, client_name: null, start_at: start, end_at: null, all_day: false, location: null, notes: null, assigned_to_name: null, status: 'planned', linked_deliverable_id: null, linked_task_id: null, created_at: '', updated_at: '' })
  }, [])

  const handleSaved = useCallback(() => {
    setDrawerEvent(null)
    void load()
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="h-3 w-32 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-8 w-56 animate-pulse rounded-lg bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
          ))}
        </div>
      </div>
    )
  }

  const filterTabs: { value: EventFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'meeting', label: 'Meetings', count: counts.meeting },
    { value: 'shoot', label: 'Shoots', count: counts.shoot },
    { value: 'content_run', label: 'Content Runs', count: counts.content_run },
    { value: 'client_event', label: 'Client Events', count: counts.client_event },
    { value: 'deadline', label: 'Deadlines', count: counts.deadline },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Calendar</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">CG Calendar</h1>
          <p className="mt-1 text-sm text-brand-primary/60">Meetings, shoots, content runs and internal events.</p>
        </div>
        <ActionButton variant="primary" onClick={() => handleCreateEvent()}>
          + Add Event
        </ActionButton>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Prev</button>
        <button type="button" onClick={() => setSelectedMonth(monthKey(new Date()))} className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">Today</button>
        <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50" />
        <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Next</button>
        <div className="ml-auto flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
          {(['calendar', 'agenda'] as const).map(option => (
            <button key={option} type="button" onClick={() => setViewMode(option)} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors ${viewMode === option ? 'bg-brand-accent text-black' : 'text-brand-primary/60 hover:text-brand-primary'}`}>{option}</button>
          ))}
        </div>
      </div>

      {/* Layer toggles: the calendar shows the whole operational picture —
          company events by default, with Planner dated tasks as an optional operational overlay. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-primary/45">Show</span>
        {([
          ['events', `Events (${monthEvents.length})`, 'border-sky-400/30 text-sky-300'],
          ['tasks', `Planner tasks (${monthTasks.length})`, 'border-amber-300/30 text-amber-200'],
        ] as const).map(([key, label, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayers(prev => ({ ...prev, [key]: !prev[key] }))}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
              layers[key] ? `${tone} bg-white/[0.05]` : 'border-white/10 text-brand-primary/35 hover:text-brand-primary/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tableMissing || error || layerErrors.tasks || layerErrors.recurrence || recurrenceMigrationNeeded || (monthEvents.length + monthTasks.length === 0)) && (
        <CalendarDiagnostics
          month={selectedMonth}
          eventCount={monthEvents.length}
          taskCount={monthTasks.length}
          tableMissing={tableMissing}
          eventError={error}
          taskError={layerErrors.tasks}
          recurrenceError={layerErrors.recurrence}
          recurrenceMigrationNeeded={recurrenceMigrationNeeded}
        />
      )}

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              filter === tab.value
                ? 'bg-[#2dd4bf] text-black shadow-sm'
                : 'border border-white/10 text-brand-primary/65 hover:text-white hover:border-white/20'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === tab.value ? 'bg-black/20 text-black' : 'bg-white/10 text-brand-primary/60'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {viewMode === 'calendar' ? (
        <CgCalendarGrid
          month={selectedMonth}
          events={visibleEvents}
          tasksByDate={tasksByDate}
          groups={grouped}
          onAdd={handleCreateEvent}
          onOpen={setDrawerEvent}
          onOpenDay={setDayPanel}
        />
      ) : grouped.length === 0 ? (
        <EmptyState title={`Nothing in ${formatMonthHeading(selectedMonth)}`} message="No company events or dated Planner tasks this month yet." action={<ActionButton variant="outline" size="sm" onClick={() => handleCreateEvent()}>+ Add Event</ActionButton>} />
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.day}>
              <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-brand-primary/50">
                {formatShortDate(group.day)}
              </h3>
              {group.events.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.events.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setDrawerEvent(event)}
                    />
                  ))}
                </div>
              )}
              {group.tasks.length > 0 && (
                <div className={`space-y-1.5 ${group.events.length > 0 ? 'mt-2' : ''}`}>
                  {group.tasks.map(task => <TaskRowLink key={task.id} task={task} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dayPanel && (
        <DayPanel
          data={dayPanel}
          onClose={() => setDayPanel(null)}
          onOpenEvent={event => { setDayPanel(null); setDrawerEvent(event) }}
        />
      )}

      {drawerEvent && (
        <EventDrawer
          event={drawerEvent}
          isAdmin={isAdmin}
          onClose={() => setDrawerEvent(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function CalendarDiagnostics({
  month,
  eventCount,
  taskCount,
  tableMissing,
  eventError,
  taskError,
  recurrenceError,
  recurrenceMigrationNeeded,
}: {
  month: string
  eventCount: number
  taskCount: number
  tableMissing: boolean
  eventError: string | null
  taskError: string | null
  recurrenceError: string | null
  recurrenceMigrationNeeded: boolean
}) {
  const missingLayers = [
    eventCount === 0 ? 'events' : null,
    taskCount === 0 ? 'Planner dated tasks' : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/45">Calendar diagnostics</p>
          <p className="mt-1 text-sm font-semibold text-white">{formatMonthHeading(month)}</p>
          <p className="mt-1 text-xs text-brand-primary/60">
            {eventCount + taskCount === 0
              ? 'No operational calendar items were returned for this selected month.'
              : 'One or more calendar layers need attention.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[240px]">
          <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3 py-2">
            <p className="text-lg font-black text-white">{eventCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-200/70">Events</p>
          </div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2">
            <p className="text-lg font-black text-white">{taskCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-100/70">Tasks</p>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-brand-primary/65">
        {missingLayers && <p>Empty layer this month: {missingLayers}.</p>}
        {tableMissing && <p className="text-amber-200">Company calendar events table is missing. Apply `supabase/phase-10a-company-calendar-events.sql` before adding normal events.</p>}
        {!tableMissing && eventCount === 0 && <p>Calendar event seed may not be applied yet. `phase-10b-cg-calendar-teams-seed-2026.sql` is optional; Planner dated tasks are loaded separately if the optional task layer is enabled.</p>}
        {recurrenceMigrationNeeded && <p>Recurring task columns are not applied yet. Calendar still shows existing dated tasks; apply `supabase/phase-13a-recurring-tasks.sql` to materialise future recurring instances.</p>}
        {eventError && <p className="text-red-300">Events query error: {eventError}</p>}
        {taskError && <p className="text-red-300">Planner task query error: {taskError}</p>}
        {recurrenceError && <p className="text-red-300">Recurring task materialisation error: {recurrenceError}</p>}
      </div>
    </div>
  )
}

function CgCalendarGrid({
  month,
  events,
  tasksByDate,
  groups,
  onAdd,
  onOpen,
  onOpenDay,
}: {
  month: string
  events: CompanyCalendarEvent[]
  tasksByDate: Map<string, CalendarTaskRow[]>
  groups: Array<{ day: string; events: CompanyCalendarEvent[]; tasks: CalendarTaskRow[] }>
  onAdd: (date?: string) => void
  onOpen: (event: CompanyCalendarEvent) => void
  onOpenDay: (data: DayPanelData) => void
}) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1).getDay()
  const daysInMonth = new Date(year, m, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const today = localDateKey(new Date())
  const byDate = new Map<string, CompanyCalendarEvent[]>()
  for (const event of events) {
    const day = localDateKey(event.start_at)
    if (!byDate.has(day)) byDate.set(day, [])
    byDate.get(day)!.push(event)
  }
  return (
    <div>
      <div className="mb-1 hidden grid-cols-7 gap-px sm:grid">
        {DAY_NAMES.map(day => (
          <div key={day} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/30">{day}</div>
        ))}
      </div>
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] sm:grid">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="min-h-[108px] bg-[#0c0c0c]" />
          const date = `${month}-${String(day).padStart(2, '0')}`
          const dayEvents = byDate.get(date) ?? []
          const dayTasks = tasksByDate.get(date) ?? []
          const totalCount = dayEvents.length + dayTasks.length
          // Events first, then optional Planner tasks — capped at 4 chips per cell.
          const eventChips = dayEvents.slice(0, 4)
          const taskChips = dayTasks.slice(0, Math.max(0, 4 - eventChips.length))
          const shown = eventChips.length + taskChips.length
          const openDay = () => onOpenDay({ date, events: dayEvents, tasks: dayTasks })
          return (
            <div key={date} className={`min-h-[108px] p-1.5 ${date === today ? 'bg-brand-teal/[0.055]' : 'bg-[#0c0c0c]'}`}>
              <button
                type="button"
                onClick={() => onAdd(date)}
                className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${date === today ? 'bg-brand-teal text-black' : 'text-white/35 hover:bg-white/[0.06] hover:text-white'}`}
                title="Add event"
              >
                {day}
              </button>
              <div className="space-y-0.5">
                {eventChips.map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpen(event)}
                    className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] ${eventTypeStyle(event.event_type)}`}
                  >
                    <span className="min-w-0 truncate font-semibold">{event.title}</span>
                  </button>
                ))}
                {taskChips.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={openDay}
                    title={`Task: ${task.title}`}
                    className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] ${TASK_CHIP_CLS}`}
                  >
                    <span className="min-w-0 truncate">{task.title}</span>
                  </button>
                ))}
                {totalCount > shown && (
                  <button
                    type="button"
                    onClick={openDay}
                    className="w-full rounded border border-white/[0.06] bg-white/[0.025] px-1 py-0.5 text-left text-[10px] font-semibold text-white/45 hover:text-white"
                  >
                    +{totalCount - shown} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="space-y-5 sm:hidden">
        {groups.length === 0 ? (
          <EmptyState title={`Nothing in ${formatMonthHeading(month)}`} message="No company events or dated Planner tasks this month. See the diagnostics above." action={<ActionButton variant="outline" size="sm" onClick={() => onAdd()}>+ Add Event</ActionButton>} centered={false} />
        ) : groups.map(group => (
          <div key={group.day}>
            <button
              type="button"
              onClick={() => onOpenDay({ date: group.day, events: group.events, tasks: group.tasks })}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-left"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-white">{formatShortDate(group.day)}</span>
              <span className="text-[10px] font-bold text-brand-primary/55">
                {group.events.length + group.tasks.length} item{group.events.length + group.tasks.length === 1 ? '' : 's'}
              </span>
            </button>
            <div className="space-y-1.5">
              {group.events.map(event => <EventCard key={event.id} event={event} onClick={() => onOpen(event)} />)}
              {group.tasks.map(task => <TaskRowLink key={task.id} task={task} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Compact read-only rows for the agenda + day panel. Task chips link back to
// Planner — the calendar never edits Planner tasks.
function TaskRowLink({ task }: { task: CalendarTaskRow }) {
  return (
    <Link
      to="/admin/planner"
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:border-amber-300/50 ${TASK_CHIP_CLS}`}
    >
      <span className="shrink-0 rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide">Task</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{task.title}</span>
      {task.client_name && <span className="hidden shrink-0 text-amber-200/70 sm:inline">{task.client_name}</span>}
      {task.assigned_to_name && <span className="hidden shrink-0 text-amber-200/60 md:inline">@{task.assigned_to_name}</span>}
      <span className="shrink-0 text-amber-200/60">{PLANNER_TASK_STATUS_LABELS[task.status] ?? task.status}</span>
    </Link>
  )
}

function DayPanel({ data, onClose, onOpenEvent }: {
  data: DayPanelData
  onClose: () => void
  onOpenEvent: (event: CompanyCalendarEvent) => void
}) {
  const heading = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
  const total = data.events.length + data.tasks.length
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[440px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">{heading}</h2>
            <p className="mt-0.5 text-xs text-brand-primary/60">{total} item{total === 1 ? '' : 's'} across events and Planner tasks</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-primary hover:text-white">X</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {data.events.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300/70">Events</p>
              <div className="space-y-2">
                {data.events.map(event => <EventCard key={event.id} event={event} onClick={() => onOpenEvent(event)} />)}
              </div>
            </div>
          )}
          {data.tasks.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Planner tasks</p>
              <div className="space-y-1.5">
                {data.tasks.map(task => <TaskRowLink key={task.id} task={task} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function EventCard({ event, onClick }: { event: CompanyCalendarEvent; onClick: () => void }) {
  const { datePart, timePart } = formatEventTime(event.start_at)
  const isContentRun = event.event_type === 'content_run'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
        isContentRun
          ? 'border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.04] to-transparent hover:border-emerald-400/40'
          : 'border-white/8 bg-brand-surface/90 hover:border-white/20'
      } p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white group-hover:text-[#2dd4bf] transition-colors truncate">
            {event.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${eventTypeStyle(event.event_type)}`}>
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
            {event.client_name && (
              <span className="rounded-full border border-brand-teal/25 bg-brand-teal/[0.08] px-2 py-0.5 text-[10px] font-semibold text-[#2dd4bf]">
                {event.client_name}
              </span>
            )}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle(event.status)}`}>
              {EVENT_STATUS_LABELS[event.status]}
            </span>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-xs text-brand-primary/70">
              {datePart} · {timePart}
            </p>
            {event.location && (
              <p className="text-xs text-brand-primary/50">{event.location}</p>
            )}
            {event.assigned_to_name && (
              <p className="text-xs text-brand-primary/60">@{event.assigned_to_name}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function EventDrawer({ event, isAdmin, onClose, onSaved }: {
  event: CompanyCalendarEvent
  isAdmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !event.id || event.id === ''
  const [title, setTitle] = useState(event.title)
  const [eventType, setEventType] = useState<CompanyEventType>(event.event_type)
  const [clientId, setClientId] = useState(event.client_id ?? '')
  const [clientName, setClientName] = useState(event.client_name ?? '')
  const [startAt, setStartAt] = useState(isoToLocalDateTimeInput(event.start_at))
  const [endAt, setEndAt] = useState(isoToLocalDateTimeInput(event.end_at))
  const [allDay, setAllDay] = useState(event.all_day)
  const [location, setLocation] = useState(event.location ?? '')
  const [notes, setNotes] = useState(event.notes ?? '')
  const [assignedName, setAssignedName] = useState(event.assigned_to_name ?? '')
  const [status, setStatus] = useState<CompanyEventStatus>(event.status)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  async function handleSave() {
    if (saving || !title.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const startIso = startAt ? localDateTimeInputToIso(startAt) : new Date().toISOString()
      if (isNew) {
        const input: CompanyEventInput = {
          title: title.trim(),
          event_type: eventType,
          client_id: clientId || null,
          client_name: clientName || null,
          start_at: startIso,
          end_at: endAt ? localDateTimeInputToIso(endAt) : null,
          all_day: allDay,
          location: location.trim() || null,
          notes: notes.trim() || null,
          assigned_to_name: assignedName.trim() || null,
          status,
        }
        const result = await createCompanyEvent(input)
        if (result.tableMissing) {
          setSaveError('Company calendar SQL not applied yet. Run phase-10a migration.')
          return
        }
        if (result.error) { setSaveError(result.error.message); return }
      } else {
        const patch: CompanyEventPatch = {
          title: title.trim(),
          event_type: eventType,
          client_id: clientId || null,
          client_name: clientName || null,
          start_at: startIso,
          end_at: endAt ? localDateTimeInputToIso(endAt) : null,
          all_day: allDay,
          location: location.trim() || null,
          notes: notes.trim() || null,
          assigned_to_name: assignedName.trim() || null,
          status,
        }
        const result = await updateCompanyEvent(event.id, patch)
        if (result.tableMissing) {
          setSaveError('Company calendar SQL not applied yet. Run phase-10a migration.')
          return
        }
        if (result.error) { setSaveError(result.error.message); return }
      }
      onSaved()
    } catch {
      setSaveError('Could not save event.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const result = await deleteCompanyEvent(event.id)
      if (result.tableMissing) {
        setSaveError('Company calendar SQL not applied yet. Run phase-10a migration.')
        setDeleting(false)
        return
      }
      if (result.error) {
        setSaveError(result.error.message)
        setDeleting(false)
        return
      }
      onSaved()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#111111] sm:w-[480px] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 className="text-base font-semibold text-white">
            {isNew ? 'Add Event' : 'Edit Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-primary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Event title" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Event Type</label>
            <select value={eventType} onChange={e => setEventType(e.target.value as CompanyEventType)} className={inputCls}>
              {EVENT_TYPES.map(et => (
                <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Client</label>
            <ClientPicker
              value={clientId}
              label={clientName}
              onChange={client => {
                setClientId(client?.id ?? '')
                setClientName(client?.name ?? '')
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Start</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">End</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-brand-primary/75">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black"
            />
            All day
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className={inputCls} placeholder="Optional location" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label>
            <input value={assignedName} onChange={e => setAssignedName(e.target.value)} className={inputCls} placeholder="Staff name" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as CompanyEventStatus)} className={inputCls}>
              {(['planned', 'confirmed', 'completed', 'cancelled'] as const).map(s => (
                <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className={`resize-none ${inputCls}`}
            />
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-5 py-4">
          {saveError && <p className="mb-2 text-xs text-red-400">{saveError}</p>}
          <div className="flex items-center gap-3">
            <ActionButton
              variant="primary"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              loading={saving}
            >
              {isNew ? 'Create Event' : 'Save'}
            </ActionButton>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-brand-primary hover:text-white transition-colors"
            >
              Close
            </button>
            {!isNew && isAdmin && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
            {!isNew && isAdmin && confirmDelete && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-brand-primary">Sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {deleting ? 'Removing...' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-brand-primary hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
