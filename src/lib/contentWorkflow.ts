import { supabase } from './supabase'
import {
  canAddGuideToRun,
  guideActionTarget,
  isMicrosoftOwnedEvent,
  mapRunStatusToCalendar,
  runItemFieldsFromGuide,
  type ContentGuideAction,
  type ContentGuideStatus,
  type ContentRunStatus,
} from './contentWorkflowRules'
import {
  createCompanyEvent,
  getCompanyEvent,
  updateCompanyEvent,
  type CompanyEventPatch,
} from './companyCalendar'
import {
  applyVideoTransition,
  type VideoAction,
  type VideoProductionStatus,
  type VideoTransitionContext,
} from './videoPipelineRules'

// ── Content Workflow data access ──────────────────────────────────────────────
//
// Supabase reads/writes for the Content Guide / Content Run MVP. All access
// goes through here (never from the page), respects RLS (staff read/write;
// clients no access), and degrades to migrationNeeded before phase-19d is
// applied. No hard deletes of ideas/runs — they retire via archived/cancelled.

export interface ContentGuideIdea {
  id: string
  client_id: string | null
  client_name: string | null
  month: string | null
  title: string
  objective: string | null
  platform: string | null
  format: string | null
  hook: string | null
  cta: string | null
  visual_notes: string | null
  owner_user_id: string | null
  owner_name: string | null
  proposed_post_date: string | null
  deliverable_id: string | null
  status: ContentGuideStatus
  notes: string | null
  // ── Video production pipeline (phase-19e, additive) ──
  video_number: number | null
  folder_client_code: string | null
  canonical_name: string | null
  script: string | null
  shot_breakdown: string | null
  requirements: string | null
  editor_user_id: string | null
  editor_name: string | null
  production_status: VideoProductionStatus
  production_note: string | null
  onedrive_footage_url: string | null
  onedrive_internal_review_url: string | null
  onedrive_client_approval_url: string | null
  onedrive_final_url: string | null
  production_status_updated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentRun {
  id: string
  client_id: string | null
  client_name: string | null
  name: string
  run_date: string | null
  start_time: string | null
  location: string | null
  lead_user_id: string | null
  lead_name: string | null
  helper_names: string[]
  internal_notes: string | null
  status: ContentRunStatus
  // The CG Calendar event that shares this run's identity (phase-19f). Null for
  // legacy/standalone runs that have no calendar event.
  calendar_event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentRunItem {
  id: string
  run_id: string
  guide_idea_id: string | null
  sort_order: number
  title: string | null
  shot_notes: string | null
  requirements: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export type ContentGuideInput = Partial<Omit<ContentGuideIdea, 'id' | 'created_at' | 'updated_at'>> & { title: string }
export type ContentRunInput = Partial<Omit<ContentRun, 'id' | 'created_at' | 'updated_at'>> & { name: string }
export type ContentRunItemInput = Partial<Omit<ContentRunItem, 'id' | 'run_id' | 'created_at' | 'updated_at'>>

export interface QueryResult<T> {
  data: T
  error: string | null
  migrationNeeded: boolean
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('content_') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find'))
}

function wrap<T>(data: T, error: { code?: string; message?: string } | null, fallback: T): QueryResult<T> {
  if (error) {
    if (isMissingTableError(error)) return { data: fallback, error: null, migrationNeeded: true }
    return { data: fallback, error: error.message ?? 'Content Workflow request failed.', migrationNeeded: false }
  }
  return { data, error: null, migrationNeeded: false }
}

// ── Guide ideas ───────────────────────────────────────────────────────────────

export async function listGuideIdeas(): Promise<QueryResult<ContentGuideIdea[]>> {
  const { data, error } = await supabase
    .from('content_guide_ideas')
    .select('*')
    .order('updated_at', { ascending: false })
  return wrap((data ?? []) as ContentGuideIdea[], error, [])
}

export async function createGuideIdea(input: ContentGuideInput): Promise<QueryResult<ContentGuideIdea | null>> {
  const { data, error } = await supabase.from('content_guide_ideas').insert(input).select('*').single()
  return wrap((data as ContentGuideIdea) ?? null, error, null)
}

export async function updateGuideIdea(id: string, patch: ContentGuideInput | Partial<ContentGuideIdea>): Promise<QueryResult<ContentGuideIdea | null>> {
  const { data, error } = await supabase.from('content_guide_ideas').update(patch).eq('id', id).select('*').single()
  return wrap((data as ContentGuideIdea) ?? null, error, null)
}

// Move an idea through its lifecycle. Status target comes from the pure rules.
export async function runGuideAction(id: string, action: ContentGuideAction): Promise<QueryResult<ContentGuideIdea | null>> {
  return updateGuideIdea(id, { status: guideActionTarget(action) })
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function listRuns(): Promise<QueryResult<ContentRun[]>> {
  const { data, error } = await supabase
    .from('content_runs')
    .select('*')
    .order('run_date', { ascending: true, nullsFirst: false })
  return wrap((data ?? []) as ContentRun[], error, [])
}

export async function createRun(input: ContentRunInput): Promise<QueryResult<ContentRun | null>> {
  const { data, error } = await supabase.from('content_runs').insert(input).select('*').single()
  return wrap((data as ContentRun) ?? null, error, null)
}

export async function updateRun(id: string, patch: ContentRunInput | Partial<ContentRun>): Promise<QueryResult<ContentRun | null>> {
  const { data, error } = await supabase.from('content_runs').update(patch).eq('id', id).select('*').single()
  return wrap((data as ContentRun) ?? null, error, null)
}

// ── Unified Content Run ⇄ CG Calendar identity (phase-19f) ────────────────────
//
// A CG-created Content Run and its CG Calendar event are ONE thing. Creating a
// run in Content Workflow also creates the linked company_calendar_events row
// (event_type='content_run'); editing calendar-owned fields or cancelling/
// completing the run keeps both records aligned. Neither record is ever hard-
// deleted. Microsoft-imported events are source-controlled and never overwritten.

// JHB (UTC+2, no DST) local date + optional time -> an ISO instant for the
// calendar event's start_at. A missing time defaults to 09:00 local.
function runStartIso(runDate: string, startTime: string | null): string {
  const time = startTime && startTime.length >= 4 ? startTime.slice(0, 5) : '09:00'
  return new Date(`${runDate}T${time}:00+02:00`).toISOString()
}

// Calendar-owned fields of a run patch, translated to a calendar event patch.
// Operational fields (crew, notes) are intentionally excluded. Returns an empty
// patch when nothing calendar-owned changed.
function calendarPatchFromRun(run: ContentRun, patch: ContentRunInput | Partial<ContentRun>): CompanyEventPatch {
  const cal: CompanyEventPatch = {}
  if (patch.name !== undefined) cal.title = patch.name
  if (patch.client_id !== undefined) cal.client_id = patch.client_id
  if (patch.client_name !== undefined) cal.client_name = patch.client_name
  if (patch.location !== undefined) cal.location = patch.location
  if (patch.status !== undefined) cal.status = mapRunStatusToCalendar(patch.status)
  if (patch.run_date !== undefined || patch.start_time !== undefined) {
    const date = patch.run_date !== undefined ? patch.run_date : run.run_date
    const time = patch.start_time !== undefined ? patch.start_time : run.start_time
    if (date) cal.start_at = runStartIso(date, time)
  }
  return cal
}

// Create a CG Content Run in Content Workflow AND its one linked calendar event.
// The calendar event carries the shared identity; run.calendar_event_id links
// them. Requires a run_date so the calendar event has a start; without one a
// standalone run is created (both migrations should be applied together). If the
// run insert fails after the event is created, the orphan event is cancelled
// (never hard-deleted) so no duplicate content_run event lingers.
export async function createRunWithCalendarEvent(input: ContentRunInput): Promise<QueryResult<ContentRun | null>> {
  if (!input.run_date) {
    return createRun(input)
  }
  const eventResult = await createCompanyEvent({
    title: input.name,
    event_type: 'content_run',
    client_id: input.client_id ?? null,
    client_name: input.client_name ?? null,
    start_at: runStartIso(input.run_date, input.start_time ?? null),
    location: input.location ?? null,
    assigned_to_name: input.lead_name ?? null,
    status: mapRunStatusToCalendar(input.status ?? 'planning'),
  })
  if (eventResult.tableMissing) {
    // Calendar layer not present yet — fall back to a standalone run.
    return createRun(input)
  }
  if (eventResult.error || !eventResult.data) {
    return { data: null, error: eventResult.error?.message ?? 'Could not create the linked calendar event.', migrationNeeded: false }
  }
  const runResult = await createRun({ ...input, calendar_event_id: eventResult.data.id })
  if ((runResult.error || !runResult.data) && !runResult.migrationNeeded) {
    // Roll the calendar event back to cancelled so it is not an orphan duplicate.
    await updateCompanyEvent(eventResult.data.id, { status: 'cancelled' })
  }
  return runResult
}

// Update a run and keep its linked calendar event aligned. Calendar-owned fields
// (name/client/date/time/location/status) mirror to the event, EXCEPT when the
// event is Microsoft-owned (its fields are source-controlled — nothing is
// written back). Operational fields never touch the calendar. No hard deletes.
export async function updateRunLinked(run: ContentRun, patch: ContentRunInput | Partial<ContentRun>): Promise<QueryResult<ContentRun | null>> {
  const runResult = await updateRun(run.id, patch)
  if (runResult.error || runResult.migrationNeeded || !run.calendar_event_id) return runResult
  const eventResult = await getCompanyEvent(run.calendar_event_id)
  const event = eventResult.data
  if (!event || isMicrosoftOwnedEvent(event)) return runResult
  const calPatch = calendarPatchFromRun(run, patch)
  if (Object.keys(calPatch).length > 0) await updateCompanyEvent(event.id, calPatch)
  return runResult
}

// ── Run items (shot list) ─────────────────────────────────────────────────────

export async function listRunItems(runId: string): Promise<QueryResult<ContentRunItem[]>> {
  const { data, error } = await supabase
    .from('content_run_items')
    .select('*')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true })
  return wrap((data ?? []) as ContentRunItem[], error, [])
}

export async function addRunItem(runId: string, input: ContentRunItemInput): Promise<QueryResult<ContentRunItem | null>> {
  const { data, error } = await supabase
    .from('content_run_items')
    .insert({ run_id: runId, ...input })
    .select('*')
    .single()
  return wrap((data as ContentRunItem) ?? null, error, null)
}

export async function updateRunItem(id: string, patch: ContentRunItemInput): Promise<QueryResult<ContentRunItem | null>> {
  const { data, error } = await supabase.from('content_run_items').update(patch).eq('id', id).select('*').single()
  return wrap((data as ContentRunItem) ?? null, error, null)
}

export async function removeRunItem(id: string): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from('content_run_items').delete().eq('id', id)
  return wrap(!error, error, false)
}

// Add an approved guideline to a run: creates a linked shot item (title carried
// over, shot notes from the full brief) at the end of the shot list, and marks
// the guideline added_to_run. Enforces the approved-only rule up front so the
// UI cannot bypass it. The shot-list mapping uses the full-brief fields
// (shot_breakdown / requirements), falling back to hook / visual_notes.
export async function addApprovedIdeaToRun(
  run: ContentRun,
  idea: ContentGuideIdea,
  currentItemCount: number,
): Promise<QueryResult<ContentRunItem | null>> {
  if (!canAddGuideToRun(idea.status)) {
    return { data: null, error: 'Only an approved guideline can be added to a run.', migrationNeeded: false }
  }
  const carried = runItemFieldsFromGuide(idea)
  const itemResult = await addRunItem(run.id, {
    guide_idea_id: idea.id,
    title: idea.title,
    shot_notes: carried.shot_notes,
    requirements: carried.requirements,
    sort_order: currentItemCount,
  })
  if (itemResult.error || itemResult.migrationNeeded || !itemResult.data) return itemResult
  await updateGuideIdea(idea.id, { status: 'added_to_run' })
  return itemResult
}

// All run items (across every run) that link to a given guideline. Used to
// decide whether unlinking a guideline should return it to 'approved'.
export async function listRunItemsForGuide(guideId: string): Promise<QueryResult<ContentRunItem[]>> {
  const { data, error } = await supabase
    .from('content_run_items')
    .select('*')
    .eq('guide_idea_id', guideId)
  return wrap((data ?? []) as ContentRunItem[], error, [])
}

// Unlink a guideline from a run: removes ONLY the run-item link (never touches
// the guideline, its deliverable or the calendar run). When no other run item
// references the guideline, its status returns from added_to_run to approved so
// it can be added to another run. Nothing is hard-deleted except the link row.
export async function unlinkGuidelineFromRun(
  item: ContentRunItem,
): Promise<QueryResult<boolean>> {
  if (!item.guide_idea_id) {
    return removeRunItem(item.id)
  }
  const guideId = item.guide_idea_id
  const removed = await removeRunItem(item.id)
  if (removed.error || removed.migrationNeeded || !removed.data) return removed
  const remaining = await listRunItemsForGuide(guideId)
  if (!remaining.error && remaining.data.length === 0) {
    await updateGuideIdea(guideId, { status: 'approved' })
  }
  return removed
}

// Guide ideas linked to a set of deliverable ids — used by Client Schedule to
// show a small "linked" indicator without rebuilding the page.
export async function listGuideIdeasForDeliverables(deliverableIds: string[]): Promise<QueryResult<ContentGuideIdea[]>> {
  if (deliverableIds.length === 0) return { data: [], error: null, migrationNeeded: false }
  const { data, error } = await supabase
    .from('content_guide_ideas')
    .select('*')
    .in('deliverable_id', deliverableIds)
  return wrap((data ?? []) as ContentGuideIdea[], error, [])
}

// ── Video production pipeline ─────────────────────────────────────────────────

export interface StaffProfileOption {
  id: string
  full_name: string | null
}

export async function listStaffProfiles(): Promise<QueryResult<StaffProfileOption[]>> {
  const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name')
  return wrap((data ?? []) as StaffProfileOption[], error, [])
}

// Persist a production-status change through the single guarded path. The
// transition rule validates the move and its required URL/editor; the matching
// DB fields are written alongside the new status so the guard and the stored
// data never disagree.
export async function transitionVideo(
  idea: ContentGuideIdea,
  action: VideoAction,
  ctx: VideoTransitionContext & { editorName?: string | null } = {},
): Promise<QueryResult<ContentGuideIdea | null>> {
  const result = applyVideoTransition(idea.production_status, action, ctx)
  if (!result.ok || !result.next) {
    return { data: null, error: result.error ?? 'Invalid transition.', migrationNeeded: false }
  }
  const patch: Partial<ContentGuideIdea> = {
    production_status: result.next,
    production_status_updated_at: new Date().toISOString(),
  }
  if (ctx.footageUrl != null) patch.onedrive_footage_url = ctx.footageUrl
  if (ctx.clientApprovalUrl != null) patch.onedrive_client_approval_url = ctx.clientApprovalUrl
  if (ctx.editorUserId != null) {
    patch.editor_user_id = ctx.editorUserId
    patch.editor_name = ctx.editorName ?? null
  }
  return updateGuideIdea(idea.id, patch)
}

// Non-archived video records (guides that link to a deliverable are tracked
// videos). Used by the Video Pipeline board and Hub counts.
export async function listPipelineVideos(): Promise<QueryResult<ContentGuideIdea[]>> {
  const { data, error } = await supabase
    .from('content_guide_ideas')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
  return wrap((data ?? []) as ContentGuideIdea[], error, [])
}

export interface DeliverableLabel {
  id: string
  code: string
  instance_number: number
  title: string
}

// Read-only labels for linked Client Schedule deliverables (display only —
// never mutates monthly_deliverables).
export async function listDeliverableLabels(ids: string[]): Promise<QueryResult<DeliverableLabel[]>> {
  if (ids.length === 0) return { data: [], error: null, migrationNeeded: false }
  const { data, error } = await supabase
    .from('monthly_deliverables')
    .select('id, code, instance_number, title')
    .in('id', ids)
  return wrap((data ?? []) as DeliverableLabel[], error, [])
}
