import type { MicrosoftImportPreviewItem } from './microsoftImport'
import type { MicrosoftSnapshot } from './microsoftSnapshot'

// v3 adds legacy link_existing support: the client_schedule apply UPDATE branch
// may attach microsoft_plan_id / microsoft_task_id / microsoft_source_type to an
// existing row. Ships with phase-21a; the frontend and DB version must match.
export const MICROSOFT_SYNC_APPLY_VERSION = 3
export const MICROSOFT_SYNC_APPLY_MIGRATION_ERROR = 'Microsoft Sync Apply requires phase-21a-microsoft-link-existing.sql. Run the migration in Supabase, refresh the page, and preview again.'

export interface MicrosoftApplyRpcArgs {
  p_run_id: string
  p_item_key: string
  p_destination: MicrosoftImportPreviewItem['destination']
  p_destination_id: string | null
  p_expected_updated_at: string | null
  p_action: NonNullable<MicrosoftImportPreviewItem['reconciliationAction']>
  p_should_apply: boolean
  p_patch: Record<string, unknown>
  p_source_type: MicrosoftImportPreviewItem['sourceType']
  p_source_container_id: string
  p_source_item_id: string
  p_source_name: string
  p_source_complete: boolean
  p_details: { title: string; warnings: string[] }
}

export function microsoftApplyPreflightError(version: unknown, error: unknown): string | null {
  return error || version !== MICROSOFT_SYNC_APPLY_VERSION ? MICROSOFT_SYNC_APPLY_MIGRATION_ERROR : null
}

export function microsoftRunFinalStatus(applied: number, failed: number, uncertain: number): 'completed' | 'partial' | 'failed' {
  if (uncertain > 0 || (failed > 0 && applied > 0)) return 'partial'
  return failed > 0 ? 'failed' : 'completed'
}

function sourceModifiedAt(item: MicrosoftImportPreviewItem, snapshot: MicrosoftSnapshot): string | null {
  const record = snapshot.records.find(source => source.sourceType === 'outlook_event'
    ? source.sourceEventId === item.sourceEventId && source.sourceCalendarId === item.sourceCalendarId
    : source.sourceTaskId === item.sourceTaskId && source.sourcePlanId === item.sourcePlanId)
  return record?.sourceModifiedAt ?? null
}

function commonSyncFields(item: MicrosoftImportPreviewItem, snapshot: MicrosoftSnapshot, runId: string) {
  return {
    microsoft_last_synced_at: snapshot.exportedAt,
    microsoft_last_seen_at: new Date().toISOString(),
    microsoft_source_modified_at: sourceModifiedAt(item, snapshot),
    microsoft_source_hash: item.sourceHash ?? null,
    microsoft_source_removed_at: null,
    microsoft_sync_run_id: runId,
  }
}

export function microsoftSourceIdentity(item: MicrosoftImportPreviewItem) {
  return item.sourceType === 'outlook_event'
    ? { source_type: item.sourceType, source_container_id: item.sourceCalendarId ?? '', source_item_id: item.sourceEventId ?? '' }
    : { source_type: item.sourceType, source_container_id: item.sourcePlanId ?? '', source_item_id: item.sourceTaskId ?? '' }
}

function buildMicrosoftApplyPatch(
  item: MicrosoftImportPreviewItem,
  snapshot: MicrosoftSnapshot,
  runId: string,
  shouldApply: boolean,
  approveRemovals: boolean,
): Record<string, unknown> {
  const action = item.reconciliationAction ?? 'skipped'
  const removedAt = item.requiresRemovalApproval && approveRemovals ? new Date().toISOString() : null
  let patch: Record<string, unknown> = shouldApply ? commonSyncFields(item, snapshot, runId) : {}
  const payload = item.proposedPayload

  if (action === 'create' && payload?.destination === 'planner') {
    patch = { ...patch, board_id: payload.board_id, bucket_id: payload.bucket_id, title: payload.title, client_id: payload.client_id, client_name: payload.client_name, status: payload.status, priority: payload.priority, start_date: payload.start_date, due_date: payload.due_date, source: payload.source, original_plan_name: payload.original_plan_name, original_bucket_name: payload.original_bucket_name, original_task_id: payload.microsoft_task_id, import_hash: `ms-${payload.microsoft_plan_id}-${payload.microsoft_task_id}`, microsoft_source_type: payload.microsoft_source_type, microsoft_plan_id: payload.microsoft_plan_id, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_task_id: payload.microsoft_task_id, microsoft_source_description: payload.microsoft_source_description, assigned_to_name: payload.assigned_to_name, helper_names: payload.helper_names }
  } else if (action === 'create' && payload?.destination === 'client_schedule') {
    patch = { ...patch, client_id: payload.client_id, package_id: payload.package_id, template_id: payload.template_id, board_id: payload.board_id, bucket_id: payload.bucket_id, month: payload.month, code: payload.code, instance_number: payload.instance_number, title: payload.title, deliverable_type: payload.deliverable_type, production_status: payload.production_status, priority: payload.priority, scheduled_date: payload.scheduled_date, microsoft_source_type: payload.microsoft_source_type, microsoft_plan_id: payload.microsoft_plan_id, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_task_id: payload.microsoft_task_id, microsoft_source_description: payload.microsoft_source_description, assigned_to_user_id: payload.assigned_to_user_id, assigned_to_name: payload.assigned_to_name, helper_names: payload.helper_names }
  } else if (action === 'create' && payload?.destination === 'cg_calendar') {
    patch = { ...patch, title: payload.title, event_type: payload.event_type, client_id: payload.client_id, client_name: payload.client_name, start_at: payload.start_at, end_at: payload.end_at, all_day: payload.all_day, location: payload.location, status: payload.status, microsoft_source_type: payload.microsoft_source_type, microsoft_calendar_id: payload.microsoft_calendar_id, microsoft_event_id: payload.microsoft_event_id, microsoft_source_description: payload.microsoft_source_description }
  } else if (action === 'link_existing' && payload?.destination === 'client_schedule') {
    // Attach Microsoft identity + source-owned fields to an existing legacy row.
    // Deliberately omits client_id/package_id/template_id (the slot is already
    // correct) and every CG-owned field (notes, assigned_to_*, helper_names) so
    // the RPC's `case when p_patch ? 'field'` leaves local edits untouched.
    patch = {
      ...patch,
      month: payload.month, code: payload.code, instance_number: payload.instance_number,
      deliverable_type: payload.deliverable_type, title: payload.title,
      production_status: payload.production_status, scheduled_date: payload.scheduled_date,
      microsoft_source_type: payload.microsoft_source_type,
      microsoft_plan_id: payload.microsoft_plan_id, microsoft_bucket_id: payload.microsoft_bucket_id,
      microsoft_task_id: payload.microsoft_task_id,
      microsoft_source_description: payload.microsoft_source_description,
      archived_at: null,
    }
  } else if (item.destination === 'planner') {
    if (removedAt) patch = { archived_at: removedAt, microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
    else if (payload?.destination === 'planner') patch = { ...patch, board_id: payload.board_id, bucket_id: payload.bucket_id, title: payload.title, status: payload.status, start_date: payload.start_date, due_date: payload.due_date, original_plan_name: payload.original_plan_name, original_bucket_name: payload.original_bucket_name, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_source_description: payload.microsoft_source_description, archived_at: null, assigned_to_name: payload.assigned_to_name, helper_names: payload.helper_names }
  } else if (item.destination === 'client_schedule') {
    if (removedAt) patch = { archived_at: removedAt, microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
    else if (payload?.destination === 'client_schedule') patch = { ...patch, client_id: payload.client_id, package_id: payload.package_id, template_id: payload.template_id, month: payload.month, code: payload.code, instance_number: payload.instance_number, deliverable_type: payload.deliverable_type, title: payload.title, production_status: payload.production_status, scheduled_date: payload.scheduled_date, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_source_description: payload.microsoft_source_description, archived_at: null, assigned_to_user_id: payload.assigned_to_user_id, assigned_to_name: payload.assigned_to_name, helper_names: payload.helper_names }
  } else if (removedAt) {
    patch = { status: 'cancelled', microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
  } else if (payload?.destination === 'cg_calendar') {
    patch = { ...patch, title: payload.title, event_type: payload.event_type, start_at: payload.start_at, end_at: payload.end_at, all_day: payload.all_day, location: payload.location, ...(action === 'cancel' ? { status: 'cancelled' } : action === 'reopen' ? { status: 'planned' } : {}), microsoft_source_description: payload.microsoft_source_description }
  }

  return patch
}

export function buildMicrosoftApplyRpcArgs(
  item: MicrosoftImportPreviewItem,
  snapshot: MicrosoftSnapshot,
  runId: string,
  itemAuditKey: string,
  approveRemovals: boolean,
): MicrosoftApplyRpcArgs {
  const action = item.reconciliationAction ?? 'skipped'
  // package_template_create is applied by a dedicated template-creation step
  // (it inserts a package_deliverable_templates row before its deliverable), not
  // by the generic monthly_deliverables apply RPC — so it is excluded here.
  const shouldApply = !['unchanged', 'conflict', 'skipped', 'failed', 'package_template_create'].includes(action)
    && (!item.requiresRemovalApproval || approveRemovals)
  const identity = microsoftSourceIdentity(item)

  return {
    p_run_id: runId,
    p_item_key: itemAuditKey,
    p_destination: item.destination,
    p_destination_id: item.existingTargetId ?? null,
    p_expected_updated_at: item.expectedTargetUpdatedAt ?? null,
    p_action: action,
    p_should_apply: shouldApply,
    p_patch: buildMicrosoftApplyPatch(item, snapshot, runId, shouldApply, approveRemovals),
    p_source_type: identity.source_type,
    p_source_container_id: identity.source_container_id,
    p_source_item_id: identity.source_item_id,
    p_source_name: item.sourceName,
    p_source_complete: Boolean(item.sourceComplete),
    p_details: { title: item.title, warnings: item.warnings },
  }
}
