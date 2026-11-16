import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

let server, bridge, tokens, authorization, queue, management
const NOW = Date.parse('2026-11-16T18:00:00Z'), POST = '1234567890123456789'
// Match the existing save RPC's recursive jsonb_strip_nulls(object) behavior;
// array elements survive. JSON roundtrip also removes JS-only undefined keys.
const stripNulls = value => Array.isArray(value) ? value.map(stripNulls) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, stripNulls(v)])) : value
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  bridge = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessQueueReconciliation.ts')
  tokens = await server.ssrLoadModule('/supabase/functions/_shared/tiktokBusinessTokenStorage.ts')
  authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
  management = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationManagement.ts')
})
after(async () => { await server?.close() })
async function fixture() {
  const ids = { client: randomUUID(), connection: randomUUID(), authorization: randomUUID(), actor: randomUUID(), job: randomUUID(), review: randomUUID(), deliverable: randomUUID() }
  const config = { appId: '123456', encryptionKey: Buffer.alloc(32, 7).toString('base64'), keyVersion: 'v1' }
  const intent = { key: 'social-publish:v1:synthetic-only', clientId: ids.client, deliverableId: ids.deliverable, reviewVersionId: ids.review,
    platform: 'tiktok', route: 'tiktok_accounts', connectionId: ids.connection, accountId: 'exact-business-id', assetPath: `${ids.deliverable}/reviewed.mp4`,
    assetSha256: 'a'.repeat(64), mediaType: 'video/mp4', caption: 'The approved caption.', scheduledAt: new Date(NOW - 60_000).toISOString(),
    authorizationId: ids.authorization, state: 'processing', attempt: 1, providerOperationId: 'original-share-id', providerPostId: null }
  const row = { id: ids.job, job_type: 'social_publish', idempotency_key: intent.key, status: 'running', locked_by: 'synthetic-worker', locked_at: new Date(NOW).toISOString(),
    payload: { authorized_by: ids.actor, intent: { ...intent, state: 'queued', attempt: 0, providerOperationId: null, providerPostId: null } },
    publication: { fence: randomUUID(), state: 'processing', started_at: new Date(NOW - 60_000).toISOString(), submission_fence: randomUUID(), submission_worker: 'original-worker',
      observation: { state: 'processing', operationId: intent.providerOperationId }, authorization: { id: ids.authorization, actorId: ids.actor,
        fingerprint: await authorization.socialPublicationFingerprint(intent), confirmedAt: new Date(NOW - 120_000).toISOString(), revokedAt: null } } }
  const grant = { id: ids.authorization, client_id: ids.client, connection_id: ids.connection, business_open_id: intent.accountId,
    account_handle: 'cgproductionhouse', status: 'connected', granted_permissions: ['video.publish', 'user.info.username'],
    token_expires_at: new Date(NOW + 3600_000).toISOString(), refresh_fence: null, refresh_started_at: null, updated_at: new Date(NOW).toISOString(), publishing_eligibility: 'not_approved' }
  const encrypted = await tokens.encryptTiktokBusinessStoredToken('synthetic-access', `${ids.connection}:access`, config.encryptionKey, config.keyVersion)
  const tables = { background_jobs: [row], clients: [{ id: ids.client, active: true }],
    tiktok_connections: [{ id: ids.connection, client_id: ids.client, status: 'connected', profile_deep_link: 'https://www.tiktok.com/@cgproductionhouse' }],
    tiktok_business_authorizations: [grant], tiktok_business_authorization_tokens: [{ authorization_id: ids.authorization, access_token: encrypted, refresh_token: 'MUST NOT SELECT' }],
    profiles: [{ id: ids.actor, is_active: true, role: 'manager' }], content_review_versions: [{ id: ids.review, client_id: ids.client, deliverable_id: ids.deliverable }],
    monthly_deliverables: [{ id: ids.deliverable, client_id: ids.client }] }
  const f = { ids, config, intent, row, tables, db: [], http: [], rpc: [], clock: NOW, failures: new Set(), native: { status: 'PUBLISH_COMPLETE', post_ids: [POST] } }
  f.sb = { from(table) {
    let selected, signal, list = false; const filters = []
    const q = { select(columns) { selected = columns; assert.equal(columns.includes('refresh_token'), false); return q },
      eq(k, v) { filters.push([k, v]); return q }, abortSignal(s) { signal = s; return q }, order() { return q }, range() { list = true; return q },
      async then(resolve, reject) { try { return resolve(await get(true)) } catch (e) { return reject(e) } }, maybeSingle: () => get(false) }
    async function get(many) {
      f.db.push({ table, selected, filters, signal }); await f.onDb?.(table)
      const found = tables[table].filter(row => filters.every(([key, value]) => {
        const path = key.split(/->>?/); let v = row; for (const k of path) v = v?.[k]; return v === value
      }))
      return { error: f.failures.has(table) ? { message: 'PRIVATE SDK ERROR synthetic-access' } : null,
        data: structuredClone(many || list ? found : found.length === 1 ? found[0] : null) }
    }
    return q
  }, async rpc(name, args) {
    f.rpc.push({ name, args })
    if (name === 'claim_social_publication') return { error: null, data: { key: intent.key, fence: row.publication.fence, intent: row.payload.intent,
      state: row.publication.state, observation: row.publication.observation, attempt: 1 } }
    if (name === 'save_social_publication') {
      assert.equal(args.p_fence, row.publication.fence)
      assert.ok(['processing', 'unknown_outcome'].includes(args.p_observation.state))
      row.publication.observation = { ...row.publication.observation, ...stripNulls(JSON.parse(JSON.stringify(args.p_observation))) }; row.publication.state = args.p_observation.state
      return { error: null, data: true }
    }
    throw new Error('Unexpected mutating RPC')
  } }
  f.options = { now: () => f.clock, async fetch(raw, init) {
    const url = new URL(raw); f.http.push({ url, init }); await f.onHttp?.(url.pathname)
    assert.equal(url.origin, 'https://business-api.tiktok.com'); assert.equal(init.redirect, 'error')
    if (url.pathname === '/open_api/v1.3/tt_user/token_info/get/') return Response.json({ code: 0, data: { app_id: config.appId, creator_id: intent.accountId, scope: 'video.publish,user.info.username' } })
    if (url.pathname === '/open_api/v1.3/business/get/') return Response.json({ code: 0, data: { username: 'cgproductionhouse' } })
    if (url.pathname === '/open_api/v1.3/business/publish/status/') return Response.json({ code: 0, data: f.native })
    throw new Error('Unexpected provider path')
  } }
  return f
}
const read = f => bridge.readTikTokBusinessQueueObservation(f.sb, f.config, f.ids.job, f.intent, f.options)
const prior = (f, edits = {}) => ({ version: 1, businessId: f.intent.accountId, publishId: f.intent.providerOperationId, publicPostIds: [], nativeState: 'processing',
  checkedAt: new Date(NOW - 180_000).toISOString(), notBefore: new Date(NOW).toISOString(), statusReads: 1, ...edits })

test('native public task receipt is audited but cannot mark approved source as published', async () => {
  const f = await fixture(), result = await read(f)
  assert.equal(result.state, 'unknown_outcome'); assert.equal(result.errorCode, 'TIKTOK_SOURCE_TO_RECEIPT_UNVERIFIED')
  assert.equal(result.postId, POST); assert.equal(result.operationId, f.intent.providerOperationId)
  assert.deepEqual(result.tiktokStatus, { version: 1, businessId: f.intent.accountId, publishId: f.intent.providerOperationId,
    publicPostIds: [POST], nativeState: 'posted', checkedAt: new Date(NOW).toISOString(), notBefore: null, statusReads: 1 })
  assert.equal(f.http.length, 3); assert.equal(f.rpc.length, 0)
  assert.equal(JSON.stringify(result).includes('synthetic-access'), false); assert.equal(JSON.stringify(result).includes('encryption'), false)
  assert.equal(f.tables.tiktok_business_authorizations[0].publishing_eligibility, 'not_approved')
})
test('existing queue save RPC retains every public ID without selecting the first or beginning a submission', async () => {
  const f = await fixture(); f.native.post_ids = [POST, '2345678901234567890']
  const bindings = bridge.tiktokBusinessQueueStatusBindings(f.sb, f.config, f.ids.job, f.options)
  const result = await queue.runClaimedSocialPublication({ sb: f.sb, jobId: f.ids.job, key: f.intent.key, worker: f.row.locked_by,
    now: new Date(NOW).toISOString(), enabled: true, bindings })
  assert.equal(result.publication.state, 'unknown_outcome'); assert.equal(result.publication.errorCode, 'TIKTOK_MULTIPLE_PUBLIC_POSTS_REVIEW')
  assert.equal(result.publication.postId, undefined); assert.deepEqual(f.row.publication.observation.tiktokStatus.publicPostIds, f.native.post_ids)
  assert.deepEqual(f.rpc.map(r => r.name), ['claim_social_publication', 'save_social_publication'])
  assert.ok(f.http.every(r => r.init.method === 'GET' || r.url.pathname.endsWith('/token_info/get/')))
})
for (const ids of [[POST], [POST, '2345678901234567890']]) test(`SQL-shaped null-stripped terminal audit survives queue resumption (${ids.length} public IDs)`, async () => {
  const f = await fixture(); f.native.post_ids = ids
  await queue.runClaimedSocialPublication({ sb: f.sb, jobId: f.ids.job, key: f.intent.key, worker: f.row.locked_by,
    now: new Date(NOW).toISOString(), enabled: true, bindings: bridge.tiktokBusinessQueueStatusBindings(f.sb, f.config, f.ids.job, f.options) })
  assert.equal(Object.hasOwn(f.row.publication.observation.tiktokStatus, 'notBefore'), false)
  f.intent.state = f.row.publication.state; f.intent.providerPostId = f.row.publication.observation.postId ?? null
  const count = f.http.length, resumed = await read(f)
  assert.equal(resumed.errorCode, 'TIKTOK_RECEIPT_REVIEW_REQUIRED'); assert.deepEqual(resumed.tiktokStatus.publicPostIds, ids)
  assert.equal(resumed.tiktokStatus.notBefore, null); assert.equal(f.http.length, count)
})
test('pending reads defer provider work for 180 seconds even while the generic queue runs every 30 seconds', async () => {
  const f = await fixture(); f.native = { status: 'PUBLISH_COMPLETE', post_ids: [] }
  const first = await read(f); assert.equal(first.state, 'processing'); assert.equal(first.tiktokStatus.notBefore, new Date(NOW + 180_000).toISOString())
  f.row.publication.observation = first; f.clock += 30_000; const count = f.http.length
  const early = await read(f); assert.equal(early.state, 'processing'); assert.equal(early.errorCode, 'TIKTOK_STATUS_READ_NOT_DUE')
  assert.deepEqual(early.tiktokStatus, first.tiktokStatus); assert.equal(f.http.length, count)
  f.clock = NOW + 180_000; const due = await read(f)
  assert.equal(due.tiktokStatus.statusReads, 2); assert.equal(f.http.length, count + 3)
})
for (const status of ['FAILED', 'SEND_TO_USER_INBOX', 'UNKNOWN']) test(`${status} cannot mark completion or authorize a resubmission`, async () => {
  const f = await fixture(); f.native = { status }; const r = await read(f)
  assert.equal(r.state, 'unknown_outcome'); assert.equal(r.tiktokStatus.statusReads, 1)
  assert.equal(r.tiktokStatus.nativeState, status === 'FAILED' ? 'failed' : 'unknown_outcome')
  assert.equal(f.rpc.length, 0)
})
for (const change of [
  f => { f.ids.job = 'bad' }, f => { f.intent.platform = 'facebook' }, f => { f.intent.providerOperationId = null },
  f => { f.intent.authorizationId = 'bad' }, f => { f.intent.assetSha256 = 'bad' }, f => { f.intent.state = 'queued' },
  f => { f.row.status = 'queued' }, f => { f.row.locked_at = new Date(NOW - 300_000).toISOString() }, f => { f.row.locked_at = new Date(NOW + 1).toISOString() },
  f => { f.row.publication.started_at = null }, f => { f.row.publication.submission_fence = null }, f => { f.row.publication.fence = null },
  f => { f.row.publication.state = 'posted' }, f => { f.row.payload.intent.clientId = randomUUID() }, f => { f.row.payload.intent.assetSha256 = 'b'.repeat(64) },
  f => { f.row.payload.intent.caption = 'different' }, f => { f.row.idempotency_key = 'different' }, f => { f.row.publication.authorization.fingerprint = 'b'.repeat(64) },
  f => { f.row.publication.authorization.actorId = randomUUID() }, f => { f.row.publication.observation.operationId = 'different-share' },
  f => { f.row.publication.late_observation = { operationId: 'foreign-share' } }, f => { f.row.publication.observation.postId = POST },
  f => { f.failures.add('background_jobs') },
]) test(`unverified canonical job stops before credentials/provider inspection: ${change.toString()}`, async () => {
  const f = await fixture(); change(f); const r = await read(f)
  assert.equal(r.state, 'unknown_outcome'); assert.equal(f.http.length, 0); assert.equal(f.rpc.length, 0)
  assert.equal(JSON.stringify(r).includes('PRIVATE'), false)
})
for (const field of ['fence', 'submission_fence', 'submission_worker', 'locked_at']) test(`concurrent ${field} change prevents native state promotion`, async () => {
  const f = await fixture(); f.onHttp = path => { if (path.endsWith('/publish/status/')) f.row.publication[field] = field === 'fence' || field === 'submission_fence' ? randomUUID() : 'changed' }
  if (field === 'locked_at') f.onHttp = path => { if (path.endsWith('/publish/status/')) f.row.locked_at = new Date(NOW - 1).toISOString() }
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(r.postId, undefined); assert.equal(r.tiktokStatus, undefined)
})
test('withdrawn publication authority still permits observation of the existing exact task', async () => {
  const f = await fixture(); f.row.publication.authorization.revokedAt = new Date(NOW).toISOString()
  const r = await read(f); assert.equal(r.tiktokStatus.nativeState, 'posted'); assert.equal(r.state, 'unknown_outcome')
  assert.equal(f.rpc.length, 0)
})
for (const change of [
  f => { f.row.publication.started_at = new Date(NOW - 20 * 60_000).toISOString() },
  f => { f.row.publication.observation.tiktokStatus = prior(f, { statusReads: 5 }) },
]) test(`bounded task review stops provider reads: ${change.toString()}`, async () => {
  const f = await fixture(); change(f); const r = await read(f)
  assert.equal(r.errorCode, 'TIKTOK_BOUNDED_REVIEW_REQUIRED'); assert.equal(f.http.length, 0)
})
for (const edits of [{ version: 2 }, { businessId: 'foreign' }, { publishId: 'foreign' }, { publicPostIds: [POST, POST] }, { publicPostIds: [7] },
  { statusReads: -1 }, { statusReads: 6 }, { checkedAt: new Date(NOW + 1).toISOString() }, { notBefore: null }, { notBefore: 'bad' }, { extra: 'secret' }]) {
  test(`invalid existing audit cannot reset the read budget: ${JSON.stringify(edits)}`, async () => {
    const f = await fixture(); f.row.publication.observation.tiktokStatus = prior(f, edits)
    const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(f.http.length, 0); assert.equal(r.tiktokStatus, undefined)
  })
}
test('SDK cancellation/deadline prevents a late row lookup from sending any credential', async () => {
  const f = await fixture(); let release
  f.onDb = () => new Promise(resolve => { release = resolve }); f.options.readTimeoutMs = 10
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); release(); await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(f.http.length, 0); assert.ok(f.db[0].signal.aborted)
})
test('terminal native evidence survives resumption without polling it again or losing IDs', async () => {
  const f = await fixture(); f.row.publication.observation.tiktokStatus = prior(f, { publicPostIds: [POST, '2345678901234567890'], nativeState: 'unknown_outcome', notBefore: null })
  const r = await read(f); assert.equal(r.errorCode, 'TIKTOK_RECEIPT_REVIEW_REQUIRED'); assert.equal(f.http.length, 0)
  assert.deepEqual(r.tiktokStatus.publicPostIds, [POST, '2345678901234567890']); assert.equal(r.postId, undefined)
})
test('fifth native read is audited; a resumed sixth attempt never reaches the provider', async () => {
  const f = await fixture(); f.native = { status: 'PROCESSING_DOWNLOAD' }; f.row.publication.observation.tiktokStatus = prior(f, { statusReads: 4 })
  const fifth = await read(f); assert.equal(fifth.state, 'processing'); assert.equal(fifth.tiktokStatus.statusReads, 5)
  f.row.publication.observation = fifth; const count = f.http.length; f.clock += 30_000
  const sixth = await read(f); assert.equal(sixth.errorCode, 'TIKTOK_BOUNDED_REVIEW_REQUIRED'); assert.equal(sixth.tiktokStatus.statusReads, 5)
  assert.equal(f.http.length, count)
})
test('native timeout is bounded and late HTTP completion cannot create audit/publication output', async () => {
  const f = await fixture(); let release
  f.options.readTimeoutMs = 1000; f.onHttp = path => path.endsWith('/publish/status/') ? new Promise(resolve => { release = resolve }) : undefined
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(r.tiktokStatus, undefined)
  assert.ok(release); release(); await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(r.postId, undefined); assert.equal(f.rpc.length, 0); assert.ok(f.http.at(-1).init.signal.aborted)
})
test('private provider errors are sanitized and never cause a refresh or publish retry', async () => {
  const f = await fixture(); f.onHttp = path => { if (path.endsWith('/publish/status/')) throw new Error('PRIVATE synthetic-access') }
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(r.tiktokStatus.statusReads, 1)
  assert.equal(JSON.stringify(r).includes('PRIVATE'), false); assert.equal(JSON.stringify(r).includes('synthetic-access'), false)
  assert.equal(f.http.length, 3); assert.equal(f.rpc.length, 0)
})
test('credential verification failure never manufactures native status audit evidence', async () => {
  const f = await fixture(); f.onHttp = () => { throw new Error('PRIVATE synthetic-access') }
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(r.tiktokStatus, undefined)
  assert.equal(JSON.stringify(r).includes('synthetic-access'), false); assert.equal(f.http.length, 1)
})
test('input/configuration mutation during a pending lookup cannot retarget the captured job', async () => {
  const f = await fixture(); let release, ready
  const reached = new Promise(resolve => { ready = resolve })
  f.onDb = table => { if (table === 'background_jobs' && !release) { ready(); return new Promise(resolve => { release = resolve }) } }
  const pending = read(f); await reached
  f.intent.caption = 'Caller replacement'; f.config.encryptionKey = 'invalid'; f.options.fetch = () => { throw new Error('Caller replacement') }; release()
  const r = await pending; assert.equal(r.tiktokStatus.nativeState, 'posted'); assert.equal(r.state, 'unknown_outcome'); assert.equal(f.http.length, 3)
})
test('lost persistence preserves ambiguity and never begins/repeats provider submission', async () => {
  const f = await fixture(), originalRpc = f.sb.rpc
  f.sb.rpc = async (name, args) => name === 'save_social_publication' ? { data: false, error: null } : originalRpc(name, args)
  await assert.rejects(queue.runClaimedSocialPublication({ sb: f.sb, jobId: f.ids.job, key: f.intent.key, worker: f.row.locked_by,
    now: new Date(NOW).toISOString(), enabled: true, bindings: bridge.tiktokBusinessQueueStatusBindings(f.sb, f.config, f.ids.job, f.options) }), /persistence unavailable/)
  assert.equal(f.row.publication.state, 'processing'); assert.equal(f.row.publication.observation.postId, undefined)
  assert.equal(f.rpc.filter(r => r.name.includes('begin')).length, 0); assert.equal(f.http.length, 3)
})
test('caller abort cancels the private flow without changing queue/provider state', async () => {
  const f = await fixture(), c = new AbortController(); c.abort(); f.options.signal = c.signal
  const r = await read(f); assert.equal(r.state, 'unknown_outcome'); assert.equal(f.db.length, 0); assert.equal(f.http.length, 0); assert.equal(f.rpc.length, 0)
})
test('submission and queued preflight are deliberately unavailable on status-only bindings', async () => {
  const f = await fixture(), bindings = bridge.tiktokBusinessQueueStatusBindings(f.sb, f.config, f.ids.job, f.options)
  await assert.rejects(bindings.submit(f.intent), /not configured/); await assert.rejects(bindings.readCurrent(f.intent), /not configured/)
  f.row.publication.state = 'queued'; await assert.rejects(queue.runClaimedSocialPublication({ sb: f.sb, jobId: f.ids.job, key: f.intent.key,
    worker: f.row.locked_by, now: new Date(NOW).toISOString(), enabled: true, bindings }), /not configured/)
  assert.deepEqual(f.rpc.map(r => r.name), ['claim_social_publication']); assert.equal(f.http.length, 0)
})
test('manager status projection does not return the private multi-ID native audit', async () => {
  const f = await fixture(); f.row.publication.state = 'unknown_outcome'; f.row.status = 'failed'
  f.row.publication.observation = { state: 'unknown_outcome', operationId: f.intent.providerOperationId, errorCode: 'TIKTOK_MULTIPLE_PUBLIC_POSTS_REVIEW',
    tiktokStatus: prior(f, { publicPostIds: [POST, '2345678901234567890'], nativeState: 'unknown_outcome', notBefore: null }) }
  const r = await management.readPublicationManagementStatus(f.sb, f.ids.actor, f.ids.review)
  assert.equal(r.items.length, 1); assert.equal(r.items[0].state, 'unknown_outcome'); assert.equal(r.items[0].postUrl, null)
  assert.equal(JSON.stringify(r).includes(POST), false); assert.equal(JSON.stringify(r).includes('tiktokStatus'), false)
})
test('bridge remains unregistered in the worker and public entries', () => {
  for (const file of ['supabase/functions/background-worker/index.ts', 'supabase/functions/social-publication/index.ts', 'supabase/config.toml']) {
    assert.equal(readFileSync(file, 'utf8').includes('tiktokBusinessQueueStatusBindings'), false)
  }
})
