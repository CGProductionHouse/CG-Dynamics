import { supabase } from './supabase'
import {
  canAddGuideToRun,
  guideActionTarget,
  type ContentGuideAction,
  type ContentGuideStatus,
  type ContentRunStatus,
} from './contentWorkflowRules'
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

// Add an approved idea to a run: creates a linked shot item (title carried over)
// at the end of the shot list, and marks the idea added_to_run. Enforces the
// approved-only rule up front so the UI cannot bypass it.
export async function addApprovedIdeaToRun(
  run: ContentRun,
  idea: ContentGuideIdea,
  currentItemCount: number,
): Promise<QueryResult<ContentRunItem | null>> {
  if (!canAddGuideToRun(idea.status)) {
    return { data: null, error: 'Only an approved idea can be added to a run.', migrationNeeded: false }
  }
  const itemResult = await addRunItem(run.id, {
    guide_idea_id: idea.id,
    title: idea.title,
    shot_notes: idea.hook,
    requirements: idea.visual_notes,
    sort_order: currentItemCount,
  })
  if (itemResult.error || itemResult.migrationNeeded || !itemResult.data) return itemResult
  await updateGuideIdea(idea.id, { status: 'added_to_run' })
  return itemResult
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
