import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

let server, policy, statusModule, transportModule
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
  statusModule = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessPublishingStatus.ts')
  transportModule = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessPublishingStatusTransport.ts')
})
after(async () => { await server?.close() })

test('Business API post_ids prove the one public post; consumer response aliases cannot replace this contract', () => {
  const result = policy.normalizePublishingObservation('tiktok', { status: 'PUBLISH_COMPLETE', post_ids: ['1234567890123456789'], operationId: 'task-synthetic' }, 'tiktok_accounts')
  assert.equal(result.state, 'posted')
  assert.equal(result.postId, '1234567890123456789')
  assert.notEqual(policy.normalizePublishingObservation('tiktok', { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['123'] }, 'tiktok_accounts').state, 'posted')
  assert.equal(policy.normalizePublishingObservation('tiktok', { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['legacy-post'] }).state, 'posted')
})

const NOW = Date.parse('2026-11-16T16:00:00Z'), POST = '1234567890123456789'
function fixture() {
  const intent = { key: 'synthetic-business-task', clientId: randomUUID(), connectionId: randomUUID(), deliverableId: randomUUID(), reviewVersionId: randomUUID(),
    platform: 'tiktok', route: 'tiktok_accounts', accountId: 'synthetic-open-id', providerOperationId: 'task~synthetic.1', providerPostId: null,
    assetPath: 'fixture/approved.mp4', assetSha256: 'a'.repeat(64), mediaType: 'video/mp4', caption: 'Synthetic copy', scheduledAt: '2026-11-17T08:00:00Z',
    authorizationId: randomUUID(), state: 'processing', attempt: 0 }
  const binding = { clientId: intent.clientId, connectionId: intent.connectionId, accountId: intent.accountId, route: 'tiktok_accounts', publishId: intent.providerOperationId }
  const credential = { ...binding, accessToken: 'synthetic-private-token', tokenValidUntil: new Date(NOW + 3600_000).toISOString(), verifiedAt: new Date(NOW).toISOString(), grantedScopes: ['video.publish'] }
  const f = { intent, binding, credential, wire: { code: 0, request_id: 'synthetic-request', data: { status: 'PUBLISH_COMPLETE', post_ids: [POST] } },
    calls: [], reads: 0, clock: NOW }
  f.port = { binding, async readStatus(signal) { f.reads++; assert.ok(signal instanceof AbortSignal); return f.wire } }
  f.config = { intent, now: () => f.clock, async resolveCredential(target, signal) {
    f.calls.push(['credential', target]); assert.ok(signal instanceof AbortSignal); return f.credential
  }, async fetch(raw, init) {
    f.calls.push(['get', new URL(raw), init]); return Response.json(f.wire)
  } }
  return f
}
const read = (f, options) => statusModule.readTikTokBusinessPublishingStatus(f.intent, f.port, options)
async function transportRead(f, options) {
  const port = await transportModule.tiktokBusinessPublishingStatusTransport(f.config)
  return await statusModule.readTikTokBusinessPublishingStatus(f.intent, port, options)
}

for (const [data, state, errorCode, interval] of [
  [{ status: 'PUBLISH_COMPLETE', post_ids: [POST] }, 'posted', undefined, null],
  [{ status: 'PUBLISH_COMPLETE' }, 'processing', 'TIKTOK_PUBLIC_POST_ID_PENDING', 180],
  [{ status: 'PUBLISH_COMPLETE', post_ids: [] }, 'processing', 'TIKTOK_PUBLIC_POST_ID_PENDING', 180],
  [{ status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [POST] }, 'processing', 'TIKTOK_PUBLIC_POST_ID_PENDING', 180],
  [{ status: 'PROCESSING_DOWNLOAD' }, 'processing', undefined, 180],
  [{ status: 'SEND_TO_USER_INBOX' }, 'unknown_outcome', 'TIKTOK_CREATOR_INBOX_ACTION_REQUIRED', null],
  [{ status: 'SENDING_TO_USER_INBOX' }, 'unknown_outcome', 'TIKTOK_STATUS_UNVERIFIED', null],
  [{ status: 'FAILED', reason: 'PRIVATE PROVIDER DIAGNOSTIC' }, 'failed', 'TIKTOK_PUBLISH_FAILED', null],
  [{ status: 'FUTURE_PROVIDER_STATE' }, 'unknown_outcome', 'TIKTOK_STATUS_UNVERIFIED', null],
]) test(`Business status ${JSON.stringify(data)} preserves truthful publication and next-read semantics`, async () => {
  const f = fixture(); f.wire.data = data
  const result = await read(f)
  assert.equal(result.observation.state, state); assert.equal(result.observation.errorCode, errorCode)
  assert.equal(result.observation.operationId, f.intent.providerOperationId); assert.equal(result.readAfterSeconds, interval)
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false); assert.equal(f.reads, 1)
})

for (const raw of [null, {}, { code: '0', data: { status: 'PUBLISH_COMPLETE', post_ids: [POST] } },
  { code: 40100, message: 'PRIVATE PROVIDER ERROR', data: { status: 'FAILED' } }, { code: 0, data: [] }]) {
  test(`unsuccessful/malformed Business envelope is unavailable, never a failed or posted publication: ${JSON.stringify(raw)}`, async () => {
    const f = fixture(); f.wire = raw
    const result = await read(f)
    assert.equal(result.observation.state, 'unknown_outcome'); assert.equal(result.observation.errorCode, 'TIKTOK_STATUS_ENVELOPE_UNVERIFIED')
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  })
}
for (const ids of [null, POST, [123], ['0'], ['not-a-post'], [POST, POST], Array.from({ length: 33 }, (_, i) => String(i + 1))]) {
  test(`invalid public-post receipt array is rejected: ${JSON.stringify(ids).slice(0, 80)}`, async () => {
    const f = fixture(); f.wire.data.post_ids = ids
    assert.equal((await read(f)).observation.errorCode, 'TIKTOK_PUBLIC_POST_IDS_UNVERIFIED')
  })
}
test('multiple public IDs are retained privately for review and never silently select the first post', async () => {
  const f = fixture(); f.wire.data.post_ids.push('2234567890123456789')
  const result = await read(f)
  assert.equal(result.observation.state, 'unknown_outcome'); assert.equal(result.observation.errorCode, 'TIKTOK_MULTIPLE_PUBLIC_POSTS_REVIEW')
  assert.equal(result.observation.postId, undefined); assert.deepEqual(result.publicPostIds, f.wire.data.post_ids)
  assert.equal(Object.isFrozen(result.publicPostIds), true)
})
test('original receipts survive conflicting status or foreign post evidence', async () => {
  for (const data of [{ status: 'FAILED' }, { status: 'PROCESSING_DOWNLOAD' }, { status: 'PUBLISH_COMPLETE' },
    { status: 'PUBLISH_COMPLETE', post_ids: ['2234567890123456789'] }]) {
    const f = fixture(); f.intent.providerPostId = POST; f.wire.data = data
    const result = await read(f)
    assert.equal(result.observation.errorCode, 'TIKTOK_RECEIPT_CONFLICT'); assert.equal(result.observation.postId, POST)
    assert.equal(result.observation.operationId, f.intent.providerOperationId)
  }
  const f = fixture(); f.wire.data.status = 'FAILED'
  assert.equal((await read(f)).observation.errorCode, 'TIKTOK_RECEIPT_CONFLICT')
})
for (const field of ['clientId', 'connectionId', 'accountId', 'route', 'publishId']) test(`foreign ${field} is blocked before reading provider status`, async () => {
  const f = fixture(); f.binding[field] = 'foreign'
  assert.equal((await read(f)).observation.errorCode, 'TIKTOK_EXACT_RECEIPT_REQUIRED'); assert.equal(f.reads, 0)
})

test('actual Business transport pins one GET, exact app-specific account/task and token header, never query credentials', async () => {
  const f = fixture(), result = await transportRead(f)
  assert.equal(result.observation.state, 'posted'); assert.equal(result.observation.postId, POST)
  assert.deepEqual(f.calls.map(c => c[0]), ['credential', 'get'])
  const [, url, init] = f.calls[1]
  assert.equal(url.origin + url.pathname, 'https://business-api.tiktok.com/open_api/v1.3/business/publish/status/')
  assert.deepEqual([...url.searchParams.keys()], ['business_id', 'publish_id'])
  assert.equal(url.searchParams.get('business_id'), f.intent.accountId); assert.equal(url.searchParams.get('publish_id'), f.intent.providerOperationId)
  assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); assert.equal(init.redirect, 'error')
  assert.equal(init.headers['Access-Token'], 'synthetic-private-token'); assert.equal(url.href.includes('private-token'), false)
  assert.equal(JSON.stringify(result).includes('private-token'), false)
})
test('opaque IDs remain data and cannot change the fixed origin/path/query fields', async () => {
  const f = fixture(); f.intent.accountId = 'id&foreign=other'; f.intent.providerOperationId = 'share/?url=https://foreign.invalid';
  f.binding.accountId = f.intent.accountId; f.credential.accountId = f.intent.accountId
  await transportRead(f)
  const url = f.calls.find(c => c[0] === 'get')[1]
  assert.equal(url.hostname, 'business-api.tiktok.com'); assert.equal(url.searchParams.size, 2)
  assert.equal(url.searchParams.get('publish_id'), f.intent.providerOperationId)
})
for (const change of [{ clientId: 'foreign' }, { connectionId: 'foreign' }, { accountId: 'foreign' }, { route: 'consumer' },
  { accessToken: 'bad token' }, { grantedScopes: ['video.list'] }, { tokenValidUntil: new Date(NOW + 60_000).toISOString() },
  { verifiedAt: new Date(NOW - 60_001).toISOString() }, { verifiedAt: new Date(NOW + 1).toISOString() }]) {
  test(`current credential ${JSON.stringify(change)} fails before GET`, async () => {
    const f = fixture(); Object.assign(f.credential, change)
    await assert.rejects(transportRead(f), /TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED/)
    assert.equal(f.calls.some(c => c[0] === 'get'), false)
  })
}
test('null/failed/stalled private credentials cannot leak diagnostics or fall back to consumer tokens', async () => {
  for (const resolver of [async () => null, async () => { throw new Error('PRIVATE TOKEN DIAGNOSTIC') }, async () => new Promise(() => {})]) {
    const f = fixture(); f.config.resolveCredential = resolver; f.config.readTimeoutMs = 5
    await assert.rejects(transportRead(f), /^TikTokBusinessReadError: TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED$/)
    assert.equal(f.calls.length, 0)
  }
})
for (const [http, code] of [[401, 'TIKTOK_READ_ACCESS_UNVERIFIED'], [403, 'TIKTOK_READ_ACCESS_UNVERIFIED'], [429, 'TIKTOK_READ_RATE_LIMITED'], [500, 'TIKTOK_READ_HTTP_UNVERIFIED'], [404, 'TIKTOK_READ_HTTP_UNVERIFIED']]) {
  test(`HTTP ${http} remains unavailable with no automatic retry`, async () => {
    const f = fixture(); let gets = 0; f.config.fetch = async () => { gets++; return new Response('PRIVATE', { status: http }) }
    const result = await transportRead(f)
    assert.equal(result.observation.state, 'unknown_outcome'); assert.equal(result.observation.errorCode, code); assert.equal(gets, 1)
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  })
}
for (const [name, response] of [
  ['HTML', () => new Response('PRIVATE', { headers: { 'content-type': 'text/html' } })],
  ['invalid JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
  ['invalid UTF8', () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } })],
  ['declared oversize', () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '65537' } })],
  ['streamed oversize', () => new Response(' '.repeat(65537), { headers: { 'content-type': 'application/json' } })],
  ['redirect', () => Response.redirect('https://foreign.invalid')],
]) test(`${name} response fails safely`, async () => {
  const f = fixture(); f.config.fetch = async () => response()
  assert.equal((await transportRead(f)).observation.state, 'unknown_outcome')
})
test('deadline and cancellation cover stalled fetch/body work and prohibit reusing a read port', async () => {
  for (const body of [false, true]) {
    const f = fixture(); f.config.readTimeoutMs = 10; let signal, cancelled = false
    f.config.fetch = async (_url, init) => { signal = init.signal; return body ? new Response(new ReadableStream({ cancel() { cancelled = true } }),
      { headers: { 'content-type': 'application/json' } }) : await new Promise(() => {}) }
    const port = await transportModule.tiktokBusinessPublishingStatusTransport(f.config)
    const result = await statusModule.readTikTokBusinessPublishingStatus(f.intent, port, { readTimeoutMs: 30 })
    assert.equal(result.observation.errorCode, 'TIKTOK_READ_TIMEOUT'); assert.equal(signal.aborted, true)
    if (body) assert.equal(cancelled, true)
    assert.equal((await statusModule.readTikTokBusinessPublishingStatus(f.intent, port)).observation.errorCode, 'TIKTOK_READ_ALREADY_USED')
  }
  const f = fixture(), controller = new AbortController(); controller.abort()
  assert.equal((await read(f, { signal: controller.signal })).observation.errorCode, 'TIKTOK_READ_ABORTED'); assert.equal(f.reads, 0)
})
test('clock/credential expiry is rechecked after body consumption, and values are pinned across caller edits', async () => {
  const f = fixture(), port = await transportModule.tiktokBusinessPublishingStatusTransport(f.config)
  f.intent.accountId = 'changed-account'; f.credential.accessToken = 'changed-token'
  const result = await statusModule.readTikTokBusinessPublishingStatus({ ...f.intent, accountId: 'synthetic-open-id' }, port)
  assert.equal(result.observation.state, 'posted')
  assert.equal(f.calls[1][1].searchParams.get('business_id'), 'synthetic-open-id'); assert.equal(f.calls[1][2].headers['Access-Token'], 'synthetic-private-token')
  const late = fixture(); late.config.fetch = async () => { late.clock = NOW + 120_000; return Response.json(late.wire) }
  assert.equal((await transportRead(late)).observation.errorCode, 'TIKTOK_READ_CREDENTIAL_RECHECK_REQUIRED')
})
test('the factory caller cancellation still prevents GET after private credential resolution', async () => {
  const f = fixture(), controller = new AbortController(); f.config.signal = controller.signal
  const port = await transportModule.tiktokBusinessPublishingStatusTransport(f.config)
  controller.abort()
  const result = await statusModule.readTikTokBusinessPublishingStatus(f.intent, port)
  assert.equal(result.observation.errorCode, 'TIKTOK_READ_ABORTED')
  assert.equal(f.calls.some(c => c[0] === 'get'), false)
})
for (const changes of [{ platform: 'instagram' }, { route: 'tiktok_consumer' }, { clientId: null }, { connectionId: 'not-a-uuid' },
  { accountId: undefined }, { accountId: 'with space' }, { providerOperationId: null }, { providerOperationId: 'bad\nreceipt' }, { providerPostId: 'foreign' }]) {
  test(`malformed exact receipt stops before resolving credentials: ${JSON.stringify(changes)}`, async () => {
    const f = fixture(); Object.assign(f.intent, changes)
    assert.equal((await read(f)).observation.errorCode, 'TIKTOK_EXACT_RECEIPT_REQUIRED'); assert.equal(f.reads, 0)
    await assert.rejects(transportRead(f), /TIKTOK_EXACT_RECEIPT_REQUIRED/); assert.equal(f.calls.length, 0)
  })
}
test('arbitrary private exceptions are sanitized and cannot become provider error codes', async () => {
  const f = fixture(); f.port.readStatus = async () => { throw new Error('PRIVATE TOKEN') }
  assert.equal((await read(f)).observation.errorCode, 'TIKTOK_STATUS_READ_UNAVAILABLE')
  f.port.readStatus = async () => { throw new statusModule.TikTokBusinessReadError('PRIVATE TOKEN') }
  assert.equal((await read(f)).observation.errorCode, 'TIKTOK_STATUS_READ_UNAVAILABLE')
})
test('caller cancellation reaches a stalled body after the GET has started', async () => {
  const f = fixture(), controller = new AbortController(); f.config.signal = controller.signal
  let started, cancelled = false; const ready = new Promise(resolve => { started = resolve })
  f.config.fetch = async () => new Response(new ReadableStream({ pull() { started() }, cancel() { cancelled = true } }, { highWaterMark: 0 }), { headers: { 'content-type': 'application/json' } })
  const port = await transportModule.tiktokBusinessPublishingStatusTransport(f.config)
  const pending = statusModule.readTikTokBusinessPublishingStatus(f.intent, port)
  await ready; controller.abort()
  assert.equal((await pending).observation.errorCode, 'TIKTOK_READ_ABORTED')
  assert.equal(cancelled, true)
})
