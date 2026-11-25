import { supabase } from './supabase'

export const CONTENT_REVIEW_BUCKET = 'content-review-snapshots'
export const CONTENT_CHANNELS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'manual'] as const
const REVIEW_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export interface ContentReviewSubmissionAttempt {
  readonly deliverableId: string; readonly assetPath: string; readonly mediaType: string
  readonly caption: string; readonly channels: readonly string[]; readonly scheduledAt: string; readonly clientRequired: boolean
}
export class UnverifiedContentReviewSubmission extends Error {
  readonly attempt: ContentReviewSubmissionAttempt
  constructor(attempt: ContentReviewSubmissionAttempt) {
    super('The review submission could not be verified. Check this submission before sending again.')
    this.name = 'UnverifiedContentReviewSubmission'
    this.attempt = attempt
  }
}

/** Read back only this upload's unique immutable path and canonical item. A lost
 * response is not permission to upload/submit again. RLS remains authoritative;
 * missing, changed or unreadable evidence never becomes a successful receipt.
 * This read does not approve content or create a publication job.
 */
export async function reconcileContentReviewSubmission(attempt: ContentReviewSubmissionAttempt): Promise<string | null> {
  if (!REVIEW_UUID.test(attempt.deliverableId) || !attempt.assetPath.startsWith(`${attempt.deliverableId}/`)) return null
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const result = await supabase.from('content_review_versions')
      .select('id,deliverable_id,asset_path,media_type,caption,channels,scheduled_at,client_approval_required,state')
      .eq('deliverable_id', attempt.deliverableId).eq('asset_path', attempt.assetPath).abortSignal(controller.signal).maybeSingle()
    const row = result.data
    if (result.error || !row || typeof row.id !== 'string' || !REVIEW_UUID.test(row.id)
      || row.deliverable_id !== attempt.deliverableId || row.asset_path !== attempt.assetPath || row.media_type !== attempt.mediaType
      || row.caption !== attempt.caption || row.client_approval_required !== attempt.clientRequired
      || !Array.isArray(row.channels) || row.channels.length !== attempt.channels.length || row.channels.some((v: unknown, i: number) => v !== attempt.channels[i])
      || !Number.isFinite(Date.parse(row.scheduled_at)) || Date.parse(row.scheduled_at) !== Date.parse(attempt.scheduledAt)
      || !['internal_review', 'client_review', 'approved', 'changes_requested', 'superseded'].includes(row.state)) return null
    return row.id
  } catch { return null }
  finally { clearTimeout(timeout) }
}
export interface ContentReview {
  id: string
  deliverable_id?: string
  deliverable?: { month: string; production_status: string }
  client_id?: string
  client?: { name: string } | null
  title: string
  asset_path: string
  media_type: string
  caption: string
  channels: string[]
  scheduled_at: string
  state: 'internal_review' | 'client_review' | 'approved' | 'changes_requested' | 'superseded'
}
export const REVIEW_LABELS: Record<ContentReview['state'], string> = {
  internal_review: 'Needs review', client_review: 'Client approval', approved: 'Ready to schedule',
  changes_requested: 'Changes requested', superseded: 'Previous version',
}

/** Validate the existing client queue projection, not staff-only review rows.
 * Missing/malformed evidence is unavailable, never an empty or actionable queue.
 * The RPC/RLS remains the ownership authority; no client override is accepted here.
 */
export function projectClientReviewQueue(value: unknown): ContentReview[] | null {
  if (!Array.isArray(value)) return null
  const rows: ContentReview[] = []
  const ids = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)
      || ids.has(row.id.toLowerCase())
      || typeof row.title !== 'string' || !row.title.trim()
      || typeof row.asset_path !== 'string' || !row.asset_path.trim()
      || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(row.media_type as string)
      || typeof row.caption !== 'string'
      || !Array.isArray(row.channels) || row.channels.length < 1 || row.channels.length > 5
      || !row.channels.every(channel => typeof channel === 'string' && CONTENT_CHANNELS.some(allowed => allowed === channel))
      || (row.state !== 'client_review' && row.state !== 'approved')
      || typeof row.scheduled_at !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(row.scheduled_at)
      || !Number.isFinite(Date.parse(row.scheduled_at))) return null
    const day = row.scheduled_at.slice(0, 10)
    const date = new Date(`${day}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null
    ids.add(row.id.toLowerCase())
    rows.push({
      id: row.id, title: row.title, asset_path: row.asset_path, media_type: row.media_type as string,
      caption: row.caption, channels: [...row.channels] as string[], scheduled_at: row.scheduled_at, state: row.state,
    })
  }
  return rows
}

export async function listContentReviews(deliverableId?: string) {
  const rows: ContentReview[] = []
  for (let from = 0; ; from += 200) {
    let query = supabase.from('content_review_versions').select('*,client:clients(name),deliverable:monthly_deliverables!inner(month,production_status)').order('submitted_at', { ascending: false }).order('id')
    if (deliverableId) query = query.eq('deliverable_id', deliverableId)
    else query = query.in('state', ['internal_review', 'client_review', 'approved', 'changes_requested']).neq('deliverable.production_status', 'posted').neq('deliverable.production_status', 'scheduled')
    const result = await query.range(from, from + 199)
    if (result.error) return { data: null, error: result.error }
    const page = (result.data ?? []) as ContentReview[]
    rows.push(...page)
    if (page.length < 200) return { data: rows, error: null }
  }
}
export async function submitContentReview(input: {
  deliverableId: string; file: File; caption: string; channels: string[]; scheduledAt: string; clientRequired: boolean
}) {
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' }
  const extension = extensions[input.file.type]
  if (!extension || input.file.size === 0 || input.file.size > 50 * 1024 * 1024) throw new Error('Choose a JPG, PNG, WebP or MP4 file up to 50 MB.')
  if (!REVIEW_UUID.test(input.deliverableId)) throw new Error('Choose a canonical Client Schedule item first.')
  if (!input.caption.trim() || input.caption.trim().length > 10000 || input.channels.length === 0 || input.channels.length > 5
    || input.channels.some(channel => !CONTENT_CHANNELS.some(allowed => allowed === channel))) throw new Error('Add the caption and valid target channels.')
  if (!/T.+(?:Z|[+-]\d{2}:\d{2})$/.test(input.scheduledAt) || !(Date.parse(input.scheduledAt) > Date.now())) throw new Error('Choose a future publication time with its time zone.')
  const assetPath = `${input.deliverableId}/${crypto.randomUUID()}.${extension}`
  const attempt: ContentReviewSubmissionAttempt = Object.freeze({ deliverableId: input.deliverableId, assetPath, mediaType: input.file.type,
    caption: input.caption.trim(), channels: Object.freeze([...input.channels]), scheduledAt: input.scheduledAt, clientRequired: input.clientRequired })
  const upload = await supabase.storage.from(CONTENT_REVIEW_BUCKET).upload(assetPath, input.file, { upsert: false, contentType: input.file.type })
  if (upload.error) throw upload.error
  let result: { data: unknown; error: { code?: string; message?: string } | null } | undefined
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    result = await supabase.rpc('submit_content_review', {
      p_deliverable_id: attempt.deliverableId, p_asset_path: attempt.assetPath, p_caption: attempt.caption,
      p_channels: [...attempt.channels], p_scheduled_at: attempt.scheduledAt, p_client_required: attempt.clientRequired,
    }).abortSignal(controller.signal)
  } catch { /* Reconcile this exact attempt; the transaction may have committed. */ }
  finally { clearTimeout(timeout) }
  const receipt = await reconcileContentReviewSubmission(attempt)
  if (receipt && (typeof result?.data !== 'string' || !REVIEW_UUID.test(result.data) || result.data === receipt)) return receipt
  // A known database rejection is atomic. Preserve only the explicit source
  // guard's actionable copy; other failures stay uncertain and never auto retry.
  const sourceGuards = ['Link the schedule item to a client first', 'Link the exact Canva page first', 'Link the canonical guideline video first',
    'Review time must match the canonical Client Schedule date', 'Choose a future publication time',
    'Only the assigned staff member or a manager can submit this content', 'A manager must choose internal approval only',
    'Resolve published or scheduled content through Client Schedule before submitting a new review']
  if (!receipt && result?.error?.code === 'P0001' && sourceGuards.includes(result.error.message ?? '')) throw new Error(result.error.message)
  throw new UnverifiedContentReviewSubmission(attempt)
}
