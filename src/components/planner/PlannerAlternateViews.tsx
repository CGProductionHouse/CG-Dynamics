import { PLANNER_TASK_STATUS_LABELS, type PlannerBucket, type PlannerTask, type PlannerTaskStatus } from '../../lib/planner'
import { businessDateKey, formatBusinessDate } from '../../lib/businessTime'
import { CALENDAR_HEADERS, monthGridCells } from '../../lib/scheduleCalendar'
import { isPlannerMonth, plannerDateSpan, plannerStatusCounts, plannerTasksOnDate, shiftPlannerMonth, type PlannerView } from '../../lib/plannerViews'

const taskButton = 'min-h-11 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-left text-sm text-white/85 transition hover:border-brand-teal/40 hover:bg-brand-teal/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal'
const statusLabel = (status: string) => PLANNER_TASK_STATUS_LABELS[status as PlannerTaskStatus] ?? 'Other status'
function dateLabel(value: string | null) {
  return value ? formatBusinessDate(`${value}T12:00:00+02:00`, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'
}

export function PlannerAlternateViews({ view, tasks, buckets, month, onMonthChange, onOpenTask }: {
  view: Exclude<PlannerView, 'board'>; tasks: PlannerTask[]; buckets: PlannerBucket[]; month: string
  onMonthChange: (month: string) => void; onOpenTask: (task: PlannerTask) => void
}) {
  if (view === 'grid') return <PlannerGrid tasks={tasks} buckets={buckets} onOpenTask={onOpenTask} />
  if (view === 'calendar') return <PlannerCalendar tasks={tasks} month={month} onMonthChange={onMonthChange} onOpenTask={onOpenTask} />
  return <PlannerCharts tasks={tasks} />
}

function PlannerGrid({ tasks, buckets, onOpenTask }: { tasks: PlannerTask[]; buckets: PlannerBucket[]; onOpenTask: (task: PlannerTask) => void }) {
  const bucketNames = new Map(buckets.map(bucket => [bucket.id, bucket.name]))
  return <section aria-label="Planner grid" className="max-w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-black/10">
    <table className="w-full min-w-[720px] text-left text-sm">
      <caption className="sr-only">The same filtered tasks as Board. Open a task to edit using its existing drawer.</caption>
      <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-white/45"><tr>{['Task', 'Bucket', 'People', 'Status', 'Priority', 'Start', 'Due'].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
      <tbody>{tasks.map(task => <tr key={task.id} className="border-b border-white/[0.05] last:border-0">
        <th scope="row" className="max-w-80 px-3 py-2 font-medium"><button type="button" className={`${taskButton} w-full`} onClick={() => onOpenTask(task)} aria-label={`Open task ${task.title}`}>{task.title}{task.client_name && <span className="mt-1 block text-xs text-white/40">{task.client_name}</span>}</button></th>
        <td className="px-3 py-2 text-white/55">{task.bucket_id ? bucketNames.get(task.bucket_id) ?? 'Bucket unavailable' : 'No bucket'}</td>
        <td className="px-3 py-2 text-white/55">{task.assignees.map(person => person.full_name).join(', ') || 'Unassigned'}{task.unresolved_assignee_names.length > 0 && <span className="block text-xs text-amber-200">Assignment review needed</span>}</td>
        <td className="px-3 py-2 text-white/65">{statusLabel(task.status)}</td><td className="px-3 py-2 capitalize text-white/55">{task.priority.replaceAll('_', ' ')}</td>
        <td className="px-3 py-2 text-white/55">{plannerDateSpan(task).kind === 'invalid' ? 'Date needs review' : dateLabel(task.start_date)}</td><td className="px-3 py-2 text-white/55">{plannerDateSpan(task).kind === 'invalid' ? 'Date needs review' : dateLabel(task.due_date)}</td>
      </tr>)}</tbody>
    </table>{tasks.length === 0 && <p className="p-6 text-sm text-white/45">No matching tasks.</p>}
  </section>
}

function PlannerCalendar({ tasks, month, onMonthChange, onOpenTask }: { tasks: PlannerTask[]; month: string; onMonthChange: (month: string) => void; onOpenTask: (task: PlannerTask) => void }) {
  const undated = tasks.filter(task => plannerDateSpan(task).kind !== 'dated')
  const cells = monthGridCells(month)
  const today = businessDateKey()
  return <section aria-label="Planner calendar" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-white/50">Task start and due dates · selected board · Johannesburg</p><div className="flex items-center gap-2">
      <button type="button" aria-label="Previous Planner month" className={taskButton} onClick={() => onMonthChange(shiftPlannerMonth(month, -1))}>‹</button>
      <label className="sr-only" htmlFor="planner-calendar-month">Planner month</label><input id="planner-calendar-month" aria-label="Planner month" type="month" min="1900-01" max="9999-12" value={month} onChange={event => { if (event.target.validity.valid && isPlannerMonth(event.target.value)) onMonthChange(event.target.value) }} className="min-h-11 rounded-lg border border-white/10 bg-[#111] px-3 text-white" />
      <button type="button" aria-label="Next Planner month" className={taskButton} onClick={() => onMonthChange(shiftPlannerMonth(month, 1))}>›</button>
    </div></div>
    <p className="text-xs text-white/40 sm:hidden">Swipe the calendar sideways to see the full week.</p>
    <div tabIndex={0} aria-label="Monthly task grid, scroll horizontally for all weekdays" className="max-w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"><div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b border-white/[0.08]">{CALENDAR_HEADERS.map(day => <div key={day} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-white/45">{day}</div>)}</div>
      <div className="grid grid-cols-7">{cells.map(cell => <div key={cell.iso} className={`min-h-44 border-b border-r border-white/[0.06] p-2 ${cell.outside ? 'bg-black/20' : ''}`}>
        <p className={`mb-2 w-fit rounded-full px-2 py-1 text-xs font-bold ${cell.iso === today ? 'bg-brand-teal text-black' : cell.outside ? 'text-white/25' : 'text-white/65'}`}><time dateTime={cell.iso}>{cell.day}</time></p>
        <div className="space-y-1.5">{plannerTasksOnDate(tasks, cell.iso).map(task => <button key={task.id} type="button" className={`${taskButton} w-full !px-2 !text-xs`} onClick={() => onOpenTask(task)} aria-label={`Open task ${task.title} on ${cell.iso}`}><span className="block break-words">{task.title}</span><span className="mt-1 block text-[10px] text-white/45">{statusLabel(task.status)}</span></button>)}</div>
      </div>)}</div>
    </div></div>
    <details className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><summary className="min-h-8 cursor-pointer text-sm text-white/65">Without a valid date ({undated.length})</summary><div className="mt-3 flex flex-wrap gap-2">{undated.map(task => <button key={task.id} type="button" className={taskButton} onClick={() => onOpenTask(task)}>{task.title}<span className="block text-xs text-white/40">{plannerDateSpan(task).kind === 'invalid' ? 'Date needs review' : 'Unscheduled'}</span></button>)}</div></details>
  </section>
}

function PlannerCharts({ tasks }: { tasks: PlannerTask[] }) {
  const counts = plannerStatusCounts(tasks)
  return <section aria-label="Planner charts" className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-brand-teal/[0.05] to-transparent p-5 sm:p-7">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal/70">Current filtered work</p><h2 className="mt-2 text-2xl font-black text-white">{tasks.length} task{tasks.length === 1 ? '' : 's'}</h2>
    {tasks.length === 0 ? <p className="mt-5 text-sm text-white/45">No matching tasks.</p> : <dl className="mt-6 grid gap-5 sm:grid-cols-2">{counts.map(({ status, count }) => <div key={status}><div className="mb-2 flex justify-between gap-3 text-sm"><dt className="text-white/65">{statusLabel(status)}</dt><dd className="font-bold text-white">{count}</dd></div><div className="h-2 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-brand-teal/65" style={{ width: `${count / tasks.length * 100}%` }} /></div></div>)}</dl>}
  </section>
}
