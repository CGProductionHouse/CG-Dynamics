import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

let server, runtimeModule, staff, storeModule, queue, tokenModule, inspection, mcpReadiness
const originalFetch = globalThis.fetch
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  runtimeModule = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublicationRuntime.ts')
  staff = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublicationStaff.ts')
  storeModule = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorizationStore.ts')
  queue = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingQueue.ts')
  tokenModule = await server.ssrLoadModule('/supabase/functions/_shared/metaTokenStorage.ts')
  inspection = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublicationInspection.ts')
  mcpReadiness = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/facebookPostReadiness.ts')
})

test('read-only inspection verifies the mapped Page and original image while Teams is held and dispatch stays disabled', async () => {
  const f = await fixture(), rpc = f.sb.rpc
  f.sb.rpc = async (name, args) => name === 'read_social_publication_schedule_evidence' ? { data: null, error: {} } : rpc(name, args)
  const inspect = inspection.facebookPublicationInspector(f.sb, f.config, null)
  const report = await inspect(f.ids.review, f.ids.actor)
  assert.equal(report.canConfirm, false); assert.equal(report.canPublish, false)
  assert.equal(report.accountId, '123')
  assert.equal(report.checks.find(c => c.key === 'account').status, 'pass')
  assert.equal(report.checks.find(c => c.key === 'image').status, 'pass')
  assert.equal(report.checks.find(c => c.key === 'teams').status, 'unavailable')
  assert.equal(report.checks.find(c => c.key === 'release').status, 'blocked')
  assert.equal(f.graphCalls.some(c => c[0] !== 'GET'), false)
  assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  assert.equal(f.tables.background_jobs.length, 0)
  assert.equal(JSON.stringify(report).includes('fixture-user-token'), false)
})
after(async () => { try { await server?.close() } finally { globalThis.fetch = originalFetch } })
function staticPng() {
  function chunk(type, data) {
    const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8)
    let crc = -1; for (const v of b.subarray(4, -4)) { crc ^= v; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    b.writeUInt32BE((crc ^ -1) >>> 0, b.length - 4); return b
  }
  const h = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', deflateSync(Buffer.alloc(18))), chunk('IEND', Buffer.alloc(0))])
}
async function fixture(options = {}) {
  const now = Date.now(), due = new Date(now + 60_000).toISOString(), ids = Object.fromEntries(['actor', 'client', 'connection', 'review', 'deliverable', 'job'].map(k => [k, randomUUID()]))
  const release = { approved: true, clientId: ids.client, connectionId: ids.connection, accountId: '123', route: 'facebook_page' }
  const config = { graphVersion: 'v27.0', appId: '789', appSecret: 'fixture-app-secret', projectUrl: 'https://fixture.supabase.co',
    encryptionKey: Buffer.alloc(32, 3).toString('base64'), keyVersion: 'v1' }
  const image = staticPng(), date = new Date(Date.parse(due) + 7200_000).toISOString().slice(0, 10)
  const tables = { profiles: [{ id: ids.actor, role: 'manager', is_active: true }], clients: [{ id: ids.client, active: true }],
    content_review_versions: [{ id: ids.review, client_id: ids.client, deliverable_id: ids.deliverable, state: 'approved', asset_path: `${ids.deliverable}/approved.png`, media_type: 'image/png', channels: ['facebook'], caption: 'Exact approved caption', scheduled_at: due }],
    monthly_deliverables: [{ id: ids.deliverable, client_id: ids.client, scheduled_date: date, production_status: 'not_started', archived_at: null, posted_at: null, microsoft_task_id: 'fixture-task' }],
    meta_client_assets: [{ id: randomUUID(), client_id: ids.client, connection_id: ids.connection, facebook_page_id: '123', is_active: true }],
    meta_connections: [{ id: ids.connection, status: 'connected' }],
    meta_connection_tokens: [{ connection_id: ids.connection, encrypted_access_token: await tokenModule.encryptMetaStoredToken('fixture-user-token', ids.connection, config.encryptionKey, 'v1') }], background_jobs: [] }
  const calls = [], graphCalls = []
  let mode = 'success'
  const sb = { from(table) {
    const filters = []; const q = { select() { return q }, eq(k, v) { filters.push([k, v]); return q }, async maybeSingle() {
      calls.push(['read', table]); const found = tables[table].filter(row => filters.every(([k, v]) => row[k] === v))
      return { data: found.length === 1 ? structuredClone(found[0]) : null, error: found.length > 1 ? {} : null }
    } }; return q
  }, storage: { from(bucket) { assert.equal(bucket, 'content-review-snapshots'); return {
    async download(path) { calls.push(['download', path]); return { data: new Blob([image], { type: 'image/png' }), error: null } },
    async createSignedUrl(path, seconds) { calls.push(['sign', path]); assert.equal(seconds, 300); return { data: { signedUrl: `${config.projectUrl}/storage/v1/object/sign/content-review-snapshots/${path}?token=fixture-signed` }, error: null } },
  } } }, async rpc(name, args) {
    calls.push(['rpc', name, args])
    if (name === 'read_social_publication_schedule_evidence') return { error: null, data: { contract: 'social_publication_schedule_evidence_v1', clientId: ids.client, deliverableId: ids.deliverable, reviewVersionId: ids.review,
      recordId: 'fixture-task', revision: 'a'.repeat(64), scheduledDate: date, checkedAt: new Date().toISOString(), capturedAt: new Date().toISOString() } }
    if (name === 'authorize_social_publication') {
      assert.equal(args.p_actor, ids.actor)
      if (!tables.background_jobs.length) tables.background_jobs.push({ id: ids.job, job_type: 'social_publish', status: 'queued', payload: { intent: args.p_intent, authorized_by: args.p_actor }, publication: {
        state: 'queued', authorization: { id: args.p_intent.authorizationId, actorId: ids.actor, fingerprint: args.p_fingerprint, confirmedAt: new Date().toISOString(), revokedAt: null } } })
      const job = tables.background_jobs[0]
      return { error: null, data: { jobId: job.id, authorizationId: job.payload.intent.authorizationId, fingerprint: job.publication.authorization.fingerprint, status: job.status, state: job.publication.state } }
    }
    const job = tables.background_jobs[0]
    if (name === 'claim_social_publication') return { error: null, data: { key: job.payload.intent.key, fence: randomUUID(), intent: job.payload.intent, state: job.publication.state, observation: job.publication.observation, attempt: 0 } }
    if (name === 'begin_social_publication') { job.publication.state = 'submitting'; job.publication.started_at = due; return { data: true, error: null } }
    if (name === 'save_social_publication') { job.publication.state = args.p_observation.state; job.publication.observation = args.p_observation; return { data: true, error: null } }
    throw new Error(`Unexpected RPC ${name}`)
  } }
  globalThis.fetch = async (raw, init = {}) => {
    const u = new URL(raw); graphCalls.push([init.method ?? 'GET', u.pathname]); assert.equal(u.origin, 'https://graph.facebook.com')
    const path = u.pathname.replace('/v27.0', '')
    if (path === '/debug_token') return Response.json({ data: { app_id: '789', is_valid: true, type: 'USER', expires_at: Math.floor(now / 1000) + 3600,
      data_access_expires_at: Math.floor(now / 1000) + 7200, scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] } })
    if (path === '/me/permissions') return Response.json({ data: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].map(permission => ({ permission, status: 'granted' })) })
    if (path === '/me/accounts') return Response.json({ data: [{ id: '123', access_token: 'fixture-page-token', tasks: ['CREATE_CONTENT'] }] })
    if (path === '/me') return Response.json({ id: '123', name: 'Synthetic verified Page' })
    if (path === '/123/photos') { if (mode === 'timeout') throw new Error('PRIVATE lost response'); return Response.json({ id: '456', post_id: '123_789' }) }
    if (path === '/123_789') return Response.json({ id: '123_789', is_published: true })
    throw new Error('Unexpected network route')
  }
  const runtime = runtimeModule.facebookPublicationRuntime(sb, { server: config, release })
  const actor = { id: ids.actor, role: 'manager', active: true }
  const handler = staff.facebookPublicationStaffHandler({ runtime: options.inspectionOnly ? null : runtime, authenticate: async () => actor,
    persistence: storeModule.socialPublicationAuthorizationStore(sb), inspect: options.inspectionOnly ? inspection.facebookPublicationInspector(sb, config, null) : undefined })
  const invoke = async body => { const response = await handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) })); return { status: response.status, body: await response.json() } }
  return { sb, config, release, ids, due, tables, runtime, actor, invoke, calls, graphCalls, timeout() { mode = 'timeout' } }
}

test('inspection-only HTTP action cannot confirm, revoke, override account/source or create authority', async () => {
  const f = await fixture({ inspectionOnly: true })
  const report = await f.invoke({ action: 'inspect', reviewId: f.ids.review })
  assert.equal(report.status, 200); assert.equal(report.body.inspection.accountName, 'Synthetic verified Page')
  assert.equal(report.body.inspection.canConfirm, false); assert.equal(report.body.inspection.canPublish, false)
  for (const body of [{ action: 'confirm', reviewId: f.ids.review, expectedFingerprint: 'a'.repeat(64), confirmPublication: true },
    { action: 'revoke', reviewId: f.ids.review }, { action: 'preview', reviewId: f.ids.review }]) {
    assert.equal((await f.invoke(body)).status, 409)
  }
  for (const extra of [{ accountId: '999' }, { clientId: crypto.randomUUID() }, { rolloutApproved: true }])
    assert.equal((await f.invoke({ action: 'inspect', reviewId: f.ids.review, ...extra })).status, 400)
  assert.equal(f.tables.background_jobs.length, 0); assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  assert.equal(f.calls.filter(c => c[0] === 'rpc' && c[1] !== 'read_social_publication_schedule_evidence').length, 0)
  assert.equal(f.graphCalls.some(c => c[0] !== 'GET'), false)
})

test('inspection refuses unapproved/foreign sources, ambiguous mappings and inactive roles before native reads', async () => {
  for (const mutate of [f => { f.tables.content_review_versions[0].state = 'draft' }, f => { f.tables.clients[0].active = false },
    f => { f.tables.content_review_versions[0].client_id = crypto.randomUUID() }, f => { f.tables.meta_client_assets.push({ ...f.tables.meta_client_assets[0] }) },
    f => { f.tables.profiles[0].is_active = false }, f => { f.tables.profiles[0].role = 'staff' }]) {
    const f = await fixture({ inspectionOnly: true }); mutate(f)
    const result = await f.invoke({ action: 'inspect', reviewId: f.ids.review })
    assert.ok([403, 409].includes(result.status)); assert.equal(f.graphCalls.length, 0)
    assert.equal(f.tables.background_jobs.length, 0); assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  }
})

test('inspection never turns inaccessible provider/media evidence into passing checks or raw private errors', async () => {
  const f = await fixture({ inspectionOnly: true })
  f.tables.meta_connection_tokens.length = 0
  const storage = f.sb.storage.from
  f.sb.storage.from = () => ({ ...storage('content-review-snapshots'), async download() { throw Error('PRIVATE secret-token') } })
  const result = await f.invoke({ action: 'inspect', reviewId: f.ids.review })
  assert.equal(result.status, 200)
  assert.equal(result.body.inspection.checks.find(c => c.key === 'account').status, 'unavailable')
  assert.equal(result.body.inspection.checks.find(c => c.key === 'image').status, 'unavailable')
  assert.equal(result.body.inspection.assetSha256, null)
  assert.equal(JSON.stringify(result.body).includes('secret-token'), false)
  assert.equal(f.tables.background_jobs.length, 0)
})

test('inspection gate is independent from publication gates and cannot manufacture a release', async () => {
  const f = await fixture(), settings = { SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED: 'true', META_GRAPH_VERSION: f.config.graphVersion,
    META_APP_ID: f.config.appId, META_APP_SECRET: f.config.appSecret, SUPABASE_URL: f.config.projectUrl,
    META_TOKEN_ENCRYPTION_KEY_B64: f.config.encryptionKey, META_TOKEN_ENCRYPTION_KEY_VERSION: f.config.keyVersion }
  assert.equal(runtimeModule.readFacebookInspectionConfiguration(k => settings[k]).appId, f.config.appId)
  assert.equal(runtimeModule.readFacebookPublicationConfiguration(k => settings[k]), null)
  assert.equal(runtimeModule.readFacebookStaffConfiguration(k => settings[k]), null)
  for (const key of Object.keys(settings)) assert.equal(runtimeModule.readFacebookInspectionConfiguration(k => key === k ? undefined : settings[k]), null)
})

test('a source, mapping or role change during native inspection invalidates the report', async () => {
  for (const mutate of [f => { f.tables.content_review_versions[0].caption += ' changed' },
    f => { f.tables.profiles[0].role = 'staff' }, f => { f.tables.meta_client_assets[0].facebook_page_id = '999' },
    f => { f.tables.monthly_deliverables[0].microsoft_task_id = 'another-task' }]) {
    const f = await fixture({ inspectionOnly: true }), original = globalThis.fetch
    globalThis.fetch = async (raw, init) => { const response = await original(raw, init); if (new URL(raw).pathname === '/v27.0/me') mutate(f); return response }
    assert.equal((await f.invoke({ action: 'inspect', reviewId: f.ids.review })).status, 409)
    assert.equal(f.tables.background_jobs.length, 0)
  }
})

test('actual MCP exact-review adapter reuses the native inspector, refuses cross-client reviews and cannot authorize', async () => {
  const f = await fixture(), settings = { SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED: 'true', META_GRAPH_VERSION: f.config.graphVersion,
    META_APP_ID: f.config.appId, META_APP_SECRET: f.config.appSecret, SUPABASE_URL: f.config.projectUrl,
    META_TOKEN_ENCRYPTION_KEY_B64: f.config.encryptionKey, META_TOKEN_ENCRYPTION_KEY_VERSION: f.config.keyVersion }
  const result = await mcpReadiness.readFacebookPostReadiness(f.sb, f.ids.actor, { client_id: f.ids.client, review_id: f.ids.review }, key => settings[key])
  assert.equal(result.data_state, 'available'); assert.equal(result.inspection.accountName, 'Synthetic verified Page')
  assert.equal(result.canPublish, false); assert.equal(result.canConfirm, false)
  const before = f.graphCalls.length, foreign = crypto.randomUUID()
  f.tables.clients.push({ id: foreign, active: true })
  const refused = await mcpReadiness.readFacebookPostReadiness(f.sb, f.ids.actor, { client_id: foreign, review_id: f.ids.review }, key => settings[key])
  assert.equal(refused.data_state, 'unavailable'); assert.equal(f.graphCalls.length, before)
  assert.equal(f.tables.background_jobs.length, 0); assert.equal(f.graphCalls.some(c => c[0] !== 'GET'), false)
})

test('concrete read-only preview → exact confirmation → worker submission → separate verified receipt uses one existing queue', async () => {
  const f = await fixture(), preview = await f.invoke({ action: 'preview', reviewId: f.ids.review })
  assert.equal(preview.status, 200); assert.equal(f.tables.background_jobs.length, 0)
  assert.equal(f.calls.some(c => c[0] === 'sign'), false); assert.equal(f.graphCalls.some(c => c[0] === 'POST'), false)
  const confirmation = { action: 'confirm', reviewId: f.ids.review, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true }
  const first = await f.invoke(confirmation), repeated = await f.invoke(confirmation)
  assert.equal(first.status, 200); assert.deepEqual(first, repeated); assert.equal(f.tables.background_jobs.length, 1)
  assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  const job = f.tables.background_jobs[0], bindings = f.runtime.workerBindings(job.id)
  const dispatch = () => queue.runClaimedSocialPublication({ sb: f.sb, jobId: job.id, key: job.payload.intent.key, worker: 'fixture-worker', now: f.due, enabled: true, bindings })
  const result = await dispatch(); assert.equal(result.publication.state, 'processing')
  assert.equal(f.graphCalls.filter(c => c[0] === 'POST').length, 1)
  assert.equal((await dispatch()).publication.state, 'posted')
  assert.equal(f.graphCalls.filter(c => c[0] === 'POST').length, 1)
  assert.equal(f.tables.monthly_deliverables[0].production_status, 'not_started') // No Microsoft/canonical staff edits.
  assert.equal(JSON.stringify(first.body).includes('fixture-'), false)
})

test('changed approved caption invalidates preview before atomic authorization; injected client/account/proof fields are rejected', async () => {
  const f = await fixture(), preview = await f.invoke({ action: 'preview', reviewId: f.ids.review })
  f.tables.content_review_versions[0].caption += ' changed'
  const result = await f.invoke({ action: 'confirm', reviewId: f.ids.review, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true })
  assert.equal(result.status, 409); assert.equal(f.tables.background_jobs.length, 0)
  for (const extra of [{ clientId: randomUUID() }, { accountId: '999' }, { rolloutApproved: true }, { target: {} }, { caption: 'caller' }]) {
    assert.equal((await f.invoke({ action: 'preview', reviewId: f.ids.review, ...extra })).status, 400)
  }
  assert.equal(f.graphCalls.some(c => c[0] === 'POST'), false)
})

test('lost provider response remains unknown, reconciles without another POST, and foreign releases cannot use any binding', async () => {
  const f = await fixture(), p = await f.invoke({ action: 'preview', reviewId: f.ids.review })
  await f.invoke({ action: 'confirm', reviewId: f.ids.review, expectedFingerprint: p.body.preview.fingerprint, confirmPublication: true })
  f.timeout()
  const job = f.tables.background_jobs[0], bindings = f.runtime.workerBindings(job.id)
  const dispatch = () => queue.runClaimedSocialPublication({ sb: f.sb, jobId: job.id, key: job.payload.intent.key, worker: 'fixture', now: f.due, enabled: true, bindings })
  assert.equal((await dispatch()).publication.state, 'unknown_outcome')
  assert.equal((await dispatch()).publication.state, 'unknown_outcome')
  assert.equal(f.graphCalls.filter(c => c[0] === 'POST').length, 1)
  for (const change of [{ accountId: '999' }, { platform: 'youtube' }, { clientId: randomUUID() }]) {
    for (const method of ['readCurrent', 'submit', 'reconcile']) await assert.rejects(bindings[method]({ ...job.payload.intent, ...change }), /Exact publication release/)
  }
})

test('due-time preflight failure is persisted for manager action, without a provider attempt or blind retry', async () => {
  for (const code of ['FRESH_TEAMS_EVIDENCE_REQUIRED', 'PRIVATE_PREFLIGHT_UNAVAILABLE', 'PRIVATE token=secret']) {
    const f = await fixture(), p = await f.invoke({ action: 'preview', reviewId: f.ids.review })
    await f.invoke({ action: 'confirm', reviewId: f.ids.review, expectedFingerprint: p.body.preview.fingerprint, confirmPublication: true })
    const job = f.tables.background_jobs[0]
    const bindings = { ...f.runtime.workerBindings(job.id), async readCurrent() { throw Object.assign(new Error(code), { code }) } }
    const result = await queue.runClaimedSocialPublication({ sb: f.sb, jobId: job.id, key: job.payload.intent.key, worker: 'fixture', now: f.due, enabled: true, bindings })
    assert.equal(result.publication.state, 'blocked')
    assert.equal(result.publication.errorCode, code.startsWith('PRIVATE token') ? 'PUBLICATION_PREFLIGHT_UNAVAILABLE' : code)
    assert.equal(job.publication.state, 'blocked'); assert.equal(job.publication.started_at, undefined)
    assert.equal(f.graphCalls.filter(c => c[0] === 'POST').length, 0)
    assert.equal(JSON.stringify(result).includes('secret'), false)
  }
})

test('inactive actor and missing rollout fail before any candidate, media, provider or queue access', async () => {
  const f = await fixture(); f.actor.active = false
  assert.equal((await f.invoke({ action: 'preview', reviewId: f.ids.review })).status, 403)
  const disabled = staff.facebookPublicationStaffHandler({ runtime: null, authenticate: async () => ({ ...f.actor, active: true }), persistence: storeModule.socialPublicationAuthorizationStore(f.sb) })
  assert.equal((await disabled(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 409)
  assert.equal(f.calls.length, 0); assert.equal(f.graphCalls.length, 0)
})

test('default-off configuration needs both gates, exact release and existing Meta settings; no defaults or caller booleans', async () => {
  const f = await fixture(), env = { SOCIAL_PUBLISHING_ENABLED: 'true', SOCIAL_FACEBOOK_PHOTO_ENABLED: 'true',
    SOCIAL_FACEBOOK_PHOTO_RELEASE: JSON.stringify({ clientId: f.ids.client, connectionId: f.ids.connection, accountId: '123' }),
    META_GRAPH_VERSION: 'v27.0', META_APP_ID: '789', META_APP_SECRET: 'fixture', SUPABASE_URL: 'https://fixture.supabase.co',
    META_TOKEN_ENCRYPTION_KEY_B64: 'fixture-only', META_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' }
  const read = value => runtimeModule.readFacebookPublicationConfiguration(k => value[k])
  assert.equal(read(env).release.accountId, '123')
  for (const key of Object.keys(env)) assert.equal(read({ ...env, [key]: undefined }), null, key)
  for (const change of [{ SOCIAL_FACEBOOK_PHOTO_RELEASE: '{}' }, { SOCIAL_FACEBOOK_PHOTO_RELEASE: JSON.stringify({ ...f.release }) },
    { SUPABASE_URL: 'https://user:secret@fixture.supabase.co' }, { META_GRAPH_VERSION: 'latest' }, { SOCIAL_PUBLISHING_ENABLED: 'TRUE' }]) assert.equal(read({ ...env, ...change }), null)
  assert.throws(() => runtimeModule.facebookPublicationRuntime(f.sb, { server: f.config, release: { ...f.release, route: 'instagram_login' } }), /release unavailable/)
})

test('actual authorization Edge entry honors preflight, authentication, active profile and default-off gate without provider/secret access', async () => {
  const f = await fixture(), envReads = []
  let handler, allowed = true
  const code = ts.transpileModule(readFileSync('supabase/functions/social-publication-authorization/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports: {}, Response, Headers, Request,
    Deno: { env: { get(name) { envReads.push(name); return undefined } }, serve(fn) { handler = fn } },
    require(name) {
      if (name.endsWith('/auth.ts')) return { requireAdminOrManager: async () => allowed ? { ok: true, value: { supabase: f.sb, user: { id: f.ids.actor } } } : { ok: false, status: 401 } }
      if (name.endsWith('/cors.ts')) return { corsHeaders: { 'Access-Control-Allow-Origin': 'https://fixture.invalid' } }
      if (name.endsWith('/facebookPublicationRuntime.ts')) return runtimeModule
      if (name.endsWith('/facebookPublicationStaff.ts')) return staff
      if (name.endsWith('/facebookPublicationInspection.ts')) return inspection
      if (name.endsWith('/socialPublicationAuthorizationStore.ts')) return storeModule
      throw new Error(`Unexpected Edge import ${name}`)
    } })
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'OPTIONS' }))).status, 200)
  assert.equal(envReads.length, 0); assert.equal(f.calls.length, 0)
  allowed = false
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 401)
  assert.equal(envReads.length, 0)
  allowed = true
  const disabled = await handler(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))
  assert.equal(disabled.status, 409); assert.equal(disabled.headers.get('cache-control'), 'no-store')
  assert.equal(disabled.headers.get('access-control-allow-origin'), 'https://fixture.invalid')
  assert.deepEqual(envReads, ['SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED', 'SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED'])
  f.tables.profiles[0].is_active = false
  assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 403)
  assert.equal(f.graphCalls.length, 0)
  assert.equal(f.calls.some(c => ['sign', 'rpc'].includes(c[0])), false)
})
