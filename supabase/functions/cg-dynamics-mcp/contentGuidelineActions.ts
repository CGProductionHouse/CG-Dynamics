// #450 — Assistant content actions: pure validation and shaping.
//
// Import-free by design (no Deno, no Supabase, no app imports) so the same rules are
// unit-tested directly. The readiness derivation mirrors src/lib/contentAutopilot.ts
// and a drift-guard test pins the two together.
//
// Hard rules encoded here:
//   * no raw Graph id, item id, drive id or URL ever reaches staff/client text;
//   * a video is addressed by exact id — never by loose title, never across clients;
//   * `monthly_deliverables` is never written: a video only links to one;
//   * position is changed only through the canonical reorder authority.

export const CONTENT_GUIDELINE_TOOLS = [
  'ensure_content_guideline',
  'list_content_guideline_videos',
  'add_content_guideline_video',
  'update_content_guideline_video',
  'reorder_content_guideline_videos',
  'link_content_guideline_video_deliverable',
  'generate_content_guideline_drafts',
  'get_content_video_readiness',
] as const

export type ContentGuidelineTool = typeof CONTENT_GUIDELINE_TOOLS[number]

/** Fields an Assistant may write on a saved video. Everything else is refused. */
export const EDITABLE_VIDEO_FIELDS = [
  'title', 'objective', 'hook', 'cta', 'script', 'shot_breakdown',
  'requirements', 'visual_notes', 'notes', 'month',
] as const

export type EditableVideoField = typeof EDITABLE_VIDEO_FIELDS[number]

const MAX_LENGTHS: Record<EditableVideoField, number> = {
  title: 200, objective: 1000, hook: 500, cta: 500, script: 20000,
  shot_breakdown: 8000, requirements: 4000, visual_notes: 4000, notes: 4000, month: 10,
}

const MONTH = /^\d{4}-\d{2}(-\d{2})?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Normalise a month to the canonical first-of-month date. */
export function normaliseMonth(value: string): string {
  return `${value.slice(0, 7)}-01`
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * The exact patch an Assistant may apply to one saved video. Unknown fields are
 * refused rather than dropped silently, so a caller never believes it wrote something
 * the server ignored. An empty string clears an optional field; the title cannot be cleared.
 */
export function validateVideoPatch(input: Record<string, unknown>): Validated<Record<string, string | null>> {
  const patch: Record<string, string | null> = {}
  const reserved = ['position', 'video_number', 'client_id', 'content_guideline_id', 'deliverable_id', 'status', 'production_status', 'canonical_name']
  for (const key of reserved) {
    if (key in input) {
      return { ok: false, error: `${key} cannot be set here. Use the dedicated reorder, link or production action.` }
    }
  }
  for (const [key, raw] of Object.entries(input)) {
    if (key === 'content_guide_idea_id' || key === 'idempotency_key') continue
    if (!(EDITABLE_VIDEO_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, error: `${key} is not an editable video field.` }
    }
    const field = key as EditableVideoField
    if (raw === null) {
      if (field === 'title') return { ok: false, error: 'A video must keep a title.' }
      patch[field] = null
      continue
    }
    if (typeof raw !== 'string') return { ok: false, error: `${field} must be text.` }
    const value = raw.trim()
    if (value.length > MAX_LENGTHS[field]) return { ok: false, error: `${field} is longer than ${MAX_LENGTHS[field]} characters.` }
    if (field === 'title' && !value) return { ok: false, error: 'A video must keep a title.' }
    if (field === 'month') {
      if (value && !MONTH.test(value)) return { ok: false, error: 'month must be YYYY-MM or YYYY-MM-DD.' }
      patch[field] = value ? normaliseMonth(value) : null
      continue
    }
    patch[field] = value || null
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'No editable field was supplied.' }
  return { ok: true, value: patch }
}

/** A new draft video. It never arrives with a script the caller claims is finished work. */
export function validateNewVideo(input: Record<string, unknown>): Validated<Record<string, string | null>> {
  if (typeof input.title !== 'string' || !input.title.trim()) {
    return { ok: false, error: 'A new video needs a descriptive title.' }
  }
  const fields = { ...input }
  delete fields.content_guideline_id
  delete fields.idempotency_key
  return validateVideoPatch(fields)
}

/** The canonical reorder contract: every id exactly once, and nothing from another guideline. */
export function validateReorder(videoIds: unknown, savedIds: string[]): Validated<string[]> {
  if (!Array.isArray(videoIds) || !videoIds.length) return { ok: false, error: 'video_ids must list the videos in their new order.' }
  const ids = videoIds.map(String)
  if (ids.some(id => !isUuid(id))) return { ok: false, error: 'Every video id must be an exact UUID.' }
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'A video may appear only once in the new order.' }
  const saved = new Set(savedIds)
  const foreign = ids.filter(id => !saved.has(id))
  if (foreign.length) return { ok: false, error: 'That order includes a video that does not belong to this guideline.' }
  if (ids.length !== savedIds.length) return { ok: false, error: 'The new order must list every video in this guideline exactly once.' }
  return { ok: true, value: ids }
}

/**
 * Linking a video to a real Client Schedule slot. Provenance must be exact: the
 * deliverable has to belong to the same client, and nothing here writes the deliverable.
 */
export function validateDeliverableLink(input: {
  videoClientId: string | null
  deliverable: { id: string; client_id: string | null; month: string | null; deliverable_type: string } | null
  unlink: boolean
}): Validated<'link' | 'unlink'> {
  if (input.unlink) return { ok: true, value: 'unlink' }
  if (!input.deliverable) return { ok: false, error: 'That Client Schedule deliverable was not found.' }
  if (!input.videoClientId || input.deliverable.client_id !== input.videoClientId) {
    return { ok: false, error: 'A video can only link to a Client Schedule slot belonging to its own client.' }
  }
  if (!['video', 'reel'].includes(input.deliverable.deliverable_type)) {
    return { ok: false, error: 'Only a video or reel slot can hold a guideline video.' }
  }
  return { ok: true, value: 'link' }
}

// ── Readiness (mirrors src/lib/contentAutopilot.ts) ──────────────────────────

export type RawEvidenceState = 'UNVERIFIED' | 'MISSING' | 'PARTIAL' | 'VERIFIED'
export type EditReadiness =
  | 'BLOCKED_NO_MAPPING' | 'BLOCKED_RAW_MISSING' | 'RAW_UNVERIFIED' | 'RAW_PARTIAL'
  | 'READY_TO_EDIT' | 'IN_EDIT' | 'IN_REVIEW' | 'FINAL_READY'

const IN_EDIT = new Set(['editing', 'internal_changes'])
const IN_REVIEW = new Set(['internal_review', 'ready_for_client', 'sent_to_client', 'client_changes'])

export function deriveRawEvidence(input: {
  folderState: 'mapped' | 'ready_to_create' | 'blocked'
  providerReadable?: boolean
  closeoutUploadStatus?: 'verified' | 'missing' | 'partial' | 'unverified' | null
  videoUploadStatus?: 'verified' | 'missing' | 'partial' | null
}): RawEvidenceState {
  if (input.providerReadable === false) return 'UNVERIFIED'
  if (input.folderState !== 'mapped') return 'UNVERIFIED'
  switch (input.videoUploadStatus ?? input.closeoutUploadStatus ?? null) {
    case 'verified': return 'VERIFIED'
    case 'partial': return 'PARTIAL'
    case 'missing': return 'MISSING'
    default: return 'UNVERIFIED'
  }
}

export function deriveEditReadiness(input: {
  folderState: 'mapped' | 'ready_to_create' | 'blocked'
  folderBlocked: 'BLOCKED_MISSING_SHORT_CODE' | 'BLOCKED_MISSING_ONEDRIVE_MAPPING' | null
  raw: RawEvidenceState
  productionStatus: string
  finalPublished?: boolean
}): { readiness: EditReadiness; reason: string; next_action: string } {
  const answer = (readiness: EditReadiness, reason: string, next_action: string) => ({ readiness, reason, next_action })
  if (input.productionStatus === 'client_approved' || input.finalPublished) {
    return answer('FINAL_READY', 'This video is approved and its final output is settled.', 'No action — confirm the client has the final output.')
  }
  if (IN_REVIEW.has(input.productionStatus)) return answer('IN_REVIEW', 'This video is already in review.', 'Chase the outstanding review decision.')
  if (IN_EDIT.has(input.productionStatus)) return answer('IN_EDIT', 'An editor is already working on this video.', 'No action — editing is in progress.')
  if (input.folderState === 'blocked') {
    return input.folderBlocked === 'BLOCKED_MISSING_SHORT_CODE'
      ? answer('BLOCKED_NO_MAPPING', 'This client has no configured short code, so the canonical production folder cannot be named.', 'An admin must set the client short code in Dynamics.')
      : answer('BLOCKED_NO_MAPPING', 'This run has no mapped OneDrive production folder yet.', 'An admin must map this client folder and the run month folder.')
  }
  if (input.folderState === 'ready_to_create') {
    return answer('BLOCKED_NO_MAPPING', 'The canonical production folder for this video does not exist yet.', 'Create the canonical production folder from the run.')
  }
  if (input.productionStatus === 'ready_to_edit') return answer('READY_TO_EDIT', 'This video has been marked ready to edit.', 'Assign an editor.')
  switch (input.raw) {
    case 'VERIFIED': return answer('READY_TO_EDIT', 'Raw footage is verified in the canonical production folder.', 'Assign an editor.')
    case 'PARTIAL': return answer('RAW_PARTIAL', 'Only part of the raw footage is present.', 'Confirm the remaining raw footage is uploaded.')
    case 'MISSING': return answer('BLOCKED_RAW_MISSING', 'The canonical production folder was checked and holds no raw footage.', 'Upload the raw footage for this video.')
    default: return answer('RAW_UNVERIFIED', 'Raw footage has not been verified yet — this is unknown, not empty.', 'Run upload verification for this run.')
  }
}

/**
 * Staff-facing shape for one video. Durable Graph identifiers are deliberately reduced
 * to booleans and canonical names: no drive id, item id or URL leaves this function.
 */
export function shapeVideoForAssistant(input: {
  video: Record<string, unknown>
  position: number
  folderName: string | null
  folderState: 'mapped' | 'ready_to_create' | 'blocked'
  folderBlocked: 'BLOCKED_MISSING_SHORT_CODE' | 'BLOCKED_MISSING_ONEDRIVE_MAPPING' | null
  raw: RawEvidenceState
  readiness: { readiness: EditReadiness; reason: string; next_action: string }
  finalOutputState: string
}): Record<string, unknown> {
  const video = input.video
  return {
    content_guide_idea_id: video.id,
    name: `Video ${String(input.position).padStart(2, '0')}${video.title ? ` - ${video.title}` : ''}`,
    title: video.title ?? null,
    position: input.position,
    month: video.month ?? null,
    allocated: Boolean(video.deliverable_id),
    deliverable_id: video.deliverable_id ?? null,
    objective: video.objective ?? null,
    hook: video.hook ?? null,
    cta: video.cta ?? null,
    has_script: typeof video.script === 'string' && video.script.trim().length > 0 && !/^script pending/i.test(video.script.trim()),
    production_status: video.production_status ?? null,
    editor: video.editor_name ?? null,
    production_folder_name: input.folderName,
    production_folder_state: input.folderState,
    production_folder_blocked: input.folderBlocked,
    raw_upload: input.raw,
    edit_readiness: input.readiness.readiness,
    readiness_reason: input.readiness.reason,
    next_action: input.readiness.next_action,
    final_output: input.finalOutputState,
  }
}
