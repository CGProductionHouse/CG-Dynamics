// Issue #405: Amazon SES (à-la-carte) transport behind the provider-neutral delivery runtime.
// Pure and runtime-neutral (Deno Edge + Node tests). No AWS SDK dependency.
//
// Sending: SES v2 `SendEmail` (POST /v2/email/outbound-emails), SigV4-signed.
// - From is the approved CG sender; the visitor is Reply-To only (shared composer).
// - SES has NO idempotency key. A response that may or may not have produced a message is
//   `ambiguous` -> reconcile, and is never auto-replayed. Every message carries the job's
//   delivery_key as an SES message tag so a later SES event can prove it was sent.
// Events: SES event publishing -> SNS topic -> HTTPS. Every SNS message signature is
// verified against an AWS-hosted certificate before anything is trusted.

import { signRequest, type SigV4Credentials } from './awsSigV4.ts'
import { composeEnquiryEmail, type ClaimedDelivery, type DeliveryOutcome } from './websiteEnquiryDelivery.ts'

export const SES_DELIVERY_KEY_TAG = 'cg_delivery_key'
const REGION = /^[a-z]{2}(-[a-z]+)+-\d$/
const ACCESS_KEY_ID = /^(AKIA|ASIA)[A-Z0-9]{12,124}$/
const CONFIGURATION_SET = /^[A-Za-z0-9_-]{1,64}$/
const TOPIC_ARN = /^arn:aws(-[a-z]+)?:sns:[a-z]{2}(-[a-z]+)+-\d:\d{12}:[A-Za-z0-9_-]{1,256}$/

export interface SesConfig {
  provider: 'ses'
  from: string
  region: string
  credentials: SigV4Credentials
  configurationSet: string
}

/** Returns the SES config or the exact missing/invalid gate name. Never echoes values. */
export function resolveSesConfig(env: (name: string) => string | undefined): { ok: true; config: Omit<SesConfig, 'from'> } | { ok: false; reason: string } {
  const region = env('WEBSITE_ENQUIRY_SES_REGION')?.trim() ?? ''
  if (!REGION.test(region)) return { ok: false, reason: 'WEBSITE_ENQUIRY_SES_REGION is missing or invalid' }
  const accessKeyId = env('WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID')?.trim() ?? ''
  if (!ACCESS_KEY_ID.test(accessKeyId)) return { ok: false, reason: 'WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID is missing or invalid' }
  const secretAccessKey = env('WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY')?.trim() ?? ''
  if (secretAccessKey.length < 20) return { ok: false, reason: 'WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY is missing' }
  const configurationSet = env('WEBSITE_ENQUIRY_SES_CONFIGURATION_SET')?.trim() ?? ''
  if (!CONFIGURATION_SET.test(configurationSet)) {
    // Required: without a configuration set SES publishes no delivery/bounce/complaint events.
    return { ok: false, reason: 'WEBSITE_ENQUIRY_SES_CONFIGURATION_SET is missing or invalid' }
  }
  return { ok: true, config: { provider: 'ses', region, credentials: { accessKeyId, secretAccessKey }, configurationSet } }
}

export interface SesHttpRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string
}

export async function buildSesSendRequest(job: ClaimedDelivery, config: SesConfig, now?: Date): Promise<SesHttpRequest> {
  const email = composeEnquiryEmail(job, config.from)
  const body = JSON.stringify({
    FromEmailAddress: email.from,
    Destination: { ToAddresses: email.to },
    ...(email.reply_to ? { ReplyToAddresses: [email.reply_to] } : {}),
    Content: {
      Simple: {
        Subject: { Data: email.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: email.text, Charset: 'UTF-8' } },
        Headers: Object.entries(email.headers).map(([Name, Value]) => ({ Name, Value })),
      },
    },
    ConfigurationSetName: config.configurationSet,
    EmailTags: [{ Name: SES_DELIVERY_KEY_TAG, Value: job.delivery_key }],
  })
  const url = `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`
  const signed = await signRequest({
    method: 'POST', url, body, region: config.region, service: 'ses', now,
    headers: { 'content-type': 'application/json' },
  }, config.credentials)
  return { url, method: 'POST', headers: signed.headers, body }
}

// SES errors that prove the message was NOT sent but may succeed later (account / quota /
// credential / throttling): retry with backoff. Message-level rejections are permanent.
const SES_RETRYABLE = new Set([
  'TooManyRequestsException', 'LimitExceededException', 'SendingPausedException', 'AccountSuspendedException',
  'UnrecognizedClientException', 'InvalidSignatureException', 'SignatureDoesNotMatch', 'AccessDeniedException',
  'ExpiredTokenException', 'MailFromDomainNotVerifiedException', 'ThrottlingException',
])

export function classifySesResponse(input: { status?: number; body?: unknown; requestSent: boolean }): DeliveryOutcome {
  if (input.status === undefined) {
    return input.requestSent
      ? { outcome: 'ambiguous', errorCode: 'no_response_after_send' }
      : { outcome: 'retryable_failure', errorCode: 'request_not_sent' }
  }
  const body = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, unknown>
  if (input.status >= 200 && input.status < 300) {
    const id = typeof body.MessageId === 'string' ? body.MessageId.trim() : ''
    return id ? { outcome: 'accepted', providerMessageId: id } : { outcome: 'ambiguous', errorCode: 'accepted_without_id' }
  }
  const rawType = typeof body.__type === 'string' ? body.__type : typeof body.code === 'string' ? body.code : ''
  const type = rawType.split('#').pop()?.split(':')[0]?.slice(0, 60) ?? ''
  if (input.status >= 500) return { outcome: 'ambiguous', errorCode: `ses_${input.status}` }
  if (input.status === 429 || SES_RETRYABLE.has(type)) return { outcome: 'retryable_failure', errorCode: `ses_${type || input.status}` }
  return { outcome: 'permanent_failure', errorCode: `ses_${type || input.status}`.slice(0, 120) }
}

// ---------------------------------------------------------------------------------------
// SNS message verification
// ---------------------------------------------------------------------------------------

export interface SnsMessage {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation'
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  SignatureVersion: '1' | '2'
  Signature: string
  SigningCertURL: string
  Subject?: string
  Token?: string
  SubscribeURL?: string
}

/** SNS certificates are only ever served from sns.<region>.amazonaws.com over HTTPS. */
export function isTrustedSnsCertUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname)
      && url.pathname.endsWith('.pem') && !url.username && !url.password && (url.port === '' || url.port === '443')
  } catch {
    return false
  }
}

export function parseSnsMessage(value: unknown): SnsMessage | null {
  if (!value || typeof value !== 'object') return null
  const m = value as Record<string, unknown>
  const str = (key: string) => typeof m[key] === 'string' ? m[key] as string : null
  const type = str('Type')
  if (type !== 'Notification' && type !== 'SubscriptionConfirmation' && type !== 'UnsubscribeConfirmation') return null
  const version = str('SignatureVersion')
  if (version !== '1' && version !== '2') return null
  for (const key of ['MessageId', 'TopicArn', 'Message', 'Timestamp', 'Signature', 'SigningCertURL']) if (!str(key)) return null
  if (type !== 'Notification' && (!str('Token') || !str('SubscribeURL'))) return null
  return m as unknown as SnsMessage
}

/** Canonical string SNS signs (field order fixed by AWS; Subject only when present). */
export function snsStringToSign(message: SnsMessage): string {
  const fields = message.Type === 'Notification'
    ? ['Message', 'MessageId', ...(message.Subject !== undefined ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return fields.map((field) => `${field}\n${(message as unknown as Record<string, string>)[field]}\n`).join('')
}

// Minimal DER walker: Certificate -> tbsCertificate -> subjectPublicKeyInfo (7th element when
// the [0] version tag is present). Enough for RSA certificates served by SNS.
function readTlv(bytes: Uint8Array, offset: number): { tag: number; start: number; end: number; next: number } {
  const tag = bytes[offset]
  let length = bytes[offset + 1]
  let start = offset + 2
  if (length & 0x80) {
    const count = length & 0x7f
    if (count < 1 || count > 4) throw new Error('unsupported DER length')
    length = 0
    for (let index = 0; index < count; index++) length = (length << 8) | bytes[start + index]
    start += count
  }
  const end = start + length
  if (end > bytes.length) throw new Error('truncated DER')
  return { tag, start, end, next: end }
}

export function spkiFromCertificatePem(pem: string): Uint8Array {
  const match = pem.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/)
  if (!match) throw new Error('not a PEM certificate')
  const der = Uint8Array.from(atob(match[1].replace(/\s+/g, '')), (char) => char.charCodeAt(0))
  const certificate = readTlv(der, 0)
  const tbs = readTlv(der, certificate.start)
  let cursor = tbs.start
  let element = readTlv(der, cursor)
  if (element.tag === 0xa0) { cursor = element.next; element = readTlv(der, cursor) } // explicit version
  // serialNumber, signature, issuer, validity, subject, subjectPublicKeyInfo
  for (let skip = 0; skip < 5; skip++) { cursor = element.next; element = readTlv(der, cursor) }
  if (element.tag !== 0x30) throw new Error('subjectPublicKeyInfo not found')
  return der.slice(cursor, element.end)
}

export async function verifySnsSignature(message: SnsMessage, certificatePem: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki', spkiFromCertificatePem(certificatePem) as Uint8Array<ArrayBuffer>,
      { name: 'RSASSA-PKCS1-v1_5', hash: message.SignatureVersion === '2' ? 'SHA-256' : 'SHA-1' }, false, ['verify'],
    )
    const signature = Uint8Array.from(atob(message.Signature), (char) => char.charCodeAt(0))
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(snsStringToSign(message)))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------------------
// SES event mapping
// ---------------------------------------------------------------------------------------

export type SesDeliveryEvent = {
  providerMessageId: string
  deliveryKey: string | null
  event: 'delivered' | 'bounced' | 'complained' | 'sent'
  occurredAt: string
}

/**
 * Maps an SES event (the SNS `Message` JSON). `sent` is provider proof that SES accepted the
 * message (used only to resolve ambiguous jobs). Transient bounces and delivery delays are
 * not final and are ignored; Reject means SES refused to send and is treated as bounced.
 */
export function parseSesEvent(messageJson: string): SesDeliveryEvent | null {
  let raw: unknown
  try { raw = JSON.parse(messageJson) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const type = (record.eventType ?? record.notificationType) as string | undefined
  const mail = (record.mail && typeof record.mail === 'object' ? record.mail : {}) as Record<string, unknown>
  const messageId = typeof mail.messageId === 'string' ? mail.messageId.trim() : ''
  if (!messageId) return null
  const tags = (mail.tags && typeof mail.tags === 'object' ? mail.tags : {}) as Record<string, unknown>
  const tagValue = Array.isArray(tags[SES_DELIVERY_KEY_TAG]) ? (tags[SES_DELIVERY_KEY_TAG] as unknown[])[0] : null
  const deliveryKey = typeof tagValue === 'string' && /^[0-9a-f-]{36}$/i.test(tagValue) ? tagValue : null
  const section = (name: string) => (record[name] && typeof record[name] === 'object' ? record[name] : {}) as Record<string, unknown>
  const at = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null

  let event: SesDeliveryEvent['event']
  let occurredAt: string | null
  switch (type) {
    case 'Send':
      event = 'sent'; occurredAt = at(mail.timestamp); break
    case 'Delivery':
      event = 'delivered'; occurredAt = at(section('delivery').timestamp); break
    case 'Bounce':
      if (section('bounce').bounceType !== 'Permanent') return null
      event = 'bounced'; occurredAt = at(section('bounce').timestamp); break
    case 'Reject':
      event = 'bounced'; occurredAt = at(mail.timestamp); break
    case 'Complaint':
      event = 'complained'; occurredAt = at(section('complaint').timestamp); break
    default:
      return null
  }
  if (!occurredAt) return null
  return { providerMessageId: messageId, deliveryKey, event, occurredAt }
}

export const isValidSnsTopicArn = (value: string) => TOPIC_ARN.test(value)

/** SNS subscription URLs must point back at AWS SNS itself over HTTPS. */
export function isTrustedSnsSubscribeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname)
      && url.searchParams.get('Action') === 'ConfirmSubscription' && !url.username && !url.password
  } catch {
    return false
  }
}
