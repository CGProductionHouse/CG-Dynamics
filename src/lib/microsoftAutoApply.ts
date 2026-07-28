import type { MicrosoftConflictCode, MicrosoftImportPreviewItem, MicrosoftReconciliationAction } from './microsoftImport.ts'

export type MicrosoftAutoApplySafetyClass =
  | 'no_change'
  | 'safe_create'
  | 'safe_link_existing'
  | 'safe_microsoft_update'
  | 'safe_status_transition'
  | 'blocked_conflict'
  | 'blocked_incomplete_source'
  | 'blocked_identity'
  | 'blocked_removal'
  | 'blocked_business_decision'

export interface MicrosoftAutoApplyDecision {
  autoApply: boolean
  safetyClass: MicrosoftAutoApplySafetyClass
  conflictCode: MicrosoftConflictCode | null
  reason: string | null
}

const SAFE_EXISTING_ACTIONS = new Set<MicrosoftReconciliationAction>([
  'update', 'complete', 'reopen', 'move',
])

function assignmentsAreResolved(item: MicrosoftImportPreviewItem): boolean {
  if (item.assigneeMicrosoftIds.length === 0) return true
  const resolutions = item.resolvedAssignees ?? []
  return resolutions.length === item.assigneeMicrosoftIds.length
    && resolutions.every(resolution => resolution.resolved && Boolean(resolution.cgProfileId))
}

function createPayloadIsComplete(item: MicrosoftImportPreviewItem): boolean {
  const payload = item.proposedPayload
  if (!payload) return false
  if (payload.destination === 'planner') {
    return Boolean(payload.board_id && payload.bucket_id && payload.microsoft_plan_id && payload.microsoft_task_id)
  }
  if (payload.destination === 'client_schedule') {
    return Boolean(payload.client_id && payload.package_id && payload.template_id && payload.month
      && payload.code && payload.instance_number && payload.deliverable_type
      && payload.microsoft_plan_id && payload.microsoft_task_id)
  }
  return Boolean(payload.start_at && payload.microsoft_calendar_id && payload.microsoft_event_id)
    && payload.status !== 'cancelled'
}

export function classifyMicrosoftAutoApply(item: MicrosoftImportPreviewItem): MicrosoftAutoApplyDecision {
  const action = item.reconciliationAction ?? 'skipped'
  if (!item.sourceComplete) {
    return { autoApply: false, safetyClass: 'blocked_incomplete_source', conflictCode: item.conflictCode, reason: 'The required Microsoft source is incomplete.' }
  }
  if (item.requiresRemovalApproval) {
    return { autoApply: false, safetyClass: 'blocked_removal', conflictCode: item.conflictCode, reason: 'Source removals are never applied automatically.' }
  }
  if (item.previewStatus === 'conflict' || action === 'conflict' || item.conflictCode) {
    return { autoApply: false, safetyClass: 'blocked_conflict', conflictCode: item.conflictCode, reason: item.conflictReason ?? 'A real reconciliation decision is required.' }
  }
  if (!assignmentsAreResolved(item)) {
    return { autoApply: false, safetyClass: 'blocked_identity', conflictCode: 'unresolved_assignee', reason: 'A Microsoft assignee is not mapped to one CG staff profile.' }
  }
  if (action === 'unchanged') {
    return { autoApply: false, safetyClass: 'no_change', conflictCode: null, reason: null }
  }
  if (action === 'create') {
    return createPayloadIsComplete(item)
      ? { autoApply: true, safetyClass: 'safe_create', conflictCode: null, reason: null }
      : { autoApply: false, safetyClass: 'blocked_business_decision', conflictCode: item.destination === 'client_schedule' ? 'missing_template' : null, reason: 'The destination mapping is not complete.' }
  }
  if (action === 'link_existing') {
    const safe = Boolean(item.existingTargetId && item.expectedTargetUpdatedAt && item.proposedPayload?.destination === 'client_schedule')
    return safe
      ? { autoApply: true, safetyClass: 'safe_link_existing', conflictCode: null, reason: null }
      : { autoApply: false, safetyClass: 'blocked_business_decision', conflictCode: 'existing_deliverable_slot', reason: 'The existing deliverable link is not deterministic.' }
  }
  if (SAFE_EXISTING_ACTIONS.has(action)) {
    const safe = Boolean(item.existingTargetId && item.expectedTargetUpdatedAt && item.sourceHash && item.proposedPayload)
    return safe
      ? { autoApply: true, safetyClass: action === 'update' ? 'safe_microsoft_update' : 'safe_status_transition', conflictCode: null, reason: null }
      : { autoApply: false, safetyClass: 'blocked_business_decision', conflictCode: 'existing_row_changed', reason: 'The saved Microsoft baseline or concurrency check is missing.' }
  }
  return { autoApply: false, safetyClass: 'blocked_business_decision', conflictCode: item.conflictCode, reason: 'This action requires an explicit business decision.' }
}
