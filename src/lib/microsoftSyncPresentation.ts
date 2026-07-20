import type {
  MicrosoftConflictCode,
  MicrosoftImportPreviewItem,
  MicrosoftReconciliationAction,
} from './microsoftImport'

export type MicrosoftIncomingStatus =
  | 'to_do' | 'in_progress' | 'completed' | 'scheduled' | 'planned' | 'cancelled' | 'none'

export interface MicrosoftPreviewFilters {
  source: string
  action: MicrosoftReconciliationAction | 'all'
  status: MicrosoftIncomingStatus | 'all'
  conflict: MicrosoftConflictCode | 'uncoded' | 'all'
}

export interface MicrosoftConflictBreakdown {
  source: string
  code: MicrosoftConflictCode | 'uncoded'
  count: number
}

export function microsoftIncomingStatus(item: MicrosoftImportPreviewItem): MicrosoftIncomingStatus {
  const payload = item.proposedPayload
  if (!payload) return 'none'
  if (payload.destination === 'planner') {
    if (payload.status === 'approved' || payload.status === 'done') return 'completed'
    if (payload.status === 'scheduled') return 'scheduled'
    return payload.status === 'in_progress' ? 'in_progress' : 'to_do'
  }
  if (payload.destination === 'client_schedule') {
    if (payload.production_status === 'scheduled' || payload.production_status === 'posted' || payload.production_status === 'approved') return 'scheduled'
    return payload.production_status === 'in_progress' ? 'in_progress' : 'to_do'
  }
  return payload.status === 'cancelled' ? 'cancelled' : 'planned'
}

export function microsoftIncomingStatusLabel(status: MicrosoftIncomingStatus): string {
  const labels: Record<MicrosoftIncomingStatus, string> = {
    to_do: 'To do',
    in_progress: 'In progress',
    completed: 'Completed',
    scheduled: 'Scheduled',
    planned: 'Planned',
    cancelled: 'Cancelled',
    none: 'No incoming status',
  }
  return labels[status]
}

export function filterMicrosoftPreviewItems(
  items: MicrosoftImportPreviewItem[],
  filters: MicrosoftPreviewFilters,
): MicrosoftImportPreviewItem[] {
  return items.filter(item => {
    const action = item.reconciliationAction ?? 'skipped'
    const conflict = item.conflictCode ?? 'uncoded'
    return (filters.source === 'all' || item.sourceName === filters.source)
      && (filters.action === 'all' || action === filters.action)
      && (filters.status === 'all' || microsoftIncomingStatus(item) === filters.status)
      && (filters.conflict === 'all' || (action === 'conflict' && conflict === filters.conflict))
  })
}

export function buildMicrosoftConflictBreakdown(items: MicrosoftImportPreviewItem[]): MicrosoftConflictBreakdown[] {
  const counts = new Map<string, MicrosoftConflictBreakdown>()
  for (const item of items) {
    if (item.reconciliationAction !== 'conflict') continue
    const code = item.conflictCode ?? 'uncoded'
    const key = `${item.sourceName}\u0000${code}`
    const current = counts.get(key)
    if (current) current.count += 1
    else counts.set(key, { source: item.sourceName, code, count: 1 })
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.source.localeCompare(right.source) || left.code.localeCompare(right.code))
}

export function summarizeMicrosoftCreateStatuses(items: MicrosoftImportPreviewItem[]): Record<MicrosoftIncomingStatus, number> {
  const counts: Record<MicrosoftIncomingStatus, number> = { to_do: 0, in_progress: 0, completed: 0, scheduled: 0, planned: 0, cancelled: 0, none: 0 }
  for (const item of items) {
    if (item.reconciliationAction === 'create') counts[microsoftIncomingStatus(item)] += 1
  }
  return counts
}
