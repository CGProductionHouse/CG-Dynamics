import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  INTAKE_KEY_HEADER,
  classifySubmitError,
  handleIntakeRequest as handler,
  readCapped,
  parseIntakeBody,
} from '../supabase/functions/_shared/websiteEnquiryIntake.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const entry = read('../supabase/functions/website-enquiry-intake/index.ts')
const shared = read('../supabase/functions/_shared/websiteEnquiryIntake.ts')
const config = read('../supabase/config.toml')
const acceptance = read('../scripts/website-enquiry-intake-acceptance.mjs')
const handleIntakeRequest = (request, deps) => handler(request, { admit: async () => ({ data: { state: 'allowed' } }), ...deps })
const receiptId = '62420000-0000-4000-8000-000000000001'

const KEY = '62410000-0000-4000-8000-000000000001'
const valid = { schemaKey: 'contact_form', schemaVersion: 1, submissionKey: 'site-submission-0001', answers: { email: 'a@example.test' } }
const req = (payload, headers = {}) => new Request('https://x.test/', {
  method: 'POST', headers: { 'content-type': 'application/json', [INTAKE_KEY_HEADER]: KEY, ...headers }, body: JSON.stringify(payload),
})

test('gateway contract: intake key reaches the handler without a JWT', () => {
  const section = config.split(/\r?\n(?=\[)/).find((block) => block.startsWith('[functions.website-enquiry-intake]')) ?? ''
  assert.match(section, /^verify_jwt = false$/m)
  assert.match(entry, /admin\.rpc\('submit_website_enquiry', args\)/)
  assert.doesNotMatch(entry, /Access-Control|corsHeaders/)
  assert.doesNotMatch(shared, /Access-Control/)
})

test('body contract is strict and identity can never come from the body', () => {
  assert.equal(parseIntakeBody(valid).ok, true)
  for (const extra of ['clientId', 'client_id', 'websiteId', 'environment', 'recipientEmail', 'role', 'status', 'quality', 'intakeKey', 'endpointId']) {
    assert.equal(parseIntakeBody({ ...valid, [extra]: 'x' }).ok, false, extra)
  }
  assert.equal(parseIntakeBody({ ...valid, schemaVersion: 1.5 }).ok, false)
  assert.equal(parseIntakeBody({ ...valid, submissionKey: 'short' }).ok, false)
  assert.equal(parseIntakeBody({ ...valid, answers: {} }).ok, false)
  assert.equal(parseIntakeBody({ ...valid, answers: { Email: 'x' } }).ok, false)
  assert.equal(parseIntakeBody({ ...valid, answers: { note: { nested: true } } }).ok, false)
  assert.equal(parseIntakeBody({ ...valid, attribution: { gclid: 'x'.repeat(501) } }).ok, false)
  const honeypot = parseIntakeBody({ ...valid, honeypot: ' bot ' })
  assert.equal(honeypot.ok && honeypot.honeypot, true)
  assert.equal(parseIntakeBody({ ...valid, honeypot: '' }).ok && parseIntakeBody({ ...valid, honeypot: '' }).honeypot, false)
})

test('canonical errors map to bounded, non-revealing categories', () => {
  assert.equal(classifySubmitError({ code: '22023', message: 'Website intake is unavailable.' }), 'intake_unavailable')
  assert.equal(classifySubmitError({ code: '22023', message: 'Website intake recipient routing is unavailable.' }), 'intake_unavailable')
  assert.equal(classifySubmitError({ code: '22023', message: 'Form schema is unsupported.' }), 'schema_unsupported')
  assert.equal(classifySubmitError({ code: '22023', message: 'Email field is invalid.' }), 'invalid_submission')
  assert.equal(classifySubmitError({ code: '23505', message: 'Submission key was already used with different content.' }), 'submission_conflict')
  assert.equal(classifySubmitError({ code: 'XX000', message: 'anything' }), 'temporarily_unavailable')
})

test('honeypot never reaches the canonical transaction', async () => {
  let calls = 0
  const response = await handleIntakeRequest(req({ ...valid, honeypot: 'filled' }), { submit: async () => { calls++; return {} } })
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { ok: true, handled: true })
  assert.equal(calls, 0)
})

test('only safe receipt truth is returned and the key is passed only to the RPC', async () => {
  let seen
  const response = await handleIntakeRequest(req(valid), {
    submit: async (args) => { seen = args; return { data: { accepted: true, receipt_id: receiptId, accepted_at: '2026-10-02T10:00:00Z', replayed: false, internal: 'x' } } },
  })
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { ok: true, handled: true, accepted: true, receiptId, acceptedAt: '2026-10-02T10:00:00Z', replayed: false })
  assert.equal(seen.p_intake_key, KEY)
  assert.deepEqual(Object.keys(seen).sort(), ['p_answers', 'p_attribution', 'p_intake_key', 'p_schema_key', 'p_schema_version', 'p_submission_key'])
})

test('browser-originated and wrong-method requests are refused before any work', async () => {
  const submit = async () => { throw new Error('must not be called') }
  assert.equal((await handleIntakeRequest(req(valid, { origin: 'https://evil.example' }), { submit })).status, 403)
  assert.equal((await handleIntakeRequest(new Request('https://x.test/', { method: 'OPTIONS' }), { submit })).status, 405)
})

test('executable acceptance covers every #624 scenario', () => {
  for (const marker of [/honeypot created an enquiry/, /replayed, true/, /submission_conflict/, /intake_unavailable/,
    /server_to_server_only/, /status, 413|MAX_INTAKE_BODY_BYTES \+ 1/, /log leaked/, /intake attempted delivery/, /recipientEmail/])
    assert.match(acceptance, marker)
})

test('exhausted, unavailable or malformed admission never enters the canonical transaction', async () => {
  for (const state of ['rate_limited', 'unavailable', 'unexpected']) {
    let calls = 0
    const response = await handleIntakeRequest(req(valid), { admit: async key => { assert.equal(key, KEY); return { data: { state, retry_after: 3600 } } }, submit: async () => { calls++; return {} } })
    assert.equal(calls, 0)
    assert.equal(response.status, state === 'rate_limited' ? 429 : state === 'unavailable' ? 403 : 503)
    if (state === 'rate_limited') { assert.equal(response.headers.get('retry-after'), '3600'); assert.equal((await response.json()).retryable, true) }
  }
})

test('timed-out or errored body streams fail closed even with a parseable prefix', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{}')) } })
  await assert.rejects(readCapped(new Request('https://example.test', { method: 'POST', body: stream, duplex: 'half' }), 100, 5), /body_timeout/)
  const broken = new ReadableStream({ start(controller) { controller.error(new Error('private stream diagnostic')) } })
  const response = await handleIntakeRequest(new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json', [INTAKE_KEY_HEADER]: KEY }, body: broken, duplex: 'half' }), { submit: async () => { throw Error('must not run') } })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'invalid_request')
})

test('invalid canonical receipt identity or time can never claim success', async () => {
  for (const data of [{ receipt_id: 'invalid', accepted_at: '2026-10-02T10:00:00Z' }, { receipt_id: receiptId, accepted_at: 'invalid' }]) {
    const response = await handleIntakeRequest(req(valid), { submit: async () => ({ data: { accepted: true, ...data } }) })
    assert.equal(response.status, 503)
  }
})
