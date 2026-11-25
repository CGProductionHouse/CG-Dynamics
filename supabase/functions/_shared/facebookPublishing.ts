import { normalizePublishingObservation, type PublishingIntent, type PublishingObservation } from './socialPublishing.ts'

// Inject the existing server-side Meta token resolver/versioned Graph transport.
// Never supply this transport from a request body or expose its token to a job.
export interface FacebookPublishingTransport {
  request(method: 'GET' | 'POST', path: string, fields?: Record<string, string | boolean>): Promise<Record<string, unknown>>
  approvedMediaUrl(intent: Readonly<PublishingIntent>): Promise<string>
}

/** Called only AFTER the executor's durable beginAttempt barrier, at due time.
 * One mutation, then return the provider ID immediately for receipt persistence.
 * A separate read reconciles live publication; this response alone is not proof.
 */
export async function submitFacebookPhoto(intent: Readonly<PublishingIntent>, transport: FacebookPublishingTransport): Promise<PublishingObservation> {
  if (intent.route !== 'facebook_page' || intent.platform !== 'facebook'
    || !['image/jpeg', 'image/png'].includes(intent.mediaType) || !/^\d+$/.test(intent.accountId)) {
    throw new Error('Unsupported Facebook photo publishing contract.')
  }
  const url = new URL(await transport.approvedMediaUrl(intent))
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Provider media delivery requires HTTPS.')
  // The media resolver must serve the exact approved hash, with a bounded URL
  // lifetime and recipient-safe access. Never persist or log that signed URL.
  const receipt = await transport.request('POST', `/${intent.accountId}/photos`, {
    url: url.href, caption: intent.caption, published: true,
  })
  const postId = typeof receipt.post_id === 'string' && new RegExp(`^${intent.accountId}_\\d+$`).test(receipt.post_id) ? receipt.post_id : undefined
  const operationId = typeof receipt.id === 'string' && /^\d+$/.test(receipt.id) ? receipt.id : undefined
  return postId ? { state: 'processing', postId, operationId }
    : { state: 'unknown_outcome', operationId, errorCode: 'FACEBOOK_POST_RECEIPT_UNVERIFIED' }
}

/** Read an already-recorded post. A timeout must retry this read, never POST. */
export async function readFacebookPhotoStatus(intent: Readonly<PublishingIntent>, transport: FacebookPublishingTransport): Promise<PublishingObservation> {
  const postId = intent.providerPostId
  if (intent.route !== 'facebook_page' || intent.platform !== 'facebook'
    || !/^\d+$/.test(intent.accountId) || !postId || !new RegExp(`^${intent.accountId}_\\d+$`).test(postId)) {
    return { state: 'unknown_outcome', errorCode: 'EXACT_FACEBOOK_POST_REQUIRED' }
  }
  const record = await transport.request('GET', `/${postId}`, { fields: 'id,is_published,scheduled_publish_time' })
  if (record.id !== postId) return { state: 'unknown_outcome', errorCode: 'FACEBOOK_POST_ID_MISMATCH' }
  return normalizePublishingObservation('facebook', { ...record, postId, operationId: intent.providerOperationId })
}
