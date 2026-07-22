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
