// clientWorkspace.ts — client-Project operational actions (#341). Pure and import-free so every
// rule is unit-tested without Deno or a database.
//
// A client ChatGPT Project is an internal company workspace pinned to ONE exact Dynamics client.
// After a meeting or content run, staff can stay in that Project and:
//   • record a real request from that client            (record_client_request)
//   • assign a same-client follow-up to exact CG staff  (create_client_followup_task)
//   • persist durable client-direction intelligence     (record_client_update)
//
// Authority (#319 / #325 / #341) — never weakened here:
//   • the CALLER is the communal connection principal; the Project's client comes from the
//     resolved context, never from tool input (input.client_id is deliberately ignored);
//   • an ASSIGNEE is the target of a task, not the caller, and gains no permissions from it;
//   • nothing here "acts as" a staff member, so create_task's staff-subject guard is untouched.
//
// Canonical reuse: tasks are planner_tasks rows (Client Requests bucket for requests), assignment
// uses the canonical assignee projection, schedule changes are PENDING proposals in
// client_schedule_change_requests, meeting outcomes are meeting_debriefs, and client direction is
// an append-only client_context_updates row that get_client_context returns.

export const WORKFORCE_ROLES = ['admin', 'manager', 'staff', 'team'] as const

/** The only profile columns the assignment directory ever reads. */
export const ASSIGNABLE_STAFF_SELECT = 'id, full_name, role, is_active'

/** Provenance stamped on every client-Project write. */
export const CLIENT_WORKSPACE_SOURCE = 'chatgpt_client_project'

export const CLIENT_UPDATE_KINDS = ['content_direction', 'meeting_outcome', 'client_preference', 'client_fact'] as const
export type ClientUpdateKind = typeof CLIENT_UPDATE_KINDS[number]

export const MICROSOFT_WRITE_STATES = ['not_requested', 'succeeded', 'failed'] as const
export type MicrosoftWriteState = typeof MICROSOFT_WRITE_STATES[number]

export const TITLE_MAX = 240
export const NOTES_MAX = 4000
export const BODY_MAX = 8000
export const LIST_ITEMS_MAX = 20
export const LIST_ITEM_MAX = 500

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value.trim())
const sameId = (a: unknown, b: unknown) => isUuid(a) && isUuid(b) && a.trim().toLowerCase() === b.trim().toLowerCase()

// ── Assignment directory ─────────────────────────────────────────────────────

export interface StaffDirectoryRow {
  id?: unknown
  full_name?: unknown
  role?: unknown
  is_active?: unknown
}

export interface AssignableStaff {
  profile_id: string
  full_name: string
  role: string
}

const isWorkforce = (row: StaffDirectoryRow) =>
  typeof row.role === 'string' && (WORKFORCE_ROLES as readonly string[]).includes(row.role)

const isAssignable = (row: StaffDirectoryRow) =>
  isWorkforce(row) && row.is_active === true && isUuid(row.id) && text(row.full_name) !== null

/** Safe view: exactly profile_id, full_name and role. Nothing else ever leaves the directory. */
export function toAssignableStaff(row: StaffDirectoryRow): AssignableStaff | null {
  if (!isAssignable(row)) return null
  return { profile_id: String(row.id).trim(), full_name: text(row.full_name) as string, role: String(row.role) }
}

const normalizeName = (value: unknown) => (text(value) ?? '').replace(/\s+/g, ' ').toLocaleLowerCase('en-ZA')

/** Active CG staff only, optionally filtered by a case-insensitive name fragment. */
export function listAssignableStaff(rows: readonly StaffDirectoryRow[] | null | undefined, query?: unknown): AssignableStaff[] {
  const needle = normalizeName(query)
  return (rows ?? [])
    .map(toAssignableStaff)
    .filter((staff): staff is AssignableStaff => staff !== null)
    .filter(staff => !needle || normalizeName(staff.full_name).includes(needle))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export type AssigneeFailureCode =
  | 'ASSIGNEE_REQUIRED'
  | 'ASSIGNEE_NOT_FOUND'
  | 'ASSIGNEE_INACTIVE'
  | 'ASSIGNEE_AMBIGUOUS'
  | 'ASSIGNEE_CONFLICT'

export type AssigneeResolution =
  | { ok: true; assignee: AssignableStaff }
  | { ok: false; code: AssigneeFailureCode; error: string; candidates: AssignableStaff[] }

/**
 * Resolve exactly one active CG staff member, failing closed. An exact profile id wins; an exact
 * (case-insensitive) full name is accepted only when it matches one active person. A first name
 * alone, an inactive person or two people with the same name never resolve — the safe candidate
 * list is returned so the Assistant can confirm the right person instead of guessing.
 */
export function resolveAssignee(
  rows: readonly StaffDirectoryRow[] | null | undefined,
  input: { assignee_profile_id?: unknown; assignee_name?: unknown },
): AssigneeResolution {
  const directory = rows ?? []
  const id = text(input.assignee_profile_id)
  const name = text(input.assignee_name)
  const fail = (code: AssigneeFailureCode, error: string, candidates: AssignableStaff[] = []): AssigneeResolution =>
    ({ ok: false, code, error, candidates })

  if (!id && !name) {
    return fail('ASSIGNEE_REQUIRED', 'An exact assignee is required. Call list_assignable_staff and pass the exact assignee_profile_id.')
  }

  let byId: StaffDirectoryRow | undefined
  if (id) {
    if (!isUuid(id)) return fail('ASSIGNEE_NOT_FOUND', 'assignee_profile_id must be an exact staff profile id from list_assignable_staff.')
    byId = directory.find(row => sameId(row.id, id))
    if (!byId || !isWorkforce(byId)) return fail('ASSIGNEE_NOT_FOUND', 'No CG staff member has that exact profile id. Nothing was assigned.')
    if (byId.is_active !== true) {
      return fail('ASSIGNEE_INACTIVE', `${text(byId.full_name) ?? 'That staff member'} is not an active CG staff member. Nothing was assigned.`)
    }
  }

  if (name) {
    const matches = directory.filter(row => isWorkforce(row) && normalizeName(row.full_name) === normalizeName(name))
    const active = matches.filter(row => row.is_active === true)
    if (byId) {
      const chosen = byId
      if (!active.some(row => sameId(row.id, chosen.id))) {
        return fail('ASSIGNEE_CONFLICT', 'assignee_profile_id and assignee_name point at different people. Nothing was assigned.')
      }
    } else {
      if (active.length === 1) return { ok: true, assignee: toAssignableStaff(active[0]) as AssignableStaff }
      if (active.length > 1) {
        return fail(
          'ASSIGNEE_AMBIGUOUS',
          `${active.length} active staff members are named "${name}". Pass the exact assignee_profile_id.`,
          listAssignableStaff(active),
        )
      }
      if (matches.length > 0) return fail('ASSIGNEE_INACTIVE', `${name} is not an active CG staff member. Nothing was assigned.`)
      const token = normalizeName(name)
      const candidates = listAssignableStaff(directory)
        .filter(staff => normalizeName(staff.full_name).split(' ').includes(token) || normalizeName(staff.full_name).startsWith(token))
      return fail(
        'ASSIGNEE_NOT_FOUND',
        `No active CG staff member is named exactly "${name}". Confirm the person and pass their exact assignee_profile_id.`,
        candidates,
      )
    }
  }

  return { ok: true, assignee: toAssignableStaff(byId as StaffDirectoryRow) as AssignableStaff }
}

// ── Values that must never be invented ──────────────────────────────────────

export function validateExplicitDate(value: unknown, field = 'due_date'): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) {
    return { ok: false, error: `${field} must be an explicit YYYY-MM-DD date. Leave it out when no date was given — never invent one.` }
  }
  const trimmed = value.trim()
  const parsed = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return { ok: false, error: `${field} ${trimmed} is not a real calendar date.` }
  }
  return { ok: true, value: trimmed }
}

function boundedText(value: unknown, field: string, max: number, required: boolean): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = text(value)
  if (!v) return required ? { ok: false, error: `${field} is required.` } : { ok: true, value: null }
  if (v.length > max) return { ok: false, error: `${field} must be at most ${max} characters.` }
  return { ok: true, value: v }
}

function stringList(value: unknown, field: string): { ok: true; value: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: `${field} must be a list of short statements.` }
  const items = value.map(item => text(item)).filter((item): item is string => item !== null)
  if (items.length > LIST_ITEMS_MAX) return { ok: false, error: `${field} may hold at most ${LIST_ITEMS_MAX} items.` }
  if (items.some(item => item.length > LIST_ITEM_MAX)) return { ok: false, error: `Each ${field} item must be at most ${LIST_ITEM_MAX} characters.` }
  return { ok: true, value: items }
}

// ── #325 Microsoft coexistence for follow-up tasks ──────────────────────────

export type MicrosoftLinkage =
  | {
      ok: true
      mode: 'dynamics_only' | 'microsoft_linked' | 'microsoft_failed'
      microsoftTaskId: string | null
      microsoftPlanId: string | null
      microsoftBucketId: string | null
    }
  | { ok: false; error: string }

/**
 * #325: a content/package workflow follow-up may stay Dynamics-only. A normal Microsoft-backed
 * operational task is created in Planner FIRST (through the connected Microsoft action) and then
 * linked here by its durable Planner ids, so the reconciliation engine later matches the same
 * row instead of creating a second one. A failed Planner write still records the Dynamics side
 * and is reported as PARTIAL SYNC — never as success on both sides.
 */
export function planMicrosoftLinkage(input: Record<string, unknown>): MicrosoftLinkage {
  const state = input.microsoft_write ?? 'not_requested'
  if (typeof state !== 'string' || !(MICROSOFT_WRITE_STATES as readonly string[]).includes(state)) {
    return { ok: false, error: `microsoft_write must be one of: ${MICROSOFT_WRITE_STATES.join(', ')}.` }
  }
  const taskId = text(input.microsoft_task_id)
  const planId = text(input.microsoft_plan_id)
  const bucketId = text(input.microsoft_bucket_id)
  if (state === 'succeeded') {
    if (!taskId || !planId) {
      return { ok: false, error: 'microsoft_write="succeeded" needs the exact microsoft_task_id and microsoft_plan_id of the Planner task you created, so Dynamics links that same task by durable id.' }
    }
    return { ok: true, mode: 'microsoft_linked', microsoftTaskId: taskId, microsoftPlanId: planId, microsoftBucketId: bucketId }
  }
  if (taskId || planId || bucketId) {
    return { ok: false, error: 'Microsoft task identifiers are only accepted with microsoft_write="succeeded". A failed or unrequested Planner write has no durable Microsoft identity to link.' }
  }
  return { ok: true, mode: state === 'failed' ? 'microsoft_failed' : 'dynamics_only', microsoftTaskId: null, microsoftPlanId: null, microsoftBucketId: null }
}

/** MASTER CLIENT TO DO and the monthly Client Socials plans are protected Microsoft sources. */
export const PROTECTED_MICROSOFT_PLAN_RE = /\b(MASTER CLIENT TO DO|CLIENT SOCIALS)\b/i

export function isProtectedMicrosoftPlanName(name: unknown): boolean {
  const value = text(name)
  return value !== null && PROTECTED_MICROSOFT_PLAN_RE.test(value)
}

export interface FollowupSyncVerdict {
  verdict: 'PASS' | 'PARTIAL_SYNC' | 'FAIL'
  sync_state: string
  note: string
}

export function gradeFollowupSync(mode: 'dynamics_only' | 'microsoft_linked' | 'microsoft_failed', dynamicsWritten: boolean): FollowupSyncVerdict {
  if (!dynamicsWritten) {
    return mode === 'microsoft_linked'
      ? { verdict: 'FAIL', sync_state: 'DYNAMICS_WRITE_FAILED', note: 'The Planner task exists but the Dynamics side did not write. Keep the Planner task, report PARTIAL SYNC, and do not say the follow-up is fully recorded.' }
      : { verdict: 'FAIL', sync_state: 'NOT_WRITTEN', note: 'Nothing was created. Do not say the follow-up was created or assigned.' }
  }
  if (mode === 'microsoft_linked') {
    return { verdict: 'PASS', sync_state: 'BOTH_SIDES_REPORTED_OK', note: 'The Dynamics task is linked to the Planner task by durable id. Microsoft freshness is not stamped until the next reconciliation.' }
  }
  if (mode === 'microsoft_failed') {
    return { verdict: 'PARTIAL_SYNC', sync_state: 'PARTIAL SYNC', note: 'The Dynamics task was created, but the Planner write did not succeed. Report PARTIAL SYNC; do not claim the task exists in Planner.' }
  }
  return { verdict: 'PASS', sync_state: 'DYNAMICS_ONLY', note: 'Recorded as Dynamics-native client work, which #325 permits for content/package workflow follow-ups.' }
}

// ── Building the canonical writes ───────────────────────────────────────────

export interface ClientWorkspaceScope {
  /** The Project's resolved exact client. Never taken from tool input. */
  clientId: string
  /** The communal connection principal's profile — the recorded caller. */
  actorProfileId: string
  /** The communal connection principal's auth user id, for the audit trail. */
  connectionUserId: string
}

export type ClientTaskKind = 'client_request' | 'follow_up'

export type BuildResult = { ok: true; params: Record<string, unknown> } | { ok: false; error: string }

/** The only fields a Client Schedule proposal may touch — the same whitelist tg_cscr_capture_baseline enforces. */
export const SCHEDULE_CHANGE_FIELDS = ['scheduled_date', 'due_date', 'production_status', 'assigned_to_name', 'notes'] as const

function scheduleChangeProposal(value: unknown): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'schedule_change must be an object with deliverable_id and change.' }
  const proposal = value as Record<string, unknown>
  if (!isUuid(proposal.deliverable_id)) return { ok: false, error: 'schedule_change.deliverable_id must be the exact Client Schedule deliverable id.' }
  const change = proposal.change
  if (!change || typeof change !== 'object' || Array.isArray(change) || Object.keys(change as object).length === 0) {
    return { ok: false, error: 'schedule_change.change must describe the proposed change. It is a proposal for admin approval, not an edit.' }
  }
  const unsupported = Object.keys(change as object).filter(field => !(SCHEDULE_CHANGE_FIELDS as readonly string[]).includes(field))
  if (unsupported.length > 0) {
    return { ok: false, error: `A Client Schedule proposal may only change ${SCHEDULE_CHANGE_FIELDS.join(', ')} — not ${unsupported.join(', ')}.` }
  }
  const reason = boundedText(proposal.reason, 'schedule_change.reason', NOTES_MAX, false)
  if (!reason.ok) return reason
  return { ok: true, value: { deliverable_id: String(proposal.deliverable_id).trim(), change, reason: reason.value } }
}

/**
 * Shape the record_client_workspace_task RPC call. The client, caller and audit identity come
 * only from the resolved scope; any client_id or staff id in the model's input is ignored.
 */
export function buildClientTaskWrite(
  kind: ClientTaskKind,
  scope: ClientWorkspaceScope,
  input: Record<string, unknown>,
  assignee: AssignableStaff | null,
  linkage: MicrosoftLinkage,
  toolName: string,
): BuildResult {
  if (!isUuid(scope.clientId) || !isUuid(scope.actorProfileId) || !isUuid(scope.connectionUserId)) {
    return { ok: false, error: 'Client-Project writes need a resolved exact client and connection principal.' }
  }
  if (!isUuid(input.idempotency_key)) return { ok: false, error: 'idempotency_key must be a uuid. Reuse the same key when retrying so nothing is created twice.' }
  const title = boundedText(input.title, 'title', TITLE_MAX, true)
  if (!title.ok) return title
  const notes = boundedText(input.notes, 'notes', NOTES_MAX, false)
  if (!notes.ok) return notes
  const due = validateExplicitDate(input.due_date)
  if (!due.ok) return due
  if (!linkage.ok) return linkage
  if (kind === 'follow_up' && !assignee) return { ok: false, error: 'A follow-up task needs one exact active assignee.' }
  if (kind === 'client_request' && linkage.mode !== 'dynamics_only') {
    return { ok: false, error: 'A client request is recorded in Dynamics only. MASTER CLIENT TO DO is a protected Microsoft plan and is never written from a client Project.' }
  }
  const schedule = scheduleChangeProposal(input.schedule_change)
  if (!schedule.ok) return schedule
  if (schedule.value && kind !== 'client_request') {
    return { ok: false, error: 'A Client Schedule change can only be proposed from record_client_request.' }
  }
  const meetingReference = boundedText(input.meeting_reference, 'meeting_reference', TITLE_MAX, false)
  if (!meetingReference.ok) return meetingReference

  return {
    ok: true,
    params: {
      p_actor_profile_id: scope.actorProfileId,
      p_connection_principal_user_id: scope.connectionUserId,
      p_client_id: scope.clientId,
      p_kind: kind,
      p_title: title.value,
      p_notes: notes.value,
      p_due_date: due.value,
      p_assignee_profile_id: assignee?.profile_id ?? null,
      p_idempotency_key: String(input.idempotency_key).trim(),
      p_microsoft_task_id: linkage.microsoftTaskId,
      p_microsoft_plan_id: linkage.microsoftPlanId,
      p_microsoft_bucket_id: linkage.microsoftBucketId,
      p_schedule_change: schedule.value,
      p_source_context: {
        source: CLIENT_WORKSPACE_SOURCE,
        tool: toolName,
        microsoft_write: linkage.mode,
        meeting_reference: meetingReference.value,
      },
    },
  }
}

/** Shape the record_client_workspace_update RPC call for one durable client-direction record. */
export function buildClientUpdateWrite(scope: ClientWorkspaceScope, input: Record<string, unknown>): BuildResult {
  if (!isUuid(scope.clientId) || !isUuid(scope.actorProfileId) || !isUuid(scope.connectionUserId)) {
    return { ok: false, error: 'Client-Project writes need a resolved exact client and connection principal.' }
  }
  if (!isUuid(input.idempotency_key)) return { ok: false, error: 'idempotency_key must be a uuid. Reuse the same key when retrying so nothing is recorded twice.' }
  const kind = input.update_kind
  if (typeof kind !== 'string' || !(CLIENT_UPDATE_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `update_kind must be one of: ${CLIENT_UPDATE_KINDS.join(', ')}.` }
  }
  const title = boundedText(input.title, 'title', TITLE_MAX, true)
  if (!title.ok) return title
  const body = boundedText(input.body, 'body', BODY_MAX, true)
  if (!body.ok) return body
  const decisions = stringList(input.decisions, 'decisions')
  if (!decisions.ok) return decisions
  const unresolved = stringList(input.unresolved, 'unresolved')
  if (!unresolved.ok) return unresolved
  const linked = input.linked_task_ids ?? []
  if (!Array.isArray(linked) || linked.some(id => !isUuid(id))) {
    return { ok: false, error: 'linked_task_ids must be exact task ids returned by this Project.' }
  }
  if (linked.length > LIST_ITEMS_MAX) return { ok: false, error: `At most ${LIST_ITEMS_MAX} linked tasks.` }
  const meetingTitle = boundedText(input.meeting_title, 'meeting_title', TITLE_MAX, false)
  if (!meetingTitle.ok) return meetingTitle
  const meetingDate = validateExplicitDate(input.meeting_date, 'meeting_date')
  if (!meetingDate.ok) return meetingDate
  if (input.calendar_event_id !== undefined && input.calendar_event_id !== null && !isUuid(input.calendar_event_id)) {
    return { ok: false, error: 'calendar_event_id must be an exact CG Calendar event id.' }
  }

  return {
    ok: true,
    params: {
      p_actor_profile_id: scope.actorProfileId,
      p_connection_principal_user_id: scope.connectionUserId,
      p_client_id: scope.clientId,
      p_update_kind: kind,
      p_title: title.value,
      p_body: body.value,
      p_decisions: decisions.value,
      p_unresolved: unresolved.value,
      p_linked_task_ids: [...new Set(linked.map(id => String(id).trim().toLowerCase()))],
      p_meeting_title: meetingTitle.value,
      p_meeting_date: meetingDate.value,
      p_calendar_event_id: isUuid(input.calendar_event_id) ? String(input.calendar_event_id).trim() : null,
      p_idempotency_key: String(input.idempotency_key).trim(),
    },
  }
}

// ── Shaping results (no fake success) ───────────────────────────────────────

export interface ClientTaskRow {
  id?: unknown
  title?: unknown
  client_id?: unknown
  client_name?: unknown
  status?: unknown
  priority?: unknown
  due_date?: unknown
  microsoft_task_id?: unknown
  microsoft_plan_id?: unknown
}

/**
 * Turn the RPC's result into the tool response. A task id must be present for anything to be
 * reported as created: the Assistant may only say "created/assigned/recorded" after this.
 */
export function shapeClientTaskResult(
  kind: ClientTaskKind,
  data: unknown,
  sync: FollowupSyncVerdict | null,
): Record<string, unknown> {
  const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const task = (result.task && typeof result.task === 'object' ? result.task : {}) as ClientTaskRow
  const assignee = (result.assignee && typeof result.assignee === 'object' ? result.assignee : null) as Record<string, unknown> | null
  if (!isUuid(task.id)) {
    return { error: 'The canonical write did not return a record id, so nothing can be reported as created.', verdict: 'FAIL' }
  }
  const replayed = result.replayed === true
  return {
    ...(sync ?? { verdict: 'PASS', sync_state: 'DYNAMICS_ONLY', note: 'Recorded as a canonical Dynamics client request.' }),
    action: kind === 'client_request' ? 'client_request_recorded' : 'followup_task_created',
    created: !replayed,
    replayed,
    already_linked: result.already_linked === true,
    task: {
      id: task.id,
      title: task.title ?? null,
      client_id: task.client_id ?? null,
      client_name: task.client_name ?? null,
      status: task.status ?? null,
      priority: task.priority ?? null,
      due_date: task.due_date ?? null,
      microsoft_task_id: task.microsoft_task_id ?? null,
    },
    assignee: assignee && isUuid(assignee.profile_id)
      ? { profile_id: assignee.profile_id, full_name: assignee.full_name ?? null }
      : null,
    schedule_change_request_id: isUuid(result.schedule_change_request_id) ? result.schedule_change_request_id : null,
    authority_note: 'Recorded by the shared CG connection for this exact client Project. The assignee is the target of the task and gains no permissions from it.',
    ...(replayed ? { replay_note: 'This idempotency key was already used for this client: the original record is returned and nothing new was created.' } : {}),
  }
}

export function shapeClientUpdateResult(data: unknown): Record<string, unknown> {
  const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const update = (result.update && typeof result.update === 'object' ? result.update : {}) as Record<string, unknown>
  if (!isUuid(update.id)) {
    return { error: 'The canonical write did not return an update id, so nothing can be reported as recorded.', verdict: 'FAIL' }
  }
  const replayed = result.replayed === true
  return {
    verdict: 'PASS',
    action: 'client_update_recorded',
    created: !replayed,
    replayed,
    update: {
      id: update.id,
      update_kind: update.update_kind ?? null,
      title: update.title ?? null,
      review_state: update.review_state ?? null,
      recorded_at: update.created_at ?? null,
    },
    meeting_debrief_id: isUuid(result.meeting_debrief_id) ? result.meeting_debrief_id : null,
    retrieval_note: 'Returned by get_client_context under recorded_client_updates for this exact client until it is reviewed into the client guide. The client guide itself was not rewritten.',
    ...(replayed ? { replay_note: 'This idempotency key was already used for this client: the original record is returned and nothing new was recorded.' } : {}),
  }
}

// ── Retrieval through fresh client context ──────────────────────────────────

export interface ClientUpdateRow {
  id?: unknown
  update_kind?: unknown
  title?: unknown
  body?: unknown
  decisions?: unknown
  unresolved?: unknown
  linked_task_ids?: unknown
  meeting_debrief_id?: unknown
  source_kind?: unknown
  source_meeting_title?: unknown
  source_meeting_date?: unknown
  review_state?: unknown
  created_at?: unknown
}

export const RECORDED_CLIENT_UPDATES_NOTE =
  'Durable updates recorded from this exact client\'s Project, newest first, with provenance. Use them as current staff-recorded direction; they are not yet reviewed into the client guide. Never apply them to any other client.'

export function summarizeClientUpdates(rows: readonly ClientUpdateRow[] | null | undefined) {
  return [...(rows ?? [])]
    .filter(row => isUuid(row.id) && row.review_state !== 'rejected')
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .map(row => ({
      id: row.id,
      update_kind: row.update_kind ?? null,
      title: row.title ?? null,
      body: row.body ?? null,
      decisions: Array.isArray(row.decisions) ? row.decisions : [],
      unresolved: Array.isArray(row.unresolved) ? row.unresolved : [],
      linked_task_ids: Array.isArray(row.linked_task_ids) ? row.linked_task_ids : [],
      meeting_debrief_id: row.meeting_debrief_id ?? null,
      provenance: {
        source: row.source_kind ?? CLIENT_WORKSPACE_SOURCE,
        meeting_title: row.source_meeting_title ?? null,
        meeting_date: row.source_meeting_date ?? null,
        recorded_at: row.created_at ?? null,
      },
      review_state: row.review_state ?? 'unreviewed',
    }))
}
