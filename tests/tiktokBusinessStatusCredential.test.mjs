import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

let server, credentials, runtime, tokens
const NOW = Date.parse('2026-11-16T17:00:00Z'), POST = '1234567890123456789'
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  credentials = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessStatusCredential.ts')
  runtime = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessStatusRuntime.ts')
  tokens = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessTokenStorage.ts')
})
after(async () => { await server?.close() })
async function fixture() {
  const ids = { client: randomUUID(), connection: randomUUID(), authorization: randomUUID() }
  const config = { appId: '123456', encryptionKey: Buffer.alloc(32, 7).toString('base64'), keyVersion: 'v1' }
  const target = { clientId: ids.client, connectionId: ids.connection, accountId: 'business-app-specific-id', route: 'tiktok_accounts' }
  const authorization = { id: ids.authorization, client_id: ids.client, connection_id: ids.connection, business_open_id: target.accountId,
    account_handle: 'cgproductionhouse', status: 'connected', granted_permissions: ['video.publish', 'user.info.username', 'video.list'],
    token_expires_at: new Date(NOW + 3600_000).toISOString(), refresh_fence: null, refresh_started_at: null, updated_at: new Date(NOW).toISOString(), publishing_eligibility: 'not_approved' }
  const encrypted = await tokens.encryptTiktokBusinessStoredToken('synthetic-business-access', `${ids.connection}:access`, config.encryptionKey, config.keyVersion)
  const tables = { clients: [{ id: ids.client, active: true }], tiktok_connections: [{ id: ids.connection, client_id: ids.client, status: 'connected', profile_deep_link: 'https://www.tiktok.com/@cgproductionhouse' }],
    tiktok_business_authorizations: [authorization], tiktok_business_authorization_tokens: [{ authorization_id: ids.authorization, access_token: encrypted, refresh_token: 'MUST NOT BE SELECTED' }] }
  const f = { ids, config, target, tables, db: [], http: [], failures: new Set(), clock: NOW,
    inspect: { app_id: config.appId, creator_id: target.accountId, scope: 'video.publish,user.info.username,video.list' }, profile: { username: 'CGProductionHouse' } }
  f.sb = { from(table) {
    const filters = []; let selected, signal
    const q = { select(columns) { selected = columns; assert.equal(columns.includes('refresh_token'), false); return q },
      eq(key, value) { filters.push([key, value]); return q }, abortSignal(s) { signal = s; assert.ok(s instanceof AbortSignal); return q },
      async maybeSingle() { f.db.push({ table, filters, selected, signal }); await f.onDb?.(table)
        const found = tables[table].filter(row => filters.every(([key, value]) => row[key] === value))
        return { error: f.failures.has(table) ? { message: 'PRIVATE SDK ERROR' } : null, data: found.length === 1 ? found[0] : null }
      } }
    return q
  } }
  f.options = { now: () => f.clock, async fetch(raw, init) {
    const url = new URL(raw); f.http.push({ url, init }); assert.equal(url.origin, 'https://business-api.tiktok.com'); assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal)
    await f.onHttp?.(url.pathname)
    if (url.pathname === '/open_api/v1.3/tt_user/token_info/get/') return Response.json({ code: 0, data: f.inspect })
    if (url.pathname === '/open_api/v1.3/business/get/') return Response.json({ code: 0, data: f.profile })
    if (url.pathname === '/open_api/v1.3/business/publish/status/') return Response.json({ code: 0, data: { status: 'PUBLISH_COMPLETE', post_ids: [POST] } })
    throw new Error('Unexpected provider path')
  } }
  return f
}
const resolve = f => credentials.resolveTikTokBusinessStatusCredential(f.sb, f.target, f.config, f.options)
const unavailable = promise => assert.rejects(promise, /^TikTokBusinessReadError: TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED$/)

test('real encrypted Business credential resolves with native app/account/scopes + exact username and canonical reread', async () => {
  const f = await fixture(), result = await resolve(f)
  assert.equal(result.accessToken, 'synthetic-business-access'); assert.equal(result.accountId, f.target.accountId)
  assert.equal(result.clientId, f.ids.client); assert.equal(result.connectionId, f.ids.connection); assert.equal(result.verifiedAt, new Date(NOW).toISOString())
  assert.deepEqual(result.grantedScopes, ['user.info.username', 'video.list', 'video.publish'])
  assert.equal(f.db.length, 8); assert.equal(f.http.length, 2)
  const [inspect, profile] = f.http
  assert.equal(inspect.init.method, 'POST'); assert.equal(inspect.url.search, '')
  assert.equal(inspect.init.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(inspect.init.body), { app_id: f.config.appId, access_token: 'synthetic-business-access' })
  assert.equal(profile.init.method, 'GET'); assert.equal(profile.init.body, undefined)
  assert.equal(profile.init.headers['Access-Token'], 'synthetic-business-access')
  assert.equal(profile.url.searchParams.get('business_id'), f.target.accountId)
  assert.deepEqual(JSON.parse(profile.url.searchParams.get('fields')), ['username'])
  assert.ok(f.http.every(c => !c.url.href.includes('synthetic-business-access')))
  assert.equal(f.tables.tiktok_business_authorizations[0].publishing_eligibility, 'not_approved')
  assert.equal(f.tables.tiktok_business_authorization_tokens[0].access_token.startsWith('cg-tiktok-business-token:v1:'), true)
})
test('private composition returns only the exact status, with no credentials in its output and no publication POST', async () => {
  const f = await fixture(), input = { ...f.target, platform: 'tiktok', providerOperationId: 'original-share-id', providerPostId: null }
  const result = await runtime.readStoredTikTokBusinessStatus(f.sb, f.config, input, f.options)
  assert.equal(result.observation.state, 'posted'); assert.equal(result.observation.postId, POST)
  assert.equal(f.http.length, 3)
  assert.equal(f.http[2].url.pathname, '/open_api/v1.3/business/publish/status/'); assert.equal(f.http[2].init.method, 'GET')
  assert.equal(JSON.stringify(result).includes('synthetic-business-access'), false); assert.equal(JSON.stringify(result).includes('encryptionKey'), false)
  assert.ok(f.http.filter(c => c.init.method === 'POST').every(c => c.url.pathname.endsWith('/token_info/get/')))
})
for (const table of ['clients', 'tiktok_connections', 'tiktok_business_authorizations', 'tiktok_business_authorization_tokens']) {
  test(`${table} read failure stops before provider inspection without SDK diagnostic leakage`, async () => {
    const f = await fixture(); f.failures.add(table)
    await unavailable(resolve(f)); assert.equal(f.http.length, 0)
  })
}
for (const [table, field, value] of [
  ['clients', 'active', false], ['clients', 'id', 'foreign'], ['tiktok_connections', 'client_id', 'foreign'], ['tiktok_connections', 'status', 'disconnected'],
  ['tiktok_connections', 'profile_deep_link', 'https://www.tiktok.com/@foreign'], ['tiktok_business_authorizations', 'id', 'invalid'],
  ['tiktok_business_authorizations', 'business_open_id', 'foreign-app-account'], ['tiktok_business_authorizations', 'client_id', 'foreign'],
  ['tiktok_business_authorizations', 'connection_id', randomUUID()], ['tiktok_business_authorizations', 'status', 'revoked'],
  ['tiktok_business_authorizations', 'status', 'needs_reauth'], ['tiktok_business_authorizations', 'account_handle', 'foreign'],
  ['tiktok_business_authorizations', 'granted_permissions', ['video.publish']], ['tiktok_business_authorizations', 'granted_permissions', ['user.info.username']],
  ['tiktok_business_authorizations', 'refresh_fence', randomUUID()], ['tiktok_business_authorizations', 'refresh_started_at', new Date(NOW).toISOString()],
  ['tiktok_business_authorizations', 'token_expires_at', new Date(NOW + 60_000).toISOString()], ['tiktok_business_authorizations', 'updated_at', 'not-an-instant'],
]) test(`canonical ${table}.${field}=${JSON.stringify(value)} cannot resolve a usable credential`, async () => {
  const f = await fixture(); f.tables[table][0][field] = value
  await unavailable(resolve(f)); assert.equal(f.http.length, 0)
})
test('short profile links are not fetched or identity-matched by display name', async () => {
  const f = await fixture(); f.tables.tiktok_connections[0].profile_deep_link = 'https://vm.tiktok.com/synthetic'
  f.profile.display_name = 'Foreign Display Name'
  assert.equal((await resolve(f)).accountId, f.target.accountId)
  assert.equal(f.http.some(c => c.url.hostname === 'vm.tiktok.com'), false)
})
for (const type of ['plaintext', 'wrong-connection-AAD', 'refresh-AAD', 'wrong-key', 'wrong-version']) test(`${type} credential is rejected before API transmission`, async () => {
  const f = await fixture(), row = f.tables.tiktok_business_authorization_tokens[0]
  if (type === 'plaintext') row.access_token = 'synthetic-business-access'
  if (type === 'wrong-connection-AAD') row.access_token = await tokens.encryptTiktokBusinessStoredToken('synthetic-business-access', `${randomUUID()}:access`, f.config.encryptionKey, 'v1')
  if (type === 'refresh-AAD') row.access_token = await tokens.encryptTiktokBusinessStoredToken('synthetic-business-access', `${f.ids.connection}:refresh`, f.config.encryptionKey, 'v1')
  if (type === 'wrong-key') f.config.encryptionKey = Buffer.alloc(32, 8).toString('base64')
  if (type === 'wrong-version') f.config.keyVersion = 'v2'
  await unavailable(resolve(f)); assert.equal(f.http.length, 0)
})
for (const change of [{ app_id: 'foreign-app' }, { creator_id: 'foreign-account' }, { scope: 'video.publish' }, { scope: 'user.info.username' },
  { scope: null }, { scope: 'video.publish,user.info.username,INVALID' }]) test(`native inspector ${JSON.stringify(change)} fails before profile/status read`, async () => {
  const f = await fixture(); Object.assign(f.inspect, change)
  await unavailable(resolve(f)); assert.equal(f.http.length, 1)
})
test('extra native grants are not silently adopted; results stay within canonical consent scope', async () => {
  const f = await fixture(); f.inspect.scope += ',comment.list'
  assert.equal((await resolve(f)).grantedScopes.includes('comment.list'), false)
  assert.equal(f.tables.tiktok_business_authorizations[0].granted_permissions.includes('comment.list'), false)
})
for (const username of ['foreign', undefined, null, 'bad handle']) test(`native username ${String(username)} cannot replace the confirmed handle`, async () => {
  const f = await fixture(); f.profile.username = username
  await unavailable(resolve(f)); assert.equal(f.http.length, 2)
})
for (const change of ['revoked', 'rotate', 'scope', 'mapping', 'client', 'refresh']) test(`concurrent ${change} is caught after provider checks`, async () => {
  const f = await fixture()
  f.onHttp = async path => {
    if (!path.endsWith('/business/get/')) return
    if (change === 'revoked') f.tables.tiktok_business_authorizations[0].status = 'revoked'
    if (change === 'rotate') f.tables.tiktok_business_authorization_tokens[0].access_token = await tokens.encryptTiktokBusinessStoredToken('replacement-synthetic', `${f.ids.connection}:access`, f.config.encryptionKey, 'v1')
    if (change === 'scope') f.tables.tiktok_business_authorizations[0].granted_permissions.push('comment.list')
    if (change === 'mapping') f.tables.tiktok_connections[0].profile_deep_link = 'https://www.tiktok.com/@foreign'
    if (change === 'client') f.tables.clients[0].active = false
    if (change === 'refresh') f.tables.tiktok_business_authorizations[0].refresh_fence = randomUUID()
  }
  await unavailable(resolve(f)); assert.equal(f.http.length, 2)
})
for (const phase of ['inspect', 'profile']) for (const failure of ['HTTP401', 'HTTP429', 'HTTP500', 'API', 'HTML', 'JSON', 'oversize', 'redirect']) {
  test(`${phase} ${failure} remains unavailable without retries or raw diagnostics`, async () => {
    const f = await fixture(), original = f.options.fetch
    f.options.fetch = async (url, init) => {
      if (url.includes(phase === 'inspect' ? '/token_info/get/' : '/business/get/')) {
        f.http.push({ url: new URL(url), init })
        if (failure.startsWith('HTTP')) return new Response('PRIVATE PROVIDER DIAGNOSTIC', { status: Number(failure.slice(4)) })
        if (failure === 'API') return Response.json({ code: 40100, message: 'PRIVATE DIAGNOSTIC', data: { scope: f.inspect.scope } })
        if (failure === 'HTML') return new Response('PRIVATE', { headers: { 'content-type': 'text/html' } })
        if (failure === 'JSON') return new Response('{', { headers: { 'content-type': 'application/json' } })
        if (failure === 'oversize') return new Response(' '.repeat(65537), { headers: { 'content-type': 'application/json' } })
        return Response.redirect('https://foreign.invalid')
      }
      return await original(url, init)
    }
    await unavailable(resolve(f)); assert.equal(f.http.length, phase === 'inspect' ? 1 : 2)
  })
}
test('cancellation/deadline blocks late SDK completion from decrypting or transmitting credentials', async () => {
  const f = await fixture(); let release
  const deferred = new Promise(resolve => { release = resolve })
  f.onDb = async () => { await deferred }; f.options.readTimeoutMs = 10
  await assert.rejects(resolve(f), /TIKTOK_READ_TIMEOUT/)
  assert.ok(f.db.every(r => r.signal.aborted))
  release(); for (let n = 0; n < 12; n++) await Promise.resolve()
  assert.equal(f.http.length, 0); assert.equal(f.db.some(r => r.table === 'tiktok_business_authorization_tokens'), false)
  const g = await fixture(), controller = new AbortController(); controller.abort(); g.options.signal = controller.signal
  await assert.rejects(resolve(g), /TIKTOK_READ_ABORTED/); assert.equal(g.db.length, 0); assert.equal(g.http.length, 0)
})
test('revocation during concrete composition prevents the final task-status GET', async () => {
  const f = await fixture(); f.onHttp = async path => { if (path.endsWith('/business/get/')) f.tables.tiktok_business_authorizations[0].status = 'revoked' }
  await unavailable(runtime.readStoredTikTokBusinessStatus(f.sb, f.config, { ...f.target, platform: 'tiktok', providerOperationId: 'original-share-id', providerPostId: null }, f.options))
  assert.equal(f.http.length, 2); assert.equal(f.http.some(c => c.url.pathname.includes('/publish/status/')), false)
})
for (const [objectName, change] of [['target', { clientId: null }], ['target', { accountId: undefined }], ['target', { route: 'consumer' }],
  ['config', { appId: 123456 }], ['config', { appId: 'not-an-app' }], ['config', { encryptionKey: 'invalid' }], ['config', { keyVersion: '' }]]) {
  test(`invalid ${objectName} ${JSON.stringify(change)} stops before SDK/provider access`, async () => {
    const f = await fixture(); Object.assign(f[objectName], change)
    await unavailable(resolve(f)); assert.equal(f.db.length, 0); assert.equal(f.http.length, 0)
  })
}
test('late token-inspector response cannot continue after deadline or leak a credential into task status', async () => {
  const f = await fixture(); let release, started
  const response = new Promise(resolve => { release = resolve }), ready = new Promise(resolve => { started = resolve })
  f.options.readTimeoutMs = 50; f.options.fetch = async (url, init) => { f.http.push({ url: new URL(url), init }); started(); return await response }
  const pending = resolve(f); await ready
  await assert.rejects(pending, /TIKTOK_READ_TIMEOUT/)
  release(Response.json({ code: 0, data: f.inspect })); for (let n = 0; n < 12; n++) await Promise.resolve()
  assert.equal(f.http.length, 1); assert.equal(f.http[0].init.signal.aborted, true)
})
test('expiry and elapsed-clock margins are rechecked before any credential can be returned', async () => {
  for (const clock of [NOW - 1, NOW + 120_000, NOW + 3600_000]) {
    const f = await fixture(); f.onHttp = async path => { if (path.endsWith('/business/get/')) f.clock = clock }
    await unavailable(resolve(f)); assert.equal(f.http.length, 2)
  }
})
for (const mode of ['HTTP', 'oversize-header']) test(`rejected ${mode} inspection response cancels its unread body`, async () => {
  const f = await fixture(); let cancelled = false
  f.options.fetch = async () => new Response(new ReadableStream({ cancel() { cancelled = true } }), {
    status: mode === 'HTTP' ? 500 : 200,
    headers: { 'content-type': 'application/json', ...(mode === 'oversize-header' ? { 'content-length': '65537' } : {}) },
  })
  await unavailable(resolve(f)); assert.equal(cancelled, true)
})
