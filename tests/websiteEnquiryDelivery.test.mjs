import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  classifyResendResponse,
  composeEnquiryEmail,
  parseResendWebhookEvent,
  resolveDeliveryConfig,
  verifySvixSignature,
} from '../supabase/functions/_shared/websiteEnquiryDelivery.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261002110000_website_enquiry_delivery_runtime.sql')
const worker = read('../supabase/functions/website-enquiry-delivery-worker/index.ts')
const webhook = read('../supabase/functions/website-enquiry-delivery-webhook/index.ts')
const acceptance = read('./sql/405_website_enquiry_delivery_acceptance.sql')
const config = read('../supabase/config.toml')

const job = {
  job_id: 'j', lease_token: 'l', delivery_key: '11111111-1111-4111-8111-111111111111', attempt_count: 1,
  recipient_email: 'sales@example.test', recipient_name: 'Sales', enquiry_receipt_id: 'r-1',
  enquiry_accepted_at: '2026-10-02T08:00:00Z', client_name: 'Example Client', website_editor_website_id: 'w',
  contact: { name: 'Visitor\r\nBcc: evil@example.test', email: 'visitor@example.test' },
  fields: [{ label: 'Message', value: 'Please call' }, { label: 'Empty', value: null }], landing_path: '/contact',
}

test('activation is fail-closed and names the exact missing gate', () => {
  const env = values => name => values[name]
  assert.deepEqual(resolveDeliveryConfig(env({})), { state: 'disabled', reason: 'WEBSITE_ENQUIRY_EMAIL_ENABLED is not true' })
  assert.match(resolveDeliveryConfig(env({ WEBSITE_ENQUIRY_EMAIL_ENABLED: 'true', WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'smtp' })).reason, /approved provider/)
  assert.match(resolveDeliveryConfig(env({ WEBSITE_ENQUIRY_EMAIL_ENABLED: 'true', WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'resend' })).reason, /FROM/)
  assert.match(resolveDeliveryConfig(env({ WEBSITE_ENQUIRY_EMAIL_ENABLED: 'true', WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'resend', WEBSITE_ENQUIRY_EMAIL_FROM: 'CG <leads@cg.example>' })).reason, /API_KEY/)
  assert.equal(resolveDeliveryConfig(env({ WEBSITE_ENQUIRY_EMAIL_ENABLED: 'true', WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'resend', WEBSITE_ENQUIRY_EMAIL_FROM: 'CG <leads@cg.example>', WEBSITE_ENQUIRY_RESEND_API_KEY: 'k' })).state, 'ready')
})

test('From is the approved sender, visitor is Reply-To only, headers cannot be injected', () => {
  const email = composeEnquiryEmail(job, 'CG Leads <leads@cg.example>')
  assert.equal(email.from, 'CG Leads <leads@cg.example>')
  assert.deepEqual(email.to, ['sales@example.test'])
  assert.equal(email.reply_to, 'visitor@example.test')
  assert.doesNotMatch(email.subject, /[\r\n]/)
  assert.match(email.text, /Message:\nPlease call/)
  assert.doesNotMatch(email.text, /Empty:/)
  assert.doesNotMatch(JSON.stringify(email), /List-Unsubscribe|utm_|<img/i)
  assert.equal(composeEnquiryEmail({ ...job, contact: { phone: '0820000001' } }, 'leads@cg.example').reply_to, undefined)
  assert.throws(() => composeEnquiryEmail({ ...job, recipient_email: 'bad' }, 'leads@cg.example'))
})

test('provider outcomes keep accepted distinct and route ambiguity to reconcile', () => {
  assert.deepEqual(classifyResendResponse({ status: 200, body: { id: 'msg-1' }, requestSent: true }), { outcome: 'accepted', providerMessageId: 'msg-1' })
  assert.equal(classifyResendResponse({ status: 200, body: {}, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifyResendResponse({ requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifyResendResponse({ requestSent: false }).outcome, 'retryable_failure')
  assert.equal(classifyResendResponse({ status: 503, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifyResendResponse({ status: 429, requestSent: true }).outcome, 'retryable_failure')
  assert.equal(classifyResendResponse({ status: 409, body: { name: 'concurrent_idempotent_requests' }, requestSent: true }).outcome, 'retryable_failure')
  assert.equal(classifyResendResponse({ status: 409, body: { name: 'invalid_idempotent_request' }, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifyResendResponse({ status: 422, body: { name: 'validation_error' }, requestSent: true }).outcome, 'permanent_failure')
})

test('webhook signatures are verified and replays outside 5 minutes rejected', async () => {
  const key = Buffer.from('test-secret-key-bytes').toString('base64')
  const secret = `whsec_${key}`
  const body = JSON.stringify({ type: 'email.delivered', created_at: '2026-10-02T08:01:00Z', data: { email_id: 'msg-1' } })
  const sign = (id, ts) => createHmac('sha256', Buffer.from(key, 'base64')).update(`${id}.${ts}.${body}`).digest('base64')
  const now = 1_790_000_000
  assert.equal(await verifySvixSignature({ secret, id: 'evt', timestamp: String(now), signatureHeader: `v1,${sign('evt', now)}`, body, nowSeconds: now }), true)
  assert.equal(await verifySvixSignature({ secret, id: 'evt', timestamp: String(now), signatureHeader: `v1,${sign('evt', now)}`, body: body + ' ', nowSeconds: now }), false)
  assert.equal(await verifySvixSignature({ secret, id: 'evt', timestamp: String(now - 600), signatureHeader: `v1,${sign('evt', now - 600)}`, body, nowSeconds: now }), false)
  assert.equal(await verifySvixSignature({ secret: 'nope', id: 'evt', timestamp: String(now), signatureHeader: `v1,${sign('evt', now)}`, body, nowSeconds: now }), false)
  assert.deepEqual(parseResendWebhookEvent(JSON.parse(body)), { providerMessageId: 'msg-1', event: 'delivered', occurredAt: '2026-10-02T08:01:00Z' })
  assert.equal(parseResendWebhookEvent({ type: 'email.opened', created_at: '2026-10-02T08:01:00Z', data: { email_id: 'm' } }), null)
  // Complaints are terminal and suppressing (same canonical state as SES); bounces stay distinct.
  const at = '2026-10-03T09:00:00Z'
  assert.deepEqual(parseResendWebhookEvent({ type: 'email.complained', created_at: at, data: { email_id: 'm' } }), { providerMessageId: 'm', event: 'complained', occurredAt: at })
  assert.deepEqual(parseResendWebhookEvent({ type: 'email.bounced', created_at: at, data: { email_id: 'm' } }), { providerMessageId: 'm', event: 'bounced', occurredAt: at })
  // Inherited object keys and non-delivery outcomes never map to an event.
  for (const type of ['constructor', 'toString', '__proto__', 'email.failed', 'email.suppressed', 'email.delivery_delayed', 'email.sent', 7]) {
    assert.equal(parseResendWebhookEvent({ type, created_at: at, data: { email_id: 'm' } }), null, String(type))
  }
})

test('runtime is service-role only, reuses the idempotency key and never blind-resends', () => {
  assert.match(migration, /reconcile_reason = 'lease_expired'/)
  assert.match(migration, /'idempotent_replay'[\s\S]*interval '23 hours'/)
  assert.match(migration, /grant execute on function public\.claim_website_enquiry_deliveries\(text, integer, integer\) to service_role/)
  assert.doesNotMatch(migration, /to authenticated|to anon/)
  assert.match(worker, /'Idempotency-Key': job\.delivery_key/)
  assert.match(worker, /config\.state === 'disabled'[\s\S]*claimed: 0/)
  assert.doesNotMatch(worker, /console\.log\([^)]*(recipient|contact|email)/i)
  assert.match(webhook, /verifySvixSignature/)
  for (const marker of [/expired lease was resent/, /a job was claimed twice/, /replay_window_closed/, /enquiries lost/, /bounced count/])
    assert.match(acceptance, marker)
})

test('worker gateway contract: custom secret reaches the handler without a JWT', () => {
  for (const name of ['website-enquiry-delivery-worker', 'website-enquiry-delivery-webhook']) {
    const section = config.split(/\r?\n(?=\[)/).find((block) => block.startsWith(`[functions.${name}]`)) ?? ''
    assert.match(section, /^verify_jwt = false$/m, name)
  }
  assert.match(worker, /constantTimeEqual\(req\.headers\.get\('x-worker-secret'\) \?\? '', expected\)/)
  assert.match(worker, /if \(!a \|\| a\.length !== b\.length\) return false/)
  assert.doesNotMatch(worker, /Authorization'\)|getUser\(/)
})

test('verified provider events are stored durably before acknowledgement', () => {
  assert.match(migration, /create table public\.website_enquiry_delivery_provider_events/)
  assert.match(migration, /unique \(provider, provider_event_id\)/)
  assert.match(migration, /lock_website_enquiry_provider_message\(v_job\.provider, btrim\(p_provider_message_id\)\);\s*update public\.website_enquiry_delivery_jobs/)
  assert.doesNotMatch(migration, /'unknown_message'/)
  assert.match(webhook, /p_provider_event_id: eventId/)
  assert.match(webhook, /data\?\.stored !== true\) return jsonResponse\(\{[^}]*\}, 500\)/)
  assert.match(worker, /sweep_website_enquiry_provider_events/)
  for (const marker of [/early delivered event lost on acceptance/, /worker did not wait for the in-flight webhook transaction/,
    /out-of-order evidence lost/, /state regressed/, /early event lost on reconcile/, /unknown event discarded/, /provider retry not idempotent/])
    assert.match(acceptance, marker)
})
