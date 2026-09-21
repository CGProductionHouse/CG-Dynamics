/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase Edge query builders are runtime-loaded and intentionally structural here. */
import { buildMicrosoftReconciliation } from '../../../src/lib/microsoftSync.ts'
import { buildMicrosoftApplyRpcArgs, microsoftRunFinalStatus } from '../../../src/lib/microsoftApply.ts'
import { microsoftStableItemKey } from '../../../src/lib/microsoftRecovery.ts'
import type { MicrosoftExistingTarget } from '../../../src/lib/microsoftImport.ts'
import type { MicrosoftPreviewMappingContext } from '../../../src/lib/microsoftImportPreview.ts'
import type { MicrosoftSnapshot } from '../../../src/lib/microsoftSnapshot.ts'

type Db = { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }

export interface AutomaticReconciliationResult {
  status: 'completed' | 'partial' | 'failed'
  runId: string | null
  applied: number
  skipped: number
  failed: number
  conflicts: number
  clientScheduleExcluded: number
  error: string | null
}

/** Applies only already-approved Planner and Outlook mirror domains.
 * Client Schedule is excluded categorically, and every update uses an exact
 * durable Microsoft identity plus the established optimistic-lock contract. */
export async function applyAutomaticMicrosoftMirrors(db: Db, snapshot: MicrosoftSnapshot, previewJobId: string): Promise<AutomaticReconciliationResult> {
  const [clients, aliases, boards, buckets, planner, calendar] = await Promise.all([
    db.from('clients').select('id,name,active').eq('active', true),
    db.from('client_aliases').select('client_id,alias'),
    db.from('planner_boards').select('id,slug').is('archived_at', null),
    db.from('planner_buckets').select('id,board_id,name').is('archived_at', null),
    db.from('planner_tasks').select('id,updated_at,microsoft_plan_id,microsoft_task_id,microsoft_last_synced_at,microsoft_source_hash,microsoft_source_removed_at,board_id,bucket_id,title,client_id,client_name,status,priority,start_date,due_date,notes,source,original_plan_name,original_bucket_name,assigned_to_name,helper_names').not('microsoft_task_id', 'is', null),
    db.from('company_calendar_events').select('id,updated_at,microsoft_calendar_id,microsoft_event_id,microsoft_last_synced_at,microsoft_source_hash,microsoft_source_removed_at,title,event_type,client_id,client_name,start_at,end_at,all_day,location,notes,status'),
  ])
  const readError = [clients, aliases, boards, buckets, planner, calendar].find(result => result.error)?.error
  if (readError) return { status: 'failed', runId: null, applied: 0, skipped: 0, failed: 1, conflicts: 0, clientScheduleExcluded: 0, error: readError.message }
  const aliasesByClient = new Map<string, string[]>()
  for (const row of aliases.data ?? []) aliasesByClient.set(row.client_id, [...(aliasesByClient.get(row.client_id) ?? []), row.alias])
  const context: MicrosoftPreviewMappingContext = {
    clients: (clients.data ?? []).map((row: any) => ({ id: row.id, name: row.name, active: row.active, aliases: aliasesByClient.get(row.id) ?? [] })),
    boards: (boards.data ?? []).map((row: any) => ({ id: row.id, slug: row.slug })),
    buckets: (buckets.data ?? []).map((row: any) => ({ id: row.id, boardId: row.board_id, name: row.name })),
    packages: [], templates: [],
  }
  const targets: MicrosoftExistingTarget[] = [
    ...(planner.data ?? []).map((row: any) => ({
      destination: 'planner' as const, id: row.id, updatedAt: row.updated_at, microsoftLastSyncedAt: row.microsoft_last_synced_at,
      microsoftSourceHash: row.microsoft_source_hash, microsoftSourceRemovedAt: row.microsoft_source_removed_at,
      microsoftPlanId: row.microsoft_plan_id, microsoftTaskId: row.microsoft_task_id,
      payload: { board_id: row.board_id, bucket_id: row.bucket_id, title: row.title, client_id: row.client_id, client_name: row.client_name, status: row.status, priority: row.priority, start_date: row.start_date, due_date: row.due_date, notes: row.notes, source: row.source, original_plan_name: row.original_plan_name, original_bucket_name: row.original_bucket_name, microsoft_source_description: row.notes, assigned_to_name: row.assigned_to_name, helper_names: row.helper_names },
    })),
    ...(calendar.data ?? []).filter((row: any) => row.microsoft_calendar_id && row.microsoft_event_id).map((row: any) => ({
      destination: 'cg_calendar' as const, id: row.id, updatedAt: row.updated_at, microsoftLastSyncedAt: row.microsoft_last_synced_at,
      microsoftSourceHash: row.microsoft_source_hash, microsoftSourceRemovedAt: row.microsoft_source_removed_at,
      microsoftCalendarId: row.microsoft_calendar_id, microsoftEventId: row.microsoft_event_id,
      payload: { title: row.title, event_type: row.event_type, client_id: row.client_id, client_name: row.client_name, start_at: row.start_at, end_at: row.end_at, all_day: row.all_day, location: row.location, notes: row.notes, status: row.status, microsoft_source_description: row.notes },
    })),
  ]
  const nativeCalendarRows = (calendar.data ?? []).filter((row: any) => !row.microsoft_calendar_id && !row.microsoft_event_id && row.status !== 'cancelled').map((row: any) => ({ id: row.id, updatedAt: row.updated_at, title: row.title, startAt: row.start_at, endAt: row.end_at, allDay: Boolean(row.all_day), status: row.status }))
  const preview = buildMicrosoftReconciliation(snapshot, context, targets, new Set(), items => items, new Map(), nativeCalendarRows)
  const clientScheduleExcluded = preview.filter(item => item.destination === 'client_schedule').length
  const items = preview.filter(item => item.destination === 'planner' || item.destination === 'cg_calendar')
  const conflicts = items.filter(item => item.reconciliationAction === 'conflict').length
  const { data: run, error: runError } = await db.from('microsoft_sync_runs').insert({
    trigger_type: 'agent', status: 'applying', snapshot_exported_at: snapshot.exportedAt,
    source_completeness: snapshot.sources, preview_job_id: previewJobId,
    summary: { automatic: true, reviewed: items.length, clientScheduleExcluded, conflicts }, reviewed_items: [],
  }).select('id').single()
  if (runError || !run) return { status: 'failed', runId: null, applied: 0, skipped: 0, failed: 1, conflicts, clientScheduleExcluded, error: runError?.message ?? 'Could not create automatic reconciliation run.' }
  let applied = 0; let skipped = 0; let failed = 0; let firstError: string | null = null
  for (const item of items) {
    const args = buildMicrosoftApplyRpcArgs(item, snapshot, run.id, microsoftStableItemKey(item), true)
    const result = await db.rpc('apply_microsoft_sync_item', args as unknown as Record<string, unknown>)
    if (result.error) { failed += 1; firstError ??= result.error.message }
    else if (args.p_should_apply) applied += 1
    else skipped += 1
  }
  const status = failed > 0 ? microsoftRunFinalStatus(applied, failed, 0) : conflicts > 0 ? 'partial' as const : 'completed' as const
  await db.from('microsoft_sync_runs').update({ status, finished_at: new Date().toISOString(), applied_at: new Date().toISOString(), safe_error: firstError, summary: { automatic: true, applied, skipped, failed, conflicts, clientScheduleExcluded } }).eq('id', run.id)
  return { status, runId: run.id, applied, skipped, failed, conflicts, clientScheduleExcluded, error: firstError }
}
