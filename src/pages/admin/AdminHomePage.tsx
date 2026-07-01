import { useState, useEffect, useMemo, useCallback } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { Pill } from '../../components/ui/Badges'
import { EmptyState } from '../../components/ui/States'
import {
  listTasks,
  createTask,
  updateTaskStatus,
  listActiveClients,
  PRIORITIES,
  STATUSES,
  KNOWN_STAFF,
  type CommandCentreTask,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
  type ClientOption,
} from '../../lib/commandCentre'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateNice() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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

interface StaffWorkload {
  name: string
  active: number
  doneToday: number
  blocked: number
  previewTasks: { title: string; client_name: string | null }[]
}

const PRIMARY_ACTIONS = [
  {
    id: 'morning-list',
    title: 'Client Requests',
    description: 'Paste the morning list.',
    to: '/admin/command-centre#morning-import',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    id: 'command-centre',
    title: 'Tasks',
    description: 'Open team tasks.',
    to: '/admin/command-centre',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192" />
      </svg>
    ),
  },
  {
    id: 'client-schedule',
    title: 'Client Schedule',
    description: 'Package posting schedule.',
    to: '/admin/client-schedule?view=calendar',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    id: 'planner',
    title: 'Planner',
    description: 'Boards and buckets.',
    to: '/admin/planner',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: 'assistant',
    title: 'Assistant',
    description: 'Drafts and support.',
    to: '/admin/assistant',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
]

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-white/10" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
        ))}
      </div>
      <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-brand-surface border border-brand-muted" />
        ))}
      </div>
    </div>
  )
}

export default function AdminHomePage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<CommandCentreTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [quickAddMsg, setQuickAddMsg] = useState<string | null>(null)
  const today = todayStr()

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
      setError('Could not load task data.')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleClientRequestStatusChange = useCallback(async (id: string, status: TaskStatus) => {
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

  const activeTasks = useMemo(
    () => tasks.filter(t => t.status !== 'done' && t.status !== 'moved_to_tomorrow'),
    [tasks]
  )

  const now = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const stats = useMemo(() => ({
    total: activeTasks.length,
    clientRequests: tasks.filter(t => t.priority === 'client_request' && t.status !== 'done').length,
    doneToday: tasks.filter(t => t.status === 'done' && t.completed_at?.slice(0, 10) === today).length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    overdue: activeTasks.filter(t => new Date(`${t.due_date}T00:00:00`) < now).length,
    movedToTomorrow: tasks.filter(t => t.status === 'moved_to_tomorrow').length,
  }), [tasks, activeTasks, today, now])

  const clientRequests = useMemo(
    () => tasks
      .filter(t => t.priority === 'client_request' && t.status !== 'done')
      .sort((a, b) => new Date(`${a.due_date}T00:00:00`).getTime() - new Date(`${b.due_date}T00:00:00`).getTime())
      .slice(0, 5),
    [tasks]
  )

  const workload = useMemo(() => {
    const staffMap = new Map<string, CommandCentreTask[]>()
    for (const t of activeTasks) {
      const name = t.assigned_to_name ?? 'Unassigned'
      if (!staffMap.has(name)) staffMap.set(name, [])
      staffMap.get(name)!.push(t)
    }

    const allStaff = new Set([...KNOWN_STAFF, 'Unassigned'])
    for (const name of staffMap.keys()) allStaff.add(name)

    const result: StaffWorkload[] = []
    for (const name of allStaff) {
      const staffTasks = staffMap.get(name) ?? []
      const doneToday = tasks.filter(
        t => t.assigned_to_name === name && t.status === 'done' && t.completed_at?.slice(0, 10) === today
      ).length
      const blocked = staffTasks.filter(t => t.status === 'blocked').length
      result.push({
        name,
        active: staffTasks.length,
        doneToday,
        blocked,
        previewTasks: staffTasks.slice(0, 2).map(t => ({
          title: t.title,
          client_name: t.client_name,
        })),
      })
    }

    result.sort((a, b) => {
      const ai = KNOWN_STAFF.indexOf(a.name)
      const bi = KNOWN_STAFF.indexOf(b.name)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      if (a.name === 'Unassigned') return 1
      if (b.name === 'Unassigned') return -1
      return a.name.localeCompare(b.name)
    })

    return result
  }, [activeTasks, tasks, today])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Today
            </h1>
            <p className="mt-1 text-sm text-white/45">
              {formatDateNice()}
            </p>
          </div>
          {profile && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-white">{profile.full_name ?? 'Staff'}</span>
              <span className="text-xs text-white/40">{profile.role === 'admin' ? 'Admin' : 'Staff'}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <PremiumCard padding="md">
            <p className="text-sm text-red-400">{error}</p>
          </PremiumCard>
        </div>
      )}

      {tableMissing ? (
        <>
          {/* Primary actions still visible when table is missing */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRIMARY_ACTIONS.map(action => (
              <PrimaryActionCard key={action.id} action={action} />
            ))}
          </div>

          <EmptyState
            title="Command Centre data is not available yet"
            message="Set up the Command Centre database."
          />
        </>
      ) : (
        <>
          {/* Quick add task */}
          <div className="mb-5">
            <QuickAddCard onTaskCreated={() => { setQuickAddMsg('Task added successfully.'); void load() }} />
          </div>
          {quickAddMsg && (
            <p className="mb-4 text-xs text-brand-accent">{quickAddMsg}</p>
          )}

          {/* Primary action cards */}
          <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {PRIMARY_ACTIONS.map(action => (
              <PrimaryActionCard key={action.id} action={action} />
            ))}
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Active tasks" value={stats.total} icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192" /></svg>
            } />
            <StatCard label="Client requests" value={stats.clientRequests} accent icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227" /></svg>
            } />
            <StatCard label="Done today" value={stats.doneToday} teal icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            } />
            <StatCard label="Blocked" value={stats.blocked} amber icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            } />
            <StatCard label="Overdue" value={stats.overdue} danger={stats.overdue > 0} icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            } />
            <StatCard label="Moved → tomorrow" value={stats.movedToTomorrow} icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v12m6-6H6" /></svg>
            } />
          </div>

          {/* Client request preview */}
          {clientRequests.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Open client requests</h2>
                <Link
                  to="/admin/command-centre"
                  className="text-xs text-white/45 hover:text-white transition-colors"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-1.5">
                {clientRequests.map(task => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{task.title}</span>
                        <Pill tone="accent">Client req</Pill>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-white/45">
                        {task.client_name && <span>{task.client_name}</span>}
                        {task.assigned_to_name && <span>· {task.assigned_to_name}</span>}
                        <span>· {formatDate(task.due_date)}</span>
                      </div>
                    </div>
                    <select
                      value={task.status}
                      onChange={e => handleClientRequestStatusChange(task.id, e.target.value as TaskStatus)}
                      disabled={busyId === task.id}
                      className="shrink-0 rounded-lg border border-brand-muted/60 bg-brand-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:opacity-60"
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff workload preview */}
          {workload.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-base font-bold text-white">Team</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {workload.map(staff => (
                  <div key={staff.name} className="rounded-lg bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white/75">
                        {staff.name === 'Unassigned' ? 'Unassigned' : `@${staff.name}`}
                      </h3>
                      <div className="flex items-center gap-2 text-xs">
                        {staff.active > 0 && (
                          <span className="text-white font-semibold">{staff.active}</span>
                        )}
                        {staff.doneToday > 0 && (
                            <span className="text-brand-accent">{staff.doneToday} done</span>
                        )}
                        {staff.blocked > 0 && (
                          <span className="text-amber-400">{staff.blocked} blocked</span>
                        )}
                        {staff.active === 0 && staff.doneToday === 0 && (
                          <span className="text-white/30">—</span>
                        )}
                      </div>
                    </div>
                    {staff.previewTasks.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {staff.previewTasks.map((t, i) => (
                          <p key={i} className="truncate text-xs text-white/45">
                            <Link to="/admin/command-centre" className="hover:text-white transition-colors">
                              {t.client_name ? `${t.client_name} — ` : ''}{t.title}
                            </Link>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}

function PrimaryActionCard({ action }: {
  action: typeof PRIMARY_ACTIONS[number]
}) {
  return (
    <Link
      to={action.to}
      className="group flex items-center gap-3 rounded-lg bg-white/[0.035] px-3 py-3 transition-all hover:bg-white/[0.06]"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-white/60 group-hover:text-brand-accent transition-colors">
        {action.icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white transition-colors">
          {action.title}
        </h2>
        <p className="mt-0.5 truncate text-xs text-white/40">
          {action.description}
        </p>
      </div>
    </Link>
  )
}

function QuickAddCard({ onTaskCreated }: {
  onTaskCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [manualClientName, setManualClientName] = useState('')
  const [assignedName, setAssignedName] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState(todayStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  useEffect(() => {
    let active = true
    listActiveClients().then(({ data }) => {
      if (!active) return
      setClients(data ?? [])
      setClientsLoading(false)
    }).catch(() => { if (active) setClientsLoading(false) })
    return () => { active = false }
  }, [])

  const isManual = clientId === '__manual__'
  const selectedClient = clients.find(c => c.id === clientId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const input: TaskInput = {
        title: title.trim(),
        client_id: selectedClient?.id ?? null,
        client_name: isManual ? manualClientName.trim() || null : selectedClient?.name ?? null,
        assigned_to_name: assignedName.trim() || null,
        bucket: 'Admin / To Do',
        priority,
        status: 'to_do',
        due_date: dueDate,
        source: 'manual',
      }
      const { error } = await createTask(input)
      if (error) {
        setError(error.message)
        return
      }
      setTitle('')
      setClientId('')
      setManualClientName('')
      setAssignedName('')
      setPriority('normal')
      setDueDate(todayStr())
      onTaskCreated()
    } catch {
      setError('Could not save task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.035] p-3">
      <h2 className="mb-3 text-sm font-semibold text-white">Quick Add</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:flex-wrap">
          <div className="min-w-0 flex-[2] sm:min-w-[200px]">
            <label className="mb-1 block text-[11px] font-medium text-white/45">Task</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <div className="flex-1 sm:min-w-0">
            <label className="mb-1 block text-[11px] font-medium text-white/45">Client</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            >
              <option value="">No client</option>
              {clientsLoading ? (
                <option disabled>Loading...</option>
              ) : (
                clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
              <option value="__manual__">Manual / other</option>
            </select>
          </div>
          {isManual && (
            <div className="flex-1 sm:min-w-0">
              <label className="mb-1 block text-[11px] font-medium text-white/45">Client name</label>
              <input
                value={manualClientName}
                onChange={e => setManualClientName(e.target.value)}
                placeholder="Type client name"
                className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[130px] flex-1 sm:flex-none">
            <label className="mb-1 block text-[11px] font-medium text-white/45">Staff</label>
            <select
              value={assignedName}
              onChange={e => setAssignedName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            >
              <option value="">Unassigned</option>
              {KNOWN_STAFF.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1 sm:flex-none">
            <label className="mb-1 block text-[11px] font-medium text-white/45">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p === 'client_request' ? 'Client request' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <label className="mb-1 block text-[11px] font-medium text-white/45">Due</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="mt-1 w-full rounded-lg bg-brand-accent px-5 py-2 text-sm font-semibold text-brand-bg hover:brightness-110 disabled:opacity-50 transition-all sm:w-auto"
          >
            {saving ? 'Adding...' : 'Add task'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </form>
    </div>
  )
}

function StatCard({ label, value, accent, teal, amber, danger, icon }: {
  label: string
  value: number
  accent?: boolean
  teal?: boolean
  amber?: boolean
  danger?: boolean
  icon?: ReactNode
}) {
  const valClass = danger
    ? 'text-red-400'
    : accent ? 'text-brand-accent'
    : teal ? 'text-[#2dd4bf]'
    : amber ? 'text-amber-400'
    : 'text-white'
  return (
    <div className="rounded-lg bg-white/[0.025] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p>
        {icon && <span className="text-white/25">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-xl font-semibold ${valClass}`}>{value}</p>
    </div>
  )
}
