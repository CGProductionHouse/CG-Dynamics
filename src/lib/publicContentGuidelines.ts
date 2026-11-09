import { createClient } from '@supabase/supabase-js'
import { projectGuide, type PublishedContentGuideline } from './clientContentGuides'
import { supabase } from './supabase'

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
