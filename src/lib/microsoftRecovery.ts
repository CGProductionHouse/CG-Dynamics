import type {
  MicrosoftImportPreviewItem,
  MicrosoftReconciliationAction,
} from './microsoftImport'
import { microsoftSourceIdentity } from './microsoftApply'

const EXECUTABLE_ACTIONS = new Set<MicrosoftReconciliationAction>([
  'create', 'link_existing', 'package_template_create', 'update', 'complete',
  'reopen', 'move', 'cancel', 'archive',
])

export interface MicrosoftReviewedItem {
  key: string
  sourceType: MicrosoftImportPreviewItem['sourceType']
  sourceContainerId: string
  sourceItemId: string
  sourceName: string
  title: string
  action: MicrosoftReconciliationAction
  removalApproved: boolean
}

export interface MicrosoftRecoveryAuditItem {
  key: string
  resultStatus: 'previewed' | 'applied' | 'skipped' | 'failed'
  safeError: string | null
}

export interface MicrosoftRecoveryBlockedItem {
  reviewed: MicrosoftReviewedItem
  current: MicrosoftImportPreviewItem | null
  reason: string
}

export interface MicrosoftRecoveryPlan {
  retryItems: MicrosoftImportPreviewItem[]
  previouslyApplied: MicrosoftReviewedItem[]
  blocked: MicrosoftRecoveryBlockedItem[]
  failedBeforeRetry: number
  notAttemptedBeforeRetry: number
}

export function microsoftStableItemKey(item: Pick<MicrosoftImportPreviewItem,
  'sourceType' | 'sourcePlanId' | 'sourceCalendarId' | 'sourceTaskId' | 'sourceEventId'>): string {
  const identity = microsoftSourceIdentity(item as MicrosoftImportPreviewItem)
  return `${identity.source_type}:${identity.source_container_id || 'missing'}:${identity.source_item_id || 'missing'}`
}

export function isMicrosoftExecutableItem(item: MicrosoftImportPreviewItem, approveRemovals: boolean): boolean {
  const action = item.reconciliationAction
  return Boolean(action && EXECUTABLE_ACTIONS.has(action) && (!item.requiresRemovalApproval || approveRemovals))
}

export function getMicrosoftExecutableItems(
  items: MicrosoftImportPreviewItem[],
  approveRemovals: boolean,
): MicrosoftImportPreviewItem[] {
  return items.filter(item => isMicrosoftExecutableItem(item, approveRemovals))
}

export function getMicrosoftReviewedItems(
  items: MicrosoftImportPreviewItem[],
  approveRemovals: boolean,
): MicrosoftReviewedItem[] {
  return getMicrosoftExecutableItems(items, approveRemovals).map(item => {
    const identity = microsoftSourceIdentity(item)
    return {
      key: microsoftStableItemKey(item),
      sourceType: item.sourceType,
      sourceContainerId: identity.source_container_id,
      sourceItemId: identity.source_item_id,
      sourceName: item.sourceName,
      title: item.title,
      action: item.reconciliationAction as MicrosoftReconciliationAction,
      removalApproved: Boolean(item.requiresRemovalApproval && approveRemovals),
    }
  })
}

export function buildMicrosoftRecoveryPlan(
  reviewedItems: MicrosoftReviewedItem[],
  currentItems: MicrosoftImportPreviewItem[],
  auditItems: MicrosoftRecoveryAuditItem[],
): MicrosoftRecoveryPlan {
  const currentByKey = new Map(currentItems.map(item => [microsoftStableItemKey(item), item]))
  const auditByKey = new Map(auditItems.map(item => [item.key, item]))
  const retryItems: MicrosoftImportPreviewItem[] = []
  const previouslyApplied: MicrosoftReviewedItem[] = []
  const blocked: MicrosoftRecoveryBlockedItem[] = []
  let failedBeforeRetry = 0
  let notAttemptedBeforeRetry = 0

  for (const reviewed of reviewedItems) {
    const audit = auditByKey.get(reviewed.key)
    const current = currentByKey.get(reviewed.key) ?? null
    if (audit?.resultStatus === 'failed') failedBeforeRetry += 1
    else if (!audit || audit.resultStatus === 'previewed') notAttemptedBeforeRetry += 1

    if (audit?.resultStatus === 'applied' || current?.reconciliationAction === 'unchanged') {
      previouslyApplied.push(reviewed)
      continue
    }
    if (!current) {
      blocked.push({ reviewed, current, reason: 'The item is missing from the preserved preview snapshot.' })
      continue
    }
    if (current.reconciliationAction === 'conflict') {
      blocked.push({
        reviewed,
        current,
        reason: current.conflictReason ?? 'The CG Dynamics destination changed after the reviewed preview.',
      })
      continue
    }
    if (current.reconciliationAction !== reviewed.action) {
      blocked.push({ reviewed, current, reason: `The action changed from ${reviewed.action} to ${current.reconciliationAction ?? 'none'} after review.` })
      continue
    }
    if (!isMicrosoftExecutableItem(current, reviewed.removalApproved)) {
      blocked.push({ reviewed, current, reason: 'The reviewed action is no longer safely executable.' })
      continue
    }
    retryItems.push(current)
  }

  return { retryItems, previouslyApplied, blocked, failedBeforeRetry, notAttemptedBeforeRetry }
}

export function microsoftSafeApplyError(error: string | null): string | null {
  if (!error) return null
  if (error.includes('Destination changed after preview')) {
    return 'The CG Dynamics record changed after review and was not overwritten.'
  }
  if (error.includes('planner_tasks_status_check')) {
    return 'The Planner completion status was rejected by the database status contract.'
  }
  if (error.includes('company_calendar_events_microsoft_source_key')) {
    return 'This Outlook event already exists in CG Calendar and was not duplicated.'
  }
  if (error.includes('planner_tasks_import_hash_key')) {
    return 'This Planner task already exists in CG Dynamics and was not duplicated.'
  }
  if (error.includes('monthly_deliverables_package_id_template_id_instance_number_key')) {
    return 'This Client Schedule slot already exists and was not duplicated.'
  }
  if (error.toLowerCase().includes('duplicate key value') || error.toLowerCase().includes('violates check constraint')) {
    return 'The action was rejected by a data-safety constraint and no duplicate was created.'
  }
  return error
}
