// Issue #405: SES event ingest (SNS HTTPS subscription) — pure handler, injected deps.
//
// - Only SNS messages for the configured topic, signed by an AWS-hosted certificate, are
//   trusted. Anything else: 401/403, nothing stored.
// - SubscriptionConfirmation is confirmed only for the configured topic.
// - Delivery / permanent Bounce / Reject / Complaint are stored durably in the canonical
//   provider-event inbox (keyed by SNS MessageId) before 2xx; storage failure -> 5xx so SNS
//   retries. Events arriving before acceptance wait in the inbox (existing contract).
// - The `cg_delivery_key` SES tag is provider proof that a message exists: an ambiguous
//   (reconcile) job with that key is resolved `found` with the SES MessageId — never resent.
// - Logs carry outcome categories only.

import {
  isTrustedSnsCertUrl,
  isTrustedSnsSubscribeUrl,
  parseSesEvent,
  parseSnsMessage,
  verifySnsSignature,
} from './websiteEnquirySes.ts'

export const MAX_SNS_BODY_BYTES = 64 * 1024

export interface SesEventDeps {
  topicArn: string
  fetchCertificate: (url: string) => Promise<string>
  confirmSubscription: (url: string) => Promise<boolean>
  findReconcileJob: (deliveryKey: string) => Promise<string | null>
  resolveFound: (jobId: string, providerMessageId: string) => Promise<boolean>
  applyEvent: (args: { eventId: string; messageId: string; event: 'delivered' | 'bounced' | 'complained'; occurredAt: string }) => Promise<{ stored: boolean }>
  log?: (entry: { event: 'website_enquiry_ses_event'; outcome: string; status: number }) => void
}

const respond = (deps: SesEventDeps, status: number, outcome: string, body: Record<string, unknown> = {}) => {
  deps.log?.({ event: 'website_enquiry_ses_event', outcome, status })
  return new Response(JSON.stringify({ ok: status < 300, outcome, ...body }), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function handleSesSnsRequest(req: Request, deps: SesEventDeps): Promise<Response> {
  if (req.method !== 'POST') return respond(deps, 405, 'method_not_allowed')
  if (!deps.topicArn) return respond(deps, 503, 'not_configured')
  const text = await req.text()
  if (text.length > MAX_SNS_BODY_BYTES) return respond(deps, 413, 'too_large')

  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return respond(deps, 400, 'invalid_json') }
  const message = parseSnsMessage(parsed)
  if (!message) return respond(deps, 400, 'invalid_sns_message')
  if (message.TopicArn !== deps.topicArn) return respond(deps, 403, 'unexpected_topic')
  if (!isTrustedSnsCertUrl(message.SigningCertURL)) return respond(deps, 403, 'untrusted_certificate_url')

  let certificate: string
  try { certificate = await deps.fetchCertificate(message.SigningCertURL) } catch { return respond(deps, 503, 'certificate_unavailable') }
  if (!(await verifySnsSignature(message, certificate))) return respond(deps, 401, 'invalid_signature')

  if (message.Type === 'UnsubscribeConfirmation') return respond(deps, 200, 'unsubscribe_ignored')
  if (message.Type === 'SubscriptionConfirmation') {
    if (!message.SubscribeURL || !isTrustedSnsSubscribeUrl(message.SubscribeURL)) return respond(deps, 403, 'untrusted_subscribe_url')
    return (await deps.confirmSubscription(message.SubscribeURL))
      ? respond(deps, 200, 'subscription_confirmed')
      : respond(deps, 502, 'subscription_confirm_failed')
  }

  const event = parseSesEvent(message.Message)
  if (!event) return respond(deps, 200, 'ignored_event')

  try {
    let resolved = false
    if (event.deliveryKey) {
      const jobId = await deps.findReconcileJob(event.deliveryKey)
      if (jobId) resolved = await deps.resolveFound(jobId, event.providerMessageId)
    }
    if (event.event === 'sent') return respond(deps, 200, resolved ? 'reconcile_resolved' : 'send_noted', { resolved })
    const stored = await deps.applyEvent({
      eventId: message.MessageId, messageId: event.providerMessageId, event: event.event, occurredAt: event.occurredAt,
    })
    if (!stored.stored) return respond(deps, 500, 'not_stored')
    return respond(deps, 200, `stored_${event.event}`, { resolved })
  } catch {
    // SNS retries on 5xx; the inbox is idempotent on (provider, SNS MessageId).
    return respond(deps, 500, 'storage_failed')
  }
}
