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
