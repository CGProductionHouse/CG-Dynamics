import { supabase } from './supabase'
import type {
  MicrosoftExistingTarget,
  MicrosoftImportPreviewItem,
  MicrosoftReconciliationAction,
  MicrosoftReconciliationSummary,
} from './microsoftImport'
import { summarizeMicrosoftReconciliation } from './microsoftImport'
import type { MicrosoftSnapshot } from './microsoftSnapshot'
import type { MicrosoftPreviewMappingContext } from './microsoftImportPreview'
import { deliverableSlotKey } from './microsoftImportPreview'

// ── Supabase data layer for the Microsoft snapshot import (Option A) ─────────
//
// Read side: the live mapping context (clients, boards, buckets, packages,
// templates), the rows already carrying Microsoft source keys, and the
// occupied monthly_deliverables natural-key slots.
//
// Write side: applyMicrosoftImport inserts ONLY items the preview classified
// as `new`. Changed/conflict/existing rows are never written — updating a
// changed row is a deliberate manual action, not an import side effect.
//
// Before supabase/phase-15a-microsoft-source-tracking.sql is applied the
// microsoft_* columns do not exist. Reads degrade to migrationNeeded and the
// page blocks Apply with a clear message instead of failing mid-write.

function isMissingMicrosoftColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('microsoft_') && (message.includes('does not exist') || message.includes('schema cache'))
}

export interface MicrosoftContextResult {
  context: MicrosoftPreviewMappingContext | null
  error: string | null
}

export async function loadMicrosoftMappingContext(): Promise<MicrosoftContextResult> {
  const [clients, boards, buckets, packages, templates] = await Promise.all([
    supabase.from('clients').select('id, name').eq('active', true),
    supabase.from('planner_boards').select('id, slug').is('archived_at', null),
    supabase.from('planner_buckets').select('id, board_id, name').is('archived_at', null),
    supabase.from('client_packages').select('id, client_id, status').is('archived_at', null),
    supabase.from('package_deliverable_templates').select('id, package_id, code, deliverable_type, active'),
  ])
  const failed = [clients.error, boards.error, buckets.error, packages.error, templates.error].find(Boolean)
  if (failed) return { context: null, error: failed.message }

  return {
    context: {
      clients: (clients.data ?? []).map(row => ({ id: row.id as string, name: row.name as string })),
      boards: (boards.data ?? []).map(row => ({ id: row.id as string, slug: row.slug as string })),
      buckets: (buckets.data ?? []).map(row => ({ id: row.id as string, boardId: row.board_id as string, name: row.name as string })),
      packages: (packages.data ?? []).map(row => ({ id: row.id as string, clientId: row.client_id as string, status: row.status as 'active' | 'paused' | 'archived' })),
      templates: (templates.data ?? []).map(row => ({
        id: row.id as string,
        packageId: row.package_id as string,
        code: row.code as string,
        deliverableType: row.deliverable_type as MicrosoftPreviewMappingContext['templates'][number]['deliverableType'],
        active: Boolean(row.active),
      })),
    },
    error: null,
  }
}

export interface MicrosoftExistingResult {
  targets: MicrosoftExistingTarget[]
  /** Occupied monthly_deliverables (package|template|instance|month) slots. */
  deliverableSlotKeys: Set<string>
  migrationNeeded: boolean
  error: string | null
}

export async function loadMicrosoftExistingTargets(): Promise<MicrosoftExistingResult> {
  const [plannerRows, deliverableRows, calendarRows, slotRows] = await Promise.all([
    supabase
      .from('planner_tasks')
      .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, board_id, bucket_id, title, client_id, client_name, status, priority, start_date, due_date, notes, source, original_plan_name, original_bucket_name')
      .not('microsoft_plan_id', 'is', null)
      .not('microsoft_task_id', 'is', null),
    supabase
      .from('monthly_deliverables')
      .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, client_id, package_id, template_id, board_id, bucket_id, month, code, instance_number, title, deliverable_type, production_status, priority, scheduled_date, notes')
      .not('microsoft_plan_id', 'is', null)
      .not('microsoft_task_id', 'is', null),
    supabase
      .from('company_calendar_events')
      .select('id, updated_at, microsoft_calendar_id, microsoft_event_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, title, event_type, client_id, client_name, start_at, end_at, all_day, location, notes, status')
      .not('microsoft_calendar_id', 'is', null)
      .not('microsoft_event_id', 'is', null),
    supabase
      .from('monthly_deliverables')
      .select('package_id, template_id, instance_number, month'),
  ])

  const microsoftError = [plannerRows.error, deliverableRows.error, calendarRows.error].find(Boolean)
  if (microsoftError) {
    if (isMissingMicrosoftColumnError(microsoftError)) {
      const deliverableSlotKeys = collectSlotKeys(slotRows.data ?? [])
      return { targets: [], deliverableSlotKeys, migrationNeeded: true, error: slotRows.error?.message ?? null }
    }
    return { targets: [], deliverableSlotKeys: new Set(), migrationNeeded: false, error: microsoftError.message }
  }
  if (slotRows.error) {
    return { targets: [], deliverableSlotKeys: new Set(), migrationNeeded: false, error: slotRows.error.message }
  }

  const targets: MicrosoftExistingTarget[] = []
  for (const row of plannerRows.data ?? []) {
    targets.push({
      destination: 'planner',
      id: row.id as string,
      updatedAt: row.updated_at as string,
      microsoftLastSyncedAt: (row.microsoft_last_synced_at as string | null) ?? null,
      microsoftSourceHash: (row.microsoft_source_hash as string | null) ?? null,
      microsoftSourceRemovedAt: (row.microsoft_source_removed_at as string | null) ?? null,
      microsoftPlanId: row.microsoft_plan_id as string,
      microsoftTaskId: row.microsoft_task_id as string,
      payload: {
        board_id: row.board_id as string | null,
        bucket_id: row.bucket_id as string | null,
        title: row.title as string,
        client_id: row.client_id as string | null,
        client_name: row.client_name as string | null,
        status: row.status as 'to_do' | 'in_progress' | 'blocked' | 'waiting_client' | 'ready_internal_review' | 'approved' | 'scheduled' | 'done',
        // Real row value: an edited priority must fail the material compare.
        priority: row.priority as 'normal',
        start_date: row.start_date as string | null,
        due_date: row.due_date as string | null,
        notes: row.notes as string | null,
        // Real row value for the material compare (may be 'teams_import').
        source: row.source as 'microsoft_import',
        original_plan_name: row.original_plan_name as string,
        original_bucket_name: row.original_bucket_name as string,
        microsoft_source_description: row.microsoft_source_description as string | null,
      },
    })
  }
  for (const row of deliverableRows.data ?? []) {
    targets.push({
      destination: 'client_schedule',
      id: row.id as string,
      updatedAt: row.updated_at as string,
      microsoftLastSyncedAt: (row.microsoft_last_synced_at as string | null) ?? null,
      microsoftSourceHash: (row.microsoft_source_hash as string | null) ?? null,
      microsoftSourceRemovedAt: (row.microsoft_source_removed_at as string | null) ?? null,
      microsoftPlanId: row.microsoft_plan_id as string,
      microsoftTaskId: row.microsoft_task_id as string,
      payload: {
        client_id: row.client_id as string | null,
        package_id: row.package_id as string | null,
        template_id: row.template_id as string | null,
        board_id: row.board_id as string | null,
        bucket_id: row.bucket_id as string | null,
        month: row.month as string | null,
        code: row.code as string | null,
        instance_number: row.instance_number as number | null,
        title: row.title as string,
        deliverable_type: row.deliverable_type as 'dp' | 'photo' | 'video' | 'reel' | null,
        production_status: row.production_status as 'to_do' | 'in_progress' | 'ready_internal_review' | 'internal_changes' | 'ready_client_approval' | 'waiting_client' | 'client_changes' | 'approved' | 'scheduled' | 'posted' | 'blocked' | 'moved',
        priority: row.priority as 'normal',
        scheduled_date: row.scheduled_date as string | null,
        notes: row.notes as string | null,
        microsoft_source_description: row.microsoft_source_description as string | null,
      },
    })
  }
  for (const row of calendarRows.data ?? []) {
    targets.push({
      destination: 'cg_calendar',
      id: row.id as string,
      updatedAt: row.updated_at as string,
      microsoftLastSyncedAt: (row.microsoft_last_synced_at as string | null) ?? null,
      microsoftSourceHash: (row.microsoft_source_hash as string | null) ?? null,
      microsoftSourceRemovedAt: (row.microsoft_source_removed_at as string | null) ?? null,
      microsoftCalendarId: row.microsoft_calendar_id as string,
      microsoftEventId: row.microsoft_event_id as string,
      payload: {
        title: row.title as string,
        event_type: row.event_type as 'meeting' | 'shoot' | 'content_run' | 'client_event' | 'internal' | 'deadline',
        client_id: row.client_id as string | null,
        client_name: row.client_name as string | null,
        start_at: row.start_at as string,
        end_at: row.end_at as string | null,
        all_day: Boolean(row.all_day),
        location: row.location as string | null,
        notes: row.notes as string | null,
        status: row.status as 'planned' | 'confirmed' | 'completed' | 'cancelled',
        microsoft_source_description: row.microsoft_source_description as string | null,
      },
    })
  }

  return { targets, deliverableSlotKeys: collectSlotKeys(slotRows.data ?? []), migrationNeeded: false, error: null }
}

function collectSlotKeys(rows: Array<Record<string, unknown>>): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const key = deliverableSlotKey(
      row.package_id as string | null,
      row.template_id as string | null,
      row.instance_number as number | null,
      row.month as string | null,
    )
    if (key) keys.add(key)
  }
  return keys
}

export type MicrosoftTransitionStatus = 'active' | 'paused' | 'complete'

export interface MicrosoftSyncRunSummary {
  id: string
  status: 'previewed' | 'applying' | 'completed' | 'partial' | 'failed'
  triggerType: 'admin' | 'agent'
  snapshotExportedAt: string
  summary: Partial<MicrosoftReconciliationSummary>
  sourceCompleteness: Array<{ sourceName: string; complete: boolean; safeError: string | null }>
  safeError: string | null
  createdAt: string
  finishedAt: string | null
}

export interface MicrosoftSyncStateResult {
  transitionStatus: MicrosoftTransitionStatus
  runs: MicrosoftSyncRunSummary[]
  migrationNeeded: boolean
  error: string | null
}

export interface MicrosoftSyncRunItem {
  id: string
  sourceName: string
  destination: string
  destinationId: string | null
  action: MicrosoftReconciliationAction
  resultStatus: 'previewed' | 'applied' | 'skipped' | 'failed'
  sourceComplete: boolean
  details: { title?: string; warnings?: string[] }
  safeError: string | null
}

export async function loadMicrosoftSyncRunItems(runId: string): Promise<{ data: MicrosoftSyncRunItem[]; error: string | null }> {
  const { data, error } = await supabase.from('microsoft_sync_run_items').select('id, source_name, destination, destination_id, action, result_status, source_complete, details, safe_error').eq('run_id', runId).order('created_at')
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(row => ({
    id: row.id as string,
    sourceName: row.source_name as string,
    destination: row.destination as string,
    destinationId: row.destination_id as string | null,
    action: row.action as MicrosoftReconciliationAction,
    resultStatus: row.result_status as MicrosoftSyncRunItem['resultStatus'],
    sourceComplete: Boolean(row.source_complete),
    details: (row.details ?? {}) as MicrosoftSyncRunItem['details'],
    safeError: row.safe_error as string | null,
  })), error: null }
}

export async function loadMicrosoftSyncState(): Promise<MicrosoftSyncStateResult> {
  const [settings, runs] = await Promise.all([
    supabase.from('microsoft_sync_settings').select('transition_status').eq('id', true).maybeSingle(),
    supabase.from('microsoft_sync_runs').select('id, status, trigger_type, snapshot_exported_at, summary, source_completeness, safe_error, created_at, finished_at').order('created_at', { ascending: false }).limit(12),
  ])
  const missing = [settings.error, runs.error].some(error => error?.code === '42P01' || error?.code === '42703')
  if (missing) return { transitionStatus: 'active', runs: [], migrationNeeded: true, error: null }
  const error = settings.error ?? runs.error
  if (error) return { transitionStatus: 'paused', runs: [], migrationNeeded: false, error: error.message }
  return {
    transitionStatus: (settings.data?.transition_status as MicrosoftTransitionStatus | undefined) ?? 'active',
    runs: (runs.data ?? []).map(row => ({
      id: row.id as string,
      status: row.status as MicrosoftSyncRunSummary['status'],
      triggerType: row.trigger_type as MicrosoftSyncRunSummary['triggerType'],
      snapshotExportedAt: row.snapshot_exported_at as string,
      summary: (row.summary ?? {}) as Partial<MicrosoftReconciliationSummary>,
      sourceCompleteness: (row.source_completeness ?? []) as MicrosoftSyncRunSummary['sourceCompleteness'],
      safeError: row.safe_error as string | null,
      createdAt: row.created_at as string,
      finishedAt: row.finished_at as string | null,
    })),
    migrationNeeded: false,
    error: null,
  }
}

export async function updateMicrosoftTransitionStatus(status: MicrosoftTransitionStatus): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('microsoft_sync_settings').update({ transition_status: status, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', true)
  return error?.message ?? null
}

export interface MicrosoftConnectionStatus {
  connected: boolean
  message: string
  sources: Array<{ id: string; name: string; type: 'outlook_calendar' | 'planner_plan' }>
}

export async function getMicrosoftConnectionStatus(): Promise<{ data: MicrosoftConnectionStatus | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('microsoft-transition-sync', { body: { action: 'status' } })
  if (error) return { data: null, error: error.message }
  if (!data?.ok) return { data: null, error: data?.error ?? 'Microsoft connection status failed.' }
  return { data: { connected: Boolean(data.connected), message: data.message as string, sources: data.sources ?? [] }, error: null }
}

export async function fetchLatestMicrosoftSnapshot(rangeStart: string, rangeEnd: string, plannerCompletedCutoff: string): Promise<{ snapshot: MicrosoftSnapshot | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('microsoft-transition-sync', { body: { action: 'fetch', rangeStart, rangeEnd, plannerCompletedCutoff } })
  if (error) return { snapshot: null, error: error.message }
  if (!data?.ok || !data.snapshot) return { snapshot: null, error: data?.error ?? 'Microsoft fetch failed.' }
  const snapshot = data.snapshot as MicrosoftSnapshot
  return { snapshot: { ...snapshot, plannerCompletedCutoff: snapshot.plannerCompletedCutoff ?? plannerCompletedCutoff }, error: null }
}

export interface MicrosoftReconciliationApplyResult {
  runId: string | null
  summary: MicrosoftReconciliationSummary
  applied: number
  failed: number
  errors: string[]
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
    microsoft_source_hash: item.sourceHash,
    microsoft_source_removed_at: null,
    microsoft_sync_run_id: runId,
  }
}

function sourceIdentity(item: MicrosoftImportPreviewItem) {
  return item.sourceType === 'outlook_event'
    ? { source_type: item.sourceType, source_container_id: item.sourceCalendarId ?? '', source_item_id: item.sourceEventId ?? '' }
    : { source_type: item.sourceType, source_container_id: item.sourcePlanId ?? '', source_item_id: item.sourceTaskId ?? '' }
}

async function applyReconciliationItem(item: MicrosoftImportPreviewItem, snapshot: MicrosoftSnapshot, runId: string, itemAuditKey: string, approveRemovals: boolean): Promise<{ status: 'applied' | 'skipped' | 'failed'; destinationId: string | null; error: string | null }> {
  const action = item.reconciliationAction ?? 'skipped'
  const shouldApply = !['unchanged', 'conflict', 'skipped', 'failed'].includes(action)
    && (!item.requiresRemovalApproval || approveRemovals)
  const removedAt = item.requiresRemovalApproval && approveRemovals ? new Date().toISOString() : null
  let patch: Record<string, unknown> = shouldApply ? commonSyncFields(item, snapshot, runId) : {}
  const payload = item.proposedPayload
  if (action === 'create' && payload?.destination === 'planner') {
    patch = { ...patch, board_id: payload.board_id, bucket_id: payload.bucket_id, title: payload.title, client_id: payload.client_id, client_name: payload.client_name, status: payload.status, priority: payload.priority, start_date: payload.start_date, due_date: payload.due_date, source: payload.source, original_plan_name: payload.original_plan_name, original_bucket_name: payload.original_bucket_name, original_task_id: payload.microsoft_task_id, import_hash: `ms-${payload.microsoft_plan_id}-${payload.microsoft_task_id}`, microsoft_source_type: payload.microsoft_source_type, microsoft_plan_id: payload.microsoft_plan_id, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_task_id: payload.microsoft_task_id, microsoft_source_description: payload.microsoft_source_description }
  } else if (action === 'create' && payload?.destination === 'client_schedule') {
    patch = { ...patch, client_id: payload.client_id, package_id: payload.package_id, template_id: payload.template_id, board_id: payload.board_id, bucket_id: payload.bucket_id, month: payload.month, code: payload.code, instance_number: payload.instance_number, title: payload.title, deliverable_type: payload.deliverable_type, production_status: payload.production_status, priority: payload.priority, scheduled_date: payload.scheduled_date, microsoft_source_type: payload.microsoft_source_type, microsoft_plan_id: payload.microsoft_plan_id, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_task_id: payload.microsoft_task_id, microsoft_source_description: payload.microsoft_source_description }
  } else if (action === 'create' && payload?.destination === 'cg_calendar') {
    patch = { ...patch, title: payload.title, event_type: payload.event_type, client_id: payload.client_id, client_name: payload.client_name, start_at: payload.start_at, end_at: payload.end_at, all_day: payload.all_day, location: payload.location, status: payload.status, microsoft_source_type: payload.microsoft_source_type, microsoft_calendar_id: payload.microsoft_calendar_id, microsoft_event_id: payload.microsoft_event_id, microsoft_source_description: payload.microsoft_source_description }
  } else if (item.destination === 'planner') {
    if (removedAt) patch = { archived_at: removedAt, microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
    else if (payload?.destination === 'planner') patch = { ...patch, board_id: payload.board_id, bucket_id: payload.bucket_id, title: payload.title, status: payload.status, start_date: payload.start_date, due_date: payload.due_date, original_plan_name: payload.original_plan_name, original_bucket_name: payload.original_bucket_name, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_source_description: payload.microsoft_source_description, archived_at: null }
  } else if (item.destination === 'client_schedule') {
    if (removedAt) patch = { archived_at: removedAt, microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
    else if (payload?.destination === 'client_schedule') patch = { ...patch, client_id: payload.client_id, package_id: payload.package_id, template_id: payload.template_id, month: payload.month, code: payload.code, instance_number: payload.instance_number, deliverable_type: payload.deliverable_type, title: payload.title, production_status: payload.production_status, scheduled_date: payload.scheduled_date, microsoft_bucket_id: payload.microsoft_bucket_id, microsoft_source_description: payload.microsoft_source_description, archived_at: null }
  } else {
    if (removedAt) patch = { status: 'cancelled', microsoft_source_removed_at: removedAt, microsoft_sync_run_id: runId }
    else if (payload?.destination === 'cg_calendar') patch = { ...patch, title: payload.title, event_type: payload.event_type, start_at: payload.start_at, end_at: payload.end_at, all_day: payload.all_day, location: payload.location, ...(action === 'cancel' ? { status: 'cancelled' } : action === 'reopen' ? { status: 'planned' } : {}), microsoft_source_description: payload.microsoft_source_description }
  }
  const identity = sourceIdentity(item)
  const { data, error } = await supabase.rpc('apply_microsoft_sync_item', {
    p_run_id: runId, p_item_key: itemAuditKey, p_destination: item.destination, p_destination_id: item.existingTargetId,
    p_expected_updated_at: item.expectedTargetUpdatedAt, p_action: action, p_should_apply: shouldApply,
    p_patch: patch, p_source_type: identity.source_type, p_source_container_id: identity.source_container_id,
    p_source_item_id: identity.source_item_id, p_source_name: item.sourceName,
    p_source_complete: Boolean(item.sourceComplete), p_details: { title: item.title, warnings: item.warnings },
  })
  if (error) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const audit = await supabase.from('microsoft_sync_run_items').select('destination_id, result_status, safe_error').eq('run_id', runId).eq('item_key', itemAuditKey).maybeSingle()
      if (audit.data) return { status: audit.data.result_status === 'applied' ? 'applied' : audit.data.result_status === 'failed' ? 'failed' : 'skipped', destinationId: audit.data.destination_id as string | null, error: audit.data.safe_error as string | null }
      if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  return { status: error ? 'failed' : shouldApply ? 'applied' : 'skipped', destinationId: (data as string | null) ?? item.existingTargetId, error: error?.message ?? null }
}

export async function applyMicrosoftReconciliation(
  items: MicrosoftImportPreviewItem[],
  snapshot: MicrosoftSnapshot,
  approveRemovals: boolean,
  onProgress?: (completed: number, total: number) => void,
): Promise<MicrosoftReconciliationApplyResult> {
  const summary = summarizeMicrosoftReconciliation(items)
  const { data: { user } } = await supabase.auth.getUser()
  const rangeStarts = snapshot.sources.map(source => source.rangeStart).filter((value): value is string => Boolean(value))
  const rangeEnds = snapshot.sources.map(source => source.rangeEnd).filter((value): value is string => Boolean(value))
  const { data: run, error: runError } = await supabase.from('microsoft_sync_runs').insert({
    trigger_type: snapshot.triggerType, status: 'applying', snapshot_exported_at: snapshot.exportedAt,
    snapshot_exported_by: snapshot.exportedBy, range_start: rangeStarts.sort()[0] ?? null,
    range_end: rangeEnds.sort()[rangeEnds.length - 1] ?? null, source_completeness: snapshot.sources,
    summary, requested_by: user?.id ?? null,
  }).select('id').single()
  if (runError || !run) return { runId: null, summary, applied: 0, failed: 1, errors: [runError?.message ?? 'Could not create sync run.'] }

  let applied = 0
  let failed = 0
  let uncertain = 0
  const errors: string[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const identity = sourceIdentity(item)
    const itemAuditKey = `${identity.source_type}:${identity.source_container_id || 'missing'}:${identity.source_item_id || 'missing'}:${index}`
    let result: Awaited<ReturnType<typeof applyReconciliationItem>>
    try {
      result = await applyReconciliationItem(item, snapshot, run.id, itemAuditKey, approveRemovals)
    } catch {
      result = { status: 'failed', destinationId: item.existingTargetId, error: 'Unexpected destination write failure.' }
    }
    if (result.status === 'failed') {
      const { error: failedAuditError } = await supabase.from('microsoft_sync_run_items').upsert({
        run_id: run.id, item_key: itemAuditKey, ...identity, source_name: item.sourceName, destination: item.destination,
        destination_id: item.existingTargetId, action: item.reconciliationAction ?? 'failed',
        result_status: 'failed', source_complete: Boolean(item.sourceComplete),
        details: { title: item.title, warnings: item.warnings }, safe_error: result.error,
      }, { onConflict: 'run_id,item_key', ignoreDuplicates: true })
      const confirmed = await supabase.from('microsoft_sync_run_items').select('destination_id, result_status, safe_error').eq('run_id', run.id).eq('item_key', itemAuditKey).maybeSingle()
      if (confirmed.data?.result_status === 'applied') {
        result = { status: 'applied', destinationId: confirmed.data.destination_id as string | null, error: null }
      } else if (confirmed.data?.result_status === 'skipped') {
        result = { status: 'skipped', destinationId: confirmed.data.destination_id as string | null, error: null }
      } else if (confirmed.data?.result_status === 'failed') {
        failed += 1
        errors.push(`${item.title}: ${(confirmed.data.safe_error as string | null) ?? result.error ?? 'Apply failed.'}`)
      } else {
        uncertain += 1
        errors.push(`${item.title}: outcome verification is unavailable; inspect per-item history before retrying.`)
        if (failedAuditError) errors.push(`Failed-item audit: ${failedAuditError.message}`)
      }
    }
    if (result.status === 'applied') applied += 1
    onProgress?.(index + 1, items.length)
  }
  const status = uncertain > 0 || (failed > 0 && applied > 0) ? 'partial' : failed > 0 ? 'failed' : 'completed'
  const { error: finishError } = await supabase.from('microsoft_sync_runs').update({ status, summary: { ...summary, applied, failed, uncertain }, safe_error: errors[0] ?? null, applied_at: new Date().toISOString(), finished_at: new Date().toISOString() }).eq('id', run.id)
  if (finishError) errors.push(`Run finalization: ${finishError.message}`)
  return { runId: run.id, summary, applied, failed, errors }
}
