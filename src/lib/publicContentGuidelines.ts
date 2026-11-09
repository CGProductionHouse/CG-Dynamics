import { createClient } from '@supabase/supabase-js'
import { projectGuide, type PublishedContentGuideline } from './clientContentGuides'
import { supabase } from './supabase'
import { projectGuidelineResponse, projectGuidelineReviews, reviewInputError, type GuidelineReviewAction, type GuidelineReviews, type StaffGuidelineResponse } from './guidelineReviews'

export interface SharedContentGuideline { client: { name: string }; guide: PublishedContentGuideline }
export const validGuidelineSharePath = (slug: string, token: string) => slug.length <= 180
  && /^[a-z0-9]+(-[a-z0-9]+)*-content-guideline$/.test(slug) && /^[a-f0-9]{64}$/.test(token)

export function projectSharedGuideline(value: unknown): SharedContentGuideline | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>, client = row.client as Record<string, unknown> | undefined
  const guide = projectGuide(row.guide)
  if (!client || typeof client.name !== 'string' || !client.name.trim() || !guide || !guide.videos.length
    || guide.videos.some(v => !v.title.trim() || !v.script?.trim())
    || new Set(guide.videos.map(v => v.position)).size !== guide.videos.length) return null
  return { client: { name: client.name }, guide }
}

// Public reads must also work when this browser has an expired staff/client
// session. This isolated anonymous client never reads or refreshes stored auth.
const publicReader = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cg-public-guideline' },
})

export async function readSharedGuideline(slug: string, token: string): Promise<{ data: SharedContentGuideline | null; error: string | null }> {
  if (!validGuidelineSharePath(slug, token)) return { data: null, error: null }
  try {
    const { data, error } = await publicReader.rpc('read_public_content_guideline_share', { p_slug: slug, p_token: token })
    if (error) return { data: null, error: 'This guideline could not be loaded. Please try again.' }
    if (data === null) return { data: null, error: null }
    const projected = projectSharedGuideline(data)
    return { data: projected, error: projected ? null : 'This guideline could not be loaded. Please try again.' }
  } catch { return { data: null, error: 'This guideline could not be loaded. Please try again.' } }
}

export async function manageGuidelineShare(runId: string, action: 'get' | 'publish' | 'revoke') {
  try {
    const { data, error } = await supabase.rpc('manage_content_guideline_share', { p_run_id: runId, p_action: action })
    if (error) return { data: null, error: error.message }
    const row = data as Record<string, unknown> | null
    if (!row || row.content_run_id !== runId || !['published_for_review','not_shared','revoked'].includes(String(row.state))) {
      return { data: null, error: 'The client guideline link could not be verified.' }
    }
    const slug = String(row.public_slug ?? ''), token = String(row.share_token ?? '')
    const published = typeof row.published_at === 'string' ? Date.parse(row.published_at) : NaN
    if (row.state === 'published_for_review' && (!validGuidelineSharePath(slug, token) || !Number.isFinite(published))) return { data: null, error: 'The client guideline link could not be verified.' }
    return { data: { state: String(row.state), url: row.state === 'published_for_review' ? `https://www.cgdynamics.co.za/guidelines/${slug}/${token}?v=cg2-${published}` : null }, error: null }
  } catch { return { data: null, error: 'The client guideline link could not be loaded. Please try again.' } }
}

export async function readGuidelineReviews(slug: string, token: string): Promise<{ data: GuidelineReviews | null; error: string | null }> {
  if (!validGuidelineSharePath(slug, token)) return { data: null, error: 'This review link is unavailable.' }
  try {
    const { data, error } = await publicReader.rpc('read_public_guideline_video_reviews', { p_slug: slug, p_token: token })
    const result = error ? null : projectGuidelineReviews(data)
    return { data: result, error: result ? null : 'Reviews could not be loaded. Your guideline is still available below.' }
  } catch { return { data: null, error: 'Reviews could not be loaded. Please try again.' } }
}

export interface GuidelineResponseInput {
  publishedAt: string; position: number; action: GuidelineReviewAction; name: string; message: string; requestId: string; expectedRevision: string | null
}
export async function respondToGuideline(slug: string, token: string, input: GuidelineResponseInput): Promise<{ data: GuidelineReviews | null; error: string | null }> {
  const invalid = reviewInputError(input.name, input.message, input.action)
  if (invalid || !validGuidelineSharePath(slug, token)) return { data: null, error: invalid ?? 'This review link is unavailable.' }
  try {
    const { data, error } = await publicReader.rpc('respond_public_guideline_video', {
      p_slug: slug, p_token: token, p_published_at: input.publishedAt, p_position: input.position,
      p_action: input.action, p_reviewer_name: input.name.trim(), p_message: input.message.trim(),
      p_request_id: input.requestId, p_expected_revision: input.expectedRevision,
    })
    const result = error ? null : projectGuidelineReviews(data)
    if (result && data.saved_response_id === input.requestId && result.published_at === input.publishedAt
      && result.videos.some(v => v.position === input.position && v.responses.some(r => r.id === input.requestId))) return { data: result, error: null }
    const message = String(error?.message ?? '')
    const safeMessage = [
      'This review link is unavailable.', 'This guideline has been updated. Refresh before responding.',
      'Another response was added. Refresh the reviews before responding.',
      'Several responses were just received. Please try again in a few minutes.',
    ].find(known => message === known)
    return { data: null, error: safeMessage ?? 'Your response could not be confirmed. Please try again; it will not be saved twice.' }
  } catch { return { data: null, error: 'Your response could not be confirmed. Please try again; it will not be saved twice.' } }
}

export async function readStaffGuidelineReviews(runId: string): Promise<{ data: StaffGuidelineResponse[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('get_guideline_client_reviews', { p_run_id: runId })
    if (error || data?.content_run_id !== runId || !Array.isArray(data.responses)) return { data: null, error: 'Client responses could not be loaded.' }
    const rows: StaffGuidelineResponse[] = []
    for (const row of data.responses) {
      const response = projectGuidelineResponse(row)
      if (!response || !Number.isSafeInteger(row.position) || row.position < 1 || typeof row.title !== 'string'
        || typeof row.published_at !== 'string' || !Number.isFinite(Date.parse(row.published_at))
        || typeof row.current_publication !== 'boolean' || typeof row.matches_current_video !== 'boolean') return { data: null, error: 'Client responses could not be verified.' }
      rows.push({ ...response, position: row.position, title: row.title, published_at: row.published_at, current_publication: row.current_publication, matches_current_video: row.matches_current_video })
    }
    return { data: rows, error: null }
  } catch { return { data: null, error: 'Client responses could not be loaded.' } }
}
