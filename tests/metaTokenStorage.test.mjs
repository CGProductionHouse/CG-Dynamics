import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { encryptMetaStoredToken, readMetaStoredToken, validateMetaTokenEncryptionConfig } from '../supabase/functions/_shared/metaTokenStorage.ts'

const connection = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const key = Buffer.alloc(32, 1).toString('base64')
const wrongKey = Buffer.alloc(32, 2).toString('base64')
const secret = 'fixture-meta-credential-NOT-A-REAL-TOKEN'
const safe = error => error.message === 'Meta credential storage is unavailable. Contact an administrator.' && !error.message.includes(secret)

test('new Meta token storage authenticates exact connection and key version with random IVs', async () => {
  const first = await encryptMetaStoredToken(secret, connection, key, 'v1')
  const second = await encryptMetaStoredToken(secret, connection, key, 'v1')
  assert.notEqual(first, second)
  assert.ok(first.startsWith('cg-meta-token:v1:'))
  assert.ok(!first.includes(secret))
  assert.deepEqual(await readMetaStoredToken(first, connection, key, 'v1'), { accessToken: secret, encryptedAtRest: true })
  assert.deepEqual(await readMetaStoredToken(first, connection.toUpperCase(), key, 'v1'), { accessToken: secret, encryptedAtRest: true })
  for (const args of [[other, key, 'v1'], [connection, wrongKey, 'v1'], [connection, key, 'v2'], [connection, undefined, undefined]]) {
    await assert.rejects(readMetaStoredToken(first, ...args), safe)
  }
})

test('legacy reads remain honest plaintext; new writes never fall back without a valid key', async () => {
  assert.deepEqual(await readMetaStoredToken(secret, connection, undefined, undefined), { accessToken: secret, encryptedAtRest: false })
  for (const args of [[undefined, undefined], ['', 'v1'], [key, undefined], ['PRIVATE', 'v1'], [Buffer.alloc(31).toString('base64'), 'v1'], [key, 'v01']]) {
    await assert.rejects(encryptMetaStoredToken(secret, connection, ...args), safe)
  }
  for (const value of [null, '', ' two tokens ', 'cg-meta-token:v2:PRIVATE', 'cg-meta-token:v1:PRIVATE', 'cg-meta-token:v1:null', 'cg-meta-token:v1:[]']) {
    await assert.rejects(readMetaStoredToken(value, connection, key, 'v1'), safe)
  }
})

test('tampered/truncated/envelope-swapped bytes and invalid context fail without leaking data', async () => {
  const stored = await encryptMetaStoredToken(secret, connection, key, 'v1')
  const prefix = 'cg-meta-token:v1:'
  const body = JSON.parse(stored.slice(prefix.length))
  const tampered = Buffer.from(body.ciphertext, 'base64'); tampered[0] ^= 1
  for (const delta of [{ ciphertext: tampered.toString('base64') }, { ciphertext: Buffer.alloc(16).toString('base64') },
    { iv: Buffer.alloc(11).toString('base64') }, { iv: `${body.iv}\n` }, { keyVersion: 'v2' }, { ciphertext: undefined }]) {
    await assert.rejects(readMetaStoredToken(prefix + JSON.stringify({ ...body, ...delta }), connection, key, 'v1'), safe)
  }
  await assert.rejects(encryptMetaStoredToken(secret, 'not-a-connection', key, 'v1'), safe)
  await assert.rejects(encryptMetaStoredToken(stored, connection, key, 'v1'), safe)
})

test('every production Meta credential consumer uses the shared reader; OAuth has no raw-token writer', () => {
  for (const endpoint of ['meta-list-assets', 'meta-connection-status', 'meta-sync', 'meta-sync-worker']) {
    const source = readFileSync(new URL(`../supabase/functions/${endpoint}/index.ts`, import.meta.url), 'utf8')
    assert.match(source, /await readMetaStoredToken\(/, endpoint)
    assert.match(source, /META_TOKEN_ENCRYPTION_KEY_B64/)
    assert.match(source, /META_TOKEN_ENCRYPTION_KEY_VERSION/)
    assert.doesNotMatch(source, /accessToken:\s*tokenRow\.encrypted_access_token/)
    assert.doesNotMatch(source, /const accessToken(?::[^=]+)?\s*=\s*(?:tokens\[0\]|tokenRows\?\.\[0\])[^\n]*encrypted_access_token/)
  }
  const callback = readFileSync(new URL('../supabase/functions/meta-oauth-callback/index.ts', import.meta.url), 'utf8')
  assert.match(callback, /await encryptMetaStoredToken\(/)
  assert.doesNotMatch(callback, /encrypted_access_token:\s*accessToken\b/)
})

function loadEndpoint(endpoint, dependencies) {
  let handler
  const source = readFileSync(new URL(`../supabase/functions/${endpoint}/index.ts`, import.meta.url), 'utf8').replace(/^import .*$/gm, '')
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const args = { Deno: { serve: fn => { handler = fn }, env: { get: name => dependencies.env[name] } }, console: { error() {} },
    corsHeaders: {}, jsonResponse: (body, status = 200) => Response.json(body, { status }),
    readMetaStoredToken, encryptMetaStoredToken, validateMetaTokenEncryptionConfig,
    resolveMetaGraphConfig: () => ({ baseUrl: 'https://graph.facebook.com/v25.0' }), ...dependencies }
  new Function(...Object.keys(args), javascript)(...Object.values(args))
  return handler
}
const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', APP_PUBLIC_URL: 'https://app.example.test',
  META_APP_ID: 'fixture-app', META_APP_SECRET: 'fixture-secret', META_REDIRECT_URI: 'https://fixture.supabase.co/callback',
  META_TOKEN_ENCRYPTION_KEY_B64: key, META_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' }
const scopes = ['pages_show_list', 'pages_read_engagement', 'read_insights', 'instagram_basic', 'instagram_manage_insights', 'business_management']

test('actual OAuth callback stores only ciphertext, and invalid storage config causes zero DB/provider actions', async () => {
  const writes = [], calls = []
  const createClient = () => ({ from(table) {
    const query = { update(value) { writes.push({ table, value }); return query }, eq() { return query }, is() { return query }, gt() { return query }, select() { return query },
      single: async () => ({ data: { id: 'state', user_id: 'manager' }, error: null }),
      limit: async () => ({ data: [{ id: connection }] }),
      upsert: async value => { writes.push({ table, value }); return { error: null } },
      then(resolve) { return Promise.resolve({ error: null }).then(resolve) } }
    return query
  } })
  const provider = async url => { calls.push(url); return Response.json(url.includes('/oauth/') ? { access_token: secret } : { data: scopes.map(permission => ({ permission, status: 'granted' })) }) }
  const diagnostics = async () => ({ state: 'valid', tokenType: 'USER', expiresAt: '2027-01-01T00:00:00Z', grantedScopes: scopes })
  const dependencies = { env, createClient, metaFetch: provider, inspectMetaAccessToken: diagnostics }
  const request = () => new Request('https://fixture.supabase.co/callback?state=fixture-state&code=fixture-code')
  const response = await loadEndpoint('meta-oauth-callback', dependencies)(request())
  assert.equal(response.status, 302)
  assert.ok(response.headers.get('location').endsWith('?meta=connected'))
  const stored = writes.find(write => write.table === 'meta_connection_tokens').value
  assert.ok(stored.encrypted_access_token.startsWith('cg-meta-token:v1:'))
  assert.doesNotMatch(JSON.stringify(writes), new RegExp(secret))
  assert.deepEqual(await readMetaStoredToken(stored.encrypted_access_token, connection, key, 'v1'), { accessToken: secret, encryptedAtRest: true })
  writes.length = 0; calls.length = 0
  const failure = await loadEndpoint('meta-oauth-callback', { ...dependencies, env: { ...env, META_TOKEN_ENCRYPTION_KEY_B64: undefined } })(request())
  assert.ok(failure.headers.get('location').endsWith('?meta=config_error'))
  assert.equal(writes.length, 0)
  assert.equal(calls.length, 0)
})

test('actual status returns honest encrypted/plaintext metadata; wrong key causes no diagnostics or reauth writes', async () => {
  const stored = await encryptMetaStoredToken(secret, connection, key, 'v1')
  const writes = [], providerCalls = []
  function createClientFor(value, role = 'admin') {
    return () => ({ auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) }, from(table) {
      const data = table === 'meta_connections' ? [{ id: connection, scopes, status: 'connected' }]
        : table === 'meta_connection_tokens' ? [{ id: 'token', encrypted_access_token: value, validation_state: 'valid', last_validated_at: new Date().toISOString() }] : []
      const query = { select() { return query }, eq() { return query }, in() { return query }, order() { return query }, or() { return query },
        limit() { return query }, single: async () => ({ data: { role } }),
        update(row) { writes.push({ table, row }); return query }, range: async () => ({ data, error: null }),
        then(resolve) { return Promise.resolve({ data, error: null, count: 0 }).then(resolve) } }
      return query
    } })
  }
  const dependencies = { env, fetchAllRows: async () => ({ data: [], error: null }), META_TERMINAL_ACCESS_COOLDOWN_MS: 3600000,
    inspectMetaAccessToken: async () => { providerCalls.push('diagnostics'); throw new Error('must not run') } }
  const request = () => new Request('https://fixture.supabase.co/status', { method: 'POST', headers: { Authorization: 'Bearer fixture-jwt' } })
  for (const [value, encrypted] of [[stored, true], [secret, false]]) {
    const response = await loadEndpoint('meta-connection-status', { ...dependencies, createClient: createClientFor(value) })(request())
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.connected, true)
    assert.equal(body.tokenSecurity.encryptedAtRest, encrypted)
    assert.equal(body.tokenSecurity.state, encrypted ? 'server_only_encrypted' : 'server_only_plaintext')
    assert.doesNotMatch(JSON.stringify(body), /fixture-meta-credential|cg-meta-token:|ciphertext/)
  }
  const failure = await loadEndpoint('meta-connection-status', { ...dependencies, env: { ...env, META_TOKEN_ENCRYPTION_KEY_B64: wrongKey }, createClient: createClientFor(stored) })(request())
  assert.equal(failure.status, 503)
  assert.doesNotMatch(await failure.text(), /fixture-meta-credential|cg-meta-token:|ciphertext/)
  assert.equal(writes.length, 0)
  assert.equal(providerCalls.length, 0)
  for (const role of ['staff', 'team', 'client']) {
    assert.equal((await loadEndpoint('meta-connection-status', { ...dependencies, createClient: createClientFor(stored, role) })(request())).status, 403)
  }
})

test('both actual sync credential blocks decrypt before provider use and stop safely on corrupt storage', async () => {
  const stored = await encryptMetaStoredToken(secret, connection, key, 'v1')
  for (const endpoint of ['meta-sync', 'meta-sync-worker']) {
    const source = readFileSync(new URL(`../supabase/functions/${endpoint}/index.ts`, import.meta.url), 'utf8')
    const start = source.indexOf('  const { data: connections }')
    const block = source.slice(start, source.indexOf('  const { baseUrl, version: graphVersion }', start))
    const javascript = ts.transpileModule(block, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
    const run = async (value, encryptionKey) => {
      let releases = 0
      const sb = { from(table) {
        const query = { select() { return query }, eq() { return query }, order() { return query },
          limit: async () => ({ data: table === 'meta_connections' ? [{ id: connection }] : [{ encrypted_access_token: value }] }) }
        return query
      } }
      const args = { sb, readMetaStoredToken, Deno: { env: { get: name => name === 'META_TOKEN_ENCRYPTION_KEY_B64' ? encryptionKey : 'v1' } },
        steps: [], phase: '', releaseActiveLane: async () => { releases++ },
        jsonResponse: (body, status) => Response.json(body, { status }), safeJsonResponse: (body, status) => Response.json(body, { status }) }
      const result = await new Function(...Object.keys(args), `return (async () => { ${javascript}; return accessToken })()`)(...Object.values(args))
      return { result, releases }
    }
    for (const value of [stored, secret]) assert.equal((await run(value, key)).result, secret, endpoint)
    const { result, releases } = await run(stored, wrongKey)
    assert.equal(result.status, 503, endpoint)
    assert.doesNotMatch(await result.text(), /fixture-meta-credential|cg-meta-token:|ciphertext/)
    assert.equal(releases, endpoint === 'meta-sync-worker' ? 1 : 0)
  }
})
