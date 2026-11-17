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

/** Fixed staff instructions, not raw provider errors or a retry permission. */
export function publicationNextAction(item: Pick<StaffPublication, 'state' | 'errorCode' | 'providerMayHaveStarted'>): string | null {
  if (item.state === 'unknown_outcome' || item.providerMayHaveStarted && ['blocked', 'failed'].includes(item.state))
    return 'A post may already exist. Check the native platform and reconcile this attempt before scheduling again.'
  if (!['blocked', 'failed'].includes(item.state)) return null
  if (item.errorCode === 'FRESH_TEAMS_EVIDENCE_REQUIRED')
    return 'The Teams schedule could not be verified as current. Ask the scheduling owner to review the sync hold and refresh the approved capture; do not change Teams or reschedule this post to bypass it.'
  if (['CURRENT_UNSCHEDULED_REVIEW_REQUIRED', 'CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE', 'PREPARATION_SOURCE_CHANGED', 'BLOCKED_SOURCE_CHANGED', 'CLAIM_OR_SOURCE_LOST'].includes(item.errorCode ?? ''))
    return 'The approved content or schedule changed. Review the current creative, date and any native schedule before preparing a new confirmation.'
  if (item.errorCode === 'BLOCKED_OVERDUE_REVIEW')
    return 'The planned time has passed. Check the native platform and agree a new schedule before preparing a new confirmation.'
  if (item.errorCode === 'BLOCKED_TOKEN_OR_TIME')
    return 'The account token or scheduled time could not be verified. Ask an administrator to review both before preparing a new confirmation.'
  if (['PRIVATE_PREFLIGHT_UNAVAILABLE', 'CURRENT_PROVIDER_PROOF_REQUIRED'].includes(item.errorCode ?? ''))
    return 'The exact Facebook account or publishing permission could not be verified. Ask an administrator to check the connection; do not choose a different client account.'
  if (item.errorCode === 'REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED')
    return 'The approved image did not pass the publishing checks. Review the original file before preparing a new confirmation.'
  if (['PUBLISHING_DISABLED', 'PROVIDER_BINDING_NOT_CONFIGURED', 'EXACT_ACCOUNT_RELEASE_REQUIRED'].includes(item.errorCode ?? ''))
    return 'Dynamics publishing is not enabled for this account. Continue with Teams and the native platform until the controlled release is approved.'
  return 'Ask a publishing manager to review this attempt and the native platform before scheduling again. No automatic publication retry is available here.'
}
export interface StaffPublicationPreview {
  reviewId: string; clientId: string; accountId: string; platform: 'facebook'; caption: string; mediaType: 'image/png' | 'image/jpeg'
  assetSha256: string; scheduledAt: string; fingerprint: string
}
export interface StaffFacebookInspection {
  reviewId: string; clientId: string; accountId: string; accountName: string | null; scheduledAt: string; checkedAt: string
  assetSha256: string | null; canConfirm: false; canPublish: false
  checks: { key: 'account' | 'image' | 'teams' | 'time' | 'release'; status: 'pass' | 'blocked' | 'unavailable'; code: string | null }[]
}
export const FACEBOOK_INSPECTION_LABELS = { account: 'Facebook Page and permissions', image: 'Approved image', teams: 'Teams schedule', time: 'Scheduled time', release: 'Publishing release' } as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 512

/** Readiness is diagnostic only. No inspection result becomes confirmation or
 * provider authority, even when every individual read passes.
 */
export function projectFacebookInspection(value: unknown, reviewId: string): StaffFacebookInspection | null {
  if (!record(value) || value.ok !== true || !record(value.inspection)) return null
  const p = value.inspection
  if (p.contract !== 'facebook_publication_readiness_v1' || p.reviewId !== reviewId || !UUID.test(reviewId)
    || typeof p.clientId !== 'string' || !UUID.test(p.clientId) || typeof p.accountId !== 'string' || !/^\d+$/.test(p.accountId)
    || p.canConfirm !== false || p.canPublish !== false || !Array.isArray(p.checks) || p.checks.length !== 5
    || typeof p.scheduledAt !== 'string' || !Number.isFinite(Date.parse(p.scheduledAt)) || typeof p.checkedAt !== 'string' || !Number.isFinite(Date.parse(p.checkedAt))
    || p.accountName !== null && (typeof p.accountName !== 'string' || !p.accountName.trim() || p.accountName.length > 200 || [...p.accountName].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    || p.assetSha256 !== null && (typeof p.assetSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.assetSha256))) return null
  const codes = { account: 'CURRENT_PROVIDER_PROOF_REQUIRED', image: 'REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED', teams: 'FRESH_TEAMS_EVIDENCE_REQUIRED', time: 'BLOCKED_OVERDUE_REVIEW', release: 'PUBLISHING_DISABLED' }
  const checks: StaffFacebookInspection['checks'] = [], seen = new Set<string>()
  for (const check of p.checks) {
    if (!record(check) || typeof check.key !== 'string' || !Object.hasOwn(codes, check.key) || seen.has(check.key)
      || !['pass', 'blocked', 'unavailable'].includes(String(check.status))
      || (check.status === 'pass' ? check.code !== null : check.code !== codes[check.key as keyof typeof codes])) return null
    seen.add(check.key)
    checks.push({ key: check.key as StaffFacebookInspection['checks'][number]['key'], status: check.status as StaffFacebookInspection['checks'][number]['status'], code: check.code as string | null })
  }
  if ((checks.find(c => c.key === 'image')?.status === 'pass') !== (p.assetSha256 !== null)) return null
  return { reviewId, clientId: p.clientId, accountId: p.accountId, accountName: p.accountName as string | null,
    scheduledAt: p.scheduledAt, checkedAt: p.checkedAt, assetSha256: p.assetSha256 as string | null, canConfirm: false, canPublish: false, checks }
}

export async function inspectStaffPublication(reviewId: string): Promise<{ inspection: StaffFacebookInspection | null; message: string | null }> {
  const unavailable = { inspection: null, message: 'Readiness could not be verified. Publishing stays unchanged; ask an administrator to check the read-only inspection setup.' }
  if (!UUID.test(reviewId)) return unavailable
  try {
    const { data, error } = await supabase.functions.invoke('social-publication-authorization', { body: { action: 'inspect', reviewId } })
    if (!error) {
      const inspection = projectFacebookInspection(data, reviewId)
      return inspection ? { inspection, message: null } : unavailable
    }
    // FunctionsHttpError contains its Response here. Read only fixed codes;
    // SDK/provider message text and response extras never enter staff copy.
    if (record(error) && error.context instanceof Response) {
      const body: unknown = await error.context.clone().json()
      if (record(body) && body.error === 'EXACT_ACCOUNT_MAPPING_REQUIRED') return { inspection: null, message: 'No single active Facebook Page mapping could be verified for this client. Ask an administrator to review the existing mapping.' }
      if (record(body) && body.error === 'CURRENT_UNSCHEDULED_REVIEW_REQUIRED') return { inspection: null, message: 'This is not a current approved, unscheduled post. Review its approval and native schedule before continuing.' }
    }
    return unavailable
  } catch { return unavailable }
}

export type PublicationReview = Pick<ContentReview, 'id' | 'state' | 'channels' | 'media_type'>

/** UI affordance only: the current candidate supports approved Facebook PNG/JPEG.
 * Other-platform history/withdrawal remains visible. This does not prove access
 * or override the backend's exact-account/source/authorization release gates.
 */
export function canPrepareFacebookPhotoReview(review: PublicationReview | null | undefined): boolean {
  return !!review && UUID.test(review.id) && review.state === 'approved' && ['image/png', 'image/jpeg'].includes(review.media_type)
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
      || p.platform !== 'facebook' || !['image/png', 'image/jpeg'].includes(p.mediaType as string) || typeof p.caption !== 'string' || !p.caption.trim() || p.caption.length > 63_206
      || typeof p.assetSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.assetSha256)
      || typeof p.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(p.fingerprint)
      || typeof p.scheduledAt !== 'string' || !Number.isFinite(Date.parse(p.scheduledAt))) return null
    return { reviewId, clientId: t.clientId, accountId: t.accountId, platform: 'facebook', caption: p.caption,
      mediaType: p.mediaType as StaffPublicationPreview['mediaType'], assetSha256: p.assetSha256, fingerprint: p.fingerprint, scheduledAt: p.scheduledAt }
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
