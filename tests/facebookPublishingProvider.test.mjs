import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createHash, createHmac } from 'node:crypto'
import { publicationCodecVite } from './fixtures/publicationCodecVite.mjs'

let server, transport, media, credentials, tokens, adapter, executor
before(async () => {
  server = await createServer({ plugins: [publicationCodecVite], ssr: { external: ['jpeg-js'] }, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  transport = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublishingTransport.ts')
  media = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingMedia.ts')
  credentials = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublishingProvider.ts')
  tokens = await server.ssrLoadModule('/supabase/functions/_shared/metaTokenStorage.ts')
  adapter = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublishing.ts')
  executor = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingExecution.ts')
})
after(async () => { await server?.close() })

const NOW = Date.parse('2026-11-16T10:00:00Z')
const scopes = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement']
const image = Uint8Array.from([255, 216, 255, 10, 20, 255, 217]) // Signature fixture, not full media qualification.
const hash = b => createHash('sha256').update(b).digest('hex')
const projectUrl = 'https://fixture.supabase.co'
const intent = () => ({ key: 'fixture-intent', platform: 'facebook', route: 'facebook_page', clientId: 'client-a',
  connectionId: '11111111-1111-4111-8111-111111111111', accountId: '123', deliverableId: 'delivery-a', reviewVersionId: 'review-a',
  assetPath: 'delivery-a/review-a.jpg', assetSha256: hash(image), mediaType: 'image/jpeg', caption: 'Approved caption',
  scheduledAt: '2026-11-16T10:00:00Z', authorizationId: 'auth-a', state: 'queued', attempt: 0, providerPostId: null, providerOperationId: null })
const review = i => ({ id: i.reviewVersionId, client_id: i.clientId, deliverable_id: i.deliverableId, state: 'approved',
  asset_path: i.assetPath, media_type: i.mediaType, caption: i.caption, scheduled_at: i.scheduledAt, channels: ['facebook'] })

// Query fixture enforces every filter, so cross-client/account tests exercise the
// concrete store rather than merely checking that code contains an eq() call.
function store(rows, options = {}) {
  const events = []
  return { events, from(table) {
    const filters = []
    const q = { select() { return q }, eq(k, v) { filters.push([k, v]); return q }, async maybeSingle() {
      events.push(['query', table, filters])
      const matches = (rows[table] ?? []).filter(r => filters.every(([k, v]) => r[k] === v))
      return { data: matches.length === 1 ? matches[0] : null, error: matches.length > 1 || options.queryError === table ? { message: 'PRIVATE SDK ERROR' } : null }
    } }
    return q
  }, storage: { from(bucket) {
    assert.equal(bucket, 'content-review-snapshots')
    return { async download(path) {
      events.push(['download', path])
      return { data: options.blob ?? new Blob([image], { type: 'image/jpeg' }), error: options.downloadError }
    }, async createSignedUrl(path, seconds) {
      events.push(['sign', path, seconds])
      return { data: { signedUrl: options.url ?? `${projectUrl}/storage/v1/object/sign/content-review-snapshots/${path.split('/').map(encodeURIComponent).join('/')}?token=FIXTURE-SIGNED` }, error: options.signError }
    } }
  } } }
}

function graphFixture(options = {}) {
  const calls = []
  const fetch = async (raw, init) => {
    const url = new URL(raw); calls.push({ url, ...init })
    assert.equal(url.origin, 'https://graph.facebook.com')
    assert.equal(init.redirect, 'error')
    assert.ok(init.signal instanceof AbortSignal)
    assert.equal(url.searchParams.has('access_token'), false)
    if (options.handle) { const result = await options.handle(url, init, calls); if (result) return result }
    const path = url.pathname.replace('/v27.0', '')
    let result
    if (path === '/me/permissions') result = { data: scopes.map(permission => ({ permission, status: 'granted' })) }
    else if (path === '/me/accounts') result = { data: [{ id: '123', access_token: 'fixture-page-token', tasks: ['CREATE_CONTENT'] }] }
    else if (path === '/me') result = { id: '123' }
    else if (path === '/123/photos') result = { id: '456', post_id: '123_789' }
    else if (path === '/123_789') result = { id: '123_789', is_published: true }
    else throw new Error('Unexpected fixture route')
    return Response.json(result)
  }
  return { calls, fetch }
}
const makeTransport = (i, g, extra = {}) => transport.facebookPhotoTransport({ intent: i, graphVersion: 'v27.0', appSecret: 'fixture-app-secret',
  resolveUserToken: async () => 'fixture-user-token', approvedMediaUrl: async () => 'https://fixture.supabase.co/approved?token=FIXTURE-SIGNED',
  fetch: g.fetch, now: () => NOW, ...extra })

test('private Graph transport uses live exact Page token and proof, submits once, then reads publication', async () => {
  const i = intent(), g = graphFixture(), t = await makeTransport(i, g)
  const result = await adapter.submitFacebookPhoto(i, t)
  assert.deepEqual(result, { state: 'processing', postId: '123_789', operationId: '456' })
  const mutation = g.calls.find(c => c.method === 'POST')
  assert.equal(mutation.headers.Authorization, 'Bearer fixture-page-token')
  const body = new URLSearchParams(mutation.body)
  assert.equal(body.get('caption'), i.caption)
  assert.equal(body.get('appsecret_proof'), createHmac('sha256', 'fixture-app-secret').update('fixture-page-token').digest('hex'))
  assert.equal(body.has('access_token'), false)
  assert.equal((await adapter.readFacebookPhotoStatus({ ...i, providerPostId: result.postId }, t)).state, 'posted')
  await assert.rejects(adapter.submitFacebookPhoto(i, t), /SUBMISSION_CONTRACT_INVALID/)
  assert.equal(g.calls.filter(c => c.method === 'POST').length, 1)
  assert.equal(JSON.stringify(result).includes('token'), false)
})

for (const [name, response] of [
  ['missing publish scope', () => ({ data: [{ permission: 'pages_show_list', status: 'granted' }] })],
  ['declined publish scope', () => ({ data: scopes.map(permission => ({ permission, status: permission === 'pages_manage_posts' ? 'declined' : 'granted' })) })],
  ['foreign Page', () => ({ data: [{ id: '999', access_token: 'fixture-other', tasks: ['CREATE_CONTENT'] }] })],
  ['missing Page task', () => ({ data: [{ id: '123', access_token: 'fixture-page-token', tasks: ['ANALYZE'] }] })],
  ['duplicate Page', () => ({ data: [1, 2].map(() => ({ id: '123', access_token: 'fixture-page-token', tasks: ['CREATE_CONTENT'] })) })],
  ['wrong Page token identity', () => ({ id: '999' })],
]) test(`Graph rejects ${name} before any mutation`, async () => {
  const path = name.includes('scope') ? '/me/permissions' : name.includes('identity') ? '/me' : '/me/accounts'
  const g = graphFixture({ handle: async url => url.pathname.endsWith(path) ? Response.json(response()) : null })
  await assert.rejects(makeTransport(intent(), g))
  assert.equal(g.calls.some(c => c.method === 'POST'), false)
})

test('Page pagination uses bounded cursors on the fixed Graph host, never next URLs', async () => {
  const g = graphFixture({ handle: async url => url.pathname.endsWith('/me/accounts') && !url.searchParams.has('after')
    ? Response.json({ data: [{ id: '999' }], paging: { next: 'https://evil.invalid/?access_token=PRIVATE', cursors: { after: 'cursor-2' } } }) : null })
  await makeTransport(intent(), g)
  assert.equal(g.calls.filter(c => c.url.pathname.endsWith('/me/accounts')).length, 2)
  assert.equal(g.calls.at(-2).url.searchParams.get('after'), 'cursor-2')
  const bad = graphFixture({ handle: async url => url.pathname.endsWith('/me/accounts')
    ? Response.json({ data: [], paging: { next: 'ignored', cursors: { after: 'same' } } }) : null })
  await assert.rejects(makeTransport(intent(), bad), /PAGINATION_UNVERIFIED/)
  assert.equal(bad.calls.length, 3)
})

test('timeout after provider acceptance cannot retry a mutation or leak raw network errors', async () => {
  let posts = 0
  const g = graphFixture({ handle: async (_url, init) => { if (init.method === 'POST') { posts++; throw new Error('PRIVATE TOKEN /SIGNED URL') } } })
  const i = intent(), t = await makeTransport(i, g)
  await assert.rejects(adapter.submitFacebookPhoto(i, t), /^FacebookPublishingTransportError: FACEBOOK_RESPONSE_UNVERIFIED$/)
  await assert.rejects(adapter.submitFacebookPhoto(i, t), /CONTRACT_INVALID/)
  assert.equal(posts, 1)
})

for (const [name, result] of [
  ['HTTP error', () => Response.json({ error: { message: 'PRIVATE TOKEN' } }, { status: 429, headers: { 'Retry-After': '90' } })],
  ['Graph error inside HTTP 200', () => Response.json({ error: { message: 'PRIVATE TOKEN' } })],
  ['malformed JSON', () => new Response('PRIVATE TOKEN', { status: 200 })],
  ['redirect', () => Response.redirect('https://evil.invalid')],
]) test(`${name} is sanitized and never automatically replayed`, async () => {
  const g = graphFixture({ handle: async (_url, init) => init.method === 'POST' ? result() : null })
  const i = intent(), t = await makeTransport(i, g)
  await assert.rejects(adapter.submitFacebookPhoto(i, t), e => {
    assert.equal(e.message.includes('PRIVATE'), false)
    if (name === 'HTTP error') { assert.equal(e.httpStatus, 429); assert.equal(e.retryAfterSeconds, 90) }
    return true
  })
  assert.equal(g.calls.filter(c => c.method === 'POST').length, 1)
})

test('transport refuses arbitrary target, added fields, changed intent and stale credentials', async () => {
  const i = intent(), g = graphFixture(); let clock = NOW
  const t = await makeTransport(i, g, { now: () => clock })
  await assert.rejects(t.approvedMediaUrl({ ...i, clientId: 'other' }), /INTENT_CHANGED/)
  const url = await t.approvedMediaUrl(i)
  await assert.rejects(t.request('POST', '/999/photos', { url, caption: i.caption, published: true }), /CONTRACT_INVALID/)
  await assert.rejects(t.request('POST', '/123/photos', { url, caption: i.caption, published: true, access_token: 'other' }), /CONTRACT_INVALID/)
  await assert.rejects(t.request('GET', '/999_789', { fields: 'id,is_published,scheduled_publish_time' }), /CONTRACT_INVALID/)
  await assert.rejects(t.request('DELETE', '/123_789', { fields: 'id,is_published,scheduled_publish_time' }), /METHOD_INVALID/)
  i.accountId = '999' // Input mutation does not retarget the captured credential.
  clock += 300_000
  await assert.rejects(t.request('POST', '/123/photos', { url, caption: i.caption, published: true }), /RECHECK_REQUIRED/)
  assert.equal(g.calls.some(c => c.method === 'POST'), false)
})

test('approved snapshot uses private immutable bucket, verifies bytes, then signs only its exact path for five minutes', async () => {
  const i = intent(), sb = store({ content_review_versions: [review(i)] })
  const url = await media.approvedSnapshotDelivery(sb, projectUrl)(i)
  assert.equal(new URL(url).hostname, 'fixture.supabase.co')
  assert.deepEqual(sb.events.slice(1), [['download', i.assetPath], ['sign', i.assetPath, 300]])
})

for (const [name, mutate, options] of [
  ['foreign client', r => { r.client_id = 'client-b' }],
  ['superseded review', r => { r.state = 'superseded' }],
  ['changed path', r => { r.asset_path = 'delivery-a/other.jpg' }],
  ['changed caption', r => { r.caption = 'Unapproved' }],
  ['changed channel', r => { r.channels = ['instagram'] }],
  ['changed date', r => { r.scheduled_at = '2026-11-17T10:00:00Z' }],
  ['changed bytes', () => {}, { blob: new Blob([Uint8Array.from([255, 216, 255, 1, 255, 217])], { type: 'image/jpeg' }) }],
  ['wrong MIME', () => {}, { blob: new Blob([image], { type: 'image/png' }) }],
  ['SDK error', () => {}, { downloadError: { message: 'PRIVATE ERROR' } }],
]) test(`snapshot refuses ${name} without signing anything`, async () => {
  const i = intent(), r = review(i); mutate(r)
  const sb = store({ content_review_versions: [r] }, options)
  await assert.rejects(media.approvedSnapshotDelivery(sb, projectUrl)(i), /^Error: Approved publication snapshot unavailable\.$/)
  assert.equal(sb.events.some(e => e[0] === 'sign'), false)
})

test('snapshot rejects disguised non-image bytes even when the caller supplies their correct hash', async () => {
  const i = intent(), bytes = new TextEncoder().encode('<script>private</script>'); i.assetSha256 = hash(bytes)
  const sb = store({ content_review_versions: [review(i)] }, { blob: new Blob([bytes], { type: 'image/jpeg' }) })
  await assert.rejects(media.approvedSnapshotDelivery(sb, projectUrl)(i))
  assert.equal(sb.events.some(e => e[0] === 'sign'), false)
})

test('snapshot refuses traversal, foreign signing host/path, transformations and duplicate credentials', async () => {
  for (const path of ['delivery-a/../private.jpg', 'delivery-a/%2e%2e/private.jpg', 'other/file.jpg', 'delivery-a/a\\b.jpg']) {
    const i = { ...intent(), assetPath: path }, sb = store({ content_review_versions: [review(i)] })
    await assert.rejects(media.approvedSnapshotDelivery(sb, projectUrl)(i)); assert.equal(sb.events.length, 0)
  }
  const good = `${projectUrl}/storage/v1/object/sign/content-review-snapshots/delivery-a/review-a.jpg`
  for (const url of [`https://evil.invalid${new URL(good).pathname}?token=private`, `${good}?token=private&width=50`, `${good}?token=a&token=b`, `${good.replace('review-a', 'foreign')}?token=a`, `${good}?token=a#fragment`]) {
    const i = intent(), sb = store({ content_review_versions: [review(i)] }, { url })
    await assert.rejects(media.approvedSnapshotDelivery(sb, projectUrl)(i), /^Error: Approved publication snapshot unavailable\.$/)
  }
})

const config = { graphVersion: 'v27.0', appId: '789', appSecret: 'fixture-app-secret', projectUrl,
  encryptionKey: Buffer.alloc(32, 1).toString('base64'), keyVersion: 'v1' }
const diagnostics = () => ({ state: 'valid', tokenType: 'USER', expiresAt: new Date(NOW + 3600_000).toISOString(),
  dataAccessExpiresAt: null, validatedAt: new Date(NOW).toISOString(), grantedScopes: scopes, errorCode: null, errorReason: null })
async function credentialStore(i) {
  const encrypted = await tokens.encryptMetaStoredToken('fixture-user-token', i.connectionId, config.encryptionKey, config.keyVersion)
  return { clients: [{ id: i.clientId, active: true }], meta_client_assets: [{ id: 'asset-a', client_id: i.clientId, connection_id: i.connectionId, facebook_page_id: i.accountId, is_active: true }],
    meta_connections: [{ id: i.connectionId, status: 'connected' }], meta_connection_tokens: [{ connection_id: i.connectionId, encrypted_access_token: encrypted }] }
}
test('credential loader reuses encrypted Meta store and exact active mapping without writes', async () => {
  const i = intent(), sb = store(await credentialStore(i)); let inspected = 0
  const token = await credentials.facebookPublishingUserToken(sb, i, config, { now: () => NOW, inspect: async args => {
    inspected++; assert.equal(args.accessToken, 'fixture-user-token'); assert.equal(args.appId, '789'); return diagnostics()
  } })
  assert.equal(token, 'fixture-user-token'); assert.equal(inspected, 1)
  assert.equal(sb.events.length, 4)
})

test('narrow provider byte limit rejects a large snapshot before reading its body into memory', async () => {
  const i = intent(); let read = false
  const sb = store({ content_review_versions: [review(i)] }, { blob: { size: 10_000_000, type: 'image/jpeg', async arrayBuffer() { read = true; throw new Error('must not read') } } })
  await assert.rejects(media.inspectPublicationSnapshot(sb, i, 9_999_999)); assert.equal(read, false)
  await assert.rejects(media.inspectPublicationSnapshot(sb, i, 52_428_801))
})

for (const [name, mutate] of [
  ['foreign client mapping', r => { r.meta_client_assets[0].client_id = 'client-b' }],
  ['foreign connection mapping', r => { r.meta_client_assets[0].connection_id = 'other' }],
  ['foreign Page mapping', r => { r.meta_client_assets[0].facebook_page_id = '999' }],
  ['inactive client', r => { r.clients[0].active = false }],
  ['disconnected account', r => { r.meta_connections[0].status = 'disconnected' }],
  ['duplicate mapping', r => { r.meta_client_assets.push({ ...r.meta_client_assets[0] }) }],
  ['legacy plaintext', r => { r.meta_connection_tokens[0].encrypted_access_token = 'fixture-user-token' }],
  ['broken encryption', r => { r.meta_connection_tokens[0].encrypted_access_token = 'cg-meta-token:broken' }],
]) test(`credential loader blocks ${name} before provider access`, async () => {
  const i = intent(), rows = await credentialStore(i); mutate(rows); let called = false
  await assert.rejects(credentials.facebookPublishingUserToken(store(rows), i, config, { now: () => NOW, inspect: async () => { called = true; return diagnostics() } }), /^Error: Exact Facebook publishing credential unavailable\.$/)
  assert.equal(called, false)
})

test('credential loader refuses wrong-app/unknown/expired/near-expiry or analytics-only diagnostics', async () => {
  for (const change of [{ state: 'invalid' }, { state: 'unverified' }, { tokenType: 'PAGE' }, { expiresAt: null },
    { expiresAt: new Date(NOW + 60_000).toISOString() }, { dataAccessExpiresAt: new Date(NOW - 1).toISOString() }, { grantedScopes: ['pages_show_list'] }]) {
    const i = intent()
    await assert.rejects(credentials.facebookPublishingUserToken(store(await credentialStore(i)), i, config,
      { now: () => NOW, inspect: async () => ({ ...diagnostics(), ...change }) }), /^Error: Exact Facebook publishing credential unavailable\.$/)
  }
})

test('unknown credential expiry remains blocked with a useful sanitized preparation code', async () => {
  const i = intent(), g = graphFixture()
  const authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  await assert.rejects(credentials.verifyFacebookPublishingTarget(store(await credentialStore(i)), i, config,
    { now: () => NOW, fetch: g.fetch, inspect: async () => ({ ...diagnostics(), expiresAt: null }) }), error => {
      assert.equal(authorization.publicationPreparationBlocker(error), 'META_PUBLISHING_TOKEN_EXPIRY_UNVERIFIED')
      assert.doesNotMatch(JSON.stringify(error), /fixture-user-token|PRIVATE|access_token/)
      return true
    })
  assert.equal(g.calls.length, 0)
})

test('provider diagnostics cannot inject a public preparation code or private reason', async () => {
  const i = intent(), authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  for (const inspect of [async () => { throw Object.assign(new Error('PRIVATE fixture-user-token'), { code: 'META_PUBLISHING_TOKEN_EXPIRY_UNVERIFIED' }) },
    async () => ({ ...diagnostics(), state: 'unverified', errorCode: 'PRIVATE fixture-user-token', errorReason: 'PRIVATE' })]) {
    await assert.rejects(credentials.facebookPublishingUserToken(store(await credentialStore(i)), i, config,
      { now: () => NOW, inspect }), error => {
        assert.equal(authorization.publicationPreparationBlocker(error), 'META_PUBLISHING_CREDENTIAL_UNAVAILABLE')
        assert.doesNotMatch(JSON.stringify(error), /fixture-user-token|PRIVATE/)
        return true
      })
  }
})

test('concrete provider preflight reads exact app and Page rights without returning credentials or mutation handles', async () => {
  const i = intent(), sb = store(await credentialStore(i)), g = graphFixture()
  const result = await credentials.verifyFacebookPublishingTarget(sb, i, config, { now: () => NOW, fetch: g.fetch,
    inspect: async () => ({ ...diagnostics(), dataAccessExpiresAt: new Date(NOW + 600_000).toISOString() }) })
  assert.equal(result.checkedAt, new Date(NOW).toISOString())
  assert.equal(result.binding.tokenValidUntil, new Date(NOW + 600_000).toISOString())
  assert.equal(result.binding.accountPublishingVerified, true)
  assert.equal(result.binding.mediaContractVerified, false)
  assert.equal(g.calls.length, 3); assert.equal(g.calls.some(c => c.method !== 'GET'), false)
  assert.equal(JSON.stringify(result).includes('fixture-'), false)
  assert.equal(Object.values(result).some(v => typeof v === 'function'), false)
})

test('provider preflight refuses foreign mapping and current revoked Page access without mutation', async () => {
  const i = intent(), rows = await credentialStore(i), g = graphFixture({ handle: async url => url.pathname.endsWith('/me/permissions')
    ? Response.json({ data: [] }) : null })
  await assert.rejects(credentials.verifyFacebookPublishingTarget(store(rows), i, config, { now: () => NOW, fetch: g.fetch, inspect: async () => diagnostics() }))
  assert.equal(g.calls.length, 1)
  rows.meta_client_assets[0].client_id = 'foreign'
  await assert.rejects(credentials.verifyFacebookPublishingTarget(store(rows), i, config, { now: () => NOW, fetch: g.fetch, inspect: async () => diagnostics() }))
  assert.equal(g.calls.length, 1)
})

test('slow Page proof cannot revive expired token or stale credential resolution', async () => {
  let clock = NOW
  const i = intent(), g = graphFixture({ handle: async url => { if (url.pathname.endsWith('/me')) clock += 121_000 } })
  await assert.rejects(credentials.verifyFacebookPublishingTarget(store(await credentialStore(i)), i, config,
    { now: () => clock, fetch: g.fetch, inspect: async () => diagnostics() }), /CREDENTIAL_RECHECK_REQUIRED/)
  assert.equal(g.calls.some(c => c.method !== 'GET'), false)
})

test('durable executor integration retains a lost response barrier with the real private transport', async () => {
  const i = intent(), g = graphFixture({ handle: async (_u, init) => { if (init.method === 'POST') throw new Error('lost after acceptance') } })
  const order = []
  // Same approved context as kernel fixtures, exact channel binding.
  const context = { review: review(i), deliverable: { id: i.deliverableId, client_id: i.clientId, scheduled_date: '2026-11-16', archived_at: null, posted_at: null },
    binding: { clientId: i.clientId, connectionId: i.connectionId, accountId: i.accountId, route: i.route, active: true, grantedScopes: scopes, tokenValidUntil: new Date(NOW + 3600_000).toISOString(), appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true },
    authorization: { id: i.authorizationId, reviewVersionId: i.reviewVersionId, clientId: i.clientId, connectionId: i.connectionId, accountId: i.accountId, route: i.route, scheduledAt: i.scheduledAt, assetSha256: i.assetSha256 },
    assetSha256: i.assetSha256, teamsScheduleVerified: true, rolloutApproved: true }
  const policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
  const prepared = policy.preparePublishingIntent(context).intent
  const t = await makeTransport(prepared, g)
  const result = await executor.executePublishingIntent({ claim: async () => ({ fence: 'fence', intent: prepared }), readCurrent: async () => context,
    beginAttempt: async () => { order.push('durable begin'); return true }, submit: async approved => { order.push('provider'); return adapter.submitFacebookPhoto(approved, t) },
    saveObservation: async (_i, _f, observation) => { order.push(observation.state); return true } }, prepared.key, new Date(NOW).toISOString())
  assert.equal(result.state, 'unknown_outcome')
  assert.deepEqual(order, ['durable begin', 'provider', 'unknown_outcome'])
  assert.equal(g.calls.filter(c => c.method === 'POST').length, 1)
})
