// Issue #405: website enquiry notification runtime — provider-neutral, pure rules.
// No Deno globals here so the rules are unit-testable under Node.
//
// Contract:
// - From is always the approved CG sender from server config; the visitor's address is
//   only ever Reply-To. Browser input never chooses sender or recipient.
// - Every attempt reuses the job's delivery_key as the provider idempotency key.
// - Transactional only: no unsubscribe/list/marketing headers, no tracking pixels.
// - A response that may or may not have produced a message is `ambiguous` and goes to
//   reconcile; it is never retried blindly.

export type DeliveryOutcome =
  | { outcome: 'accepted'; providerMessageId: string }
  | { outcome: 'retryable_failure'; errorCode: string }
  | { outcome: 'permanent_failure'; errorCode: string }
  | { outcome: 'ambiguous'; errorCode: string }

export interface ClaimedDelivery {
  job_id: string
  lease_token: string
  delivery_key: string
  attempt_count: number
  recipient_email: string
  recipient_name: string | null
  enquiry_receipt_id: string
  enquiry_accepted_at: string
  client_name: string
  website_editor_website_id: string
  contact: { name?: string; email?: string; phone?: string } | null
  fields: { label: string; value: unknown }[] | null
  landing_path: string | null
}

export type DeliveryConfig =
  | { state: 'disabled'; reason: string }
  | { state: 'ready'; provider: 'resend'; from: string; apiKey: string }

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const SENDER = /^(?:[^<>"\r\n]{1,80} )?<?([^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+)>?$/

/**
 * Activation is explicit and fail-closed. Missing or partial configuration returns
 * `disabled` with the exact gate; pending jobs then simply wait in the outbox.
 */
export function resolveDeliveryConfig(env: (name: string) => string | undefined): DeliveryConfig {
  if (env('WEBSITE_ENQUIRY_EMAIL_ENABLED') !== 'true') {
    return { state: 'disabled', reason: 'WEBSITE_ENQUIRY_EMAIL_ENABLED is not true' }
  }
  const provider = env('WEBSITE_ENQUIRY_EMAIL_PROVIDER')
  if (provider !== 'resend') {
    return { state: 'disabled', reason: 'WEBSITE_ENQUIRY_EMAIL_PROVIDER is not an approved provider' }
  }
  const from = env('WEBSITE_ENQUIRY_EMAIL_FROM')?.trim() ?? ''
  if (!SENDER.test(from)) return { state: 'disabled', reason: 'WEBSITE_ENQUIRY_EMAIL_FROM is missing or invalid' }
  const apiKey = env('WEBSITE_ENQUIRY_RESEND_API_KEY')?.trim() ?? ''
  if (!apiKey) return { state: 'disabled', reason: 'WEBSITE_ENQUIRY_RESEND_API_KEY is missing' }
  return { state: 'ready', provider: 'resend', from, apiKey }
}

const singleLine = (value: string, max: number) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max)

function display(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  return ''
}

export interface ComposedEmail {
  from: string
  to: string[]
  reply_to?: string
  subject: string
  text: string
  headers: Record<string, string>
}

export function composeEnquiryEmail(job: ClaimedDelivery, from: string): ComposedEmail {
  if (!EMAIL.test(job.recipient_email)) throw new Error('Recipient snapshot is invalid')
  const visitorEmail = job.contact?.email?.trim()
  const replyTo = visitorEmail && EMAIL.test(visitorEmail) && !/[\r\n]/.test(visitorEmail) ? visitorEmail : undefined
  const who = singleLine(job.contact?.name ?? job.contact?.email ?? 'a website visitor', 80)
  const lines = [
    `New enquiry from your website (${singleLine(job.client_name, 120)}).`,
    '',
    ...(job.fields ?? []).flatMap((field) => {
      const value = display(field.value)
      return value ? [`${singleLine(String(field.label), 80)}:`, value, ''] : []
    }),
    job.landing_path ? `Submitted from page: ${singleLine(job.landing_path, 200)}` : null,
    `Received: ${job.enquiry_accepted_at}`,
    `Reference: ${job.enquiry_receipt_id}`,
    '',
    replyTo ? 'Reply to this email to respond directly to the enquirer.' : 'The enquirer did not supply an email address; use the contact details above.',
    'This lead is also in your CG Dynamics Lead Inbox.',
  ].filter((line): line is string => line !== null)
  return {
    from,
    to: [job.recipient_email],
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: singleLine(`New website enquiry from ${who}`, 150),
    text: lines.join('\n'),
    headers: { 'X-Entity-Ref-ID': job.delivery_key },
  }
}

/**
 * Classifies a Resend send attempt. `requestSent` is false only when the request
 * provably never left (e.g. DNS failure before connect); otherwise a missing
 * response is ambiguous.
 */
export function classifyResendResponse(input: {
  status?: number
  body?: unknown
  requestSent: boolean
}): DeliveryOutcome {
  if (input.status === undefined) {
    return input.requestSent
      ? { outcome: 'ambiguous', errorCode: 'no_response_after_send' }
      : { outcome: 'retryable_failure', errorCode: 'request_not_sent' }
  }
  const body = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.slice(0, 80) : ''
  if (input.status >= 200 && input.status < 300) {
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    return id ? { outcome: 'accepted', providerMessageId: id } : { outcome: 'ambiguous', errorCode: 'accepted_without_id' }
  }
  if (input.status === 409) {
    // Same key still in flight is retryable; same key with a different payload means the
    // provider already holds something for this delivery — reconcile, never resend.
    return name === 'concurrent_idempotent_requests'
      ? { outcome: 'retryable_failure', errorCode: 'http_409_concurrent' }
      : { outcome: 'ambiguous', errorCode: `http_409_${name || 'idempotency'}` }
  }
  if (input.status === 429) return { outcome: 'retryable_failure', errorCode: 'http_429' }
  if (input.status >= 500) return { outcome: 'ambiguous', errorCode: `http_${input.status}` }
  return { outcome: 'permanent_failure', errorCode: `http_${input.status}${name ? `_${name}` : ''}`.slice(0, 120) }
}

export type ProviderDeliveryEvent = { providerMessageId: string; event: 'delivered' | 'bounced'; occurredAt: string }

/** Maps a verified Resend webhook payload; unrelated event types are ignored (null). */
export function parseResendWebhookEvent(payload: unknown): ProviderDeliveryEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {}
  const event = record.type === 'email.delivered' ? 'delivered' : record.type === 'email.bounced' ? 'bounced' : null
  const id = typeof data.email_id === 'string' ? data.email_id.trim() : ''
  const occurredAt = typeof record.created_at === 'string' && !Number.isNaN(Date.parse(record.created_at)) ? record.created_at : null
  if (!event || !id || !occurredAt) return null
  return { providerMessageId: id, event, occurredAt }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

/**
 * Verifies a Svix-signed webhook (Resend). Secret format `whsec_<base64>`; signed
 * content `${id}.${timestamp}.${body}`; header carries space-separated `v1,<sig>`.
 * Rejects timestamps outside ±5 minutes to block replays.
 */
export async function verifySvixSignature(input: {
  secret: string
  id: string | null
  timestamp: string | null
  signatureHeader: string | null
  body: string
  nowSeconds: number
}): Promise<boolean> {
  const { secret, id, timestamp, signatureHeader, body, nowSeconds } = input
  if (!secret.startsWith('whsec_') || !id || !timestamp || !signatureHeader) return false
  const sent = Number(timestamp)
  if (!Number.isInteger(sent) || Math.abs(nowSeconds - sent) > 300) return false
  let keyBytes: Uint8Array<ArrayBuffer>
  try { keyBytes = base64ToBytes(secret.slice('whsec_'.length)) } catch { return false }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)))
  const expected = bytesToBase64(mac)
  return signatureHeader.split(' ').some((part) => {
    const [version, signature] = part.split(',')
    return version === 'v1' && typeof signature === 'string' && constantTimeEqual(signature, expected)
  })
}
