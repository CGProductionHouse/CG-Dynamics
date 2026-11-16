import { normalizePublishingObservation, type PublishingIntent, type PublishingObservation } from './socialPublishing.ts'
import { boundedPublishingRead } from './socialPublishingRead.ts'

export const LINKEDIN_ORGANIZATION_URN = /^urn:li:organization:\d{1,128}$/
export const LINKEDIN_POST_URN = /^urn:li:(?:share|ugcPost):\d{1,128}$/
export const LINKEDIN_IMAGE_URN = /^urn:li:image:[A-Za-z0-9_-]{1,200}$/
export type LinkedInReadBinding = Pick<PublishingIntent, 'clientId' | 'connectionId' | 'accountId'> & { route: 'linkedin_organization' }
export interface LinkedInPhotoReadPort {
  // Private adapter metadata, NOT a request-body access grant. The eventual
  // credential resolver must verify current app/role/mapping/read permissions.
  binding: Readonly<LinkedInReadBinding>
  readPost(postUrn: string, view: 'AUTHOR' | 'READER', signal: AbortSignal): Promise<unknown>
  readImage(imageUrn: string, signal: AbortSignal): Promise<unknown>
}
export class LinkedInReadError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'LinkedInReadError' }
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const optionalEmpty = (v: unknown) => v === undefined || (Array.isArray(v) && v.length === 0)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Bounded GET/credential work only. No automatic retries or mutation methods. */
export async function boundedLinkedInRead<T>(run: (signal: AbortSignal) => Promise<T>, milliseconds = 15_000, upstream?: AbortSignal): Promise<T> {
  const codes = { timeout_invalid: 'LINKEDIN_READ_TIMEOUT_INVALID', aborted: 'LINKEDIN_READ_ABORTED', timeout: 'LINKEDIN_READ_TIMEOUT' }
  return await boundedPublishingRead(run, { milliseconds, upstream, error: reason => new LinkedInReadError(codes[reason]) })
}

/** Single PHOTO receipt verifier, UNREGISTERED. AUTHOR state alone cannot prove
 * a public post: require the READER version, exact original commentary/media,
 * public main-feed distribution, publication time and current image owner.
 * No post search, ID inference, upload, publication or permission fallback.
 */
export async function readLinkedInPhotoStatus(input: Readonly<PublishingIntent>, port: LinkedInPhotoReadPort,
  options: { now?: () => number; readTimeoutMs?: number } = {}): Promise<PublishingObservation> {
  const i = Object.freeze({ ...input }), binding = Object.freeze({ ...port.binding })
  const readPost = port.readPost.bind(port), readImage = port.readImage.bind(port)
  const operationId = typeof i.providerOperationId === 'string' && LINKEDIN_IMAGE_URN.test(i.providerOperationId) ? i.providerOperationId : undefined
  const postId = typeof i.providerPostId === 'string' && LINKEDIN_POST_URN.test(i.providerPostId) ? i.providerPostId : undefined
  const unknown = (errorCode: string): PublishingObservation => ({ state: 'unknown_outcome', operationId, postId, errorCode })
  if (i.platform !== 'linkedin' || i.route !== 'linkedin_organization' || !LINKEDIN_ORGANIZATION_URN.test(i.accountId)
    || !UUID.test(i.clientId) || !UUID.test(i.connectionId)
    || !['image/jpeg', 'image/png'].includes(i.mediaType) || typeof i.caption !== 'string' || !i.caption.trim()
    || !postId || !operationId || binding.clientId !== i.clientId || binding.connectionId !== i.connectionId
    || binding.accountId !== i.accountId || binding.route !== i.route) return unknown('LINKEDIN_EXACT_RECEIPT_REQUIRED')
  const postMatches = (v: unknown): v is Record<string, unknown> => object(v) && !v.error && v.id === postId && v.author === i.accountId
    && v.commentary === i.caption && object(v.content) && Object.keys(v.content).join(',') === 'media'
    && object(v.content.media) && v.content.media.id === operationId
  const read = <T>(run: (signal: AbortSignal) => Promise<T>) => boundedLinkedInRead(run, options.readTimeoutMs)
  try {
    const author = await read(signal => readPost(postId, 'AUTHOR', signal))
    if (!object(author) || author.error || author.id !== postId || author.author !== i.accountId) return unknown('LINKEDIN_AUTHOR_RECEIPT_UNVERIFIED')
    let reader: unknown = null
    try { reader = await read(signal => readPost(postId, 'READER', signal)) }
    catch (error) {
      // Pending publication may have no public reader yet. Auth/rate/network
      // failures are NOT absence and must not fall back to author-only success.
      if (!(error instanceof LinkedInReadError) || error.code !== 'LINKEDIN_PUBLIC_READER_UNAVAILABLE') throw error
    }
    if (reader !== null && (!object(reader) || reader.error || reader.id !== postId || reader.author !== i.accountId)) return unknown('LINKEDIN_PUBLIC_READER_UNVERIFIED')
    const now = (options.now ?? Date.now)()
    if (!postMatches(reader) || reader.lifecycleState !== 'PUBLISHED' || reader.visibility !== 'PUBLIC'
      || !Number.isFinite(now) || !Number.isSafeInteger(reader.publishedAt) || (reader.publishedAt as number) <= 0 || (reader.publishedAt as number) > now + 30_000
      || reader.adContext != null || reader.reshareContext != null || reader.container != null
      || !object(reader.distribution) || reader.distribution.feedDistribution !== 'MAIN_FEED'
      || !optionalEmpty(reader.distribution.targetEntities) || !optionalEmpty(reader.distribution.thirdPartyDistributionChannels)) {
      // A new unpublished edit must not hide an already-public exact original.
      // Conversely an old public version cannot prove a newer job was posted.
      if (postMatches(author) && ['PUBLISH_REQUESTED', 'PROCESSING', 'PUBLISH_FAILED'].includes(String(author.lifecycleState))) {
        return { ...normalizePublishingObservation('linkedin', { lifecycleState: author.lifecycleState, postId, operationId }), operationId, postId }
      }
      return unknown('LINKEDIN_PUBLIC_READER_UNVERIFIED')
    }
    const image = await read(signal => readImage(operationId, signal))
    if (!object(image) || image.error || image.id !== operationId || image.owner !== i.accountId || image.status !== 'AVAILABLE') return unknown('LINKEDIN_IMAGE_OWNER_UNVERIFIED')
    return { ...normalizePublishingObservation('linkedin', { lifecycleState: reader.lifecycleState, postId, operationId }), operationId, postId }
  } catch (error) {
    return unknown(error instanceof LinkedInReadError ? error.code : 'LINKEDIN_STATUS_READ_UNVERIFIED')
  }
}
