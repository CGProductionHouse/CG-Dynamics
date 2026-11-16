import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

let server, credentials, instagramTokens, metaTokens, providerModule, runtimeModule, staffModule, authStore, policy
const originalFetch = globalThis.fetch
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  credentials = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishingCredential.ts')
  instagramTokens = await server.ssrLoadModule('/supabase/functions/_shared/instagramTokenEncryption.ts')
  metaTokens = await server.ssrLoadModule('/supabase/functions/_shared/metaTokenStorage.ts')
  providerModule = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishingProvider.ts')
  runtimeModule = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublicationRuntime.ts')
  staffModule = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublicationStaff.ts')
  authStore = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorizationStore.ts')
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
})
after(async () => { try { await server?.close() } finally { globalThis.fetch = originalFetch } })
const NOW = Date.parse('2026-11-16T12:00:00Z'), stamp = new Date(NOW).toISOString(), expiry = new Date(NOW + 3600_000).toISOString()
const key = Buffer.alloc(32, 4).toString('base64')
async function fixture(route = 'instagram_login') {
  const target = { clientId: randomUUID(), connectionId: randomUUID(), accountId: '123', route, deliverableId: randomUUID(), reviewVersionId: randomUUID() }
  const config = { instagram: { appId: '555', graphVersion: 'v27.0', encryptionKey: key, keyVersion: 'v1' },
    facebook: { appId: '777', graphVersion: 'v27.0', encryptionKey: key, keyVersion: 'v1', appSecret: 'fixture-app-secret' } }
  const encrypted = await instagramTokens.encryptInstagramAccessToken({ accessToken: 'fixture-instagram-token', keyBase64: key,
    context: { clientId: target.clientId, instagramAccountId: target.accountId, keyVersion: 'v1' } })
  const asset = { id: randomUUID(), client_id: target.clientId, connection_id: route === 'instagram_login' ? null : target.connectionId,
    facebook_page_id: route === 'instagram_login' ? null : '456', instagram_account_id: '123', instagram_username: 'fixture.handle',
    instagram_connection_id: route === 'instagram_login' ? target.connectionId : null, is_active: true }
  const scopes = route === 'instagram_login' ? ['instagram_business_basic', 'instagram_business_content_publish']
    : ['pages_show_list', 'instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
  const tables = { clients: [{ id: target.clientId, active: true }], meta_client_assets: [asset],
    meta_instagram_connections: [{ id: target.connectionId, client_id: target.clientId, instagram_account_id: '123', instagram_app_id: '555',
      app_scoped_user_id: '999', instagram_username: 'fixture.handle', account_type: 'business', scopes, status: 'connected', confirmed_asset_id: asset.id }],
    meta_instagram_connection_tokens: [{ connection_id: target.connectionId, ciphertext_base64: encrypted.ciphertextBase64, iv_base64: encrypted.ivBase64,
      encryption_version: encrypted.encryptionVersion, key_version: 'v1', token_expires_at: expiry }],
    meta_connections: [{ id: target.connectionId, status: 'connected' }], meta_connection_tokens: [{ connection_id: target.connectionId,
      encrypted_access_token: await metaTokens.encryptMetaStoredToken('fixture-meta-user-token', target.connectionId, key, 'v1') }] }
  const calls = [], reads = [], errors = new Set(), clock = { value: NOW }, graph = { identity: { id: '999', user_id: '123', username: 'fixture.handle', account_type: 'BUSINESS' },
    permissions: { data: scopes.map(permission => ({ permission, status: 'granted' })) }, pages: { data: [{ id: '456', access_token: 'fixture-page-token', tasks: ['CREATE_CONTENT'], instagram_business_account: { id: '123' } }] },
    quota: { data: [{ quota_usage: 1, config: { quota_total: 5, quota_duration: 86400 } }] } }
  const sb = { from(table) {
    const filters = [], q = { select() { return q }, eq(k, v) { filters.push([k, v]); return q }, async maybeSingle() {
      reads.push(table); const rows = tables[table].filter(r => filters.every(([k, v]) => r[k] === v))
      return { data: rows.length === 1 ? rows[0] : null, error: errors.has(table) || rows.length > 1 ? { message: 'PRIVATE DB ERROR' } : null }
    } }; return q
  } }
  const diagnostics = { state: 'valid', tokenType: 'USER', expiresAt: expiry, dataAccessExpiresAt: null, validatedAt: stamp, grantedScopes: scopes }
  const ports = { now: () => clock.value, inspect: async () => diagnostics, async fetch(raw, init) {
    const u = new URL(raw), path = u.pathname.replace('/v27.0', ''); calls.push({ u, path, ...init })
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(u.searchParams.has('access_token'), false)
    if (graph.handle) { const response = await graph.handle(path, init, u); if (response) return response }
    if (path === '/me/permissions') return Response.json(graph.permissions)
    if (path === '/me/accounts') return Response.json(graph.pages)
    if (path === '/me') return Response.json(route === 'instagram_login' ? graph.identity : { id: '456', instagram_business_account: { id: '123' } })
    if (path === '/123') return Response.json({ id: '123', username: 'fixture.handle' })
    if (path === '/123/content_publishing_limit') return Response.json(graph.quota)
    throw new Error('Unexpected fixture request')
  } }
  return { target, config, tables, asset, scopes, graph, clock, reads, errors, calls, sb, ports, diagnostics }
}
const resolve = f => credentials.resolveInstagramPublishingCredential(f.sb, f.target, f.config, f.ports)
const verify = f => credentials.verifyInstagramPublishingTarget(f.sb, f.target, f.config, f.ports)

async function canonicalFixture(route) {
  const f = await fixture(route), now = Date.now(), actorId = randomUUID(), jobId = randomUUID(), bytes = readFileSync('tests/fixtures/publication-baseline-320.jpg')
  const due = new Date(now + 60_000).toISOString(), date = new Date(now + 60_000 + 7200_000).toISOString().slice(0, 10)
  f.tables.profiles = [{ id: actorId, role: 'manager', is_active: true }]
  f.tables.content_review_versions = [{ id: f.target.reviewVersionId, client_id: f.target.clientId, deliverable_id: f.target.deliverableId,
    state: 'approved', channels: ['instagram'], media_type: 'image/jpeg', asset_path: `${f.target.deliverableId}/original.jpg`, caption: 'Approved photo caption', scheduled_at: due }]
  f.tables.monthly_deliverables = [{ id: f.target.deliverableId, client_id: f.target.clientId, scheduled_date: date,
    archived_at: null, posted_at: null, production_status: 'not_started', microsoft_task_id: 'fixture-task' }]
  f.tables.background_jobs = []
  f.tables.meta_instagram_connection_tokens[0].token_expires_at = new Date(now + 3600_000).toISOString()
  const events = [], proof = { contract: 'social_publication_schedule_evidence_v1', clientId: f.target.clientId, deliverableId: f.target.deliverableId,
    reviewVersionId: f.target.reviewVersionId, recordId: 'fixture-task', revision: 'a'.repeat(64), scheduledDate: date,
    capturedAt: new Date(now).toISOString(), checkedAt: new Date(now).toISOString() }
  f.sb.storage = { from() { return {
    async download(path) { events.push(['download', path]); return { data: new Blob([bytes], { type: 'image/jpeg' }), error: null } },
    async createSignedUrl() { events.push(['sign']); throw new Error('Preview and confirmation must never sign media') },
  } } }
  f.sb.rpc = async (name, args) => {
    events.push(['rpc', name])
    if (name === 'read_social_publication_schedule_evidence') { assert.equal(args.p_actor, actorId); return { data: proof, error: null } }
    if (name !== 'authorize_social_publication') throw new Error('Unexpected fixture mutation')
    const i = args.p_intent
    assert.equal(args.p_actor, actorId); assert.equal(i.route, route); assert.equal(i.platform, 'instagram')
    if (!f.tables.background_jobs.length) f.tables.background_jobs.push({ id: jobId, job_type: 'social_publish', status: 'queued',
      payload: { intent: i, authorized_by: actorId }, publication: { state: 'queued', authorization: { id: i.authorizationId,
        actorId, fingerprint: args.p_fingerprint, revokedAt: null } } })
    const j = f.tables.background_jobs[0]
    return { data: { jobId, authorizationId: j.payload.intent.authorizationId, fingerprint: j.publication.authorization.fingerprint, status: 'queued', state: 'queued' }, error: null }
  }
  globalThis.fetch = async (raw, init = {}) => {
    assert.equal(init.method ?? 'GET', 'GET', 'Canonical preview/confirmation cannot publish')
    if (new URL(raw).pathname.endsWith('/debug_token')) return Response.json({ data: { app_id: '777', type: 'USER', is_valid: true,
      expires_at: Math.floor(now / 1000) + 3600, data_access_expires_at: Math.floor(now / 1000) + 7200, scopes: f.scopes } })
    return f.ports.fetch(raw, init)
  }
  const configuration = { server: { ...f.config, projectUrl: 'https://fixture.supabase.co' }, release: { ...f.target, approved: true } }
  let decodes = 0
  const decoder = () => { decodes++; return { width: 320, height: 320, data: new Uint8Array(320 * 320 * 4) } }
  const runtime = runtimeModule.instagramPublicationRuntime(f.sb, configuration, decoder)
  const handler = staffModule.photoPublicationStaffHandler({ runtime, authenticate: async () => ({ id: actorId, role: 'manager', active: true }),
    persistence: authStore.socialPublicationAuthorizationStore(f.sb) })
  const invoke = async body => { const response = await handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) })); return { status: response.status, body: await response.json() } }
  return { ...f, runtime, invoke, events, proof, configuration, decoder, jobId, actorId, decodeCount: () => decodes }
}

for (const route of ['instagram_login', 'instagram_facebook_login']) test(`${route} actual canonical composition prepares and confirms once, then recovers only the original worker authorization`, async () => {
  const f = await canonicalFixture(route), reviewId = f.target.reviewVersionId
  const preview = await f.invoke({ action: 'preview', reviewId })
  assert.equal(preview.status, 200); assert.equal(preview.body.preview.platform, 'instagram')
  assert.equal(f.tables.background_jobs.length, 0); assert.equal(f.events.some(e => e[0] === 'sign'), false)
  const confirmation = { action: 'confirm', reviewId, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true }
  const first = await f.invoke(confirmation), duplicate = await f.invoke(confirmation)
  assert.equal(first.status, 200); assert.deepEqual(first, duplicate); assert.equal(f.tables.background_jobs.length, 1)
  const job = f.tables.background_jobs[0], bindings = f.runtime.workerBindings(f.jobId)
  const current = await bindings.readCurrent(job.payload.intent)
  assert.equal(current.authorization.id, job.payload.intent.authorizationId)
  assert.equal(current.binding.route, route); assert.equal(current.binding.mediaContractVerified, true)
  assert.equal(current.assetSha256, createHash('sha256').update(readFileSync('tests/fixtures/publication-baseline-320.jpg')).digest('hex'))
  f.configuration.release.accountId = '999' // Captured server policy cannot drift after an async preview.
  assert.equal((await f.runtime.targetForReview(reviewId)).accountId, '123')
  f.tables.content_review_versions[0].caption = 'Unapproved replacement'
  const changed = await bindings.readCurrent(job.payload.intent)
  assert.equal(policy.publishingDispatchDecision(job.payload.intent, changed, job.payload.intent.scheduledAt), 'blocked_source_changed')
  const calls = f.calls.length
  job.publication.authorization.revokedAt = new Date().toISOString()
  await assert.rejects(bindings.readCurrent(job.payload.intent), /Current publication authority unavailable/)
  assert.equal(f.calls.length, calls)
  assert.equal(f.events.some(e => e[0] === 'sign'), false)
  assert.equal(JSON.stringify(first.body).includes('fixture-'), false)
})

test('private Instagram runtime preserves stale-preview, capture, active-role, route and mandatory-decoder gates', async () => {
  const f = await canonicalFixture('instagram_login'), reviewId = f.target.reviewVersionId
  const preview = await f.invoke({ action: 'preview', reviewId })
  f.tables.content_review_versions[0].caption += ' amended'
  assert.equal((await f.invoke({ action: 'confirm', reviewId, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true })).status, 409)
  assert.equal(f.tables.background_jobs.length, 0)
  f.proof.capturedAt = new Date(Date.now() - 301_000).toISOString()
  const prior = f.calls.length
  assert.equal((await f.invoke({ action: 'preview', reviewId })).status, 409)
  assert.equal(f.calls.length, prior)
  f.tables.profiles[0].is_active = false
  await assert.rejects(f.runtime.readCandidate(f.target, f.actorId), /ACTIVE_MANAGER_REQUIRED/)
  const bindings = f.runtime.workerBindings(f.jobId), candidate = { ...f.target, platform: 'instagram' }
  for (const change of [{ clientId: randomUUID() }, { accountId: '999' }, { route: 'instagram_facebook_login' }, { platform: 'facebook' }]) {
    for (const method of ['readCurrent', 'submit', 'publishReadyContainer', 'reconcile']) await assert.rejects(bindings[method]({ ...candidate, ...change }), /Exact publication release/)
  }
  assert.throws(() => runtimeModule.instagramPublicationRuntime(f.sb, f.configuration, undefined), /decoder required/)
  for (const change of [{ approved: false }, { route: 'facebook_page' }, { connectionId: 'not-a-uuid' }]) {
    assert.throws(() => runtimeModule.instagramPublicationRuntime(f.sb, { ...f.configuration, release: { ...f.configuration.release, ...change } }, f.decoder), /release unavailable/)
  }
  assert.throws(() => f.runtime.workerBindings('not-a-job'), /job unavailable/)
  await assert.rejects(f.runtime.targetForReview(randomUUID()), /review unavailable/)
})

for (const route of ['instagram_login', 'instagram_facebook_login']) test(`${route} resolves its existing encrypted exact-account store with GET-only current publishing evidence`, async () => {
  const f = await fixture(route), result = await resolve(f)
  assert.equal(result.accessToken, route === 'instagram_login' ? 'fixture-instagram-token' : 'fixture-page-token')
  assert.equal(result.route, route); assert.equal(result.clientId, f.target.clientId); assert.equal(result.accountId, '123')
  assert.equal(result.verifiedAt, stamp); assert.equal(result.tokenValidUntil, expiry)
  assert.ok(f.calls.every(c => c.u.hostname === (route === 'instagram_login' ? 'graph.instagram.com' : 'graph.facebook.com')))
  assert.equal(f.calls.some(c => c.path.includes('debug_token')), false)
  assert.equal(f.calls.some(c => c.path === '/me/permissions'), route === 'instagram_facebook_login')
  assert.equal(f.reads.includes('meta_connection_tokens'), route === 'instagram_facebook_login')
  assert.equal(f.reads.includes('meta_instagram_connection_tokens'), route === 'instagram_login')
  assert.ok(f.calls.every(c => c.u.searchParams.has('appsecret_proof') === (route === 'instagram_facebook_login')))
  const safe = await verify(f)
  assert.equal(safe.binding.appAccessVerified, true); assert.equal(safe.binding.accountPublishingVerified, true); assert.equal(safe.binding.mediaContractVerified, false)
  assert.equal(JSON.stringify(safe).includes('fixture-'), false); assert.equal(JSON.stringify(safe).includes('accessToken'), false)
})

for (const [name, mutate] of [
  ['foreign client', f => { f.asset.client_id = randomUUID() }], ['foreign connection', f => { f.asset.instagram_connection_id = randomUUID() }],
  ['foreign account', f => { f.asset.instagram_account_id = '999' }], ['inactive client', f => { f.tables.clients[0].active = false }],
  ['inactive asset', f => { f.asset.is_active = false }], ['ambiguous mappings', f => { f.tables.meta_client_assets.push({ ...f.asset }) }],
  ['canonical Page-linked route', f => { f.asset.facebook_page_id = '456' }], ['missing connection', f => { f.tables.meta_instagram_connections = [] }],
  ['unreviewed connection', f => { f.tables.meta_instagram_connections[0].status = 'pending_review' }],
  ['wrong confirmed asset', f => { f.tables.meta_instagram_connections[0].confirmed_asset_id = randomUUID() }],
  ['wrong OAuth app', f => { f.tables.meta_instagram_connections[0].instagram_app_id = '111' }],
  ['analytics-only grant', f => { f.tables.meta_instagram_connections[0].scopes = ['instagram_business_basic'] }],
  ['expired credential', f => { f.tables.meta_instagram_connection_tokens[0].token_expires_at = stamp }],
  ['different key version', f => { f.tables.meta_instagram_connection_tokens[0].key_version = 'v2' }],
  ['legacy plaintext', f => { f.tables.meta_instagram_connection_tokens[0].ciphertext_base64 = 'plain-token' }],
  ['query failure', f => { f.errors.add('meta_instagram_connection_tokens') }],
]) test(`standalone ${name} blocks before any provider access and cannot fall back to Meta`, async () => {
  const f = await fixture(); mutate(f)
  await assert.rejects(resolve(f), /^Error: Exact Instagram publishing credential unavailable\.$/)
  assert.equal(f.calls.length, 0); assert.equal(f.reads.includes('meta_connection_tokens'), false)
})

for (const [name, change] of [
  ['app-scoped identity', f => { f.graph.identity.id = '111' }], ['professional identity', f => { f.graph.identity.user_id = '111' }],
  ['handle', f => { f.graph.identity.username = 'someone_else' }], ['account type', f => { f.graph.identity.account_type = 'PERSONAL' }],
  ['revoked publishing permission', f => { f.graph.handle = async path => path.endsWith('/content_publishing_limit') ? Response.json({ error: { message: 'PRIVATE' } }, { status: 403 }) : null }],
  ['exhausted quota', f => { f.graph.quota.data[0].quota_usage = 5 }], ['missing quota config', f => { delete f.graph.quota.data[0].config }],
]) test(`current standalone ${name} cannot be replaced by stale database permission facts`, async () => {
  const f = await fixture(); change(f); await assert.rejects(verify(f), /^Error: Exact Instagram publishing credential unavailable\.$/)
  assert.equal(f.reads.includes('meta_connection_tokens'), false)
})

for (const [name, change] of [
  ['wrong app diagnostics', f => { f.diagnostics.state = 'invalid' }], ['stale app diagnostics', f => { f.diagnostics.validatedAt = new Date(NOW - 120_001).toISOString() }],
  ['near-expiry data access', f => { f.diagnostics.dataAccessExpiresAt = new Date(NOW + 60_000).toISOString() }],
  ['revoked scope', f => { f.graph.permissions.data[2].status = 'declined' }], ['foreign Page', f => { f.graph.pages.data[0].id = '999' }],
  ['foreign linked Instagram', f => { f.graph.pages.data[0].instagram_business_account.id = '999' }],
  ['missing creation task', f => { f.graph.pages.data[0].tasks = ['ANALYZE'] }], ['duplicate Page', f => { f.graph.pages.data.push({ ...f.graph.pages.data[0] }) }],
  ['mixed credential route', f => { f.asset.instagram_connection_id = f.target.connectionId }],
  ['legacy Meta plaintext', f => { f.tables.meta_connection_tokens[0].encrypted_access_token = 'fixture-meta-user-token' }],
]) test(`Facebook-linked ${name} blocks without a standalone fallback`, async () => {
  const f = await fixture('instagram_facebook_login'); change(f); await assert.rejects(resolve(f))
  assert.equal(f.reads.includes('meta_instagram_connection_tokens'), false)
})

test('Facebook-linked publishing does not require the unrelated Facebook photo-post scope and accepts MANAGE task', async () => {
  const f = await fixture('instagram_facebook_login'); f.graph.pages.data[0].tasks = ['MANAGE']
  const result = await resolve(f)
  assert.equal(result.grantedScopes.includes('pages_manage_posts'), false); assert.equal(result.accessToken, 'fixture-page-token')
})

test('Facebook Page pagination is cursor-bounded on the fixed host and never follows token-bearing next URLs', async () => {
  const f = await fixture('instagram_facebook_login')
  f.graph.handle = async (path, _init, u) => path === '/me/accounts' && !u.searchParams.has('after')
    ? Response.json({ data: [], paging: { next: 'https://foreign.invalid?access_token=PRIVATE', cursors: { after: 'second' } } }) : null
  assert.equal((await resolve(f)).accountId, '123')
  assert.equal(f.calls.filter(c => c.path === '/me/accounts').length, 2)
  f.graph.handle = async path => path === '/me/accounts' ? Response.json({ data: [], paging: { next: 'ignored', cursors: { after: 'same' } } }) : null
  await assert.rejects(resolve(f))
})

test('identity mismatch, raw provider errors and a slow preflight are scrubbed', async () => {
  for (const response of [() => Response.json({ id: '111', instagram_business_account: { id: '123' } }), () => new Response('PRIVATE TOKEN'),
    () => Response.json({ error: { message: 'PRIVATE TOKEN' } })]) {
    const f = await fixture('instagram_facebook_login'); f.graph.handle = async path => path === '/me' ? response() : null
    await assert.rejects(resolve(f), /^Error: Exact Instagram publishing credential unavailable\.$/)
  }
  const f = await fixture(); f.graph.handle = async () => { f.clock.value += 121_000; return null }
  await assert.rejects(resolve(f)); assert.equal(f.calls.length, 1)
})

test('private server configuration is captured before asynchronous canonical reads', async () => {
  const f = await fixture('instagram_facebook_login'), from = f.sb.from
  f.sb.from = table => {
    const q = from(table), read = q.maybeSingle
    if (table === 'meta_client_assets') q.maybeSingle = async () => {
      f.config.facebook.appId = '111'; f.config.facebook.appSecret = 'mutated-private-secret'; f.config.facebook.encryptionKey = Buffer.alloc(32, 9).toString('base64')
      return await read()
    }
    return q
  }
  assert.equal((await resolve(f)).accountId, '123')
})

test('using the last publishing slot does not revoke read-only reconciliation credentials', async () => {
  const f = await fixture(); f.graph.quota.data[0].quota_usage = 5
  assert.equal((await resolve(f)).accountId, '123')
  await assert.rejects(verify(f)) // No new-publication preflight allowance.
})

test('private provider composes actual credential and original-file checks through create/publish/status without automatic activation', async () => {
  const f = await fixture(), bytes = readFileSync('tests/fixtures/publication-baseline-320.jpg'), signs = [], posts = []
  const due = new Date(Date.now() + 60_000).toISOString(), path = `${f.target.deliverableId}/original.jpg`
  f.tables.content_review_versions = [{ id: f.target.reviewVersionId, client_id: f.target.clientId, deliverable_id: f.target.deliverableId, state: 'approved',
    asset_path: path, media_type: 'image/jpeg', caption: 'Approved JPEG caption', channels: ['instagram'], scheduled_at: due }]
  f.tables.meta_instagram_connection_tokens[0].token_expires_at = new Date(Date.now() + 3600_000).toISOString()
  f.sb.storage = { from() { return {
    download: async () => ({ data: new Blob([bytes], { type: 'image/jpeg' }), error: null }),
    createSignedUrl: async (p, seconds) => {
      signs.push([p, seconds])
      return { data: { signedUrl: `https://fixture.supabase.co/storage/v1/object/sign/content-review-snapshots/${p}?token=fixture-signed` }, error: null }
    },
  } } }
  let published = false, decodes = 0
  globalThis.fetch = async (raw, init) => {
    const u = new URL(raw), p = u.pathname.replace('/v27.0', '')
    if (init.method === 'POST') {
      posts.push([p, new URLSearchParams(init.body)])
      if (p === '/123/media') return Response.json({ id: '456' })
      if (p === '/123/media_publish') { published = true; return Response.json({ id: '789' }) }
      throw new Error('Unexpected provider mutation')
    }
    if (p === '/456') return Response.json({ id: '456', status_code: published ? 'PUBLISHED' : 'FINISHED' })
    if (p === '/789') return Response.json({ id: '789', owner: { id: '123' }, media_type: 'IMAGE' })
    return f.ports.fetch(raw, init)
  }
  const provider = providerModule.instagramPhotoProvider(f.sb, { ...f.config, projectUrl: 'https://fixture.supabase.co' }, (_b, options) => {
    decodes++; assert.equal(options.tolerantDecoding, false); return { width: 320, height: 320, data: new Uint8Array(320 * 320 * 4) }
  })
  const intent = { ...f.target, key: 'fixture-key', platform: 'instagram', assetPath: path, assetSha256: createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/jpeg',
    caption: 'Approved JPEG caption', scheduledAt: due, authorizationId: randomUUID(), state: 'queued', attempt: 0, providerOperationId: null, providerPostId: null }
  const container = await provider.submit(intent)
  assert.equal(container.instagramPhase, 'container_processing'); assert.equal(decodes, 1); assert.equal(signs.length, 1)
  const ready = { ...intent, state: 'processing', providerOperationId: container.operationId }
  const publication = await provider.publishReadyContainer(ready)
  assert.equal(publication.instagramPhase, 'verifying'); assert.equal(posts.length, 2)
  f.graph.quota.data[0].quota_usage = 5 // Status still works after the final slot.
  const status = await provider.reconcile({ ...ready, providerPostId: publication.postId }, { phase: 'verifying', publishAttempted: true, statusReads: 1, startedAt: due })
  assert.equal(status.state, 'posted'); assert.equal(signs.length, 1); assert.equal(decodes, 1)
  assert.equal(posts[0][1].get('caption'), intent.caption); assert.equal(posts[1][1].get('creation_id'), '456')
  await assert.rejects(provider.reconcile(ready))
  assert.throws(() => providerModule.instagramPhotoProvider(f.sb, { ...f.config, projectUrl: 'https://fixture.supabase.co' }, undefined), /decoder required/)
  globalThis.fetch = originalFetch
})
