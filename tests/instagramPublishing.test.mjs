import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, queue, instagram, transport, policy
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
  instagram = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishing.ts')
  transport = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishingTransport.ts')
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
})
after(async () => { await server?.close() })
const NOW = '2026-11-16T10:00:00Z'
function fixture() {
  const intent = { key: `social-publish:v1:${JSON.stringify(['client', 'deliverable', 'review', 'instagram', '123'])}`, clientId: 'client', deliverableId: 'deliverable', reviewVersionId: 'review', connectionId: 'connection', accountId: '123',
    platform: 'instagram', route: 'instagram_login', assetPath: 'deliverable/final.jpg', assetSha256: 'a'.repeat(64), caption: 'Approved caption', mediaType: 'image/jpeg',
    scheduledAt: NOW, authorizationId: 'authorization', state: 'processing', attempt: 1, providerOperationId: '456', providerPostId: null }
  const context = { review: { id: 'review', client_id: 'client', deliverable_id: 'deliverable', state: 'approved', asset_path: intent.assetPath,
    media_type: intent.mediaType, caption: intent.caption, scheduled_at: NOW, channels: ['instagram'] },
    deliverable: { id: 'deliverable', client_id: 'client', scheduled_date: '2026-11-16', archived_at: null, posted_at: null },
    binding: { clientId: 'client', connectionId: 'connection', accountId: '123', route: 'instagram_login', active: true,
      grantedScopes: ['instagram_business_basic', 'instagram_business_content_publish'], tokenValidUntil: '2026-11-16T11:00:00Z',
      appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true },
    authorization: { id: 'authorization', reviewVersionId: 'review', clientId: 'client', connectionId: 'connection', accountId: '123', route: 'instagram_login',
      scheduledAt: NOW, assetSha256: intent.assetSha256 }, assetSha256: intent.assetSha256, teamsScheduleVerified: true, rolloutApproved: true }
  const protocol = { phase: 'container_ready', publishAttempted: false, statusReads: 1, startedAt: '2026-11-16T09:59:00Z' }
  const events = [], row = { key: intent.key, fence: 'fence', intent, state: 'processing', attempt: 1,
    observation: { state: 'processing', operationId: '456', instagramPhase: 'container_ready' }, instagram: protocol }
  const sb = { async rpc(name, args) { events.push([name, args]); return { data: name === 'claim_social_publication' ? row : true, error: null } } }
  const bindings = { async readCurrent() { events.push(['current']); return context },
    async submit() { events.push(['create']); throw new Error('Do not recreate a container') },
    async reconcile() { events.push(['read']); return row.observation },
    async publishReadyContainer(i) { events.push(['publish', i]); return { state: 'processing', operationId: '456', postId: '789', instagramPhase: 'verifying' } } }
  return { intent, context, protocol, row, sb, bindings, events }
}
const dispatch = f => queue.runClaimedSocialPublication({ sb: f.sb, jobId: 'job', key: f.intent.key, worker: 'worker', now: NOW, enabled: true, bindings: f.bindings })

test('a ready Instagram container advances only behind a second durable barrier', async () => {
  const f = fixture(), result = await dispatch(f)
  assert.equal(f.events.filter(e => e[0] === 'publish').length, 1)
  assert.equal(result.publication.postId, '789')
  assert.ok(f.events.findIndex(e => e[0] === 'begin_instagram_publication_publish') < f.events.findIndex(e => e[0] === 'publish'))
  assert.equal(f.events.some(e => e[0] === 'create'), false)
})

test('initial dispatch retains the existing no-resubmit decision for a future processing intent', () => {
  const f = fixture(), future = '2026-11-16T10:02:00Z'
  f.intent.scheduledAt = future; f.context.review.scheduled_at = future; f.context.authorization.scheduledAt = future
  assert.equal(policy.publishingDispatchDecision(f.intent, f.context, NOW), 'do_not_submit')
})

for (const [name, mutate] of [
  ['withdrawn authority', f => { f.context.authorization = null }],
  ['changed caption', f => { f.context.review.caption = 'amended' }],
  ['different account', f => { f.context.binding.accountId = '999' }],
  ['scheduled manually', f => { f.context.deliverable.production_status = 'scheduled' }],
  ['lost lease', f => { f.sb.rpc = async name => ({ data: name === 'claim_social_publication' ? f.row : name !== 'begin_instagram_publication_publish', error: null }) }],
  ['missing phase proof', f => { delete f.row.instagram }],
  ['expired bounded run', f => { f.protocol.startedAt = '2026-11-16T09:54:59Z' }],
  ['future run timestamp', f => { f.protocol.startedAt = '2026-11-16T10:00:01Z' }],
  ['exhausted read budget', f => { f.protocol.statusReads = 5 }],
]) test(`${name} cannot perform the second Instagram mutation`, async () => {
  const f = fixture(); mutate(f); await dispatch(f)
  assert.equal(f.events.some(e => e[0] === 'publish' || e[0] === 'create'), false)
})

test('a consumed second-step barrier only reconciles after timeout or a misleading ready observation', async () => {
  const f = fixture(); f.protocol.publishAttempted = true
  await dispatch(f)
  assert.equal(f.events.some(e => e[0] === 'publish'), false); assert.equal(f.events.some(e => e[0] === 'read'), true)
})

test('uncertain publication is saved with its original container; a mutation response alone cannot claim posted', async () => {
  const f = fixture(); f.bindings.publishReadyContainer = async () => { throw new Error('PRIVATE TIMEOUT') }
  assert.equal((await dispatch(f)).publication.state, 'unknown_outcome')
  assert.equal(f.events.find(e => e[0] === 'save_social_publication')[1].p_observation.operationId, '456')
  const broken = fixture(); broken.bindings.publishReadyContainer = async () => ({ state: 'posted', postId: '789', operationId: '456' })
  assert.equal((await dispatch(broken)).publication.state, 'unknown_outcome')
})

function graphFixture(i, options = {}) {
  const calls = [], clock = { value: Date.parse(NOW) }
  const credential = { clientId: i.clientId, connectionId: i.connectionId, accountId: i.accountId, route: i.route,
    accessToken: 'fixture-instagram-token', verifiedAt: NOW, tokenValidUntil: '2026-11-16T11:00:00Z', grantedScopes: i.route === 'instagram_login'
      ? ['instagram_business_basic', 'instagram_business_content_publish'] : ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'] }
  const fetch = async (raw, init) => {
    const url = new URL(raw), path = url.pathname.replace('/v27.0', ''); calls.push([init.method, path, url, init])
    assert.equal(url.searchParams.has('access_token'), false); assert.equal(init.redirect, 'error')
    if (options.handle) { const result = await options.handle(path, init, url); if (result) return result }
    if (path === '/123') return Response.json({ id: '123' })
    if (path.endsWith('/content_publishing_limit')) return Response.json({ data: [{ quota_usage: 1, config: { quota_total: 3, quota_duration: 86400 } }] })
    if (path === '/123/media') return Response.json({ id: '456' })
    if (path === '/456') return Response.json({ id: '456', status_code: 'FINISHED' })
    if (path === '/123/media_publish') return Response.json({ id: '789' })
    if (path === '/789') return Response.json({ id: '789', owner: { id: '123' }, media_type: 'IMAGE' })
    throw new Error('Unexpected route')
  }
  return { calls, clock, credential, fetch, make: (stage, extra = {}) => transport.instagramPhotoTransport({ intent: i, stage, graphVersion: 'v27.0',
    resolveCredential: async () => credential, qualifiedMediaUrl: async () => 'https://fixture.invalid/original.jpg?token=FIXTURE', fetch, now: () => clock.value, ...extra }) }
}

for (const route of ['instagram_login', 'instagram_facebook_login']) test(`${route} uses its own fixed host and scope family; container response never means published`, async () => {
  const i = { ...fixture().intent, route, state: 'queued', providerOperationId: null }, g = graphFixture(i)
  const t = await g.make('create', route === 'instagram_facebook_login' ? { appSecret: 'fixture-app-secret' } : {})
  const receipt = await instagram.createInstagramPhotoContainer(i, t)
  assert.deepEqual(receipt, { state: 'processing', operationId: '456', instagramPhase: 'container_processing' })
  assert.equal(g.calls.filter(c => c[0] === 'POST').length, 1)
  assert.ok(g.calls.every(c => c[2].hostname === (route === 'instagram_login' ? 'graph.instagram.com' : 'graph.facebook.com')))
  const post = g.calls.at(-1), body = new URLSearchParams(post[3].body)
  assert.equal(body.get('caption'), i.caption); assert.equal(body.has('appsecret_proof'), route === 'instagram_facebook_login')
  assert.equal(JSON.stringify(receipt).includes('token'), false)
  await assert.rejects(instagram.createInstagramPhotoContainer(i, t), /MUTATION_CONTRACT_REQUIRED/)
  assert.equal(g.calls.filter(c => c[0] === 'POST').length, 1)
})

test('publish stage addresses only the recorded container; publication receipt remains processing until owner-verified readback', async () => {
  const i = fixture().intent, g = graphFixture(i), t = await g.make('publish')
  const result = await instagram.publishInstagramPhotoContainer(i, t)
  assert.deepEqual(result, { state: 'processing', operationId: '456', postId: '789', instagramPhase: 'verifying' })
  assert.deepEqual([...new URLSearchParams(g.calls.at(-1)[3].body).entries()], [['creation_id', '456']])
  await assert.rejects(t.request('POST', '/123/media', { image_url: 'https://foreign.invalid', caption: 'other' }), /CONTRACT_REQUIRED/)
})

test('a real preflight can finish after transport construction without looking like future credential evidence', async () => {
  const g = graphFixture(fixture().intent)
  const t = await g.make('publish', { resolveCredential: async () => {
    g.clock.value += 1000
    return { ...g.credential, verifiedAt: new Date(g.clock.value).toISOString() }
  } })
  assert.ok(t.request)
})

test('invalid Instagram captions stop before credential/media/provider access rather than consuming a mutation attempt', async () => {
  for (const caption of ['x'.repeat(2201), Array.from({ length: 31 }, (_, n) => `#tag${n}`).join(' '),
    Array.from({ length: 21 }, (_, n) => `@person${n}`).join(' '), 'broken\ud800text']) {
    const i = { ...fixture().intent, caption, state: 'queued', providerOperationId: null }, g = graphFixture(i)
    let credentials = 0
    await assert.rejects(g.make('create', { resolveCredential: async () => { credentials++; return g.credential } }))
    assert.equal(credentials, 0); assert.equal(g.calls.length, 0)
    let requests = 0
    const direct = { request: async () => { requests++; return {} }, approvedMediaUrl: async () => { throw new Error('Must not sign') } }
    await assert.rejects(instagram.createInstagramPhotoContainer(i, direct))
    await assert.rejects(instagram.publishInstagramPhotoContainer({ ...i, state: 'processing', providerOperationId: '456' }, direct))
    assert.equal(requests, 0)
  }
})

test('invalid current caption blocks the second durable publish barrier but never blocks GET-only reconciliation of an accepted receipt', async () => {
  const f = fixture(); f.intent.caption = 'x'.repeat(2201); f.context.review.caption = f.intent.caption
  const stopped = (await dispatch(f)).publication
  assert.equal(stopped.state, 'unknown_outcome'); assert.equal(stopped.errorCode, 'INSTAGRAM_CURRENT_AUTHORITY_REQUIRED')
  assert.equal(f.events.some(e => ['begin_instagram_publication_publish', 'publish', 'create'].includes(e[0])), false)
  const i = { ...f.intent, providerPostId: '789' }, g = graphFixture(i, { handle: path => path === '/456' ? Response.json({ id: '456', status_code: 'PUBLISHED' }) : null })
  const receipt = await instagram.readInstagramPhotoStatus(i, await g.make('status'), { ...f.protocol, phase: 'verifying', publishAttempted: true })
  assert.equal(receipt.state, 'posted'); assert.ok(g.calls.every(c => c[0] === 'GET'))
})

test('valid caption boundaries retain the approved spaces, Unicode, contact details and newlines exactly in the provider body', async () => {
  const prefix = '  Café 🛠\r\n#MadeInSA @client\nContact sales@client.co.za: '
  const i = { ...fixture().intent, state: 'queued', providerOperationId: null, caption: prefix + 'x'.repeat(2200 - prefix.length - 2) + '  ' }
  const g = graphFixture(i), receipt = await instagram.createInstagramPhotoContainer(i, await g.make('create'))
  assert.equal(receipt.state, 'processing')
  assert.equal(new URLSearchParams(g.calls.at(-1)[3].body).get('caption'), i.caption)
  assert.equal(i.caption.length, 2200)
})

test('Instagram caption bounds apply to both login routes without reducing the independent Facebook caption policy', () => {
  const f = fixture(); f.context.review.caption = 'x'.repeat(2201)
  for (const route of ['instagram_login', 'instagram_facebook_login']) {
    f.context.binding.route = route; f.context.authorization.route = route
    assert.ok(policy.preparePublishingIntent(f.context).blockers.includes('INSTAGRAM_CAPTION_TOO_LONG'))
  }
  f.context.binding.route = 'facebook_page'; f.context.authorization.route = 'facebook_page'
  f.context.review.channels = ['facebook']; f.context.binding.grantedScopes = ['pages_manage_posts', 'pages_read_engagement']
  assert.ok(policy.preparePublishingIntent(f.context).intent)
})

for (const [name, result, attempted, mediaId, state] of [
  ['ready', { id: '456', status_code: 'FINISHED' }, false, null, 'processing'],
  ['ready after attempted publication', { id: '456', status_code: 'FINISHED' }, true, null, 'unknown_outcome'],
  ['published missing media ID', { id: '456', status_code: 'PUBLISHED' }, true, null, 'unknown_outcome'],
  ['published without durable barrier', { id: '456', status_code: 'PUBLISHED' }, false, '789', 'unknown_outcome'],
  ['foreign container ID', { id: '999', status_code: 'PUBLISHED' }, true, '789', 'unknown_outcome'],
  ['expired', { id: '456', status_code: 'EXPIRED' }, false, null, 'failed'],
  ['provider error', { id: '456', status_code: 'ERROR' }, false, null, 'failed'],
  ['published', { id: '456', status_code: 'PUBLISHED' }, true, '789', 'posted'],
]) test(`${name} yields truthful read-only Instagram status`, async () => {
  const i = { ...fixture().intent, providerPostId: mediaId }, g = graphFixture(i, { handle: async path => path === '/456' ? Response.json(result) : null })
  const receipt = await instagram.readInstagramPhotoStatus(i, await g.make('status'), { ...fixture().protocol, publishAttempted: attempted })
  assert.equal(receipt.state, state); assert.equal(g.calls.some(c => c[0] !== 'GET'), false)
})

test('foreign media owner cannot become a verified posted receipt', async () => {
  const i = { ...fixture().intent, providerPostId: '789' }, g = graphFixture(i, { handle: async path => path === '/456' ? Response.json({ id: '456', status_code: 'PUBLISHED' })
    : path === '/789' ? Response.json({ id: '789', owner: { id: '999' }, media_type: 'IMAGE' }) : null })
  assert.equal((await instagram.readInstagramPhotoStatus(i, await g.make('status'), { ...fixture().protocol, publishAttempted: true })).state, 'unknown_outcome')
})

for (const [name, change] of [
  ['foreign client', c => { c.clientId = 'foreign' }], ['foreign connection', c => { c.connectionId = 'foreign' }],
  ['foreign account', c => { c.accountId = '999' }], ['different login route', c => { c.route = 'instagram_facebook_login' }],
  ['analytics-only scope', c => { c.grantedScopes = ['instagram_business_basic'] }], ['stale evidence', c => { c.verifiedAt = '2026-11-16T09:58:59Z' }],
  ['near-expiry', c => { c.tokenValidUntil = '2026-11-16T10:01:00Z' }],
]) test(`transport refuses ${name} before provider access`, async () => {
  const g = graphFixture(fixture().intent); change(g.credential); await assert.rejects(g.make('publish'), /CURRENT_CREDENTIAL_REQUIRED/); assert.equal(g.calls.length, 0)
})

for (const result of [{ data: [{ quota_usage: 3, config: { quota_total: 3, quota_duration: 86400 } }] }, { data: [{ quota_usage: 0 }] }, { data: [] }]) test('quota fails closed using returned configuration rather than guessed defaults', async () => {
  const i = { ...fixture().intent, state: 'queued', providerOperationId: null }, g = graphFixture(i, { handle: async path => path.endsWith('/content_publishing_limit') ? Response.json(result) : null })
  await assert.rejects(instagram.createInstagramPhotoContainer(i, await g.make('create')), /quota unavailable/)
  assert.equal(g.calls.some(c => c[0] === 'POST'), false)
})

test('timeout consumes the publish transport and scrubs provider errors; stale or arbitrary requests cannot reuse it', async () => {
  const i = fixture().intent, g = graphFixture(i, { handle: async (_p, init) => { if (init.method === 'POST') throw new Error('PRIVATE TOKEN') } }), t = await g.make('publish')
  await assert.rejects(instagram.publishInstagramPhotoContainer(i, t), /^InstagramPublishingTransportError: INSTAGRAM_RESPONSE_UNVERIFIED$/)
  await assert.rejects(instagram.publishInstagramPhotoContainer(i, t), /MUTATION_CONTRACT_REQUIRED/)
  assert.equal(g.calls.filter(c => c[0] === 'POST').length, 1)
  await assert.rejects(t.request('GET', '/999', { fields: 'id,status_code' }), /STATUS_CONTRACT_REQUIRED/)
  g.clock.value += 120_000
  await assert.rejects(t.request('GET', '/456', { fields: 'id,status_code' }), /CREDENTIAL_RECHECK_REQUIRED/)
})

test('PNG/video or an unready/foreign container cannot reach the publication mutation', async () => {
  for (const mediaType of ['image/png', 'video/mp4']) {
    const g = graphFixture({ ...fixture().intent, mediaType }); await assert.rejects(g.make('publish'), /CONTRACT_REQUIRED/); assert.equal(g.calls.length, 0)
  }
  for (const result of [{ id: '456', status_code: 'IN_PROGRESS' }, { id: '999', status_code: 'FINISHED' }]) {
    const i = fixture().intent, g = graphFixture(i, { handle: async path => path === '/456' ? Response.json(result) : null })
    assert.equal((await instagram.publishInstagramPhotoContainer(i, await g.make('publish'))).state, 'unknown_outcome')
    assert.equal(g.calls.some(c => c[0] === 'POST'), false)
  }
})

test('stale snapshot candidates and mutation extras cannot alter the qualified delivery or approved caption', async () => {
  const i = { ...fixture().intent, state: 'queued', providerOperationId: null }, g = graphFixture(i), t = await g.make('create')
  await assert.rejects(t.approvedMediaUrl({ ...i, caption: 'changed' }), /EXACT_SNAPSHOT_REQUIRED/)
  const url = await t.approvedMediaUrl(i)
  await assert.rejects(t.request('POST', '/123/media', { image_url: url, caption: i.caption, published: 'true' }), /MUTATION_CONTRACT_REQUIRED/)
  await assert.rejects(t.request('POST', '/999/media', { image_url: url, caption: i.caption }), /MUTATION_CONTRACT_REQUIRED/)
  assert.equal(g.calls.some(c => c[0] === 'POST'), false)
})

for (const [name, response] of [['HTTP error', () => Response.json({ error: { message: 'PRIVATE TOKEN' } }, { status: 429 })],
  ['Graph error', () => Response.json({ error: { message: 'PRIVATE TOKEN' } })], ['bad JSON', () => new Response('PRIVATE TOKEN')],
  ['redirect', () => Response.redirect('https://foreign.invalid')]]) test(`${name} is sanitized without a publish retry`, async () => {
  const i = fixture().intent, g = graphFixture(i, { handle: async (_p, init) => init.method === 'POST' ? response() : null }), t = await g.make('publish')
  await assert.rejects(instagram.publishInstagramPhotoContainer(i, t), error => !error.message.includes('PRIVATE'))
  await assert.rejects(instagram.publishInstagramPhotoContainer(i, t), /MUTATION_CONTRACT_REQUIRED/)
  assert.equal(g.calls.filter(c => c[0] === 'POST').length, 1)
})

test('lost second-step receipt persistence leaves the attempted barrier and cannot replay publication', async () => {
  const f = fixture(), rpc = f.sb.rpc; let publishes = 0
  f.bindings.publishReadyContainer = async () => { publishes++; return { state: 'processing', operationId: '456', postId: '789', instagramPhase: 'verifying' } }
  f.sb.rpc = async (name, args) => {
    if (name === 'begin_instagram_publication_publish') { f.protocol.publishAttempted = true; f.protocol.phase = 'publishing'; f.row.state = 'submitting' }
    if (name === 'save_social_publication') throw new Error('PRIVATE persistence failure')
    return rpc(name, args)
  }
  await assert.rejects(dispatch(f))
  assert.equal(publishes, 1)
  f.sb.rpc = rpc
  await dispatch(f)
  assert.equal(publishes, 1)
})
