import type {
  MicrosoftExistingTarget,
  MicrosoftImportPreviewItem,
  MicrosoftProposedPayload,
  MicrosoftReconciliationAction,
} from './microsoftImport'
import {
  buildMicrosoftImportPreview,
  deliverableSlotKey,
  flagDeliverableSlotConflicts,
  type MicrosoftPreviewMappingContext,
} from './microsoftImportPreview'
import { microsoftOutlookSourceKey, microsoftPlannerSourceKey } from './microsoftImportMap'
import type { MicrosoftSnapshot, MicrosoftSnapshotSource } from './microsoftSnapshot'

function stableHash(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function normalizedIso(value: string | null): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time).toISOString()
}

function ownedPayload(payload: MicrosoftProposedPayload): object | null {
  if (!payload) return null
  if (payload.destination === 'planner') {
    return {
      board_id: payload.board_id,
      bucket_id: payload.bucket_id,
      title: payload.title,
      status: payload.status,
      start_date: payload.start_date,
      due_date: payload.due_date,
      original_plan_name: payload.original_plan_name,
      original_bucket_name: payload.original_bucket_name,
      microsoft_source_description: payload.microsoft_source_description,
    }
  }
  if (payload.destination === 'client_schedule') {
    return {
      client_id: payload.client_id,
      package_id: payload.package_id,
      template_id: payload.template_id,
      month: payload.month,
      code: payload.code,
      instance_number: payload.instance_number,
      deliverable_type: payload.deliverable_type,
      title: payload.title,
      production_status: payload.production_status,
      scheduled_date: payload.scheduled_date,
      microsoft_source_description: payload.microsoft_source_description,
    }
  }
  return {
    title: payload.title,
    event_type: payload.event_type,
    start_at: normalizedIso(payload.start_at),
    end_at: normalizedIso(payload.end_at),
    all_day: payload.all_day,
    location: payload.location,
    cancelled: payload.status === 'cancelled',
    microsoft_source_description: payload.microsoft_source_description,
  }
}

function ownedTarget(target: MicrosoftExistingTarget): object {
  if (target.destination === 'planner') {
    return {
      board_id: target.payload.board_id,
      bucket_id: target.payload.bucket_id,
      title: target.payload.title,
      status: target.payload.status,
      start_date: target.payload.start_date,
      due_date: target.payload.due_date,
      original_plan_name: target.payload.original_plan_name,
      original_bucket_name: target.payload.original_bucket_name,
      microsoft_source_description: target.payload.microsoft_source_description,
    }
  }
  if (target.destination === 'client_schedule') {
    return {
      client_id: target.payload.client_id,
      package_id: target.payload.package_id,
      template_id: target.payload.template_id,
      month: target.payload.month,
      code: target.payload.code,
      instance_number: target.payload.instance_number,
      deliverable_type: target.payload.deliverable_type,
      title: target.payload.title,
      production_status: target.payload.production_status,
      scheduled_date: target.payload.scheduled_date,
      microsoft_source_description: target.payload.microsoft_source_description,
    }
  }
  return {
    title: target.payload.title,
    event_type: target.payload.event_type,
    start_at: normalizedIso(target.payload.start_at),
    end_at: normalizedIso(target.payload.end_at),
    all_day: target.payload.all_day,
    location: target.payload.location,
    cancelled: target.payload.status === 'cancelled',
    microsoft_source_description: target.payload.microsoft_source_description,
  }
}

function itemKey(item: MicrosoftImportPreviewItem): string | null {
  if (item.sourceType === 'outlook_event') {
    const key = microsoftOutlookSourceKey(item.sourceCalendarId ?? '', item.sourceEventId ?? '')
    return key ? `outlook:${key}` : null
  }
  const key = microsoftPlannerSourceKey(item.sourcePlanId ?? '', item.sourceTaskId ?? '')
  return key ? `planner:${key}` : null
}

function targetKey(target: MicrosoftExistingTarget): string | null {
  if (target.destination === 'cg_calendar') {
    const key = microsoftOutlookSourceKey(target.microsoftCalendarId, target.microsoftEventId)
    return key ? `outlook:${key}` : null
  }
  const key = microsoftPlannerSourceKey(target.microsoftPlanId, target.microsoftTaskId)
  return key ? `planner:${key}` : null
}

function sourceForItem(item: MicrosoftImportPreviewItem, sources: MicrosoftSnapshotSource[]): MicrosoftSnapshotSource | null {
  return sources.find(source => source.sourceId === (item.sourceCalendarId ?? item.sourcePlanId)
    && source.sourceType === (item.sourceType === 'outlook_event' ? 'outlook_calendar' : 'planner_plan')) ?? null
}

function sourceActuallyComplete(source: MicrosoftSnapshotSource | null, items: MicrosoftImportPreviewItem[]): boolean {
  if (!source?.complete) return false
  const sourceItems = items.filter(item => sourceForItem(item, [source]) !== null)
  const keys = sourceItems.map(itemKey)
  return sourceItems.length === source.recordCount
    && keys.every((key): key is string => Boolean(key))
    && new Set(keys).size === keys.length
}

function isCompleteStatus(target: MicrosoftExistingTarget): boolean {
  if (target.destination === 'planner') return ['approved', 'done', 'scheduled'].includes(target.payload.status)
  if (target.destination === 'client_schedule') return ['scheduled', 'posted', 'approved'].includes(target.payload.production_status)
  return target.payload.status === 'cancelled'
}

function proposedIsComplete(item: MicrosoftImportPreviewItem): boolean {
  const payload = item.proposedPayload
  if (!payload) return false
  if (payload.destination === 'planner') return ['approved', 'done', 'scheduled'].includes(payload.status)
  if (payload.destination === 'client_schedule') return ['scheduled', 'posted', 'approved'].includes(payload.production_status)
  return payload.status === 'cancelled'
}

function changedAction(item: MicrosoftImportPreviewItem, target: MicrosoftExistingTarget): MicrosoftReconciliationAction {
  if (target.microsoftSourceRemovedAt) return 'reopen'
  const nextComplete = proposedIsComplete(item)
  const wasComplete = isCompleteStatus(target)
  if (!wasComplete && nextComplete) return target.destination === 'cg_calendar' ? 'cancel' : 'complete'
  if (wasComplete && !nextComplete) return 'reopen'
  if (target.destination === 'planner' && item.proposedPayload?.destination === 'planner'
    && (target.payload.board_id !== item.proposedPayload.board_id || target.payload.bucket_id !== item.proposedPayload.bucket_id)) return 'move'
  if (target.destination === 'client_schedule' && item.proposedPayload?.destination === 'client_schedule'
    && (target.payload.client_id !== item.proposedPayload.client_id
      || target.payload.package_id !== item.proposedPayload.package_id
      || target.payload.template_id !== item.proposedPayload.template_id
      || target.payload.month !== item.proposedPayload.month)) return 'move'
  return 'update'
}

function sourceCoversTarget(source: MicrosoftSnapshotSource, target: MicrosoftExistingTarget): boolean {
  if (!source.complete) return false
  if (target.destination !== 'cg_calendar') return source.sourceType === 'planner_plan' && source.sourceId === target.microsoftPlanId
  if (source.sourceType !== 'outlook_calendar' || source.sourceId !== target.microsoftCalendarId) return false
  const start = Date.parse(target.payload.start_at)
  if (source.rangeStart && start < Date.parse(source.rangeStart)) return false
  if (source.rangeEnd && start >= Date.parse(source.rangeEnd)) return false
  return true
}

function removedItem(target: MicrosoftExistingTarget, source: MicrosoftSnapshotSource): MicrosoftImportPreviewItem {
  const calendar = target.destination === 'cg_calendar'
  return {
    sourceType: calendar ? 'outlook_event' : target.destination === 'client_schedule' ? 'planner_client_social' : 'planner_task',
    sourcePlanId: calendar ? null : target.microsoftPlanId,
    sourceCalendarId: calendar ? target.microsoftCalendarId : null,
    sourceBucketId: null,
    sourceTaskId: calendar ? null : target.microsoftTaskId,
    sourceEventId: calendar ? target.microsoftEventId : null,
    sourceName: source.sourceName,
    title: target.payload.title,
    description: null,
    startDate: calendar ? target.payload.start_at : null,
    endDate: calendar ? target.payload.end_at : null,
    dueDate: null,
    assigneeMicrosoftIds: [],
    destination: target.destination,
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: target.id,
    previewStatus: 'changed',
    conflictCode: null,
    conflictReason: null,
    warnings: ['Missing from a complete successful Microsoft source fetch.'],
    proposedPayload: null,
    reconciliationAction: calendar ? 'cancel' : 'archive',
    expectedTargetUpdatedAt: target.updatedAt,
    sourceHash: target.microsoftSourceHash,
    sourceComplete: true,
    requiresRemovalApproval: true,
  }
}

export function buildMicrosoftReconciliation(
  snapshot: MicrosoftSnapshot,
  context: MicrosoftPreviewMappingContext,
  existingTargets: MicrosoftExistingTarget[],
  deliverableSlotKeys: Set<string>,
): MicrosoftImportPreviewItem[] {
  const mapped = buildMicrosoftImportPreview(snapshot.records, context)
  const targetsByKey = new Map<string, MicrosoftExistingTarget[]>()
  for (const target of existingTargets) {
    const key = targetKey(target)
    if (!key) continue
    targetsByKey.set(key, [...(targetsByKey.get(key) ?? []), target])
  }
  const seen = new Set<string>()

  const reconciled: MicrosoftImportPreviewItem[] = mapped.map(item => {
    const source = sourceForItem(item, snapshot.sources)
    const sourceComplete = sourceActuallyComplete(source, mapped)
    const key = itemKey(item)
    if (key) seen.add(key)
    if (item.previewStatus === 'conflict') return { ...item, reconciliationAction: 'conflict' as const, sourceComplete }
    if (item.previewStatus === 'skipped') return { ...item, reconciliationAction: 'skipped' as const, sourceComplete }
    if (!key) return { ...item, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, sourceComplete }
    const targets = targetsByKey.get(key) ?? []
    if (targets.length === 0) {
      if (item.destination === 'planner' && item.proposedPayload?.destination === 'planner' && item.proposedPayload.status === 'done') {
        return { ...item, previewStatus: 'skipped' as const, reconciliationAction: 'skipped' as const, skipCode: 'completed_operational_not_imported' as const, sourceComplete, warnings: [...item.warnings, 'Newly completed operational task is not imported. Existing linked tasks can still complete.'] }
      }
      const sourceHash = stableHash(ownedPayload(item.proposedPayload))
      return { ...item, reconciliationAction: 'create' as const, sourceHash, sourceComplete }
    }
    if (targets.length > 1) {
      return { ...item, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'duplicate_source_key' as const, conflictReason: 'More than one CG Dynamics row uses this exact Microsoft source key.', sourceComplete }
    }
    const target = targets[0]
    if (target.destination !== item.destination) {
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'wrong_destination' as const, conflictReason: `This Microsoft item is already linked to ${target.destination}.`, sourceComplete }
    }
    if (target.microsoftLastSyncedAt && Date.parse(snapshot.exportedAt) < Date.parse(target.microsoftLastSyncedAt)) {
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'stale_snapshot' as const, conflictReason: 'This snapshot is older than the last applied Microsoft state.', sourceComplete }
    }
    const currentHash = stableHash(ownedTarget(target))
    const sourceHash = stableHash(ownedPayload(item.proposedPayload))
    if (target.microsoftSourceRemovedAt) {
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'changed' as const, reconciliationAction: 'reopen' as const, sourceHash, sourceComplete }
    }
    if (currentHash === sourceHash) {
      if (!target.microsoftSourceHash) {
        return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'changed' as const, reconciliationAction: 'update' as const, sourceHash, sourceComplete, warnings: [...item.warnings, 'Adopt the current matching fields as the initial Microsoft sync baseline.'] }
      }
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'existing' as const, reconciliationAction: 'unchanged' as const, sourceHash, sourceComplete }
    }
    if (!target.microsoftSourceHash) {
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'existing_row_changed' as const, conflictReason: 'This legacy imported row has no Microsoft-owned field baseline. Review it before the first update.', sourceHash, sourceComplete }
    }
    if (target.microsoftSourceHash && currentHash !== target.microsoftSourceHash) {
      return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'existing_row_changed' as const, conflictReason: 'A Microsoft-owned field was edited in CG Dynamics after the last baseline. Review before overwriting it.', sourceHash, sourceComplete }
    }
    if (target.destination === 'client_schedule' && item.proposedPayload?.destination === 'client_schedule') {
      const currentSlot = deliverableSlotKey(target.payload.package_id, target.payload.template_id, target.payload.instance_number, target.payload.month)
      const nextSlot = deliverableSlotKey(item.proposedPayload.package_id, item.proposedPayload.template_id, item.proposedPayload.instance_number, item.proposedPayload.month)
      if (nextSlot && nextSlot !== currentSlot && deliverableSlotKeys.has(nextSlot)) {
        return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'conflict' as const, reconciliationAction: 'conflict' as const, conflictCode: 'existing_deliverable_slot' as const, conflictReason: 'The moved Client Socials card would occupy an existing Client Schedule slot.', sourceHash, sourceComplete }
      }
    }
    return { ...item, existingTargetId: target.id, expectedTargetUpdatedAt: target.updatedAt, previewStatus: 'changed' as const, reconciliationAction: changedAction(item, target), sourceHash, sourceComplete }
  })

  for (const target of existingTargets) {
    const key = targetKey(target)
    if (!key || seen.has(key) || target.microsoftSourceRemovedAt) continue
    const source = snapshot.sources.find(candidate => sourceCoversTarget(candidate, target))
    if (source && sourceActuallyComplete(source, mapped)) reconciled.push(removedItem(target, source))
  }
  return flagDeliverableSlotConflicts(reconciled, deliverableSlotKeys)
}
