// ── Video production pipeline — pure rules (no I/O) ───────────────────────────
//
// Canonical OneDrive naming, client-code derivation, URL safety and the single
// production-status transition function with its guards. No Supabase import, so
// these are trivially unit-tested and shared by the data layer and the UI.

export type VideoProductionStatus =
  | 'not_shot'
  | 'shot'
  | 'ready_to_edit'
  | 'editing'
  | 'internal_review'
  | 'internal_changes'
  | 'ready_for_client'
  | 'sent_to_client'
  | 'client_changes'
  | 'client_approved'

export const VIDEO_PRODUCTION_STATUSES: VideoProductionStatus[] = [
  'not_shot', 'shot', 'ready_to_edit', 'editing', 'internal_review',
  'internal_changes', 'ready_for_client', 'sent_to_client', 'client_changes', 'client_approved',
]

export const VIDEO_STATUS_LABELS: Record<VideoProductionStatus, string> = {
  not_shot: 'Not shot',
  shot: 'Shot',
  ready_to_edit: 'Ready to edit',
  editing: 'Editing',
  internal_review: 'Internal review',
  internal_changes: 'Internal changes',
  ready_for_client: 'Ready for client',
  sent_to_client: 'Sent to client',
  client_changes: 'Client changes',
  client_approved: 'Client approved',
}

// ── Canonical name ────────────────────────────────────────────────────────────

// Uppercase, replace every run of non-alphanumerics with a single underscore,
// and trim leading/trailing underscores. Emoji, slashes and punctuation all
// collapse away; combining diacritics are stripped.
export function sanitiseSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Explicit pilot codes, else the first alphanumeric word of the client name.
export function deriveClientCode(clientName: string | null | undefined): string {
  const name = (clientName ?? '').toLowerCase()
  if (name.includes('dulux')) return 'DULUX'
  if (name.includes('econo')) return 'ECONO'
  const firstWord = sanitiseSegment(clientName ?? '').split('_')[0] ?? ''
  return firstWord
}

export function twoDigit(value: number): string {
  const n = Math.max(0, Math.trunc(value))
  return n < 10 ? `0${n}` : String(n)
}

// A linked deliverable's instance_number supplies the video number.
export function videoNumberFromInstance(instanceNumber: number | null | undefined): number | null {
  if (instanceNumber == null || !Number.isFinite(instanceNumber)) return null
  return Math.trunc(instanceNumber)
}

// YYYY_MM_CLIENTCODE_VIDEO_NN_SANITISED_CONCEPT_TITLE
// month accepts 'YYYY-MM' or 'YYYY-MM-DD'; a missing/invalid month drops the
// date segment rather than inventing one.
export function buildCanonicalName(input: {
  month: string | null
  clientCode: string
  videoNumber: number | null
  conceptTitle: string
}): string {
  const parts: string[] = []
  const monthMatch = /^(\d{4})-(\d{2})/.exec(input.month ?? '')
  if (monthMatch) parts.push(monthMatch[1], monthMatch[2])
  const code = sanitiseSegment(input.clientCode)
  if (code) parts.push(code)
  parts.push('VIDEO')
  if (input.videoNumber != null) parts.push(twoDigit(input.videoNumber))
  const title = sanitiseSegment(input.conceptTitle)
  if (title) parts.push(title)
  return parts.join('_')
}

// ── URL safety ────────────────────────────────────────────────────────────────

// Only ordinary http/https links pasted by staff. Rejects javascript:, data:,
// file:, relative and whitespace/control-bearing values. Empty is treated as
// "no link" by callers, so an empty string is not itself valid here.
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return false
  // Reject embedded control characters (U+0000–U+001F) that could smuggle a scheme.
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f]/.test(trimmed)
}

// ── Production status transitions ─────────────────────────────────────────────

export type VideoAction =
  | 'mark_shot'
  | 'mark_footage_uploaded'
  | 'start_editing'
  | 'send_to_internal_review'
  | 'request_internal_changes'
  | 'approve_internal'
  | 'resume_editing'
  | 'mark_sent_to_client'
  | 'request_client_changes'
  | 'mark_client_approved'

export interface VideoTransitionContext {
  footageUrl?: string | null
  clientApprovalUrl?: string | null
  editorUserId?: string | null
}

export interface VideoTransitionResult {
  ok: boolean
  next?: VideoProductionStatus
  error?: string
}

interface TransitionRule {
  from: VideoProductionStatus[]
  to: VideoProductionStatus
  guard?: (ctx: VideoTransitionContext) => string | null // returns an error message or null
}

const TRANSITIONS: Record<VideoAction, TransitionRule> = {
  mark_shot: { from: ['not_shot'], to: 'shot' },
  mark_footage_uploaded: {
    from: ['shot'],
    to: 'ready_to_edit',
    guard: ctx => (isSafeHttpUrl(ctx.footageUrl) ? null : 'A valid footage link (https) is required before it can be ready to edit.'),
  },
  start_editing: {
    from: ['ready_to_edit'],
    to: 'editing',
    guard: ctx => (ctx.editorUserId ? null : 'Assign an editor before editing can start.'),
  },
  send_to_internal_review: { from: ['editing'], to: 'internal_review' },
  request_internal_changes: { from: ['internal_review'], to: 'internal_changes' },
  approve_internal: { from: ['internal_review'], to: 'ready_for_client' },
  resume_editing: { from: ['internal_changes', 'client_changes'], to: 'editing' },
  mark_sent_to_client: {
    from: ['ready_for_client'],
    to: 'sent_to_client',
    guard: ctx => (isSafeHttpUrl(ctx.clientApprovalUrl) ? null : 'A valid client approval link (https) is required before sending to the client.'),
  },
  request_client_changes: { from: ['sent_to_client'], to: 'client_changes' },
  mark_client_approved: { from: ['sent_to_client'], to: 'client_approved' },
}

// The single source of truth for status changes. Returns the next status or a
// clear error; callers never mutate status directly.
export function applyVideoTransition(
  status: VideoProductionStatus,
  action: VideoAction,
  ctx: VideoTransitionContext = {},
): VideoTransitionResult {
  const rule = TRANSITIONS[action]
  if (!rule) return { ok: false, error: 'Unknown action.' }
  if (!rule.from.includes(status)) {
    return { ok: false, error: `Cannot ${action.replace(/_/g, ' ')} from ${VIDEO_STATUS_LABELS[status]}.` }
  }
  const guardError = rule.guard?.(ctx)
  if (guardError) return { ok: false, error: guardError }
  return { ok: true, next: rule.to }
}

// Which actions are offered from a given status (used to render buttons).
export function availableVideoActions(status: VideoProductionStatus): VideoAction[] {
  return (Object.keys(TRANSITIONS) as VideoAction[]).filter(action => TRANSITIONS[action].from.includes(status))
}

// Statuses an assigned editor actively works (for My Video Queue).
export const EDITOR_ACTIVE_STATUSES: VideoProductionStatus[] = ['ready_to_edit', 'editing', 'internal_changes']
// Status a manager/admin must internally review.
export const INTERNAL_REVIEW_STATUS: VideoProductionStatus = 'internal_review'

// A video belongs in the signed-in editor's queue: assigned to them and in an
// actively-editable state.
export function editorQueueMatch(
  video: { editor_user_id: string | null; production_status: VideoProductionStatus },
  userId: string | null | undefined,
): boolean {
  return Boolean(userId) && video.editor_user_id === userId && EDITOR_ACTIVE_STATUSES.includes(video.production_status)
}

// A video needs the signed-in manager/admin's internal review.
export function internalReviewMatch(
  video: { production_status: VideoProductionStatus },
  isManager: boolean,
): boolean {
  return isManager && video.production_status === INTERNAL_REVIEW_STATUS
}
