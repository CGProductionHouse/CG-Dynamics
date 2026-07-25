import { useEffect, useRef, useState } from 'react'
import type { CommandCentreTask, ClientOption, TaskInput } from '../../lib/commandCentre'
import { createTask, findDuplicateRequests } from '../../lib/commandCentre'
import { ActionButton } from '../ui/Buttons'

interface RequestIntakeProps {
  onCreated: (task: CommandCentreTask) => void
  clients?: ClientOption[]
  tasks?: CommandCentreTask[]
  staffProfiles?: { id: string; full_name: string | null }[]
  onClose: () => void
}

export function RequestIntake({ onCreated, clients, tasks, staffProfiles, onClose }: RequestIntakeProps) {
  const [message, setMessage] = useState('')
  const [clientId, setClientId] = useState('')
  const [contactName, setContactName] = useState('')
  const [source, setSource] = useState('whatsapp_paste')
  const [showMore, setShowMore] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [assigneeName, setAssigneeName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<CommandCentreTask[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  function reset() {
    setMessage('')
    setClientId('')
    setContactName('')
    setSource('whatsapp_paste')
    setShowMore(false)
    setAssigneeId('')
    setAssigneeName('')
    setDueDate('')
    setError(null)
    setDuplicateWarning([])
    setConfirmed(false)
  }

  function checkDuplicates(): CommandCentreTask[] {
    if (!clientId || !message.trim()) return []
    return findDuplicateRequests(tasks ?? [], clientId, message)
  }

  async function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed || adding) return

    const dups = checkDuplicates()
    if (dups.length > 0 && !confirmed) {
      setDuplicateWarning(dups)
      return
    }

    setAdding(true)
    setError(null)
    setDuplicateWarning([])

    const notes = contactName.trim() ? `From: ${contactName.trim()}\n---\n${trimmed}` : trimmed

    const input: TaskInput = {
      title: trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed,
      notes,
      source: source as TaskInput['source'],
      whatsapp_source_text: trimmed,
      priority: 'client_request',
      status: 'to_do',
      bucket: 'Client Requests',
    }

    if (clientId) {
      input.client_id = clientId
      const match = clients?.find(c => c.id === clientId)
      if (match) input.client_name = match.name
    }

    if (assigneeId && assigneeName) {
      input.assigned_to_user_id = assigneeId
      input.assigned_to_name = assigneeName
    }

    if (dueDate) {
      input.due_date = dueDate
    }

    const result = await createTask(input)
    setAdding(false)

    if (result.error) {
      setError(result.error.message || 'Failed to capture request.')
      return
    }

    if (result.data) {
      onCreated(result.data as CommandCentreTask)
    }
    reset()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void handleSubmit()
    }
    if (e.key === 'Escape' && !duplicateWarning.length) {
      reset()
      onClose()
    }
  }

  function handleClientSelect(val: string) {
    setClientId(val)
    setDuplicateWarning([])
    setConfirmed(false)
  }

  function handleAssigneeSelect(id: string) {
    setAssigneeId(id)
    if (!id) { setAssigneeName(''); return }
    const match = staffProfiles?.find(s => s.id === id)
    setAssigneeName(match?.full_name ?? '')
  }

  return (
    <div className="w-full" onKeyDown={handleKeyDown}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/60">Capture Client Request</p>
          <p className="text-[10px] text-white/30">Ctrl+Enter to save</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Client</label>
            <select
              value={clientId}
              onChange={e => handleClientSelect(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
            >
              <option value="">Select client…</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Contact name</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Optional sender name"
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-brand-teal/50"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Source</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
            >
              <option value="whatsapp_paste">WhatsApp</option>
              <option value="manual">Phone call</option>
              <option value="manual">Email</option>
              <option value="manual">Meeting</option>
              <option value="manual">Other</option>
            </select>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={e => { setMessage(e.target.value); setDuplicateWarning([]); setConfirmed(false) }}
          placeholder="Paste WhatsApp message or type client request here…"
          rows={5}
          className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-brand-teal/50 resize-y"
        />

        {error && (
          <p className="text-xs text-red-300">{error}</p>
        )}

        {duplicateWarning.length > 0 && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <p className="text-xs font-bold text-amber-200">Possible duplicate request</p>
            <p className="mt-1 text-xs text-amber-200/70">
              {duplicateWarning.length} similar request{duplicateWarning.length > 1 ? 's' : ''} found for this client in the last 48 hours:
            </p>
            <ul className="mt-1.5 space-y-1">
              {duplicateWarning.slice(0, 3).map(t => (
                <li key={t.id} className="text-[11px] text-white/50">
                  {t.created_at && <span className="text-white/30">{new Date(t.created_at).toLocaleDateString('en-GB')}: </span>}
                  {t.title}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <ActionButton size="sm" onClick={() => { setDuplicateWarning([]); setConfirmed(true); void handleSubmit() }} variant="outline">
                Create anyway
              </ActionButton>
              <ActionButton size="sm" onClick={() => { setDuplicateWarning([]); setConfirmed(false) }} variant="ghost">
                Review
              </ActionButton>
            </div>
          </div>
        )}

        {!showMore ? (
          <button
            onClick={() => setShowMore(true)}
            className="self-start text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60"
          >
            + More details
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ActionButton size="sm" onClick={() => void handleSubmit()} disabled={adding || !message.trim() || !clientId}>
          {adding ? 'Capturing…' : 'Capture Request'}
        </ActionButton>
        <button onClick={() => { reset(); onClose() }} className="text-xs text-white/40 hover:text-white">Cancel</button>
      </div>
    </div>
  )
}
