// ── Content Workflow — pure rules (no I/O) ────────────────────────────────────
//
// Status models and the small decision rules for the Content Guide / Content
// Run MVP. Kept free of Supabase imports so they are trivially unit-testable
// and shared by the data layer and the UI.

export type ContentGuideStatus =
  | 'idea'
  | 'needs_review'
  | 'approved'
  | 'added_to_run'
  | 'in_production'
  | 'completed'
  | 'archived'

export type ContentRunStatus =
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'captured'
  | 'processing'
  | 'completed'
  | 'cancelled'

export const CONTENT_GUIDE_STATUSES: ContentGuideStatus[] = [
  'idea', 'needs_review', 'approved', 'added_to_run', 'in_production', 'completed', 'archived',
]

export const CONTENT_RUN_STATUSES: ContentRunStatus[] = [
  'planning', 'ready', 'in_progress', 'captured', 'processing', 'completed', 'cancelled',
]

export type ContentGuideAction = 'submit_review' | 'approve' | 'return_to_review' | 'archive'

// The status a guide action moves an idea to. Actions are only offered from
// sensible current states (see canRunGuideAction); this map is the target.
const GUIDE_ACTION_TARGET: Record<ContentGuideAction, ContentGuideStatus> = {
  submit_review: 'needs_review',
  approve: 'approved',
  return_to_review: 'needs_review',
  archive: 'archived',
}

export function guideActionTarget(action: ContentGuideAction): ContentGuideStatus {
  return GUIDE_ACTION_TARGET[action]
}

// Which actions make sense from a given status. Archived is terminal; a
// completed idea is left as-is (only archivable). Approve is available from
// idea/needs_review. Return-to-review pulls an approved idea back.
export function canRunGuideAction(status: ContentGuideStatus, action: ContentGuideAction): boolean {
  if (status === 'archived') return false
  switch (action) {
    case 'submit_review':
      return status === 'idea'
    case 'approve':
      return status === 'idea' || status === 'needs_review'
    case 'return_to_review':
      return status === 'approved' || status === 'added_to_run'
    case 'archive':
      return true
    default:
      return false
  }
}

// Only an approved idea may be added to a run. Ideas already added, in
// production, completed or archived cannot be (re)added.
export function canAddGuideToRun(status: ContentGuideStatus): boolean {
  return status === 'approved'
}

// The shot-list fields a run item should carry over when a guideline is added
// to a run. The full brief's shot_breakdown / requirements are the source of
// truth; the older hook / visual_notes are used only as a fallback when the
// newer field is empty.
export function runItemFieldsFromGuide(guide: {
  shot_breakdown?: string | null
  hook?: string | null
  requirements?: string | null
  visual_notes?: string | null
}): { shot_notes: string | null; requirements: string | null } {
  const shot = (guide.shot_breakdown ?? '').trim() || (guide.hook ?? '').trim() || null
  const requirements = (guide.requirements ?? '').trim() || (guide.visual_notes ?? '').trim() || null
  return { shot_notes: shot, requirements }
}

// One active (non-archived) guideline may link to a given monthly deliverable.
// True when some other guideline already claims it (so a new/edited guideline
// must not link the same one). excludeGuideId skips the guideline being edited.
export function deliverableHasActiveGuideline(
  guides: Array<{ id: string; deliverable_id: string | null; status: ContentGuideStatus }>,
  deliverableId: string,
  excludeGuideId?: string | null,
): boolean {
  return guides.some(guide =>
    guide.deliverable_id === deliverableId &&
    guide.status !== 'archived' &&
    guide.id !== excludeGuideId,
  )
}

// Split a run's shot list into linked guidelines (guide_idea_id set) and extra
// standalone shots. Linked guidelines are the primary shoot content; extra
// shots are secondary run notes.
export function splitRunItems<T extends { guide_idea_id: string | null }>(items: T[]): { linked: T[]; extra: T[] } {
  const linked: T[] = []
  const extra: T[] = []
  for (const item of items) {
    if (item.guide_idea_id) linked.push(item)
    else extra.push(item)
  }
  return { linked, extra }
}

// A legacy/empty extra shot with no details entered yet. Used to show a clear
// "details not added" label instead of a blank "Untitled shot".
export function isBlankExtraShot(item: {
  guide_idea_id: string | null
  title?: string | null
  shot_notes?: string | null
  requirements?: string | null
}): boolean {
  if (item.guide_idea_id) return false
  return !(item.title ?? '').trim() && !(item.shot_notes ?? '').trim() && !(item.requirements ?? '').trim()
}

// True when a run falls within [today, today + days] by run_date (local date
// strings, YYYY-MM-DD). Runs with no date are never "upcoming". Cancelled runs
// are excluded so they do not clutter Hub.
export function isRunUpcoming(
  run: { run_date: string | null; status: ContentRunStatus },
  today: string,
  days = 7,
): boolean {
  if (!run.run_date) return false
  if (run.status === 'cancelled') return false
  const start = new Date(`${today}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  const date = new Date(`${run.run_date}T00:00:00`)
  return date >= start && date <= end
}

// Whether the signed-in person is responsible for a run: named lead, lead by
// user id, or listed as a helper (case-insensitive name match).
export function runInvolvesUser(
  run: { lead_user_id: string | null; lead_name: string | null; helper_names: string[] },
  user: { id?: string | null; full_name?: string | null },
): boolean {
  if (user.id && run.lead_user_id && run.lead_user_id === user.id) return true
  const name = (user.full_name ?? '').trim().toLowerCase()
  if (!name) return false
  if ((run.lead_name ?? '').trim().toLowerCase() === name) return true
  return run.helper_names.some(helper => helper.trim().toLowerCase() === name)
}

// ── Unified Content Run identity (CG Calendar ⇄ Content Workflow) ─────────────
//
// A Content Run has ONE shared identity: a company_calendar_events row
// (event_type = 'content_run') plus an operational content_runs row that links
// to it via calendar_event_id. Calendar-owned fields are the shared identity
// (name/client/date/time/location/status); operational fields (crew, guides,
// shot list, notes) live only on the Content Workflow side. These pure helpers
// keep the two status models and the field ownership consistent everywhere,
// with no Supabase import (mirrors companyCalendar's CompanyEventStatus).

export type CalendarEventStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled'

// Calendar status → run status. Conservative and matches the phase-19f backfill:
// planned→planning, confirmed→ready, completed→completed, cancelled→cancelled.
export function mapCalendarStatusToRun(status: CalendarEventStatus): ContentRunStatus {
  switch (status) {
    case 'planned': return 'planning'
    case 'confirmed': return 'ready'
    case 'completed': return 'completed'
    case 'cancelled': return 'cancelled'
    default: return 'planning'
  }
}

// Run status → calendar status. The richer run lifecycle collapses onto the four
// calendar states; any active/in-production state reads as 'confirmed' so the
// calendar keeps showing the run as a committed booking.
export function mapRunStatusToCalendar(status: ContentRunStatus): CalendarEventStatus {
  switch (status) {
    case 'planning': return 'planned'
    case 'completed': return 'completed'
    case 'cancelled': return 'cancelled'
    case 'ready':
    case 'in_progress':
    case 'captured':
    case 'processing':
      return 'confirmed'
    default: return 'planned'
  }
}

// A calendar event owned by Microsoft (Outlook import). Its date/title/location
// are source-controlled during the transition and must never be overwritten
// from Content Workflow.
export function isMicrosoftOwnedEvent(
  event: { microsoft_source_type?: string | null; microsoft_event_id?: string | null } | null | undefined,
): boolean {
  if (!event) return false
  return Boolean(event.microsoft_source_type) || Boolean(event.microsoft_event_id)
}

// Fields whose source of truth is the CG Calendar event (the shared identity).
export const CALENDAR_OWNED_RUN_FIELDS: readonly string[] = [
  'name', 'client_id', 'client_name', 'run_date', 'start_time', 'location', 'status',
]

// Fields that live only on the operational Content Workflow side.
export const OPERATIONAL_RUN_FIELDS: readonly string[] = [
  'lead_user_id', 'lead_name', 'helper_names', 'internal_notes',
]

// Whether a Content Run field may be edited from Content Workflow. Operational
// fields are always editable. Calendar-owned fields are editable for CG-created
// runs (edits mirror back to the event), but read-only when the linked calendar
// event is Microsoft-owned (its fields are source-controlled). Unknown fields
// (shot list, guide links — handled by their own records) default to editable.
export function canEditRunFieldInWorkflow(
  field: string,
  event: { microsoft_source_type?: string | null; microsoft_event_id?: string | null } | null | undefined,
): boolean {
  if (OPERATIONAL_RUN_FIELDS.includes(field)) return true
  if (CALENDAR_OWNED_RUN_FIELDS.includes(field)) return !isMicrosoftOwnedEvent(event)
  return true
}
