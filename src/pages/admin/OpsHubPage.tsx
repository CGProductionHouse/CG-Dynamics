import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import {
  listTasks,
  updateTaskStatus,
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
  const [searchParams, setSearchParams] = useSearchParams()
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

  function setTab(tab: OpsTab) {
    setSearchParams(tab === 'my-work' ? {} : { tab })
  }

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
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))

    const result = await updateTaskStatus(task.id, newStatus)
    if (result.error) {
      if (prev) setTasks(p => p.map(t => t.id === task.id ? prev : t))
    }
  }

  const todayKey = businessDateKey(new Date())

  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigned_to_name === profile?.full_name),
    [tasks, profile],
  )

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

      <nav className="mb-6 flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {(['my-work', 'board', 'client-work', 'calendar'] as OpsTab[]).concat(isAdmin ? ['admin'] as OpsTab[] : []).map(tab => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition-colors ${
              activeTab === tab
                ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                : 'text-brand-primary/60 hover:text-brand-primary'
            }`}
          >
            {tab === 'my-work' && 'My Work'}
            {tab === 'board' && 'Board'}
            {tab === 'client-work' && 'Client Work'}
            {tab === 'calendar' && 'Calendar'}
            {tab === 'admin' && 'Admin'}
          </button>
        ))}
      </nav>

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
        />
      ) : activeTab === 'client-work' ? (
        <ClientWorkView
          deliverables={deliverables}
          tasks={tasks}
          onOpenTask={setSelectedTask}
        />
      ) : activeTab === 'calendar' ? (
        <CalendarView tasks={tasks} deliverables={deliverables} onOpenTask={setSelectedTask} />
      ) : activeTab === 'admin' && isAdmin ? (
        <AdminBoardView />
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

function BoardView({ tasks, onOpenTask }: { tasks: CommandCentreTask[]; onOpenTask: (task: CommandCentreTask) => void }) {
  const buckets = useMemo(() => {
    const map = new Map<TaskBucket, CommandCentreTask[]>()
    for (const task of tasks) {
      const bucket = (task.bucket || 'Once-off') as TaskBucket
      if (!map.has(bucket)) map.set(bucket, [])
      map.get(bucket)!.push(task)
    }
    return [...map.entries()].sort(([, a], [, b]) => b.length - a.length)
  }, [tasks])

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4" style={{ minWidth: Math.max(buckets.length * 260, 600) }}>
        {buckets.map(([bucket, items]) => (
          <div key={bucket} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">{bucket}</h3>
              <span className="text-[10px] text-white/30">{items.length}</span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2">
              {items.slice(0, 20).map(task => (
                <TaskCard key={task.id} task={task} onStatusChange={() => {}} onOpen={onOpenTask} compact />
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

function CalendarView({
  tasks,
  deliverables,
  onOpenTask,
}: {
  tasks: CommandCentreTask[]
  deliverables: MonthlyDeliverable[]
  onOpenTask: (task: CommandCentreTask) => void
}) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const dateKey = (day: number) => {
    const d = new Date(year, month, day)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Array<{ task?: CommandCentreTask; title: string; type: string }>>()
    for (const t of tasks) {
      if (t.due_date) {
        if (!map.has(t.due_date)) map.set(t.due_date, [])
        map.get(t.due_date)!.push({ task: t, title: t.title, type: 'task' })
      }
    }
    for (const d of deliverables) {
      if (d.scheduled_date) {
        const key = d.scheduled_date
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ title: `${d.code}${d.instance_number}`, type: 'deliverable' })
      }
    }
    return map
  }, [tasks, deliverables])

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthName = today.toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p className="mb-3 text-sm text-white/60">{monthName}</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {weekDays.map(d => (
          <div key={d} className="bg-[#0a0a0a] px-2 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white/40">{d}</div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="min-h-[60px] bg-[#0a0a0a]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = dateKey(day)
          const items = itemsByDate.get(key) ?? []
          const isToday = day === today.getDate()

          return (
            <div key={day} className={`min-h-[60px] bg-[#0a0a0a] px-1.5 py-1 ${isToday ? 'ring-1 ring-inset ring-brand-teal/40' : ''}`}>
              <p className={`text-[10px] font-bold ${isToday ? 'text-brand-teal' : 'text-white/40'}`}>{day}</p>
              {items.slice(0, 3).map((item, idx) => {
                if (item.task && item.type === 'task') {
                  return (
                    <button
                      key={idx}
                      onClick={() => onOpenTask(item.task!)}
                      className="mt-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[8px] font-bold bg-white/5 text-white/60 hover:bg-white/10"
                    >
                      {item.title}
                    </button>
                  )
                }
                return (
                  <p key={idx} className="mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-bold bg-brand-teal/15 text-brand-teal/80">
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

function AdminBoardView() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center">
      <p className="text-sm text-white/50">
        Admin board — accessible to admin roles only. This area is database-protected and
        not visible to normal staff members.
      </p>
      <p className="mt-2 text-xs text-white/35">
        Daily, weekly and monthly admin tasks (payroll, checking, financial) belong here.
      </p>
    </div>
  )
}
