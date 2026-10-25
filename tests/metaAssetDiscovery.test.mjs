import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { encryptMetaStoredToken, readMetaStoredToken } from '../supabase/functions/_shared/metaTokenStorage.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

function loadHandler(metaFetch, collectMetaAssets, role = 'admin', storedToken = 'test-user-secret', encryption = {}) {
  let handler
  const query = table => ({
    select() { return this }, eq() { return this }, order() { return this },
    async single() { return { data: { role } } },
    async limit() { return { data: table === 'meta_connections'
      ? [{ id: '11111111-1111-4111-8111-111111111111' }] : [{ encrypted_access_token: storedToken }] } },
  })
  const sb = { auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) }, from: query }
  const source = read('../supabase/functions/meta-list-assets/index.ts').replace(/^import .*$/gm, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  new Function('Deno', 'createClient', 'metaFetch', 'readMetaError', 'redact',
    'resolveMetaGraphConfig', 'jsonResponse', 'corsHeaders', 'collectMetaAssets', 'readMetaStoredToken', compiled)(
    { serve: value => { handler = value }, env: { get: name => encryption[name] ?? name } },
    () => sb, metaFetch, async () => ({ message: 'provider rejected request' }), value => value,
    () => ({ baseUrl: 'https://graph.facebook.com/v25.0' }),
    (value, status = 200) => new Response(JSON.stringify(value), { status }), {}, collectMetaAssets, readMetaStoredToken,
  )
  return handler
}

test('actual discovery decrypts only server-side; bad key returns 503 before any Meta request', async () => {
  const key = Buffer.alloc(32, 3).toString('base64')
  const stored = await encryptMetaStoredToken('test-user-secret', '11111111-1111-4111-8111-111111111111', key, 'v1')
  const encryption = { META_TOKEN_ENCRYPTION_KEY_B64: key, META_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' }
  const calls = []
  const provider = async url => { calls.push(url); return Response.json({ data: [] }) }
  const request = () => new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } })
  const handler = loadHandler(provider, await optionalCollector(), 'admin', stored, encryption)
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.equal(calls.length, 2)
  for (const url of calls) assert.equal(new URL(url).searchParams.get('access_token'), 'test-user-secret')
  const safeBody = await response.text()
  assert.doesNotMatch(safeBody, /test-user-secret|cg-meta-token:|ciphertext/)
  calls.length = 0
  const failure = await loadHandler(provider, await optionalCollector(), 'admin', stored)(request())
  assert.equal(failure.status, 503)
  assert.equal(calls.length, 0)
  assert.doesNotMatch(await failure.text(), /test-user-secret|cg-meta-token:|ciphertext/)
  for (const role of ['client', 'staff', 'team']) {
    const denied = await loadHandler(provider, await optionalCollector(), role, stored, encryption)(request())
    assert.equal(denied.status, 403)
    assert.equal(calls.length, 0)
  }
})

test('asset discovery includes Page-linked Instagram after the first 100 Pages', async () => {
  const calls = []
  const pages = Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1), name: `Page ${i + 1}` }))
  const handler = loadHandler(async rawUrl => {
    const url = new URL(rawUrl)
    calls.push(url)
    if (url.pathname.endsWith('/me/adaccounts')) return Response.json({ data: [] })
    return Response.json(url.searchParams.get('after') === 'page-two'
      ? { data: [{ id: '101', name: 'Last Page', instagram_business_account: { id: 'ig101', username: 'last_page' } }] }
      : { data: pages, paging: { next: 'https://graph.facebook.com/v25.0/me/accounts?after=page-two', cursors: { after: 'page-two' } } })
  }, await optionalCollector())
  const res = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } }))
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.pages.length, 101)
  assert.equal(body.instagramAccounts.find(row => row.id === 'ig101')?.facebookPageId, '101')
  assert.equal(body.pagesDiagnostic.available, true)
  assert.equal(body.pagesDiagnostic.complete, true)
  assert.equal(body.pagesDiagnostic.pagesFetched, 2)
  assert.equal(calls.filter(url => url.pathname.endsWith('/me/accounts')).length, 2)
  assert.ok(!JSON.stringify(body).includes('test-user-secret'))
})

async function optionalCollector() {
  try { return (await import('../supabase/functions/_shared/metaAssetDiscovery.ts')).collectMetaAssets }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return undefined; throw error }
}

const initialUrl = 'https://graph.facebook.com/v25.0/me/accounts?fields=id,name&access_token=test-user-secret&limit=100'
const nextPage = after => ({ next: `https://graph.facebook.com/v25.0/me/accounts?after=${after}`, cursors: { after } })

test('collection deduplicates stable IDs and rebuilds the original endpoint/fields', async () => {
  const collect = await optionalCollector()
  const calls = []
  const result = await collect(initialUrl, async raw => {
    const url = new URL(raw)
    calls.push(url)
    return Response.json(calls.length === 1
      ? { data: [{ id: '1', name: 'First' }], paging: nextPage('two') }
      : { data: [{ id: '1', name: 'Duplicate' }, { id: '2', name: 'Second' }] })
  })
  assert.deepEqual(result.data.map(row => row.id), ['1', '2'])
  assert.equal(result.complete, true)
  assert.equal(calls[1].searchParams.get('fields'), 'id,name')
  assert.equal(calls[1].searchParams.get('access_token'), 'test-user-secret')
  assert.equal(calls[1].searchParams.get('after'), 'two')
})

test('provider next URL supplies only its cursor, never its token or fields', async () => {
  const calls = []
  const result = await (await optionalCollector())(initialUrl, async raw => {
    const url = new URL(raw)
    calls.push(url)
    return Response.json(calls.length === 1 ? {
      data: [{ id: '1' }],
      paging: { next: 'https://graph.facebook.com/v25.0/me/accounts?after=two&access_token=untrusted-token&fields=access_token' },
    } : { data: [{ id: '2' }] })
  })
  assert.equal(result.complete, true)
  assert.equal(calls[1].searchParams.get('after'), 'two')
  assert.equal(calls[1].searchParams.get('access_token'), 'test-user-secret')
  assert.equal(calls[1].searchParams.get('fields'), 'id,name')
})

test('Meta may resolve me to a numeric ID without changing the fetched endpoint', async () => {
  for (const edge of ['accounts', 'adaccounts']) {
    const calls = []
    const url = initialUrl.replace('/accounts?', `/${edge}?`)
    const result = await (await optionalCollector())(url, async raw => {
      const requested = new URL(raw)
      calls.push(requested)
      return Response.json(calls.length === 1 ? {
        data: [{ id: '1' }],
        paging: { next: `https://graph.facebook.com/v25.0/123456789/${edge}?after=two&access_token=untrusted` },
      } : { data: [{ id: '2' }] })
    })
    assert.equal(result.complete, true)
    assert.equal(result.data.length, 2)
    assert.equal(calls[1].pathname, `/v25.0/me/${edge}`)
    assert.equal(calls[1].searchParams.get('access_token'), 'test-user-secret')
  }
})

test('handler discovers paged ad accounts without exposing unexpected provider fields', async () => {
  const calls = []
  const handler = loadHandler(async raw => {
    const url = new URL(raw)
    calls.push(url)
    if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [{ id: '1', name: 'Page', access_token: 'page-secret' }] })
    return Response.json(url.searchParams.has('after')
      ? { data: [{ id: 'act_2', name: 'Second', access_token: 'ad-secret' }] }
      : { data: [{ id: 'act_1', name: 'First' }], paging: { next: 'https://graph.facebook.com/v25.0/me/adaccounts?after=two' } })
  }, await optionalCollector())
  const body = await (await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } }))).json()
  assert.deepEqual(body.adAccounts.map(account => account.id), ['act_1', 'act_2'])
  assert.equal(body.adAccountsDiagnostic.complete, true)
  assert.equal(body.adAccountsDiagnostic.pagesFetched, 2)
  assert.equal(calls.length, 3)
  assert.ok(!JSON.stringify(body).includes('secret'))
})

for (const next of [
  'https://attacker.test/me/accounts?after=two',
  'https://graph.facebook.com/v25.0/another-page/posts?after=two',
  'https://attacker:password@graph.facebook.com/v25.0/me/accounts?after=two',
  'not a URL',
]) test(`unsafe paging target is never fetched: ${next.split('?')[0]}`, async () => {
  let calls = 0
  const result = await (await optionalCollector())(initialUrl, async () => {
    calls++
    return Response.json({ data: [{ id: '1' }], paging: { next, cursors: { after: 'two' } } })
  })
  assert.equal(calls, 1)
  assert.equal(result.complete, false)
  assert.match(result.error, /unsafe|invalid/)
  assert.ok(!result.error.includes('password'))
})

for (const after of ['', 'bad\nvalue', 'x'.repeat(4097)]) test(`unsafe cursor fails closed (${after.length} chars)`, async () => {
  const result = await (await optionalCollector())(initialUrl, async () => Response.json({
    data: [], paging: { next: 'https://graph.facebook.com/v25.0/me/accounts?after=two', cursors: { after } },
  }))
  assert.equal(result.complete, false)
  assert.match(result.error, /cursor/)
})

test('repeated cursor and page cap retain observed rows without claiming completeness', async () => {
  const collect = await optionalCollector()
  for (const maxPages of [1, 10]) {
    let calls = 0
    const result = await collect(initialUrl, async () => {
      calls++
      return Response.json({ data: [{ id: String(calls) }], paging: nextPage('same') })
    }, { maxPages })
    assert.equal(result.complete, false)
    assert.equal(calls, maxPages === 1 ? 1 : 2)
    assert.equal(result.data.length, calls)
  }
})

test('elapsed deadline prevents a provider request and raw errors never escape', async () => {
  const collect = await optionalCollector()
  let calls = 0
  const expired = await collect(initialUrl, async () => { calls++; return Response.json({ data: [] }) }, { deadline: Date.now() - 1 })
  assert.equal(calls, 0)
  assert.equal(expired.complete, false)
  const failed = await collect(initialUrl, async () => { throw new Error('access_token=secret') })
  assert.equal(failed.complete, false)
  assert.ok(!JSON.stringify(failed).includes('secret'))
})

test('discovery preserves the existing 12-second provider request allowance', async () => {
  const result = await (await optionalCollector())(initialUrl, async (_url, timeoutMs) => {
    // Deterministically model a valid collection slower than the regressed 3s
    // timeout, without a real sleep or network request.
    if (timeoutMs < 12_000) throw new Error('provider request aborted too early')
    return Response.json({ data: [{ id: 'slow-valid-page' }] })
  })
  assert.equal(result.complete, true)
  assert.equal(result.data.length, 1)
})

test('actual handler bounds retries and both collections with one request deadline', async () => {
  const calls = []
  const started = Date.now()
  const handler = loadHandler(async (url, init, timeoutMs, control) => {
    calls.push({ url, init, timeoutMs, control })
    return Response.json({ data: [] })
  }, await optionalCollector())
  await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } }))
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.timeoutMs, 12_000)
    assert.ok(call.control?.deadline >= started + 44_000)
    assert.ok(call.control.deadline <= Date.now() + 45_000)
  }
  assert.equal(calls[0].control.deadline, calls[1].control.deadline)
})

for (const data of [null, {}, { data: {} }, { data: [null] }, { data: [{ id: '' }] }]) {
  test(`malformed envelope is incomplete: ${JSON.stringify(data)}`, async () => {
    const result = await (await optionalCollector())(initialUrl, async () => Response.json(data))
    assert.equal(result.complete, false)
    assert.match(result.error, /malformed/)
  })
}

test('valid empty collection is complete; failed second page is partial', async () => {
  const collect = await optionalCollector()
  assert.equal((await collect(initialUrl, async () => Response.json({ data: [] }))).complete, true)
  let calls = 0
  const result = await collect(initialUrl, async () => ++calls === 1
    ? Response.json({ data: [{ id: '1' }], paging: nextPage('two') }) : new Response('not authorised', { status: 403 }))
  assert.equal(result.data.length, 1)
  assert.equal(result.complete, false)
  assert.equal(result.failedResponse.status, 403)
})

test('handler exposes incomplete discovery as unavailable and still permits organic-only discovery', async () => {
  const handler = loadHandler(async raw => {
    const url = new URL(raw)
    if (url.pathname.endsWith('/me/adaccounts')) return new Response('{}', { status: 403 })
    return Response.json(url.searchParams.has('after') ? { data: {} }
      : { data: [{ id: '1', name: 'First' }], paging: nextPage('two') })
  }, await optionalCollector())
  const body = await (await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } }))).json()
  assert.equal(body.pages.length, 1)
  assert.equal(body.pagesDiagnostic.available, false)
  assert.equal(body.pagesDiagnostic.complete, false)
  assert.equal(body.adAccountsDiagnostic.available, false)
  assert.equal(body.instagramAccounts.length, 0)
  assert.ok(!JSON.stringify(body).includes('test-user-secret'))
})

test('staff/client role cannot fetch or link manager-only asset inventory', async () => {
  for (const role of ['staff', 'client']) {
    let called = false
    const handler = loadHandler(async () => { called = true; return Response.json({ data: [] }) }, await optionalCollector(), role)
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer actor' } }))
    assert.equal(response.status, 403)
    assert.equal(called, false)
  }
})
