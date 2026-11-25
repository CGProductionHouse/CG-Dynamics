import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

let server, oauth, cryptoStore, queue, configModule, frontend, supabase, refresher
const ids = { state: '11111111-1111-4111-8111-111111111111', client: '22222222-2222-4222-8222-222222222222', connection: '33333333-3333-4333-8333-333333333333', actor: '44444444-4444-4444-8444-444444444444' }
const config = { appId: '123456', appSecret: 'fixture-only-secret', redirectUri: 'https://fixture.supabase.co/functions/v1/tiktok-business-oauth-callback', key: Buffer.alloc(32, 7).toString('base64'), keyVersion: 'v1', appUrl: 'https://www.cgdynamics.co.za' }
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error', define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-only') } })
  oauth = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessOAuth.ts')
  cryptoStore = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessTokenStorage.ts')
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
  configModule = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessOAuthConfig.ts')
  refresher = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessRefresh.ts')
  frontend = await server.ssrLoadModule('/src/lib/tiktokBusiness.ts')
  ;({ supabase } = await server.ssrLoadModule('/src/lib/supabase.ts'))
})
after(async () => server?.close())

function fixture() {
  let prepared, used = false, saved, calls = []
  const state = { id: ids.state, client_id: ids.client, connection_id: ids.connection, requested_by: ids.actor, expected_handle: 'cgproductionhouse' }
  const store = {
    async prepare(input) { prepared = input; return true },
    async consume(hash) { if (used || hash !== prepared.stateHash) return null; used = true; return state },
    async complete(input) { saved = input; return true },
  }
  const token = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', open_id: 'business-app-specific-id', token_type: 'Bearer', scope: oauth.TIKTOK_BUSINESS_SCOPES.join(','), expires_in: 86400, refresh_token_expires_in: 31536000 }
  const profile = { username: 'cgproductionhouse', display_name: 'CG Production House' }
  const fetcher = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ code: 0, data: calls.length === 1 ? token : profile }), { status: 200 }) }
  return { store, state, token, profile, fetcher, calls, saved: () => saved, prepared: () => prepared }
}
async function start(f) {
  const result = new URL(await oauth.startBusinessOAuth(config, f.store, { clientId: ids.client, connectionId: ids.connection, actorId: ids.actor, expectedHandle: '@CGProductionHouse', confirmExactAccount: true }))
  const callback = new URL(config.redirectUri); callback.search = new URLSearchParams({ state: result.searchParams.get('state'), code: 'fixture-code' }).toString()
  return { result, callback }
}

test('Business OAuth uses approved account-holder path, hashed 256-bit state and exact explicit account', async () => {
  const f = fixture(), { result } = await start(f)
  assert.equal(result.origin, 'https://www.tiktok.com'); assert.equal(result.pathname, '/v2/auth/authorize/')
  assert.equal(result.searchParams.get('client_key'), config.appId)
  assert.equal(result.searchParams.get('redirect_uri'), config.redirectUri)
  assert.equal(result.searchParams.get('scope'), oauth.TIKTOK_BUSINESS_SCOPES.join(','))
  assert.match(result.searchParams.get('state'), /^[a-f0-9]{64}$/)
  assert.notEqual(f.prepared().stateHash, result.searchParams.get('state'))
  assert.equal(f.prepared().handle, 'cgproductionhouse')
  assert.ok(Date.parse(f.prepared().expiresAt) <= Date.now() + 300001)
  await assert.rejects(oauth.startBusinessOAuth(config, f.store, { clientId: ids.client, connectionId: ids.connection, actorId: ids.actor, expectedHandle: 'other', confirmExactAccount: false }))
})

test('actual Business exchange uses auth_code, checks exact profile and stores only kind/account-bound ciphertext', async () => {
  const f = fixture(), { callback } = await start(f)
  assert.deepEqual(await oauth.finishBusinessOAuth(config, f.store, callback, f.fetcher), { clientId: ids.client, connectionId: ids.connection, handle: 'cgproductionhouse' })
  const body = JSON.parse(f.calls[0].init.body)
  assert.equal(body.auth_code, 'fixture-code'); assert.equal(body.code, undefined)
  assert.equal(body.redirect_uri, config.redirectUri)
  assert.equal(f.calls[0].url, 'https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/')
  const profileUrl = new URL(f.calls[1].url)
  assert.equal(profileUrl.searchParams.get('business_id'), f.token.open_id)
  assert.deepEqual(JSON.parse(profileUrl.searchParams.get('fields')), ['username', 'display_name'])
  const saved = f.saved()
  assert.ok(!JSON.stringify(saved).includes('fixture-access') && !JSON.stringify(saved).includes('fixture-refresh'))
  assert.match(saved.access, /^cg-tiktok-business-token:v1:/)
  assert.equal((await cryptoStore.readTiktokBusinessStoredToken(saved.access, `${ids.connection}:access`, config.key, 'v1')).accessToken, f.token.access_token)
  await assert.rejects(cryptoStore.readTiktokBusinessStoredToken(saved.access, `${ids.connection}:refresh`, config.key, 'v1'))
  await assert.rejects(cryptoStore.readTiktokBusinessStoredToken(saved.access, `${ids.actor}:access`, config.key, 'v1'))
  await assert.rejects(cryptoStore.readTiktokBusinessStoredToken(f.token.access_token, `${ids.connection}:access`, config.key, 'v1'))
  const count = f.calls.length
  assert.equal(await oauth.finishBusinessOAuth(config, f.store, callback, f.fetcher), false)
  assert.equal(f.calls.length, count, 'replayed state must never exchange the code again')
})

test('wrong account, missing scopes, denial and expired/foreign state never persist or replace a connection', async () => {
  for (const mode of ['wrong-account', 'missing-scope', 'bad-expiry', 'denied', 'foreign-state', 'conflicting-code', 'state-write-failure']) {
    const f = fixture(), { callback } = await start(f)
    if (mode === 'wrong-account') f.profile.username = 'anotherclient'
    if (mode === 'missing-scope') f.token.scope = 'user.info.basic'
    if (mode === 'bad-expiry') f.token.expires_in = -1
    if (mode === 'denied') callback.searchParams.set('error', 'access_denied')
    if (mode === 'foreign-state') callback.searchParams.set('state', 'f'.repeat(64))
    if (mode === 'conflicting-code') callback.searchParams.set('auth_code', 'different')
    if (mode === 'state-write-failure') f.store.consume = async () => null
    assert.equal(await oauth.finishBusinessOAuth(config, f.store, callback, f.fetcher), false, mode)
    assert.equal(f.saved(), undefined, mode)
  }
})

test('token exchange ambiguity is not retried and unsafe configuration never prepares state', async () => {
  const f = fixture(), { callback } = await start(f)
  let calls = 0
  await assert.rejects(oauth.finishBusinessOAuth(config, f.store, callback, async () => { calls++; throw new Error('timeout after acceptance') }))
  assert.equal(await oauth.finishBusinessOAuth(config, f.store, callback, f.fetcher), false)
  assert.equal(calls, 1)
  for (const bad of [{ key: '' }, { redirectUri: 'http://fixture.invalid/callback' }, { appUrl: 'https://foreign.example/path?code=leak' }]) {
    let writes = 0
    await assert.rejects(oauth.startBusinessOAuth({ ...config, ...bad }, { ...f.store, prepare: async () => { writes++; return true } }, { clientId: ids.client, connectionId: ids.connection, actorId: ids.actor, expectedHandle: 'cgproductionhouse', confirmExactAccount: true }))
    assert.equal(writes, 0)
  }
  assert.throws(() => configModule.businessOAuthConfig(n => n === 'SUPABASE_URL' ? 'https://fixture.supabase.co' : 'https://foreign.example/functions/v1/tiktok-business-oauth-callback'))
})

function entrypoint(path, modules, env) {
  let handler
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, URL, Response, Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } },
    require: name => { const match = Object.entries(modules).find(([key]) => name.includes(key)); if (!match) throw new Error('Unstubbed module'); return match[1] },
  })
  return handler
}
test('actual callback is gated and returns only fixed clean result URLs, never OAuth data', async () => {
  let callbackCalls = 0
  const modules = { 'supabase-js': { createClient: () => ({}) }, 'tiktokBusinessOAuthConfig': { businessOAuthConfig: () => config }, 'tiktokBusinessOAuthStore': { businessOAuthStore: () => ({}) }, 'tiktokBusinessOAuth.ts': { finishBusinessOAuth: async () => { callbackCalls++; return { clientId: ids.client } } } }
  const path = 'supabase/functions/tiktok-business-oauth-callback/index.ts'
  const req = new Request(`${config.redirectUri}?code=fixture-private-code&state=fixture-private-state`)
  assert.equal((await entrypoint(path, modules, {})(req)).status, 503)
  assert.equal(callbackCalls, 0)
  const result = await entrypoint(path, modules, { TIKTOK_BUSINESS_OAUTH_ENABLED: 'true', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only', SUPABASE_URL: 'https://fixture.supabase.co' })(req)
  assert.equal(result.status, 303); assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(result.headers.get('Location'), `https://www.cgdynamics.co.za/admin/integrations/tiktok?business=connected&client=${ids.client}`)
  assert.equal(await result.text(), '')
})

test('actual OAuth start checks authorization and rollout before storing a state and ignores caller actor IDs', async () => {
  let calls = 0, authorized = false
  const modules = {
    'auth.ts': { requireAdminOrManager: async () => authorized ? { ok: true, value: { user: { id: ids.actor }, supabase: {} } } : { ok: false, status: 403, error: 'Denied' } },
    'cors.ts': { corsHeaders: {}, jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }) },
    'tiktokBusinessOAuthConfig': { businessOAuthConfig: () => config }, 'tiktokBusinessOAuthStore': { businessOAuthStore: () => ({}) },
    'tiktokBusinessOAuth.ts': { startBusinessOAuth: async (_config, _store, input) => { calls++; assert.equal(input.actorId, ids.actor); return 'https://www.tiktok.com/fixture-only' } },
  }
  const path = 'supabase/functions/tiktok-business-oauth-start/index.ts'
  const request = () => new Request('https://fixture.invalid/start', { method: 'POST', body: JSON.stringify({ clientId: ids.client, connectionId: ids.connection, expectedHandle: 'fixture', confirmExactAccount: true, actorId: 'untrusted' }) })
  assert.equal((await entrypoint(path, modules, {})(request())).status, 403)
  authorized = true
  assert.equal((await entrypoint(path, modules, {})(request())).status, 409); assert.equal(calls, 0)
  const response = await entrypoint(path, modules, { TIKTOK_BUSINESS_OAUTH_ENABLED: 'true' })(request())
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls, 1)
})

test('actual Business status entrypoint checks exact client/account and never exposes a refresh fence or credential', async () => {
  let active = true, refreshes = 0
  const row = { id: ids.state, client_id: ids.client, connection_id: ids.connection, status: 'connected', account_handle: 'fixture', token_expires_at: new Date(Date.now() - 1000).toISOString(), granted_permissions: ['video.publish'], refresh_fence: 'private-fence-fixture', access_token: 'must-never-escape' }
  const sb = { from(table) { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: table === 'profiles' ? { is_active: active } : table === 'tiktok_business_authorizations' ? row : { id: ids.client } } } } } }
  const modules = { 'auth.ts': { requireAdminOrManager: async () => ({ ok: true, value: { user: { id: ids.actor }, supabase: sb } }) },
    'cors.ts': { corsHeaders: {}, jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }) },
    'tiktokBusinessOAuthConfig': { businessOAuthConfig: () => config }, 'tiktokBusinessRefresh': { refreshBusinessAuthorization: async () => { refreshes++; row.token_expires_at = new Date(Date.now() + 3600000).toISOString(); row.refresh_fence = null } } }
  const handler = entrypoint('supabase/functions/tiktok-business-connection-status/index.ts', modules, { TIKTOK_BUSINESS_OAUTH_ENABLED: 'true' })
  const request = () => new Request('https://fixture.invalid/status', { method: 'POST', body: JSON.stringify({ clientId: ids.client, connectionId: ids.connection }) })
  active = false
  assert.equal((await handler(request())).status, 403); assert.equal(refreshes, 0)
  active = true
  const response = await handler(request()), text = await response.text()
  assert.equal(response.status, 200); assert.equal(refreshes, 1)
  assert.equal(text.includes('must-never-escape'), false); assert.equal(text.includes('private-fence-fixture'), false)
  assert.equal(JSON.parse(text).data.refresh_pending, false)
})

test('queue runner never submits resumed attempts or disabled/unregistered providers', async () => {
  for (const state of ['queued', 'submitting', 'processing']) {
    let submits = 0, reconciles = 0, saved
    const sb = { async rpc(name, args) {
      if (name === 'claim_social_publication') return { data: { key: 'key', fence: 'fence', state, intent: { key: 'key' }, observation: { operationId: 'existing-provider-operation' }, attempt: 1 }, error: null }
      if (name === 'save_social_publication') { saved = args.p_observation; return { data: true, error: null } }
      throw new Error('Unexpected RPC')
    } }
    const bindings = { async submit() { submits++; }, async reconcile() { reconciles++; return { state: 'processing', operationId: 'existing-provider-operation' } } }
    await queue.runClaimedSocialPublication({ sb, jobId: ids.state, worker: 'worker', key: 'key', enabled: false, bindings, now: new Date().toISOString() })
    assert.equal(submits, 0); assert.equal(saved.state, state === 'queued' ? 'blocked' : 'unknown_outcome')
    if (state !== 'queued') {
      await queue.runClaimedSocialPublication({ sb, jobId: ids.state, worker: 'worker', key: 'key', enabled: true, bindings, now: new Date().toISOString() })
      assert.equal(submits, 0); assert.equal(reconciles, 1)
    }
  }
})

test('real frontend starts only explicit exact targets and rejects foreign/malformed authorization URLs', async () => {
  let calls = 0, result
  const descriptor = Object.getOwnPropertyDescriptor(supabase, 'functions')
  Object.defineProperty(supabase, 'functions', { configurable: true, value: { invoke: async (name, args) => { calls++; assert.equal(name, 'tiktok-business-oauth-start'); assert.equal(args.body.clientId, ids.client); assert.equal(args.body.connectionId, ids.connection); return result } } })
  const input = { clientId: ids.client, connectionId: ids.connection, expectedHandle: '@cgproductionhouse', confirmExactAccount: true }
  try {
    assert.equal((await frontend.startTiktokBusinessOAuth({ ...input, confirmExactAccount: false })).ok, false); assert.equal(calls, 0)
    const f = fixture(), { result: valid } = await start(f)
    for (const url of ['javascript:alert(1)', 'https://evil.invalid/authorize', valid.href.replace(encodeURIComponent(config.redirectUri), encodeURIComponent('https://foreign.invalid/callback'))]) {
      result = { data: { ok: true, url }, error: null }
      assert.equal((await frontend.startTiktokBusinessOAuth(input)).ok, false)
    }
    result = { data: { ok: true, url: valid.href }, error: null }
    assert.equal((await frontend.startTiktokBusinessOAuth(input)).url, valid.href)
    result = { data: { ok: true, url: valid.href }, error: new Error('denied') }
    assert.equal((await frontend.startTiktokBusinessOAuth(input)).ok, false)
  } finally { if (descriptor) Object.defineProperty(supabase, 'functions', descriptor); else delete supabase.functions }
})

test('real frontend treats missing/unreadable/foreign Business metadata as unavailable, never healthy', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(supabase, 'functions'); let response
  Object.defineProperty(supabase, 'functions', { configurable: true, value: { invoke: async name => { assert.equal(name, 'tiktok-business-connection-status'); return { data: { ok: !response.error, data: response.data }, error: response.error } } } })
  try {
    for (const value of [null, { client_id: 'foreign' }, { client_id: ids.client, connection_id: ids.connection }]) {
      response = { data: value, error: null }
      assert.equal((await frontend.getTiktokBusinessStatus(ids.client, ids.connection)).connected, false)
    }
    response = { data: null, error: new Error('missing rollout') }
    assert.equal((await frontend.getTiktokBusinessStatus(ids.client, ids.connection)).available, false)
    response = { data: { client_id: ids.client, connection_id: ids.connection, status: 'connected', account_handle: 'cgproductionhouse', token_expires_at: new Date(Date.now() + 60000).toISOString(), granted_permissions: ['video.publish'] }, error: null }
    assert.equal((await frontend.getTiktokBusinessStatus(ids.client, ids.connection)).connected, true)
    response.data.token_expires_at = new Date(Date.now() - 60000).toISOString()
    assert.equal((await frontend.getTiktokBusinessStatus(ids.client, ids.connection)).connected, false)
  } finally { if (descriptor) Object.defineProperty(supabase, 'functions', descriptor); else delete supabase.functions }
})

test('encrypted Business refresh is leased, preserves identity and does not retry ambiguous token rotation', async () => {
  const encrypted = await cryptoStore.encryptTiktokBusinessStoredToken('old-refresh-fixture', `${ids.connection}:refresh`, config.key, config.keyVersion)
  for (const mode of ['success', 'timeout', 'foreign-account', 'lost-fence']) {
    let claimed = false, calls = 0, saved, failures = 0
    const sb = { async rpc(name, a) {
      if (name === 'claim_tiktok_business_refresh') { if (claimed) return { data: null }; claimed = true; return { data: { id: ids.state, connectionId: ids.connection, openId: 'same-business-account', fence: ids.actor, refresh: encrypted } } }
      if (name === 'save_tiktok_business_refresh') { saved = a; return { data: mode !== 'lost-fence' } }
      if (name === 'fail_tiktok_business_refresh') { failures++; return { data: null } }
      throw new Error('Unexpected RPC')
    } }
    const fetcher = async (url, init) => {
      calls++; assert.equal(url, 'https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/')
      assert.equal(JSON.parse(init.body).grant_type, 'refresh_token')
      if (mode === 'timeout') throw new Error('accepted then timeout')
      return new Response(JSON.stringify({ code: 0, data: { open_id: mode === 'foreign-account' ? 'wrong' : 'same-business-account', access_token: 'new-access-fixture', refresh_token: 'new-refresh-fixture', scope: oauth.TIKTOK_BUSINESS_SCOPES.join(','), expires_in: 86400, refresh_token_expires_in: 31536000 } }))
    }
    assert.equal(await refresher.refreshBusinessAuthorization(sb, ids.state, config, fetcher), mode === 'success')
    assert.equal(await refresher.refreshBusinessAuthorization(sb, ids.state, config, fetcher), false)
    assert.equal(calls, 1)
    assert.equal(failures, mode === 'success' ? 0 : 1)
    if (saved) assert.ok(!JSON.stringify(saved).includes('new-access-fixture') && !JSON.stringify(saved).includes('new-refresh-fixture'))
  }
})
