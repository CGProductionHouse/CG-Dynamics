import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exchangeMetaCodeForLongLivedToken } from '../supabase/functions/_shared/metaLongLivedToken.ts'

const NOW = Date.parse('2026-11-24T10:00:00Z')
const config = () => ({ graphBaseUrl: 'https://graph.facebook.com/v27.0', appId: '123456', appSecret: 'fixture-app-secret',
  redirectUri: 'https://fixture.supabase.co/functions/v1/meta-oauth-callback', code: 'fixture-one-use-code' })
const short = { access_token: 'fixture-short-token' }
const long = { access_token: 'fixture-long-token', token_type: 'bearer', expires_in: 5_184_000 }
const safe = error => {
  assert.equal(error.message, 'Meta long-lived token exchange is unavailable.')
  assert.doesNotMatch(JSON.stringify(error) + String(error), /fixture-|https:|PRIVATE/)
  assert.equal(error.cause, undefined)
  return true
}
function fixture(first = short, second = long) {
  const calls = []
  return { calls, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init })
    const body = calls.length === 1 ? first : second
    if (body instanceof Error) throw body
    return body instanceof Response ? body : Response.json(body)
  } }
}

test('code and long-lived grants are separate one-shot server requests; only final credential is returned', async () => {
  const f = fixture(), input = config()
  const result = await exchangeMetaCodeForLongLivedToken(input, { fetch: f.fetch, now: () => NOW })
  assert.deepEqual(result, { accessToken: long.access_token, expiresAt: new Date(NOW + long.expires_in * 1000).toISOString() })
  assert.equal(f.calls.length, 2)
  const [code, exchange] = f.calls
  assert.equal(code.init.method, 'POST'); assert.equal(code.url.search, '')
  const initial = new URLSearchParams(code.init.body)
  assert.equal(initial.get('code'), input.code); assert.equal(initial.get('redirect_uri'), input.redirectUri)
  assert.equal(exchange.init.method, 'GET'); assert.equal(exchange.init.body, undefined)
  assert.equal(exchange.url.searchParams.get('grant_type'), 'fb_exchange_token')
  assert.equal(exchange.url.searchParams.get('fb_exchange_token'), short.access_token)
  assert.equal(exchange.url.searchParams.has('code'), false)
  for (const call of f.calls) {
    assert.equal(call.url.origin, 'https://graph.facebook.com'); assert.equal(call.url.pathname, '/v27.0/oauth/access_token')
    assert.equal(call.init.redirect, 'error'); assert.ok(call.init.signal instanceof AbortSignal)
    const params = call.init.body ? new URLSearchParams(call.init.body) : call.url.searchParams
    assert.equal(params.get('client_id'), input.appId); assert.equal(params.get('client_secret'), input.appSecret)
    assert.equal(params.has('scope'), false)
  }
})

test('invalid server targets and missing configuration stop before any provider request', async () => {
  for (const change of [{ graphBaseUrl: 'https://evil.invalid/v27.0' }, { graphBaseUrl: 'https://graph.facebook.com/v27.0?x=1' },
    { graphBaseUrl: 'http://graph.facebook.com/v27.0' }, { appId: 'client-name' }, { appSecret: '' }, { code: 'two codes' },
    { code: '' }, { redirectUri: 'https://user:password@fixture.invalid/callback' }, { redirectUri: 'https://fixture.invalid/callback#fragment' }]) {
    const f = fixture()
    await assert.rejects(exchangeMetaCodeForLongLivedToken({ ...config(), ...change }, { fetch: f.fetch }), safe)
    assert.equal(f.calls.length, 0)
  }
})

test('failed or malformed code exchange cannot trigger the second grant', async () => {
  for (const first of [{}, [], null, { access_token: 'two tokens' }, { access_token: short.access_token, error: { message: 'PRIVATE' } },
    new Response('PRIVATE', { status: 400 }), new Response('not-json'), new Error('PRIVATE https://fixture-app-secret')]) {
    const f = fixture(first)
    await assert.rejects(exchangeMetaCodeForLongLivedToken(config(), { fetch: f.fetch, now: () => NOW }), safe)
    assert.equal(f.calls.length, 1)
  }
})

test('malformed or expired long-lived lifetime never falls back to the short credential', async () => {
  for (const change of [{ expires_in: -60 }, { expires_in: 120 }, { expires_in: '0' },
    { expires_in: 1.5 }, { expires_in: '1e6' }, { expires_in: ' 3600' }, { expires_in: '03600' }, { expires_in: Number.MAX_SAFE_INTEGER },
    { token_type: undefined }, { token_type: 'PAGE' }, { access_token: '' }, { access_token: 123 }]) {
    const f = fixture(short, { ...long, ...change })
    await assert.rejects(exchangeMetaCodeForLongLivedToken(config(), { fetch: f.fetch, now: () => NOW }), safe)
    assert.equal(f.calls.length, 2)
  }
})

test('absent relative lifetime returns only an unqualified private credential for mandatory native verification', async () => {
  for (const expires_in of [undefined, null, 0]) {
    const f = fixture(short, { ...long, expires_in })
    assert.deepEqual(await exchangeMetaCodeForLongLivedToken(config(), { fetch: f.fetch, now: () => NOW }), { accessToken: long.access_token, expiresAt: null })
  }
})

test('second-grant rejection, throttling or ambiguous acceptance is sanitized and never retried', async () => {
  for (const response of [new Response('PRIVATE', { status: 429 }), new Response('PRIVATE', { status: 500 }),
    new Response('not-json'), { error: { message: 'PRIVATE fixture-short-token' } }, new Error('lost after acceptance PRIVATE')]) {
    const f = fixture(short, response)
    await assert.rejects(exchangeMetaCodeForLongLivedToken(config(), { fetch: f.fetch, now: () => NOW }), safe)
    assert.equal(f.calls.length, 2)
  }
})

test('expiry is conservative across transport delays, rejects backwards clocks and accepts canonical numeric lifetime', async () => {
  const f = fixture(short, { ...long, expires_in: '3600' }); let clock = NOW
  const result = await exchangeMetaCodeForLongLivedToken(config(), { now: () => clock, fetch: async (...args) => {
    const response = await f.fetch(...args); if (f.calls.length === 2) clock += 60_000; return response
  } })
  assert.equal(result.expiresAt, new Date(NOW + 3_600_000).toISOString())
  for (const completed of [NOW - 1, NOW + 3_500_000, NaN]) {
    const g = fixture(short, { ...long, expires_in: 3600 }); let reads = 0
    await assert.rejects(exchangeMetaCodeForLongLivedToken(config(), { fetch: g.fetch, now: () => ++reads === 1 ? NOW : completed }), safe)
  }
})
