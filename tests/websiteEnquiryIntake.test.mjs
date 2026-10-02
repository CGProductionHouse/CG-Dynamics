import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWebsiteIntakeHandler, readIntakeBody } from '../supabase/functions/_shared/websiteEnquiryIntake.ts'

const key = '40521000-0000-4000-8000-000000000001'
const submissionKey = '62300000-0000-4000-8000-000000000001'
const receipt = '62300000-0000-4000-8000-000000000002'
const payload = { submissionKey, answers: { name: 'Test', email: 'test@example.test', message: 'Enquiry' } }
const headers = { 'x-intake-key': key, 'x-website-host': 'a.example.test', 'x-form-schema': 'contact_form', 'x-form-version': '1', origin: 'https://a.example.test', 'content-type': 'application/json' }
const request = (body = payload, overrides = {}) => new Request('https://edge.example.test/intake', { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(body) })
const success = { accepted: true, receipt_id: receipt, accepted_at: '2026-10-02T10:00:00Z', client_id: 'private', recipients: ['private@example.test'], intake_key: key }

test('OFF, method, missing capability and mismatched origin fail before RPC', async () => {
  let calls = 0
  const rpc = async () => { calls++; throw Error('must not run') }
  assert.equal((await createWebsiteIntakeHandler({ enabled: false, rpc })(request())).status, 503)
  const handle = createWebsiteIntakeHandler({ enabled: true, rpc })
  assert.equal((await handle(new Request('https://example.test'))).status, 405)
  assert.equal((await handle(request(payload, { 'x-intake-key': '' }))).status, 401)
  assert.equal((await handle(request(payload, { origin: 'https://b.example.test' }))).status, 401)
  assert.equal(calls, 0)
})

test('bounded payload, honeypot, identity injection and malformed schema reject before RPC', async () => {
  let calls = 0
  const handle = createWebsiteIntakeHandler({ enabled: true, rpc: async () => { calls++; return { data: null, error: null } } })
  for (const field of ['client_id', 'recipient_email', 'website_id']) assert.equal((await handle(request({ ...payload, [field]: 'injected' }))).status, 400)
  assert.equal((await handle(request({ ...payload, honeypot: 'bot' }))).status, 400)
  assert.equal((await handle(request({ ...payload, answers: { message: 'é'.repeat(9000) } }))).status, 413)
  assert.equal((await handle(request(payload, { 'x-form-version': '0' }))).status, 401)
  assert.equal(calls, 0)
})

test('a timed-out stream cannot accept an already parseable partial body', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{}')) } })
  await assert.rejects(readIntakeBody(new Request('https://example.test', { method: 'POST', body: stream, duplex: 'half' }), 5), /invalid_body/)
})

test('capability/host/schema admission precedes canonical transaction; receipt is redacted', async () => {
  const calls = []
  const handle = createWebsiteIntakeHandler({ enabled: true, rpc: async (name, args) => {
    calls.push({ name, args })
    return { data: name === 'reserve_website_enquiry_intake' ? { state: 'allowed' } : success, error: null }
  } })
  const response = await handle(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { accepted: true, receiptId: receipt, acceptedAt: success.accepted_at })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), null)
  assert.deepEqual(calls.map(row => row.name), ['reserve_website_enquiry_intake', 'submit_website_enquiry'])
  assert.equal(calls[0].args.p_canonical_host, 'a.example.test')
  assert.equal(calls[1].args.p_submission_key, submissionKey)
  assert.equal('p_client_id' in calls[1].args, false)
})

test('unavailable, wrong capability and exhausted admission cannot submit', async () => {
  for (const state of ['unavailable', 'rate_limited', 'unexpected']) {
    let calls = 0
    const response = await createWebsiteIntakeHandler({ enabled: true, rpc: async name => {
      calls++; assert.equal(name, 'reserve_website_enquiry_intake')
      return { data: { state, retry_after: 3600 }, error: null }
    } })(request())
    assert.equal(response.status, state === 'rate_limited' ? 429 : 503)
    assert.equal(calls, 1)
    if (state === 'rate_limited') assert.equal(response.headers.get('retry-after'), '3600')
  }
})

test('transaction errors and malformed success cannot claim acceptance or leak details', async () => {
  for (const [error, data, status] of [[{ code: '23505', message: key }, null, 409], [{ code: '22023' }, null, 422], [null, { accepted: true }, 503]]) {
    const handle = createWebsiteIntakeHandler({ enabled: true, rpc: async name => ({ data: name === 'reserve_website_enquiry_intake' ? { state: 'allowed' } : data, error: name === 'reserve_website_enquiry_intake' ? null : error }) })
    const response = await handle(request())
    assert.equal(response.status, status)
    assert.equal((await response.json()).accepted, false)
  }
})
