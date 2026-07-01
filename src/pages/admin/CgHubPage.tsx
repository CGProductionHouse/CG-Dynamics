import { useState, useEffect, useMemo } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  monthKey,
  simplifyProductionStatus,
  type MonthlyDeliverable,
} from '../../lib/planner'
import {
  listCompanyEvents,
  EVENT_TYPE_LABELS,
  type CompanyCalendarEvent,
} from '../../lib/companyCalendar'

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
  return new Date().toISOString().slice(0, 10)
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
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
  return d.scheduled_date ?? d.due_date ?? d.month
}

// ── Hub Page ──────────────────────────────────────────────────

export default function CgHubPage() {
  const { profile } = useAuth()

  const today = useMemo(() => todayStr(), [])
  const currentMonth = useMemo(() => monthKey(new Date()), [])
  const todayNice = useMemo(() => todayLabel(), [])

  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [companyEvents, setCompanyEvents] = useState<CompanyCalendarEvent[]>([])
  const [companyEventsMissing, setCompanyEventsMissing] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  async function loadAll() {
    setLoadingData(true)
    const [tasksRes, delRes] = await Promise.all([
      listTasks(),
      listMonthlyDeliverablesByMonth(currentMonth),
    ])
    if (tasksRes.data) setTasks(tasksRes.data as CommandCentreTask[])
    if (delRes.data) setDeliverables(delRes.data as MonthlyDeliverable[])

    const companyRes = await listCompanyEvents()
    if (companyRes.tableMissing) {
      setCompanyEventsMissing(true)
    } else if (companyRes.data) {
      setCompanyEvents(companyRes.data as CompanyCalendarEvent[])
    }
    setLoadingData(false)
  }

  useEffect(() => { void loadAll() }, [currentMonth])

  // ── Derived data ────────────────────────────────────────────

  const activeTasks = useMemo(() =>
    tasks.filter(t => !HUB_EXCLUDED_STATUS.has(t.status)),
  [tasks])

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
    const myName = profile?.full_name
    if (!myName) return []
    return activeTasks.filter(t => t.assigned_to_name === myName)
  }, [activeTasks, profile])

  // Production Schedule derived
  const dueTodayDeliverables = useMemo(() =>
    deliverables.filter(d => deliverableDate(d) === today),
  [deliverables, today])

  const upcomingDeliverables = useMemo(() =>
    deliverables.filter(d => {
      const date = deliverableDate(d)
      return date && date > today
    }).sort((a, b) => (deliverableDate(a) ?? '').localeCompare(deliverableDate(b) ?? '')).slice(0, 10),
  [deliverables, today])

  const unscheduledDeliverables = useMemo(() =>
    deliverables.filter(d => {
      const prodStatus = simplifyProductionStatus(d.production_status)
      return prodStatus !== 'scheduled_posted' && !d.scheduled_date && !d.due_date
    }),
  [deliverables])

  const waitingDeliverables = useMemo(() =>
    deliverables.filter(d => {
      const s = simplifyProductionStatus(d.production_status)
      return s === 'ready_review' || s === 'awaiting_client' || s === 'meta_drafts'
    }),
  [deliverables])

  // CG Calendar derived
  const todayCompanyEvents = useMemo(() => {
    const todayStart = `${today}T00:00:00`
    const todayEnd = `${today}T23:59:59`
    return companyEvents.filter(e =>
      e.status !== 'cancelled' &&
      e.start_at >= todayStart &&
      e.start_at <= todayEnd
    )
  }, [companyEvents, today])

  const upcomingCompanyEvents = useMemo(() => {
    const todayStart = `${today}T00:00:00`
    return companyEvents.filter(e =>
      e.status !== 'cancelled' &&
      e.start_at >= todayStart
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

  const isAdmin = profile?.role === 'admin'

  async function handleQuickAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quickTitle.trim() || quickSaving) return
    setQuickSaving(true)
    const input: TaskInput = {
      title: quickTitle.trim(),
      bucket: 'Admin / To Do',
      priority: 'normal',
      status: 'to_do',
      due_date: today,
      source: 'manual',
      assigned_to_name: profile?.full_name ?? null,
    }
    await createTask(input)
    setQuickTitle('')
    void loadAll()
    setQuickSaving(false)
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
      </div>

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

          {/* C — Today's CG Calendar */}
          <CompanyCalendarSection
            todayCompanyEvents={todayCompanyEvents}
            upcomingCompanyEvents={upcomingCompanyEvents}
            companyEventsMissing={companyEventsMissing}
          />

          {/* D — Production Schedule */}
          <ProductionScheduleSection
            dueTodayDeliverables={dueTodayDeliverables}
            upcomingDeliverables={upcomingDeliverables}
            unscheduledDeliverables={unscheduledDeliverables}
          />

          {/* E — Clients Needing Attention */}
          {clientsNeedingAttention.length > 0 && (
            <ClientsAttentionSection clients={clientsNeedingAttention} />
          )}

          {/* F — Quick Launch */}
          <QuickLaunchSection isAdmin={isAdmin} />

          {/* G — AI Marketing Agent */}
          <AiMarketingSection />
        </>
      )}
    </div>
  )
}

// ── B: Today Focus ─────────────────────────────────────────────

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
                {new Date(event.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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

// ── F: Quick Launch ───────────────────────────────────────────

const LAUNCH_ITEMS = [
  { label: 'Daily Tasks', detail: 'Your work list for today', to: '/admin/command-centre', icon: '📋' },
  { label: 'Client Schedule', detail: 'Monthly deliverables', to: '/admin/client-schedule?view=calendar', icon: '📅' },
  { label: 'CG Calendar', detail: 'Meetings & events', to: '/admin/cg-calendar', icon: '🗓' },
  { label: 'Clients', detail: 'Reports, Meta, packages', to: '/admin/clients', icon: '👥' },
  { label: 'Assistant', detail: 'Staff helper', to: '/admin/assistant', icon: 'AI' },
  { label: 'CG Hours', detail: 'Time tracking', to: 'https://cg-hours.vercel.app', icon: 'HR' },
]

function QuickLaunchSection({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate()
  const items = isAdmin
    ? [...LAUNCH_ITEMS, { label: 'Import Health', detail: 'Admin only', to: '/admin/import-health', icon: '🔧' }]
    : LAUNCH_ITEMS

  return (
    <div className="mb-8">
      <HubSectionHeader title="Quick Launch" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.to.startsWith('https://') ? window.open(item.to, '_blank', 'noopener,noreferrer') : navigate(item.to)}
            className="group min-h-24 rounded-xl border border-white/8 bg-white/[0.035] p-4 text-left transition-all hover:border-[#2dd4bf]/30 hover:bg-[#2dd4bf]/[0.06]"
          >
            <div className="flex h-full flex-col justify-between">
              <h2 className="font-display text-lg font-black uppercase tracking-wide text-white">
                {item.label}
              </h2>
              <p className="mt-1 text-sm text-brand-primary/72">{item.detail}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── G: AI Marketing Agent ─────────────────────────────────────

const AI_MARKETING_ITEMS = [
  { label: 'Master Marketing Library', to: '/admin/marketing-library', status: 'coming_soon' as const },
  { label: 'Skill Cards', to: '/admin/skill-cards', status: 'coming_soon' as const },
  { label: 'Campaign Builder', to: '/admin/campaign-builder', status: 'coming_soon' as const },
  { label: 'Client Brand Knowledge', to: '/admin/client-brand-knowledge', status: 'coming_soon' as const },
]

function AiMarketingSection() {
  return (
    <div className="mb-8">
      <HubSectionHeader
        title="AI Marketing Agent"
        subtitle="Separate section — coming soon"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AI_MARKETING_ITEMS.map(item => (
          <div
            key={item.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 opacity-60"
          >
            <h3 className="text-sm font-semibold text-white/70">{item.label}</h3>
            <p className="mt-1 text-xs text-brand-primary/50 capitalize">{item.status.replace('_', ' ')}</p>
          </div>
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
      to="/admin/command-centre"
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
