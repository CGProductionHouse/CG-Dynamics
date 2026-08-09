import { supabase } from './supabase'
import { fetchAllPages } from './paginatedQuery'
import type {
  MicrosoftExistingTarget,
  MicrosoftImportPreviewItem,
  MicrosoftReconciliationAction,
  MicrosoftReconciliationSummary,
  MicrosoftUnlinkedCalendarRow,
} from './microsoftImport'
import { summarizeMicrosoftReconciliation } from './microsoftImport'
import type { MicrosoftSnapshot } from './microsoftSnapshot'
import type { MicrosoftPreviewMappingContext, UnlinkedSlotRow } from './microsoftImportPreview'
import { deliverableSlotKey } from './microsoftImportPreview'
import {
  buildMicrosoftApplyRpcArgs,
  microsoftApplyPreflightError,
  microsoftRunFinalStatus,
  microsoftSourceIdentity,
} from './microsoftApply'
import {
  getMicrosoftExecutableItems,
  getMicrosoftReviewedItems,
  microsoftSafeApplyError,
  microsoftStableItemKey,
  type MicrosoftRecoveryAuditItem,
  type MicrosoftReviewedItem,
} from './microsoftRecovery'

// ── Supabase data layer for the Microsoft snapshot import (Option A) ─────────
//
// Read side: the live mapping context (clients, boards, buckets, packages,
// templates), the rows already carrying Microsoft source keys, and the
// occupied monthly_deliverables natural-key slots.
//
// Write side: reviewed executable actions use the admin-only per-item RPC.
// Conflicts and unchanged/skipped rows never write. Each successful destination
// action and audit row share one database transaction.
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
  const [clients, aliasRows, boards, buckets, packages, templates] = await Promise.all([
    supabase.from('clients').select('id, name').eq('active', true),
    supabase.from('client_aliases').select('client_id, alias'),
    supabase.from('planner_boards').select('id, slug').is('archived_at', null),
    supabase.from('planner_buckets').select('id, board_id, name').is('archived_at', null),
    supabase.from('client_packages').select('id, client_id, status').is('archived_at', null),
    supabase.from('package_deliverable_templates').select('id, package_id, code, deliverable_type, active'),
  ])
  const failed = [clients.error, aliasRows.error, boards.error, buckets.error, packages.error, templates.error].find(Boolean)
  if (failed) return { context: null, error: failed.message }

  // Client aliases live in the database beside the client (public.client_aliases),
  // so adding or correcting a spelling takes effect with NO application code
  // change or deploy. Only active clients are loaded, and the matcher still
  // enforces the active guard independently.
  const aliasesByClient = new Map<string, string[]>()
  for (const row of aliasRows.data ?? []) {
    const clientId = row.client_id as string
    aliasesByClient.set(clientId, [...(aliasesByClient.get(clientId) ?? []), row.alias as string])
  }

  return {
    context: {
      clients: (clients.data ?? []).map(row => ({
        id: row.id as string,
        name: row.name as string,
        active: true,
        aliases: aliasesByClient.get(row.id as string) ?? [],
      })),
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
  /** Slot key → occupying rows that have NO Microsoft task id (legacy rows
   *  eligible for deterministic link_existing). */
  unlinkedSlotRows: Map<string, UnlinkedSlotRow[]>
  /** Native calendar rows without a durable Outlook identity. Used only to
   * block ambiguous creates for review, never to infer source identity. */
  unlinkedCalendarRows: MicrosoftUnlinkedCalendarRow[]
  migrationNeeded: boolean
  error: string | null
}

export async function loadMicrosoftExistingTargets(): Promise<MicrosoftExistingResult> {
  const [plannerRows, deliverableRows, calendarRows, slotRows] = await Promise.all([
    fetchAllPages((from, to) => supabase
        .from('planner_tasks')
        .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, board_id, bucket_id, title, client_id, client_name, status, priority, start_date, due_date, notes, source, original_plan_name, original_bucket_name, assigned_to_name, helper_names')
        .not('microsoft_plan_id', 'is', null)
        .not('microsoft_task_id', 'is', null)
        .range(from, to)),
    fetchAllPages((from, to) => supabase
        .from('monthly_deliverables')
        .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, client_id, package_id, template_id, board_id, bucket_id, month, code, instance_number, title, deliverable_type, production_status, priority, scheduled_date, notes, assigned_to_user_id, assigned_to_name, helper_names')
        .not('microsoft_plan_id', 'is', null)
        .not('microsoft_task_id', 'is', null)
        .range(from, to)),
    fetchAllPages((from, to) => supabase
        .from('company_calendar_events')
        .select('id, updated_at, microsoft_calendar_id, microsoft_event_id, microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description, title, event_type, client_id, client_name, start_at, end_at, all_day, location, notes, status, superseded_by_event_id')
        .is('superseded_by_event_id', null)
        .range(from, to)),
    fetchAllPages((from, to) => supabase
        .from('monthly_deliverables')
        .select('id, updated_at, package_id, template_id, instance_number, month, microsoft_task_id')
        .range(from, to)),
  ])

  const microsoftError = [plannerRows.error, deliverableRows.error, calendarRows.error].find(Boolean)
  if (microsoftError) {
    if (isMissingMicrosoftColumnError(microsoftError)) {
      const deliverableSlotKeys = collectSlotKeys(slotRows.data ?? [])
      return { targets: [], deliverableSlotKeys, unlinkedSlotRows: collectUnlinkedSlotRows(slotRows.data ?? []), unlinkedCalendarRows: [], migrationNeeded: true, error: slotRows.error?.message ?? null }
    }
    return { targets: [], deliverableSlotKeys: new Set(), unlinkedSlotRows: new Map(), unlinkedCalendarRows: [], migrationNeeded: false, error: microsoftError.message }
  }
  if (slotRows.error) {
    return { targets: [], deliverableSlotKeys: new Set(), unlinkedSlotRows: new Map(), unlinkedCalendarRows: [], migrationNeeded: false, error: slotRows.error.message }
  }

  const partialCalendarIdentity = (calendarRows.data ?? []).find(row => Boolean(row.microsoft_calendar_id) !== Boolean(row.microsoft_event_id))
  if (partialCalendarIdentity) {
    return {
      targets: [],
      deliverableSlotKeys: new Set(),
      unlinkedSlotRows: new Map(),
      unlinkedCalendarRows: [],
      migrationNeeded: false,
      error: 'A CG Calendar row has an incomplete Outlook identity. Repair it before running Microsoft reconciliation.',
    }
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
        assigned_to_name: (row.assigned_to_name as string | null) ?? null,
        helper_names: Array.isArray(row.helper_names) ? row.helper_names as string[] : null,
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
        assigned_to_user_id: (row.assigned_to_user_id as string | null) ?? null,
        assigned_to_name: (row.assigned_to_name as string | null) ?? null,
        helper_names: Array.isArray(row.helper_names) ? row.helper_names as string[] : null,
      },
    })
  }
  for (const row of calendarRows.data ?? []) {
    if (!row.microsoft_calendar_id || !row.microsoft_event_id) continue
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

  const unlinkedCalendarRows = (calendarRows.data ?? [])
    .filter(row => !row.microsoft_calendar_id && !row.microsoft_event_id)
    .map(row => ({
      id: row.id as string,
      updatedAt: row.updated_at as string,
      title: row.title as string,
      startAt: row.start_at as string,
      endAt: row.end_at as string | null,
      allDay: Boolean(row.all_day),
    }))

  return { targets, deliverableSlotKeys: collectSlotKeys(slotRows.data ?? []), unlinkedSlotRows: collectUnlinkedSlotRows(slotRows.data ?? []), unlinkedCalendarRows, migrationNeeded: false, error: null }
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

// Slot key → rows on that slot that carry NO Microsoft task id (legacy rows the
// reconciliation may deterministically link instead of duplicating).
function collectUnlinkedSlotRows(rows: Array<Record<string, unknown>>): Map<string, UnlinkedSlotRow[]> {
  const map = new Map<string, UnlinkedSlotRow[]>()
  for (const row of rows) {
    if (row.microsoft_task_id) continue // already linked to a Microsoft task
    const key = deliverableSlotKey(
      row.package_id as string | null,
      row.template_id as string | null,
      row.instance_number as number | null,
      row.month as string | null,
    )
    const id = row.id as string | null
    if (!key || !id) continue
    map.set(key, [...(map.get(key) ?? []), { id, updatedAt: (row.updated_at as string | null) ?? '' }])
  }
  return map
}

export type MicrosoftTransitionStatus = 'active' | 'paused' | 'complete'

export interface MicrosoftSyncRunSummary {
  id: string
  status: 'previewed' | 'applying' | 'completed' | 'partial' | 'failed'
  triggerType: 'admin' | 'agent'
  snapshotExportedAt: string
  summary: Partial<MicrosoftReconciliationSummary> & {
    reviewed?: number
    applied?: number
    previouslyApplied?: number
    failed?: number
    notAttempted?: number
    conflictsUntouched?: number
    uncertain?: number
  }
  sourceCompleteness: Array<{ sourceName: string; complete: boolean; safeError: string | null }>
  safeError: string | null
  createdAt: string
  finishedAt: string | null
  previewJobId: string | null
  retryOfRunId: string | null
  reviewedItems: MicrosoftReviewedItem[]
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
  itemKey: string
  sourceType: MicrosoftImportPreviewItem['sourceType']
  sourceContainerId: string
  sourceItemId: string
}

export async function loadMicrosoftSyncRunItems(runId: string): Promise<{ data: MicrosoftSyncRunItem[]; error: string | null }> {
  const { data, error } = await fetchAllPages((from, to) => supabase
    .from('microsoft_sync_run_items')
    .select('id, item_key, source_type, source_container_id, source_item_id, source_name, destination, destination_id, action, result_status, source_complete, details, safe_error')
    .eq('run_id', runId)
    .order('created_at')
    .range(from, to))
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
    safeError: microsoftSafeApplyError(row.safe_error as string | null),
    itemKey: row.item_key as string,
    sourceType: row.source_type as MicrosoftImportPreviewItem['sourceType'],
    sourceContainerId: row.source_container_id as string,
    sourceItemId: row.source_item_id as string,
  })), error: null }
}

export async function loadMicrosoftSyncState(): Promise<MicrosoftSyncStateResult> {
  const [settings, runs] = await Promise.all([
    supabase.from('microsoft_sync_settings').select('transition_status').eq('id', true).maybeSingle(),
    supabase.from('microsoft_sync_runs').select('id, status, trigger_type, snapshot_exported_at, summary, source_completeness, safe_error, created_at, finished_at, preview_job_id, retry_of_run_id, reviewed_items').order('created_at', { ascending: false }).limit(12),
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
      safeError: microsoftSafeApplyError(row.safe_error as string | null),
      createdAt: row.created_at as string,
      finishedAt: row.finished_at as string | null,
      previewJobId: row.preview_job_id as string | null,
      retryOfRunId: row.retry_of_run_id as string | null,
      reviewedItems: (row.reviewed_items ?? []) as unknown as MicrosoftReviewedItem[],
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

async function microsoftFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context
  if (context) {
    try {
      const body = await context.clone().json() as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) return body.error
    } catch {
      // The platform may return an HTML or empty timeout response.
    }
    if (context.status === 504) {
      return 'Microsoft preview timed out before every source finished. Nothing was applied. Retry once; if it continues, ask an admin to check the Microsoft Sync function logs.'
    }
    if (context.status === 401 || context.status === 403) {
      return 'Your session cannot run Microsoft Sync. Sign in again with an active CG Dynamics admin account.'
    }
  }

  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export async function getMicrosoftConnectionStatus(): Promise<{ data: MicrosoftConnectionStatus | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('microsoft-transition-sync', { body: { action: 'status' } })
  if (error) return { data: null, error: await microsoftFunctionError(error, 'Microsoft connection status failed.') }
  if (!data?.ok) return { data: null, error: data?.error ?? 'Microsoft connection status failed.' }
  return { data: { connected: Boolean(data.connected), message: data.message as string, sources: data.sources ?? [] }, error: null }
}

// ── Durable preview job ───────────────────────────────────────────────────────
// Replaces the single long-running fetch. The heavy Planner sources are fetched
// in bounded batches by microsoft-transition-sync; the admin page starts a job,
// polls status, drives processing, resumes and retries. Apply stays blocked
// until every required source completes.

export interface MicrosoftJobSourceStatus {
  id: string
  position: number
  sourceType: 'outlook_calendar' | 'planner_plan'
  sourceId: string
  sourceName: string
  required: boolean
  stage: 'queued' | 'fetching_tasks' | 'fetching_details' | 'complete' | 'failed'
  recordCount: number
  complete: boolean
  safeError: string | null
  detailsRemaining: number
}

export interface MicrosoftJobProgress {
  total: number
  complete: number
  failed: number
  fetching: number
  queued: number
  detailsRemaining: number
  allRequiredComplete: boolean
  anyFailed: boolean
  finished: boolean
}

export interface MicrosoftJobState {
  jobId: string
  status: string
  sources: MicrosoftJobSourceStatus[]
  progress: MicrosoftJobProgress
}

function toJobState(data: Record<string, unknown>): MicrosoftJobState {
  return {
    jobId: String(data.jobId ?? ''),
    status: String(data.status ?? 'running'),
    sources: (data.sources as MicrosoftJobSourceStatus[]) ?? [],
    progress: (data.progress as MicrosoftJobProgress) ?? { total: 0, complete: 0, failed: 0, fetching: 0, queued: 0, detailsRemaining: 0, allRequiredComplete: false, anyFailed: false, finished: false },
  }
}

async function invokeMicrosoftJob(body: Record<string, unknown>, fallback: string): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('microsoft-transition-sync', { body })
  if (error) return { data: null, error: await microsoftFunctionError(error, fallback) }
  if (!data?.ok) return { data: null, error: (data?.error as string) ?? fallback }
  return { data: data as Record<string, unknown>, error: null }
}

export async function startMicrosoftPreviewJob(rangeStart: string, rangeEnd: string): Promise<{ job: MicrosoftJobState | null; error: string | null }> {
  const { data, error } = await invokeMicrosoftJob({ action: 'job_start', rangeStart, rangeEnd }, 'Could not start the Microsoft preview job.')
  return { job: data ? toJobState(data) : null, error }
}

export async function processMicrosoftPreviewJob(jobId: string): Promise<{ job: MicrosoftJobState | null; finished: boolean; error: string | null }> {
  const { data, error } = await invokeMicrosoftJob({ action: 'job_process', jobId }, 'A Microsoft preview source could not be fetched.')
  if (!data) return { job: null, finished: false, error }
  return { job: toJobState({ ...data, jobId }), finished: Boolean(data.finished), error: null }
}

export async function getMicrosoftJobStatus(jobId: string): Promise<{ job: MicrosoftJobState | null; error: string | null }> {
  const { data, error } = await invokeMicrosoftJob({ action: 'job_status', jobId }, 'Could not read the Microsoft preview status.')
  return { job: data ? toJobState({ ...data, jobId }) : null, error }
}

export async function retryMicrosoftJobFailedSources(jobId: string): Promise<{ job: MicrosoftJobState | null; error: string | null }> {
  const { data, error } = await invokeMicrosoftJob({ action: 'job_retry', jobId }, 'Could not retry the failed Microsoft sources.')
  return { job: data ? toJobState({ ...data, jobId }) : null, error }
}

export async function getMicrosoftLatestJob(): Promise<{ job: MicrosoftJobState | null; error: string | null }> {
  const { data, error } = await invokeMicrosoftJob({ action: 'job_latest' }, 'Could not resume the Microsoft preview job.')
  if (!data) return { job: null, error }
  const job = data.job as { jobId?: string; status?: string } | null
  if (!job?.jobId) return { job: null, error: null }
  return { job: toJobState({ jobId: job.jobId, status: job.status, sources: data.sources, progress: data.progress }), error: null }
}

export async function getMicrosoftPreviewResult(jobId: string): Promise<{ snapshot: MicrosoftSnapshot | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('microsoft-transition-sync', { body: { action: 'job_result', jobId } })
  if (error) return { snapshot: null, error: await microsoftFunctionError(error, 'Microsoft preview assembly failed.') }
  if (!data?.ok || !data.snapshot) return { snapshot: null, error: (data?.error as string) ?? 'The preview is not complete yet.' }
  return { snapshot: data.snapshot as MicrosoftSnapshot, error: null }
}

export interface MicrosoftRecoveryContext {
  sourceRun: MicrosoftSyncRunSummary
  snapshot: MicrosoftSnapshot
  auditItems: MicrosoftRecoveryAuditItem[]
  previewJobId: string
}

export async function loadMicrosoftRecoveryContext(runId: string): Promise<{
  data: MicrosoftRecoveryContext | null
  error: string | null
}> {
  const { data: row, error: runError } = await supabase
    .from('microsoft_sync_runs')
    .select('id, status, trigger_type, snapshot_exported_at, summary, source_completeness, safe_error, created_at, finished_at, preview_job_id, retry_of_run_id, reviewed_items')
    .eq('id', runId)
    .single()
  if (runError || !row) return { data: null, error: runError?.message ?? 'Recovery run could not be loaded.' }

  const itemResult = await loadMicrosoftSyncRunItems(runId)
  if (itemResult.error) return { data: null, error: itemResult.error }

  let previewJobId = row.preview_job_id as string | null
  if (!previewJobId) {
    const { data: matchedJob, error: jobError } = await supabase
      .from('microsoft_sync_jobs')
      .select('id')
      .eq('exported_at', row.snapshot_exported_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (jobError) return { data: null, error: jobError.message }
    previewJobId = (matchedJob?.id as string | undefined) ?? null
  }
  if (!previewJobId) {
    return { data: null, error: 'The preserved preview job for this run could not be found. No Microsoft refetch was started.' }
  }

  const snapshotResult = await getMicrosoftPreviewResult(previewJobId)
  if (!snapshotResult.snapshot) return { data: null, error: snapshotResult.error ?? 'The preserved preview could not be restored.' }

  let reviewedItems = (row.reviewed_items ?? []) as unknown as MicrosoftReviewedItem[]
  if (reviewedItems.length === 0) {
    reviewedItems = itemResult.data
      .filter(item => item.resultStatus !== 'skipped' && !['unchanged', 'conflict', 'skipped', 'failed', 'package_template_create'].includes(item.action))
      .map(item => ({
        key: `${item.sourceType}:${item.sourceContainerId || 'missing'}:${item.sourceItemId || 'missing'}`,
        sourceType: item.sourceType,
        sourceContainerId: item.sourceContainerId,
        sourceItemId: item.sourceItemId,
        sourceName: item.sourceName,
        title: item.details.title ?? 'Microsoft item',
        action: item.action,
        // Legacy runs did not persist the separate removal checkbox. A failed
        // removal is not proof of approval, so recovery fails closed.
        removalApproved: item.resultStatus === 'applied' && (item.action === 'cancel' || item.action === 'archive'),
      }))
  }

  const sourceRun: MicrosoftSyncRunSummary = {
    id: row.id as string,
    status: row.status as MicrosoftSyncRunSummary['status'],
    triggerType: row.trigger_type as MicrosoftSyncRunSummary['triggerType'],
    snapshotExportedAt: row.snapshot_exported_at as string,
    summary: (row.summary ?? {}) as MicrosoftSyncRunSummary['summary'],
    sourceCompleteness: (row.source_completeness ?? []) as MicrosoftSyncRunSummary['sourceCompleteness'],
    safeError: microsoftSafeApplyError(row.safe_error as string | null),
    createdAt: row.created_at as string,
    finishedAt: row.finished_at as string | null,
    previewJobId,
    retryOfRunId: row.retry_of_run_id as string | null,
    reviewedItems,
  }
  const auditItems: MicrosoftRecoveryAuditItem[] = itemResult.data.map(item => ({
    key: `${item.sourceType}:${item.sourceContainerId || 'missing'}:${item.sourceItemId || 'missing'}`,
    resultStatus: item.resultStatus,
    safeError: item.safeError,
  }))
  return { data: { sourceRun, snapshot: snapshotResult.snapshot, auditItems, previewJobId }, error: null }
}

export async function loadMicrosoftProfiles(): Promise<{ data: Array<{ id: string; email: string | null; full_name: string | null }>; error: string | null }> {
  const { data, error } = await supabase.from('profiles').select('id, email, full_name')
  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

export async function loadMicrosoftUserMappings(): Promise<{ data: Map<string, string>; error: string | null }> {
  const { data, error } = await supabase.from('microsoft_user_mappings').select('microsoft_user_id, cg_user_id')
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return { data: new Map(), error: null }
    return { data: new Map(), error: error.message }
  }
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.cg_user_id) map.set(row.microsoft_user_id as string, row.cg_user_id as string)
  }
  return { data: map, error: null }
}

export interface MicrosoftReconciliationApplyResult {
  runId: string | null
  summary: MicrosoftReconciliationSummary
  applied: number
  failed: number
  previouslyApplied: number
  notAttempted: number
  conflictsUntouched: number
  errors: string[]
}

export interface MicrosoftApplyOptions {
  previewJobId?: string | null
  retryOfRunId?: string | null
  reviewedItems?: MicrosoftReviewedItem[]
  previouslyApplied?: number
  conflictsUntouched?: number
}

async function applyReconciliationItem(item: MicrosoftImportPreviewItem, snapshot: MicrosoftSnapshot, runId: string, itemAuditKey: string, approveRemovals: boolean): Promise<{ status: 'applied' | 'skipped' | 'failed'; destinationId: string | null; error: string | null }> {
  // package_template_create: insert the missing template first (idempotent,
  // admin-only RPC), then create the dependent deliverable against it as a normal
  // create. A repeat apply returns the existing template + existing run item, so
  // no second template and no duplicate deliverable are produced.
  if (item.reconciliationAction === 'package_template_create'
      && item.proposedPayload?.destination === 'client_schedule'
      && item.proposedTemplate) {
    const payload = item.proposedPayload
    const { data: templateId, error: templateError } = await supabase.rpc('apply_microsoft_package_template_correction', {
      p_run_id: runId,
      p_package_id: payload.package_id,
      p_client_id: payload.client_id,
      p_code: item.proposedTemplate.code,
      p_deliverable_type: item.proposedTemplate.deliverable_type,
      p_instance_number: item.proposedTemplate.instance_number,
    })
    if (templateError || !templateId) {
      return { status: 'failed', destinationId: null, error: templateError?.message ?? 'Package template correction failed.' }
    }
    const createItem: MicrosoftImportPreviewItem = {
      ...item,
      reconciliationAction: 'create',
      proposedPayload: { ...payload, template_id: templateId as string },
    }
    return applyReconciliationItem(createItem, snapshot, runId, itemAuditKey, approveRemovals)
  }

  const args = buildMicrosoftApplyRpcArgs(item, snapshot, runId, itemAuditKey, approveRemovals)
  const { data, error } = await supabase.rpc('apply_microsoft_sync_item', args)
  if (error) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const audit = await supabase.from('microsoft_sync_run_items').select('destination_id, result_status, safe_error').eq('run_id', runId).eq('item_key', itemAuditKey).maybeSingle()
      if (audit.data) return { status: audit.data.result_status === 'applied' ? 'applied' : audit.data.result_status === 'failed' ? 'failed' : 'skipped', destinationId: audit.data.destination_id as string | null, error: audit.data.safe_error as string | null }
      if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  return { status: error ? 'failed' : args.p_should_apply ? 'applied' : 'skipped', destinationId: (data as string | null) ?? item.existingTargetId, error: error?.message ?? null }
}

export async function checkMicrosoftApplyVersion(): Promise<string | null> {
  const [apply, recovery] = await Promise.all([
    supabase.rpc('microsoft_sync_apply_version'),
    supabase.rpc('microsoft_sync_recovery_version'),
  ])
  const applyError = microsoftApplyPreflightError(apply.data, apply.error)
  if (applyError) return applyError
  if (recovery.error || recovery.data !== 1) {
    return 'Microsoft Sync recovery requires migration 20260728123000_microsoft_apply_recovery.sql.'
  }
  return null
}

export async function applyMicrosoftReconciliation(
  items: MicrosoftImportPreviewItem[],
  snapshot: MicrosoftSnapshot,
  approveRemovals: boolean,
  onProgress?: (completed: number, total: number) => void,
  options: MicrosoftApplyOptions = {},
): Promise<MicrosoftReconciliationApplyResult> {
  const summary = summarizeMicrosoftReconciliation(items)
  const preflightError = await checkMicrosoftApplyVersion()
  if (preflightError) return { runId: null, summary, applied: 0, failed: 1, previouslyApplied: options.previouslyApplied ?? 0, notAttempted: 0, conflictsUntouched: options.conflictsUntouched ?? summary.conflict, errors: [preflightError] }

  const executableItems = getMicrosoftExecutableItems(items, approveRemovals)
  const reviewedItems = options.reviewedItems ?? getMicrosoftReviewedItems(items, approveRemovals)
  const previouslyApplied = options.previouslyApplied ?? 0
  const conflictsUntouched = options.conflictsUntouched ?? summary.conflict

  const { data: { user } } = await supabase.auth.getUser()
  const rangeStarts = snapshot.sources.map(source => source.rangeStart).filter((value): value is string => Boolean(value))
  const rangeEnds = snapshot.sources.map(source => source.rangeEnd).filter((value): value is string => Boolean(value))
  const { data: run, error: runError } = await supabase.from('microsoft_sync_runs').insert({
    trigger_type: snapshot.triggerType, status: 'applying', snapshot_exported_at: snapshot.exportedAt,
    snapshot_exported_by: snapshot.exportedBy, range_start: rangeStarts.sort()[0] ?? null,
    range_end: rangeEnds.sort()[rangeEnds.length - 1] ?? null, source_completeness: snapshot.sources,
    summary: { ...summary, reviewed: reviewedItems.length, previouslyApplied, conflictsUntouched },
    requested_by: user?.id ?? null,
    preview_job_id: options.previewJobId ?? null,
    retry_of_run_id: options.retryOfRunId ?? null,
    reviewed_items: reviewedItems,
  }).select('id').single()
  if (runError || !run) return { runId: null, summary, applied: 0, failed: 1, previouslyApplied, notAttempted: reviewedItems.length, conflictsUntouched, errors: [runError?.message ?? 'Could not create sync run.'] }

  let applied = 0
  let failed = 0
  let uncertain = 0
  const errors: string[] = []
  // Deterministic dependency order: package-template corrections first (a
  // dependent create needs its template), then legacy links, then creates, then
  // safe updates. Everything else keeps its relative order.
  const APPLY_ORDER: Record<string, number> = { package_template_create: 0, link_existing: 1, create: 2, update: 3 }
  const ordered = executableItems
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (APPLY_ORDER[a.item.reconciliationAction ?? ''] ?? 8) - (APPLY_ORDER[b.item.reconciliationAction ?? ''] ?? 8) || a.i - b.i)
    .map(entry => entry.item)
  try {
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index]
      const identity = microsoftSourceIdentity(item)
      const itemAuditKey = microsoftStableItemKey(item)
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
        }, { onConflict: 'run_id,item_key' })
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
      onProgress?.(index + 1, ordered.length)
    }
  } catch {
    failed += 1
    errors.push('Microsoft reconciliation stopped unexpectedly. Applied item history and reviewed identities were retained; use failed-change recovery before retrying.')
  }
  const status = microsoftRunFinalStatus(applied, failed, uncertain)
  const notAttempted = Math.max(0, reviewedItems.length - applied - failed)
  const safeErrors = errors.map(error => microsoftSafeApplyError(error) ?? error)
  const { error: finishError } = await supabase.from('microsoft_sync_runs').update({
    status,
    summary: { ...summary, reviewed: reviewedItems.length, applied, previouslyApplied, failed, notAttempted, conflictsUntouched, uncertain },
    safe_error: safeErrors[0] ?? null,
    applied_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  }).eq('id', run.id)
  if (finishError) safeErrors.push(`Run finalization: ${microsoftSafeApplyError(finishError.message) ?? finishError.message}`)
  return { runId: run.id, summary, applied, failed, previouslyApplied, notAttempted, conflictsUntouched, errors: safeErrors }
}
