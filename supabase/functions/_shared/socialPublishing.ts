// #220: execution policy for children of monthly_deliverables + an immutable
// content_review_versions row. This is not a calendar, OAuth store or live worker.
export type PublishingPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube'
export type PublishingRoute = 'facebook_page' | 'instagram_facebook_login' | 'instagram_login' | 'tiktok_accounts' | 'linkedin_organization' | 'youtube_channel'
export type PublishingState = 'queued' | 'submitting' | 'provider_scheduled' | 'processing' | 'posted' | 'retry_wait' | 'blocked' | 'failed' | 'unknown_outcome' | 'cancelled'

export const PUBLISHING_PATHS = {
  facebook_page: { platform: 'facebook', timing: 'due_time', scopes: ['pages_manage_posts', 'pages_read_engagement'], lifecycle: ['upload_media', 'publish', 'read_post'] },
  instagram_facebook_login: { platform: 'instagram', timing: 'due_time', scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'], lifecycle: ['check_publishing_limit', 'create_container', 'poll_container', 'publish_container', 'read_media'] },
  instagram_login: { platform: 'instagram', timing: 'due_time', scopes: ['instagram_business_basic', 'instagram_business_content_publish'], lifecycle: ['check_publishing_limit', 'create_container', 'poll_container', 'publish_container', 'read_media'] },
  tiktok_accounts: { platform: 'tiktok', timing: 'due_time', scopes: [], lifecycle: ['verify_approved_accounts_contract', 'upload_media', 'publish', 'poll_publish'] },
  linkedin_organization: { platform: 'linkedin', timing: 'due_time', scopes: ['w_organization_social', 'r_organization_social'], lifecycle: ['initialize_upload', 'upload_media', 'poll_media', 'create_post', 'read_post'] },
  youtube_channel: { platform: 'youtube', timing: 'provider_scheduled', scopes: ['https://www.googleapis.com/auth/youtube.upload'], lifecycle: ['resumable_upload_private', 'poll_processing', 'schedule_private_video', 'verify_publication'] },
} as const

export interface ApprovedPublishingReview {
  id: string; deliverable_id: string; client_id: string; state: string
  asset_path: string; media_type: string; caption: string; channels: readonly string[]; scheduled_at: string
}
export interface PublishingBinding {
  clientId: string; connectionId: string; accountId: string; route: PublishingRoute
  active: boolean; grantedScopes: readonly string[]; tokenValidUntil: string | null
  // These must come from current server-side provider evidence, not caller flags.
  appAccessVerified: boolean; accountPublishingVerified: boolean; mediaContractVerified: boolean
  accountsContractVerified?: boolean
}
export interface PublishingIntent {
  key: string; clientId: string; deliverableId: string; reviewVersionId: string
  platform: PublishingPlatform; route: PublishingRoute; connectionId: string; accountId: string
  assetPath: string; assetSha256: string; mediaType: string; caption: string; scheduledAt: string
  authorizationId: string; state: PublishingState; attempt: number
  providerOperationId: string | null; providerPostId: string | null
}
export interface PublishingContext {
  review: ApprovedPublishingReview
  deliverable: { id: string; client_id: string; scheduled_date: string | null; archived_at: string | null; posted_at: string | null; production_status?: string }
  binding: PublishingBinding
  authorization: { id: string; reviewVersionId: string; clientId: string; connectionId: string; accountId: string; route: PublishingRoute; scheduledAt: string; assetSha256: string } | null
  assetSha256: string
  // A date mirrored into Dynamics is not a verified Teams posting instruction.
  teamsScheduleVerified: boolean
  rolloutApproved: boolean
}

const instant = (s: string | null): number | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) return null
  const day = s.slice(0, 10)
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return null
  return Date.parse(s)
}
const hash = (s: string) => /^[a-f0-9]{64}$/.test(s)
const present = (s: string) => typeof s === 'string' && s.trim().length > 0
const jobKey = (...parts: string[]) => `social-publish:v1:${JSON.stringify(parts)}`
export function johannesburgPublishingDate(value: string): string | null {
  const time = instant(value)
  return time === null ? null : new Date(time + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Pure preflight. Approval never implies authorization to schedule or publish. */
export function preparePublishingIntent(context: PublishingContext): { intent: PublishingIntent | null; blockers: string[] } {
  const { review: r, deliverable: d, binding: b, authorization: a } = context
  const path = PUBLISHING_PATHS[b.route]
  const blockers: string[] = []
  if (!path) return { intent: null, blockers: ['UNSUPPORTED_PROVIDER_ROUTE'] }
  if (![r.id, d.id, d.client_id, b.clientId, b.connectionId, b.accountId].every(present)
    || r.client_id !== d.client_id || r.client_id !== b.clientId || r.deliverable_id !== d.id) blockers.push('EXACT_CLIENT_BINDING_REQUIRED')
  if (r.state !== 'approved' || d.archived_at !== null || d.posted_at !== null || ['scheduled', 'posted'].includes(d.production_status ?? '')) blockers.push('CURRENT_APPROVED_REVIEW_REQUIRED')
  if (!r.channels.includes(path.platform)) blockers.push('CHANNEL_NOT_APPROVED')
  if (!present(r.caption) || !hash(context.assetSha256) || !r.asset_path.startsWith(`${d.id}/`)
    || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(r.media_type)) blockers.push('APPROVED_ASSET_REQUIRED')
  if (!d.scheduled_date || johannesburgPublishingDate(r.scheduled_at) !== d.scheduled_date) blockers.push('CANONICAL_SCHEDULE_MISMATCH')
  if (!a || !present(a.id) || a.reviewVersionId !== r.id || a.clientId !== r.client_id || a.accountId !== b.accountId
    || a.connectionId !== b.connectionId || a.route !== b.route
    || a.scheduledAt !== r.scheduled_at || a.assetSha256 !== context.assetSha256) blockers.push('EXPLICIT_PUBLICATION_AUTHORIZATION_REQUIRED')
  if (!context.teamsScheduleVerified) blockers.push('TEAMS_SCHEDULE_VERIFICATION_REQUIRED')
  if (!context.rolloutApproved) blockers.push('PUBLISHING_ROLLOUT_NOT_APPROVED')
  if (!b.active || !b.appAccessVerified || !b.accountPublishingVerified) blockers.push('PROVIDER_ACCESS_NOT_VERIFIED')
  if (path.scopes.some(scope => !b.grantedScopes.includes(scope))) blockers.push('PUBLISHING_PERMISSION_MISSING')
  if (!b.tokenValidUntil || instant(b.tokenValidUntil) === null) blockers.push('TOKEN_FRESHNESS_UNVERIFIED')
  if (!b.mediaContractVerified) blockers.push('PROVIDER_MEDIA_PREFLIGHT_REQUIRED')
  if (b.route.startsWith('instagram') && r.media_type !== 'image/jpeg' && r.media_type !== 'video/mp4') blockers.push('INSTAGRAM_MEDIA_CONVERSION_REQUIRED')
  if (b.route === 'youtube_channel' && r.media_type !== 'video/mp4') blockers.push('YOUTUBE_VIDEO_REQUIRED')
  // No consumer Direct Post fallback; scope names/endpoints must be read from the approved app.
  if (b.route === 'tiktok_accounts' && b.accountsContractVerified !== true) blockers.push('TIKTOK_ACCOUNTS_CONTRACT_UNVERIFIED')
  if (blockers.length || !a) return { intent: null, blockers }
  return { blockers, intent: {
    // A new click/authorization does not create another post for the same version/account.
    key: jobKey(r.client_id, d.id, r.id, path.platform, b.accountId),
    clientId: r.client_id, deliverableId: d.id, reviewVersionId: r.id,
    platform: path.platform, route: b.route, connectionId: b.connectionId, accountId: b.accountId,
    assetPath: r.asset_path, assetSha256: context.assetSha256, mediaType: r.media_type,
    caption: r.caption, scheduledAt: r.scheduled_at, authorizationId: a.id,
    state: 'queued', attempt: 0, providerOperationId: null, providerPostId: null,
  } }
}

/** Every claim must re-read current source, mapping, consent and token health. */
export function publishingDispatchDecision(intent: PublishingIntent, context: PublishingContext, now: string, maxLateMs = 15 * 60_000) {
  const prepared = preparePublishingIntent(context)
  if (!prepared.intent || prepared.intent.key !== intent.key
    || JSON.stringify([prepared.intent.assetSha256, prepared.intent.assetPath, prepared.intent.caption, prepared.intent.scheduledAt, prepared.intent.platform, prepared.intent.mediaType, prepared.intent.route, prepared.intent.connectionId, prepared.intent.authorizationId])
      !== JSON.stringify([intent.assetSha256, intent.assetPath, intent.caption, intent.scheduledAt, intent.platform, intent.mediaType, intent.route, intent.connectionId, intent.authorizationId])) return 'blocked_source_changed'
  if (!['queued', 'retry_wait'].includes(intent.state)) return 'do_not_submit'
  const time = instant(now), due = instant(intent.scheduledAt), expiry = instant(context.binding.tokenValidUntil)
  if (time === null || due === null || expiry === null || expiry <= time) return 'blocked_token_or_time'
  if (due < time - maxLateMs) return 'blocked_overdue_review'
  if (due > time) return 'wait_until_due'
  return 'submit'
}

export interface PublishingObservation { state: 'processing' | 'provider_scheduled' | 'posted' | 'failed' | 'unknown_outcome'; operationId?: string; postId?: string; errorCode?: string }
/** Provider IDs alone are not evidence that a post is live. Unknown states fail closed. */
export function normalizePublishingObservation(platform: PublishingPlatform, payload: Record<string, unknown>): PublishingObservation {
  const status = payload.status
  const postId = typeof payload.postId === 'string' && payload.postId.trim() ? payload.postId : undefined
  const operationId = typeof payload.operationId === 'string' && payload.operationId.trim() ? payload.operationId : undefined
  if (platform === 'tiktok') {
    const ids = payload.publicaly_available_post_id
    const id = Array.isArray(ids) && ids.find(v => typeof v === 'string' && v.trim())
    if (status === 'PUBLISH_COMPLETE' && id) return { state: 'posted', postId: id, operationId }
    if (status === 'FAILED') return { state: 'failed', operationId, errorCode: typeof payload.fail_reason === 'string' ? payload.fail_reason : 'PROVIDER_FAILED' }
    if (['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD', 'SENDING_TO_USER_INBOX'].includes(String(status))) return { state: 'processing', operationId }
  } else if (platform === 'instagram') {
    // FINISHED means container ready, not published. PUBLISHED still needs the media ID.
    if (status === 'PUBLISHED' && postId) return { state: 'posted', postId, operationId }
    if (['IN_PROGRESS', 'FINISHED'].includes(String(status))) return { state: 'processing', operationId }
    if (['ERROR', 'EXPIRED'].includes(String(status))) return { state: 'failed', operationId, errorCode: String(status) }
  } else if (platform === 'facebook') {
    if (payload.is_published === true && postId) return { state: 'posted', postId, operationId }
    if (payload.is_published === false && postId && typeof payload.scheduled_publish_time === 'number' && Number.isFinite(payload.scheduled_publish_time)) return { state: 'provider_scheduled', operationId, postId }
  } else if (platform === 'linkedin') {
    if (status === 'PUBLISHED' && postId) return { state: 'posted', postId, operationId }
    if (status === 'PROCESSING') return { state: 'processing', operationId }
    if (status === 'PUBLISH_FAILED') return { state: 'failed', operationId, errorCode: 'PUBLISH_FAILED' }
  } else if (platform === 'youtube') {
    if (payload.uploadStatus === 'processed' && payload.privacyStatus === 'public' && postId) return { state: 'posted', postId, operationId }
    if (['failed', 'rejected', 'deleted'].includes(String(payload.uploadStatus))) return { state: 'failed', operationId, errorCode: String(payload.uploadStatus) }
    if (payload.privacyStatus === 'private' && instant(typeof payload.publishAt === 'string' ? payload.publishAt : null) !== null && postId) return { state: 'provider_scheduled', operationId, postId }
    if (payload.uploadStatus === 'uploaded') return { state: 'processing', operationId }
  }
  return { state: 'unknown_outcome', operationId, postId }
}

/** Never turn an ambiguous mutation into an automatic fresh publish. */
export function publishingRetryDecision(input: { stage: 'before_submission' | 'submission' | 'status'; httpStatus?: number; explicitlyRejected?: boolean; attempt: number; retryAfterSeconds?: number }) {
  if (input.stage === 'submission' && !input.explicitlyRejected) return { action: 'reconcile', delaySeconds: null } as const
  if (input.httpStatus === 401 || input.httpStatus === 403) return { action: 'reauthorize', delaySeconds: null } as const
  if (input.attempt >= 3) return { action: 'stop', delaySeconds: null } as const
  if (input.httpStatus === 429 || (input.httpStatus !== undefined && input.httpStatus >= 500)) {
    const delay = Math.max(30 * 2 ** Math.max(0, input.attempt), input.retryAfterSeconds ?? 0)
    return Number.isFinite(delay) && delay <= 86400 ? { action: 'retry', delaySeconds: delay } as const : { action: 'stop', delaySeconds: null } as const
  }
  return { action: 'stop', delaySeconds: null } as const
}
