import { useEffect, useMemo, useRef, useState, type FormEvent, type WheelEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClientPicker } from '../../components/ClientPicker'
import {
  PlannerAssigneeAvatars,
  PlannerPeoplePicker,
  type PlannerPerson,
} from '../../components/PlannerPeoplePicker'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import {
  archivePlannerTask,
  createPlannerTask,
  isMissingPlannerAssignmentRpcError,
  listPlannerActivity,
  listPlannerAssignmentDirectory,
  listPlannerBoards,
  listPlannerBuckets,
  listPlannerTasks,
  PLANNER_TASK_STATUSES,
  PLANNER_TASK_STATUS_LABELS,
  PRIORITIES,
  updatePlannerTaskWithAssignees,
  updatePlannerTaskStatus,
  type PlannerActivityLog,
  type PlannerBoard,
  type PlannerBucket,
  type PlannerTask,
  type PlannerTaskStatus,
  type TaskPriority,
} from '../../lib/planner'
import { isRecurringTemplate, materializeRecurringTasks } from '../../lib/recurrence'
import { isManagerRole } from '../../lib/roles'

type PlannerWorkView = 'active' | 'history'
type QuickScope = 'all' | 'overdue' | 'blocked' | 'unassigned'
const NO_BUCKET_ID = '__none__'

const BOARD_LABELS: Record<string, string> = {
  'operations-todo': 'Operations',
  'client-websites': 'Websites',
  'admin-check-list': 'Admin',
  'cg-socials': 'CG Socials',
}

function dateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPlannerDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isPlannerHistoryTask(task: PlannerTask) {
  return Boolean(task.archived_at) || ['approved', 'scheduled', 'done'].includes(task.status)
}

function isOverdue(task: PlannerTask) {
  return Boolean(task.due_date && task.due_date < dateKey() && !isPlannerHistoryTask(task))
}

function taskSortRank(task: PlannerTask) {
  if (task.priority === 'client_request') return 0
  if (task.priority === 'urgent') return 1
  if (isOverdue(task)) return 2
  if (task.due_date === dateKey()) return 3
  if (task.status === 'blocked') return 4
  if (task.status === 'in_progress') return 5
  return task.due_date ? 6 : 7
}

function statusTone(status: PlannerTaskStatus) {
  if (status === 'blocked') return 'border-red-400/25 text-red-300'
  if (status === 'in_progress') return 'border-brand-accent/25 text-brand-accent'
  if (status === 'ready_internal_review') return 'border-amber-400/25 text-amber-300'
  if (['approved', 'scheduled', 'done'].includes(status)) return 'border-brand-teal/25 text-brand-teal'
  return 'border-white/10 text-white/45'
}

function taskPeople(task: PlannerTask): PlannerPerson[] {
  return task.assignees.map(person => ({
    id: person.profile_id,
    full_name: person.full_name,
    role: person.role,
    avatar_url: person.avatar_url,
    is_active: person.is_active,
  }))
}

type ChecklistRow = {
  key: string
  text: string
  done: boolean
  raw: unknown
  recognized: boolean
}

function checklistRows(value: unknown): ChecklistRow[] {
  if (!Array.isArray(value)) return []
  return value.map((raw, index) => {
    if (typeof raw === 'string') {
      return { key: `item-${index}`, text: raw, done: false, raw, recognized: true }
    }
    if (raw && typeof raw === 'object') {
      const item = raw as Record<string, unknown>
      const textValue = item.text ?? item.title ?? item.name
      if (typeof textValue === 'string') {
        const doneValue = item.done ?? item.completed ?? item.is_checked
        return { key: `item-${index}`, text: textValue, done: doneValue === true, raw, recognized: true }
      }
    }
    return { key: `item-${index}`, text: 'Imported checklist value', done: false, raw, recognized: false }
  })
}

function checklistProgress(task: PlannerTask) {
  const rows = checklistRows(task.checklist)
  return { complete: rows.filter(row => row.recognized && row.done).length, total: rows.filter(row => row.recognized).length }
}

async function fetchBoardTasks(board: PlannerBoard, shouldMaterialize: boolean) {
  if (shouldMaterialize) {
    const materialized = await materializeRecurringTasks()
    if (materialized.error) return { data: null, error: { message: materialized.error } }
    if (materialized.migrationNeeded) {
      return { data: null, error: { message: 'Recurring task migration is required before Planner can load safely.' } }
    }
  }
  const { data, error } = await listPlannerTasks(board.id)
  if (error) return { data: null, error }
  return { data: (data ?? []).filter(task => !isRecurringTemplate(task)), error: null }
}

export default function PlannerPage({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth()
  const [routeParams, setSearchParams] = useSearchParams()
  const canManage = isManagerRole(profile?.role)
  const isAdmin = profile?.role === 'admin'
  const [boards, setBoards] = useState<PlannerBoard[]>([])
  const [buckets, setBuckets] = useState<PlannerBucket[]>([])
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [directory, setDirectory] = useState<PlannerPerson[]>([])
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [activeBoard, setActiveBoard] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardRetry, setBoardRetry] = useState(0)
  const [bucketsLoading, setBucketsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [bucketError, setBucketError] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [bucketRetry, setBucketRetry] = useState(0)
  const [taskRetry, setTaskRetry] = useState(0)
  const [tableMissing, setTableMissing] = useState(false)
  const [drawerTask, setDrawerTask] = useState<PlannerTask | null>(null)
  const [workView, setWorkView] = useState<PlannerWorkView>('active')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PlannerTaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('')
  const [quickScope, setQuickScope] = useState<QuickScope>('all')
  const [bucketsBoardId, setBucketsBoardId] = useState<string | null>(null)
  const [tasksBoardId, setTasksBoardId] = useState<string | null>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const bucketScrollRefs = useRef(new Map<string, HTMLDivElement>())
  const savedScroll = useRef({ board: 0, buckets: new Map<string, number>() })
  const taskRequestRef = useRef(0)

  useEffect(() => {
    let active = true
    void listPlannerAssignmentDirectory().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setAssignmentError(isMissingPlannerAssignmentRpcError(error)
          ? 'Planner assignment migration required. Assignment changes are disabled until it is applied.'
          : `Could not load the assignment directory. Assignment changes are disabled. ${error.message ?? ''}`.trim())
        return
      }
      setDirectory((data ?? []).map(person => ({ ...person })))
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      listPlannerBoards().then(({ data, error }) => {
        if (!active) return
        setLoading(false)
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setTableMissing(true)
            setBoardError(null)
          } else {
            setTableMissing(false)
            setBoardError(error.message ?? 'Could not load Planner boards.')
          }
          return
        }
        setBoardError(null)
        setTableMissing(false)
        const result = data ?? []
        setBoards(result)
        setActiveBoard(current => current ?? result.find(board => board.slug !== 'client-schedule')?.slug ?? null)
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [boardRetry])

  const activeBoardRecord = useMemo(
    () => boards.find(board => board.slug === activeBoard) ?? null,
    [activeBoard, boards],
  )

  useEffect(() => {
    if (!activeBoardRecord) return
    let active = true
    void listPlannerBuckets(activeBoardRecord.id).then(({ data, error }) => {
      if (!active) return
      setBucketsLoading(false)
      if (error) {
        setBucketError(error.message ?? 'Could not load Planner buckets.')
        return
      }
      setBucketError(null)
      setBuckets(data ?? [])
      setBucketsBoardId(activeBoardRecord.id)
    })
    return () => { active = false }
  }, [activeBoardRecord, bucketRetry])

  useEffect(() => {
    if (!activeBoardRecord) return
    let active = true
    const requestId = ++taskRequestRef.current
    const timer = window.setTimeout(() => {
      setTasksLoading(true)
      void fetchBoardTasks(activeBoardRecord, canManage).then(result => {
        if (!active || requestId !== taskRequestRef.current) return
        if (result.error) {
          setTaskError(result.error.message ?? 'Could not load Planner tasks.')
          return
        }
        setTaskError(null)
        setTasks(result.data)
        setTasksBoardId(activeBoardRecord.id)
      }).finally(() => {
        if (active && requestId === taskRequestRef.current) setTasksLoading(false)
      })
    }, 0)
    return () => { active = false; taskRequestRef.current += 1; window.clearTimeout(timer) }
  }, [activeBoardRecord, canManage, taskRetry])

  const displayedBuckets = useMemo(
    () => bucketsBoardId === activeBoardRecord?.id ? buckets : [],
    [activeBoardRecord?.id, buckets, bucketsBoardId],
  )
  const displayedTasks = useMemo(
    () => tasksBoardId === activeBoardRecord?.id ? tasks : [],
    [activeBoardRecord?.id, tasks, tasksBoardId],
  )
  const routeAssignee = routeParams.get('assignee')
  const effectiveAssigneeFilter = routeAssignee ? `person:${routeAssignee}` : assigneeFilter
  const routeScope = routeParams.get('scope')
  const effectiveQuickScope: QuickScope = routeScope === 'all' || routeScope === 'overdue' || routeScope === 'blocked' || (routeScope === 'unassigned' && canManage)
    ? routeScope
    : quickScope

  const people = useMemo(() => {
    const result = new Map(directory.map(person => [person.id, person]))
    for (const task of displayedTasks) {
      for (const person of taskPeople(task)) {
        if (!result.has(person.id)) result.set(person.id, { ...person, is_active: false })
      }
    }
    return [...result.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [directory, displayedTasks])

  const assigneeOptions = useMemo(() => {
    const canonical = people.map(person => ({ value: `person:${person.id}`, label: `${person.full_name}${person.is_active ? '' : ' (inactive)'}` }))
    const legacyNames = [...new Set(displayedTasks.flatMap(task => task.unresolved_assignee_names))]
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ value: `legacy:${name}`, label: `${name} (imported)` }))
    return [...canonical, ...legacyNames]
  }, [displayedTasks, people])

  const sortedBoards = useMemo(() => boards
    .filter(board => board.slug !== 'client-schedule')
    .sort((a, b) => {
      const aAdmin = a.board_type === 'admin' || a.slug === 'admin-check-list'
      const bAdmin = b.board_type === 'admin' || b.slug === 'admin-check-list'
      return aAdmin === bAdmin ? a.sort_order - b.sort_order : aAdmin ? 1 : -1
    }), [boards])

  const activeTaskCount = useMemo(() => displayedTasks.filter(task => !isPlannerHistoryTask(task)).length, [displayedTasks])
  const historyTaskCount = useMemo(() => displayedTasks.filter(isPlannerHistoryTask).length, [displayedTasks])

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    const client = clientFilter.trim().toLowerCase()
    return displayedTasks.filter(task => {
      if (workView === 'history' ? !isPlannerHistoryTask(task) : isPlannerHistoryTask(task)) return false
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
      if (client && !task.client_name?.toLowerCase().includes(client)) return false
      const names = [...task.assignees.map(person => person.full_name), ...task.unresolved_assignee_names]
      if (term && ![task.title, task.client_name, ...names].some(value => value?.toLowerCase().includes(term))) return false
      if (effectiveAssigneeFilter.startsWith('person:') && !task.assignees.some(person => person.profile_id === effectiveAssigneeFilter.slice(7))) return false
      if (effectiveAssigneeFilter.startsWith('legacy:') && !task.unresolved_assignee_names.includes(effectiveAssigneeFilter.slice(7))) return false
      if (effectiveQuickScope === 'overdue' && !isOverdue(task)) return false
      if (effectiveQuickScope === 'blocked' && task.status !== 'blocked') return false
      if (effectiveQuickScope === 'unassigned' && task.assignees.length > 0) return false
      return true
    })
  }, [clientFilter, displayedTasks, effectiveAssigneeFilter, effectiveQuickScope, priorityFilter, search, statusFilter, workView])

  const tasksByBucket = useMemo(() => {
    const result = new Map<string, PlannerTask[]>()
    for (const task of visibleTasks) {
      const key = task.bucket_id ?? '__none__'
      result.set(key, [...(result.get(key) ?? []), task])
    }
    for (const bucketTasks of result.values()) {
      bucketTasks.sort((a, b) => taskSortRank(a) - taskSortRank(b)
        || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
        || a.title.localeCompare(b.title))
    }
    return result
  }, [visibleTasks])
  const bucketlessTasks = tasksByBucket.get(NO_BUCKET_ID) ?? []

  function captureScroll() {
    savedScroll.current.board = boardScrollRef.current?.scrollLeft ?? 0
    savedScroll.current.buckets = new Map([...bucketScrollRefs.current].map(([id, node]) => [id, node.scrollTop]))
  }

  function restoreScroll() {
    window.requestAnimationFrame(() => {
      if (boardScrollRef.current) boardScrollRef.current.scrollLeft = savedScroll.current.board
      for (const [id, top] of savedScroll.current.buckets) {
        const node = bucketScrollRefs.current.get(id)
        if (node) node.scrollTop = top
      }
    })
  }

  function openTask(task: PlannerTask) {
    captureScroll()
    setDrawerTask(task)
    restoreScroll()
  }

  function closeTask() {
    setDrawerTask(null)
    restoreScroll()
  }

  async function reloadTask(taskId: string) {
    if (!activeBoardRecord) return null
    captureScroll()
    const board = activeBoardRecord
    const requestId = ++taskRequestRef.current
    const result = await fetchBoardTasks(board, false)
    if (requestId !== taskRequestRef.current) return null
    if (result.error) {
      setTaskError(result.error.message ?? 'Could not reload Planner tasks.')
      return null
    }
    const next = result.data
    setTaskError(null)
    setTasks(next)
    setTasksBoardId(board.id)
    const refreshed = next.find(task => task.id === taskId) ?? null
    setDrawerTask(refreshed)
    restoreScroll()
    return refreshed
  }

  function selectBoard(slug: string) {
    taskRequestRef.current += 1
    setActiveBoard(slug)
    setDrawerTask(null)
    setBucketError(null)
    setTaskError(null)
    setBucketsLoading(true)
    setTasksLoading(true)
  }

  function refreshActiveBoardTasks() {
    if (!activeBoardRecord) return
    const board = activeBoardRecord
    const requestId = ++taskRequestRef.current
    setTasksLoading(true)
    void fetchBoardTasks(board, false).then(result => {
      if (requestId !== taskRequestRef.current) return
      if (result.error) {
        setTaskError(result.error.message ?? 'Could not reload Planner tasks.')
        return
      }
      setTaskError(null)
      setTasks(result.data)
      setTasksBoardId(board.id)
    }).finally(() => {
      if (requestId === taskRequestRef.current) setTasksLoading(false)
    })
  }

  function changeAssigneeFilter(value: string) {
    setAssigneeFilter(value)
    const next = new URLSearchParams(routeParams)
    if (value.startsWith('person:')) next.set('assignee', value.slice(7))
    else next.delete('assignee')
    setSearchParams(next, { replace: true })
  }

  function changeQuickScope(scope: QuickScope) {
    setQuickScope(scope)
    const next = new URLSearchParams(routeParams)
    if (scope === 'all') next.delete('scope')
    else next.set('scope', scope)
    setSearchParams(next, { replace: true })
  }

  function retryBuckets() {
    setBucketError(null)
    setBucketsLoading(true)
    setBucketRetry(current => current + 1)
  }

  function retryTasks() {
    setTaskError(null)
    setTasksLoading(true)
    setTaskRetry(current => current + 1)
  }

  function retryBoards() {
    setBoardError(null)
    setLoading(true)
    setBoardRetry(current => current + 1)
  }

  function handleBoardWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.currentTarget.scrollLeft += event.deltaY
    event.preventDefault()
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-5"><div className="h-72 animate-pulse rounded-xl bg-white/[0.04]" /></div>

  if (boardError) {
    return <div className={`mx-auto max-w-7xl px-4 ${embedded ? 'py-2' : 'py-8'}`}><LoadError title="Planner boards could not be loaded" message={boardError} onRetry={retryBoards} /></div>
  }

  if (tableMissing || boards.length === 0) {
    return (
      <div className={`mx-auto max-w-7xl px-4 ${embedded ? 'py-2' : 'py-8'}`}>
        {!embedded && <h1 className="mb-6 text-xl font-black text-white">Planner</h1>}
        <EmptyState
          title={tableMissing ? 'Planner tables not set up yet' : 'No boards found'}
          message={tableMissing ? 'Run the Planner migrations.' : 'Create or seed a Planner board to begin.'}
        />
      </div>
    )
  }

  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${embedded ? 'py-1' : 'py-5'}`}>
      {!embedded && (
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Work</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Planner</h1>
          </div>
          {isAdmin && <div className="flex gap-3 text-xs font-semibold text-brand-primary/60"><Link to="/admin/import-health">Health</Link><Link to="/admin/planner-import">Import</Link></div>}
        </div>
      )}

      {assignmentError && <div role="alert" className="mb-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100">{assignmentError}</div>}

      <div className="mb-3 flex flex-wrap gap-1">
        {sortedBoards.map(board => (
          <button key={board.id} type="button" onClick={() => selectBoard(board.slug)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${activeBoard === board.slug ? 'bg-white/[0.09] text-white ring-1 ring-brand-accent/40' : 'text-white/45 hover:bg-white/[0.04] hover:text-white'}`}>
            {BOARD_LABELS[board.slug] ?? board.name}
          </button>
        ))}
      </div>

      <div className="mb-3 flex w-fit rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        <button type="button" onClick={() => setWorkView('active')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${workView === 'active' ? 'bg-brand-accent text-black' : 'text-brand-primary/60'}`}>Active {activeTaskCount}</button>
        <button type="button" onClick={() => setWorkView('history')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${workView === 'history' ? 'bg-white/[0.09] text-white' : 'text-brand-primary/60'}`}>History {historyTaskCount}</button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks or people" className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white placeholder:text-white/30" />
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | PlannerTaskStatus)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white"><option value="all">All statuses</option>{PLANNER_TASK_STATUSES.map(status => <option key={status} value={status}>{PLANNER_TASK_STATUS_LABELS[status]}</option>)}</select>
        <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as 'all' | TaskPriority)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white"><option value="all">All priorities</option>{PRIORITIES.map(priority => <option key={priority} value={priority}>{priority === 'client_request' ? 'Client request' : priority[0].toUpperCase() + priority.slice(1)}</option>)}</select>
        <select value={effectiveAssigneeFilter} onChange={event => changeAssigneeFilter(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white"><option value="all">All assignees</option>{assigneeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <input type="search" value={clientFilter} onChange={event => setClientFilter(event.target.value)} placeholder="Filter client" className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white placeholder:text-white/30" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Quick filters">
        {(['all', 'overdue', 'blocked'] as QuickScope[]).map(scope => <button key={scope} type="button" onClick={() => changeQuickScope(scope)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${effectiveQuickScope === scope ? 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent' : 'border-white/10 text-white/45'}`}>{scope}</button>)}
        {canManage && <button type="button" onClick={() => changeQuickScope('unassigned')} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${effectiveQuickScope === 'unassigned' ? 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent' : 'border-white/10 text-white/45'}`}>Unassigned</button>}
      </div>

      {bucketError ? (
        <LoadError title="Planner columns could not be loaded" message={bucketError} onRetry={retryBuckets} />
      ) : bucketsLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-white/[0.04]" aria-label="Loading Planner columns" />
      ) : taskError && displayedBuckets.length === 0 ? (
        <LoadError title="Planner tasks could not be loaded" message={taskError} onRetry={retryTasks} />
      ) : displayedBuckets.length === 0 && tasksLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-white/[0.04]" aria-label="Loading Planner tasks" />
      ) : displayedBuckets.length === 0 && bucketlessTasks.length === 0 ? <EmptyState title="No columns configured" message="This board has no columns yet." centered={false} /> : (
        <>
        {taskError && <LoadError title="Planner tasks could not be loaded" message={taskError} onRetry={retryTasks} />}
        <div ref={boardScrollRef} data-testid="planner-board-scroller" onWheel={handleBoardWheel} className="flex h-[min(68vh,46rem)] min-h-[30rem] gap-3 overflow-x-auto overscroll-x-contain rounded-xl border border-white/[0.06] bg-black/10 p-3 pb-4">
          {displayedBuckets.map(bucket => (
            <BucketColumn
              key={bucket.id}
              bucket={bucket}
              boardId={activeBoardRecord?.id ?? ''}
              tasks={tasksByBucket.get(bucket.id) ?? []}
              tasksLoading={tasksLoading}
              tasksError={taskError}
              allowAdd
              people={people}
              defaultAssigneeIds={profile?.id && directory.some(person => person.id === profile.id) ? [profile.id] : []}
              assignmentDisabled={Boolean(assignmentError)}
              canManage={canManage}
              workView={workView}
              onOpenTask={openTask}
              onTaskCreated={refreshActiveBoardTasks}
              setScrollRef={node => {
                if (node) bucketScrollRefs.current.set(bucket.id, node)
                else bucketScrollRefs.current.delete(bucket.id)
              }}
            />
          ))}
          {bucketlessTasks.length > 0 && (
            <BucketColumn
              bucket={{ id: NO_BUCKET_ID, name: 'No bucket' }}
              boardId={activeBoardRecord?.id ?? ''}
              tasks={bucketlessTasks}
              tasksLoading={tasksLoading}
              tasksError={taskError}
              allowAdd={false}
              people={people}
              defaultAssigneeIds={[]}
              assignmentDisabled
              canManage={canManage}
              workView={workView}
              onOpenTask={openTask}
              onTaskCreated={refreshActiveBoardTasks}
              setScrollRef={node => {
                if (node) bucketScrollRefs.current.set(NO_BUCKET_ID, node)
                else bucketScrollRefs.current.delete(NO_BUCKET_ID)
              }}
            />
          )}
        </div>
        </>
      )}

      {drawerTask && (
        <PlannerTaskDrawer
          key={drawerTask.id}
          task={drawerTask}
          buckets={displayedBuckets}
          people={people}
          currentProfileId={profile?.id ?? null}
          actorName={profile?.full_name ?? null}
          canManage={canManage}
          assignmentDisabled={Boolean(assignmentError)}
          onClose={closeTask}
          onReload={() => reloadTask(drawerTask.id)}
          onArchived={archived => {
            setTasks(current => current.filter(task => task.id !== archived.id))
            setWorkView('history')
            closeTask()
          }}
        />
      )}
    </div>
  )
}

function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-400/25 bg-red-400/[0.06] px-3 py-2"><div><p className="text-xs font-bold text-red-200">{title}</p><p className="mt-0.5 text-xs text-red-100/65">{message}</p></div><button type="button" onClick={onRetry} className="rounded-md border border-red-300/25 px-3 py-1.5 text-xs font-bold text-red-100">Retry</button></div>
}

function BucketColumn({ bucket, boardId, tasks, tasksLoading, tasksError, allowAdd, people, defaultAssigneeIds, assignmentDisabled, canManage, workView, onOpenTask, onTaskCreated, setScrollRef }: {
  bucket: Pick<PlannerBucket, 'id' | 'name'>
  boardId: string
  tasks: PlannerTask[]
  tasksLoading: boolean
  tasksError: string | null
  allowAdd: boolean
  people: PlannerPerson[]
  defaultAssigneeIds: string[]
  assignmentDisabled: boolean
  canManage: boolean
  workView: PlannerWorkView
  onOpenTask: (task: PlannerTask) => void
  onTaskCreated: (task: PlannerTask) => void
  setScrollRef: (node: HTMLDivElement | null) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [assigneeIds, setAssigneeIds] = useState(defaultAssigneeIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!allowAdd || !title.trim() || saving || !boardId) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: createError } = await createPlannerTask({
        board_id: boardId,
        bucket_id: bucket.id,
        title: title.trim(),
        assignee_profile_ids: assignmentDisabled ? [] : assigneeIds,
      })
      if (createError) {
        setError(createError.message ?? 'Could not create task.')
        return
      }
      if (data) onTaskCreated(data as PlannerTask)
      setTitle('')
      setAssigneeIds(defaultAssigneeIds)
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex w-[18rem] shrink-0 flex-col rounded-lg border border-white/[0.07] bg-white/[0.025] p-2" aria-labelledby={`bucket-${bucket.id}`}>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 id={`bucket-${bucket.id}`} className="truncate text-xs font-black uppercase tracking-wider text-white/65">{bucket.name}</h2>
        <span className="text-[11px] text-white/35">{tasks.length}</span>
      </div>

      {allowAdd && canManage && workView === 'active' && (
        <div className="mb-2" data-testid="bucket-add-task">
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="w-full rounded-md border border-dashed border-brand-teal/20 bg-brand-teal/[0.04] py-2 text-xs font-semibold text-brand-teal/75 hover:border-brand-teal/40">+ Add task</button>
          ) : (
            <form onSubmit={submit} className="space-y-2 rounded-md border border-white/10 bg-black/25 p-2">
              <input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="Task title" className="w-full rounded-md border border-white/10 bg-[#111] px-2.5 py-2 text-sm text-white" />
              <PlannerPeoplePicker people={people} value={assigneeIds} onChange={setAssigneeIds} label="Assign people" disabled={assignmentDisabled} />
              {error && <p className="text-xs text-red-300">{error}</p>}
              <div className="flex gap-2"><button type="submit" disabled={saving || !title.trim()} className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-black text-black disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button><button type="button" onClick={() => setAdding(false)} className="text-xs text-white/50">Cancel</button></div>
            </form>
          )}
        </div>
      )}

      <div ref={setScrollRef} data-testid="planner-bucket-scroll" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {tasksLoading ? <div className="h-20 animate-pulse rounded-lg bg-white/[0.04]" /> : tasksError ? <p className="py-8 text-center text-xs text-red-200/65">Tasks unavailable</p> : tasks.map(task => <PlannerTaskCard key={task.id} task={task} onClick={() => onOpenTask(task)} />)}
        {!tasksLoading && !tasksError && tasks.length === 0 && <p className="py-8 text-center text-xs text-white/25">No matching tasks</p>}
      </div>
    </section>
  )
}

function PlannerTaskCard({ task, onClick }: { task: PlannerTask; onClick: () => void }) {
  const progress = checklistProgress(task)
  const overdue = isOverdue(task)
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-lg border bg-[#151515] p-3 text-left transition-colors hover:bg-white/[0.055] ${task.status === 'blocked' ? 'border-red-400/25' : overdue ? 'border-amber-400/25' : 'border-white/[0.07]'}`}>
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.client_name && <span className="rounded-full border border-brand-teal/15 px-2 py-0.5 text-[10px] text-brand-teal">{task.client_name}</span>}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(task.status)}`}>{PLANNER_TASK_STATUS_LABELS[task.status]}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-white/45">{task.priority.replace('_', ' ')}</span>
        {task.due_date && <span className={`rounded-full border px-2 py-0.5 text-[10px] ${overdue ? 'border-amber-400/30 bg-amber-400/10 font-bold text-amber-200' : 'border-white/10 text-white/45'}`}>{overdue ? 'Overdue ' : ''}{formatPlannerDate(task.due_date)}</span>}
        {task.status === 'blocked' && <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">Blocked</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PlannerAssigneeAvatars people={taskPeople(task)} maxVisible={3} />
        {progress.total > 0 && <span className="text-[10px] text-white/40" aria-label={`${progress.complete} of ${progress.total} checklist items complete`}>{progress.complete}/{progress.total} checklist</span>}
      </div>
      {task.unresolved_assignee_names.length > 0 && <p className="mt-2 truncate text-[10px] text-amber-200/75" title={`Imported identities: ${task.unresolved_assignee_names.join(', ')}`}>Imported identity: {task.unresolved_assignee_names.join(', ')}</p>}
    </button>
  )
}

function PlannerTaskDrawer({ task, buckets, people, currentProfileId, actorName, canManage, assignmentDisabled, onClose, onReload, onArchived }: {
  task: PlannerTask
  buckets: PlannerBucket[]
  people: PlannerPerson[]
  currentProfileId: string | null
  actorName: string | null
  canManage: boolean
  assignmentDisabled: boolean
  onClose: () => void
  onReload: () => Promise<PlannerTask | null>
  onArchived: (task: PlannerTask) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [clientId, setClientId] = useState(task.client_id ?? '')
  const [clientName, setClientName] = useState(task.client_name ?? '')
  const [status, setStatus] = useState<PlannerTaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [startDate, setStartDate] = useState(task.start_date ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [bucketId, setBucketId] = useState(task.bucket_id ?? '')
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map(person => person.profile_id))
  const [checklist, setChecklist] = useState(() => checklistRows(task.checklist))
  const [newChecklistText, setNewChecklistText] = useState('')
  const [activity, setActivity] = useState<PlannerActivityLog[]>([])
  const [activityError, setActivityError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const canonicalAssignment = task.assignees.length > 0
  const normalizedActor = actorName?.trim().toLowerCase() ?? ''
  const legacyAssigned = !canonicalAssignment && Boolean(normalizedActor && [task.assigned_to_name, ...(task.helper_names ?? [])].some(name => name?.trim().toLowerCase() === normalizedActor))
  const canUpdateStatus = canManage || (canonicalAssignment ? Boolean(currentProfileId && task.assignees.some(person => person.profile_id === currentProfileId)) : legacyAssigned)
  const inputClass = 'min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-55'
  const initialChecklist = checklistRows(task.checklist).map(row => {
    if (!row.recognized) return row.raw
    if (typeof row.raw === 'string' && !row.done && row.text === row.raw) return row.raw
    if (row.raw && typeof row.raw === 'object') {
      const raw = row.raw as Record<string, unknown>
      if ('completed' in raw) return { ...raw, text: row.text, completed: row.done }
      if ('is_checked' in raw) return { ...raw, text: row.text, is_checked: row.done }
      return { ...raw, text: row.text, done: row.done }
    }
    return { text: row.text, done: row.done }
  })
  const isDirty = title !== task.title
    || clientId !== (task.client_id ?? '')
    || clientName !== (task.client_name ?? '')
    || bucketId !== (task.bucket_id ?? '')
    || status !== task.status
    || priority !== task.priority
    || startDate !== (task.start_date ?? '')
    || dueDate !== (task.due_date ?? '')
    || notes !== (task.notes ?? '')
    || assigneeIds.join('|') !== task.assignees.map(person => person.profile_id).join('|')
    || JSON.stringify(serializedChecklist()) !== JSON.stringify(initialChecklist)
    || newChecklistText.trim().length > 0

  function requestClose() {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  useEffect(() => {
    let active = true
    void listPlannerActivity(task.id).then(({ data, error }) => {
      if (!active) return
      if (error) setActivityError('Activity history is unavailable.')
      else setActivity(data ?? [])
    })
    return () => { active = false }
  }, [task.id])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (isDirty) setConfirmDiscard(true)
      else onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isDirty, onClose])

  function serializedChecklist() {
    return checklist.map(row => {
      if (!row.recognized) return row.raw
      if (typeof row.raw === 'string' && !row.done && row.text === row.raw) return row.raw
      if (row.raw && typeof row.raw === 'object') {
        const raw = row.raw as Record<string, unknown>
        if ('completed' in raw) return { ...raw, text: row.text, completed: row.done }
        if ('is_checked' in raw) return { ...raw, text: row.text, is_checked: row.done }
        return { ...raw, text: row.text, done: row.done }
      }
      return { text: row.text, done: row.done }
    })
  }

  async function save() {
    if (saving || !title.trim()) return
    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    try {
      if (!canManage) {
        if (!canUpdateStatus) {
          setSaveError('This task is read-only because it is not assigned to you.')
          return
        }
        const result = await updatePlannerTaskStatus(task.id, status)
        if (result.error) { setSaveError(result.error.message); return }
      } else {
        if (startDate && dueDate && startDate > dueDate) {
          setSaveError('Start date cannot be after the due date.')
          return
        }
        const result = await updatePlannerTaskWithAssignees(task.id, {
          title: title.trim(),
          bucket_id: bucketId || null,
          assignee_profile_ids: assigneeIds,
          client_id: clientId || null,
          client_name: clientName.trim() || null,
          status,
          priority,
          start_date: startDate || null,
          due_date: dueDate || null,
          notes: notes.trim() || null,
          checklist: serializedChecklist(),
        })
        if (result.error) { setSaveError(`Task was not saved. ${result.error.message}`); return }
      }
      const refreshed = await onReload()
      if (!refreshed) {
        setSaveError('The task was saved, but current Planner data could not be reloaded.')
        return
      }
      onClose()
    } catch {
      setSaveError('Could not save this task.')
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    const { data, error } = await archivePlannerTask(task.id, actorName)
    if (error) { setSaveError(error.message ?? 'Could not remove task from active work.'); return }
    if (data) onArchived(data as PlannerTask)
  }

  function addChecklistItem(event: FormEvent) {
    event.preventDefault()
    const text = newChecklistText.trim()
    if (!text || !canManage) return
    setChecklist(current => [...current, { key: `new-${Date.now()}`, text, done: false, raw: { text, done: false }, recognized: true }])
    setNewChecklistText('')
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/65" onClick={requestClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#101010] sm:w-[32rem]" aria-label="Task details">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-bold text-white">Task details</h2>{task.original_plan_name && <p className="text-[10px] text-white/35">Imported from {task.original_plan_name}</p>}</div><button type="button" onClick={requestClose} className="min-h-11 min-w-11 rounded-lg text-xl text-white/60" aria-label="Close task details">&times;</button></div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Title</label><input value={title} onChange={event => setTitle(event.target.value)} disabled={!canManage} className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Status</label><select value={status} onChange={event => setStatus(event.target.value as PlannerTaskStatus)} disabled={!canUpdateStatus} className={inputClass}>{PLANNER_TASK_STATUSES.map(value => <option key={value} value={value}>{PLANNER_TASK_STATUS_LABELS[value]}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Priority</label><select value={priority} onChange={event => setPriority(event.target.value as TaskPriority)} disabled={!canManage} className={inputClass}>{PRIORITIES.map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></div>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Client</label>{canManage ? <ClientPicker value={clientId} label={clientName} onChange={client => { setClientId(client?.id ?? ''); setClientName(client?.name ?? '') }} /> : <div className={`${inputClass} opacity-70`}>{clientName || 'No client'}</div>}</div>
          <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Bucket</label><select value={bucketId} onChange={event => setBucketId(event.target.value)} disabled={!canManage} className={inputClass}><option value="">No bucket</option>{buckets.map(bucket => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-semibold text-brand-primary">Start date</label><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} disabled={!canManage} className={inputClass} /></div><div><label className="mb-1 block text-xs font-semibold text-brand-primary">Due date</label><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={!canManage} className={inputClass} /></div></div>

          <PlannerPeoplePicker people={people} value={assigneeIds} onChange={setAssigneeIds} disabled={!canManage || assignmentDisabled} readOnly={!canManage} />
          {task.unresolved_assignee_names.length > 0 && <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3"><p className="text-xs font-bold text-amber-100">Imported identities need manager resolution</p><p className="mt-1 text-xs text-amber-100/70">{task.unresolved_assignee_names.join(', ')}</p><p className="mt-1 text-[10px] text-amber-100/50">Choose canonical people above. Imported names remain visible separately for audit context.</p></div>}

          <div><label className="mb-1 block text-xs font-semibold text-brand-primary">Notes</label><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} disabled={!canManage} className={`${inputClass} resize-y`} /></div>

          <section aria-labelledby="checklist-heading"><div className="mb-2 flex items-center justify-between"><h3 id="checklist-heading" className="text-xs font-black uppercase tracking-wider text-white/50">Checklist</h3><span className="text-xs text-white/35">{checklist.filter(row => row.recognized && row.done).length}/{checklist.filter(row => row.recognized).length}</span></div><div className="space-y-2">{checklist.map((row, index) => <div key={row.key} className="flex items-center gap-2 rounded-lg border border-white/[0.07] p-2">{row.recognized ? <input type="checkbox" checked={row.done} disabled={!canManage} onChange={() => setChecklist(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item))} className="h-4 w-4 accent-teal-400" /> : <span className="text-amber-300">!</span>}<span className={`min-w-0 flex-1 text-sm ${row.done ? 'text-white/35 line-through' : 'text-white/75'}`}>{row.text}</span>{canManage && <button type="button" onClick={() => setChecklist(current => current.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 min-w-11 text-white/35 sm:min-h-8 sm:min-w-8" aria-label={`Remove checklist item ${row.text}`}>&times;</button>}</div>)}</div>{canManage && <form onSubmit={addChecklistItem} className="mt-2 flex gap-2"><input value={newChecklistText} onChange={event => setNewChecklistText(event.target.value)} placeholder="Add checklist item" className={inputClass} /><button type="submit" disabled={!newChecklistText.trim()} className="min-h-11 rounded-lg border border-brand-teal/25 px-3 text-xs font-bold text-brand-teal disabled:opacity-40">Add</button></form>}</section>

          <section aria-labelledby="activity-heading"><h3 id="activity-heading" className="mb-2 text-xs font-black uppercase tracking-wider text-white/50">Activity</h3>{activityError && <p className="text-xs text-amber-200">{activityError}</p>}{!activityError && activity.length === 0 && <p className="text-xs text-white/35">No activity recorded yet.</p>}<div className="space-y-2">{activity.map(item => <ActivityRow key={item.id} item={item} people={people} />)}</div></section>
        </div>
        <div className="border-t border-white/10 px-5 py-4">{saveError && <p className="mb-2 text-xs text-red-300">{saveError}</p>}{saveMessage && <p className="mb-2 text-xs text-brand-teal">{saveMessage}</p>}<div className="flex items-center gap-3"><ActionButton variant="primary" className="min-h-11" onClick={save} disabled={saving || !title.trim() || (!canManage && !canUpdateStatus) || (canManage && assignmentDisabled)} loading={saving}>Save</ActionButton><button type="button" onClick={requestClose} className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60">Close</button>{canManage && (!confirmArchive ? <button type="button" onClick={() => setConfirmArchive(true)} className="ml-auto min-h-11 px-2 text-xs text-amber-300/70">Remove from active</button> : <div className="ml-auto flex gap-1 text-xs"><button type="button" onClick={archive} className="min-h-11 px-2 text-amber-200">Confirm remove</button><button type="button" onClick={() => setConfirmArchive(false)} className="min-h-11 px-2 text-white/45">Cancel</button></div>)}</div></div>
      </aside>
      {confirmDiscard && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="alertdialog" aria-modal="true" aria-labelledby="discard-title"><div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#181818] p-5 shadow-2xl"><h3 id="discard-title" className="font-bold text-white">Discard unsaved changes?</h3><p className="mt-2 text-sm text-white/55">Your changes to this task have not been saved.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70">Stay</button><button type="button" onClick={onClose} className="rounded-lg bg-red-400 px-4 py-2 text-sm font-bold text-black">Discard changes</button></div></div></div>}
    </>
  )
}

function ActivityRow({ item, people }: { item: PlannerActivityLog; people: PlannerPerson[] }) {
  const metadata = item.metadata ?? {}
  const oldStatus = typeof metadata.old_status === 'string' ? metadata.old_status : typeof metadata.from_status === 'string' ? metadata.from_status : null
  const newStatus = typeof metadata.new_status === 'string' ? metadata.new_status : typeof metadata.to_status === 'string' ? metadata.to_status : null
  const idsToNames = (value: unknown) => Array.isArray(value)
    ? value.flatMap(id => typeof id === 'string' ? [people.find(person => person.id === id)?.full_name ?? 'Unknown person'] : [])
    : []
  const oldPeople = idsToNames(metadata.old_assignee_profile_ids ?? metadata.old_profile_ids)
  const newPeople = idsToNames(metadata.new_assignee_profile_ids ?? metadata.new_profile_ids)
  const context = oldStatus || newStatus
    ? `${oldStatus ? PLANNER_TASK_STATUS_LABELS[oldStatus as PlannerTaskStatus] ?? oldStatus : 'Unspecified'} to ${newStatus ? PLANNER_TASK_STATUS_LABELS[newStatus as PlannerTaskStatus] ?? newStatus : 'Unspecified'}`
    : oldPeople.length || newPeople.length
      ? `${oldPeople.join(', ') || 'Unassigned'} to ${newPeople.join(', ') || 'Unassigned'}`
      : null
  return <div className="rounded-lg border border-white/[0.06] p-2.5"><p className="text-xs text-white/70"><span className="font-semibold text-white">{item.actor_name || 'System'}</span> {item.action.replaceAll('_', ' ')}</p>{context && <p className="mt-1 text-[11px] text-brand-teal/70">{context}</p>}<time className="mt-1 block text-[10px] text-white/30" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
}
