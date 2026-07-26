import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import {
  listTasks,
  updateTaskStatus,
  updateTask,
  listActiveClients,
  type CommandCentreTask,
  type TaskBucket,
  type TaskStatus,
  type ClientOption,
  type RequestState,
  requestStateFromTask,
  requestStateLabel,
} from '../../lib/commandCentre'
import { listStaffProfiles } from '../../lib/contentWorkflow'
import {
  listMonthlyDeliverablesByMonth,
  type MonthlyDeliverable,
} from '../../lib/planner'
import { businessDateKey } from '../../lib/businessTime'
import { TaskCard, OpsQuickAdd, TaskDetailDrawer, RequestIntake } from '../../components/operations'

type OpsTab = 'my-work' | 'board' | 'client-work' | 'calendar' | 'admin'

export default function OpsHubPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showRequestIntake, setShowRequestIntake] = useState(false)
  const [selectedTask, setSelectedTask] = useState<CommandCentreTask | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [staffProfiles, setStaffProfiles] = useState<{ id: string; full_name: string | null }[]>([])

  const activeTab: OpsTab = (searchParams.get('tab') as OpsTab) || 'my-work'
  const isAdmin = profile?.role ? isManagerRole(profile.role) : false


  async function loadData() {
    setLoading(true)
    setError(null)
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [tasksResult, deliverableResult, clientsResult, staffResult] = await Promise.all([
      listTasks(),
      listMonthlyDeliverablesByMonth(month),
      listActiveClients(),
      listStaffProfiles(),
    ])
    if (tasksResult.error) { setError(tasksResult.error.message); setLoading(false); return }
    setTasks(tasksResult.data ?? [])
    setDeliverables(deliverableResult.data ?? [])
    setClients(clientsResult.data ?? [])
    setStaffProfiles(staffResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    void (async () => {
      await loadData()
      if (!active) return
    })()
    return () => { active = false }
  }, [])

  async function handleQuickAddCreated(task: CommandCentreTask) {
    setTasks(prev => [task, ...prev])
    setShowQuickAdd(false)
  }

  async function handleRequestCreated(task: CommandCentreTask) {
    setTasks(prev => [task, ...prev])
    setShowRequestIntake(false)
    setSelectedTask(task)
  }

  function handleTaskUpdated(updated: CommandCentreTask) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTask(null)
  }

  async function handleStatusChange(task: CommandCentreTask, newStatus: TaskStatus) {
    const prev = tasks.find(t => t.id === task.id)
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t))

    const result = await updateTaskStatus(task.id, newStatus)
    if (result.error) {
      if (prev) setTasks(p => p.map(t => t.id === task.id ? prev : t))
    }
  }

  async function handleBucketChange(task: CommandCentreTask, newBucket: TaskBucket) {
    const prev = tasks.find(t => t.id === task.id)
    setTasks(p => p.map(t => t.id === task.id ? { ...t, bucket: newBucket } : t))

    const result = await updateTask(task.id, { bucket: newBucket })
    if (result.error) {
      if (prev) setTasks(p => p.map(t => t.id === task.id ? prev : t))
    }
  }

  async function handleDateDrag(task: CommandCentreTask, newDate: string) {
    const prev = tasks.find(t => t.id === task.id)
    setTasks(p => p.map(t => t.id === task.id ? { ...t, due_date: newDate } : t))

    const result = await updateTask(task.id, { due_date: newDate })
    if (result.error) {
      if (prev) setTasks(p => p.map(t => t.id === task.id ? prev : t))
    }
  }

  const todayKey = businessDateKey(new Date())

  const myTasks = useMemo(() => {
    const profileId = profile?.id
    const profileName = profile?.full_name
    return tasks.filter(t => {
      if (t.assigned_to_user_id && profileId) {
        return t.assigned_to_user_id === profileId
      }
      return t.assigned_to_name != null && t.assigned_to_name === profileName
    })
  }, [tasks, profile])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Operations Hub</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            {activeTab === 'my-work' && 'My Work'}
            {activeTab === 'board' && 'Board'}
            {activeTab === 'client-work' && 'Client Work'}
            {activeTab === 'calendar' && 'Calendar'}
            {activeTab === 'admin' && 'Admin'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'client-work' && !showRequestIntake ? (
            <button
              onClick={() => setShowRequestIntake(true)}
              className="rounded-lg bg-amber-400/20 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-amber-200 transition-colors hover:brightness-110"
            >
              + Capture Request
            </button>
          ) : null}
          {!showQuickAdd && activeTab !== 'client-work' ? (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="rounded-lg bg-brand-accent px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-black transition-colors hover:brightness-110"
            >
              + Quick Add
            </button>
          ) : null}
        </div>
      </header>

      {showQuickAdd && (
        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <OpsQuickAdd
            onCreated={handleQuickAddCreated}
            clients={clients}
            staffProfiles={staffProfiles}
            onClose={() => setShowQuickAdd(false)}
          />
        </div>
      )}

      {showRequestIntake && (
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.02] p-4">
          <RequestIntake
            onCreated={handleRequestCreated}
            clients={clients}
            tasks={tasks}
            staffProfiles={staffProfiles}
            onClose={() => setShowRequestIntake(false)}
          />
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
        <p className="text-xs text-brand-primary/60">Focused operations workspace</p>
        <Link to="/admin/my-work" className="text-xs font-black text-brand-teal hover:text-white">Back to My Work</Link>
      </div>
      {loading ? (
        <LoadingState message="Loading operations data..." />
      ) : error ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</div>
      ) : activeTab === 'my-work' ? (
        <MyWorkView
          myTasks={myTasks}
          todayKey={todayKey}
          onStatusChange={handleStatusChange}
          onOpenTask={setSelectedTask}
        />
      ) : activeTab === 'board' ? (
        <BoardView
          tasks={tasks}
          onOpenTask={setSelectedTask}
          onBucketChange={handleBucketChange}
        />
      ) : activeTab === 'client-work' ? (
        <ClientWorkView
          deliverables={deliverables}
          tasks={tasks}
          onOpenTask={setSelectedTask}
        />
      ) : activeTab === 'calendar' ? (
        <CalendarView
          tasks={tasks}
          deliverables={deliverables}
          onOpenTask={setSelectedTask}
          onDateDrag={handleDateDrag}
        />
      ) : activeTab === 'admin' && isAdmin ? (
        <AdminBoardView tasks={tasks} onOpenTask={setSelectedTask} onStatusChange={handleStatusChange} />
      ) : null}

      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={handleTaskUpdated}
        clients={clients}
        staffProfiles={staffProfiles}
        isAdmin={isAdmin}
        deliverables={deliverables.map(d => ({
          id: d.id,
          client_id: d.client_id,
          code: d.code,
          instance_number: d.instance_number,
          title: d.title,
          month: d.month,
        }))}
      />
    </div>
  )
}

function MyWorkView({
  myTasks,
  todayKey,
  onStatusChange,
  onOpenTask,
}: {
  myTasks: CommandCentreTask[]
  todayKey: string
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
  onOpenTask: (task: CommandCentreTask) => void
}) {
  const overdue = useMemo(() => myTasks.filter(t => t.status !== 'done' && t.status !== 'blocked' && t.due_date < todayKey), [myTasks, todayKey])
  const today = useMemo(() => myTasks.filter(t => t.status !== 'done' && t.status !== 'blocked' && t.due_date === todayKey), [myTasks, todayKey])
  const inProgress = useMemo(() => myTasks.filter(t => t.status === 'in_progress'), [myTasks])
  const upcoming = useMemo(() => myTasks.filter(t => t.status !== 'done' && t.status !== 'blocked' && t.due_date && t.due_date > todayKey), [myTasks, todayKey])
  const waiting = useMemo(() => myTasks.filter(t => t.status === 'waiting_client'), [myTasks])
  const noDate = useMemo(() => myTasks.filter(t => t.status !== 'done' && t.status !== 'blocked' && !t.due_date), [myTasks])

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/60">Showing {myTasks.length} tasks assigned to you.</p>
      {overdue.length > 0 && (
        <TaskSection title={`Overdue (${overdue.length})`} tasks={overdue} color="text-red-300" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
      {today.length > 0 && (
        <TaskSection title={`Today (${today.length})`} tasks={today} color="text-amber-200" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
      {inProgress.length > 0 && (
        <TaskSection title={`In Progress (${inProgress.length})`} tasks={inProgress} color="text-brand-teal" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
      {upcoming.length > 0 && (
        <TaskSection title={`Upcoming (${upcoming.length})`} tasks={upcoming} color="text-white/60" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
      {waiting.length > 0 && (
        <TaskSection title={`Waiting / Review (${waiting.length})`} tasks={waiting} color="text-sky-200" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
      {noDate.length > 0 && (
        <TaskSection title={`No Due Date (${noDate.length})`} tasks={noDate} color="text-white/40" onStatusChange={onStatusChange} onOpenTask={onOpenTask} />
      )}
    </div>
  )
}

function TaskSection({
  title,
  tasks,
  color,
  onStatusChange,
  onOpenTask,
}: {
  title: string
  tasks: CommandCentreTask[]
  color: string
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
  onOpenTask: (task: CommandCentreTask) => void
}) {
  return (
    <section>
      <h2 className={`text-[10px] font-black uppercase tracking-[0.18em] ${color}`}>{title}</h2>
      <div className="mt-2 space-y-1.5">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onOpen={onOpenTask} />
        ))}
      </div>
    </section>
  )
}

function BoardView({ tasks, onOpenTask, onBucketChange }: { tasks: CommandCentreTask[]; onOpenTask: (task: CommandCentreTask) => void; onBucketChange: (task: CommandCentreTask, bucket: TaskBucket) => void }) {
  const [dragOverBucket, setDragOverBucket] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)

  const buckets = useMemo(() => {
    const map = new Map<TaskBucket, CommandCentreTask[]>()
    for (const task of tasks) {
      const bucket = (task.bucket || 'Once-off') as TaskBucket
      if (!map.has(bucket)) map.set(bucket, [])
      map.get(bucket)!.push(task)
    }
    return [...map.entries()].sort(([, a], [, b]) => b.length - a.length)
  }, [tasks])

  function handleDragStart(e: React.DragEvent, taskId: string) {
    dragRef.current = taskId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  function handleDragOver(e: React.DragEvent, bucket: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverBucket(bucket)
  }

  function handleDragLeave(bucket: string) {
    setDragOverBucket(prev => prev === bucket ? null : prev)
  }

  function handleDrop(e: React.DragEvent, bucket: TaskBucket) {
    e.preventDefault()
    setDragOverBucket(null)
    const taskId = dragRef.current
    dragRef.current = null
    if (!taskId) return
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.bucket === bucket) return
    onBucketChange(task, bucket)
  }

  function handleKeyMove(task: CommandCentreTask, direction: 'prev' | 'next') {
    const bucketNames = buckets.map(([name]) => name)
    const idx = bucketNames.indexOf(task.bucket)
    if (idx === -1) return
    const target = direction === 'next' ? bucketNames[idx + 1] : bucketNames[idx - 1]
    if (target) onBucketChange(task, target as TaskBucket)
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4" style={{ minWidth: Math.max(buckets.length * 260, 600) }}>
        {buckets.map(([bucket, items]) => (
          <div
            key={bucket}
            onDragOver={e => handleDragOver(e, bucket)}
            onDragLeave={() => handleDragLeave(bucket)}
            onDrop={e => handleDrop(e, bucket as TaskBucket)}
            className={`w-64 shrink-0 transition-colors ${dragOverBucket === bucket ? 'opacity-80' : ''}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">{bucket}</h3>
              <span className="text-[10px] text-white/30">{items.length}</span>
            </div>
            <div className={`space-y-1.5 rounded-xl border p-2 transition-colors ${
              dragOverBucket === bucket
                ? 'border-brand-teal/40 bg-brand-teal/[0.04]'
                : 'border-white/10 bg-white/[0.02]'
            }`}>
              {items.slice(0, 20).map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowRight') { e.preventDefault(); handleKeyMove(task, 'next') }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); handleKeyMove(task, 'prev') }
                  }}
                >
                  <TaskCard task={task} onStatusChange={() => {}} onOpen={onOpenTask} compact />
                </div>
              ))}
              {items.length > 20 && (
                <p className="py-1 text-center text-[10px] text-white/30">+{items.length - 20} more</p>
              )}
              {items.length === 0 && (
                <p className="py-4 text-center text-[10px] text-white/20">No tasks</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClientWorkView({
  deliverables,
  tasks,
  onOpenTask,
}: {
  deliverables: MonthlyDeliverable[]
  tasks: CommandCentreTask[]
  onOpenTask: (task: CommandCentreTask) => void
}) {
  const [clientFilter, setClientFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<RequestState | 'all'>('all')
  const [packageFilter, setPackageFilter] = useState('all')

  const clientRequests = useMemo(() =>
    tasks.filter(t => t.priority === 'client_request' || t.source === 'whatsapp_paste'),
    [tasks],
  )

  const requestStates = useMemo(() => {
    const set = new Set<RequestState>()
    for (const t of clientRequests) {
      set.add(requestStateFromTask(t))
    }
    return ['all' as const, ...Array.from(set)] as const
  }, [clientRequests])

  const filtered = useMemo(() => {
    let result = clientRequests
    if (clientFilter) {
      result = result.filter(t => t.client_id === clientFilter)
    }
    if (stateFilter !== 'all') {
      result = result.filter(t => requestStateFromTask(t) === stateFilter)
    }
    if (packageFilter === 'classified') {
      result = result.filter(t => t.package_action)
    } else if (packageFilter === 'unclassified') {
      result = result.filter(t => !t.package_action)
    } else if (packageFilter === 'use_slot') {
      result = result.filter(t => t.package_action === 'use_slot')
    } else if (packageFilter === 'addon') {
      result = result.filter(t => t.package_action === 'addon')
    }
    return result
  }, [clientRequests, clientFilter, stateFilter, packageFilter])

  const unclassified = useMemo(() => clientRequests.filter(t => !t.package_action), [clientRequests])
  const urgentRequests = useMemo(() => clientRequests.filter(t => t.priority === 'urgent'), [clientRequests])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="rounded border border-white/10 bg-[#111] px-2 py-1.5 text-[10px] text-white outline-none focus:border-brand-teal/50"
        >
          <option value="">All clients</option>
          {Array.from(new Set(clientRequests.filter(t => t.client_id).map(t => t.client_id!))).map(id => {
            const task = clientRequests.find(t => t.client_id === id)
            return <option key={id} value={id}>{task?.client_name ?? id}</option>
          })}
        </select>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value as RequestState | 'all')}
          className="rounded border border-white/10 bg-[#111] px-2 py-1.5 text-[10px] text-white outline-none focus:border-brand-teal/50"
        >
          <option value="all">All states</option>
          {requestStates.filter(s => s !== 'all').map(s => (
            <option key={s} value={s}>{requestStateLabel(s)}</option>
          ))}
        </select>
        <select
          value={packageFilter}
          onChange={e => setPackageFilter(e.target.value)}
          className="rounded border border-white/10 bg-[#111] px-2 py-1.5 text-[10px] text-white outline-none focus:border-brand-teal/50"
        >
          <option value="all">All classification</option>
          <option value="unclassified">Unclassified</option>
          <option value="classified">Classified</option>
          <option value="use_slot">Use package slot</option>
          <option value="addon">Add-on</option>
        </select>
        <span className="self-center text-[10px] text-white/40">{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Urgent banner */}
      {urgentRequests.length > 0 && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Urgent ({urgentRequests.length})</h2>
          <div className="mt-2 space-y-1.5">
            {urgentRequests.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={() => {}} onOpen={onOpenTask} />
            ))}
          </div>
        </section>
      )}

      {/* Unclassified banner */}
      {unclassified.length > 0 && stateFilter === 'all' && !clientFilter && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/60">
            Unclassified — awaiting admin review ({unclassified.length})
          </h2>
          <div className="mt-2 space-y-1.5">
            {unclassified.slice(0, 10).map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={() => {}} onOpen={onOpenTask} />
            ))}
            {unclassified.length > 10 && (
              <p className="text-[10px] text-white/30">+{unclassified.length - 10} more — use filters to narrow</p>
            )}
          </div>
        </section>
      )}

      {/* Filtered results */}
      {filtered.length > 0 && (stateFilter !== 'all' || clientFilter || packageFilter !== 'all') && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Filtered requests ({filtered.length})</h2>
          <div className="mt-2 space-y-1.5">
            {filtered.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={() => {}} onOpen={onOpenTask} />
            ))}
          </div>
        </section>
      )}

      {/* Package deliverables summary */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/70">
          Monthly Deliverables ({deliverables.length})
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.slice(0, 30).map(d => (
            <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                  d.production_status === 'posted' ? 'bg-emerald-400/15 text-emerald-200' :
                  d.production_status === 'in_progress' ? 'bg-sky-400/15 text-sky-200' :
                  'bg-white/5 text-white/40'
                }`}>
                  {d.code}{d.instance_number}
                </span>
                <p className="truncate text-xs text-white/70">{d.title}</p>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {d.scheduled_date && (
                  <span className="text-[9px] text-white/30">Schedule: {d.scheduled_date}</span>
                )}
                {d.due_date && (
                  <span className="text-[9px] text-white/30">Due: {d.due_date}</span>
                )}
              </div>
            </div>
          ))}
          {deliverables.length === 0 && <p className="text-sm text-white/30">No deliverables for this month.</p>}
        </div>
      </section>

      {filtered.length === 0 && !urgentRequests.length && !unclassified.length && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
          No client requests matching the current filters. Use + Capture Request to add one.
        </p>
      )}
    </div>
  )
}

type CalendarViewMode = 'month' | 'week' | 'day'

function CalendarView({
  tasks,
  deliverables,
  onOpenTask,
  onDateDrag,
}: {
  tasks: CommandCentreTask[]
  deliverables: MonthlyDeliverable[]
  onOpenTask: (task: CommandCentreTask) => void
  onDateDrag: (task: CommandCentreTask, newDate: string) => void
}) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [staffFilter, setStaffFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [bucketFilter, setBucketFilter] = useState('')
  const dragTaskRef = useRef<CommandCentreTask | null>(null)


  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Week calculation
  const weekStart = useMemo(() => {
    const d = new Date(viewDate)
    if (viewMode === 'week') {
      const day = d.getDay()
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
    }
    return d
  }, [viewDate, viewMode])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  function dateKey(y: number, m: number, d: number) {
    const dt = new Date(y, m, d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Array<{ task?: CommandCentreTask; title: string; type: string; badge?: string }>>()
    for (const t of tasks) {
      if (t.due_date) {
        if (!map.has(t.due_date)) map.set(t.due_date, [])
        map.get(t.due_date)!.push({ task: t, title: t.title, type: 'task', badge: 'Due' })
      }
    }
    for (const d of deliverables) {
      if (d.scheduled_date) {
        const key = d.scheduled_date
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ title: `${d.code}${d.instance_number}`, type: 'deliverable', badge: 'Schedule' })
      }
      if (d.due_date && d.due_date !== d.scheduled_date) {
        const key = d.due_date
        if (!map.has(key)) map.set(key, [])
        if (!map.get(key)!.some(i => i.type === 'deliverable_due')) {
          map.get(key)!.push({ title: `${d.code}${d.instance_number}`, type: 'deliverable_due', badge: 'Due' })
        }
      }
    }
    return map
  }, [tasks, deliverables])

  const filteredItems = useMemo(() => {
    if (!staffFilter && !clientFilter && !bucketFilter) return itemsByDate
    const filtered = new Map(itemsByDate)
    for (const [key, items] of filtered) {
      filtered.set(key, items.filter(item => {
        if (item.task) {
          if (staffFilter && item.task.assigned_to_name !== staffFilter) return false
          if (clientFilter && item.task.client_id !== clientFilter) return false
          if (bucketFilter && item.task.bucket !== bucketFilter) return false
        }
        return true
      }))
    }
    return filtered
  }, [itemsByDate, staffFilter, clientFilter, bucketFilter])

  const uniqueStaff = useMemo(() =>
    Array.from(new Set(tasks.filter(t => t.assigned_to_name).map(t => t.assigned_to_name!))).sort(),
    [tasks],
  )
  const uniqueClients = useMemo(() =>
    Array.from(new Set(tasks.filter(t => t.client_id && t.client_name).map(t => ({ id: t.client_id!, name: t.client_name! }))))
      .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i).sort((a, b) => a.name.localeCompare(b.name)),
    [tasks],
  )

  function navigate(delta: number) {
    const d = new Date(viewDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() + delta)
    else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta)
    setViewDate(d)
  }

  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  function handleDragStart(task: CommandCentreTask) {
    dragTaskRef.current = task
  }

  function handleDateDrop(dateStr: string) {
    const task = dragTaskRef.current
    dragTaskRef.current = null
    if (!task || task.due_date === dateStr) return
    onDateDrag(task, dateStr)
  }

  const viewLabel = useMemo(() => {
    if (viewMode === 'month') return viewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
    if (viewMode === 'week') {
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 6)
      return `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return viewDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [viewDate, viewMode, weekStart])

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // ── Day/Agenda view ──────────────────────────────────────────
  if (viewMode === 'day') {
    const dayStr = dateKey(year, month, viewDate.getDate())
    const dayItems = filteredItems.get(dayStr) ?? []

    return (
      <div>
        <CalendarNav viewLabel={viewLabel} viewMode={viewMode} setViewMode={setViewMode} navigate={navigate} goToday={goToday} />
        <CalendarFilters staffFilter={staffFilter} setStaffFilter={setStaffFilter} clientFilter={clientFilter} setClientFilter={setClientFilter} bucketFilter={bucketFilter} setBucketFilter={setBucketFilter} uniqueStaff={uniqueStaff} uniqueClients={uniqueClients} />
        <div className="space-y-1.5">
          {dayItems.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">No items scheduled for this day.</p>}
          {dayItems.map((item, idx) => (
            <div
              key={idx}
              draggable={!!item.task}
              onDragStart={() => item.task && handleDragStart(item.task)}
              onClick={() => item.task && onOpenTask(item.task)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                item.type === 'deliverable' || item.type === 'deliverable_due'
                  ? 'border-brand-teal/20 bg-brand-teal/[0.03] cursor-default'
                  : 'border-white/10 bg-white/[0.025] cursor-pointer hover:border-white/20'
              }`}
            >
              <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                item.badge === 'Schedule' ? 'bg-brand-teal/15 text-brand-teal/80' : 'bg-white/10 text-white/50'
              }`}>{item.badge}</span>
              <span className="text-xs text-white/80">{item.title}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Week view ────────────────────────────────────────────────
  if (viewMode === 'week') {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      days.push(d)
    }

    return (
      <div>
        <CalendarNav viewLabel={viewLabel} viewMode={viewMode} setViewMode={setViewMode} navigate={navigate} goToday={goToday} />
        <CalendarFilters staffFilter={staffFilter} setStaffFilter={setStaffFilter} clientFilter={clientFilter} setClientFilter={setClientFilter} bucketFilter={bucketFilter} setBucketFilter={setBucketFilter} uniqueStaff={uniqueStaff} uniqueClients={uniqueClients} />
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {days.map(d => {
            const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
            const items = filteredItems.get(key) ?? []
            const isToday = d.toDateString() === today.toDateString()

            return (
              <div
                key={key}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={e => { e.preventDefault(); handleDateDrop(key) }}
                className={`min-h-[80px] bg-[#0a0a0a] px-1.5 py-1 ${isToday ? 'ring-1 ring-inset ring-brand-teal/40' : ''}`}
              >
                <p className={`text-[10px] font-bold ${isToday ? 'text-brand-teal' : 'text-white/40'}`}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })} {d.getDate()}
                </p>
                {items.slice(0, 4).map((item, idx) => {
                  if (item.task) {
                    return (
                      <button
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(item.task!)}
                        onClick={() => onOpenTask(item.task!)}
                        className="mt-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[8px] font-bold bg-white/5 text-white/60 hover:bg-white/10"
                      >
                        {item.title}
                      </button>
                    )
                  }
                  return (
                    <p key={idx} className={`mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-bold ${
                      item.type === 'deliverable_due' ? 'bg-amber-400/10 text-amber-200/70' : 'bg-brand-teal/15 text-brand-teal/80'
                    }`}>
                      {item.title}
                    </p>
                  )
                })}
                {items.length > 4 && <p className="text-[7px] text-white/30">+{items.length - 4}</p>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Month view (default) ─────────────────────────────────────
  return (
    <div>
      <CalendarNav viewLabel={viewLabel} viewMode={viewMode} setViewMode={setViewMode} navigate={navigate} goToday={goToday} />
      <CalendarFilters staffFilter={staffFilter} setStaffFilter={setStaffFilter} clientFilter={clientFilter} setClientFilter={setClientFilter} bucketFilter={bucketFilter} setBucketFilter={setBucketFilter} uniqueStaff={uniqueStaff} uniqueClients={uniqueClients} />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {weekDays.map(d => (
          <div key={d} className="bg-[#0a0a0a] px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/40">{d}</div>
        ))}
        {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => (
          <div key={`empty-${i}`} className="min-h-[60px] bg-[#0a0a0a]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = dateKey(year, month, day)
          const items = filteredItems.get(key) ?? []
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

          return (
            <div
              key={day}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={e => { e.preventDefault(); handleDateDrop(key) }}
              className={`min-h-[60px] bg-[#0a0a0a] px-1.5 py-1 ${isToday ? 'ring-1 ring-inset ring-brand-teal/40' : ''}`}
            >
              <p className={`text-[10px] font-bold ${isToday ? 'text-brand-teal' : 'text-white/40'}`}>{day}</p>
              {items.slice(0, 3).map((item, idx) => {
                if (item.task) {
                  return (
                    <button
                      key={idx}
                      draggable
                      onDragStart={() => handleDragStart(item.task!)}
                      onClick={() => onOpenTask(item.task!)}
                      className="mt-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[8px] font-bold bg-white/5 text-white/60 hover:bg-white/10"
                    >
                      {item.title}
                    </button>
                  )
                }
                return (
                  <p key={idx} className={`mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-bold ${
                    item.type === 'deliverable_due' ? 'bg-amber-400/10 text-amber-200/70' : 'bg-brand-teal/15 text-brand-teal/80'
                  }`}>
                    {item.title}
                  </p>
                )
              })}
              {items.length > 3 && <p className="text-[7px] text-white/30">+{items.length - 3}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarNav({
  viewLabel, viewMode, setViewMode, navigate, goToday,
}: {
  viewLabel: string; viewMode: CalendarViewMode; setViewMode: (m: CalendarViewMode) => void
  navigate: (delta: number) => void; goToday: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded px-2 py-1 text-xs text-white/50 hover:text-white">&larr;</button>
        <button onClick={goToday} className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white">Today</button>
        <button onClick={() => navigate(1)} className="rounded px-2 py-1 text-xs text-white/50 hover:text-white">&rarr;</button>
        <p className="text-sm text-white/60">{viewLabel}</p>
      </div>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
        {(['month', 'week', 'day'] as CalendarViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
              viewMode === m ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {m === 'month' ? 'Month' : m === 'week' ? 'Week' : 'Day'}
          </button>
        ))}
      </div>
    </div>
  )
}

function CalendarFilters({
  staffFilter, setStaffFilter, clientFilter, setClientFilter, bucketFilter, setBucketFilter,
  uniqueStaff, uniqueClients,
}: {
  staffFilter: string; setStaffFilter: (v: string) => void
  clientFilter: string; setClientFilter: (v: string) => void
  bucketFilter: string; setBucketFilter: (v: string) => void
  uniqueStaff: string[]; uniqueClients: Array<{ id: string; name: string }>
}) {
  const BUCKETS_FOR_FILTER = ['Client Requests', 'Graphic Design', 'Video', 'Websites', 'Admin / To Do', 'Content Guides', 'Once-off', 'Daily', 'Weekly', 'Monthly', 'Recurring', 'CG Socials']
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
        className="rounded border border-white/10 bg-[#111] px-2 py-1 text-[10px] text-white outline-none focus:border-brand-teal/50">
        <option value="">All staff</option>
        {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
        className="rounded border border-white/10 bg-[#111] px-2 py-1 text-[10px] text-white outline-none focus:border-brand-teal/50">
        <option value="">All clients</option>
        {uniqueClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={bucketFilter} onChange={e => setBucketFilter(e.target.value)}
        className="rounded border border-white/10 bg-[#111] px-2 py-1 text-[10px] text-white outline-none focus:border-brand-teal/50">
        <option value="">All buckets</option>
        {BUCKETS_FOR_FILTER.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    </div>
  )
}

function AdminBoardView({ tasks, onOpenTask, onStatusChange }: {
  tasks: CommandCentreTask[]
  onOpenTask: (task: CommandCentreTask) => void
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
}) {
  const adminTasks = useMemo(() =>
    tasks.filter(t => t.bucket === 'Admin / To Do'),
    [tasks],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
          Admin Tasks ({adminTasks.length})
        </p>
        <p className="mt-1 text-xs text-white/35">
          Database-protected — only admin/manager roles can view or edit these records.
        </p>
      </div>
      {adminTasks.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
          No admin tasks. Use Quick Add with 'Admin / To Do' bucket to create one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {adminTasks.map(task => (
            <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onOpen={onOpenTask} />
          ))}
        </div>
      )}
    </div>
  )
}
