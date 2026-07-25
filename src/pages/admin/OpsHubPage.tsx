import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { LoadingState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import {
  listTasks,
  createTask,
  updateTaskStatus,
  type CommandCentreTask,
  type TaskInput,
  type TaskBucket,
  type TaskStatus,
} from '../../lib/commandCentre'
import {
  listMonthlyDeliverablesByMonth,
  type MonthlyDeliverable,
} from '../../lib/planner'
import { businessDateKey } from '../../lib/businessTime'

type OpsTab = 'my-work' | 'board' | 'client-work' | 'calendar' | 'admin'

export default function OpsHubPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const activeTab: OpsTab = (searchParams.get('tab') as OpsTab) || 'my-work'
  const isAdmin = profile?.role ? isManagerRole(profile.role) : false

  function setTab(tab: OpsTab) {
    setSearchParams(tab === 'my-work' ? {} : { tab })
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [tasksResult, deliverableResult] = await Promise.all([
        listTasks(),
        listMonthlyDeliverablesByMonth(month),
      ])
      if (!active) return
      if (tasksResult.error) { setError(tasksResult.error.message); setLoading(false); return }
      setTasks(tasksResult.data ?? [])
      setDeliverables(deliverableResult.data ?? [])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  async function handleQuickAdd() {
    const title = quickTitle.trim()
    if (!title || adding) return
    setAdding(true)
    const today = businessDateKey(new Date())
    const input: TaskInput = {
      title,
      bucket: 'Admin / To Do',
      priority: 'normal',
      status: 'to_do',
      source: 'manual',
      due_date: today,
    }
    const result = await createTask(input)
    if (!result.error) {
      setTasks(prev => result.data ? [...prev, result.data] : prev)
    }
    setQuickTitle('')
    setShowQuickAdd(false)
    setAdding(false)
  }

  const todayKey = businessDateKey(new Date())

  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigned_to_name === profile?.full_name),
    [tasks, profile],
  )

  async function handleStatusChange(task: CommandCentreTask, newStatus: TaskStatus) {
    const result = await updateTaskStatus(task.id, newStatus)
    if (!result.error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    }
  }

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
          {!showQuickAdd ? (
            <ActionButton size="sm" onClick={() => setShowQuickAdd(true)}>+ Quick Add</ActionButton>
          ) : null}
          {showQuickAdd && (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleQuickAdd(); if (e.key === 'Escape') { setShowQuickAdd(false); setQuickTitle('') } }}
                placeholder="Task title..."
                className="w-64 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50"
              />
              <ActionButton size="sm" onClick={() => void handleQuickAdd()} disabled={adding || !quickTitle.trim()}>
                {adding ? '...' : 'Add'}
              </ActionButton>
              <button onClick={() => { setShowQuickAdd(false); setQuickTitle('') }} className="text-xs text-white/40 hover:text-white">Cancel</button>
            </div>
          )}
        </div>
      </header>

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
        />
      ) : activeTab === 'board' ? (
        <BoardView tasks={tasks} />
      ) : activeTab === 'client-work' ? (
        <ClientWorkView deliverables={deliverables} tasks={tasks} />
      ) : activeTab === 'calendar' ? (
        <CalendarView tasks={tasks} deliverables={deliverables} />
      ) : activeTab === 'admin' && isAdmin ? (
        <AdminBoardView />
      ) : null}
    </div>
  )
}

function MyWorkView({
  myTasks,
  todayKey,
  onStatusChange,
}: {
  myTasks: CommandCentreTask[]
  todayKey: string
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
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
      <TaskSection title={`Overdue (${overdue.length})`} tasks={overdue} color="text-red-300" onStatusChange={onStatusChange} />
      <TaskSection title={`Today (${today.length})`} tasks={today} color="text-amber-200" onStatusChange={onStatusChange} />
      <TaskSection title={`In Progress (${inProgress.length})`} tasks={inProgress} color="text-brand-teal" onStatusChange={onStatusChange} />
      <TaskSection title={`Upcoming (${upcoming.length})`} tasks={upcoming} color="text-white/60" onStatusChange={onStatusChange} />
      <TaskSection title={`Waiting / Review (${waiting.length})`} tasks={waiting} color="text-sky-200" onStatusChange={onStatusChange} />
      <TaskSection title={`No Due Date (${noDate.length})`} tasks={noDate} color="text-white/40" onStatusChange={onStatusChange} />
    </div>
  )
}

function TaskSection({
  title,
  tasks,
  color,
  onStatusChange,
}: {
  title: string
  tasks: CommandCentreTask[]
  color: string
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
}) {
  if (tasks.length === 0) return null
  return (
    <section>
      <h2 className={`text-[10px] font-black uppercase tracking-[0.18em] ${color}`}>{title}</h2>
      <div className="mt-2 space-y-1.5">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} />
        ))}
      </div>
    </section>
  )
}

function TaskRow({
  task,
  onStatusChange,
}: {
  task: CommandCentreTask
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 transition-colors hover:border-white/20">
      <input
        type="checkbox"
        checked={task.status === 'done'}
        onChange={() => onStatusChange(task, task.status === 'done' ? 'to_do' : 'done')}
        className="h-4 w-4 rounded border-white/20 bg-transparent accent-brand-teal"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.status === 'done' ? 'text-white/30 line-through' : 'text-white'}`}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap gap-2">
          {task.client_name && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal/60">{task.client_name}</span>}
          {task.bucket && <span className="text-[10px] uppercase tracking-wider text-white/35">{task.bucket}</span>}
          {task.due_date && (
            <span className={`text-[10px] uppercase tracking-wider ${task.due_date < businessDateKey(new Date()) && task.status !== 'done' ? 'text-red-300' : 'text-white/35'}`}>
              Due {task.due_date}
            </span>
          )}
          {task.source && task.source !== 'manual' && (
            <span className="text-[10px] uppercase tracking-wider text-amber-200/50">{task.source}</span>
          )}
        </div>
      </div>
      <select
        value={task.status}
        onChange={e => onStatusChange(task, e.target.value as TaskStatus)}
        className="w-28 rounded border border-white/10 bg-[#111] px-2 py-1 text-[10px] text-white/70 outline-none focus:border-brand-teal/50"
      >
        <option value="to_do">To do</option>
        <option value="in_progress">In progress</option>
        <option value="waiting_client">Waiting</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </select>
    </div>
  )
}

function BoardView({ tasks }: { tasks: CommandCentreTask[] }) {
  const buckets = useMemo(() => {
    const map = new Map<TaskBucket, CommandCentreTask[]>()
    for (const task of tasks) {
      const bucket = (task.bucket || 'Admin / To Do') as TaskBucket
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
                <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-colors hover:border-white/20">
                  <p className="text-xs text-white">{task.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {task.priority === 'urgent' && (
                      <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-300">Urgent</span>
                    )}
                    {task.priority === 'client_request' && (
                      <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200">Request</span>
                    )}
                    {task.client_name && (
                      <span className="rounded bg-brand-teal/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-teal/70">{task.client_name}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/35">
                    {task.assigned_to_name && <span>{task.assigned_to_name}</span>}
                    {task.due_date && <span>{task.due_date}</span>}
                  </div>
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
}: {
  deliverables: MonthlyDeliverable[]
  tasks: CommandCentreTask[]
}) {
  const clientRequests = useMemo(() =>
    tasks.filter(t => t.priority === 'client_request' || t.source === 'whatsapp_paste'),
    [tasks],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/60">Client Requests ({clientRequests.length})</h2>
        <div className="mt-2 space-y-1.5">
          {clientRequests.slice(0, 15).map(task => (
            <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
              <p className="text-sm text-white">{task.title}</p>
              {task.client_name && <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal/60">{task.client_name}</p>}
              {task.notes && <p className="mt-1 text-xs text-white/50 line-clamp-2">{task.notes}</p>}
            </div>
          ))}
          {clientRequests.length === 0 && <p className="text-sm text-white/30">No pending client requests.</p>}
        </div>
      </section>
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/70">
          Monthly Deliverables ({deliverables.length})
        </h2>
        <div className="mt-2 space-y-2">
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
                <p className="text-xs text-white/70 truncate">{d.title}</p>
              </div>
            </div>
          ))}
          {deliverables.length === 0 && <p className="text-sm text-white/30">No deliverables for this month.</p>}
        </div>
      </section>
    </div>
  )
}

function CalendarView({
  tasks,
  deliverables,
}: {
  tasks: CommandCentreTask[]
  deliverables: MonthlyDeliverable[]
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
    const map = new Map<string, Array<{ title: string; type: string }>>()
    for (const t of tasks) {
      if (t.due_date) {
        if (!map.has(t.due_date)) map.set(t.due_date, [])
        map.get(t.due_date)!.push({ title: t.title, type: 'task' })
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
      <div className="grid grid-cols-7 gap-px rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {weekDays.map(d => (
          <div key={d} className="bg-[#0a0a0a] px-2 py-2 text-[9px] font-black uppercase tracking-wider text-white/40 text-center">{d}</div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="bg-[#0a0a0a] min-h-[60px]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = dateKey(day)
          const items = itemsByDate.get(key) ?? []
          const isToday = day === today.getDate()

          return (
            <div key={day} className={`min-h-[60px] bg-[#0a0a0a] px-1.5 py-1 ${isToday ? 'ring-1 ring-inset ring-brand-teal/40' : ''}`}>
              <p className={`text-[10px] font-bold ${isToday ? 'text-brand-teal' : 'text-white/40'}`}>{day}</p>
              {items.slice(0, 3).map((item, idx) => (
                <p key={idx} className={`mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-bold ${
                  item.type === 'deliverable' ? 'bg-brand-teal/15 text-brand-teal/80' : 'bg-white/5 text-white/60'
                }`}>
                  {item.title}
                </p>
              ))}
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
