import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { signRequest, signingKey } from '../supabase/functions/_shared/awsSigV4.ts'
import {
  parseSnsMessage,
  buildSesSendRequest,
  classifySesResponse,
  isTrustedSnsCertUrl,
  isTrustedSnsSubscribeUrl,
  isValidSnsTopicArn,
  parseSesEvent,
  snsStringToSign,
  verifySnsSignature,
} from '../supabase/functions/_shared/websiteEnquirySes.ts'
import { resolveProviderConfig } from '../supabase/functions/_shared/websiteEnquiryProviders.ts'
import { handleSesSnsRequest } from '../supabase/functions/_shared/websiteEnquirySesEvents.ts'
import { X509Certificate } from 'node:crypto'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const worker = read('../supabase/functions/website-enquiry-delivery-worker/index.ts').replace(/\r\n/g, '\n')
const config = read('../supabase/config.toml')
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

export const TOPIC = 'arn:aws:sns:eu-west-1:123456789012:cg-dynamics-ses-events'
const job = {
  job_id: 'j', lease_token: 'l', delivery_key: '11111111-1111-4111-8111-111111111111', attempt_count: 1,
  recipient_email: 'leads@example.test', recipient_name: 'Leads', enquiry_receipt_id: 'r-1',
  enquiry_accepted_at: '2026-10-02T08:00:00Z', client_name: 'Example Client', website_editor_website_id: 'w',
  contact: { name: 'Visitor', email: 'visitor@example.test' }, fields: [{ label: 'Message', value: 'Hello' }], landing_path: '/contact',
}
const sesConfig = {
  provider: 'ses', from: 'CG Dynamics Leads <leads@notify.example.test>', region: 'eu-west-1', configurationSet: 'cg-dynamics-events',
  credentials: { accessKeyId: 'AKIAEXAMPLEEXAMPLE12', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
}

test('SigV4 matches the AWS-published IAM ListUsers example exactly', async () => {
  const signed = await signRequest({
    method: 'GET', url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: '',
    region: 'us-east-1', service: 'iam', now: new Date('2015-08-30T12:36:00Z'),
  }, { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' })
  assert.equal(toHex(await signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830', 'us-east-1', 'iam')),
    'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9')
  assert.equal(signed.signature, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7')
})

test('SES SendEmail request: approved From, visitor Reply-To, configuration set, delivery-key tag, signed', async () => {
  const now = new Date('2026-10-02T10:00:00Z')
  const request = await buildSesSendRequest(job, sesConfig, now)
  assert.equal(request.url, 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails')
  const body = JSON.parse(request.body)
  assert.equal(body.FromEmailAddress, sesConfig.from)
  assert.deepEqual(body.Destination, { ToAddresses: ['leads@example.test'] })
  assert.deepEqual(body.ReplyToAddresses, ['visitor@example.test'])
  assert.equal(body.ConfigurationSetName, 'cg-dynamics-events')
  assert.deepEqual(body.EmailTags, [{ Name: 'cg_delivery_key', Value: job.delivery_key }])
  assert.match(body.Content.Simple.Body.Text.Data, /Message:\nHello/)
  assert.doesNotMatch(request.body, /List-Unsubscribe|<img|utm_/i)
  assert.match(request.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLEEXAMPLE12\/20261002\/eu-west-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/)
  // Signature binds the body: any change produces a different signature.
  const again = await signRequest({ method: 'POST', url: request.url, body: request.body, region: 'eu-west-1', service: 'ses', now, headers: { 'content-type': 'application/json' } }, sesConfig.credentials)
  const tampered = await signRequest({ method: 'POST', url: request.url, body: request.body.replace('Hello', 'Hellp'), region: 'eu-west-1', service: 'ses', now, headers: { 'content-type': 'application/json' } }, sesConfig.credentials)
  assert.equal(request.headers.authorization, again.headers.authorization)
  assert.notEqual(again.signature, tampered.signature)
  const noReply = JSON.parse((await buildSesSendRequest({ ...job, contact: { phone: '082' } }, sesConfig, now)).body)
  assert.equal(noReply.ReplyToAddresses, undefined)
})

test('SES responses: accepted only with MessageId; 5xx/no-response ambiguous; throttling retryable; rejections permanent', () => {
  assert.deepEqual(classifySesResponse({ status: 200, body: { MessageId: 'ses-1' }, requestSent: true }), { outcome: 'accepted', providerMessageId: 'ses-1' })
  assert.equal(classifySesResponse({ status: 200, body: {}, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifySesResponse({ requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifySesResponse({ requestSent: false }).outcome, 'retryable_failure')
  assert.equal(classifySesResponse({ status: 500, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifySesResponse({ status: 503, requestSent: true }).outcome, 'ambiguous')
  assert.equal(classifySesResponse({ status: 429, body: { __type: 'TooManyRequestsException' }, requestSent: true }).outcome, 'retryable_failure')
  assert.equal(classifySesResponse({ status: 400, body: { __type: 'SendingPausedException' }, requestSent: true }).outcome, 'retryable_failure')
  assert.equal(classifySesResponse({ status: 403, body: { __type: 'com.amazon.coral.service#UnrecognizedClientException' }, requestSent: true }).outcome, 'retryable_failure')
  const rejected = classifySesResponse({ status: 400, body: { __type: 'MessageRejected' }, requestSent: true })
  assert.deepEqual(rejected, { outcome: 'permanent_failure', errorCode: 'ses_MessageRejected' })
})

test('provider config: SES fail-closed with exact gates; only Resend may auto-replay', () => {
  const env = values => name => values[name]
  const base = { WEBSITE_ENQUIRY_EMAIL_ENABLED: 'true', WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'ses', WEBSITE_ENQUIRY_EMAIL_FROM: 'CG Dynamics Leads <leads@notify.example.test>' }
  assert.equal(resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_EMAIL_ENABLED: undefined })).reason, 'WEBSITE_ENQUIRY_EMAIL_ENABLED is not true')
  assert.match(resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_EMAIL_FROM: 'bad' })).reason, /EMAIL_FROM/)
  assert.match(resolveProviderConfig(env(base)).reason, /SES_REGION/)
  assert.match(resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_SES_REGION: 'eu-west-1' })).reason, /SES_ACCESS_KEY_ID/)
  assert.match(resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_SES_REGION: 'eu-west-1', WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID: 'AKIAEXAMPLEEXAMPLE12' })).reason, /SES_SECRET_ACCESS_KEY/)
  const partial = { ...base, WEBSITE_ENQUIRY_SES_REGION: 'eu-west-1', WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID: 'AKIAEXAMPLEEXAMPLE12', WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY: 'x'.repeat(40) }
  assert.match(resolveProviderConfig(env(partial)).reason, /SES_CONFIGURATION_SET/)
  const ready = resolveProviderConfig(env({ ...partial, WEBSITE_ENQUIRY_SES_CONFIGURATION_SET: 'cg-dynamics-events' }))
  assert.equal(ready.state, 'ready')
  assert.equal(ready.provider, 'ses')
  assert.equal(ready.supportsIdempotentReplay, false)
  assert.ok(!JSON.stringify({ reason: resolveProviderConfig(env(partial)).reason }).includes('x'.repeat(40)))
  const resend = resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'resend', WEBSITE_ENQUIRY_RESEND_API_KEY: 'k' }))
  assert.equal(resend.provider, 'resend')
  assert.equal(resend.supportsIdempotentReplay, true)
  assert.match(resolveProviderConfig(env({ ...base, WEBSITE_ENQUIRY_EMAIL_PROVIDER: 'smtp' })).reason, /approved provider/)
})

test('worker never auto-replays SES and dispatches by provider; SNS function has a deliberate gateway setting', () => {
  assert.match(worker, /if \(config\.supportsIdempotentReplay\) \{[\s\S]*p_resolution: 'idempotent_replay'[\s\S]*?\n  \}/)
  assert.doesNotMatch(worker.replace(/if \(config\.supportsIdempotentReplay\) \{[\s\S]*?\n  \}\n/, ''), /idempotent_replay/)
  assert.match(worker, /config\.provider === 'ses' \? sendViaSes\(job, config\)/)
  const section = config.split(/\r?\n(?=\[)/).find(block => block.startsWith('[functions.website-enquiry-ses-events]')) ?? ''
  assert.match(section, /^verify_jwt = false$/m)
})

// ---- SNS signature verification with real RSA keys and X.509 certificates (OpenSSL) ----
export function makeCert(dir, name) {
  const key = join(dir, `${name}.key`), cert = join(dir, `${name}.pem`)
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', `/CN=${name}`], { stdio: 'ignore' })
  return { key, pem: readFileSync(cert, 'utf8') }
}
export function signSns(message, keyPath, dir) {
  const input = join(dir, `sts-${Math.random().toString(36).slice(2)}.txt`)
  writeFileSync(input, snsStringToSign(message))
  const digest = message.SignatureVersion === '2' ? '-sha256' : '-sha1'
  return { ...message, Signature: execFileSync('openssl', ['dgst', digest, '-sign', keyPath, input]).toString('base64') }
}
export const CERT_URL = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem'
export function sesEventMessage(eventType, extra = {}, messageId = 'ses-message-1', deliveryKey = job.delivery_key) {
  const mail = { messageId, timestamp: '2026-10-02T10:00:00.000Z', tags: deliveryKey ? { cg_delivery_key: [deliveryKey] } : {} }
  return JSON.stringify({ eventType, mail, ...extra })
}

test('SNS SHA256 signatures verify with the certificate key; tampering, wrong keys and SignatureVersion 1 fail', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-sns-'))
  const good = makeCert(dir, 'sns-good'), other = makeCert(dir, 'sns-other')
  const spki = (pem) => new Uint8Array(new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' }))
  const message = signSns({ Type: 'Notification', MessageId: 'm-1', TopicArn: TOPIC, Message: sesEventMessage('Delivery', { delivery: { timestamp: '2026-10-02T10:00:05Z' } }), Timestamp: '2026-10-02T10:00:06Z', SignatureVersion: '2', SigningCertURL: CERT_URL }, good.key, dir)
  assert.equal(await verifySnsSignature(message, spki(good.pem)), true)
  assert.equal(await verifySnsSignature({ ...message, Message: message.Message.replace('Delivery', 'Bounce') }, spki(good.pem)), false)
  assert.equal(await verifySnsSignature(message, spki(other.pem)), false)
  // SignatureVersion 1 (SHA1) is rejected outright, even when its signature is valid.
  const v1 = signSns({ ...message, Signature: undefined, SignatureVersion: '1' }, good.key, dir)
  assert.equal(await verifySnsSignature(v1, spki(good.pem)), false)
  assert.equal(parseSnsMessage(v1), null)
  const withSubject = signSns({ Type: 'Notification', MessageId: 'm-2', TopicArn: TOPIC, Subject: 'S', Message: '{}', Timestamp: 't', SignatureVersion: '2', SigningCertURL: CERT_URL }, good.key, dir)
  assert.equal(await verifySnsSignature(withSubject, spki(good.pem)), true)
  assert.equal(await verifySnsSignature({ ...withSubject, Subject: 'T' }, spki(good.pem)), false)
})

test('certificate, subscribe URL and topic ARN trust rules', () => {
  assert.equal(isTrustedSnsCertUrl(CERT_URL), true)
  for (const bad of ['http://sns.eu-west-1.amazonaws.com/x.pem', 'https://sns.eu-west-1.amazonaws.com.evil.test/x.pem',
    'https://evil.test/sns.eu-west-1.amazonaws.com/x.pem', 'https://sns.eu-west-1.amazonaws.com/x.txt', 'https://u:p@sns.eu-west-1.amazonaws.com/x.pem',
    'https://sns.eu-west-1.amazonaws.com/x.pem', 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc.pem',
    'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-0123456789abcdef.pem?x=1', 'https://sns.eu-west-1.amazonaws.com/a/SimpleNotificationService-0123456789abcdef.pem'])
    assert.equal(isTrustedSnsCertUrl(bad), false, bad)
  assert.equal(isTrustedSnsSubscribeUrl('https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=y'), true)
  assert.equal(isTrustedSnsSubscribeUrl('https://evil.test/?Action=ConfirmSubscription'), false)
  assert.equal(isTrustedSnsSubscribeUrl('https://sns.eu-west-1.amazonaws.com/?Action=Unsubscribe'), false)
  assert.equal(isValidSnsTopicArn(TOPIC), true)
  assert.equal(isValidSnsTopicArn('arn:aws:sqs:eu-west-1:123456789012:q'), false)
})

test('SES event mapping: final outcomes only, delivery-key tag carried', () => {
  assert.deepEqual(parseSesEvent(sesEventMessage('Delivery', { delivery: { timestamp: '2026-10-02T10:00:05Z' } })),
    { providerMessageId: 'ses-message-1', deliveryKey: job.delivery_key, event: 'delivered', occurredAt: '2026-10-02T10:00:05Z' })
  assert.equal(parseSesEvent(sesEventMessage('Bounce', { bounce: { bounceType: 'Permanent', timestamp: '2026-10-02T10:00:05Z' } })).event, 'bounced')
  assert.equal(parseSesEvent(sesEventMessage('Bounce', { bounce: { bounceType: 'Transient', timestamp: '2026-10-02T10:00:05Z' } })), null)
  assert.equal(parseSesEvent(sesEventMessage('Complaint', { complaint: { timestamp: '2026-10-02T10:00:05Z' } })).event, 'complained')
  assert.equal(parseSesEvent(sesEventMessage('Reject', { reject: { reason: 'Bad content' } })).event, 'bounced')
  assert.equal(parseSesEvent(sesEventMessage('Send', { send: {} })).event, 'sent')
  assert.equal(parseSesEvent(sesEventMessage('DeliveryDelay', { deliveryDelay: {} })), null)
  assert.equal(parseSesEvent(sesEventMessage('Delivery', { delivery: { timestamp: '2026-10-02T10:00:05Z' } }, 'm', null)).deliveryKey, null)
  assert.equal(parseSesEvent('not json'), null)
})

test('SNS ingest handler: topic/cert/signature gates, subscription confirm, durable store, reconcile by tag', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-sns-h-'))
  const good = makeCert(dir, 'h-good')
  const calls = { applied: [], confirmed: [], resolved: [] }
  const logs = []
  const deps = (over = {}) => ({
    topicArn: TOPIC,
    fetchCertificate: async () => good.pem,
    trustCertificate: async (pem) => ({ ok: true, spki: new Uint8Array(new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' })) }),
    confirmSubscription: async url => { calls.confirmed.push(url); return true },
    findReconcileJob: async key => key === job.delivery_key ? 'job-reconcile' : null,
    resolveFound: async (jobId, messageId) => { calls.resolved.push([jobId, messageId]); return true },
    applyEvent: async args => { calls.applied.push(args); return { stored: true } },
    log: entry => logs.push(entry),
    ...over,
  })
  const post = (message) => new Request('https://x.test/', { method: 'POST', headers: { 'content-type': 'text/plain; charset=UTF-8' }, body: JSON.stringify(message) })
  const notify = (eventType, extra, id = 'sns-1') => signSns({ Type: 'Notification', MessageId: id, TopicArn: TOPIC, Message: sesEventMessage(eventType, extra), Timestamp: '2026-10-02T10:00:06Z', SignatureVersion: '2', SigningCertURL: CERT_URL }, good.key, dir)

  const delivered = notify('Delivery', { delivery: { timestamp: '2026-10-02T10:00:05Z' } })
  assert.equal((await handleSesSnsRequest(post(delivered), deps())).status, 200)
  assert.deepEqual(calls.applied.at(-1), { eventId: 'sns-1', messageId: 'ses-message-1', event: 'delivered', occurredAt: '2026-10-02T10:00:05Z' })
  assert.deepEqual(calls.resolved.at(-1), ['job-reconcile', 'ses-message-1'])

  assert.equal((await handleSesSnsRequest(post({ ...delivered, TopicArn: TOPIC.replace('cg-dynamics', 'other') }), deps())).status, 403)
  assert.equal((await handleSesSnsRequest(post({ ...delivered, SigningCertURL: 'https://evil.test/x.pem' }), deps())).status, 403)
  assert.equal((await handleSesSnsRequest(post({ ...delivered, Message: delivered.Message.replace('Delivery', 'Complaint') }), deps())).status, 401)
  assert.equal((await handleSesSnsRequest(post(delivered), deps({ topicArn: '' }))).status, 503)
  const untrusted = await handleSesSnsRequest(post(delivered), deps({ trustCertificate: async () => ({ ok: false, reason: 'issuer_not_anchored_to_amazon_root' }) }))
  assert.equal(untrusted.status, 401)
  assert.equal((await untrusted.json()).outcome, 'untrusted_certificate')
  assert.equal((await handleSesSnsRequest(post(delivered), deps({ trustCertificate: async () => ({ ok: false, reason: 'issuer_unavailable' }) }))).status, 503)
  const appliedBeforeV1 = calls.applied.length
  assert.equal((await handleSesSnsRequest(post({ ...delivered, SignatureVersion: '1' }), deps())).status, 400)
  assert.equal(calls.applied.length, appliedBeforeV1, 'untrusted inputs stored an event')
  assert.equal((await handleSesSnsRequest(post(delivered), deps({ applyEvent: async () => { throw new Error('db down') } }))).status, 500)
  assert.equal((await handleSesSnsRequest(post(delivered), deps({ applyEvent: async () => ({ stored: false }) }))).status, 500)
  assert.equal((await handleSesSnsRequest(new Request('https://x.test/'), deps())).status, 405)

  const sub = signSns({ Type: 'SubscriptionConfirmation', MessageId: 'sub-1', TopicArn: TOPIC, Message: 'confirm', Timestamp: 't', Token: 'tok', SubscribeURL: 'https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=tok', SignatureVersion: '2', SigningCertURL: CERT_URL }, good.key, dir)
  assert.equal((await handleSesSnsRequest(post(sub), deps())).status, 200)
  assert.equal(calls.confirmed.length, 1)
  const evilSub = signSns({ ...sub, Signature: undefined, SubscribeURL: 'https://evil.test/?Action=ConfirmSubscription' }, good.key, dir)
  assert.equal((await handleSesSnsRequest(post(evilSub), deps())).status, 403)
  assert.equal(calls.confirmed.length, 1)

  const sendOnly = notify('Send', { send: {} }, 'sns-send')
  const before = calls.applied.length
  const sendResponse = await handleSesSnsRequest(post(sendOnly), deps())
  assert.equal(sendResponse.status, 200)
  assert.equal((await sendResponse.json()).outcome, 'reconcile_resolved')
  assert.equal(calls.applied.length, before, 'Send event must not be stored as a delivery outcome')
  assert.equal((await (await handleSesSnsRequest(post(notify('DeliveryDelay', { deliveryDelay: {} }, 'sns-dd')), deps())).json()).outcome, 'ignored_event')

  const text = JSON.stringify(logs)
  assert.doesNotMatch(text, /visitor@|leads@|ses-message|11111111/)
  assert.ok(logs.every(entry => Object.keys(entry).sort().join() === 'event,outcome,status'))
})
