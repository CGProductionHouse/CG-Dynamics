import { taskStatusDisplayLabel, type CommandCentreTask } from './commandCentre'
import { nolanTaskOwnerLabel, nolanTaskOwnership } from './nolanOwnership'
import { isActiveWorkTask, isOperationallyCompletedStatus } from './taskLifecycle'

export const NOLAN_MASTER_PAGE_SIZE = 12
export const NOLAN_NOTE_PREVIEW_LIMIT = 600
export type NolanMasterLifecycle = 'active' | 'history' | 'all'

/** Totals describe only the authorized source snapshot, before UI filters. */
export function nolanMasterSummary(tasks: CommandCentreTask[], directory: Map<string, string> | null) {
  const active = tasks.filter(isActiveWorkTask)
  return {
    active: active.length,
    completed: tasks.filter(isOperationallyCompletedStatus).length,
    blocked: active.filter(task => task.status === 'blocked').length,
    waiting: active.filter(task => task.status === 'waiting_client').length,
    unassigned: directory ? active.filter(task => nolanTaskOwnership(task, directory)?.state === 'unassigned').length : null,
    ownershipUnknown: active.filter(task => !nolanTaskOwnership(task, directory)).length,
  }
}

/** Literal source excerpt, never a generated summary or next-action inference. */
export function nolanNotePreview(notes: string | null | undefined) {
  const source = notes ?? ''
  let text = source.slice(0, NOLAN_NOTE_PREVIEW_LIMIT)
  // Do not cut a UTF-16 surrogate pair in half.
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
  return { text, truncated: text.length < source.length }
}

/** Filter the complete authorized snapshot before paging; never search notes as instructions. */
export function nolanMasterPage(tasks: CommandCentreTask[], directory: Map<string, string> | null,
  filters: { query: string; status: string; ownership: string; lifecycle?: NolanMasterLifecycle }, requestedPage: number) {
  const query = filters.query.trim().toLowerCase()
  const matching = tasks.filter(task => {
    const lifecycle = filters.lifecycle ?? 'active'
    if (lifecycle === 'active' && !isActiveWorkTask(task)) return false
    if (lifecycle === 'history' && !isOperationallyCompletedStatus(task)) return false
    const owner = nolanTaskOwnerLabel(task, directory)
    const state = nolanTaskOwnership(task, directory)?.state ?? 'unknown'
    return [task.title, task.id, task.native_id, task.client_name, task.bucket, owner].join(' ').toLowerCase().includes(query)
      && (!filters.status || taskStatusDisplayLabel(task) === filters.status)
      && (!filters.ownership || state === filters.ownership)
  })
  const pages = Math.max(1, Math.ceil(matching.length / NOLAN_MASTER_PAGE_SIZE))
  const page = Math.max(0, Math.min(pages - 1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0))
  const start = page * NOLAN_MASTER_PAGE_SIZE
  return { rows: matching.slice(start, start + NOLAN_MASTER_PAGE_SIZE), total: matching.length, page, pages,
    from: matching.length ? start + 1 : 0, to: Math.min(start + NOLAN_MASTER_PAGE_SIZE, matching.length) }
}
