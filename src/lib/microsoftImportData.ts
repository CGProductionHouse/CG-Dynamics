import { supabase } from './supabase'
import type {
  MicrosoftExistingTarget,
  MicrosoftImportPreviewItem,
} from './microsoftImport'
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
      .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, board_id, bucket_id, title, client_id, client_name, status, priority, start_date, due_date, notes, source, original_plan_name, original_bucket_name')
      .not('microsoft_plan_id', 'is', null)
      .not('microsoft_task_id', 'is', null),
    supabase
      .from('monthly_deliverables')
      .select('id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at, client_id, package_id, template_id, board_id, bucket_id, month, code, instance_number, title, deliverable_type, production_status, priority, scheduled_date, notes')
      .not('microsoft_plan_id', 'is', null)
      .not('microsoft_task_id', 'is', null),
    supabase
      .from('company_calendar_events')
      .select('id, updated_at, microsoft_calendar_id, microsoft_event_id, microsoft_last_synced_at, title, event_type, client_id, client_name, start_at, end_at, all_day, location, notes, status')
      .not('microsoft_calendar_id', 'is', null)
      .not('microsoft_event_id', 'is', null),
    supabase
      .from('monthly_deliverables')
      .select('package_id, template_id, instance_number, month')
      .is('archived_at', null),
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
      microsoftPlanId: row.microsoft_plan_id as string,
      microsoftTaskId: row.microsoft_task_id as string,
      payload: {
        board_id: row.board_id as string | null,
        bucket_id: row.bucket_id as string | null,
        title: row.title as string,
        client_id: row.client_id as string | null,
        client_name: row.client_name as string | null,
        status: row.status as 'to_do' | 'in_progress' | 'approved',
        // Real row value: an edited priority must fail the material compare.
        priority: row.priority as 'normal',
        start_date: row.start_date as string | null,
        due_date: row.due_date as string | null,
        notes: row.notes as string | null,
        // Real row value for the material compare (may be 'teams_import').
        source: row.source as 'microsoft_import',
        original_plan_name: row.original_plan_name as string,
        original_bucket_name: row.original_bucket_name as string,
      },
    })
  }
  for (const row of deliverableRows.data ?? []) {
    targets.push({
      destination: 'client_schedule',
      id: row.id as string,
      updatedAt: row.updated_at as string,
      microsoftLastSyncedAt: (row.microsoft_last_synced_at as string | null) ?? null,
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
        production_status: row.production_status as 'to_do' | 'in_progress' | 'scheduled',
        priority: row.priority as 'normal',
        scheduled_date: row.scheduled_date as string | null,
        notes: row.notes as string | null,
      },
    })
  }
  for (const row of calendarRows.data ?? []) {
    targets.push({
      destination: 'cg_calendar',
      id: row.id as string,
      updatedAt: row.updated_at as string,
      microsoftLastSyncedAt: (row.microsoft_last_synced_at as string | null) ?? null,
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
        status: (row.status as string) === 'cancelled' ? 'cancelled' : 'planned',
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

export interface MicrosoftApplyResult {
  plannerInserted: number
  deliverablesInserted: number
  eventsInserted: number
  skippedNotNew: number
  errors: string[]
}

// Insert-only apply for `new` preview items. Idempotency layers:
//   1. Reruns of the same snapshot classify already-applied rows as
//      `existing` (Microsoft source keys), so they never reach apply again.
//   2. planner_tasks keeps its unique import_hash (`ms-<planId>-<taskId>`)
//      with ignoreDuplicates, so even a double-submit cannot duplicate.
//   3. The phase-15a partial unique indexes on the Microsoft source keys
//      reject duplicates at the database level as a final guard.
export async function applyMicrosoftImport(
  items: MicrosoftImportPreviewItem[],
  syncedAt: string,
): Promise<MicrosoftApplyResult> {
  const result: MicrosoftApplyResult = { plannerInserted: 0, deliverablesInserted: 0, eventsInserted: 0, skippedNotNew: 0, errors: [] }
  const newItems = items.filter(item => item.previewStatus === 'new' && item.proposedPayload !== null)
  result.skippedNotNew = items.length - newItems.length

  const plannerRows: Record<string, unknown>[] = []
  const deliverableRows: Record<string, unknown>[] = []
  const eventRows: Record<string, unknown>[] = []

  for (const item of newItems) {
    const payload = item.proposedPayload
    if (!payload) continue
    if (payload.destination === 'planner') {
      plannerRows.push({
        board_id: payload.board_id,
        bucket_id: payload.bucket_id,
        title: payload.title,
        client_id: payload.client_id,
        client_name: payload.client_name,
        status: payload.status,
        priority: payload.priority,
        start_date: payload.start_date,
        due_date: payload.due_date,
        notes: payload.notes,
        source: 'microsoft_import',
        original_plan_name: payload.original_plan_name,
        original_bucket_name: payload.original_bucket_name,
        original_task_id: payload.microsoft_task_id,
        import_hash: `ms-${payload.microsoft_plan_id}-${payload.microsoft_task_id}`,
        microsoft_source_type: payload.microsoft_source_type,
        microsoft_plan_id: payload.microsoft_plan_id,
        microsoft_bucket_id: payload.microsoft_bucket_id,
        microsoft_task_id: payload.microsoft_task_id,
        microsoft_last_synced_at: syncedAt,
      })
    } else if (payload.destination === 'client_schedule') {
      deliverableRows.push({
        client_id: payload.client_id,
        package_id: payload.package_id,
        template_id: payload.template_id,
        board_id: payload.board_id,
        bucket_id: payload.bucket_id,
        month: payload.month,
        code: payload.code,
        instance_number: payload.instance_number,
        title: payload.title,
        deliverable_type: payload.deliverable_type,
        production_status: payload.production_status,
        priority: payload.priority,
        scheduled_date: payload.scheduled_date,
        notes: payload.notes,
        microsoft_source_type: payload.microsoft_source_type,
        microsoft_plan_id: payload.microsoft_plan_id,
        microsoft_bucket_id: payload.microsoft_bucket_id,
        microsoft_task_id: payload.microsoft_task_id,
        microsoft_last_synced_at: syncedAt,
      })
    } else {
      eventRows.push({
        title: payload.title,
        event_type: payload.event_type,
        client_id: payload.client_id,
        client_name: payload.client_name,
        start_at: payload.start_at,
        end_at: payload.end_at,
        all_day: payload.all_day,
        location: payload.location,
        notes: payload.notes,
        status: payload.status,
        microsoft_source_type: payload.microsoft_source_type,
        microsoft_calendar_id: payload.microsoft_calendar_id,
        microsoft_event_id: payload.microsoft_event_id,
        microsoft_last_synced_at: syncedAt,
      })
    }
  }

  if (plannerRows.length > 0) {
    const { data, error } = await supabase
      .from('planner_tasks')
      .upsert(plannerRows, { onConflict: 'import_hash', ignoreDuplicates: true })
      .select('id')
    if (error) result.errors.push(`Planner: ${error.message}`)
    else result.plannerInserted = data?.length ?? 0
  }
  if (deliverableRows.length > 0) {
    const { data, error } = await supabase
      .from('monthly_deliverables')
      .insert(deliverableRows)
      .select('id')
    if (error) result.errors.push(`Client Schedule: ${error.message}`)
    else result.deliverablesInserted = data?.length ?? 0
  }
  if (eventRows.length > 0) {
    const { data, error } = await supabase
      .from('company_calendar_events')
      .insert(eventRows)
      .select('id')
    if (error) result.errors.push(`CG Calendar: ${error.message}`)
    else result.eventsInserted = data?.length ?? 0
  }
  return result
}
