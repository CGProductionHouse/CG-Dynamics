import { supabase } from './supabase'

export const CONTENT_REVIEW_BUCKET = 'content-review-snapshots'
export const CONTENT_CHANNELS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'manual'] as const
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
  if (!input.caption.trim() || input.channels.length === 0) throw new Error('Add the caption and target channels.')
  const assetPath = `${input.deliverableId}/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from(CONTENT_REVIEW_BUCKET).upload(assetPath, input.file, { upsert: false, contentType: input.file.type })
  if (upload.error) throw upload.error
  const result = await supabase.rpc('submit_content_review', {
    p_deliverable_id: input.deliverableId, p_asset_path: assetPath, p_caption: input.caption,
    p_channels: input.channels, p_scheduled_at: input.scheduledAt, p_client_required: input.clientRequired,
  })
  if (result.error) throw result.error
  return result.data as string
}
