import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { handleInstagramProviderCallback, verifyInstagramSignedRequest, sha256 } from '../supabase/functions/_shared/instagramProviderCallbacks.ts'
import { resolveInstagramReportingCredential } from '../supabase/functions/_shared/instagramReportingCredential.ts'

const secret = 'test-only-instagram-app-secret'
const now = new Date('2026-10-01T12:00:00Z')
const issuedAt = Math.floor(now.getTime() / 1000)
const payload = { algorithm: 'HMAC-SHA256', user_id: '90000000000000001', issued_at: issuedAt }
const appId = '1383360116973315'
const statusUrl = 'https://example.test/functions/v1/instagram-data-deletion'
const sign = (body, signingSecret = secret) => {
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url')
  return `${createHmac('sha256', signingSecret).update(encoded).digest('base64url')}.${encoded}`
}
const verify = (signedRequest, extra = {}) => verifyInstagramSignedRequest({ signedRequest, appSecret: secret, appId, kind: 'data_deletion', now, ...extra })
const post = (signedRequest, extra = {}) => new Request(statusUrl, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ signed_request: signedRequest }), ...extra,
})
function fixture() {
  const applied = []
  const receipts = new Set()
  const store = {
    async apply(kind, verified) { applied.push({ kind, verified }); receipts.add(verified.confirmationHash) },
    async status(hash) { return receipts.has(hash) ? 'completed' : null },
  }
  const config = { kind: 'data_deletion', appSecret: secret, appId, statusUrl, store, now }
  return { applied, config }
}

test('verified signed user_id remains the exact string app-scoped identity, not numeric/account fallback', async () => {
  const result = await verify(sign({ ...payload, instagram_account_id: '777', client_id: 'untrusted' }))
  assert.equal(result.appScopedUserId, payload.user_id)
  assert.equal(result.appId, appId)
  assert.match(result.requestKey, /^[a-f0-9]{64}$/)
  assert.match(result.confirmationCode, /^[a-f0-9]{64}$/)
  assert.notEqual(result.requestKey, result.confirmationCode)
  assert.equal(result.confirmationHash, await sha256(result.confirmationCode))
})

for (const [label, signed] of [
  ['unsigned', ''], ['extra separator', `${sign(payload)}.extra`], ['padded encoding', `${sign(payload)}=`],
  ['wrong app secret', sign(payload, 'wrong-secret')],
  ['tampered payload', sign(payload).replace(/.$/, x => x === 'A' ? 'B' : 'A')],
  ['short signature', `YQ.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`],
  ['non-base64url', `!.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`],
]) test(`signature fails closed: ${label}`, async () => {
  const { config, applied } = fixture()
  const response = await handleInstagramProviderCallback(post(signed), config)
  assert.ok(response.status >= 400)
  assert.equal(applied.length, 0)
  assert.doesNotMatch(await response.text(), /90000000000000001|test-only|wrong-secret/)
})

for (const [label, body] of [
  ['unsupported algorithm', { ...payload, algorithm: 'HMAC-SHA1' }],
  ['missing algorithm', { ...payload, algorithm: undefined }],
  ['missing identity', { ...payload, user_id: undefined, instagram_account_id: '777' }],
  ['numeric identity', { ...payload, user_id: 777 }], ['name identity', { ...payload, user_id: 'same_name' }],
  ['array', [payload]], ['null', null], ['missing timestamp', { ...payload, issued_at: undefined }],
  ['fraction timestamp', { ...payload, issued_at: issuedAt + 0.5 }],
  ['future timestamp', { ...payload, issued_at: issuedAt + 61 }],
  ['expired', { ...payload, expires: issuedAt }], ['bad expiry', { ...payload, expires: 'tomorrow' }],
  ['different app', { ...payload, app_id: 'different-app' }],
]) test(`verified envelope fails closed: ${label}`, async () => {
  const { config, applied } = fixture()
  assert.equal((await handleInstagramProviderCallback(post(sign(body)), config)).status, 400)
  assert.equal(applied.length, 0)
})

test('provider-delayed requests and expires=0 are valid; storage generation fencing governs replay', async () => {
  await verify(sign({ ...payload, issued_at: issuedAt - 86400 * 7, expires: 0 }))
})

test('identical payloads produce deterministic receipts; callback kinds have separate domains', async () => {
  assert.deepEqual(await verify(sign(payload)), await verify(sign(payload)))
  assert.notEqual((await verify(sign(payload))).requestKey, (await verify(sign(payload), { kind: 'deauthorize' })).requestKey)
})

test('deletion returns exactly Meta url + alphanumeric confirmation_code after storage success', async () => {
  const { config, applied } = fixture()
  const response = await handleInstagramProviderCallback(post(sign(payload)), config)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.deepEqual(Object.keys(body).sort(), ['confirmation_code', 'url'])
  assert.match(body.confirmation_code, /^[a-f0-9]{64}$/)
  assert.equal(body.url, `${statusUrl}?code=${body.confirmation_code}`)
  assert.equal(applied.length, 1)
  const status = await handleInstagramProviderCallback(new Request(body.url), config)
  assert.equal(status.status, 200)
  assert.match(await status.text(), /Request completed/)
  assert.equal(status.headers.get('referrer-policy'), 'no-referrer')
})

test('deauthorization acknowledges successful exact revoke with HTTP 200 and no identifiers', async () => {
  const { config, applied } = fixture()
  const response = await handleInstagramProviderCallback(post(sign(payload)), { ...config, kind: 'deauthorize' })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
  assert.equal(applied[0].kind, 'deauthorize')
})

test('failed storage never returns confirmation or completion', async () => {
  const { config } = fixture()
  config.store.apply = async () => { throw new Error('private SQL provider-id token details') }
  const response = await handleInstagramProviderCallback(post(sign(payload)), config)
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /private|confirmation|token|provider-id/)
})

test('GET is non-mutating and status is available only to the exact confirmation bearer', async () => {
  const { config, applied } = fixture()
  for (const suffix of ['', '?code=bad', `?code=${'a'.repeat(64)}`, `?code=${'a'.repeat(64)}&client_id=other`]) {
    assert.equal((await handleInstagramProviderCallback(new Request(statusUrl + suffix), config)).status, 404)
  }
  assert.equal(applied.length, 0)
  assert.equal((await handleInstagramProviderCallback(new Request(statusUrl), { ...config, kind: 'deauthorize' })).status, 405)
})

test('missing secret/config fails closed without consulting storage', async () => {
  const { config, applied } = fixture()
  for (const extra of [{ appSecret: undefined }, { appId: undefined }, { appId: 'bad' }, { statusUrl: 'http://example.test/status' }]) {
    assert.equal((await handleInstagramProviderCallback(post(sign(payload)), { ...config, ...extra })).status, 503)
  }
  assert.equal(applied.length, 0)
})

test('duplicate fields, query identity, oversized and JSON envelopes cannot invoke a callback', async () => {
  const { config, applied } = fixture()
  const body = `signed_request=${encodeURIComponent(sign(payload))}`
  const requests = [
    post(sign(payload), { body: `${body}&${body}` }),
    post(sign(payload), { body: `${body}&client_id=another` }),
    new Request(`${statusUrl}?user_id=other`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }),
    post(sign(payload), { body: 'x'.repeat(16385) }),
    post(sign(payload), { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signed_request: sign(payload) }) }),
  ]
  for (const req of requests) assert.ok((await handleInstagramProviderCallback(req, config)).status >= 400)
  assert.equal(applied.length, 0)
})

test('runtime uses only exact service RPCs, Instagram app secret and safe status; no provider/network mutation', () => {
  const runtime = readFileSync(new URL('../supabase/functions/_shared/instagramCallbackRuntime.ts', import.meta.url), 'utf8')
  assert.match(runtime, /INSTAGRAM_APP_SECRET/)
  assert.match(runtime, /p_app_scoped_user_id: verified.appScopedUserId/)
  assert.doesNotMatch(runtime, /fetch\(|\.from\(|META_APP_SECRET|console\./)
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')
  for (const name of ['instagram-deauthorize', 'instagram-data-deletion']) {
    assert.match(config, new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt = false`))
  }
})

for (const [label, connection, code] of [
  ['revoked', { id: 'connection-a', client_id: 'client-a', instagram_account_id: '777', status: 'revoked', confirmed_asset_id: 'asset-a' }, 'review_binding_invalid'],
  ['deleted', null, 'connection_missing'],
]) test(`${label} standalone connection cannot use a present legacy Meta token`, async () => {
  await assert.rejects(() => resolveInstagramReportingCredential({
    asset: { id: 'asset-a', clientId: 'client-a', instagramAccountId: '777', instagramConnectionId: 'connection-a', facebookPageId: null },
    metaConnectionId: 'other-meta-connection', metaBaseUrl: 'https://graph.facebook.com/v26.0', metaApiVersion: 'v26.0',
    metaUserToken: 'must-never-be-used', pageToken: null,
    loadStandalone: async () => ({ connection, token: null }),
    encryptionKeyBase64: undefined, supportedKeyVersion: undefined, instagramGraphVersion: 'v26.0', now,
  }), error => error.code === code && !error.message.includes('must-never-be-used'))
})
