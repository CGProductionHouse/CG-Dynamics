import type { PlannerTask } from './planner'

export const PLANNER_VIEWS = ['board', 'grid', 'calendar', 'charts'] as const
export type PlannerView = typeof PLANNER_VIEWS[number]
export function plannerView(value: string | null): PlannerView {
  return PLANNER_VIEWS.find(view => view === value) ?? 'board'
}
export function isPlannerMonth(value: string | null): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900
}
export function shiftPlannerMonth(month: string, amount: number): string {
  if (!isPlannerMonth(month) || !Number.isInteger(amount)) return month
  const [year, number] = month.split('-').map(Number)
  const ordinal = year * 12 + number - 1 + amount
  if (ordinal < 1900 * 12 || ordinal > 9999 * 12 + 11) return month
  return `${String(Math.floor(ordinal / 12)).padStart(4, '0')}-${String(ordinal % 12 + 1).padStart(2, '0')}`
}
function validDate(value: string | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}
export function plannerDateSpan(task: Pick<PlannerTask, 'start_date' | 'due_date'>):
  { kind: 'dated'; start: string; end: string } | { kind: 'unscheduled' | 'invalid' } {
  if (!task.start_date && !task.due_date) return { kind: 'unscheduled' }
  if ((task.start_date && !validDate(task.start_date)) || (task.due_date && !validDate(task.due_date))) return { kind: 'invalid' }
  const start = task.start_date || task.due_date!
  const end = task.due_date || task.start_date!
  return start > end ? { kind: 'invalid' } : { kind: 'dated', start, end }
}
export function plannerTasksOnDate(tasks: PlannerTask[], date: string): PlannerTask[] {
  return tasks.filter(task => { const span = plannerDateSpan(task); return span.kind === 'dated' && span.start <= date && span.end >= date })
}
export function plannerStatusCounts(tasks: PlannerTask[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>()
  for (const task of tasks) counts.set(task.status, (counts.get(task.status) ?? 0) + 1)
  return [...counts].map(([status, count]) => ({ status, count }))
}
