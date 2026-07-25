import { useCallback, useEffect, useState } from 'react'
import type { CommandCentreTask, ClientOption, TaskBucket, TaskPriority, TaskStatus, TaskUpdateFields } from '../../lib/commandCentre'
import { BUCKETS, PRIORITIES, STATUSES, updateTask } from '../../lib/commandCentre'
import { ActionButton } from '../ui/Buttons'

interface TaskDetailDrawerProps {
  task: CommandCentreTask | null
  onClose: () => void
  onSaved: (updated: CommandCentreTask) => void
  clients?: ClientOption[]
  staffProfiles?: { id: string; full_name: string | null }[]
}

interface DraftState {
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  bucket: TaskBucket
  clientId: string
  clientName: string
  assigneeId: string
  assigneeName: string
  dueDate: string
}

const EMPTY_DRAFT: DraftState = {
  title: '', notes: '', status: 'to_do', priority: 'normal',
  bucket: 'Once-off', clientId: '', clientName: '',
  assigneeId: '', assigneeName: '', dueDate: '',
}

function taskToDraft(task: CommandCentreTask): DraftState {
  return {
    title: task.title,
    notes: task.notes ?? '',
    status: task.status,
    priority: task.priority,
    bucket: task.bucket,
    clientId: task.client_id ?? '',
    clientName: task.client_name ?? '',
    assigneeId: task.assigned_to_user_id ?? '',
    assigneeName: task.assigned_to_name ?? '',
    dueDate: task.due_date || '',
  }
}

function isDirtyAgainstTask(draft: DraftState, task: CommandCentreTask): boolean {
  return (
    draft.title !== task.title ||
    (draft.notes || '') !== (task.notes || '') ||
    draft.status !== task.status ||
    draft.priority !== task.priority ||
    draft.bucket !== task.bucket ||
    (draft.clientId || null) !== task.client_id ||
    (draft.clientName || null) !== task.client_name ||
    (draft.assigneeId || null) !== task.assigned_to_user_id ||
    (draft.assigneeName || null) !== task.assigned_to_name ||
    (draft.dueDate || '') !== (task.due_date || '')
  )
}

export function TaskDetailDrawer({ task, onClose, onSaved, clients, staffProfiles }: TaskDetailDrawerProps) {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showMobile, setShowMobile] = useState(true)

  const taskId = task?.id ?? null
  useEffect(() => {
    if (task) {
      setDraft(taskToDraft(task))
      setError(null)
      setShowCloseConfirm(false)
      setShowMobile(true)
    }
  }, [taskId])

  const dirty = task ? isDirtyAgainstTask(draft, task) : false

  function updateField<K extends keyof DraftState>(field: K, value: DraftState[K]) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  function handleClientSelect(clientVal: string) {
    if (!clientVal) {
      updateField('clientId', '')
      updateField('clientName', '')
      return
    }
    updateField('clientId', clientVal)
    const match = clients?.find(c => c.id === clientVal)
    updateField('clientName', match?.name ?? '')
  }

  function handleAssigneeSelect(id: string) {
    if (!id) {
      updateField('assigneeId', '')
      updateField('assigneeName', '')
      return
    }
    updateField('assigneeId', id)
    const match = staffProfiles?.find(s => s.id === id)
    updateField('assigneeName', match?.full_name ?? '')
  }

  const handleSave = useCallback(async () => {
    if (!task || saving) return
    setSaving(true)
    setError(null)

    const patch: Partial<TaskUpdateFields> = {}
    if (draft.title !== task.title) patch.title = draft.title
    if ((draft.notes || '') !== (task.notes || '')) patch.notes = draft.notes || null

    const newClientId = draft.clientId || null
    const newClientName = draft.clientName || null
    if (newClientId !== task.client_id || newClientName !== task.client_name) {
      patch.client_id = newClientId
      patch.client_name = newClientName
    }

    const newAssigneeId = draft.assigneeId || null
    const newAssigneeName = draft.assigneeName || null
    if (newAssigneeId !== task.assigned_to_user_id || newAssigneeName !== task.assigned_to_name) {
      patch.assigned_to_user_id = newAssigneeId
      patch.assigned_to_name = newAssigneeName
    }

    if (draft.bucket !== task.bucket) patch.bucket = draft.bucket
    if (draft.priority !== task.priority) patch.priority = draft.priority
    if (draft.status !== task.status) patch.status = draft.status
    if ((draft.dueDate || '') !== (task.due_date || '')) {
      patch.due_date = draft.dueDate || undefined
    }

    if (Object.keys(patch).length === 0) {
      setSaving(false)
      return
    }

    const result = await updateTask(task.id, patch)
    setSaving(false)

    if (result.error) {
      setError(result.error.message || 'Failed to save task.')
      return
    }

    if (result.data) {
      onSaved(result.data as CommandCentreTask)
    }
  }, [draft, task, saving, onSaved])

  function handleCancel() {
    if (task) {
      setDraft(taskToDraft(task))
    }
  }

  function handleCloseRequest() {
    if (dirty) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !dirty) {
      onClose()
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showCloseConfirm) {
        handleCloseRequest()
      }
    }
    if (task) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [task, dirty, showCloseConfirm])

  if (!task) return null

  const statusOptions = STATUSES.filter(s => s !== 'moved_to_tomorrow')

  return (
    <>
      <div
        onClick={handleOverlayClick}
        className="fixed inset-0 z-40 bg-black/50 md:bg-black/40"
      />

      <div
        className={`fixed z-50 flex flex-col bg-brand-surface border-l border-white/10 shadow-2xl transition-transform ${
          showMobile
            ? 'inset-x-0 bottom-0 top-16 md:top-0 md:left-auto md:right-0 md:w-[480px] md:max-w-[90vw]'
            : 'hidden md:block md:top-0 md:right-0 md:w-[480px] md:max-w-[90vw] md:h-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">Task Detail</p>
          <div className="flex items-center gap-2">
            {showCloseConfirm ? null : (
              <button
                onClick={handleCloseRequest}
                className="rounded-md px-2 py-1 text-xs text-brand-primary hover:text-white"
              >
                {dirty ? 'Close (unsaved)' : 'Close'}
              </button>
            )}
          </div>
        </header>

        {showCloseConfirm && (
          <div className="mx-5 mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <p className="text-xs font-bold text-amber-200">Unsaved changes</p>
            <p className="mt-1 text-xs text-amber-200/70">You have unsaved changes. What would you like to do?</p>
            <div className="mt-3 flex gap-2">
              <ActionButton size="sm" onClick={() => { setShowCloseConfirm(false) }} variant="outline">Keep editing</ActionButton>
              <ActionButton size="sm" onClick={() => { handleCancel(); onClose() }} variant="ghost">Discard</ActionButton>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Title</label>
              <input
                value={draft.title}
                onChange={e => updateField('title', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50"
              />
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Notes</label>
              <textarea
                value={draft.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50 resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Status</label>
                <select
                  value={draft.status}
                  onChange={e => updateField('status', e.target.value as TaskStatus)}
                  className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
                >
                  {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Priority</label>
                <select
                  value={draft.priority}
                  onChange={e => updateField('priority', e.target.value as TaskPriority)}
                  className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Bucket</label>
              <select
                value={draft.bucket}
                onChange={e => updateField('bucket', e.target.value as TaskBucket)}
                className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
              >
                {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Client</label>
                <select
                  value={draft.clientId}
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
                  value={draft.assigneeId}
                  onChange={e => handleAssigneeSelect(e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
                >
                  <option value="">Unassigned</option>
                  {staffProfiles?.map(s => <option key={s.id} value={s.id}>{s.full_name ?? 'Unknown'}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Due Date</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={e => updateField('dueDate', e.target.value)}
                className="w-full rounded border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-teal/50"
              />
            </div>

            <hr className="border-white/10" />

            <div className="space-y-1.5 text-[11px] text-white/40">
              <p>Source: {task.source}</p>
              {task.created_at && <p>Created: {new Date(task.created_at).toLocaleDateString('en-GB')}</p>}
              {task.updated_at && <p>Updated: {new Date(task.updated_at).toLocaleDateString('en-GB')}</p>}
              {task.deliverable_id && <p>Linked deliverable ID: {task.deliverable_id}</p>}
              {task.helper_names && task.helper_names.length > 0 && (
                <p>Helpers: {task.helper_names.join(', ')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          {error && (
            <p className="mb-2 text-xs text-red-300">{error}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <ActionButton size="sm" variant="ghost" onClick={handleCancel} disabled={!dirty}>
              Cancel changes
            </ActionButton>
            <ActionButton size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </ActionButton>
          </div>
        </div>
      </div>
    </>
  )
}
