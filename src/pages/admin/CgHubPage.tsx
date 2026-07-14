import { useState, useEffect, useEffectEvent, useMemo } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  listTasks,
  createTask,
  type CommandCentreTask,
  type TaskInput,
  type TaskStatus,
} from '../../lib/commandCentre'
import {
  listMonthlyDeliverablesByMonth,
  simplifyProductionStatus,
  type MonthlyDeliverable,
} from '../../lib/planner'
import {
  listCompanyEvents,
  EVENT_TYPE_LABELS,
  type CompanyCalendarEvent,
} from '../../lib/companyCalendar'
import { getMyDayContext, sourceLabel, type MyDayContext, type MyDayItem } from '../../lib/workforceMyDay'
import { businessDateKey, businessDayBoundaryIso, businessMonthKey, formatBusinessDate, formatBusinessTime } from '../../lib/businessTime'
import { isManagerRole } from '../../lib/roles'

// ── Constants ─────────────────────────────────────────────────

const HUB_COMPLETED = new Set<TaskStatus>(['done', 'moved_to_tomorrow'])
const HUB_EXCLUDED_STATUS = new Set<TaskStatus>(['done', 'moved_to_tomorrow'])


const PRIORITY_RANK: Record<string, number> = {
  client_request: 0,
  urgent: 1,
  normal: 3,
}

const TASK_STATUS_SHORT: Record<string, string> = {
  to_do: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  waiting_client: 'Waiting',
  done: 'Done',
}

const DELIVERABLE_TYPE_CODE: Record<string, string> = {
  dp: 'DP', photo: 'F', video: 'Vid', reel: 'Reel',
  content_run: 'Run', website_update: 'Web', monthly_report: 'Rpt',
  strategy: 'Str', admin: 'Adm', other: 'Oth',
}

const DELIVERABLE_STATUS_SHORT: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_review: 'For review',
  awaiting_client: 'Client review',
  meta_drafts: 'Meta drafts',
  scheduled_posted: 'Scheduled',
}

// ── Helpers ───────────────────────────────────────────────────

function todayStr() {
  return businessDateKey()
}

function todayLabel() {
  return formatBusinessDate(new Date(), {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function localDateKeyFromIso(value: string) {
  return businessDateKey(value) || value.slice(0, 10)
}

function workMatchesProfile(work: { assigned_to_user_id?: string | null; assigned_to_name?: string | null; helper_names?: string[] }, profile: { id?: string; full_name?: string | null } | null) {
  if (work.assigned_to_user_id && profile?.id && work.assigned_to_user_id === profile.id) return true
  const name = profile?.full_name?.trim().toLowerCase()
  if (!name) return false
  if (work.assigned_to_name?.trim().toLowerCase() === name) return true
  return work.helper_names?.some(helper => helper.trim().toLowerCase() === name) ?? false
}

function isOverdueTask(task: CommandCentreTask, today: string) {
  return !!task.due_date && task.due_date < today && !HUB_COMPLETED.has(task.status)
}

function taskPriorityRank(t: CommandCentreTask, today: string): number {
  if (t.priority === 'client_request') return 0
  if (t.priority === 'urgent') return 1
  if (t.due_date && t.due_date < today) return 2
  if (t.due_date === today) return 3
  if (t.status === 'in_progress') return 4
  return 5
}

function deliverableDate(d: MonthlyDeliverable) {
  return d.scheduled_date ?? d.due_date ?? null
}

// ── Hub Page ──────────────────────────────────────────────────

export default function CgHubPage() {
  const { profile } = useAuth()

  const today = useMemo(() => todayStr(), [])
  const currentMonth = useMemo(() => businessMonthKey(), [])
  const todayNice = useMemo(() => todayLabel(), [])

  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [companyEvents, setCompanyEvents] = useState<CompanyCalendarEvent[]>([])
  const [companyEventsMissing, setCompanyEventsMissing] = useState(false)
  const [myDayContext, setMyDayContext] = useState<MyDayContext | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickMessage, setQuickMessage] = useState<string | null>(null)
  const [loadErrors, setLoadErrors] = useState<string[]>([])

  async function loadAll() {
    setLoadingData(true)
    setLoadErrors([])
    try {
      const [tasksRes, delRes, companyRes, myDay] = await Promise.all([
        listTasks(),
        listMonthlyDeliverablesByMonth(currentMonth),
        listCompanyEvents(businessDayBoundaryIso(today), businessDayBoundaryIso(today, 31)),
        getMyDayContext(profile),
      ])
      setLoadErrors([tasksRes.error?.message, delRes.error?.message, companyRes.error?.message].filter(Boolean) as string[])
      setTasks((tasksRes.data ?? []) as CommandCentreTask[])
      setDeliverables((delRes.data ?? []) as MonthlyDeliverable[])
      setCompanyEventsMissing(companyRes.tableMissing)
      setCompanyEvents((companyRes.data ?? []) as CompanyCalendarEvent[])
      setMyDayContext(myDay)
    } catch (error) {
      setLoadErrors([error instanceof Error ? error.message : 'Could not load Hub data.'])
      setTasks([])
      setDeliverables([])
      setCompanyEvents([])
      setMyDayContext(null)
    } finally {
      setLoadingData(false)
    }
  }

  const loadAllEvent = useEffectEvent(loadAll)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [currentMonth, profile?.id])

  // ── Derived data ────────────────────────────────────────────

  const canSeeTeamWork = isManagerRole(profile?.role)
  const activeTasks = useMemo(() => tasks.filter(task =>
    !HUB_EXCLUDED_STATUS.has(task.status) && (canSeeTeamWork || workMatchesProfile(task, profile))),
  [canSeeTeamWork, profile, tasks])

  const relevantDeliverables = useMemo(() => deliverables.filter(deliverable =>
    canSeeTeamWork || workMatchesProfile(deliverable, profile)),
  [canSeeTeamWork, deliverables, profile])

  const priorityQueue = useMemo(() => {
    return activeTasks
      .filter(t =>
        t.priority === 'client_request' ||
        t.priority === 'urgent' ||
        (t.due_date && t.due_date <= today) ||
        t.status === 'in_progress'
      )
      .sort((a, b) => taskPriorityRank(a, today) - taskPriorityRank(b, today))
  }, [activeTasks, today])

  const dueToday = useMemo(() =>
    activeTasks.filter(t => t.due_date === today).sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)),
  [activeTasks, today])

  const overdue = useMemo(() =>
    activeTasks.filter(t => isOverdueTask(t, today)).sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)),
  [activeTasks, today])

  const clientRequests = useMemo(() =>
    activeTasks.filter(t => t.priority === 'client_request'),
  [activeTasks])

  const waitingReview = useMemo(() =>
    activeTasks.filter(t => t.status === 'blocked' || t.status === 'waiting_client'),
  [activeTasks])

  const myActiveWork = useMemo(() => {
    return activeTasks.filter(t => workMatchesProfile(t, profile))
  }, [activeTasks, profile])

  // Production Schedule derived
  const dueTodayDeliverables = useMemo(() =>
    relevantDeliverables.filter(d => deliverableDate(d) === today && simplifyProductionStatus(d.production_status) !== 'scheduled_posted'),
  [relevantDeliverables, today])

  const upcomingDeliverables = useMemo(() =>
    relevantDeliverables.filter(d => {
      const date = deliverableDate(d)
      return date && date > today && simplifyProductionStatus(d.production_status) !== 'scheduled_posted'
    }).sort((a, b) => (deliverableDate(a) ?? '').localeCompare(deliverableDate(b) ?? '')).slice(0, 10),
  [relevantDeliverables, today])

  const unscheduledDeliverables = useMemo(() =>
    relevantDeliverables.filter(d => {
      const prodStatus = simplifyProductionStatus(d.production_status)
      return prodStatus !== 'scheduled_posted' && !d.scheduled_date && !d.due_date
    }),
  [relevantDeliverables])

  const waitingDeliverables = useMemo(() =>
    relevantDeliverables.filter(d => {
      const s = simplifyProductionStatus(d.production_status)
      return s === 'ready_review' || s === 'awaiting_client' || s === 'meta_drafts'
    }),
  [relevantDeliverables])

  // CG Calendar derived
  const todayCompanyEvents = useMemo(() => {
    return companyEvents.filter(e =>
      e.status !== 'cancelled' &&
      localDateKeyFromIso(e.start_at) === today
    )
  }, [companyEvents, today])

  const upcomingCompanyEvents = useMemo(() => {
    return companyEvents.filter(e =>
      e.status !== 'cancelled' &&
      localDateKeyFromIso(e.start_at) >= today
    ).sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 5)
  }, [companyEvents, today])

  // Clients needing attention
  const clientsNeedingAttention = useMemo(() => {
    const clientMap = new Map<string, {
      name: string
      clientId: string
      openRequests: number
      overdueTasks: number
      waitingDeliverables: number
      unscheduledItems: number
    }>()

    for (const t of clientRequests) {
      const name = t.client_name ?? 'Unknown'
      if (!clientMap.has(name)) clientMap.set(name, { name, clientId: t.client_id ?? '', openRequests: 0, overdueTasks: 0, waitingDeliverables: 0, unscheduledItems: 0 })
      clientMap.get(name)!.openRequests++
    }

    for (const t of overdue) {
      const name = t.client_name ?? 'Unknown'
      if (!clientMap.has(name)) clientMap.set(name, { name, clientId: t.client_id ?? '', openRequests: 0, overdueTasks: 0, waitingDeliverables: 0, unscheduledItems: 0 })
      clientMap.get(name)!.overdueTasks++
    }

    for (const d of waitingDeliverables) {
      const name = deliverables.find(dd => dd.id === d.id)?.title ?? 'Unknown'
      if (!clientMap.has(name)) {
        const clientName = deliverables.find(dd => dd.id === d.id)?.client_id ?? ''
        if (clientName) {
          if (!clientMap.has(clientName)) {
            const clientObj = tasks.find(t => t.client_id === clientName)
            clientMap.set(clientName, { name: clientObj?.client_name ?? 'Unknown', clientId: clientName, openRequests: 0, overdueTasks: 0, waitingDeliverables: 0, unscheduledItems: 0 })
          }
        }
      }
    }

    const clientTaskMap = new Map<string, { openRequests: number; overdueTasks: number }>()
    for (const t of clientRequests) {
      const id = t.client_id ?? '__unknown__'
      if (!clientTaskMap.has(id)) clientTaskMap.set(id, { openRequests: 0, overdueTasks: 0 })
      const entry = clientTaskMap.get(id)!
      entry.openRequests++
    }
    for (const t of overdue) {
      const id = t.client_id ?? '__unknown__'
      if (!clientTaskMap.has(id)) clientTaskMap.set(id, { openRequests: 0, overdueTasks: 0 })
      const entry = clientTaskMap.get(id)!
      entry.overdueTasks++
    }

    const result: Array<{ name: string; clientId: string; openRequests: number; overdueTasks: number; waitingDeliverables: number; unscheduledItems: number }> = []

    for (const [id, counts] of clientTaskMap) {
      if (id === '__unknown__') continue
      const name = tasks.find(t => t.client_id === id)?.client_name ?? id
      result.push({ name, clientId: id, ...counts, waitingDeliverables: 0, unscheduledItems: 0 })
    }

    return result.sort((a, b) => (b.openRequests + b.overdueTasks) - (a.openRequests + a.overdueTasks))
  }, [clientRequests, overdue, waitingDeliverables, deliverables, tasks])

  const stats = useMemo(() => ({
    focus: priorityQueue.length,
    clientRequests: clientRequests.length,
    dueToday: dueToday.length,
    overdue: overdue.length,
    inProgress: activeTasks.filter(t => t.status === 'in_progress').length,
    waitingReview: waitingReview.length,
    dueTodayDeliverables: dueTodayDeliverables.length,
    unscheduledDeliverables: unscheduledDeliverables.length,
  }), [priorityQueue, clientRequests, dueToday, overdue, activeTasks, waitingReview, dueTodayDeliverables, unscheduledDeliverables.length])

  async function handleQuickAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quickTitle.trim() || quickSaving) return
    setQuickSaving(true)
    setQuickMessage(null)
    const input: TaskInput = {
      title: quickTitle.trim(),
      bucket: 'Admin / To Do',
      priority: 'normal',
      status: 'to_do',
      due_date: today,
      source: 'manual',
      assigned_to_user_id: profile?.id ?? null,
      assigned_to_name: profile?.full_name ?? null,
    }
    try {
      const result = await createTask(input)
      if (result.error) {
        setQuickMessage(result.error.message)
        return
      }
      setQuickTitle('')
      setQuickMessage('Task added to Daily Tasks.')
      await loadAll()
    } catch (error) {
      setQuickMessage(error instanceof Error ? error.message : 'Could not add task.')
    } finally {
      setQuickSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      {/* A — Hero Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#2dd4bf]">CG Production House</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-6xl">
              CG Hub
            </h1>
            <p className="mt-2 text-sm text-brand-primary/70">{todayNice}</p>
          </div>
          <form onSubmit={handleQuickAdd} className="flex min-w-0 items-center gap-2 sm:max-w-xs">
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Quick Add Task..."
              disabled={quickSaving}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-brand-primary/30 focus:border-[#2dd4bf]/40 focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!quickTitle.trim() || quickSaving}
              className="shrink-0 rounded-lg bg-[#2dd4bf] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-black transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {quickSaving ? '...' : 'Add'}
            </button>
          </form>
        </div>
        {quickMessage && <p className="mt-2 text-xs text-brand-primary/70">{quickMessage}</p>}
      </div>

      {loadErrors.length > 0 && (
        <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-100">
          <p className="font-semibold">Some Hub data could not load.</p>
          {loadErrors.map(error => <p key={error} className="mt-1 text-xs text-red-100/75">{error}</p>)}
        </div>
      )}

      {loadingData ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
        </div>
      ) : (
        <>
          {/* B — Today Focus */}
          <MyDayHubCard context={myDayContext} />

          {/* C — Today Focus */}
          <TodayFocusSection
            today={today}
            priorityQueue={priorityQueue}
            dueToday={dueToday}
            overdue={overdue}
            clientRequests={clientRequests}
            waitingReview={waitingReview}
            myActiveWork={myActiveWork}
            stats={stats}
          />

          {/* D — Today's CG Calendar */}
          <CompanyCalendarSection
            todayCompanyEvents={todayCompanyEvents}
            upcomingCompanyEvents={upcomingCompanyEvents}
            companyEventsMissing={companyEventsMissing}
          />

          {/* E — Production Schedule */}
          <ProductionScheduleSection
            dueTodayDeliverables={dueTodayDeliverables}
            upcomingDeliverables={upcomingDeliverables}
            unscheduledDeliverables={unscheduledDeliverables}
          />

          {/* F — Clients Needing Attention */}
          {clientsNeedingAttention.length > 0 && (
            <ClientsAttentionSection clients={clientsNeedingAttention} />
          )}

        </>
      )}
    </div>
  )
}

// ── B: Today Focus ─────────────────────────────────────────────

function MyDayHubCard({ context }: { context: MyDayContext | null }) {
  if (!context) return null

  const focusCount = context.overdue.length + context.dueToday.length
  const currentItem = context.summary.currentTask
  const nextItem = context.summary.nextTask
  const todayEvents = context.events.filter(item => item.date === context.today).length
  const clientWork = context.deliverables.length
  const plannedHours = Math.round(context.summary.plannedMinutes / 60)

  return (
    <div className="mb-8 rounded-2xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_36%),rgba(255,255,255,0.035)] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">My Day</p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-white">
            {currentItem ? currentItem.title : focusCount > 0 ? `${focusCount} focus item${focusCount === 1 ? '' : 's'} today` : 'Your assigned day is clear'}
          </h2>
          <p className="mt-1 text-sm text-brand-primary/65">
            {nextItem ? `Next: ${nextItem.title}` : context.summary.suggestedNextAction}
          </p>
          {context.summary.workloadWarning && (
            <p className="mt-2 text-xs font-semibold text-amber-200">{context.summary.workloadWarning}</p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <MyDayFocusCard label="Current focus" item={currentItem} />
            <MyDayFocusCard label="Next up" item={nextItem} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-brand-primary">
            {context.overdue.length} overdue
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-brand-primary">
            {context.dueToday.length} due today
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-brand-primary">
            {todayEvents} event{todayEvents === 1 ? '' : 's'} today
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-brand-primary">
            {clientWork} client work
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold text-brand-primary">
            {plannedHours}h planned
          </span>
          <Link
            to="/admin/my-day"
            className="mt-1 w-full rounded-lg border border-brand-teal/30 bg-brand-teal/[0.08] px-4 py-2.5 text-center text-xs font-black uppercase tracking-[0.1em] text-[#2dd4bf] transition hover:border-brand-teal/60 hover:text-white lg:mt-2"
          >
            Open My Day
          </Link>
        </div>
      </div>
    </div>
  )
}

function MyDayFocusCard({ label, item }: { label: string; item: MyDayItem | null }) {
  if (!item) {
    return (
      <div className="rounded-xl border border-white/8 bg-black/20 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary/40">{label}</p>
        <p className="mt-1 text-sm text-brand-primary/45">Nothing assigned</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary/40">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{item.title}</p>
      <p className="mt-1 text-xs text-brand-primary/50">
        {sourceLabel(item.source)}{item.clientName ? ` · ${item.clientName}` : ''}
      </p>
    </div>
  )
}

function TodayFocusSection({
  today,
  priorityQueue,
  dueToday,
  overdue,
  clientRequests,
  waitingReview,
  myActiveWork,
  stats,
}: {
  today: string
  priorityQueue: CommandCentreTask[]
  dueToday: CommandCentreTask[]
  overdue: CommandCentreTask[]
  clientRequests: CommandCentreTask[]
  waitingReview: CommandCentreTask[]
  myActiveWork: CommandCentreTask[]
  stats: { focus: number; clientRequests: number; dueToday: number; overdue: number; inProgress: number; waitingReview: number; dueTodayDeliverables: number; unscheduledDeliverables: number }
}) {
  return (
    <div className="mb-8">
      <HubSectionHeader
        title="Today Focus"
        subtitle="What needs your attention"
      />

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HubMetricCard label="Priority Queue" value={stats.focus} accent={stats.focus > 0} />
        <HubMetricCard label="Due Today" value={stats.dueToday} accent={stats.dueToday > 0} />
        <HubMetricCard label="Overdue" value={stats.overdue} danger={stats.overdue > 0} />
        <HubMetricCard label="Client Requests" value={stats.clientRequests} accent={stats.clientRequests > 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HubWorkCard
          title="Priority Queue"
          count={priorityQueue.length}
          viewAllTo="/admin/command-centre"
          emptyText="No urgent tasks right now"
        >
          {priorityQueue.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Due Today"
          count={dueToday.length}
          viewAllTo="/admin/command-centre"
          emptyText="No tasks due today"
        >
          {dueToday.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Overdue"
          count={overdue.length}
          viewAllTo="/admin/command-centre"
          emptyText="Nothing overdue"
          danger
        >
          {overdue.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Client Requests"
          count={clientRequests.length}
          viewAllTo="/admin/command-centre"
          emptyText="No client requests waiting"
        >
          {clientRequests.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Waiting for Review"
          count={waitingReview.length}
          viewAllTo="/admin/command-centre"
          emptyText="Nothing waiting for review"
        >
          {waitingReview.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="My Active Work"
          count={myActiveWork.length}
          viewAllTo="/admin/command-centre"
          emptyText="No active tasks assigned to you"
        >
          {myActiveWork.slice(0, 5).map(t => (
            <TaskRow key={t.id} task={t} todayStr={today} />
          ))}
        </HubWorkCard>
      </div>
    </div>
  )
}

// ── C: Today's CG Calendar ───────────────────────────────

function CompanyCalendarSection({
  todayCompanyEvents,
  upcomingCompanyEvents,
  companyEventsMissing,
}: {
  todayCompanyEvents: CompanyCalendarEvent[]
  upcomingCompanyEvents: CompanyCalendarEvent[]
  companyEventsMissing: boolean
}) {
  if (companyEventsMissing) {
    return (
      <div className="mb-8">
        <HubSectionHeader title="Today's CG Calendar" />
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
          <p className="text-xs text-amber-300/80">
            CG Calendar setup needed. Run phase-10a SQL to enable company events.
          </p>
          <Link
            to="/admin/cg-calendar"
            className="mt-2 inline-block text-xs font-semibold text-[#2dd4bf] hover:text-white transition-colors"
          >
            Open CG Calendar →
          </Link>
        </div>
      </div>
    )
  }

  const displayEvents = todayCompanyEvents.length > 0 ? todayCompanyEvents : upcomingCompanyEvents.slice(0, 5)

  return (
    <div className="mb-8">
      <HubSectionHeader
        title="Today's CG Calendar"
        subtitle={todayCompanyEvents.length > 0 ? `${todayCompanyEvents.length} event${todayCompanyEvents.length === 1 ? '' : 's'} today` : 'No events today'}
      />

      {displayEvents.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-brand-surface/90 p-4">
          <p className="text-sm text-brand-primary/60">No company events today.</p>
          <Link
            to="/admin/cg-calendar"
            className="mt-2 inline-block text-xs font-semibold text-[#2dd4bf] hover:text-white transition-colors"
          >
            Open CG Calendar →
          </Link>
        </div>
      ) : (
        <div className="grid gap-2">
          {displayEvents.slice(0, 5).map(event => (
            <Link
              key={event.id}
              to="/admin/cg-calendar"
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                event.event_type === 'content_run'
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : event.event_type === 'shoot'
                    ? 'bg-purple-400/15 text-purple-300'
                    : event.event_type === 'meeting'
                      ? 'bg-sky-400/15 text-sky-300'
                      : event.event_type === 'deadline'
                        ? 'bg-red-400/15 text-red-300'
                        : 'bg-white/10 text-brand-primary'
              }`}>
                {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{event.title}</p>
              {event.client_name && (
                <span className="shrink-0 rounded-full border border-brand-teal/25 bg-brand-teal/[0.08] px-2 py-0.5 text-[10px] font-semibold text-[#2dd4bf]">
                  {event.client_name}
                </span>
              )}
              <span className="shrink-0 text-xs text-brand-primary/60">
                {event.all_day ? 'All day' : formatBusinessTime(event.start_at)}
              </span>
            </Link>
          ))}
          <Link
            to="/admin/cg-calendar"
            className="mt-1 text-xs font-semibold text-[#2dd4bf] hover:text-white transition-colors"
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── D: Production Schedule ────────────────────────────────────

function ProductionScheduleSection({
  dueTodayDeliverables,
  upcomingDeliverables,
  unscheduledDeliverables,
}: {
  dueTodayDeliverables: MonthlyDeliverable[]
  upcomingDeliverables: MonthlyDeliverable[]
  unscheduledDeliverables: MonthlyDeliverable[]
}) {
  return (
    <div className="mb-8">
      <HubSectionHeader
        title="Production Schedule"
        subtitle="Package deliverables and schedule"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubWorkCard
          title="Package Due Today"
          count={dueTodayDeliverables.length}
          viewAllTo="/admin/client-schedule?view=calendar"
          emptyText="No package work due today"
          accentColor
        >
          {dueTodayDeliverables.slice(0, 5).map(d => (
            <DeliverableRow key={d.id} deliverable={d} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Upcoming Scheduled"
          count={upcomingDeliverables.length}
          viewAllTo="/admin/client-schedule?view=calendar"
          emptyText="No upcoming scheduled package work"
        >
          {upcomingDeliverables.slice(0, 5).map(d => (
            <DeliverableRow key={d.id} deliverable={d} />
          ))}
        </HubWorkCard>

        <HubWorkCard
          title="Needs Scheduling"
          count={unscheduledDeliverables.length}
          viewAllTo="/admin/client-schedule?mode=unscheduled"
          emptyText="Package schedule is clean"
          danger={unscheduledDeliverables.length > 0}
        >
          {unscheduledDeliverables.slice(0, 5).map(d => (
            <DeliverableRow key={d.id} deliverable={d} />
          ))}
        </HubWorkCard>
      </div>
    </div>
  )
}

// ── E: Clients Needing Attention ──────────────────────────────

function ClientsAttentionSection({ clients }: {
  clients: Array<{ name: string; clientId: string; openRequests: number; overdueTasks: number; waitingDeliverables: number; unscheduledItems: number }>
}) {
  return (
    <div className="mb-8">
      <HubSectionHeader
        title="Clients Needing Attention"
        subtitle={`${clients.length} client${clients.length === 1 ? '' : 's'} with open items`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clients.slice(0, 6).map(client => (
          <Link
            key={client.clientId}
            to="/admin/clients"
            className="rounded-xl border border-white/8 bg-brand-surface/90 p-4 transition-all hover:border-white/20"
          >
            <p className="text-sm font-semibold text-white">{client.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {client.openRequests > 0 && (
                <span className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-[#f2b66f]">
                  {client.openRequests} request{client.openRequests !== 1 ? 's' : ''}
                </span>
              )}
              {client.overdueTasks > 0 && (
                <span className="rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  {client.overdueTasks} overdue
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Shared Sub-Components ─────────────────────────────────────

function HubSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-display text-xl font-black uppercase tracking-wide text-white sm:text-2xl">{title}</h2>
      <div className="h-px flex-1 bg-white/10" />
      {subtitle && <p className="shrink-0 text-xs text-brand-primary/50">{subtitle}</p>}
    </div>
  )
}

function HubMetricCard({ label, value, accent, danger }: {
  label: string
  value: number
  accent?: boolean
  danger?: boolean
}) {
  const valClass = danger
    ? 'text-red-400'
    : accent ? 'text-[#2dd4bf]'
    : 'text-white'
  return (
    <div className="rounded-xl border border-white/8 bg-brand-surface/80 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-brand-primary/50">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valClass}`}>{value}</p>
    </div>
  )
}

function HubWorkCard({
  title,
  count,
  viewAllTo,
  emptyText,
  danger,
  accentColor,
  children,
}: {
  title: string
  count: number
  viewAllTo: string
  emptyText: string
  danger?: boolean
  accentColor?: boolean
  children: ReactNode
}) {
  return (
    <div className={`rounded-xl border ${danger ? 'border-red-400/15' : accentColor ? 'border-[#2dd4bf]/15' : 'border-white/8'} bg-brand-surface/80 p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/55">{title}</p>
        {count > 0 && (
          <Link to={viewAllTo} className="shrink-0 text-xs font-bold text-[#2dd4bf]/75 hover:text-[#2dd4bf]">
            All {count} →
          </Link>
        )}
      </div>
      {count === 0 ? (
        <p className="text-sm text-brand-primary/40">{emptyText}</p>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  )
}

function TaskRow({ task, todayStr }: { task: CommandCentreTask; todayStr: string }) {
  const isClientReq = task.priority === 'client_request'
  const isUrgent = task.priority === 'urgent'
  const isOverdue = !!task.due_date && task.due_date < todayStr
  const isToday = task.due_date === todayStr

  const dotClass = isClientReq
    ? 'bg-[#f2b66f]'
    : isUrgent || isOverdue
      ? 'bg-red-400'
      : isToday
        ? 'bg-[#2dd4bf]'
        : 'bg-white/20'

  const dueDateLabel = isOverdue
    ? 'Overdue'
    : isToday
      ? 'Today'
      : task.due_date
        ? task.due_date.slice(5).replace('-', '/')
        : ''

  const meta = [task.client_name, dueDateLabel].filter(Boolean).join(' · ')

  return (
    <Link
      to={task.data_origin === 'planner_tasks' ? '/admin/planner' : '/admin/command-centre'}
      className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
    >
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{task.title}</p>
        {meta && <p className="mt-0.5 text-xs text-brand-primary/45">{meta}</p>}
      </div>
      <span className="shrink-0 text-xs font-semibold text-brand-primary/40">
        {TASK_STATUS_SHORT[task.status] ?? task.status}
      </span>
    </Link>
  )
}

function DeliverableRow({ deliverable }: { deliverable: MonthlyDeliverable }) {
  const simplified = simplifyProductionStatus(deliverable.production_status)

  const statusClass =
    simplified === 'scheduled_posted'
      ? 'text-white/25'
      : simplified === 'in_progress'
        ? 'text-[#2dd4bf]/65'
        : 'text-brand-primary/40'

  return (
    <Link
      to="/admin/client-schedule?view=calendar"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
    >
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-[#2dd4bf]/10 text-[#2dd4bf]">
        {DELIVERABLE_TYPE_CODE[deliverable.deliverable_type] ?? deliverable.deliverable_type}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{deliverable.title}</p>
      <span className={`shrink-0 text-xs font-semibold ${statusClass}`}>
        {DELIVERABLE_STATUS_SHORT[simplified] ?? simplified}
      </span>
    </Link>
  )
}
