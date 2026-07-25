import { useEffect, useRef, useState } from 'react'
import type { CommandCentreTask, ClientOption, TaskBucket, TaskPriority, TaskInput } from '../../lib/commandCentre'
import { BUCKETS, createTask, PRIORITIES } from '../../lib/commandCentre'
import { ActionButton } from '../ui/Buttons'

interface OpsQuickAddProps {
  onCreated: (task: CommandCentreTask) => void
  clients?: ClientOption[]
  staffProfiles?: { id: string; full_name: string | null }[]
  defaultBucket?: TaskBucket
  onClose: () => void
}

export function OpsQuickAdd({ onCreated, clients, staffProfiles, defaultBucket, onClose }: OpsQuickAddProps) {
  const [title, setTitle] = useState('')
  const [bucket, setBucket] = useState<TaskBucket>(defaultBucket ?? 'Once-off')
  const [assigneeId, setAssigneeId] = useState('')
  const [assigneeName, setAssigneeName] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function reset() {
    setTitle('')
    setBucket(defaultBucket ?? 'Once-off')
    setAssigneeId('')
    setAssigneeName('')
    setClientId('')
    setClientName('')
    setPriority('normal')
    setDueDate('')
    setShowMore(false)
    setError(null)
  }

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed || adding) return
    setAdding(true)
    setError(null)

    const input: TaskInput = {
      title: trimmed,
      bucket,
      priority,
      status: 'to_do',
      source: 'manual',
    }

    if (clientId && clientName) {
      input.client_id = clientId
      input.client_name = clientName
    } else if (clientName) {
      input.client_name = clientName
    }

    if (assigneeId && assigneeName) {
      input.assigned_to_user_id = assigneeId
      input.assigned_to_name = assigneeName
    } else if (assigneeName) {
      input.assigned_to_name = assigneeName
    }

    if (dueDate) {
      input.due_date = dueDate
    }

    const result = await createTask(input)
    setAdding(false)

    if (result.error) {
      setError(result.error.message || 'Failed to create task.')
      return
    }

    if (result.data) {
      onCreated(result.data as CommandCentreTask)
    }
    reset()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
    if (e.key === 'Escape') {
      reset()
      onClose()
    }
  }

  function handleClientSelect(clientVal: string) {
    setClientId(clientVal)
    if (!clientVal) { setClientName(''); return }
    const match = clients?.find(c => c.id === clientVal)
    setClientName(match?.name ?? '')
  }

  function handleAssigneeSelect(id: string) {
    setAssigneeId(id)
    if (!id) { setAssigneeName(''); return }
    const match = staffProfiles?.find(s => s.id === id)
    setAssigneeName(match?.full_name ?? '')
  }

  return (
    <div className="w-full" onKeyDown={handleKeyDown}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title…"
            className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-brand-teal/50"
          />
          {error && (
            <p className="mt-1 text-xs text-red-300">{error}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionButton size="sm" onClick={() => void handleSubmit()} disabled={adding || !title.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </ActionButton>
          <button onClick={() => { reset(); onClose() }} className="text-xs text-white/40 hover:text-white">Cancel</button>
        </div>
      </div>

      {!showMore ? (
        <button
          onClick={() => setShowMore(true)}
          className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60"
        >
          + More details
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Bucket</label>
            <select
              value={bucket}
              onChange={e => setBucket(e.target.value as TaskBucket)}
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
            >
              {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Client</label>
            <select
              value={clientId}
              onChange={e => handleClientSelect(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
            >
              <option value="">None</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Assignee</label>
            <select
              value={assigneeId}
              onChange={e => handleAssigneeSelect(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
            >
              <option value="">Unassigned</option>
              {staffProfiles?.map(s => <option key={s.id} value={s.id}>{s.full_name ?? 'Unknown'}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Due</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
              />
            </div>
            <div className="w-20">
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
