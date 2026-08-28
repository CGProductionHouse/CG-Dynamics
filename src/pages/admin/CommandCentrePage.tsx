import { useState, useEffect, useMemo, useCallback } from 'react'
import { listStaffProfiles } from '../../lib/contentWorkflow'
import {
  groupByOwnership,
  ownershipCounts,
  resolveOwnership,
  taskOwnershipInput,
  type Ownership,
  type OwnershipGrouping,
} from '../../lib/taskOwnership'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState } from '../../components/ui/States'
import { ClientPicker } from '../../components/ClientPicker'
import { useAuth } from '../../contexts/AuthContext'
import { businessDateKey } from '../../lib/businessTime'
import { isManagerRole } from '../../lib/roles'
import { useVisualViewportBottomInset } from '../../lib/mobileViewport'
import {
  listTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  archiveImportedPlannerTask,
  listActiveClients,
  parseMorningList,
  morningEditToInput,
  BUCKETS,
  PRIORITIES,
  STATUSES,
  type CommandCentreTask,
  type TaskInput,
  type TaskBucket,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateFields,
  type PackageAction,
  type ClientOption,
  type ParsedMorningTask,
  type MorningTaskEdit,
  taskStatusDisplayLabel,
} from '../../lib/commandCentre'
import { isActiveForToday, isActiveWorkTask, isActuallyInProgressTask, isOperationallyCompletedStatus, isVerifiedWorkTask } from '../../lib/taskLifecycle'

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, client_request: 1, normal: 2 }

type WorkFilter = 'focus' | 'today' | 'overdue' | 'client_requests' | 'in_progress' | 'done'

function focusSortOrder(task: CommandCentreTask, today: string, now: Date): number {
  if (task.priority === 'client_request') return 0
  if (task.priority === 'urgent') return 1
  const dueDate = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null
  if (dueDate && dueDate < now) return 2
  if (task.due_date === today) return 3
  if (isActuallyInProgressTask(task)) return 4
  if (dueDate && dueDate.getTime() - now.getTime() <= 7 * 86400000) return 5
  if (!dueDate) return 7
  return 6
}

function isOverdue(task: CommandCentreTask, now: Date) {
  if (!task.due_date || !isActiveForToday(task)) return false
  return new Date(`${task.due_date}T00:00:00`) < now
}

function matchesWorkFilter(task: CommandCentreTask, filter: WorkFilter, today: string, now: Date) {
  if (filter === 'done') return isOperationallyCompletedStatus(task)
  if (!isActiveForToday(task)) return false
  if (filter === 'today') return task.due_date === today
  if (filter === 'overdue') return isOverdue(task, now)
  if (filter === 'client_requests') return task.priority === 'client_request' || task.bucket === 'Client Requests'
  if (filter === 'in_progress') return isActuallyInProgressTask(task)
  return true
}

function todayStr() {
  return businessDateKey()
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'No date'
  const d = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = (d.getTime() - now.getTime()) / 86400000
  if (diff < -1) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (diff < 0) return 'Yesterday'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dateClass(dateStr: string) {
  if (!dateStr) return 'text-brand-primary/45'
  const d = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (d < now) return 'text-red-400'
  if (d.getTime() === now.getTime()) return 'text-brand-accent'
  return 'text-brand-primary'
}

function priorityColor(p: TaskPriority) {
  if (p === 'urgent') return 'amber'
  if (p === 'client_request') return 'accent'
  return 'neutral'
}

function statusLabel(s: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    to_do: 'To do',
    in_progress: 'In progress',
    done: 'Done',
    blocked: 'Blocked',
    waiting_client: 'Waiting client',
    moved_to_tomorrow: 'Moved to tomorrow',
  }
  return labels[s]
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

/**
 * The copy-ready morning message.
 *
 * Named sections contain ONLY verified canonical work. This used to group by
 * `assigned_to_name`, so a raw imported string like
 * "Sydney Oosthuizen;Franco Lessing" became a staff heading and stale text put
 * work under the wrong person. Unresolved and conflicting work now goes to a
 * manager-only block instead of being attributed to somebody.
 */
function buildMorningMessage(grouping: OwnershipGrouping<CommandCentreTask>) {
  const lines: string[] = ['CGPH TO DO', '']
  const owners = [...grouping.byOwner.values()].sort((a, b) => a.person.name.localeCompare(b.person.name))

  for (const { person, items } of owners) {
    if (items.length === 0) continue
    const clientRequests = items.filter(t => t.priority === 'client_request')
    const normal = items.filter(t => t.priority !== 'client_request')
    lines.push(`@${person.name}`)
    for (const t of [...clientRequests, ...normal]) {
      const prefix = t.client_name ? `${t.client_name} — ` : ''
      lines.push(`- ${prefix}${t.title}`)
    }
    lines.push('')
  }

  const counts = ownershipCounts(grouping)
  if (counts.needsReview > 0 || counts.conflicts > 0 || counts.unassigned > 0) {
    lines.push('— MANAGER REVIEW (not sent to staff) —')
    if (counts.conflicts > 0) lines.push(`Assignment conflict: ${counts.conflicts}`)
    if (counts.needsReview > 0) lines.push(`Needs assignment review: ${counts.needsReview}`)
    if (counts.unassigned > 0) lines.push(`Unassigned: ${counts.unassigned}`)
    lines.push('These are NOT included above because their ownership is not verified.')
    lines.push('')
  }
  return lines.join('\n')
}

function buildEndOfDay(activeTasks: CommandCentreTask[], ownershipOf: (t: CommandCentreTask) => Ownership) {
  const groups: Record<string, CommandCentreTask[]> = {
    'DONE': [],
    'STILL BUSY / IN PROGRESS': [],
    'BLOCKED': [],
    'WAITING CLIENT': [],
    'MOVED TO TOMORROW': [],
    'OTHER ACTIVE': [],
  }
  for (const t of activeTasks) {
    if (isOperationallyCompletedStatus(t)) groups['DONE'].push(t)
    else if (isActuallyInProgressTask(t)) groups['STILL BUSY / IN PROGRESS'].push(t)
    else if (t.status === 'blocked') groups['BLOCKED'].push(t)
    else if (t.status === 'waiting_client') groups['WAITING CLIENT'].push(t)
    else if (t.status === 'moved_to_tomorrow') groups['MOVED TO TOMORROW'].push(t)
    else groups['OTHER ACTIVE'].push(t)
  }
  const lines: string[] = ['CGPH END OF DAY UPDATE', '']
  for (const [heading, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    lines.push(heading)
    for (const t of items) {
      // Only a VERIFIED canonical owner may be named. This used to print
      // `assigned_to_name` verbatim, publishing stale imported text as though
      // it were confirmed ownership.
      const ownership = ownershipOf(t)
      const label = ownership.state === 'verified'
        ? ` (${ownership.owners.map(o => o.name).join(', ')})`
        : ownership.state === 'conflict'
          ? ' (assignment conflict — needs review)'
          : ownership.state === 'unresolved'
            ? ' (needs assignment review)'
            : ''
      const prefix = t.client_name ? `${t.client_name} — ` : ''
      lines.push(`- ${prefix}${t.title}${label}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export default function CommandCentrePage({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth()
  const location = useLocation()
  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [staffProfiles, setStaffProfiles] = useState<Array<{ id: string; full_name: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filterStaff, setFilterStaff] = useState<string>('__my__')
  const [workFilter, setWorkFilter] = useState<WorkFilter>('focus')
  const [bucketFilter, setBucketFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showDone, setShowDone] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    setTableMissing(false)
    try {
      const { data, error } = await listTasks()
      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableMissing(true)
          setTasks([])
          return
        }
        setError(error.message)
        setTasks([])
        return
      }
      setTasks(data ?? [])
    } catch {
      setError('Could not load tasks.')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const today = todayStr()
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Active staff, loaded from the profile directory. This is the canonical
  // display-name source for verified owners — there is no hardcoded staff list.
  useEffect(() => {
    let active = true
    void listStaffProfiles().then(result => {
      if (active && result.data) setStaffProfiles(result.data)
    })
    return () => { active = false }
  }, [])

  // Morning List Import is reachable directly via /admin/command-centre#morning-import.
  // Scroll to it once the page has finished loading so the navigation entry lands
  // on the import experience instead of silently showing the task list.
  useEffect(() => {
    if (loading || location.hash !== '#morning-import') return
    const timer = window.setTimeout(() => {
      document.getElementById('morning-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [loading, location.hash])

  const now = useMemo(() => {
    const value = new Date(`${today}T00:00:00`)
    return value
  }, [today])

  const allActiveTasks = useMemo(() =>
    tasks.filter(t => isActiveWorkTask(t)),
  [tasks])

  // Verified work only: excludes unresolved/conflict legacy imports from
  // operational counts (overdue, focus, today) so daily queues reflect real
  // work rather than import noise. The ownership review section still uses
  // allActiveTasks to show the full review backlog.
  const verifiedActiveTasks = useMemo(() =>
    allActiveTasks.filter(t => isVerifiedWorkTask(t)),
  [allActiveTasks])

  const focusTasks = useMemo(() => {
    let filtered: CommandCentreTask[]
    const taskPool = workFilter === 'done' ? tasks : verifiedActiveTasks
    if (filterStaff === '__my__') {
      const myName = profile?.full_name ?? ''
      filtered = taskPool.filter(t => t.assigned_to_name === myName)
    } else if (filterStaff) {
      filtered = taskPool.filter(t => t.assigned_to_name === filterStaff)
    } else {
      filtered = taskPool
    }
    if (workFilter !== 'focus') {
      filtered = filtered.filter(t => matchesWorkFilter(t, workFilter, today, now))
    } else {
      // Focus is a today-axis surface: a deferred task is unfinished but belongs
      // to its own future day, never today's focus queue.
      filtered = filtered.filter(t => isActiveForToday(t))
    }
    if (bucketFilter) filtered = filtered.filter(t => t.bucket === bucketFilter)
    if (clientSearch.trim()) {
      const search = clientSearch.trim().toLowerCase()
      filtered = filtered.filter(t =>
        (t.client_name ?? '').toLowerCase().includes(search) ||
        t.title.toLowerCase().includes(search)
      )
    }
    return [...filtered].sort((a, b) => focusSortOrder(a, today, now) - focusSortOrder(b, today, now))
  }, [verifiedActiveTasks, bucketFilter, clientSearch, filterStaff, profile, tasks, today, now, workFilter])

  const doneTodayTasks = useMemo(() => {
    let base = tasks.filter(t => isOperationallyCompletedStatus(t) && t.completed_at?.slice(0, 10) === today)
    if (filterStaff === '__my__') {
      const myName = profile?.full_name ?? ''
      base = base.filter(t => t.assigned_to_name === myName)
    } else if (filterStaff) {
      base = base.filter(t => t.assigned_to_name === filterStaff)
    }
    return base
  }, [tasks, filterStaff, profile, today])

  // Canonical staff directory, loaded from active profiles. Replaces the
  // hardcoded KNOWN_STAFF array as the ownership and grouping authority.
  const staffDirectory = useMemo(() => new Map(staffProfiles.map(p => [p.id, p.full_name ?? 'Unknown'])), [staffProfiles])

  const ownershipOf = useCallback(
    (t: CommandCentreTask) => resolveOwnership(taskOwnershipInput(t), staffDirectory),
    [staffDirectory],
  )

  // Board grouping now keys on VERIFIED canonical owners. Unresolved and
  // conflicting work gets its own explicit heading instead of being filed under
  // whatever name happened to be in the imported text.
  const focusGroupEntries = useMemo(() => {
    const grouping = groupByOwnership(focusTasks, taskOwnershipInput, staffDirectory)
    const entries: Array<[string, CommandCentreTask[]]> = [...grouping.byOwner.values()]
      .sort((a, b) => a.person.name.localeCompare(b.person.name))
      .map(entry => [entry.person.name, entry.items])
    if (grouping.assignmentConflict.length > 0) {
      entries.push(['Assignment conflict', grouping.assignmentConflict.map(x => x.item)])
    }
    if (grouping.needsAssignmentReview.length > 0) {
      entries.push(['Needs assignment review', grouping.needsAssignmentReview.map(x => x.item)])
    }
    if (grouping.unassigned.length > 0) entries.push(['Unassigned', grouping.unassigned])
    return entries
  }, [focusTasks, staffDirectory])

  const ownershipGrouping = useMemo(
    () => groupByOwnership(allActiveTasks, taskOwnershipInput, staffDirectory),
    [allActiveTasks, staffDirectory],
  )
  const ownershipTotals = useMemo(() => ownershipCounts(ownershipGrouping), [ownershipGrouping])
  // Assignee pickers list ACTIVE canonical staff, discovered from the directory.
  const staffNames = useMemo(
    () => staffProfiles.map(p => p.full_name).filter((n): n is string => Boolean(n)).sort((a, b) => a.localeCompare(b)),
    [staffProfiles],
  )

  const allRelevant = useMemo(() =>
    tasks
      .filter(t => !isOperationallyCompletedStatus(t) || (t.completed_at && t.completed_at.slice(0, 10) === today))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)),
  [tasks, today])

  const stats = useMemo(() => ({
    focus: focusTasks.length,
    clientRequests: verifiedActiveTasks.filter(t => t.priority === 'client_request').length,
    inProgress: verifiedActiveTasks.filter(t => isActuallyInProgressTask(t)).length,
    doneToday: tasks.filter(t => isOperationallyCompletedStatus(t) && t.completed_at?.slice(0, 10) === today).length,
    overdue: verifiedActiveTasks.filter(t => isOverdue(t, now)).length,
    today: verifiedActiveTasks.filter(t => isActiveForToday(t) && t.due_date === today).length,
  }), [tasks, verifiedActiveTasks, focusTasks, today, now])

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    setBusyId(id)
    setError(null)
    try {
      const { error } = await updateTaskStatus(id, status)
      if (error) {
        setError(error.message)
      } else {
        setTasks(prev => prev.map(t => {
          if (t.id !== id) return t
           const now = new Date().toISOString()
           return {
             ...t,
             status,
             updated_at: now,
             completed_at: t.data_origin === 'planner_tasks'
               ? null
               : (status as string) === 'done' ? now : null,
          }
        }))
      }
    } finally {
      setBusyId(null)
    }
  }, [])

  const handleCopy = useCallback((section: string, text: string) => {
    copyToClipboard(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }, [])

  const isAdmin = profile?.role === 'admin'
  const canManage = isManagerRole(profile?.role)
  const [drawerTask, setDrawerTask] = useState<CommandCentreTask | null>(null)

  useEffect(() => {
    if (!drawerTask) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerTask(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerTask])

  const handleOpenDetails = useCallback((task: CommandCentreTask) => {
    setDrawerTask(task)
  }, [])

  const handleSaveTask = useCallback((updated: CommandCentreTask) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setDrawerTask(updated)
  }, [])

  const handleDeleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    setDrawerTask(null)
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="h-3 w-24 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-8 w-48 animate-pulse rounded-lg bg-white/10" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">CG Hub</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Daily Tasks</h1>
        </div>
        <EmptyState
          title="Work setup required"
          message="Daily Tasks is not available yet."
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

      {/* A — Header */}
      <div className={`mb-5 ${embedded ? 'rounded-xl border border-white/8 bg-white/[0.025] p-4' : ''}`}>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Daily Tasks</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <Link to="/admin/ops-hub?tab=client-work" className="rounded-lg border border-brand-teal/25 bg-brand-teal/[0.06] px-3 py-2 text-brand-teal hover:text-white">Capture client request</Link>
          <button
            type="button"
            onClick={() => document.getElementById('morning-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-brand-primary hover:text-white"
          >
            Morning List Import
          </button>
        </div>
      </div>

      {/* B — Quick Add */}
      <div className="mb-5">
        <QuickAddCard onTaskCreated={load} staffNames={staffNames} />
      </div>

      {/* D — Filter row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterStaff('__my__')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            filterStaff === '__my__'
              ? 'bg-brand-accent text-brand-bg shadow-sm'
              : 'border border-brand-muted/60 text-brand-primary hover:text-white hover:border-brand-muted'
          }`}
        >
          My tasks
        </button>
        <button
          type="button"
          onClick={() => setFilterStaff('')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            !filterStaff
              ? 'bg-brand-accent text-brand-bg shadow-sm'
              : 'border border-brand-muted/60 text-brand-primary hover:text-white hover:border-brand-muted'
          }`}
        >
          All tasks
        </button>
        <select
          value={filterStaff !== '__my__' && filterStaff !== '' ? filterStaff : ''}
          onChange={e => setFilterStaff(e.target.value || '')}
          className="rounded-lg border border-brand-muted/60 bg-brand-bg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
        >
          <option value="">All staff</option>
          {staffNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-wrap gap-1 sm:col-span-2 lg:col-span-2">
          {([
            ['focus', 'Focus'],
            ['today', `Today ${stats.today}`],
            ['overdue', `Overdue ${stats.overdue}`],
            ['client_requests', `Client requests ${stats.clientRequests}`],
            ['in_progress', `In progress ${stats.inProgress}`],
            ['done', 'Done'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                workFilter === value
                  ? 'bg-brand-accent text-black'
                  : 'border border-white/10 text-brand-primary/65 hover:text-white hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={bucketFilter}
          onChange={e => setBucketFilter(e.target.value)}
          className="rounded-lg border border-brand-muted/60 bg-brand-bg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
        >
          <option value="">All work sections</option>
          {BUCKETS.map(bucket => <option key={bucket} value={bucket}>{bucket}</option>)}
        </select>
        <input
          type="search"
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
          placeholder="Search client or task"
          className="rounded-lg border border-brand-muted/60 bg-brand-bg px-3 py-2 text-xs text-white placeholder:text-brand-primary/35 focus:outline-none focus:ring-1 focus:ring-brand-accent"
        />
      </div>

      {/* E — Focus list */}
      <div className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">
            {workFilter === 'focus' ? 'Focus' : workFilter === 'client_requests' ? 'Client Requests' : workFilter.replace('_', ' ')}
          </h2>
          <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent">{focusTasks.length}</span>
        </div>
        {/* Truthful ownership headline. Most legacy work is still awaiting
            identity resolution; presenting it as cleanly assigned would be the
            exact falsehood this layer exists to stop. */}
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]" data-testid="ownership-summary">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-bold text-emerald-200">
            {ownershipTotals.verified} verified
          </span>
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-200">
            {ownershipTotals.needsReview} need assignment review
          </span>
          <span className="rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 font-bold text-red-200">
            {ownershipTotals.conflicts} assignment conflict
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 font-bold text-brand-primary/70">
            {ownershipTotals.unassigned} unassigned
          </span>
        </div>
        {focusTasks.length === 0 ? (
          <EmptyState title="All clear" message="No tasks match these filters." compact centered={false} />
        ) : filterStaff !== '' ? (
          <div className="space-y-2">
            {focusTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                busyId={busyId}
                onStatusChange={handleStatusChange}
                onOpenDetails={handleOpenDetails}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {focusGroupEntries.map(([staffName, staffTasks]) => (
              <PremiumCard key={staffName} padding="sm">
                <h3 className="mb-2 text-xs font-semibold text-brand-accent">@{staffName}</h3>
                <div className="space-y-2">
                  {staffTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busyId={busyId}
                      onStatusChange={handleStatusChange}
                      onOpenDetails={handleOpenDetails}
                    />
                  ))}
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </div>

      {/* F — Done today */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowDone(v => !v)}
          className="flex items-center gap-2 text-sm text-brand-primary/50 hover:text-brand-primary transition-colors"
        >
          <span>Done today</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs">{doneTodayTasks.length}</span>
          <span className="text-xs">{showDone ? '▴' : '▾'}</span>
        </button>
        {showDone && (
          <div className="mt-2">
            {doneTodayTasks.length === 0 ? (
              <p className="text-xs text-brand-primary/40">Nothing done today yet.</p>
            ) : (
              <div className="space-y-2">
                {doneTodayTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    busyId={busyId}
                    onStatusChange={handleStatusChange}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* G — WhatsApp morning + end-of-day */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MorningMessageCard
          ownershipGrouping={ownershipGrouping}
          copiedSection={copiedSection}
          onCopy={handleCopy}
        />
        <EndOfDayCard
          allRelevant={allRelevant}
          ownershipOf={ownershipOf}
          copiedSection={copiedSection}
          onCopy={handleCopy}
        />
      </div>

      {/* H — Morning List Import */}
      <div id="morning-import" className="mb-6">
        <MorningImportCard onTasksCreated={load} />
      </div>

      {drawerTask && (
        <TaskDetailDrawer
          staffNames={staffNames}
          task={drawerTask}
          isAdmin={isAdmin}
          canManage={canManage}
          onClose={() => setDrawerTask(null)}
          onSaved={handleSaveTask}
          onDeleted={handleDeleteTask}
        />
      )}
    </div>
  )
}

function QuickAddCard({ onTaskCreated, staffNames }: { onTaskCreated: () => void; staffNames: string[] }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [clientId, setClientId] = useState('')
  const [manualClientName, setManualClientName] = useState('')
  const [assignedName, setAssignedName] = useState(profile?.full_name ?? '')
  const [bucket, setBucket] = useState<TaskBucket>('Admin / To Do')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState(todayStr)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError, setClientsError] = useState<string | null>(null)

  useEffect(() => {
    if (!showDetails || clients.length > 0) return
    let active = true
    const timer = window.setTimeout(() => {
      setClientsLoading(true)
      setClientsError(null)
      listActiveClients().then(({ data, error }) => {
        if (!active) return
        setClientsLoading(false)
        if (error) { setClientsError('Client list unavailable.'); return }
        setClients(data ?? [])
      }).catch(() => {
        if (active) { setClientsLoading(false); setClientsError('Client list unavailable.') }
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [showDetails, clients.length])

  const isManualClient = clientId === '__manual__'
  const selectedClient = clients.find(c => c.id === clientId)

  function resetForm() {
    setTitle('')
    setClientId('')
    setManualClientName('')
    setAssignedName(profile?.full_name ?? '')
    setBucket('Admin / To Do')
    setPriority('normal')
    setDueDate(todayStr)
    setNotes('')
    setShowDetails(false)
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const input: TaskInput = {
        title: title.trim(),
        client_id: selectedClient?.id ?? null,
        client_name: isManualClient ? manualClientName.trim() || null : selectedClient?.name ?? null,
        assigned_to_name: assignedName.trim() || null,
        assigned_to_user_id: assignedName.trim() === profile?.full_name?.trim() ? profile?.id ?? null : null,
        bucket,
        priority,
        status: 'to_do',
        due_date: dueDate,
        notes: notes.trim() || null,
        source: 'manual',
      }
      const { error } = await createTask(input)
      if (error) { setError(error.message); return }
      resetForm()
      onTaskCreated()
    } catch {
      setError('Could not save task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PremiumCard padding="md">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="Add a task..."
            className="min-w-0 flex-1 rounded-lg border border-brand-muted bg-brand-bg px-3 py-2.5 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
          <ActionButton
            variant="primary"
            type="submit"
            disabled={saving || !title.trim()}
            loading={saving}
          >
            Add
          </ActionButton>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="mt-2 text-xs text-brand-primary/55 hover:text-brand-primary transition-colors"
        >
          {showDetails ? '− Hide details' : '+ Details'}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-brand-primary">Client</label>
                {clientsLoading ? (
                  <p className="py-2 text-xs text-brand-primary/60">Loading clients...</p>
                ) : (
                  <>
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">No client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="__manual__">Manual / other client</option>
                    </select>
                    {clientsError && (
                      <p className="mt-1 text-xs text-amber-400">{clientsError}</p>
                    )}
                  </>
                )}
                {isManualClient && (
                  <input
                    value={manualClientName}
                    onChange={e => setManualClientName(e.target.value)}
                    placeholder="Type client name"
                    className="mt-2 w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-primary">Assigned to</label>
                <select
                  value={assignedName}
                  onChange={e => setAssignedName(e.target.value)}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                >
                  <option value="">Unassigned</option>
                  {staffNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-primary">Bucket</label>
                <select
                  value={bucket}
                  onChange={e => setBucket(e.target.value as TaskBucket)}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                >
                  {BUCKETS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-primary">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>
                      {p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-primary">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-primary">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Client request? Paste WhatsApp message here."
                className="w-full resize-none rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </form>
    </PremiumCard>
  )
}

function TaskRow({ task, busyId, onStatusChange, onOpenDetails }: {
  task: CommandCentreTask
  busyId: string | null
  onStatusChange: (id: string, status: TaskStatus) => void
  onOpenDetails: (task: CommandCentreTask) => void
}) {
  const accentColor = task.priority === 'urgent' ? 'bg-amber-400/40'
    : task.priority === 'client_request' ? 'bg-brand-accent/40'
    : 'bg-brand-muted/30'
  return (
    <div className="relative">
      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${accentColor}`} />
      <PremiumCard padding="sm">
        <div className="flex flex-col gap-2 pl-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenDetails(task)}
                className="text-sm font-semibold text-white hover:text-brand-accent transition-colors text-left"
              >
                {task.title}
              </button>
              {task.priority !== 'normal' && (
                <Pill tone={priorityColor(task.priority)}>
                  {task.priority === 'urgent' ? 'Urgent' : task.source === 'whatsapp_paste' ? 'Client req · WA' : 'Client req'}
                </Pill>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {task.client_name && <span className="text-brand-primary">{task.client_name}</span>}
              <span className={dateClass(task.due_date)}>{formatDate(task.due_date)}</span>
              <span className="text-brand-primary/50">·</span>
              <span className="text-brand-primary/60">{task.bucket}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isOperationallyCompletedStatus(task) && (
              <select
                value={task.status}
                onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
                disabled={busyId === task.id}
                className="rounded-lg border border-brand-muted/60 bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:opacity-60"
              >
                {/* The current value shows the truthful label (raw Planner state
                    for approved/scheduled/ready rows) while still allowing a
                    coarse change from this surface. */}
                <option value={task.status}>{taskStatusDisplayLabel(task)}</option>
                {STATUSES.filter(s => s !== task.status).map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            )}
            {isOperationallyCompletedStatus(task) && (
              <button
                type="button"
                onClick={() => onStatusChange(task.id, 'to_do')}
                disabled={busyId === task.id}
                className="rounded-lg border border-brand-muted/60 px-2 py-1.5 text-xs text-brand-primary hover:text-white disabled:opacity-60"
              >
                Reopen
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenDetails(task)}
              className="rounded-lg border border-brand-muted/60 px-2 py-1.5 text-xs text-brand-primary hover:text-white transition-colors"
              title="Open details"
            >
              ···
            </button>
          </div>
        </div>
      </PremiumCard>
    </div>
  )
}

function MorningImportCard({ onTasksCreated }: {
  onTasksCreated: () => void
}) {
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedMorningTask[] | null>(null)
  const [edits, setEdits] = useState<MorningTaskEdit[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listActiveClients().then(({ data, error }) => {
      if (!active) return
      setClientsLoading(false)
      if (error) {
        setClientsError('Client list unavailable.')
        return
      }
      setClients(data ?? [])
    }).catch(() => {
      if (active) {
        setClientsLoading(false)
        setClientsError('Client list unavailable.')
      }
    })
    return () => { active = false }
  }, [])

  function handleParse() {
    if (!rawText.trim()) return
    setError(null)
    setSuccess(null)
    const parsedTasks = parseMorningList(rawText, clients)
    if (parsedTasks.length === 0) {
      setError('No tasks found. Make sure each task starts with a bullet like "- task name".')
      return
    }
    setParsed(parsedTasks)
    setEdits(parsedTasks.map(t => ({
      id: t.id,
      clientOption: t.clientId ? t.clientId : '',
      manualClientName: '',
      clientName: t.clientName,
      title: t.title,
      bucket: t.bucket,
      priority: t.priority,
      dueDate: t.dueDate,
      notes: t.notes || '',
    })))
  }

  function handleDeleteRow(id: string) {
    setEdits(prev => prev.filter(e => e.id !== id))
    setParsed(prev => prev ? prev.filter(p => p.id !== id) : null)
    setError(null)
    setSuccess(null)
  }

  function updateEdit(id: string, patch: Partial<MorningTaskEdit>) {
    setEdits(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleCreateAll() {
    if (saving || edits.length === 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    let created = 0
    const createdIds: string[] = []
    for (const edit of edits) {
      const input = morningEditToInput(edit, clients)
      const original = parsed?.find(p => p.id === edit.id)
      input.assigned_to_name = original?.staffName === 'Unassigned' ? null : original?.staffName ?? null
      const { error } = await createTask(input)
      if (error) {
        setEdits(previous => previous.filter(item => !createdIds.includes(item.id)))
        setParsed(previous => previous ? previous.filter(item => !createdIds.includes(item.id)) : null)
        setError(`Error creating task "${edit.title}": ${error.message}`)
        setSaving(false)
        return
      }
      created++
      createdIds.push(edit.id)
    }
    setSaving(false)
    setSuccess(`Created ${created} task${created === 1 ? '' : 's'}.`)
    setParsed(null)
    setEdits([])
    setRawText('')
    onTasksCreated()
  }

  return (
    <PremiumCard padding="md">
      <h2 className="mb-3 text-base font-semibold text-white">Morning List Import</h2>

      {!parsed ? (
        <>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={6}
            placeholder={`@Sydney\n- Cape Lumber poster design\n- First Tech content guide\n\n@Ger-Marie\n- Bloem Marble poster design\n- Central Canvas 4 designs 4 photos`}
            className="w-full resize-none rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
          <ActionButton
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleParse}
            disabled={!rawText.trim()}
          >
            Parse list
          </ActionButton>
        </>
      ) : (
        <>
          {success && (
            <p className="mb-3 text-xs text-[#2dd4bf]">{success}</p>
          )}
          {error && (
            <p className="mb-3 text-xs text-red-400">{error}</p>
          )}
          <div className="space-y-2">
            {edits.map((edit, i) => {
              const original = parsed?.find(p => p.id === edit.id)
              const isManual = edit.clientOption === '__manual__'
              const confidence = original?.clientConfidence ?? 'needs_review'
              return (
                <div key={edit.id} className="rounded-lg border border-brand-muted bg-brand-bg p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-brand-accent">
                        {original?.staffName ?? `Task ${i + 1}`}
                      </span>
                      <ConfidenceBadge confidence={confidence} />
                      {/* Reads the SELECTED client, never a separate suggestion.
                          A badge naming a client the field does not hold is what
                          made the preview disagree with what was saved. */}
                      {edit.clientOption && edit.clientOption !== '__manual__' && (
                        <span
                          data-testid="selected-client"
                          className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-brand-primary/70"
                        >
                          Client: {clients.find(c => c.id === edit.clientOption)?.name ?? edit.clientName}
                        </span>
                      )}
                      {!edit.clientOption && original?.reviewReasons?.some(r => r.startsWith('Choose the client')) && (
                        <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-200">
                          {original.reviewReasons.find(r => r.startsWith('Choose the client'))}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(edit.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  {original?.reviewReasons.length ? (
                    <p className="mb-2 text-[11px] text-amber-300/85">{original.reviewReasons.join(' · ')}</p>
                  ) : null}
                  {original?.originalText ? (
                    <p className="mb-2 text-[11px] text-brand-primary/45">Original WhatsApp: {original.originalText}</p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-brand-primary">Client</label>
                      {clientsLoading ? (
                        <p className="py-1 text-xs text-brand-primary/60">Loading...</p>
                      ) : (
                        <>
                          <select
                            value={edit.clientOption}
                            onChange={e => {
                              const value = e.target.value
                              const selected = clients.find(c => c.id === value)
                              updateEdit(edit.id, {
                                clientOption: value,
                                clientName: selected?.name ?? null,
                                manualClientName: '',
                              })
                            }}
                            className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                          >
                            <option value="">No client</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                            <option value="__manual__">Manual / other client</option>
                          </select>
                          {clientsError && (
                            <p className="mt-1 text-[11px] text-amber-400">{clientsError}</p>
                          )}
                        </>
                      )}
                      {isManual && (
                        <input
                          value={edit.manualClientName}
                          onChange={e => updateEdit(edit.id, {
                            manualClientName: e.target.value,
                            clientName: e.target.value.trim() || null,
                          })}
                          placeholder="Type client name"
                          className="mt-1 w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] text-brand-primary">Title</label>
                      <input
                        value={edit.title}
                        onChange={e => updateEdit(edit.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-brand-primary">Bucket</label>
                      <select
                        value={edit.bucket}
                        onChange={e => updateEdit(edit.id, { bucket: e.target.value as TaskBucket })}
                        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      >
                        {BUCKETS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-brand-primary">Priority</label>
                      <select
                        value={edit.priority}
                        onChange={e => updateEdit(edit.id, { priority: e.target.value as TaskPriority })}
                        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      >
                        {PRIORITIES.map(p => (
                          <option key={p} value={p}>
                            {p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-brand-primary">Due date</label>
                      <input
                        type="date"
                        value={edit.dueDate}
                        onChange={e => updateEdit(edit.id, { dueDate: e.target.value })}
                        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] text-brand-primary">Notes</label>
                      <input
                        value={edit.notes}
                        onChange={e => updateEdit(edit.id, { notes: e.target.value })}
                        placeholder="Optional details"
                        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-2 py-1.5 text-xs text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ActionButton
              variant="primary"
              onClick={handleCreateAll}
              disabled={saving || edits.length === 0}
              loading={saving}
            >
              Create {edits.length} task{edits.length === 1 ? '' : 's'}
            </ActionButton>
            <button
              type="button"
              onClick={() => { setParsed(null); setEdits([]); setError(null); setSuccess(null) }}
              className="text-xs text-brand-primary hover:text-white"
            >
              Back to paste
            </button>
          </div>
        </>
      )}
    </PremiumCard>
  )
}

function ConfidenceBadge({ confidence }: { confidence: ParsedMorningTask['clientConfidence'] }) {
  // Two states only. There is no 'Suggested' badge, because a suggestion that
  // is not also the selected client is exactly the divergence being removed.
  const label = confidence === 'confident' ? 'Matched' : 'Needs review'
  const tone = confidence === 'confident'
    ? 'border-brand-teal/25 bg-brand-teal/[0.08] text-[#2dd4bf]'
    : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300'

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${tone}`}>
      {label}
    </span>
  )
}

function MorningMessageCard({ ownershipGrouping, copiedSection, onCopy }: {
  ownershipGrouping: OwnershipGrouping<CommandCentreTask>
  copiedSection: string | null
  onCopy: (section: string, text: string) => void
}) {
  const message = useMemo(() => buildMorningMessage(ownershipGrouping), [ownershipGrouping])
  const totals = useMemo(() => ownershipCounts(ownershipGrouping), [ownershipGrouping])
  const hasAnything = totals.verified + totals.needsReview + totals.conflicts + totals.unassigned > 0
  const isCopied = copiedSection === 'morning'

  return (
    <PremiumCard padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">WhatsApp morning message</h2>
          <p className="text-xs text-brand-primary">Copy-ready daily task summary.</p>
        </div>
        <ActionButton
          variant="outline"
          size="sm"
          onClick={() => onCopy('morning', message)}
          disabled={!hasAnything}
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </ActionButton>
      </div>
      {/* Truthful headline. Most legacy work is awaiting identity resolution;
          hiding that would misrepresent how much of this is actually verified. */}
      <p className="mt-2 text-[11px] text-brand-primary/70" data-testid="ownership-totals">
        {totals.verified} verified · {totals.needsReview} need assignment review · {totals.conflicts} conflict · {totals.unassigned} unassigned
      </p>
      {!hasAnything ? (
        <p className="mt-3 text-xs text-brand-primary/60">No tasks to generate a message.</p>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-brand-muted bg-brand-bg p-3 text-xs leading-relaxed text-brand-primary/80 whitespace-pre-wrap font-mono">
          {message}
        </pre>
      )}
    </PremiumCard>
  )
}

function EndOfDayCard({ allRelevant, ownershipOf, copiedSection, onCopy }: {
  allRelevant: CommandCentreTask[]
  ownershipOf: (t: CommandCentreTask) => Ownership
  copiedSection: string | null
  onCopy: (section: string, text: string) => void
}) {
  const message = useMemo(() => buildEndOfDay(allRelevant, ownershipOf), [allRelevant, ownershipOf])
  const isCopied = copiedSection === 'end-of-day'

  return (
    <PremiumCard padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">End-of-day update</h2>
          <p className="text-xs text-brand-primary">Progress summary ready to share.</p>
        </div>
        <ActionButton
          variant="outline"
          size="sm"
          onClick={() => onCopy('end-of-day', message)}
          disabled={allRelevant.length === 0}
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </ActionButton>
      </div>
      {allRelevant.length === 0 ? (
        <p className="mt-3 text-xs text-brand-primary/60">No tasks to generate a summary.</p>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-brand-muted bg-brand-bg p-3 text-xs leading-relaxed text-brand-primary/80 whitespace-pre-wrap font-mono">
          {message}
        </pre>
      )}
    </PremiumCard>
  )
}

function TaskDetailDrawer({ task, isAdmin, canManage, staffNames, onClose, onSaved, onDeleted }: {
  task: CommandCentreTask
  isAdmin: boolean
  canManage: boolean
  staffNames: string[]
  onClose: () => void
  onSaved: (updated: CommandCentreTask) => void
  onDeleted: (id: string) => void
}) {
  const { profile } = useAuth()
  const keyboardInset = useVisualViewportBottomInset()
  const [title, setTitle] = useState(task.title)
  const [clientId, setClientId] = useState(task.client_id ?? '')
  const [clientName, setClientName] = useState(task.client_name ?? '')
  const [assignedName, setAssignedName] = useState(task.assigned_to_name ?? '')
  const [bucket, setBucket] = useState<TaskBucket>(task.bucket)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.due_date)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [helperNames, setHelperNames] = useState((task.helper_names ?? []).join(', '))
  const [packageAction, setPackageAction] = useState<PackageAction | ''>(task.package_action ?? '')
  const [quoteNeeded, setQuoteNeeded] = useState(Boolean(task.quote_needed))
  const [adminPackageNote, setAdminPackageNote] = useState(task.admin_package_note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const statusOptions = task.data_origin === 'planner_tasks'
    ? STATUSES.filter(value => value !== 'moved_to_tomorrow')
    : STATUSES

  async function handleSave() {
    if (saving || !title.trim()) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      if (!canManage) {
        if (status === task.status) {
          setSaveMsg('No changes')
          return
        }
        const result = await updateTaskStatus(task.id, status)
        if (result.error) { setSaveError(result.error.message); return }
        const saved = result.data as { updated_at?: string; completed_at?: string | null } | null
        onSaved({
          ...task,
          status,
          updated_at: saved?.updated_at ?? task.updated_at,
          completed_at: saved && 'completed_at' in saved ? saved.completed_at ?? null : task.completed_at,
        })
        setSaveMsg('Status saved')
        return
      }
      const updates: Partial<TaskUpdateFields> = {}
      const nextTitle = title.trim()
      const nextClientId = clientId || null
      const nextClientName = clientName || null
      const nextNotes = notes.trim() || null
      if (nextTitle !== task.title) updates.title = nextTitle
      if (nextClientId !== task.client_id) updates.client_id = nextClientId
      if (nextClientName !== task.client_name) updates.client_name = nextClientName
      if (bucket !== task.bucket) updates.bucket = bucket
      if (priority !== task.priority) updates.priority = priority
      if (status !== task.status) updates.status = status
      if (dueDate !== task.due_date) updates.due_date = dueDate
      if (nextNotes !== task.notes) updates.notes = nextNotes

      if (task.data_origin !== 'planner_tasks') {
        const nextAssignedName = assignedName.trim() || null
        const nextAssignedId = assignedName.trim() === profile?.full_name?.trim() ? profile?.id ?? null : null
        const nextHelpers = helperNames.split(',').map(name => name.trim()).filter(Boolean)
        if (nextAssignedName !== task.assigned_to_name) updates.assigned_to_name = nextAssignedName
        if (nextAssignedId !== task.assigned_to_user_id) updates.assigned_to_user_id = nextAssignedId
        if (JSON.stringify(nextHelpers) !== JSON.stringify(task.helper_names ?? [])) updates.helper_names = nextHelpers
        const nextPackageAction = packageAction || null
        const nextAdminNote = adminPackageNote.trim() || null
        if (nextPackageAction !== (task.package_action ?? null)) updates.package_action = nextPackageAction
        if (quoteNeeded !== (task.quote_needed ?? false)) updates.quote_needed = quoteNeeded
        if (nextAdminNote !== (task.admin_package_note ?? null)) updates.admin_package_note = nextAdminNote
      }
      if (Object.keys(updates).length === 0) {
        setSaveMsg('No changes')
        return
      }
      const { error } = await updateTask(task.id, updates)
      if (error) { setSaveError(error.message); return }
      const updated: CommandCentreTask = {
        ...task,
        ...updates,
        updated_at: new Date().toISOString(),
        completed_at: task.data_origin === 'planner_tasks'
          ? null
          : status !== task.status
            ? (status as string) === 'done' ? new Date().toISOString() : null
            : task.completed_at,
      }
      onSaved(updated)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch {
      setSaveError('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const result = task.data_origin === 'planner_tasks'
        ? await archiveImportedPlannerTask(task.id, profile?.full_name ?? null)
        : await deleteTask(task.id)
      if (result.error) {
        const err = result.error as { code?: string; message?: string }
        setSaveError(err.code === '42703'
          ? 'Archiving is not available yet.'
          : err.message ?? 'Could not remove task.')
        setDeleting(false)
        return
      }
      onDeleted(task.id)
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'
  const isClientRequest = priority === 'client_request' || bucket === 'Client Requests' || task.source === 'whatsapp_paste'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#111111] sm:w-[480px] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 className="text-base font-semibold text-white">Task details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-primary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {isClientRequest && (
            <div className="flex items-center gap-2">
              <Pill tone="accent">
                {task.source === 'whatsapp_paste' ? 'Client req · WA' : 'Client request'}
              </Pill>
              {task.source === 'whatsapp_paste' && (
                <span className="text-xs text-brand-primary/60">From WhatsApp</span>
              )}
            </div>
          )}
          {!canManage && (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-brand-primary/70">Task details are manager-controlled. You can update the status of work assigned to you.</p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label>
            <select value={assignedName} onChange={e => setAssignedName(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {staffNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Bucket</label>
              <select value={bucket} onChange={e => setBucket(e.target.value as TaskBucket)} className={inputCls}>
                {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className={inputCls}>
                {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-brand-primary">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">
              {priority === 'client_request' ? 'Notes — paste WhatsApp message here' : 'Notes'}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className={`resize-none ${inputCls}`}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p>
            {canManage ? (
              <input value={helperNames} onChange={event => setHelperNames(event.target.value)} placeholder="Names separated by commas" className={inputCls} />
            ) : task.helper_names !== undefined ? (
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
              <p className="text-[11px] text-white/30">Not available yet</p>
            )}
          </div>

          {isAdmin && isClientRequest && (
            <div className="rounded-lg border border-white/[0.06] bg-brand-surface/40 px-3 py-3">
              <p className="mb-2.5 text-xs font-medium text-brand-primary">Client request decision</p>
              {task.data_origin === 'planner_tasks' && (
                <p className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-2 text-[11px] text-amber-200">
                  Imported Planner request. Edit task details here; handle package decisions in Client Schedule.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(['use_slot', 'addon', 'move_work'] as const).map(action => (
                  <button
                    key={action}
                    type="button"
                    disabled={task.data_origin === 'planner_tasks'}
                    onClick={() => setPackageAction(action)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      packageAction === action
                        ? 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent'
                        : 'border-white/10 text-brand-primary/60 hover:text-white'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {action === 'use_slot' ? 'Use package slot' : action === 'addon' ? 'Mark as add-on' : 'Move to another month'}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-brand-primary/75">
                <input
                  type="checkbox"
                  checked={quoteNeeded}
                  disabled={task.data_origin === 'planner_tasks'}
                  onChange={e => setQuoteNeeded(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black"
                />
                Quote needed
              </label>
              <textarea
                value={adminPackageNote}
                disabled={task.data_origin === 'planner_tasks'}
                onChange={e => setAdminPackageNote(e.target.value)}
                rows={2}
                placeholder="Admin package note"
                className={`mt-3 resize-none ${inputCls} disabled:opacity-40`}
              />
            </div>
          )}

          <div className="rounded-lg border border-white/[0.06] bg-brand-surface/40 px-3 py-2.5">
            <p className="mb-2 text-xs font-medium text-brand-primary">Timer</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/10 px-3 py-1.5 text-xs text-brand-primary/30">Start</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/10 px-3 py-1.5 text-xs text-brand-primary/30">Pause</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/10 px-3 py-1.5 text-xs text-brand-primary/30">Stop</button>
            </div>
            <p className="mt-1.5 text-[11px] text-brand-primary/40">Not available yet</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-5 py-4" style={{ paddingBottom: keyboardInset > 0 ? `calc(1rem + ${keyboardInset}px)` : undefined }}>
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
            {canManage && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                {task.data_origin === 'planner_tasks' ? 'Remove from active' : 'Delete task'}
              </button>
            )}
            {canManage && confirmDelete && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-brand-primary">Sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {deleting ? 'Removing...' : task.data_origin === 'planner_tasks' ? 'Yes, remove' : 'Yes, delete'}
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
