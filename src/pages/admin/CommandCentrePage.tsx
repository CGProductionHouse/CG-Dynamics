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
  updateTask,
  updateTaskStatus,
  deleteTask,
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
    else groups['STILL BUSY / IN PROGRESS'].push(t)
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
  const [filterStaff, setFilterStaff] = useState<string>('__my__')

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

  const isAdmin = profile?.role === 'admin'
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
          <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-accent">CG Hub</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Daily Tasks</h1>
        </div>
        <EmptyState
          title="Migration required"
          message="Daily Tasks tables are not set up yet. Run the phase-5 CG Command Centre migration."
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
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Daily Tasks</h1>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active" value={stats.total} />
        <StatCard label="Client requests" value={stats.clientRequests} accent />
        <StatCard label="Done today" value={stats.doneToday} teal />
        <StatCard label="Blocked" value={stats.blocked} amber />
        <StatCard label="Overdue" value={stats.overdue} danger={stats.overdue > 0} />
        <StatCard label="Moved → tomorrow" value={stats.movedToTomorrow} />
      </div>

      {/* B — Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
          {KNOWN_STAFF.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* C — Quick Add */}
      <div className="mb-6">
        <QuickAddCard onTaskCreated={load} />
      </div>

      {/* D — Today's tasks */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-1 rounded-full bg-brand-accent/50" />
          <h2 className="text-lg font-bold text-white">Today's tasks</h2>
          <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent">{filteredActiveTasks.length}</span>
        </div>
        {staffGroups.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            message="Add a task above."
            centered={false}
          />
        ) : (
          <div className="space-y-3">
            {staffGroups.map(([staffName, staffTasks]) => (
              <PremiumCard key={staffName} padding="sm">
                {filterStaff !== '__my__' && (
                  <h3 className="mb-3 text-sm font-semibold text-brand-accent">@{staffName}</h3>
                )}
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

      {/* E — WhatsApp morning + end-of-day */}
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

      {/* F — Morning List Import */}
      <div id="morning-import" className="mb-6">
        <MorningImportCard onTasksCreated={load} />
      </div>

      {drawerTask && (
        <TaskDetailDrawer
          task={drawerTask}
          isAdmin={isAdmin}
          onClose={() => setDrawerTask(null)}
          onSaved={handleSaveTask}
          onDeleted={handleDeleteTask}
        />
      )}
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

function QuickAddCard({ onTaskCreated }: { onTaskCreated: () => void }) {
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
    return () => { active = false }
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
              {task.notes && (
                <>
                  <span className="text-brand-primary/50">·</span>
                  <span className="max-w-[200px] truncate text-brand-primary/60">{task.notes}</span>
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
                        <p className="py-1 text-xs text-brand-primary/60">Loading...</p>
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

function TaskDetailDrawer({ task, isAdmin, onClose, onSaved, onDeleted }: {
  task: CommandCentreTask
  isAdmin: boolean
  onClose: () => void
  onSaved: (updated: CommandCentreTask) => void
  onDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [clientId, setClientId] = useState(task.client_id ?? (task.client_name ? '__manual__' : ''))
  const [manualClientName, setManualClientName] = useState(
    task.client_id ? '' : (task.client_name ?? '')
  )
  const [assignedName, setAssignedName] = useState(task.assigned_to_name ?? '')
  const [bucket, setBucket] = useState<TaskBucket>(task.bucket)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.due_date)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  useEffect(() => {
    let active = true
    listActiveClients().then(({ data }) => {
      if (!active) return
      setClients(data ?? [])
      setClientsLoading(false)
    }).catch(() => {
      if (active) setClientsLoading(false)
    })
    return () => { active = false }
  }, [])

  const isManualClient = clientId === '__manual__'
  const selectedClient = clients.find(c => c.id === clientId)

  async function handleSave() {
    if (saving || !title.trim()) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const resolvedClientId = selectedClient?.id ?? null
      const resolvedClientName = isManualClient
        ? (manualClientName.trim() || null)
        : (selectedClient?.name ?? null)
      const updates = {
        title: title.trim(),
        client_id: resolvedClientId,
        client_name: resolvedClientName,
        assigned_to_name: assignedName.trim() || null,
        bucket,
        priority,
        status,
        due_date: dueDate,
        notes: notes.trim() || null,
      }
      const { error } = await updateTask(task.id, updates)
      if (error) { setSaveError(error.message); return }
      const updated: CommandCentreTask = {
        ...task,
        ...updates,
        updated_at: new Date().toISOString(),
        completed_at: (status as string) === 'done'
          ? (task.completed_at ?? new Date().toISOString())
          : null,
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
      await deleteTask(task.id)
      onDeleted(task.id)
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#111111] sm:w-[480px] border-l border-white/[0.08] overflow-y-auto">
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

        <div className="flex-1 space-y-4 px-5 py-5">
          {task.priority === 'client_request' && (
            <div className="flex items-center gap-2">
              <Pill tone="accent">
                {task.source === 'whatsapp_paste' ? 'Client req · WA' : 'Client request'}
              </Pill>
              {task.source === 'whatsapp_paste' && (
                <span className="text-xs text-brand-primary/60">From WhatsApp</span>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Client</label>
            {clientsLoading ? (
              <p className="py-2 text-xs text-brand-primary/60">Loading clients...</p>
            ) : (
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__manual__">Manual / other client</option>
              </select>
            )}
            {isManualClient && (
              <input
                value={manualClientName}
                onChange={e => setManualClientName(e.target.value)}
                placeholder="Type client name"
                className={`mt-2 ${inputCls}`}
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label>
            <select value={assignedName} onChange={e => setAssignedName(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {KNOWN_STAFF.map(name => <option key={name} value={name}>{name}</option>)}
              <option value="__other__">Other...</option>
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
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
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

          <div className="rounded-lg border border-white/[0.06] bg-brand-surface/40 px-3 py-2.5">
            <p className="text-xs text-brand-primary/60">
              <span className="font-medium text-brand-primary">Helpers / collaborators</span>
              {' '}— coming soon
            </p>
          </div>

          {isAdmin && task.priority === 'client_request' && (
            <div className="rounded-lg border border-white/[0.06] bg-brand-surface/40 px-3 py-3">
              <p className="mb-2.5 text-xs font-medium text-brand-primary">Package action</p>
              <div className="flex flex-wrap gap-2">
                {(['use_slot', 'addon', 'move_work'] as const).map(action => (
                  <button
                    key={action}
                    type="button"
                    disabled
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-brand-primary/40 cursor-not-allowed"
                  >
                    {action === 'use_slot' ? 'Use package slot' : action === 'addon' ? 'Mark as add-on' : 'Move to another month'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-brand-primary/40">After migration phase-7a</p>
            </div>
          )}
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
            {isAdmin && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                Delete task
              </button>
            )}
            {isAdmin && confirmDelete && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-brand-primary">Sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
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
