import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

let server, status, transport
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  status = await server.ssrLoadModule('/supabase/functions/_shared/linkedInPhotoStatus.ts')
  transport = await server.ssrLoadModule('/supabase/functions/_shared/linkedInPhotoReadTransport.ts')
})
after(async () => { await server?.close() })
const NOW = Date.parse('2026-11-16T12:00:00Z')
function fixture() {
  const intent = { key: 'fixture', platform: 'linkedin', route: 'linkedin_organization', clientId: randomUUID(), connectionId: randomUUID(), accountId: 'urn:li:organization:123',
    deliverableId: randomUUID(), reviewVersionId: randomUUID(), assetPath: 'fixture/original.jpg', assetSha256: 'a'.repeat(64), mediaType: 'image/jpeg', caption: 'Exact approved café caption',
    scheduledAt: new Date(NOW - 60_000).toISOString(), authorizationId: randomUUID(), state: 'processing', attempt: 1,
    providerOperationId: 'urn:li:image:Fixture_123', providerPostId: 'urn:li:ugcPost:456' }
  const author = { id: intent.providerPostId, author: intent.accountId, commentary: intent.caption, lifecycleState: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: NOW - 1000,
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { id: intent.providerOperationId } } }
  const reader = structuredClone(author), image = { id: intent.providerOperationId, owner: intent.accountId, status: 'AVAILABLE', downloadUrl: 'https://PRIVATE.invalid/token' }
  const calls = [], binding = { clientId: intent.clientId, connectionId: intent.connectionId, accountId: intent.accountId, route: intent.route }
  const port = { binding, async readPost(id, view, signal) { calls.push(['post', id, view]); assert.ok(signal instanceof AbortSignal); return view === 'AUTHOR' ? author : reader },
    async readImage(id, signal) { calls.push(['image', id]); assert.ok(signal instanceof AbortSignal); return image } }
  const clock = { value: NOW }, credential = { ...binding, accessToken: 'fixture-linkedin-token', verifiedAt: new Date(NOW).toISOString(),
    tokenValidUntil: new Date(NOW + 3600_000).toISOString(), grantedScopes: ['r_organization_social', 'w_organization_social'] }
  const fetchCalls = [], credentialCalls = []
  const config = { intent, apiVersion: '202609', now: () => clock.value, async resolveCredential(target, signal) { credentialCalls.push(target); assert.ok(signal instanceof AbortSignal); return credential },
    async fetch(raw, init) {
      const u = new URL(raw); fetchCalls.push([u, init])
      assert.equal(u.origin, 'https://api.linkedin.com'); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error')
      assert.equal(init.headers.Authorization, 'Bearer fixture-linkedin-token'); assert.equal(init.headers['LinkedIn-Version'], '202609')
      assert.equal(init.headers['X-Restli-Protocol-Version'], '2.0.0'); assert.equal(init.body, undefined)
      assert.equal(u.searchParams.has('access_token'), false)
      if (u.pathname === `/rest/posts/${encodeURIComponent(intent.providerPostId)}`) return Response.json(u.searchParams.get('viewContext') === 'AUTHOR' ? author : reader)
      if (u.pathname === `/rest/images/${encodeURIComponent(intent.providerOperationId)}`) return Response.json(image)
      throw new Error('Unexpected URL')
    } }
  return { intent, author, reader, image, calls, binding, port, config, clock, credential, fetchCalls, credentialCalls }
}
const read = f => status.readLinkedInPhotoStatus(f.intent, f.port, { now: () => NOW })

test('a later unpublished author edit cannot hide the verified original public reader version', async () => {
  const f = fixture(); f.author.commentary = 'Unpublished amended copy'; f.author.lifecycleState = 'DRAFT'; f.author.content.media.id = 'urn:li:image:Draft'
  assert.equal((await read(f)).state, 'posted')
})

test('reader 404 can remain processing only when the exact current author receipt confirms publication is requested', async () => {
  const f = fixture(); f.author.lifecycleState = 'PUBLISH_REQUESTED'
  const original = f.port.readPost
  const views = []
  f.port.readPost = async (...args) => { views.push(args[1]); if (args[1] === 'READER') throw new status.LinkedInReadError('LINKEDIN_PUBLIC_READER_UNAVAILABLE'); return await original(...args) }
  assert.equal((await read(f)).state, 'processing')
  assert.deepEqual(views, ['AUTHOR', 'READER'])
})

test('an older public version never proves a newer pending approved caption was published', async () => {
  const f = fixture(); f.author.lifecycleState = 'PUBLISH_REQUESTED'; f.reader.commentary = 'An older published version'
  assert.equal((await read(f)).state, 'processing')
  assert.equal(f.calls.length, 2)
})

for (const type of ['share', 'ugcPost']) test(`exact ${type} receipt requires author, public reader and image-owner checks`, async () => {
  const f = fixture(); f.intent.providerPostId = f.author.id = f.reader.id = `urn:li:${type}:456`
  const result = await read(f)
  assert.deepEqual(result, { state: 'posted', postId: f.intent.providerPostId, operationId: f.intent.providerOperationId })
  assert.deepEqual(f.calls, [['post', f.intent.providerPostId, 'AUTHOR'], ['post', f.intent.providerPostId, 'READER'], ['image', f.intent.providerOperationId]])
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
})

for (const [name, change] of [
  ['client', f => { f.binding.clientId = randomUUID() }], ['connection', f => { f.binding.connectionId = randomUUID() }],
  ['organization', f => { f.binding.accountId = 'urn:li:organization:999' }], ['route', f => { f.binding.route = 'facebook_page' }],
  ['platform', f => { f.intent.platform = 'facebook' }], ['person target', f => { f.intent.accountId = 'urn:li:person:123' }],
  ['missing post', f => { f.intent.providerPostId = null }], ['image is not a post', f => { f.intent.providerPostId = f.intent.providerOperationId }],
  ['URL instead of image', f => { f.intent.providerOperationId = 'https://PRIVATE.invalid' }], ['unsupported video', f => { f.intent.mediaType = 'video/mp4' }],
]) test(`wrong ${name} stops before provider access`, async () => {
  const f = fixture(); change(f); assert.equal((await read(f)).state, 'unknown_outcome'); assert.equal(f.calls.length, 0)
})

for (const [name, change] of [
  ['post ID', f => { f.author.id = 'urn:li:share:999' }], ['author organization', f => { f.author.author = 'urn:li:organization:999' }],
  ['provider error', f => { f.author.error = 'PRIVATE' }],
]) test(`author ${name} mismatch never reaches a public claim`, async () => {
  const f = fixture(); change(f); assert.equal((await read(f)).errorCode, 'LINKEDIN_AUTHOR_RECEIPT_UNVERIFIED'); assert.equal(f.calls.length, 1)
})

for (const [native, expected] of [['PUBLISH_REQUESTED', 'processing'], ['PROCESSING', 'processing'], ['PUBLISH_FAILED', 'failed'], ['DRAFT', 'unknown_outcome'], ['NEW_STATE', 'unknown_outcome']]) {
  test(`${native} never masquerades as published and retains existing receipts`, async () => {
    const f = fixture(); f.author.lifecycleState = f.reader.lifecycleState = native
    const result = await read(f); assert.equal(result.state, expected); assert.equal(result.postId, f.intent.providerPostId); assert.equal(f.calls.length, 2)
  })
}

for (const [name, change] of [
  ['foreign public author', f => { f.reader.author = 'urn:li:organization:999' }], ['foreign public ID', f => { f.reader.id = 'urn:li:share:999' }],
  ['old public caption', f => { f.reader.commentary = 'Old public version' }], ['old public image', f => { f.reader.content.media.id = 'urn:li:image:Old' }],
  ['private audience', f => { f.reader.visibility = 'LOGGED_IN' }], ['not public', f => { f.reader.lifecycleState = 'DRAFT' }],
  ['missing publication time', f => { delete f.reader.publishedAt }], ['future publication time', f => { f.reader.publishedAt = NOW + 30_001 }],
  ['dark post', f => { f.reader.distribution.feedDistribution = 'NONE' }], ['targeting', f => { f.reader.distribution.targetEntities = [{}] }],
  ['external distribution', f => { f.reader.distribution.thirdPartyDistributionChannels = ['OTHER'] }], ['advertising', f => { f.reader.adContext = {} }],
  ['reshare', f => { f.reader.reshareContext = {} }], ['group container', f => { f.reader.container = 'urn:li:group:123' }],
]) test(`published author view with ${name} is not a verified public photo`, async () => {
  const f = fixture(); change(f); assert.equal((await read(f)).errorCode, 'LINKEDIN_PUBLIC_READER_UNVERIFIED'); assert.equal(f.calls.length, 2)
})

for (const [name, change] of [
  ['foreign owner', f => { f.image.owner = 'urn:li:organization:999' }], ['other ID', f => { f.image.id = 'urn:li:image:Other' }],
  ['processing', f => { f.image.status = 'PROCESSING' }], ['failed processing', f => { f.image.status = 'PROCESSING_FAILED' }],
]) test(`image ${name} prevents a verified receipt`, async () => {
  const f = fixture(); change(f); assert.equal((await read(f)).errorCode, 'LINKEDIN_IMAGE_OWNER_UNVERIFIED')
})

test('input changes during reads cannot retarget the recorded organization, image or caption', async () => {
  const f = fixture(), first = f.port.readPost
  f.port.readPost = async (...args) => { const value = await first(...args); f.intent.accountId = 'urn:li:organization:999'; f.intent.caption = 'mutated'; return value }
  assert.equal((await read(f)).state, 'posted')
})

test('read failure and a nonresponsive private port are scrubbed and bounded without retry', async () => {
  const f = fixture(); f.port.readPost = async () => { f.calls.push(['failure']); throw new Error('PRIVATE TOKEN') }
  assert.equal((await read(f)).errorCode, 'LINKEDIN_STATUS_READ_UNVERIFIED'); assert.equal(f.calls.length, 1)
  let aborted = false
  f.port.readPost = async (_id, _view, signal) => { signal.addEventListener('abort', () => { aborted = true }); return await new Promise(() => {}) }
  assert.equal((await status.readLinkedInPhotoStatus(f.intent, f.port, { now: () => NOW, readTimeoutMs: 5 })).errorCode, 'LINKEDIN_READ_TIMEOUT')
  assert.equal(aborted, true)
})

test('an already-aborted bounded read never invokes its private callback', async () => {
  const controller = new AbortController(); controller.abort(); let invoked = false
  await assert.rejects(status.boundedLinkedInRead(async () => { invoked = true }, 10, controller.signal), /LINKEDIN_READ_ABORTED/)
  assert.equal(invoked, false)
})

test('real private HTTP transport composes all three GET receipts with encoded URNs and no media URL fetch', async () => {
  const f = fixture(), port = await transport.linkedInPhotoReadTransport(f.config)
  const result = await status.readLinkedInPhotoStatus(f.intent, port, { now: () => NOW })
  assert.equal(result.state, 'posted'); assert.equal(f.fetchCalls.length, 3); assert.equal(f.credentialCalls.length, 1)
  assert.equal(JSON.stringify(port).includes('token'), false); assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  await assert.rejects(port.readPost('urn:li:share:999', 'READER', new AbortController().signal), /LINKEDIN_EXACT_POST_REQUIRED/)
  await assert.rejects(port.readImage('urn:li:image:Other', new AbortController().signal), /LINKEDIN_EXACT_IMAGE_REQUIRED/)
  assert.equal(f.fetchCalls.length, 3)
})

for (const version of ['', 'latest', '202613', '202600', '202511', '202612']) test(`unreviewed or outside-window version ${version} never looks up a credential`, async () => {
  const f = fixture(); f.config.apiVersion = version
  await assert.rejects(transport.linkedInPhotoReadTransport(f.config), /LINKEDIN_API_VERSION/)
  assert.equal(f.credentialCalls.length, 0); assert.equal(f.fetchCalls.length, 0)
})

for (const [name, change] of [
  ['client', f => { f.credential.clientId = randomUUID() }], ['connection', f => { f.credential.connectionId = randomUUID() }],
  ['organization', f => { f.credential.accountId = 'urn:li:organization:999' }], ['route', f => { f.credential.route = 'facebook_page' }],
  ['stale proof', f => { f.credential.verifiedAt = new Date(NOW - 60_001).toISOString() }], ['future proof', f => { f.credential.verifiedAt = new Date(NOW + 1).toISOString() }],
  ['short token', f => { f.credential.tokenValidUntil = new Date(NOW + 60_000).toISOString() }], ['header injection', f => { f.credential.accessToken = 'PRIVATE\r\nToken' }],
  ['member grant', f => { f.credential.grantedScopes = ['r_member_social', 'w_member_social'] }],
]) test(`credential ${name} cannot authorize the private organization reader`, async () => {
  const f = fixture(); change(f); await assert.rejects(transport.linkedInPhotoReadTransport(f.config), /LINKEDIN_CURRENT_READ_CREDENTIAL_REQUIRED/)
  assert.equal(f.fetchCalls.length, 0)
})

test('post read access is separate from image read access and does not require fresh publication quota', async () => {
  const f = fixture(); f.credential.grantedScopes = ['r_organization_social']; f.author.lifecycleState = f.reader.lifecycleState = 'PUBLISH_REQUESTED'
  const port = await transport.linkedInPhotoReadTransport(f.config)
  assert.equal((await status.readLinkedInPhotoStatus(f.intent, port, { now: () => NOW })).state, 'processing')
  f.author.lifecycleState = f.reader.lifecycleState = 'PUBLISHED'
  assert.equal((await status.readLinkedInPhotoStatus(f.intent, port, { now: () => NOW })).errorCode, 'LINKEDIN_IMAGE_READ_ACCESS_REQUIRED')
  assert.equal(f.fetchCalls.length, 4)
})

test('actual HTTP reader 404 is processing only with an exact pending author, while reader 403 is unavailable', async () => {
  for (const httpStatus of [404, 403]) {
    const f = fixture(); f.author.lifecycleState = 'PUBLISH_REQUESTED'
    const fetch = f.config.fetch
    f.config.fetch = async (raw, init) => new URL(raw).searchParams.get('viewContext') === 'READER'
      ? new Response('PRIVATE', { status: httpStatus }) : await fetch(raw, init)
    const result = await status.readLinkedInPhotoStatus(f.intent, await transport.linkedInPhotoReadTransport(f.config), { now: () => NOW })
    assert.equal(result.state, httpStatus === 404 ? 'processing' : 'unknown_outcome')
    assert.equal(f.fetchCalls.length, 1); assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  }
})

test('slow credential verification uses its completion clock and current server scalars stay captured', async () => {
  const f = fixture(), original = f.config.resolveCredential
  f.config.resolveCredential = async (...args) => {
    f.clock.value += 31_000; f.credential.verifiedAt = new Date(f.clock.value).toISOString()
    f.config.apiVersion = 'latest'
    return await original(...args)
  }
  const port = await transport.linkedInPhotoReadTransport(f.config)
  f.credential.accessToken = 'mutated-private'; f.credential.grantedScopes = []
  assert.equal((await status.readLinkedInPhotoStatus(f.intent, port, { now: () => f.clock.value })).state, 'posted')
})

for (const httpStatus of [401, 403, 429, 500]) test(`HTTP ${httpStatus} is classified without retry or raw provider errors`, async () => {
  const f = fixture(); f.config.fetch = async () => { f.fetchCalls.push(['failure']); return new Response('PRIVATE', { status: httpStatus }) }
  const result = await status.readLinkedInPhotoStatus(f.intent, await transport.linkedInPhotoReadTransport(f.config), { now: () => NOW })
  assert.equal(result.state, 'unknown_outcome'); assert.equal(f.fetchCalls.length, 1); assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  assert.match(result.errorCode, /LINKEDIN_READ_(ACCESS_UNVERIFIED|RATE_LIMITED|HTTP_UNVERIFIED)/)
})

test('malformed, HTML and oversized response bodies are rejected without echo or following response URLs', async () => {
  for (const response of [() => new Response('PRIVATE', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/jsonp' } }),
    () => new Response('PRIVATE', { headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '262145' } }),
    () => new Response('x'.repeat(262145), { headers: { 'content-type': 'application/json' } })]) {
    const f = fixture(); f.config.fetch = async () => response()
    const result = await status.readLinkedInPhotoStatus(f.intent, await transport.linkedInPhotoReadTransport(f.config), { now: () => NOW })
    assert.equal(result.errorCode, 'LINKEDIN_READ_RESPONSE_UNVERIFIED')
  }
})

test('caller cancellation propagates to HTTP and expired transport proof cannot refresh or make another request', async () => {
  const f = fixture(); let signalled = false
  f.config.fetch = async (_url, init) => { init.signal.addEventListener('abort', () => { signalled = true }); return await new Promise(() => {}) }
  const port = await transport.linkedInPhotoReadTransport(f.config), controller = new AbortController()
  const pending = port.readPost(f.intent.providerPostId, 'AUTHOR', controller.signal)
  await new Promise(resolve => setTimeout(resolve, 5)); controller.abort()
  await assert.rejects(pending, /LINKEDIN_READ_ABORTED/); assert.equal(signalled, true)
  f.clock.value += 120_000
  await assert.rejects(port.readPost(f.intent.providerPostId, 'AUTHOR', new AbortController().signal), /LINKEDIN_READ_CREDENTIAL_RECHECK_REQUIRED/)
  assert.equal(f.credentialCalls.length, 1)
})
