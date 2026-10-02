// Issue #405 SES transport acceptance. Isolated, disposable PostgreSQL container plus a local
// fake SES endpoint and locally generated SNS certificates. No AWS account, credential,
// DNS or real email is involved.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { signRequest } from '../supabase/functions/_shared/awsSigV4.ts'
import { buildSesSendRequest, classifySesResponse, snsStringToSign } from '../supabase/functions/_shared/websiteEnquirySes.ts'
import { handleSesSnsRequest } from '../supabase/functions/_shared/websiteEnquirySesEvents.ts'
import { verifySnsSigningCertificate } from '../supabase/functions/_shared/snsCertificateTrust.ts'
import { buildPki, SNS_ISSUER_URL } from '../tests/helpers/snsTestPki.mjs'

const container = `cg-405-ses-acceptance-${randomUUID()}`
const database = 'cg_website_enquiry_acceptance'
const TOPIC = 'arn:aws:sns:eu-west-1:123456789012:cg-dynamics-ses-events'
const CERT_URL = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem'
const SECRET = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
const ses = {
  provider: 'ses', from: 'CG Dynamics Leads <leads@notify.example.test>', region: 'eu-west-1', configurationSet: 'cg-dynamics-events',
  credentials: { accessKeyId: 'AKIAEXAMPLEEXAMPLE12', secretAccessKey: SECRET },
}

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker acceptance failed')
  return result.stdout
}
function sql(input, db = database) {
  const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD=postgres', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres',
    '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A'], { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'SQL failed')
  return result.stdout.trim()
}
const lit = (value) => { const tag = `q${randomUUID().replaceAll('-', '')}`; return `$${tag}$${value}$${tag}$` }
const asService = (statement) => sql(`set role service_role;\n${statement}`)
const json = (statement) => JSON.parse(asService(statement) || 'null')
const state = (key) => sql(`select delivery_state from public.website_enquiry_delivery_jobs where delivery_key = '${key}';`)

// Fake SES v2 endpoint: recomputes the SigV4 signature from the received request and the
// shared secret; any mismatch is a 403 exactly like SES.
let fakeSesCalls = 0
async function fakeSes(request, behaviour) {
  fakeSesCalls++
  const amzDate = request.headers['x-amz-date']
  const now = new Date(`${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`)
  const expected = await signRequest({ method: 'POST', url: request.url, body: request.body, region: 'eu-west-1', service: 'ses', now,
    headers: { 'content-type': request.headers['content-type'] } }, ses.credentials)
  if (expected.headers.authorization !== request.headers.authorization) return { status: 403, body: { __type: 'SignatureDoesNotMatch' } }
  const body = JSON.parse(request.body)
  assert.equal(body.ConfigurationSetName, 'cg-dynamics-events')
  assert.equal(body.EmailTags[0].Name, 'cg_delivery_key')
  return behaviour(body)
}

const dir = mkdtempSync(join(tmpdir(), 'cg-ses-acc-'))
// Test PKI: root -> intermediate -> sns.amazonaws.com leaf. The REAL trust verifier runs with
// this root injected; an attacker PKI must still fail against the pinned Amazon roots.
const pki = buildPki({ name: 'acceptance' })
const attacker = buildPki({ name: 'acceptance-attacker' })
const keyPath = pki.leafKey
const certificatePem = pki.leafPem
let leafInUse = certificatePem
function snsNotification(id, eventType, mail, extra = {}) {
  const message = { Type: 'Notification', MessageId: id, TopicArn: TOPIC, Message: JSON.stringify({ eventType, mail, ...extra }),
    Timestamp: new Date().toISOString(), SignatureVersion: '2', SigningCertURL: CERT_URL }
  const input = join(dir, `${id}.txt`)
  writeFileSync(input, snsStringToSign(message))
  return { ...message, Signature: execFileSync('openssl', ['dgst', '-sha256', '-sign', keyPath, input]).toString('base64') }
}
const ingestLogs = []
const deps = {
  topicArn: TOPIC,
  fetchCertificate: async (url) => { assert.equal(url, CERT_URL); return leafInUse },
  trustCertificate: (pem) => verifySnsSigningCertificate(pem, {
    fetchIssuer: async (url) => { assert.equal(url, SNS_ISSUER_URL); return pem === pki.leafPem ? pki.intermediateDer : attacker.intermediateDer },
    roots: [pki.rootPem],
  }),
  confirmSubscription: async () => true,
  log: (entry) => ingestLogs.push(entry),
  findReconcileJob: async (key) => asService(`select id from public.website_enquiry_delivery_jobs where delivery_key = '${key}' and provider = 'ses' and delivery_state = 'reconcile';`) || null,
  resolveFound: async (jobId, messageId) => json(`select public.resolve_website_enquiry_delivery_reconcile('${jobId}', 'found', ${lit(messageId)});`).applied === true,
  applyEvent: async ({ eventId, messageId, event, occurredAt }) => json(`select public.apply_website_enquiry_delivery_event('ses', ${lit(eventId)}, ${lit(messageId)}, '${event}', '${occurredAt}');`),
}
const ingest = async (message) => {
  const response = await handleSesSnsRequest(new Request('https://x.test/', { method: 'POST', body: JSON.stringify(message) }), deps)
  return { status: response.status, ...(await response.json()) }
}

let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=postgres', 'postgres:17-alpine'])
  created = true
  for (let attempt = 0; attempt < 40; attempt++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  sql(`create database ${database};`, 'postgres')
  sql(`create extension pgcrypto; create schema auth; create schema extensions;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    alter default privileges grant all on tables to service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
    create table public.clients(id uuid primary key, name text not null, active boolean not null default true);
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role text, client_id uuid references public.clients(id), is_active boolean not null default true);`)
  for (const migration of ['20261001181932_website_enquiry_transaction', '20261002085355_website_enquiry_intake_guard', '20261002090000_website_lead_lifecycle',
    '20261002110000_website_enquiry_delivery_runtime', '20261002140000_website_enquiry_delivery_suppression', '20261002160000_website_enquiry_delivery_ses_events'])
    sql(readFileSync(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), 'utf8'))

  sql(`insert into public.clients values ('40900000-0000-4000-8000-000000000001', 'SES Client', true);
    insert into auth.users values ('40910000-0000-4000-8000-000000000001');
    insert into public.profiles values ('40910000-0000-4000-8000-000000000001', 'Admin', 'admin', null, true);
    insert into public.website_enquiry_endpoints (id, intake_key, client_id, website_editor_website_id, environment, canonical_host)
      values ('40920000-0000-4000-8000-000000000001', '40921000-0000-4000-8000-000000000001', '40900000-0000-4000-8000-000000000001', 'site-ses', 'production', 'ses.example.test');
    insert into public.website_form_schemas (endpoint_id, schema_key, version, field_definitions, contact_name_key, contact_email_key)
      values ('40920000-0000-4000-8000-000000000001', 'contact_form', 1,
      '[{"key":"name","type":"text","required":true,"max_length":120},{"key":"email","type":"email","required":true,"max_length":320},{"key":"message","type":"textarea","required":true,"max_length":2000}]', 'name', 'email');
    insert into public.website_enquiry_recipient_configurations (id, endpoint_id, version) values ('40940000-0000-4000-8000-000000000001', '40920000-0000-4000-8000-000000000001', 1);
    insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email) values ('40940000-0000-4000-8000-000000000001', 'primary', 'inbox@example.test');
    update public.website_enquiry_recipient_configurations set status = 'approved', approved_by = '40910000-0000-4000-8000-000000000001', approved_at = now();
    update public.website_form_schemas set status = 'active', activated_by = '40910000-0000-4000-8000-000000000001', activated_at = now();
    update public.website_enquiry_endpoints set enabled = true, verified_by = '40910000-0000-4000-8000-000000000001', verified_at = now();`)
  for (const n of [1, 2, 3])
    asService(`select public.submit_website_enquiry('40921000-0000-4000-8000-000000000001', 'contact_form', 1, 'ses-acceptance-00000${n}',
      '{"name":"Visitor ${n}","email":"visitor${n}@example.test","message":"Hello ${n}"}', '{}');`)

  // Worker cycle with the real SES request builder against the fake SES endpoint.
  const claimed = json(`select json_agg(c order by c.enquiry_receipt_id) from public.claim_website_enquiry_deliveries('ses', 10, 120) c;`)
  assert.equal(claimed.length, 3)
  const behaviours = [() => ({ status: 200, body: { MessageId: 'ses-msg-1' } }), () => ({ status: 500, body: { __type: 'InternalFailure' } }), () => ({ status: 200, body: { MessageId: 'ses-msg-3' } })]
  for (const [index, job] of claimed.entries()) {
    const request = await buildSesSendRequest(job, ses)
    const reply = await fakeSes(request, behaviours[index])
    const outcome = classifySesResponse({ status: reply.status, body: reply.body, requestSent: true })
    const done = json(`select public.complete_website_enquiry_delivery('${job.job_id}', '${job.lease_token}', '${outcome.outcome}',
      ${outcome.outcome === 'accepted' ? lit(outcome.providerMessageId) : 'null'}, ${outcome.outcome === 'accepted' ? 'null' : lit(outcome.errorCode)});`)
    assert.equal(done.applied, true)
  }
  const [k1, k2, k3] = claimed.map((job) => job.delivery_key)
  assert.deepEqual([state(k1), state(k2), state(k3)], ['accepted', 'reconcile', 'accepted'])
  assert.equal(fakeSesCalls, 3)

  // A tampered request is rejected by the signature check (proves the fake verifies SigV4).
  const tamper = await buildSesSendRequest(claimed[0], ses)
  assert.equal((await fakeSes({ ...tamper, body: tamper.body.replace('Hello', 'Hellp') }, behaviours[0])).status, 403)

  // SES never auto-replays: nothing is claimable while job 2 sits in reconcile.
  assert.equal(json(`select count(*) from public.claim_website_enquiry_deliveries('ses', 10, 120);`), 0)

  // Events: job 1 delivered.
  const mail = (id, key) => ({ messageId: id, timestamp: '2026-10-02T10:00:00.000Z', tags: { cg_delivery_key: [key] } })
  let result = await ingest(snsNotification('sns-1', 'Delivery', mail('ses-msg-1', k1), { delivery: { timestamp: '2026-10-02T10:00:05.000Z' } }))
  assert.equal(result.outcome, 'stored_delivered')
  assert.equal(state(k1), 'delivered')
  // SNS redelivery of the same notification is idempotent.
  result = await ingest(snsNotification('sns-1', 'Delivery', mail('ses-msg-1', k1), { delivery: { timestamp: '2026-10-02T10:00:05.000Z' } }))
  assert.equal(result.status, 200)
  assert.equal(sql(`select count(*) from public.website_enquiry_delivery_provider_events where provider_event_id = 'sns-1';`), '1')

  // Job 2 (ambiguous 500): SES Send event carrying its delivery-key tag proves the message
  // exists -> resolved found with the SES MessageId, without any resend; then delivered.
  result = await ingest(snsNotification('sns-2a', 'Send', mail('ses-msg-2', k2), { send: {} }))
  assert.equal(result.outcome, 'reconcile_resolved')
  assert.equal(state(k2), 'accepted')
  assert.equal(sql(`select provider_message_id from public.website_enquiry_delivery_jobs where delivery_key = '${k2}';`), 'ses-msg-2')
  result = await ingest(snsNotification('sns-2b', 'Delivery', mail('ses-msg-2', k2), { delivery: { timestamp: '2026-10-02T10:01:00.000Z' } }))
  assert.equal(state(k2), 'delivered')
  assert.equal(fakeSesCalls, 4, 'job 2 was resent') // 3 sends + 1 tamper check only

  // Job 3: delivered then complaint -> complained; a late bounce never regresses it.
  await ingest(snsNotification('sns-3a', 'Delivery', mail('ses-msg-3', k3), { delivery: { timestamp: '2026-10-02T10:02:00.000Z' } }))
  result = await ingest(snsNotification('sns-3b', 'Complaint', mail('ses-msg-3', k3), { complaint: { timestamp: '2026-10-02T10:05:00.000Z' } }))
  assert.equal(result.outcome, 'stored_complained')
  assert.equal(state(k3), 'complained')
  assert.equal(sql(`select complained_at is not null and delivered_at is not null from public.website_enquiry_delivery_jobs where delivery_key = '${k3}';`), 't')
  await ingest(snsNotification('sns-3c', 'Bounce', mail('ses-msg-3', k3), { bounce: { bounceType: 'Permanent', timestamp: '2026-10-02T10:06:00.000Z' } }))
  assert.equal(state(k3), 'complained')
  assert.equal(sql(`select outcome from public.website_enquiry_delivery_provider_events where provider_event_id = 'sns-3c';`), 'superseded')

  // Untrusted inputs store nothing.
  const before = sql('select count(*) from public.website_enquiry_delivery_provider_events;')
  const forged = snsNotification('sns-x', 'Delivery', mail('ses-msg-1', k1), { delivery: { timestamp: '2026-10-02T10:00:05.000Z' } })
  assert.equal((await ingest({ ...forged, Message: forged.Message.replace('Delivery', 'Bounce') })).status, 401)
  assert.equal((await ingest({ ...forged, TopicArn: TOPIC.replace('cg-dynamics', 'other') })).status, 403)
  // Attacker chain (own root, sns.amazonaws.com leaf, amazontrust AIA) with a VALID signature
  // made by the attacker's leaf key: rejected by chain trust, nothing stored.
  leafInUse = attacker.leafPem
  const attackerSigned = (() => {
    const message = { ...forged, Signature: undefined, MessageId: 'sns-attacker' }
    const input = join(dir, 'attacker.txt')
    writeFileSync(input, snsStringToSign(message))
    return { ...message, Signature: execFileSync('openssl', ['dgst', '-sha256', '-sign', attacker.leafKey, input]).toString('base64') }
  })()
  const attackerResult = await ingest(attackerSigned)
  assert.deepEqual([attackerResult.status, attackerResult.outcome, attackerResult.reason], [401, 'untrusted_certificate', 'issuer_not_anchored_to_amazon_root'])
  leafInUse = certificatePem
  assert.equal(sql('select count(*) from public.website_enquiry_delivery_provider_events;'), before)

  // Evidence and logs.
  assert.equal(sql('select count(*) from public.website_enquiries;'), '3')
  assert.ok(!/visitor|inbox@|ses-msg|ses-acceptance/.test(JSON.stringify(ingestLogs)), 'ingest logs leaked data')
  console.log('PASS: #405 SES transport — SigV4-verified SendEmail, accepted->delivered, ambiguous->reconcile resolved from SES Send evidence without resend, complaint terminal, never-regress, SNS signature/topic gates, idempotent SNS redelivery')
} finally {
  if (created) docker(['stop', container])
}
