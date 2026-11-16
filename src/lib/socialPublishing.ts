import { supabase } from './supabase'
import type { ContentReview } from './contentReviews'
export const PUBLICATION_CONFIRMATION_VISIBLE = import.meta.env.VITE_SOCIAL_PUBLISHING_PREVIEW === 'true'

export const PUBLICATION_STATE_LABELS = {
  queued: 'Queued in Dynamics', submitting: 'Submission started', processing: 'Processing at provider',
  provider_scheduled: 'Scheduled at provider', posted: 'Verified posted', retry_wait: 'Waiting to retry',
  blocked: 'Needs review', failed: 'Failed', unknown_outcome: 'Needs reconciliation', cancelled: 'Stopped in Dynamics',
} as const
export interface StaffPublication {
  jobId: string; platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube'; accountId: string; accountLabel: string
  scheduledAt: string; state: keyof typeof PUBLICATION_STATE_LABELS
  authorizationState: 'recorded' | 'revoked' | 'unconfirmed'; providerMayHaveStarted: boolean; postUrl: string | null; errorCode: string | null
}
export interface StaffPublicationStatus { reviewId: string; clientId: string; items: StaffPublication[]; canAuthorize: false }
export interface StaffPublicationPreview {
  reviewId: string; clientId: string; accountId: string; platform: 'facebook'; caption: string; mediaType: 'image/png'
  assetSha256: string; scheduledAt: string; fingerprint: string
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 512

export type PublicationReview = Pick<ContentReview, 'id' | 'state' | 'channels' | 'media_type'>

/** UI affordance only: the current candidate supports approved Facebook PNGs.
 * Other-platform history/withdrawal remains visible. This does not prove access
 * or override the backend's exact-account/source/authorization release gates.
 */
export function canPrepareFacebookPhotoReview(review: PublicationReview | null | undefined): boolean {
  return !!review && UUID.test(review.id) && review.state === 'approved' && review.media_type === 'image/png'
    && Array.isArray(review.channels) && review.channels.includes('facebook')
}

/** No default empty/healthy result when the backend is absent or unreadable. */
export function projectPublicationStatus(value: unknown, reviewId: string): StaffPublicationStatus | null {
  if (!record(value) || value.ok !== true || !record(value.status)) return null
  const s = value.status
  if (s.reviewId !== reviewId || !UUID.test(reviewId) || typeof s.clientId !== 'string' || !UUID.test(s.clientId)
    || s.canAuthorize !== false || !Array.isArray(s.items) || s.items.length > 1000) return null
  const items: StaffPublication[] = [], seen = new Set<string>()
  for (const i of s.items) {
    if (!record(i) || typeof i.jobId !== 'string' || !UUID.test(i.jobId) || seen.has(i.jobId)
      || !['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'].includes(String(i.platform))
      || !text(i.accountId) || !text(i.accountLabel) || !text(i.scheduledAt) || !Number.isFinite(Date.parse(i.scheduledAt))
      || typeof i.state !== 'string' || !Object.hasOwn(PUBLICATION_STATE_LABELS, i.state)
      || !['recorded', 'revoked', 'unconfirmed'].includes(String(i.authorizationState)) || typeof i.providerMayHaveStarted !== 'boolean'
      || (i.errorCode !== null && (typeof i.errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(i.errorCode)))) return null
    if (i.postUrl !== null) {
      if (i.platform !== 'facebook' || i.state !== 'posted' || !/^\d+$/.test(i.accountId)
        || typeof i.postUrl !== 'string' || !new RegExp(`^https://www\\.facebook\\.com/${i.accountId}_\\d+$`).test(i.postUrl)) return null
    }
    if (['posted', 'submitting', 'processing', 'provider_scheduled'].includes(i.state) && !i.providerMayHaveStarted) return null
    seen.add(i.jobId)
    items.push({ jobId: i.jobId, platform: i.platform as StaffPublication['platform'], accountId: i.accountId, accountLabel: i.accountLabel,
      scheduledAt: i.scheduledAt, state: i.state as StaffPublication['state'], authorizationState: i.authorizationState as StaffPublication['authorizationState'],
      providerMayHaveStarted: i.providerMayHaveStarted, postUrl: i.postUrl as string | null, errorCode: i.errorCode as string | null })
  }
  return { reviewId, clientId: s.clientId, items, canAuthorize: false }
}

export async function getStaffPublicationStatus(reviewId: string): Promise<StaffPublicationStatus | null> {
  if (!UUID.test(reviewId)) return null
  try {
    const { data, error } = await supabase.functions.invoke('social-publication', { body: { action: 'status', reviewId } })
    return error ? null : projectPublicationStatus(data, reviewId)
  } catch { return null }
}

export async function withdrawStaffPublication(reviewId: string, jobId: string): Promise<{ state: StaffPublication['state']; providerMayHaveStarted: boolean } | null> {
  if (!UUID.test(reviewId) || !UUID.test(jobId)) return null
  try {
    const { data, error } = await supabase.functions.invoke('social-publication', { body: { action: 'revoke', reviewId, jobId } })
    const p = data?.publication
    if (error || data?.ok !== true || !record(p) || p.jobId !== jobId || p.authorizationRevoked !== true
      || typeof p.providerMayHaveStarted !== 'boolean' || typeof p.state !== 'string' || !Object.hasOwn(PUBLICATION_STATE_LABELS, p.state)) return null
    return { state: p.state as StaffPublication['state'], providerMayHaveStarted: p.providerMayHaveStarted }
  } catch { return null }
}

/** No client/account/URL/proof booleans are supplied by the browser. */
export async function prepareStaffPublication(reviewId: string): Promise<StaffPublicationPreview | null> {
  if (!UUID.test(reviewId)) return null
  try {
    const { data, error } = await supabase.functions.invoke('social-publication-authorization', { body: { action: 'preview', reviewId } })
    const p = data?.preview, t = p?.target
    if (error || data?.ok !== true || !record(p) || !record(t) || t.reviewVersionId !== reviewId || t.route !== 'facebook_page'
      || typeof t.clientId !== 'string' || !UUID.test(t.clientId) || typeof t.accountId !== 'string' || !/^\d+$/.test(t.accountId)
      || p.platform !== 'facebook' || p.mediaType !== 'image/png' || typeof p.caption !== 'string' || !p.caption.trim() || p.caption.length > 63_206
      || typeof p.assetSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.assetSha256)
      || typeof p.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(p.fingerprint)
      || typeof p.scheduledAt !== 'string' || !Number.isFinite(Date.parse(p.scheduledAt))) return null
    return { reviewId, clientId: t.clientId, accountId: t.accountId, platform: 'facebook', caption: p.caption,
      mediaType: 'image/png', assetSha256: p.assetSha256, fingerprint: p.fingerprint, scheduledAt: p.scheduledAt }
  } catch { return null }
}

export async function confirmStaffPublication(preview: StaffPublicationPreview): Promise<{ jobId: string } | null> {
  if (!UUID.test(preview.reviewId) || !/^[a-f0-9]{64}$/.test(preview.fingerprint)) return null
  try {
    const { data, error } = await supabase.functions.invoke('social-publication-authorization', { body: { action: 'confirm', reviewId: preview.reviewId,
      expectedFingerprint: preview.fingerprint, confirmPublication: true } })
    const p = data?.publication
    if (error || data?.ok !== true || !record(p) || typeof p.jobId !== 'string' || !UUID.test(p.jobId)
      || typeof p.authorizationId !== 'string' || !UUID.test(p.authorizationId) || p.fingerprint !== preview.fingerprint
      || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(String(p.status))
      || typeof p.state !== 'string' || !Object.hasOwn(PUBLICATION_STATE_LABELS, p.state)) return null
    return { jobId: p.jobId }
  } catch { return null }
}
