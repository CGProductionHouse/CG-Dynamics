import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildMicrosoftApplyRpcArgs } from '../../../src/lib/microsoftApply.ts'
import { resolvePreviewAssignees } from '../../../src/lib/microsoftAssigneeMapping.ts'
import { classifyMicrosoftAutoApply } from '../../../src/lib/microsoftAutoApply.ts'
import type {
  MicrosoftExistingTarget,
  MicrosoftImportPreviewItem,
  MicrosoftReconciliationSummary,
} from '../../../src/lib/microsoftImport.ts'
import { summarizeMicrosoftReconciliation } from '../../../src/lib/microsoftImport.ts'
import {
  deliverableSlotKey,
  type MicrosoftPreviewMappingContext,
  type UnlinkedSlotRow,
} from '../../../src/lib/microsoftImportPreview.ts'
import { buildMicrosoftReconciliation } from '../../../src/lib/microsoftSync.ts'
import type { MicrosoftSnapshot } from '../../../src/lib/microsoftSnapshot.ts'

type Row = Record<string, unknown>

interface ReconciliationContextPayload {
  clients?: Row[]
  boards?: Row[]
  buckets?: Row[]
  packages?: Row[]
  templates?: Row[]
  client_mappings?: Row[]
  profiles?: Row[]
  user_mappings?: Row[]
  planner_targets?: Row[]
  deliverable_targets?: Row[]
  calendar_targets?: Row[]
  slot_rows?: Row[]
  error?: string
}

export interface MicrosoftJobCounts {
  safe: number
  applied: number
  conflicts: number
  skipped: number
  failed: number
  remaining: number
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function nullableText(value: unknown): string | null { return typeof value === 'string' && value ? value : null }

function mappingContext(raw: ReconciliationContextPayload): MicrosoftPreviewMappingContext {
  return {
    clients: (raw.clients ?? []).map(row => ({ id: text(row.id), name: text(row.name) })),
    boards: (raw.boards ?? []).map(row => ({ id: text(row.id), slug: text(row.slug) })),
    buckets: (raw.buckets ?? []).map(row => ({ id: text(row.id), boardId: text(row.board_id), name: text(row.name) })),
    packages: (raw.packages ?? []).map(row => ({
      id: text(row.id), clientId: text(row.client_id),
      status: text(row.status) as 'active' | 'paused' | 'archived',
    })),
    templates: (raw.templates ?? []).map(row => ({
      id: text(row.id), packageId: text(row.package_id), code: text(row.code),
      deliverableType: text(row.deliverable_type) as MicrosoftPreviewMappingContext['templates'][number]['deliverableType'],
      active: Boolean(row.active),
    })),
    confirmedClientMappings: (raw.client_mappings ?? []).map(row => ({
      mappingType: text(row.mapping_type) as 'planner_bucket_client' | 'outlook_label_client',
      sourceContainerId: text(row.source_container_id), sourceKey: text(row.source_key), clientId: text(row.client_id),
    })),
  }
}

function existingTargets(raw: ReconciliationContextPayload): MicrosoftExistingTarget[] {
  const targets: MicrosoftExistingTarget[] = []
  for (const row of raw.planner_targets ?? []) {
    targets.push({
      destination: 'planner', id: text(row.id), updatedAt: text(row.updated_at),
      microsoftLastSyncedAt: nullableText(row.microsoft_last_synced_at), microsoftSourceHash: nullableText(row.microsoft_source_hash),
      microsoftSourceRemovedAt: nullableText(row.microsoft_source_removed_at), microsoftPlanId: text(row.microsoft_plan_id),
      microsoftTaskId: text(row.microsoft_task_id), payload: {
        board_id: nullableText(row.board_id), bucket_id: nullableText(row.bucket_id), title: text(row.title),
        client_id: nullableText(row.client_id), client_name: nullableText(row.client_name),
        status: text(row.status) as Extract<MicrosoftExistingTarget, { destination: 'planner' }>['payload']['status'],
        priority: 'normal', start_date: nullableText(row.start_date), due_date: nullableText(row.due_date),
        notes: nullableText(row.notes), source: 'microsoft_import', original_plan_name: text(row.original_plan_name),
        original_bucket_name: text(row.original_bucket_name), microsoft_source_description: nullableText(row.microsoft_source_description),
        assigned_to_name: nullableText(row.assigned_to_name), helper_names: Array.isArray(row.helper_names) ? row.helper_names as string[] : null,
      },
    })
  }
  for (const row of raw.deliverable_targets ?? []) {
    targets.push({
      destination: 'client_schedule', id: text(row.id), updatedAt: text(row.updated_at),
      microsoftLastSyncedAt: nullableText(row.microsoft_last_synced_at), microsoftSourceHash: nullableText(row.microsoft_source_hash),
      microsoftSourceRemovedAt: nullableText(row.microsoft_source_removed_at), microsoftPlanId: text(row.microsoft_plan_id),
      microsoftTaskId: text(row.microsoft_task_id), payload: {
        client_id: nullableText(row.client_id), package_id: nullableText(row.package_id), template_id: nullableText(row.template_id),
        board_id: nullableText(row.board_id), bucket_id: nullableText(row.bucket_id), month: nullableText(row.month),
        code: nullableText(row.code), instance_number: typeof row.instance_number === 'number' ? row.instance_number : null,
        title: text(row.title), deliverable_type: nullableText(row.deliverable_type) as Extract<MicrosoftExistingTarget, { destination: 'client_schedule' }>['payload']['deliverable_type'],
        production_status: text(row.production_status) as Extract<MicrosoftExistingTarget, { destination: 'client_schedule' }>['payload']['production_status'],
        priority: 'normal', scheduled_date: nullableText(row.scheduled_date), notes: nullableText(row.notes),
        microsoft_source_description: nullableText(row.microsoft_source_description), assigned_to_user_id: nullableText(row.assigned_to_user_id),
        assigned_to_name: nullableText(row.assigned_to_name), helper_names: Array.isArray(row.helper_names) ? row.helper_names as string[] : null,
      },
    })
  }
  for (const row of raw.calendar_targets ?? []) {
    targets.push({
      destination: 'cg_calendar', id: text(row.id), updatedAt: text(row.updated_at),
      microsoftLastSyncedAt: nullableText(row.microsoft_last_synced_at), microsoftSourceHash: nullableText(row.microsoft_source_hash),
      microsoftSourceRemovedAt: nullableText(row.microsoft_source_removed_at), microsoftCalendarId: text(row.microsoft_calendar_id),
      microsoftEventId: text(row.microsoft_event_id), payload: {
        title: text(row.title), event_type: text(row.event_type) as Extract<MicrosoftExistingTarget, { destination: 'cg_calendar' }>['payload']['event_type'],
        client_id: nullableText(row.client_id), client_name: nullableText(row.client_name), start_at: text(row.start_at),
        end_at: nullableText(row.end_at), all_day: Boolean(row.all_day), location: nullableText(row.location), notes: nullableText(row.notes),
        status: text(row.status) as Extract<MicrosoftExistingTarget, { destination: 'cg_calendar' }>['payload']['status'],
        microsoft_source_description: nullableText(row.microsoft_source_description),
      },
    })
  }
  return targets
}

function slotContext(rows: Row[]): { keys: Set<string>; unlinked: Map<string, UnlinkedSlotRow[]> } {
  const keys = new Set<string>()
  const unlinked = new Map<string, UnlinkedSlotRow[]>()
  for (const row of rows) {
    const key = deliverableSlotKey(nullableText(row.package_id), nullableText(row.template_id),
      typeof row.instance_number === 'number' ? row.instance_number : null, nullableText(row.month))
    if (!key) continue
    keys.add(key)
    if (row.microsoft_task_id) continue
    unlinked.set(key, [...(unlinked.get(key) ?? []), { id: text(row.id), updatedAt: text(row.updated_at) }])
  }
  return { keys, unlinked }
}

function itemIdentity(item: MicrosoftImportPreviewItem, index: number): string {
  const container = item.sourceType === 'outlook_event' ? item.sourceCalendarId : item.sourcePlanId
  const sourceId = item.sourceType === 'outlook_event' ? item.sourceEventId : item.sourceTaskId
  return `${item.sourceType}:${container || 'missing'}:${sourceId || 'missing'}:${index}`
}

export async function reconcileMicrosoftJob(
  sb: SupabaseClient,
  jobId: string,
  requestedBy: string,
  snapshot: MicrosoftSnapshot,
): Promise<{ runId: string; summary: MicrosoftReconciliationSummary }> {
  const { data: rawData, error: contextError } = await sb.rpc('get_microsoft_sync_reconciliation_context')
  const raw = (rawData ?? {}) as ReconciliationContextPayload
  if (contextError || raw.error) throw new Error(contextError?.message ?? raw.error ?? 'Could not load Microsoft reconciliation context.')

  const context = mappingContext(raw)
  const slots = slotContext(raw.slot_rows ?? [])
  const profiles = (raw.profiles ?? []).map(row => ({ id: text(row.id), email: nullableText(row.email), full_name: nullableText(row.full_name) }))
  const storedMappings = new Map((raw.user_mappings ?? []).map(row => [text(row.microsoft_user_id), text(row.cg_user_id)]))
  const items = buildMicrosoftReconciliation(
    snapshot, context, existingTargets(raw), slots.keys,
    mapped => resolvePreviewAssignees(mapped, snapshot.assigneeMap ?? {}, storedMappings, profiles),
    slots.unlinked,
  )
  const summary = summarizeMicrosoftReconciliation(items)
  const rangeStarts = snapshot.sources.map(source => source.rangeStart).filter((value): value is string => Boolean(value)).sort()
  const rangeEnds = snapshot.sources.map(source => source.rangeEnd).filter((value): value is string => Boolean(value)).sort()
  const { data: run, error: runError } = await sb.from('microsoft_sync_runs').insert({
    trigger_type: snapshot.triggerType, status: 'applying', snapshot_exported_at: snapshot.exportedAt,
    snapshot_exported_by: snapshot.exportedBy, range_start: rangeStarts[0] ?? null,
    range_end: rangeEnds[rangeEnds.length - 1] ?? null, source_completeness: snapshot.sources,
    summary, requested_by: requestedBy,
  }).select('id').single()
  if (runError || !run) throw new Error(runError?.message ?? 'Could not create Microsoft sync run.')

  const queueRows = items.map((item, index) => {
    const itemKey = itemIdentity(item, index)
    const decision = classifyMicrosoftAutoApply(item)
    const args = buildMicrosoftApplyRpcArgs(item, snapshot, run.id, itemKey, false)
    return {
      job_id: jobId, run_id: run.id, position: index, item_key: itemKey,
      source_type: args.p_source_type, source_container_id: args.p_source_container_id,
      source_item_id: args.p_source_item_id, source_name: item.sourceName,
      source_client_label: item.sourceClientLabel ?? null, destination: item.destination,
      destination_id: item.existingTargetId, expected_updated_at: item.expectedTargetUpdatedAt ?? null,
      action: item.reconciliationAction ?? 'skipped', proposed_patch: args.p_patch,
      source_complete: Boolean(item.sourceComplete), auto_apply: decision.autoApply,
      safety_class: decision.safetyClass, conflict_code: decision.conflictCode,
      client_id: item.mappedClientId, client_group_label: item.mappedClientName ?? item.sourceClientLabel ?? 'Unmapped',
      details: {
        title: item.title, warnings: item.warnings, reason: decision.reason,
        mappingKey: item.sourceType === 'outlook_event'
          ? (item.sourceClientLabel ?? '').trim().toLocaleLowerCase('en-ZA').replace(/\s+/g, ' ')
          : item.sourceBucketId,
        resolvedAssignees: item.resolvedAssignees ?? [],
      },
      status: decision.autoApply ? 'queued' : 'skipped',
      resolution_status: decision.conflictCode || decision.safetyClass.startsWith('blocked_') ? 'open' : 'resolved',
      finished_at: decision.autoApply ? null : new Date().toISOString(),
    }
  })
  const { error: queueError } = await sb.from('microsoft_sync_job_items').insert(queueRows)
  if (queueError) throw new Error(queueError.message)

  const auditRows = queueRows.filter(row => !row.auto_apply).map(row => ({
    run_id: run.id, item_key: row.item_key, source_type: row.source_type,
    source_container_id: row.source_container_id, source_item_id: row.source_item_id,
    source_name: row.source_name, destination: row.destination, destination_id: row.destination_id,
    action: row.action, result_status: 'skipped', source_complete: row.source_complete,
    details: row.details, safe_error: row.details.reason ?? null,
  }))
  if (auditRows.length > 0) {
    const { error: auditError } = await sb.from('microsoft_sync_run_items').insert(auditRows)
    if (auditError) throw new Error(auditError.message)
  }
  const safe = queueRows.filter(row => row.auto_apply).length
  const conflicts = queueRows.filter(row => row.resolution_status === 'open').length
  await sb.from('microsoft_sync_jobs').update({
    phase: safe > 0 ? 'applying' : 'complete', run_id: run.id, reconciled_at: new Date().toISOString(),
    safe_action_count: safe, conflict_count: conflicts, skipped_count: queueRows.length - safe,
    status: safe > 0 ? 'running' : 'complete', updated_at: new Date().toISOString(),
  }).eq('id', jobId)
  if (safe === 0) {
    await sb.from('microsoft_sync_runs').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', run.id)
  }
  return { runId: run.id, summary }
}

export async function applyMicrosoftJobBatch(
  sb: SupabaseClient,
  adminSb: SupabaseClient,
  jobId: string,
): Promise<MicrosoftJobCounts> {
  const { data: claimed, error: claimError } = await sb.rpc('claim_microsoft_sync_job_items', { p_job_id: jobId, p_limit: 25 })
  if (claimError) throw new Error(claimError.message)
  for (const row of (claimed ?? []) as Row[]) {
    const args = {
      p_run_id: text(row.run_id), p_item_key: text(row.item_key), p_destination: text(row.destination),
      p_destination_id: nullableText(row.destination_id), p_expected_updated_at: nullableText(row.expected_updated_at),
      p_action: text(row.action), p_should_apply: true, p_patch: (row.proposed_patch ?? {}) as Row,
      p_source_type: text(row.source_type), p_source_container_id: text(row.source_container_id),
      p_source_item_id: text(row.source_item_id), p_source_name: text(row.source_name),
      p_source_complete: Boolean(row.source_complete), p_details: (row.details ?? {}) as Row,
    }
    const { error } = await adminSb.rpc('apply_microsoft_sync_item', args)
    await sb.from('microsoft_sync_job_items').update({
      status: error ? 'failed' : 'applied', safe_error: error ? 'Safe apply failed; review the audit item before retrying.' : null,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', text(row.id))
    if (error) {
      await sb.from('microsoft_sync_run_items').upsert({
        run_id: row.run_id, item_key: row.item_key, source_type: row.source_type,
        source_container_id: row.source_container_id, source_item_id: row.source_item_id,
        source_name: row.source_name, destination: row.destination, destination_id: row.destination_id,
        action: row.action, result_status: 'failed', source_complete: row.source_complete,
        details: row.details, safe_error: 'Safe apply failed; the destination was left unchanged.',
      }, { onConflict: 'run_id,item_key' })
    }
  }

  const { data: rows } = await sb.from('microsoft_sync_job_items').select('status, auto_apply, resolution_status').eq('job_id', jobId)
  const all = (rows ?? []) as Array<{ status: string; auto_apply: boolean; resolution_status: string }>
  const counts: MicrosoftJobCounts = {
    safe: all.filter(row => row.auto_apply).length,
    applied: all.filter(row => row.status === 'applied').length,
    conflicts: all.filter(row => row.resolution_status === 'open').length,
    skipped: all.filter(row => row.status === 'skipped').length,
    failed: all.filter(row => row.status === 'failed').length,
    remaining: all.filter(row => row.status === 'queued' || row.status === 'running').length,
  }
  const { data: job } = await sb.from('microsoft_sync_jobs').select('run_id').eq('id', jobId).single()
  if (counts.remaining === 0) {
    const status = counts.failed > 0 ? (counts.applied > 0 ? 'partial' : 'failed') : 'completed'
    const now = new Date().toISOString()
    await sb.from('microsoft_sync_jobs').update({
      phase: counts.failed > 0 ? 'failed' : 'complete', status: counts.failed > 0 ? 'failed' : 'complete',
      applied_count: counts.applied, failed_count: counts.failed, applied_at: now, updated_at: now,
    }).eq('id', jobId)
    if (job?.run_id) {
      await sb.from('microsoft_sync_runs').update({
        status, summary: { applied: counts.applied, failed: counts.failed, conflicts: counts.conflicts, skipped: counts.skipped },
        safe_error: counts.failed > 0 ? 'One or more safe items failed. Review per-item history.' : null,
        applied_at: now, finished_at: now,
      }).eq('id', job.run_id)
    }
  } else {
    await sb.from('microsoft_sync_jobs').update({ applied_count: counts.applied, failed_count: counts.failed, updated_at: new Date().toISOString() }).eq('id', jobId)
  }
  return counts
}
