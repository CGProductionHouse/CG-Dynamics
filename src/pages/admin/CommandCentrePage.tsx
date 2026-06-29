import { useState, useEffect, useMemo, useCallback } from 'react'
import type { FormEvent } from 'react'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import {
  listTasks,
  createTask,
  updateTaskStatus,
  listActiveClients,
  parseMorningList,
  morningEditToInput,
  BUCKETS,
  PRIORITIES,
  STATUSES,
  KNOWN_STAFF,
  type CommandCentreTask,
  type TaskInput,
  type TaskBucket,
  type TaskPriority,
  type TaskStatus,
  type ClientOption,
  type ParsedMorningTask,
  type MorningTaskEdit,
} from '../../lib/commandCentre'

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, client_request: 1, normal: 2 }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateStr: string) {
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

function statusTone(s: TaskStatus) {
  if (s === 'done') return 'teal'
  if (s === 'in_progress') return 'accent'
  if (s === 'blocked' || s === 'waiting_client') return 'amber'
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

function buildMorningMessage(byStaff: Map<string, CommandCentreTask[]>) {
  const lines: string[] = ['CGPH TO DO', '']
  for (const [staff, tasks] of byStaff) {
    const clientRequests = tasks.filter(t => t.priority === 'client_request')
    const normal = tasks.filter(t => t.priority !== 'client_request')
    const sorted = [...clientRequests, ...normal]
    lines.push(`@${staff}`)
    for (const t of sorted) {
      const prefix = t.client_name ? `${t.client_name} — ` : ''
      lines.push(`- ${prefix}${t.title}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function buildEndOfDay(activeTasks: CommandCentreTask[]) {
  const groups: Record<string, CommandCentreTask[]> = {
    'DONE': [],
    'STILL BUSY / IN PROGRESS': [],
    'BLOCKED': [],
    'WAITING CLIENT': [],
    'MOVED TO TOMORROW': [],
  }
  for (const t of activeTasks) {
    if (t.status === 'done') groups['DONE'].push(t)
    else if (t.status === 'in_progress') groups['STILL BUSY / IN PROGRESS'].push(t)
    else if (t.status === 'blocked') groups['BLOCKED'].push(t)
    else if (t.status === 'waiting_client') groups['WAITING CLIENT'].push(t)
    else if (t.status === 'moved_to_tomorrow') groups['MOVED TO TOMORROW'].push(t)
    else groups['STILL BUSY / IN PROGRESS'].push(t) // to_do → still busy
  }
  const lines: string[] = ['CGPH END OF DAY UPDATE', '']
  for (const [heading, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    lines.push(heading)
    for (const t of items) {
      const name = t.assigned_to_name ? ` (${t.assigned_to_name})` : ''
      const prefix = t.client_name ? `${t.client_name} — ` : ''
      lines.push(`- ${prefix}${t.title}${name}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export default function CommandCentrePage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filterStaff, setFilterStaff] = useState<string>('')

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

  useEffect(() => { void load() }, [])

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const today = todayStr()

  const activeTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'done' && t.status !== 'moved_to_tomorrow')
      .sort((a, b) => {
        const aDate = new Date(`${a.due_date}T00:00:00`)
        const bDate = new Date(`${b.due_date}T00:00:00`)
        const aOver = aDate < now ? 1 : 0
        const bOver = bDate < now ? 1 : 0
        if (aOver !== bOver) return bOver - aOver
        const pr = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)
        if (pr !== 0) return pr
        return (a.assigned_to_name ?? '').localeCompare(b.assigned_to_name ?? '')
      })
  }, [tasks, now])

  const allRelevant = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'done' || (t.completed_at && t.completed_at.slice(0, 10) === today))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99))
  }, [tasks, today])

  const stats = useMemo(() => ({
    total: activeTasks.length,
    clientRequests: tasks.filter(t => t.priority === 'client_request' && t.status !== 'done').length,
    doneToday: tasks.filter(t => t.status === 'done' && t.completed_at?.slice(0, 10) === today).length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    overdue: activeTasks.filter(t => new Date(`${t.due_date}T00:00:00`) < now).length,
    movedToTomorrow: tasks.filter(t => t.status === 'moved_to_tomorrow').length,
  }), [tasks, activeTasks, today, now])

  const filteredActiveTasks = useMemo(() => {
    if (!filterStaff) return activeTasks
    if (filterStaff === '__my__') {
      const myName = profile?.full_name ?? ''
      if (KNOWN_STAFF.includes(myName)) return activeTasks.filter(t => t.assigned_to_name === myName)
      return activeTasks.filter(t => t.assigned_to_name === profile?.full_name)
    }
    return activeTasks.filter(t => t.assigned_to_name === filterStaff)
  }, [activeTasks, filterStaff, profile])

  const staffGroups = useMemo(() => {
    const groups = new Map<string, CommandCentreTask[]>()
    for (const t of filteredActiveTasks) {
      const name = t.assigned_to_name ?? 'Unassigned'
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name)!.push(t)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const ai = KNOWN_STAFF.indexOf(a)
      const bi = KNOWN_STAFF.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      return a.localeCompare(b)
    })
  }, [filteredActiveTasks])

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    setBusyId(id)
    try {
      const { error } = await updateTaskStatus(id, status)
      if (!error) {
        setTasks(prev => prev.map(t => {
          if (t.id !== id) return t
          const now = new Date().toISOString()
          return {
            ...t,
            status,
            updated_at: now,
            completed_at: (status as string) === 'done' ? now : null,
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="h-4 w-32 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded-lg bg-white/10" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">CG Command Centre</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">CG Command Centre</h1>
        </div>
        <EmptyState
          title="Migration required"
          message="Command Centre tables are not set up yet. Run the phase-5 CG Command Centre migration."
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
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">CG Command Centre</h1>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Active" value={stats.total} />
          <StatCard label="Client requests" value={stats.clientRequests} accent />
          <StatCard label="Done today" value={stats.doneToday} teal />
          <StatCard label="Blocked" value={stats.blocked} amber />
          <StatCard label="Overdue" value={stats.overdue} danger={stats.overdue > 0} />
          <StatCard label="Moved → tomorrow" value={stats.movedToTomorrow} />
        </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
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
        <select
          value={filterStaff !== '__my__' && filterStaff !== '' ? filterStaff : ''}
          onChange={e => setFilterStaff(e.target.value || '')}
          className="rounded-lg border border-brand-muted/60 bg-brand-bg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
        >
          <option value="">All staff</option>
          {KNOWN_STAFF.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AddTaskCard onTaskCreated={load} />
        <CaptureRequestCard onTaskCreated={load} />
      </div>

      <div id="morning-import" className="mb-6">
        <MorningImportCard onTasksCreated={load} />
      </div>

      <p className="mb-6 text-xs text-brand-primary/60">
        WhatsApp messages are generated for copy/paste only. No WhatsApp API is connected yet.
      </p>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-1 rounded-full bg-brand-accent/50" />
          <h2 className="text-lg font-bold text-white">Today's tasks</h2>
          <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent">{filteredActiveTasks.length}</span>
        </div>
        {staffGroups.length === 0 ? (
          <EmptyState
            title="No tasks for today yet"
            message="Add a task or capture a client request."
            centered={false}
          />
        ) : (
          <div className="space-y-3">
            {staffGroups.map(([staffName, staffTasks]) => (
              <PremiumCard key={staffName} padding="sm">
                <h3 className="mb-3 text-sm font-semibold text-brand-accent">@{staffName}</h3>
                <div className="space-y-2">
                  {staffTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busyId={busyId}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MorningMessageCard
          staffGroups={staffGroups}
          copiedSection={copiedSection}
          onCopy={handleCopy}
        />
        <EndOfDayCard
          allRelevant={allRelevant}
          copiedSection={copiedSection}
          onCopy={handleCopy}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, teal, amber, danger }: {
  label: string
  value: number
  accent?: boolean
  teal?: boolean
  amber?: boolean
  danger?: boolean
}) {
  const valClass = danger
    ? 'text-red-400'
    : accent ? 'text-brand-accent'
    : teal ? 'text-[#2dd4bf]'
    : amber ? 'text-amber-400'
    : 'text-white'
  return (
    <div className="rounded-xl border border-brand-muted/30 bg-brand-surface/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-brand-primary/50">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${valClass}`}>{value}</p>
    </div>
  )
}

function TaskRow({ task, busyId, onStatusChange }: {
  task: CommandCentreTask
  busyId: string | null
  onStatusChange: (id: string, status: TaskStatus) => void
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
              <span className="text-sm font-semibold text-white">{task.title}</span>
              {task.priority !== 'normal' && (
                <Pill tone={priorityColor(task.priority)}>
                  {task.priority === 'urgent' ? 'Urgent' : 'Client req'}
                </Pill>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {task.client_name && <span className="text-brand-primary">{task.client_name}</span>}
              <span className={dateClass(task.due_date)}>{formatDate(task.due_date)}</span>
              <span className="text-brand-primary/50">·</span>
              <span className="text-brand-primary/60">{task.bucket}</span>
              {task.notes && (
                <>
                  <span className="text-brand-primary/50">·</span>
                  <span className="text-brand-primary/60 truncate max-w-[200px]">{task.notes}</span>
                </>
              )}
            </div>
          </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill tone={statusTone(task.status)}>{statusLabel(task.status)}</Pill>
          {task.status !== 'done' && (
            <select
              value={task.status}
              onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
              disabled={busyId === task.id}
              className="rounded-lg border border-brand-muted/60 bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:opacity-60"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          )}
          {task.status === 'done' && (
            <button
              type="button"
              onClick={() => onStatusChange(task.id, 'to_do')}
              disabled={busyId === task.id}
              className="rounded-lg border border-brand-muted/60 px-2 py-1.5 text-xs text-brand-primary hover:text-white disabled:opacity-60"
            >
              Reopen
            </button>
          )}
        </div>
        </div>
      </PremiumCard>
    </div>
  )
}

function AddTaskCard({ onTaskCreated }: {
  onTaskCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [manualClientName, setManualClientName] = useState('')
  const [assignedName, setAssignedName] = useState('')
  const [bucket, setBucket] = useState<TaskBucket>('Admin / To Do')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState(todayStr)
  const [status, setStatus] = useState<TaskStatus>('to_do')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setClientsLoading(true)
    setClientsError(null)
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

  const isManualClient = clientId === '__manual__'
  const selectedClient = clients.find(c => c.id === clientId)

  function resetForm() {
    setTitle('')
    setClientId('')
    setManualClientName('')
    setAssignedName('')
    setBucket('Admin / To Do')
    setPriority('normal')
    setDueDate(todayStr)
    setStatus('to_do')
    setNotes('')
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
        bucket,
        priority,
        status,
        due_date: dueDate,
        notes: notes.trim() || null,
        source: 'manual',
      }
      const { error } = await createTask(input)
      if (error) {
        setError(error.message)
        return
      }
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
      <h2 className="mb-1 text-base font-semibold text-white">Add task</h2>
      <p className="mb-4 text-xs text-brand-primary">Create a new task for the team.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-brand-primary">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-primary">Client</label>
            {clientsLoading ? (
              <p className="text-xs text-brand-primary/60 py-2">Loading clients...</p>
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
                  <p className="mt-1 text-xs text-amber-400">{clientsError} You can still type a client name.</p>
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
              {KNOWN_STAFF.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="__other__">Other...</option>
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
                <option key={p} value={p}>{p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
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
            placeholder="Any details about this task."
            className="w-full resize-none rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <ActionButton variant="primary" type="submit" disabled={saving || !title.trim()} loading={saving}>
          Add task
        </ActionButton>
      </form>
    </PremiumCard>
  )
}

function CaptureRequestCard({ onTaskCreated }: {
  onTaskCreated: () => void
}) {
  const [whatsappText, setWhatsappText] = useState('')
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [manualClientName, setManualClientName] = useState('')
  const [assignedName, setAssignedName] = useState('')
  const [dueDate, setDueDate] = useState(todayStr)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setClientsLoading(true)
    setClientsError(null)
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

  const isManualClient = clientId === '__manual__'
  const selectedClient = clients.find(c => c.id === clientId)

  function resetForm() {
    setWhatsappText('')
    setTitle('')
    setClientId('')
    setManualClientName('')
    setAssignedName('')
    setDueDate(todayStr)
    setNotes('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !whatsappText.trim()) return
    setSaving(true)
    setError(null)
    try {
      const input: TaskInput = {
        title: title.trim() || `Client request`,
        client_id: selectedClient?.id ?? null,
        client_name: isManualClient ? manualClientName.trim() || null : selectedClient?.name ?? null,
        assigned_to_name: assignedName.trim() || null,
        bucket: 'Client Requests',
        priority: 'client_request',
        status: 'to_do',
        due_date: dueDate,
        notes: notes.trim() || whatsappText.trim() || null,
        source: 'whatsapp_paste',
        whatsapp_source_text: whatsappText.trim() || null,
      }
      const { error } = await createTask(input)
      if (error) {
        setError(error.message)
        return
      }
      resetForm()
      onTaskCreated()
    } catch {
      setError('Could not save client request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PremiumCard padding="md">
      <h2 className="mb-1 text-base font-semibold text-white">Capture WhatsApp client request</h2>
      <p className="mb-4 text-xs text-brand-primary">Paste a client's WhatsApp message to create a tracked task.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-brand-primary">WhatsApp message *</label>
          <textarea
            value={whatsappText}
            onChange={e => {
              setWhatsappText(e.target.value)
              if (!title.trim()) {
                const firstLine = e.target.value.split('\n')[0].trim().slice(0, 80)
                if (firstLine) setTitle(firstLine)
              }
            }}
            required
            rows={3}
            placeholder="Paste the WhatsApp request text here..."
            className="w-full resize-none rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-brand-primary">Task title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-filled from first line"
              className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-primary">Client</label>
            {clientsLoading ? (
              <p className="text-xs text-brand-primary/60 py-2">Loading clients...</p>
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
                  <p className="mt-1 text-xs text-amber-400">{clientsError} You can still type a client name.</p>
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
              {KNOWN_STAFF.map(name => (
                <option key={name} value={name}>{name}</option>
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
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <ActionButton variant="primary" type="submit" disabled={saving || !whatsappText.trim()} loading={saving}>
          Capture client request
        </ActionButton>
      </form>
    </PremiumCard>
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
    setClientsLoading(true)
    setClientsError(null)
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
      clientOption: t.clientId || '',
      manualClientName: '',
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
    for (const edit of edits) {
      const input = morningEditToInput(edit)
      // Attach staff name from the original parsed task
      const original = parsed?.find(p => p.id === edit.id)
      input.assigned_to_name = original?.staffName === 'Unassigned' ? null : original?.staffName ?? null
      const { error } = await createTask(input)
      if (error) {
        setError(`Error creating task "${edit.title}": ${error.message}`)
        setSaving(false)
        return
      }
      created++
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
      <h2 className="mb-1 text-base font-semibold text-white">Morning List Import</h2>
      <p className="mb-4 text-xs text-brand-primary">
        Paste the daily WhatsApp to-do list here. Voice note import will come later — for now, paste the typed list.
      </p>

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
              return (
                <div key={edit.id} className="rounded-lg border border-brand-muted bg-brand-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-accent">
                      {original?.staffName ?? `Task ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(edit.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-brand-primary">Client</label>
                      {clientsLoading ? (
                        <p className="text-xs text-brand-primary/60 py-1">Loading...</p>
                      ) : (
                        <>
                          <select
                            value={edit.clientOption}
                            onChange={e => updateEdit(edit.id, { clientOption: e.target.value, manualClientName: '' })}
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
                          onChange={e => updateEdit(edit.id, { manualClientName: e.target.value })}
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
                          <option key={p} value={p}>{p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
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

function MorningMessageCard({ staffGroups, copiedSection, onCopy }: {
  staffGroups: [string, CommandCentreTask[]][]
  copiedSection: string | null
  onCopy: (section: string, text: string) => void
}) {
  const nonEmptyGroups = new Map(staffGroups.filter(([, tasks]) => tasks.length > 0))
  const message = useMemo(() => buildMorningMessage(nonEmptyGroups), [nonEmptyGroups])
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
          disabled={staffGroups.length === 0}
        >
          {isCopied ? 'Copied!' : 'Copy'}
        </ActionButton>
      </div>
      {staffGroups.length === 0 ? (
        <p className="mt-3 text-xs text-brand-primary/60">No tasks to generate a message.</p>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-brand-muted bg-brand-bg p-3 text-xs leading-relaxed text-brand-primary/80 whitespace-pre-wrap font-mono">
          {message}
        </pre>
      )}
    </PremiumCard>
  )
}

function EndOfDayCard({ allRelevant, copiedSection, onCopy }: {
  allRelevant: CommandCentreTask[]
  copiedSection: string | null
  onCopy: (section: string, text: string) => void
}) {
  const message = useMemo(() => buildEndOfDay(allRelevant), [allRelevant])
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
