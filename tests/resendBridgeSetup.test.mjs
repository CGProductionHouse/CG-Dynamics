// Hermetic tests for scripts/ops/resend-bridge-setup.mjs: a fake Resend API and fake Supabase
// secret store. Never contacts Resend or Supabase.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOMAIN, FROM_HEADER, REGION, run, Stop, WEBHOOK_ENDPOINT, WEBHOOK_EVENTS } from '../scripts/ops/resend-bridge-setup.mjs'

const SETUP_KEY = 're_SETUPFULLACCESSKEY_123456'
const SENDING_TOKEN = 're_SENDINGTOKEN_abcdef123456'
const SIGNING_SECRET = 'whsec_c2lnbmluZ3NlY3JldGZvcnRlc3Rz'
const RECORDS = [
  { record: 'DKIM', name: 'resend._domainkey.notify', type: 'TXT', value: 'p=MIGfMA0TEST', status: 'not_started' },
  { record: 'SPF', name: 'send.notify', type: 'MX', value: 'feedback-smtp.eu-west-1.amazonses.com', priority: 10, status: 'not_started' },
  { record: 'SPF', name: 'send.notify', type: 'TXT', value: 'v=spf1 include:amazonses.com ~all', status: 'not_started' },
]

function harness({ secretNames = 'NAME\nSUPABASE_URL', domains = [], hooks = [], domainStatus = 'not_started', failOn = null, env = {} } = {}) {
  const calls = []
  const stored = []
  const logs = []
  const state = { domains: [...domains], hooks: [...hooks] }
  const fetch = async (url, init) => {
    const path = url.replace('https://api.resend.com', '')
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method: init.method, path, body, auth: init.headers.Authorization })
    const reply = (status, json) => ({ ok: status < 300, status, text: async () => JSON.stringify(json) })
    if (failOn && failOn === `${init.method} ${path}`) return reply(422, { name: 'validation_error', message: 'nope' })
    if (init.method === 'GET' && path === '/domains') return reply(200, { data: state.domains })
    if (init.method === 'GET' && path === '/webhooks') return reply(200, { data: state.hooks })
    if (init.method === 'POST' && path === '/domains') {
      const domain = { id: 'dom_1', name: body.name, status: 'not_started', region: body.region }
      state.domains.push(domain)
      return reply(201, domain)
    }
    if (init.method === 'GET' && path.startsWith('/domains/')) {
      const domain = state.domains.find((item) => path === `/domains/${item.id}`)
      return reply(200, { ...domain, status: domainStatus, records: RECORDS })
    }
    if (init.method === 'POST' && path === '/api-keys') return reply(201, { id: 'key_1', token: SENDING_TOKEN })
    if (init.method === 'POST' && path === '/webhooks') return reply(201, { object: 'webhook', id: 'hook_1', signing_secret: SIGNING_SECRET })
    if (init.method === 'POST' && /^\/domains\/[^/]+\/verify$/.test(path)) return reply(200, { object: 'domain', id: 'dom_1' })
    return reply(404, { name: 'not_found' })
  }
  const deps = (args) => ({
    env: (name) => ({ RESEND_SETUP_API_KEY: SETUP_KEY, ...env })[name],
    args,
    fetch,
    listSecretNames: () => secretNames,
    setSecrets: (text) => stored.push(text),
    log: (line) => logs.push(line),
  })
  return { calls, stored, logs, deps }
}
const mutating = (calls) => calls.filter((call) => call.method !== 'GET')
const everything = (h, result) => [h.logs.join('\n'), result?.summary ?? '', JSON.stringify(h.calls.map(({ auth, ...rest }) => rest))].join('\n')

test('guards stop before any Resend call: bad key, unreadable secrets, ENABLED present', async () => {
  for (const [options, pattern] of [
    [{ env: { RESEND_SETUP_API_KEY: '' } }, /RESEND_SETUP_API_KEY is missing/],
    [{ env: { RESEND_SETUP_API_KEY: 'sk_live_wrong' } }, /not a Resend key/],
    [{ secretNames: null }, /cannot list Supabase secret names/],
    [{ secretNames: 'NAME\nWEBSITE_ENQUIRY_EMAIL_ENABLED' }, /must stay unset/],
  ]) {
    const h = harness(options)
    await assert.rejects(run(h.deps(['--apply'])), (error) => error instanceof Stop && pattern.test(error.message))
    assert.deepEqual(h.calls, [], JSON.stringify(options))
    assert.deepEqual(h.stored, [])
  }
})

test('dry run reads only and stores nothing', async () => {
  const h = harness()
  const result = await run(h.deps([]))
  assert.deepEqual(mutating(h.calls), [])
  assert.deepEqual(h.stored, [])
  assert.equal(result.applied, false)
  assert.match(h.logs.join('\n'), /\[dry-run\] would create domain notify\.cgproductionhouse\.com in eu-west-1/)
  assert.match(h.logs.join('\n'), /Sending remains DISABLED/)
})

test('apply converges domain, sending-only key and webhook; secrets go only to Supabase', async () => {
  const h = harness()
  const result = await run(h.deps(['--apply']))
  const posts = mutating(h.calls)
  assert.deepEqual(posts.map((call) => call.path), ['/domains', '/api-keys', '/webhooks'])
  assert.deepEqual(posts[0].body, { name: DOMAIN, region: REGION, open_tracking: false, click_tracking: false })
  assert.deepEqual(posts[1].body, { name: 'cg-dynamics-website-enquiry-sending', permission: 'sending_access', domain_id: 'dom_1' })
  assert.deepEqual(posts[2].body, { endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS })
  assert.deepEqual(WEBHOOK_EVENTS, ['email.delivered', 'email.bounced', 'email.complained'])
  // Stored one at a time, in creation order; provider and the enable flag untouched.
  assert.deepEqual(h.stored, [`WEBSITE_ENQUIRY_RESEND_API_KEY=${SENDING_TOKEN}\n`, `WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET=${SIGNING_SECRET}\n`])
  assert.ok(!h.stored.join('').includes('WEBSITE_ENQUIRY_EMAIL_'), 'provider/from/enable changed without --switch-provider')
  assert.deepEqual(result.stored, ['WEBSITE_ENQUIRY_RESEND_API_KEY', 'WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET'])
  // No secret in logs, summary or request bodies; the setup key is used only as the bearer.
  for (const secret of [SETUP_KEY, SENDING_TOKEN, SIGNING_SECRET]) assert.ok(!everything(h, result).includes(secret), 'secret leaked')
  assert.ok(h.calls.every((call) => call.auth === `Bearer ${SETUP_KEY}`))
  assert.ok(!h.stored.join('').includes(SETUP_KEY), 'setup key stored')
  // Summary lists the DNS records Resend returned.
  assert.match(result.summary, /TXT\tresend\._domainkey\.notify\tp=MIGfMA0TEST/)
  assert.match(result.summary, /MX\tsend\.notify\t10 feedback-smtp\.eu-west-1\.amazonses\.com/)
  assert.match(result.summary, /TXT\tsend\.notify\tv=spf1 include:amazonses\.com ~all/)
})

test('re-run with everything in place changes nothing', async () => {
  const h = harness({
    secretNames: 'NAME\nWEBSITE_ENQUIRY_RESEND_API_KEY\nWEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET',
    domains: [{ id: 'dom_1', name: DOMAIN, status: 'pending', region: REGION }],
    hooks: [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS, status: 'enabled' }],
  })
  await run(h.deps(['--apply']))
  assert.deepEqual(mutating(h.calls), [])
  assert.deepEqual(h.stored, [])
})

test('an existing webhook whose secret is not stored (or misconfigured) fails closed before any change', async () => {
  for (const [hook, names, pattern] of [
    [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS, status: 'enabled' }, 'NAME\nSUPABASE_URL', /only returns the signing secret at creation/],
    [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: ['email.delivered'], status: 'enabled' }, 'NAME\nWEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET', /missing events email\.bounced, email\.complained/],
    [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS, status: 'disabled' }, 'NAME\nWEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET', /is disabled/],
  ]) {
    const h = harness({ hooks: [hook], secretNames: names })
    await assert.rejects(run(h.deps(['--apply'])), (error) => error instanceof Stop && pattern.test(error.message) && /Nothing was changed/.test(error.message))
    assert.deepEqual(mutating(h.calls), [])
    assert.deepEqual(h.stored, [])
  }
})

test('a failure after the key is created keeps the stored key and reports a clean Stop without secrets', async () => {
  const h = harness({ failOn: 'POST /webhooks' })
  await assert.rejects(run(h.deps(['--apply'])), (error) => {
    assert.ok(error instanceof Stop)
    assert.match(error.message, /POST \/webhooks failed: HTTP 422 validation_error — nope/)
    assert.ok(!error.message.includes(SETUP_KEY) && !error.message.includes(SENDING_TOKEN))
    return true
  })
  assert.deepEqual(h.stored, [`WEBSITE_ENQUIRY_RESEND_API_KEY=${SENDING_TOKEN}\n`])
})

test('--switch-provider waits for a verified domain, then sets only PROVIDER and FROM', async () => {
  const pending = harness({ domains: [{ id: 'dom_1', name: DOMAIN, status: 'pending', region: REGION }], secretNames: 'NAME\nWEBSITE_ENQUIRY_RESEND_API_KEY\nWEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET', hooks: [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS, status: 'enabled' }], domainStatus: 'pending' })
  await run(pending.deps(['--apply', '--switch-provider']))
  assert.deepEqual(mutating(pending.calls).map((call) => call.path), ['/domains/dom_1/verify'])
  assert.deepEqual(pending.stored, [])
  assert.match(pending.logs.join('\n'), /not switched: domain status is pending/)

  const verified = harness({ domains: [{ id: 'dom_1', name: DOMAIN, status: 'verified', region: REGION }], secretNames: 'NAME\nWEBSITE_ENQUIRY_RESEND_API_KEY\nWEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET', hooks: [{ id: 'hook_1', endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS, status: 'enabled' }], domainStatus: 'verified' })
  await run(verified.deps(['--apply', '--switch-provider']))
  assert.deepEqual(verified.stored, [`WEBSITE_ENQUIRY_EMAIL_PROVIDER=resend\nWEBSITE_ENQUIRY_EMAIL_FROM="${FROM_HEADER}"\n`])
  assert.ok(!verified.stored.join('').includes('WEBSITE_ENQUIRY_EMAIL_ENABLED'))

  // Without --apply nothing is switched even when verified.
  const dry = harness({ domains: [{ id: 'dom_1', name: DOMAIN, status: 'verified', region: REGION }], domainStatus: 'verified' })
  await run(dry.deps(['--switch-provider']))
  assert.deepEqual(dry.stored, [])
  assert.deepEqual(mutating(dry.calls), [])
})

test('CLI exits 2 with a clear STOP and no network when the setup key is absent', async () => {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const script = fileURLToPath(new URL('../scripts/ops/resend-bridge-setup.mjs', import.meta.url))
  const env = { ...process.env }
  delete env.RESEND_SETUP_API_KEY
  const result = spawnSync(process.execPath, [script, '--apply'], { env, encoding: 'utf8' })
  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stderr, /^STOP: RESEND_SETUP_API_KEY is missing/m)
})
