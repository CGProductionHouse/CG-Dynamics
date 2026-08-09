// Operational completion authority (#176)
//
// ONE shared answer to "is this operational task finished and excluded from
// active work?" Every active Work surface (board, My Work, Team Work, My Day,
// Planner buckets, Command Centre, CG Hub, counts, summaries, notifications
// and the CG Assistant active context) routes its completed-exclusion through
// these helpers instead of inventing per-page status rules.
//
// Domain separation on purpose:
//   - Operational completion = a task the worker genuinely marked finished.
//     In both sources the ONLY status that means that is 'done'.
//   - 'approved' / 'scheduled' are content scheduling states, NOT operational
//     completion. They are active work.
//   - 'moved_to_tomorrow' means "deferred until tomorrow", so it is still
//     active work; only the today-axis surfaces exclude it.
//   - 'blocked' / 'waiting_client' / 'ready_internal_review' are active.
//   - 'completed' is a legacy import alias for done and is treated as done.

export type WorkTaskLike = {
  status?: string | null
  data_origin?: string | null
  planner_status?: string | null
} | null | undefined
export type AssistantDayItemLifecycleLike = {
  state?: string | null
  planner_task_id?: string | null
  linked_planner_status?: string | null
  linked_planner_is_current?: boolean
}

export const OPERATIONAL_COMPLETED_STATUSES = ['done', 'completed'] as const
export const DEFERRED_TO_TOMORROW_STATUS = 'moved_to_tomorrow' as const

function statusOf(task: WorkTaskLike | string): string | null | undefined {
  if (task === null || task === undefined) return undefined
  return typeof task === 'string' ? task : task.status
}

export function isOperationallyCompletedStatus(task: WorkTaskLike | string): boolean {
  const status = statusOf(task)
  return status === 'done' || status === 'completed'
}

export function isActiveWorkTask(task: WorkTaskLike | string): boolean {
  return !isOperationallyCompletedStatus(task)
}

export function isDeferredToTomorrow(task: WorkTaskLike | string): boolean {
  return statusOf(task) === DEFERRED_TO_TOMORROW_STATUS
}

// Today-axis concept: unfinished work that belongs in the current day's queue
// (today focus, overdue, due-now). A deferred task stays unfinished and becomes
// an eligible surface item on ITS day, but never here. This is the ONLY helper
// that pulls deferral out of today surfaces — consumers with an actual
// "tomorrow/next day" axis apply `isDeferredToTomorrow(task)` positively.
export function isActiveForToday(task: WorkTaskLike | string): boolean {
  return isActiveWorkTask(task) && !isDeferredToTomorrow(task)
}

// Planner scheduling states use an active coarse projection, but reporting must
// still follow the raw source status so they never inflate In Progress counts.
export function isActuallyInProgressTask(task: WorkTaskLike | string): boolean {
  if (typeof task === 'string') return task === 'in_progress'
  if (!task) return false
  if (task.data_origin === 'planner_tasks') return task.planner_status === 'in_progress'
  return task.status === 'in_progress'
}

// Assistant item state remains its own user decision. Planner completion only
// derives whether an otherwise-open linked item should surface right now, so a
// task reopen makes it active again without rewriting assistant_day_items.
export function isActiveAssistantDayItem(item: AssistantDayItemLifecycleLike): boolean {
  if (item.state !== 'open') return false
  if (!item.planner_task_id) return true
  if (item.linked_planner_is_current !== true) return false
  return !isOperationallyCompletedStatus(item.linked_planner_status)
}

// `completed_at` is evidence, never the decision: a row reopens (done -> to_do)
// and immediately counts as active work again while keeping its history.
export function isCompletedTask(task: WorkTaskLike): boolean {
  return isOperationallyCompletedStatus(task)
}
