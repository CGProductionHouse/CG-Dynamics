import { useState, useEffect, useMemo, type ReactNode, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import { ActionButton } from '../../components/ui/Buttons'
import { ClientPicker } from '../../components/ClientPicker'
import { useAuth } from '../../contexts/AuthContext'
import {
  listPlannerBoards,
  listPlannerBuckets,
  listPlannerTasks,
  listClientScheduleDeliverablesForYear,
  createPlannerTask,
  updatePlannerTask,
  archivePlannerTask,
  updateMonthlyDeliverableCore,
  updateMonthlyDeliverableSchedule,
  updateMonthlyDeliverableStatus,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  PRIORITIES,
  PLANNER_TASK_STATUSES,
  PLANNER_TASK_STATUS_LABELS,
  monthKey,
  simplifyProductionStatus,
  type PlannerBoard,
  type PlannerBucket,
  type PlannerTask,
  type PlannerTaskStatus,
  type MonthlyDeliverable,
  type SimplifiedProductionStatus,
  type TaskPriority,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

const BOARD_LABELS: Record<string, string> = {
  'operations-todo': 'Operations',
  'client-websites': 'Websites',
  'admin-check-list': 'Admin',
  'client-schedule': 'Client Schedule Board',
  'cg-socials': 'CG Socials',
}

const BOARD_ICONS: Record<string, ReactNode> = {
  'operations-todo': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192" />
    </svg>
  ),
  'client-websites': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'admin-check-list': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'client-schedule': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  'cg-socials': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const MONTHLY_STATUS_TONES: Record<string, string> = {
  not_started: 'text-white/50 border-white/10',
  in_progress: 'text-brand-accent border-brand-accent/25',
  ready_review: 'text-amber-300 border-amber-400/25',
  awaiting_client: 'text-sky-300 border-sky-300/25',
  meta_drafts: 'text-brand-teal border-brand-teal/25',
  scheduled_posted: 'text-white/25 border-white/5',
}

type PlannerWorkView = 'active' | 'history'

function formatPlannerDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isPlannerHistoryTask(task: PlannerTask) {
  return Boolean(task.archived_at) || task.status === 'approved' || task.status === 'scheduled'
}

function plannerTaskSortRank(task: PlannerTask) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = today.toISOString().slice(0, 10)
  const due = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null
  if (task.priority === 'client_request') return 0
  if (task.priority === 'urgent') return 1
  if (due && due < today) return 2
  if (task.due_date === todayKey) return 3
  if (task.status === 'in_progress') return 4
  if (task.status === 'ready_internal_review') return 5
  if (due) return 6
  return 7
}

function plannerStatusTone(status: PlannerTaskStatus) {
  if (status === 'in_progress') return 'text-brand-accent border-brand-accent/20'
  if (status === 'ready_internal_review') return 'text-amber-300 border-amber-400/20'
  if (status === 'approved' || status === 'scheduled') return 'text-[#2dd4bf] border-[#2dd4bf]/20'
  return 'text-white/35 border-white/10'
}

function displayDeliverableCode(deliverable: MonthlyDeliverable) {
  const instance = String(deliverable.instance_number)
  if (deliverable.code.trim().endsWith(instance)) return deliverable.code
  if (deliverable.deliverable_type === 'video' || deliverable.deliverable_type === 'reel') {
    return `${deliverable.code} ${instance}`
  }
  return `${deliverable.code}${instance}`
}

function formatDeliverableDate(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function PlannerPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const myName = profile?.full_name ?? null

  const [boards, setBoards] = useState<PlannerBoard[]>([])
  const [buckets, setBuckets] = useState<PlannerBucket[]>([])
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [activeBoard, setActiveBoard] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [drawerTask, setDrawerTask] = useState<PlannerTask | null>(null)
  const [workView, setWorkView] = useState<PlannerWorkView>('active')
  const [scheduleMonthKey, setScheduleMonthKey] = useState(monthKey(new Date()))
  const [scheduleDeliverables, setScheduleDeliverables] = useState<MonthlyDeliverable[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [drawerDeliverable, setDrawerDeliverable] = useState<MonthlyDeliverable | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | SimplifiedProductionStatus>('all')

  // Load boards
  useEffect(() => {
    let active = true
    setLoading(true)
    setTableMissing(false)

    listPlannerBoards().then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableMissing(true)
          return
        }
        return
      }
      const result = data ?? []
      setBoards(result)
      if (result.length > 0 && !activeBoard) {
        setActiveBoard(result[0].slug)
      }
    })

    return () => { active = false }
  }, [activeBoard])

  // Load buckets when board changes
  useEffect(() => {
    if (!activeBoard) return
    const board = boards.find(b => b.slug === activeBoard)
    if (!board) return

    let active = true
    listPlannerBuckets(board.id).then(({ data }) => {
      if (!active) return
      setBuckets(data ?? [])
    })

    return () => { active = false }
  }, [activeBoard, boards])

  // Load tasks when board changes
  useEffect(() => {
    setTasks([])
    if (!activeBoard || boards.length === 0) return
    const board = boards.find(b => b.slug === activeBoard)
    if (!board) return

    let active = true
    setTasksLoading(true)
    listPlannerTasks(board.id).then(({ data }) => {
      if (!active) return
      setTasks(data ?? [])
      setTasksLoading(false)
    }).catch(() => {
      if (active) setTasksLoading(false)
    })

    return () => { active = false }
  }, [activeBoard, boards])

  useEffect(() => {
    let active = true
    listActiveClients().then(({ data }) => {
      if (active) setClients(data ?? [])
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (activeBoard !== 'client-schedule') return
    let active = true
    setScheduleLoading(true)
    setScheduleError(null)
    const year = parseInt(scheduleMonthKey.split('-')[0], 10)
    listClientScheduleDeliverablesForYear(year).then(({ data, error }) => {
      if (!active) return
      setScheduleLoading(false)
      if (error) {
        setScheduleError(error.message ?? 'Could not load client schedule.')
        setScheduleDeliverables([])
        return
      }
      setScheduleDeliverables(data ?? [])
    }).catch(() => {
      if (!active) return
      setScheduleLoading(false)
      setScheduleError('Could not load client schedule.')
      setScheduleDeliverables([])
    })
    return () => { active = false }
  }, [activeBoard, scheduleMonthKey])

  // Escape to close drawer
  useEffect(() => {
    if (!drawerTask && !drawerDeliverable) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawerTask(null)
        setDrawerDeliverable(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerTask, drawerDeliverable])

  // Admin board always last
  const sortedBoards = useMemo(() => {
    return [...boards].sort((a, b) => {
      const aLast = a.board_type === 'admin' || a.slug === 'admin-check-list'
      const bLast = b.board_type === 'admin' || b.slug === 'admin-check-list'
      if (aLast && !bLast) return 1
      if (!aLast && bLast) return -1
      return a.sort_order - b.sort_order
    })
  }, [boards])

  const activeBoardId = useMemo(
    () => boards.find(b => b.slug === activeBoard)?.id ?? null,
    [boards, activeBoard],
  )

  const bucketNameById = useMemo(
    () => new Map(buckets.map(bucket => [bucket.id, bucket.name])),
    [buckets],
  )

  const activeTaskCount = useMemo(() => tasks.filter(task => !isPlannerHistoryTask(task)).length, [tasks])
  const historyTaskCount = useMemo(() => tasks.filter(isPlannerHistoryTask).length, [tasks])

  const visibleTasks = useMemo(
    () => tasks.filter(task => workView === 'history' ? isPlannerHistoryTask(task) : !isPlannerHistoryTask(task)),
    [tasks, workView],
  )

  // Group tasks by bucket for O(1) column lookup
  const tasksByBucket = useMemo(() => {
    const map = new Map<string, PlannerTask[]>()
    for (const t of visibleTasks) {
      const key = t.bucket_id ?? '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [visibleTasks])

  const mobileTasks = useMemo(
    () => [...visibleTasks].sort((a, b) => {
      const rank = plannerTaskSortRank(a) - plannerTaskSortRank(b)
      if (rank !== 0) return rank
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return a.title.localeCompare(b.title)
    }),
    [visibleTasks],
  )

  const clientNameById = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients])

  const scheduleMonthDeliverables = useMemo(() => {
    const search = scheduleSearch.trim().toLowerCase()
    return scheduleDeliverables.filter(d => {
      const date = d.scheduled_date ?? d.due_date
      if (!date || !date.startsWith(scheduleMonthKey)) return false
      if (scheduleStatusFilter !== 'all' && simplifyProductionStatus(d.production_status) !== scheduleStatusFilter) return false
      if (search) {
        const code = displayDeliverableCode(d).toLowerCase()
        const title = (d.title ?? '').toLowerCase()
        const client = (clientNameById.get(d.client_id) ?? '').toLowerCase()
        if (!code.includes(search) && !title.includes(search) && !client.includes(search)) return false
      }
      return true
    })
  }, [clientNameById, scheduleDeliverables, scheduleMonthKey, scheduleSearch, scheduleStatusFilter])

  const deliverablesByClient = useMemo(() => {
    const groups = new Map<string, MonthlyDeliverable[]>()
    for (const deliverable of scheduleMonthDeliverables) {
      const key = deliverable.client_id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(deliverable)
    }
    return Array.from(groups.entries())
      .map(([clientId, items]) => ({
        clientId,
        clientName: clientNameById.get(clientId) ?? 'Unknown client',
        items: items.sort((a, b) => {
          const aDate = a.scheduled_date ?? a.due_date ?? '9999-12-31'
          const bDate = b.scheduled_date ?? b.due_date ?? '9999-12-31'
          if (aDate !== bDate) return aDate.localeCompare(bDate)
          return a.code.localeCompare(b.code) || a.instance_number - b.instance_number
        }),
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }, [clientNameById, scheduleMonthDeliverables])

  function handleTaskCreated(task: PlannerTask) {
    setTasks(prev => [...prev, task])
  }

  function handleTaskSaved(updated: PlannerTask) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setDrawerTask(updated)
  }

  function handleDeliverableSaved(updated: MonthlyDeliverable) {
    setScheduleDeliverables(prev => prev.map(item => item.id === updated.id ? updated : item))
    setDrawerDeliverable(updated)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="mb-4 h-24 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="mb-4 flex gap-1.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 w-64 shrink-0 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Planner</h1>
        <EmptyState
          title="Planner tables not set up yet"
          message="Run phase-6 and phase-6b migrations."
        />
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Planner</h1>
        <EmptyState
          title="No boards found"
          message="Run the phase-6b seed migration to create boards."
        />
      </div>
    )
  }

  const activeIsScheduleBoard = activeBoard === 'client-schedule'

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Schedule</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Planner</h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Link
              to="/admin/import-health"
              className="text-xs font-semibold text-brand-primary/60 hover:text-brand-primary transition-colors"
            >
              Health
            </Link>
            <Link
              to="/admin/planner-import"
              className="text-xs font-semibold text-brand-primary/60 hover:text-brand-primary transition-colors"
            >
              Import
            </Link>
          </div>
        )}
      </div>

      {/* Client Schedule entry point */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal/70">Client schedule</p>
            <h2 className="mt-1 text-lg font-black text-white">Client Schedule</h2>
            <p className="mt-0.5 text-xs text-brand-primary/60">Current month deliverables, statuses and client work.</p>
          </div>
          <Link
            to="/admin/client-schedule?view=calendar"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand-teal/30 bg-brand-teal/[0.08] px-4 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-[#2dd4bf] transition-all hover:border-brand-teal/60 hover:bg-brand-teal/[0.14] hover:text-white"
          >
            Open Client Schedule
            <svg className="h-4 w-4 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SIMPLIFIED_STATUS_OPTIONS.map(s => (
            <span
              key={s}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${MONTHLY_STATUS_TONES[s] ?? 'text-white/40 border-white/10'}`}
            >
              {SIMPLIFIED_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Board tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {sortedBoards.map(board => {
          const isActive = activeBoard === board.slug
          const isScheduleBoard = board.slug === 'client-schedule'
          const isAdminOnly = board.visibility === 'admin_only'
          return (
            <button
              key={board.slug}
              type="button"
              onClick={() => setActiveBoard(board.slug)}
              className={`flex flex-col items-start rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_-2px_0_rgba(45,212,191,0.6)]'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="shrink-0">{BOARD_ICONS[board.slug]}</span>
                <span>{BOARD_LABELS[board.slug] ?? board.name}</span>
                {isAdminOnly && (
                  <svg className="h-2.5 w-2.5 text-amber-400/60" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                )}
              </span>
              {isScheduleBoard && (
                <span className="mt-0.5 pl-[1.375rem] text-[9px] font-bold uppercase tracking-[0.12em] text-brand-primary/35">
                  Master schedule
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeIsScheduleBoard && (
        <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-brand-primary/55">
          Master schedule — full client content plan across all months.
        </div>
      )}

      {activeIsScheduleBoard ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const [y, m] = scheduleMonthKey.split('-').map(Number)
                const d = new Date(y, m - 2, 1)
                setScheduleMonthKey(monthKey(d))
              }}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
            >
              Prev
            </button>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white">
              {new Date(scheduleMonthKey + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => {
                const [y, m] = scheduleMonthKey.split('-').map(Number)
                const d = new Date(y, m, 1)
                setScheduleMonthKey(monthKey(d))
              }}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
            >
              Next
            </button>
            <Link to="/admin/client-schedule?view=calendar" className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">
              Open Client Schedule
            </Link>
            <Link to="/admin/client-schedule?view=year" className="rounded-md border border-white/[0.08] px-3 py-2 text-xs font-bold text-brand-primary/60 hover:text-white">
              Year / Master
            </Link>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search client, code or title…"
              value={scheduleSearch}
              onChange={e => setScheduleSearch(e.target.value)}
              className="w-48 rounded-lg border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
            <select
              value={scheduleStatusFilter}
              onChange={e => setScheduleStatusFilter(e.target.value as 'all' | SimplifiedProductionStatus)}
              className="rounded-lg border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            >
              <option value="all">All statuses</option>
              {SIMPLIFIED_STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{SIMPLIFIED_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className="text-[10px] font-semibold text-white/30">
              {scheduleMonthDeliverables.length} deliverable{scheduleMonthDeliverables.length !== 1 ? 's' : ''}
            </span>
          </div>
          {scheduleError && (
            <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{scheduleError}</div>
          )}
          <ClientScheduleBoard groups={deliverablesByClient} loading={scheduleLoading} onOpen={setDrawerDeliverable} />
        </>
      ) : (
        <>
      <div className="mb-4 flex w-fit items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setWorkView('active')}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
            workView === 'active'
              ? 'bg-brand-accent text-black'
              : 'text-brand-primary/60 hover:text-brand-primary'
          }`}
        >
          Active {activeTaskCount}
        </button>
        <button
          type="button"
          onClick={() => setWorkView('history')}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
            workView === 'history'
              ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
              : 'text-brand-primary/60 hover:text-brand-primary'
          }`}
        >
          History {historyTaskCount}
        </button>
      </div>

      {/* Bucket columns */}
      {buckets.length === 0 ? (
        <EmptyState
          title="No columns configured"
          message="This board has no columns yet."
          centered={false}
        />
      ) : (
        <>
          <PlannerMobileTaskList
            tasks={mobileTasks}
            tasksLoading={tasksLoading}
            bucketNameById={bucketNameById}
            workView={workView}
            onOpenTask={setDrawerTask}
          />
          <div className="hidden gap-3 overflow-x-auto pb-6 md:flex">
            {buckets.map(bucket => (
              <BucketColumn
                key={bucket.id}
                bucket={bucket}
                boardId={activeBoardId ?? ''}
                tasks={tasksByBucket.get(bucket.id) ?? []}
                tasksLoading={tasksLoading}
                myName={myName}
                onOpenTask={setDrawerTask}
                onTaskCreated={handleTaskCreated}
              />
            ))}
          </div>
        </>
      )}
        </>
      )}

      {drawerTask && (
        <PlannerTaskDrawer
          task={drawerTask}
          buckets={buckets}
          actorName={myName}
          onClose={() => setDrawerTask(null)}
          onSaved={handleTaskSaved}
          onRemoved={id => {
            setTasks(prev => prev.filter(task => task.id !== id))
            setDrawerTask(null)
          }}
        />
      )}
      {drawerDeliverable && (
        <ScheduleDeliverableDrawer
          deliverable={drawerDeliverable}
          clientName={clientNameById.get(drawerDeliverable.client_id) ?? 'Unknown client'}
          onClose={() => setDrawerDeliverable(null)}
          onSaved={handleDeliverableSaved}
        />
      )}
    </div>
  )
}

function ClientScheduleBoard({
  groups,
  loading,
  onOpen,
}: {
  groups: Array<{ clientId: string; clientName: string; items: MonthlyDeliverable[] }>
  loading: boolean
  onOpen: (deliverable: MonthlyDeliverable) => void
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="h-48 animate-pulse rounded-xl bg-white/[0.04]" />)}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No schedule deliverables found"
        message="Client Schedule Board reads monthly deliverables. Generate or import monthly deliverables to populate this board."
        centered={false}
      />
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(group => (
        <section key={group.clientId} className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.018] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="truncate text-sm font-black text-white">{group.clientName}</h2>
            <span className="rounded-full bg-brand-teal/[0.08] px-2 py-0.5 text-xs font-bold text-[#2dd4bf]">{group.items.length}</span>
          </div>
          <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {group.items.map(deliverable => {
              const simplified = simplifyProductionStatus(deliverable.production_status)
              return (
                <button
                  key={deliverable.id}
                  type="button"
                  onClick={() => onOpen(deliverable)}
                  className="w-full rounded-lg border border-white/[0.07] bg-black/25 p-3 text-left transition-colors hover:border-brand-accent/25 hover:bg-white/[0.04]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {displayDeliverableCode(deliverable)}
                      </span>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{deliverable.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${MONTHLY_STATUS_TONES[simplified]}`}>
                      {SIMPLIFIED_STATUS_LABELS[simplified]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-white/55">
                      {formatDeliverableDate(deliverable.scheduled_date ?? deliverable.due_date)}
                    </span>
                    {deliverable.assigned_to_name && (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-white/55">
                        {deliverable.assigned_to_name}
                      </span>
                    )}
                    {(deliverable.helper_names ?? []).map(name => (
                      <span key={name} className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2 py-0.5 text-[#2dd4bf]">
                        {name}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function ScheduleDeliverableDrawer({
  deliverable,
  clientName,
  onClose,
  onSaved,
}: {
  deliverable: MonthlyDeliverable
  clientName: string
  onClose: () => void
  onSaved: (updated: MonthlyDeliverable) => void
}) {
  const [status, setStatus] = useState<SimplifiedProductionStatus>(simplifyProductionStatus(deliverable.production_status))
  const [scheduledDate, setScheduledDate] = useState(deliverable.scheduled_date ?? '')
  const [assignedTo, setAssignedTo] = useState(deliverable.assigned_to_name ?? '')
  const [clientId, setClientId] = useState(deliverable.client_id)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      let next: MonthlyDeliverable = deliverable
      const statusResult = await updateMonthlyDeliverableStatus(deliverable.id, SIMPLIFIED_TO_BACKEND_STATUS[status])
      if (statusResult.error) { setSaveError(statusResult.error.message); return }
      if (statusResult.data) next = statusResult.data

      const scheduleResult = await updateMonthlyDeliverableSchedule(deliverable.id, scheduledDate || null)
      if (scheduleResult.error) { setSaveError(scheduleResult.error.message); return }
      if (scheduleResult.data) next = scheduleResult.data

      const coreResult = await updateMonthlyDeliverableCore(deliverable.id, {
        assigned_to_name: assignedTo.trim() || null,
        client_id: clientId,
      })
      if (coreResult.error) { setSaveError(coreResult.error.message); return }
      if (coreResult.data) next = coreResult.data

      onSaved(next)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch {
      setSaveError('Could not save deliverable.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">Schedule deliverable</p>
            <h2 className="mt-1 text-base font-bold leading-snug text-white">{displayDeliverableCode(deliverable)} · {deliverable.title}</h2>
            <p className="mt-0.5 text-xs text-brand-primary/60">{clientName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-primary hover:text-white">X</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Client</label>
            <ClientPicker
              value={clientId}
              label={clientName}
              onChange={client => setClientId(client?.id ?? '')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Status</label>
            <select value={status} onChange={event => setStatus(event.target.value as SimplifiedProductionStatus)} className={inputCls}>
              {SIMPLIFIED_STATUS_OPTIONS.map(option => <option key={option} value={option}>{SIMPLIFIED_STATUS_LABELS[option]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Schedule date</label>
            <input type="date" value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label>
            <input value={assignedTo} onChange={event => setAssignedTo(event.target.value)} className={inputCls} />
          </div>
          {(deliverable.helper_names ?? []).length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p>
              <div className="flex flex-wrap gap-1.5">
                {(deliverable.helper_names ?? []).map(name => (
                  <span key={name} className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2.5 py-0.5 text-[11px] text-[#2dd4bf]">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-white/[0.08] px-5 py-4">
          {saveError && <p className="mb-2 text-xs text-red-400">{saveError}</p>}
          {saveMsg && <p className="mb-2 text-xs text-[#2dd4bf]">{saveMsg}</p>}
          <div className="flex gap-3">
            <ActionButton variant="primary" onClick={handleSave} loading={saving}>Save</ActionButton>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-brand-primary hover:text-white">Close</button>
          </div>
        </div>
      </div>
    </>
  )
}

function PlannerMobileTaskList({
  tasks,
  tasksLoading,
  bucketNameById,
  workView,
  onOpenTask,
}: {
  tasks: PlannerTask[]
  tasksLoading: boolean
  bucketNameById: Map<string, string>
  workView: PlannerWorkView
  onOpenTask: (task: PlannerTask) => void
}) {
  if (tasksLoading) {
    return (
      <div className="space-y-2 md:hidden">
        {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />)}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="md:hidden">
        <EmptyState
          title={workView === 'active' ? 'No active planner tasks' : 'No completed planner history'}
          message={workView === 'active' ? 'Approved and scheduled import history is hidden here.' : 'Completed planner work will appear here.'}
          centered={false}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 md:hidden">
      {tasks.map(task => (
        <button
          key={task.id}
          type="button"
          onClick={() => onOpenTask(task)}
          className="w-full rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-colors hover:border-brand-accent/25"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{task.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {task.client_name && (
                  <span className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[#2dd4bf]">
                    {task.client_name}
                  </span>
                )}
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                  {task.bucket_id ? bucketNameById.get(task.bucket_id) ?? 'Planner' : 'Planner'}
                </span>
                {task.assigned_to_name && (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                    {task.assigned_to_name}
                  </span>
                )}
                {task.due_date && (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                    {formatPlannerDate(task.due_date)}
                  </span>
                )}
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${plannerStatusTone(task.status)}`}>
              {PLANNER_TASK_STATUS_LABELS[task.status]}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function BucketColumn({ bucket, boardId, tasks, tasksLoading, myName, onOpenTask, onTaskCreated }: {
  bucket: PlannerBucket
  boardId: string
  tasks: PlannerTask[]
  tasksLoading: boolean
  myName: string | null
  onOpenTask: (task: PlannerTask) => void
  onTaskCreated: (task: PlannerTask) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!addTitle.trim() || addBusy || !boardId) return
    setAddBusy(true)
    setAddError(null)
    try {
      const { data, error } = await createPlannerTask({
        board_id: boardId,
        bucket_id: bucket.id,
        title: addTitle.trim(),
        assigned_to_name: myName ?? null,
      })
      if (error) {
        setAddError(error.code === '42501' ? 'Admin permission needed.' : error.message)
        return
      }
      if (data) {
        onTaskCreated(data)
        setAddTitle('')
        setShowAdd(false)
      }
    } catch {
      setAddError('Could not create task.')
    } finally {
      setAddBusy(false)
    }
  }

  function cancelAdd() {
    setShowAdd(false)
    setAddTitle('')
    setAddError(null)
  }

  return (
    <div className="w-56 shrink-0 sm:w-60">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/45">
          {bucket.name}
        </h3>
        {tasks.length > 0 && (
          <span className="shrink-0 text-[11px] text-white/25">{tasks.length}</span>
        )}
      </div>

      <div className="min-h-[7rem] rounded-lg border border-white/[0.06] bg-white/[0.018] p-2">
        {tasksLoading ? (
          <div className="flex h-16 items-center justify-center">
            <div className="h-1.5 w-12 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {tasks.map(task => (
              <PlannerTaskCard key={task.id} task={task} onClick={() => onOpenTask(task)} />
            ))}

            {tasks.length === 0 && !showAdd && (
              <div className="flex flex-col items-center gap-1.5 py-4">
                <p className="text-[11px] text-white/20">No tasks</p>
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="text-[11px] text-brand-primary/40 hover:text-brand-primary transition-colors"
                >
                  + Add task
                </button>
              </div>
            )}

            {showAdd ? (
              <form onSubmit={handleAdd} className="pt-0.5">
                <input
                  autoFocus
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                />
                {addError && <p className="mt-1 text-[11px] text-red-400">{addError}</p>}
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="submit"
                    disabled={addBusy || !addTitle.trim()}
                    className="rounded-md bg-brand-accent/90 px-2.5 py-1 text-[11px] font-semibold text-brand-bg disabled:opacity-50"
                  >
                    {addBusy ? '…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelAdd}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/50 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="mt-1 w-full rounded-md border border-dashed border-white/[0.07] py-1.5 text-[11px] text-white/25 hover:border-white/15 hover:text-white/50 transition-colors"
              >
                + Add task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PlannerTaskCard({ task, onClick }: { task: PlannerTask; onClick: () => void }) {
  const dotColor = task.priority === 'urgent'
    ? 'bg-amber-400/60'
    : task.priority === 'client_request'
    ? 'bg-brand-accent/60'
    : 'bg-white/15'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition-all hover:border-white/[0.1] hover:bg-white/[0.06]"
    >
      <div className="flex items-start gap-1.5">
        <div className={`mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <p className="text-[12px] font-medium leading-snug text-white">{task.title}</p>
      </div>
      {(task.client_name || task.assigned_to_name || task.due_date) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3">
          {task.client_name && (
            <span className="text-[10px] text-brand-primary/60">{task.client_name}</span>
          )}
          {task.assigned_to_name && (
            <span className="text-[10px] text-white/30">{task.assigned_to_name}</span>
          )}
          {task.due_date && (
            <span className="text-[10px] text-white/30">{formatPlannerDate(task.due_date)}</span>
          )}
        </div>
      )}
      {task.status !== 'to_do' && (
        <div className="mt-1.5 pl-3">
          <span className={`inline-block rounded-full border px-1.5 py-px text-[9px] font-semibold ${plannerStatusTone(task.status)}`}>
            {PLANNER_TASK_STATUS_LABELS[task.status]}
          </span>
        </div>
      )}
    </button>
  )
}

function PlannerTaskDrawer({ task, buckets, actorName, onClose, onSaved, onRemoved }: {
  task: PlannerTask
  buckets: PlannerBucket[]
  actorName: string | null
  onClose: () => void
  onSaved: (updated: PlannerTask) => void
  onRemoved: (id: string) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [clientId, setClientId] = useState(task.client_id ?? '')
  const [clientName, setClientName] = useState(task.client_name ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assigned_to_name ?? '')
  const [status, setStatus] = useState<PlannerTaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [bucketId, setBucketId] = useState(task.bucket_id ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function handleSave() {
    if (saving || !title.trim()) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const { data, error } = await updatePlannerTask(task.id, {
        title: title.trim(),
        client_id: clientId || null,
        client_name: clientName.trim() || null,
        assigned_to_name: assignedTo.trim() || null,
        status,
        priority,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        bucket_id: bucketId || null,
      })
      if (error) {
        setSaveError(error.code === '42501' ? 'Admin permission needed.' : error.message)
        return
      }
      if (data) {
        onSaved(data)
        setSaveMsg('Saved')
        setTimeout(() => setSaveMsg(null), 2000)
      }
    } catch {
      setSaveError('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveFromActive() {
    if (removing) return
    setRemoving(true)
    setSaveError(null)
    const { error } = await archivePlannerTask(task.id, actorName)
    if (error) {
      setSaveError(error.code === '42703'
        ? 'Archive migration is not applied yet. Run phase-9a-planner-task-archive.sql in Supabase.'
        : error.message ?? 'Could not remove task from active.')
      setRemoving(false)
      return
    }
    onRemoved(task.id)
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[440px]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Task details</h2>
            {task.original_plan_name && (
              <p className="mt-0.5 text-[10px] text-white/30">{task.original_plan_name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-primary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {task.priority !== 'normal' && (
            <div>
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                task.priority === 'urgent'
                  ? 'text-amber-400 border-amber-400/25'
                  : 'text-brand-accent border-brand-accent/25'
              }`}>
                {task.priority === 'urgent' ? 'Urgent' : 'Client request'}
              </span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as PlannerTaskStatus)} className={inputCls}>
                {PLANNER_TASK_STATUSES.map(s => (
                  <option key={s} value={s}>{PLANNER_TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label>
              <input
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="Name"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Column</label>
              <select value={bucketId} onChange={e => setBucketId(e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {buckets.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className={`resize-none ${inputCls}`}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p>
            {task.helper_names !== undefined ? (
              task.helper_names.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {task.helper_names.map(name => (
                    <span key={name} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/70">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/40">No helpers yet</p>
              )
            ) : (
              <p className="text-[11px] text-white/30">After migration phase-7b</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Timer</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Start</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Pause</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Stop</button>
            </div>
            <p className="mt-1.5 text-[10px] text-white/20">After migration</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-5 py-4">
          {saveError && <p className="mb-2 text-xs text-red-400">{saveError}</p>}
          {saveMsg && <p className="mb-2 text-xs text-[#2dd4bf]">{saveMsg}</p>}
          <div className="flex items-center gap-3">
            <ActionButton
              variant="primary"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              loading={saving}
            >
              Save
            </ActionButton>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-brand-primary hover:text-white transition-colors"
            >
              Close
            </button>
            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="ml-auto text-xs text-amber-300/75 hover:text-amber-200 transition-colors"
              >
                Remove from active
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-brand-primary">Remove?</span>
                <button
                  type="button"
                  onClick={handleRemoveFromActive}
                  disabled={removing}
                  className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-60"
                >
                  {removing ? 'Removing...' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
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
