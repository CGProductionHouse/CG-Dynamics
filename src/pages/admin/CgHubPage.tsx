import { useState, useEffect, useMemo } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  listTasks,
  createTask,
  type CommandCentreTask,
  type TaskInput,
} from '../../lib/commandCentre'
import {
  listMonthlyDeliverablesByMonth,
  monthKey,
  simplifyProductionStatus,
  type MonthlyDeliverable,
} from '../../lib/planner'

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

const ONE_DRIVE_LINKS = [
  {
    label: 'CG OneDrive',
    detail: 'Internal files and assets',
    href: 'https://cgproductionhouse365-my.sharepoint.com/:f:/g/personal/info_cgproductionhouse_com/IgC0gAsW73aeQq8CjNUBdEfmAUK5IYEyo8z5crwYCYmKPh0?e=dJbeui',
  },
  {
    label: 'Client OneDrive',
    detail: 'Client-shared folders',
    href: '', // TODO: add Client OneDrive URL
  },
  {
    label: 'Once-Off OneDrive',
    detail: 'Once-off project files',
    href: '', // TODO: add Once-Off OneDrive URL
  },
]

const launchItems = [
  { label: 'Planner', detail: 'Schedule and monthly content', to: '/admin/planner' },
  { label: 'Daily Tasks', detail: 'Your work list for today', to: '/admin/command-centre' },
  { label: 'Clients', detail: 'Reports, Meta, packages', to: '/admin/clients' },
  { label: 'Assistant', detail: 'Drafts and checks', to: '/admin/assistant' },
]

const HUB_COMPLETED = new Set(['done', 'approved', 'scheduled', 'scheduled_posted', 'moved_to_tomorrow'])

const TASK_STATUS_SHORT: Record<string, string> = {
  to_do: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  waiting_client: 'Waiting',
  moved_to_tomorrow: 'Moved',
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

function taskPriorityRank(t: CommandCentreTask, today: string): number {
  if (t.priority === 'client_request') return 0
  if (t.priority === 'urgent') return 1
  if (t.due_date && t.due_date < today) return 2
  if (t.due_date === today) return 3
  if (t.status === 'in_progress') return 4
  return 5
}

function deliverableDate(deliverable: MonthlyDeliverable) {
  return deliverable.scheduled_date ?? deliverable.due_date ?? deliverable.month
}

export default function CgHubPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const currentMonth = useMemo(() => monthKey(new Date()), [])
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    [],
  )

  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const [tasksRes, delRes] = await Promise.all([
        listTasks(),
        listMonthlyDeliverablesByMonth(currentMonth),
      ])
      if (!mounted) return
      if (tasksRes.data) setTasks(tasksRes.data as CommandCentreTask[])
      if (delRes.data) setDeliverables(delRes.data as MonthlyDeliverable[])
      setLoadingData(false)
    }
    void load()
    return () => { mounted = false }
  }, [currentMonth])

  const priorityQueue = useMemo(() => {
    return tasks
      .filter(t =>
        !HUB_COMPLETED.has(t.status as string) &&
        (t.priority === 'client_request' ||
          t.priority === 'urgent' ||
          (t.due_date !== null && t.due_date <= todayStr) ||
          t.status === 'in_progress')
      )
      .sort((a, b) => taskPriorityRank(a, todayStr) - taskPriorityRank(b, todayStr))
  }, [tasks, todayStr])

  const scheduledToday = useMemo(
    () => deliverables.filter(d => deliverableDate(d) === todayStr),
    [deliverables, todayStr],
  )

  const waitingWork = useMemo(() => {
    return deliverables.filter(d => {
      const status = simplifyProductionStatus(d.production_status)
      return status === 'ready_review' || status === 'awaiting_client' || status === 'meta_drafts'
    })
  }, [deliverables])

  const myActiveWork = useMemo(() => {
    const myName = profile?.full_name
    if (!myName) return []
    return tasks.filter(t =>
      t.assigned_to_name === myName &&
      !HUB_COMPLETED.has(t.status as string)
    )
  }, [tasks, profile])

  async function handleQuickAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quickTitle.trim() || quickSaving) return
    setQuickSaving(true)
    const input: TaskInput = {
      title: quickTitle.trim(),
      bucket: 'Admin / To Do',
      priority: 'normal',
      status: 'to_do',
      due_date: todayStr,
      source: 'manual',
      assigned_to_name: profile?.full_name ?? null,
    }
    await createTask(input)
    setQuickTitle('')
    const { data } = await listTasks()
    if (data) setTasks(data as CommandCentreTask[])
    setQuickSaving(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f2b66f]">CG Production House</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-7xl">
          CG Hub
        </h1>
        <p className="mt-3 text-base text-brand-primary/78">Internal staff workspace.</p>
      </div>

      <TodayFocus
        loading={loadingData}
        todayStr={todayStr}
        todayLabel={todayLabel}
        priorityQueue={priorityQueue}
        scheduledToday={scheduledToday}
        waitingWork={waitingWork}
        myActiveWork={myActiveWork}
        quickTitle={quickTitle}
        quickSaving={quickSaving}
        onQuickTitleChange={setQuickTitle}
        onQuickAdd={handleQuickAdd}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {launchItems.map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.to)}
            className="group min-h-28 rounded-xl border border-white/8 bg-white/[0.035] p-5 text-left transition-all hover:border-brand-teal/30 hover:bg-brand-teal/[0.06]"
          >
            <div className="flex h-full flex-col justify-between">
              <h2 className="font-display text-xl font-black uppercase tracking-wide text-white">
                {item.label}
              </h2>
              <div>
                <p className="mt-2 text-sm text-brand-primary/72">{item.detail}</p>
                <span className="mt-3 block text-sm font-bold text-[#f2b66f] group-hover:text-white">
                  Open →
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">OneDrive</h2>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ONE_DRIVE_LINKS.map(link =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-brand-teal/35 hover:bg-brand-teal/[0.05]"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-teal/70">OneDrive</p>
                  <h3 className="mt-1.5 font-display text-lg font-black uppercase tracking-wide text-white">
                    {link.label}
                  </h3>
                  <p className="mt-1 text-sm text-brand-primary/65">{link.detail}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-brand-teal/30 bg-brand-teal/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-teal transition-colors group-hover:border-brand-teal/60 group-hover:bg-brand-teal/[0.14] group-hover:text-white">
                  Open in OneDrive
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </span>
              </a>
            ) : (
              <div
                key={link.label}
                className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 opacity-60"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-primary/40">OneDrive</p>
                  <h3 className="mt-1.5 font-display text-lg font-black uppercase tracking-wide text-white/60">
                    {link.label}
                  </h3>
                  <p className="mt-1 text-sm text-brand-primary/45">{link.detail}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-brand-primary/40">
                  Link not configured
                </span>
              </div>
            )
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-6">
        <div className="flex items-center gap-3">
          <a
            href={CG_HOURS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-brand-primary transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            <span>CG Hours</span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-primary/70 group-hover:text-white">
              External
            </span>
            <svg className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Today Focus panel ─────────────────────────────────────────────────────────

function TodayFocus({
  loading,
  todayStr,
  todayLabel,
  priorityQueue,
  scheduledToday,
  waitingWork,
  myActiveWork,
  quickTitle,
  quickSaving,
  onQuickTitleChange,
  onQuickAdd,
}: {
  loading: boolean
  todayStr: string
  todayLabel: string
  priorityQueue: CommandCentreTask[]
  scheduledToday: MonthlyDeliverable[]
  waitingWork: MonthlyDeliverable[]
  myActiveWork: CommandCentreTask[]
  quickTitle: string
  quickSaving: boolean
  onQuickTitleChange: (v: string) => void
  onQuickAdd: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="mb-10 rounded-2xl border border-brand-teal/15 bg-white/[0.02] p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal/60">Today</p>
          <h2 className="font-display text-lg font-black uppercase tracking-wide text-white">{todayLabel}</h2>
        </div>
        <form onSubmit={onQuickAdd} className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs">
          <input
            type="text"
            value={quickTitle}
            onChange={e => onQuickTitleChange(e.target.value)}
            placeholder="Quick add task…"
            disabled={quickSaving}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-brand-primary/30 focus:border-brand-teal/40 focus:outline-none focus:ring-1 focus:ring-brand-teal/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!quickTitle.trim() || quickSaving}
            className="shrink-0 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-brand-teal transition-colors hover:border-brand-teal/45 hover:bg-brand-teal/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {quickSaving ? '…' : 'Add'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <SectionCard
            title="Priority queue"
            totalCount={priorityQueue.length}
            viewAllTo="/admin/command-centre"
            emptyText="No urgent tasks right now"
          >
            {priorityQueue.slice(0, 5).map(t => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} />
            ))}
          </SectionCard>
          <SectionCard
            title="Package due today"
            totalCount={scheduledToday.length}
            viewAllTo="/admin/monthly-planner"
            emptyText="No package deliverables due today"
          >
            {scheduledToday.slice(0, 5).map(d => (
              <DeliverableRow key={d.id} deliverable={d} />
            ))}
          </SectionCard>
          <SectionCard
            title="Waiting"
            totalCount={waitingWork.length}
            viewAllTo="/admin/monthly-planner"
            emptyText="Nothing waiting for review or scheduling"
          >
            {waitingWork.slice(0, 5).map(d => (
              <DeliverableRow key={d.id} deliverable={d} />
            ))}
          </SectionCard>
          <SectionCard
            title="My active work"
            totalCount={myActiveWork.length}
            viewAllTo="/admin/command-centre"
            emptyText="No active tasks assigned to you"
          >
            {myActiveWork.slice(0, 5).map(t => (
              <TaskRow key={t.id} task={t} todayStr={todayStr} />
            ))}
          </SectionCard>
        </div>
      )}
    </div>
  )
}

function SectionCard({
  title,
  totalCount,
  viewAllTo,
  emptyText,
  children,
}: {
  title: string
  totalCount: number
  viewAllTo: string
  emptyText: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/55">{title}</p>
        {totalCount > 5 && (
          <Link to={viewAllTo} className="shrink-0 text-xs font-bold text-brand-teal/75 hover:text-brand-teal">
            All {totalCount} →
          </Link>
        )}
      </div>
      {totalCount === 0 ? (
        <p className="py-1 text-sm text-brand-primary/35">{emptyText}</p>
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
      ? 'bg-rose-400'
      : isToday
        ? 'bg-brand-teal'
        : 'bg-white/20'

  const statusClass =
    task.status === 'in_progress'
      ? 'text-brand-teal/80'
      : task.status === 'blocked'
        ? 'text-rose-400/80'
        : 'text-brand-primary/40'

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
      <span className={`shrink-0 text-xs font-semibold ${statusClass}`}>
        {TASK_STATUS_SHORT[task.status] ?? task.status}
      </span>
    </Link>
  )
}

function DeliverableRow({ deliverable }: { deliverable: MonthlyDeliverable }) {
  const simplified = simplifyProductionStatus(deliverable.production_status)

  const statusClass =
    simplified === 'scheduled_posted'
      ? 'text-brand-teal'
      : simplified === 'in_progress'
        ? 'text-brand-teal/65'
        : 'text-brand-primary/40'

  return (
    <Link
      to="/admin/monthly-planner"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
    >
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-brand-teal/10 text-brand-teal">
        {DELIVERABLE_TYPE_CODE[deliverable.deliverable_type] ?? deliverable.deliverable_type}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{deliverable.title}</p>
      <span className={`shrink-0 text-xs font-semibold ${statusClass}`}>
        {DELIVERABLE_STATUS_SHORT[simplified] ?? simplified}
      </span>
    </Link>
  )
}
