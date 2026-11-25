import type { InstagramPublicationProtocol, PublishingIntent, PublishingObservation } from './socialPublishing.ts'
import { requireInstagramPublishingCaption } from './instagramPublishingCaption.ts'

export interface InstagramPublishingTransport {
  // PRIVATE adapter must enforce actual JPEG qualification, original approved
  // hash and exact current account/login token before returning a bounded URL.
  approvedMediaUrl(intent: Readonly<PublishingIntent>): Promise<string>
  request(method: 'GET' | 'POST', path: string, fields?: Record<string, string>): Promise<Record<string, unknown>>
}
const id = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v)
function contract(i: Readonly<PublishingIntent>) {
  if (i.platform !== 'instagram' || !['instagram_login', 'instagram_facebook_login'].includes(i.route) || !id(i.accountId)
    || i.mediaType !== 'image/jpeg' || !i.caption.trim()) throw new Error('Instagram photo publishing contract required.')
}
const unknown = (i: Readonly<PublishingIntent>, errorCode: string): PublishingObservation => ({ state: 'unknown_outcome', operationId: i.providerOperationId ?? undefined,
  postId: i.providerPostId ?? undefined, errorCode })

async function quota(i: Readonly<PublishingIntent>, t: InstagramPublishingTransport) {
  const result = await t.request('GET', `/${i.accountId}/content_publishing_limit`, { fields: 'quota_usage,config' })
  const rows = result.data
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') throw new Error('Instagram quota unavailable.')
  const usage = rows[0].quota_usage, config = rows[0].config
  if (!Number.isSafeInteger(usage) || usage < 0 || !Number.isSafeInteger(config?.quota_total) || config.quota_total <= usage
    || !Number.isSafeInteger(config?.quota_duration) || config.quota_duration <= 0) throw new Error('Instagram quota unavailable.')
  // Current account response is authoritative; official guide/reference quota
  // examples differ. Do not hard-code 50/100 or a guessed default allowance.
}

/** ONE mutation, container ID receipt first. No polling or publication here. */
export async function createInstagramPhotoContainer(i: Readonly<PublishingIntent>, t: InstagramPublishingTransport): Promise<PublishingObservation> {
  contract(i)
  requireInstagramPublishingCaption(i.caption)
  if (!['queued', 'retry_wait'].includes(i.state) || i.providerOperationId || i.providerPostId) throw new Error('New Instagram container authority required.')
  await quota(i, t)
  const raw = await t.approvedMediaUrl(i), url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Approved HTTPS Instagram media required.')
  const result = await t.request('POST', `/${i.accountId}/media`, { image_url: raw, caption: i.caption })
  return id(result.id) && !result.error ? { state: 'processing', operationId: result.id, instagramPhase: 'container_processing' }
    : { state: 'unknown_outcome', errorCode: 'INSTAGRAM_CONTAINER_RECEIPT_UNVERIFIED' }
}

/** Must be called ONLY after begin_instagram_publication_publish persisted its
 * second, one-way barrier. It never recreates a container or retries a POST.
 */
export async function publishInstagramPhotoContainer(i: Readonly<PublishingIntent>, t: InstagramPublishingTransport): Promise<PublishingObservation> {
  contract(i)
  requireInstagramPublishingCaption(i.caption)
  if (!id(i.providerOperationId) || i.providerPostId) throw new Error('Recorded Instagram container required.')
  const status = await t.request('GET', `/${i.providerOperationId}`, { fields: 'id,status_code' })
  if (status.id !== i.providerOperationId || status.status_code !== 'FINISHED' || status.error) return unknown(i, 'INSTAGRAM_CONTAINER_NOT_READY')
  await quota(i, t)
  const result = await t.request('POST', `/${i.accountId}/media_publish`, { creation_id: i.providerOperationId })
  return id(result.id) && result.id !== i.providerOperationId && !result.error
    ? { state: 'processing', operationId: i.providerOperationId, postId: result.id, instagramPhase: 'verifying' }
    : unknown(i, 'INSTAGRAM_PUBLICATION_RECEIPT_UNVERIFIED')
}

/** GET-only. FINISHED is readiness, never publication. PUBLISHED without the
 * distinct media ID is ambiguous and never triggers another media_publish.
 */
export async function readInstagramPhotoStatus(i: Readonly<PublishingIntent>, t: InstagramPublishingTransport, protocol: InstagramPublicationProtocol): Promise<PublishingObservation> {
  contract(i)
  if (!id(i.providerOperationId)) return unknown(i, 'INSTAGRAM_CONTAINER_RECEIPT_REQUIRED')
  const result = await t.request('GET', `/${i.providerOperationId}`, { fields: 'id,status_code' })
  if (result.error || result.id !== i.providerOperationId) return unknown(i, 'INSTAGRAM_CONTAINER_STATUS_UNVERIFIED')
  if (['ERROR', 'EXPIRED'].includes(String(result.status_code))) return { state: 'failed', operationId: i.providerOperationId,
    errorCode: result.status_code === 'EXPIRED' ? 'INSTAGRAM_CONTAINER_EXPIRED' : 'INSTAGRAM_CONTAINER_FAILED' }
  if (result.status_code === 'FINISHED' && !protocol.publishAttempted) return { state: 'processing', operationId: i.providerOperationId, instagramPhase: 'container_ready' }
  if (result.status_code === 'IN_PROGRESS') return { state: 'processing', operationId: i.providerOperationId,
    instagramPhase: protocol.publishAttempted ? 'publishing' : 'container_processing' }
  if (result.status_code !== 'PUBLISHED' || !protocol.publishAttempted || !id(i.providerPostId) || i.providerPostId === i.providerOperationId) return unknown(i, 'INSTAGRAM_PUBLICATION_UNVERIFIED')
  const media = await t.request('GET', `/${i.providerPostId}`, { fields: 'id,owner,media_type' })
  const owner = media.owner as { id?: unknown } | undefined
  return !media.error && media.id === i.providerPostId && owner?.id === i.accountId && media.media_type === 'IMAGE'
    ? { state: 'posted', operationId: i.providerOperationId, postId: i.providerPostId, instagramPhase: 'verifying' }
    : unknown(i, 'INSTAGRAM_MEDIA_OWNER_UNVERIFIED')
}
