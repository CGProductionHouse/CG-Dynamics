import { useCallback } from 'react'
import type { CommandCentreTask, TaskStatus } from '../../lib/commandCentre'
import { businessDateKey } from '../../lib/businessTime'

interface TaskCardProps {
  task: CommandCentreTask
  onStatusChange: (task: CommandCentreTask, status: TaskStatus) => void
  onOpen: (task: CommandCentreTask) => void
  compact?: boolean
}

export function TaskCard({ task, onStatusChange, onOpen, compact }: TaskCardProps) {
  const handleCheckbox = useCallback((e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    onStatusChange(task, task.status === 'done' ? 'to_do' : 'done')
  }, [task, onStatusChange])

  const handleStatusChangeInner = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    onStatusChange(task, e.target.value as TaskStatus)
  }, [task, onStatusChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(task)
    }
  }, [task, onOpen])

  const isOverdue = task.due_date && task.due_date < businessDateKey(new Date()) && task.status !== 'done'

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open task: ${task.title}`}
        onClick={() => onOpen(task)}
        onKeyDown={handleKeyDown}
        className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-colors hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
      >
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
          {task.due_date && <span className={isOverdue ? 'text-red-300' : ''}>{task.due_date}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 transition-colors hover:border-white/20">
      <label className="flex cursor-pointer items-center" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={handleCheckbox}
          className="h-4 w-4 rounded border-white/20 bg-transparent accent-brand-teal"
        />
      </label>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open task: ${task.title}`}
        onClick={() => onOpen(task)}
        onKeyDown={handleKeyDown}
        className="min-w-0 flex-1 cursor-pointer outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-inset"
      >
        <p className={`text-sm ${task.status === 'done' ? 'text-white/30 line-through' : 'text-white'}`}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap gap-2">
          {task.client_name && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal/60">{task.client_name}</span>}
          {task.bucket && <span className="text-[10px] uppercase tracking-wider text-white/35">{task.bucket}</span>}
          {task.due_date && (
            <span className={`text-[10px] uppercase tracking-wider ${isOverdue ? 'text-red-300' : 'text-white/35'}`}>
              Due {task.due_date}
            </span>
          )}
          {task.source && task.source !== 'manual' && (
            <span className="text-[10px] uppercase tracking-wider text-amber-200/50">{task.source}</span>
          )}
        </div>
      </div>
      <div onClick={e => e.stopPropagation()}>
        <select
          value={task.status}
          onChange={handleStatusChangeInner}
          className="w-28 rounded border border-white/10 bg-[#111] px-2 py-1 text-[10px] text-white/70 outline-none focus:border-brand-teal/50"
        >
          <option value="to_do">To do</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_client">Waiting</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
      </div>
    </div>
  )
}
