import { normalizePublishingObservation, type PublishingIntent, type PublishingObservation } from './socialPublishing.ts'
import { boundedPublishingRead } from './socialPublishingRead.ts'

// Conservative private receipt profile, not a claim about all provider-valid IDs.
export const TIKTOK_BUSINESS_ACCOUNT_ID = /^[\x21-\x7e]{1,256}$/
export const TIKTOK_BUSINESS_PUBLISH_ID = /^[\x21-\x7e]{1,512}$/
export const TIKTOK_PUBLIC_POST_ID = /^[1-9]\d{0,29}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CODES = ['TIKTOK_READ_TIMEOUT_INVALID', 'TIKTOK_READ_ABORTED', 'TIKTOK_READ_TIMEOUT', 'TIKTOK_EXACT_RECEIPT_REQUIRED',
  'TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED', 'TIKTOK_READ_CREDENTIAL_RECHECK_REQUIRED', 'TIKTOK_READ_ALREADY_USED',
  'TIKTOK_READ_ACCESS_UNVERIFIED', 'TIKTOK_READ_RATE_LIMITED', 'TIKTOK_READ_HTTP_UNVERIFIED', 'TIKTOK_READ_RESPONSE_UNVERIFIED'] as const
export class TikTokBusinessReadError extends Error {
  constructor(readonly code: typeof CODES[number]) { super(code); this.name = 'TikTokBusinessReadError' }
}
const DEADLINE_CODES = {
  timeout_invalid: 'TIKTOK_READ_TIMEOUT_INVALID', aborted: 'TIKTOK_READ_ABORTED', timeout: 'TIKTOK_READ_TIMEOUT',
} as const
export const tiktokReadDeadlineError = (reason: keyof typeof DEADLINE_CODES) => new TikTokBusinessReadError(DEADLINE_CODES[reason])
export interface TikTokBusinessReadBinding {
  clientId: string; connectionId: string; accountId: string; route: 'tiktok_accounts'; publishId: string
}
export interface TikTokBusinessStatusReadPort {
  binding: Readonly<TikTokBusinessReadBinding>
  readStatus(signal: AbortSignal): Promise<unknown>
}
export interface TikTokBusinessStatusResult {
  observation: PublishingObservation
  // Private evidence for later durable integration; never silently choose the
  // first of multiple public posts. Registration needs its audit projection.
  publicPostIds: readonly string[]
  readAfterSeconds: 180 | null
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function isTikTokBusinessReceipt(i: Readonly<PublishingIntent>): boolean {
  return i.platform === 'tiktok' && i.route === 'tiktok_accounts' && typeof i.clientId === 'string' && UUID.test(i.clientId)
    && typeof i.connectionId === 'string' && UUID.test(i.connectionId) && typeof i.accountId === 'string'
    && TIKTOK_BUSINESS_ACCOUNT_ID.test(i.accountId) && typeof i.providerOperationId === 'string' && TIKTOK_BUSINESS_PUBLISH_ID.test(i.providerOperationId)
    && (i.providerPostId === null || typeof i.providerPostId === 'string' && TIKTOK_PUBLIC_POST_ID.test(i.providerPostId))
}

/** PRIVATE Business API receipt read, UNREGISTERED. Never submits, refreshes,
 * queues, discovers posts or treats inbox delivery as public publication.
 * Existing consumer read-only status/analytics contracts stay separate.
 */
export async function readTikTokBusinessPublishingStatus(input: Readonly<PublishingIntent>, port: TikTokBusinessStatusReadPort,
  options: { readTimeoutMs?: number; signal?: AbortSignal } = {}): Promise<TikTokBusinessStatusResult> {
  const i = Object.freeze({ ...input }), binding = Object.freeze({ ...port.binding }), readStatus = port.readStatus.bind(port)
  const operationId = typeof i.providerOperationId === 'string' && TIKTOK_BUSINESS_PUBLISH_ID.test(i.providerOperationId) ? i.providerOperationId : undefined
  const postId = typeof i.providerPostId === 'string' && TIKTOK_PUBLIC_POST_ID.test(i.providerPostId) ? i.providerPostId : undefined
  const unknown = (errorCode: string, publicPostIds: readonly string[] = []): TikTokBusinessStatusResult => ({
    observation: { state: 'unknown_outcome', operationId, postId, errorCode }, publicPostIds: Object.freeze([...publicPostIds]), readAfterSeconds: null,
  })
  if (!isTikTokBusinessReceipt(i) || binding.clientId !== i.clientId || binding.connectionId !== i.connectionId
    || binding.accountId !== i.accountId || binding.route !== i.route || binding.publishId !== operationId) return unknown('TIKTOK_EXACT_RECEIPT_REQUIRED')
  try {
    const response = await boundedPublishingRead(signal => readStatus(signal), {
      milliseconds: options.readTimeoutMs, upstream: options.signal, error: tiktokReadDeadlineError,
    })
    if (!object(response) || response.code !== 0 || !object(response.data)) return unknown('TIKTOK_STATUS_ENVELOPE_UNVERIFIED')
    const data = response.data, rawIds = data.post_ids
    if (rawIds !== undefined && (!Array.isArray(rawIds) || rawIds.length > 32
      || rawIds.some(id => typeof id !== 'string' || !TIKTOK_PUBLIC_POST_ID.test(id))
      || new Set(rawIds).size !== rawIds.length)) return unknown('TIKTOK_PUBLIC_POST_IDS_UNVERIFIED')
    const ids: string[] = Array.isArray(rawIds) ? [...rawIds] : []
    if (data.status !== 'PUBLISH_COMPLETE' && ids.length) return unknown('TIKTOK_RECEIPT_CONFLICT')
    if (data.status === 'PUBLISH_COMPLETE' && ids.length > 1) return unknown('TIKTOK_MULTIPLE_PUBLIC_POSTS_REVIEW', ids)
    const observation = normalizePublishingObservation('tiktok', { status: data.status, post_ids: rawIds, operationId }, 'tiktok_accounts')
    if (postId && (observation.state !== 'posted' || observation.postId !== postId)) return unknown('TIKTOK_RECEIPT_CONFLICT', ids)
    return { observation, publicPostIds: Object.freeze(ids), readAfterSeconds: observation.state === 'processing' ? 180 : null }
  } catch (error) {
    return unknown(error instanceof TikTokBusinessReadError && (CODES as readonly string[]).includes(error.code) ? error.code : 'TIKTOK_STATUS_READ_UNAVAILABLE')
  }
}
