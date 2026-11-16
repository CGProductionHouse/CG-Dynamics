import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

let server, auth, policy, storage
before(async () => {
  server = await createServer({ logLevel: 'error', configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false } })
  auth = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
  storage = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorizationStore.ts')
})
after(async () => server?.close())
const NOW = Date.parse('2026-11-16T10:00:00Z'), actorId = randomUUID(), jobId = randomUUID()
function fixture() {
  const target = { clientId: randomUUID(), deliverableId: randomUUID(), reviewVersionId: randomUUID(), connectionId: randomUUID(), accountId: '12345', route: 'facebook_page' }
  const context = { review: { id: target.reviewVersionId, deliverable_id: target.deliverableId, client_id: target.clientId, state: 'approved',
    asset_path: `${target.deliverableId}/approved.jpg`, media_type: 'image/jpeg', caption: 'A café special — R99 🛠️', channels: ['facebook'], scheduled_at: '2026-11-17T08:00:00Z' },
    deliverable: { id: target.deliverableId, client_id: target.clientId, scheduled_date: '2026-11-17', archived_at: null, posted_at: null },
    binding: { clientId: target.clientId, connectionId: target.connectionId, accountId: target.accountId, route: target.route, active: true,
      grantedScopes: ['pages_manage_posts', 'pages_read_engagement'], tokenValidUntil: '2026-11-18T10:00:00Z', appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true },
    authorization: null, assetSha256: 'a'.repeat(64), teamsScheduleVerified: true, rolloutApproved: true }
  const tentative = () => ({ ...context, authorization: { id: randomUUID(), reviewVersionId: context.review.id, clientId: context.review.client_id,
    connectionId: context.binding.connectionId, accountId: context.binding.accountId, route: context.binding.route,
    scheduledAt: context.review.scheduled_at, assetSha256: context.assetSha256 } })
  const intent = () => policy.preparePublishingIntent(tentative()).intent
  const calls = [], jobs = new Map()
  const ports = { authenticate: async () => ({ id: actorId, role: 'manager', active: true }), async readCandidate(t, by) {
    calls.push(['read', t, by])
    const i = intent()
    return { context, evidence: { intentFingerprint: i ? await auth.socialPublicationFingerprint(i) : 'b'.repeat(64), checkedAt: new Date(NOW).toISOString(), teamsRecordId: 'fixture-task', teamsRevision: 'rev-1', mediaProfile: 'facebook-photo-reviewed' } }
  }, async authorize(i, by, fingerprint, evidence) {
    calls.push(['authorize', i, by, fingerprint, evidence])
    if (!jobs.has(i.key)) jobs.set(i.key, { jobId, authorizationId: i.authorizationId, fingerprint, status: 'queued', state: 'queued' })
    return jobs.get(i.key)
  }, async revoke(id, client, by) { calls.push(['revoke', id, client, by]); return { jobId: id, status: 'cancelled', state: 'cancelled', authorizationRevoked: true, providerMayHaveStarted: false } } }
  return { target, context, calls, ports, intent, jobs }
}
const request = body => new Request('https://fixture.invalid/authorization', { method: 'POST', body: JSON.stringify(body) })
async function invoke(f, body, enabled = true) {
  const response = await auth.socialPublicationAuthorizationHandler(f.ports, enabled, () => NOW)(request(body))
  return { status: response.status, body: await response.json(), response }
}

test('preview is read-only; explicit confirmation uses server identity and re-read source; repeat is idempotent', async () => {
  const f = fixture(), before = await invoke(f, { action: 'preview', target: f.target })
  assert.equal(before.status, 200)
  assert.equal(f.jobs.size, 0)
  assert.equal(f.calls.length, 1)
  assert.equal(before.response.headers.get('cache-control'), 'no-store')
  assert.equal(before.body.preview.caption, f.context.review.caption)
  assert.equal(before.body.preview.assetSha256, f.context.assetSha256)
  const body = { action: 'confirm', target: f.target, expectedFingerprint: before.body.preview.fingerprint, confirmPublication: true }
  const first = await invoke(f, body), second = await invoke(f, body)
  assert.equal(first.status, 200); assert.deepEqual(first.body, second.body); assert.equal(f.jobs.size, 1)
  assert.equal(f.calls.filter(c => c[0] === 'read').length, 3)
  assert.equal(f.calls.find(c => c[0] === 'authorize')[2], actorId)
  assert.equal(f.context.authorization, null) // Preview never mutates creative approval/context.
  assert.equal(JSON.stringify(first.body).includes('teamsRecordId'), false)
  assert.equal(JSON.stringify(first.body).includes('assetPath'), false)
})

for (const [name, change] of [
  ['caption', f => { f.context.review.caption += ' amended' }], ['approved bytes', f => { f.context.assetSha256 = 'b'.repeat(64) }],
  ['asset path', f => { f.context.review.asset_path = `${f.target.deliverableId}/new.jpg` }],
  ['time', f => { f.context.review.scheduled_at = '2026-11-17T09:00:00Z' }],
]) test(`confirmation rejects changed ${name} instead of enqueueing unseen content`, async () => {
  const f = fixture(), preview = await invoke(f, { action: 'preview', target: f.target }); change(f)
  const result = await invoke(f, { action: 'confirm', target: f.target, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true })
  assert.equal(result.status, 409); assert.equal(result.body.error, 'PUBLICATION_PREVIEW_CHANGED'); assert.equal(f.jobs.size, 0)
})

for (const [name, change] of [
  ['superseded review', f => { f.context.review.state = 'superseded' }],
  ['unverified Teams instruction', f => { f.context.teamsScheduleVerified = false }],
  ['unreviewed media contract', f => { f.context.binding.mediaContractVerified = false }],
  ['missing provider rights', f => { f.context.binding.grantedScopes = [] }],
  ['disabled rollout', f => { f.context.rolloutApproved = false }],
  ['expired credential', f => { f.context.binding.tokenValidUntil = '2026-11-15T10:00:00Z' }],
  ['past time', f => { f.context.review.scheduled_at = '2026-11-15T10:00:00Z'; f.context.deliverable.scheduled_date = '2026-11-15' }],
]) test(`server ${name} blocks all authorization writes`, async () => {
  const f = fixture(); change(f)
  assert.equal((await invoke(f, { action: 'preview', target: f.target })).status, 409)
  assert.equal(f.jobs.size, 0)
})

test('client/staff/inactive/missing identities and disabled server gate stop before private reads', async () => {
  for (const identity of [null, { id: actorId, role: 'client', active: true }, { id: actorId, role: 'staff', active: true },
    { id: actorId, role: 'manager', active: false }, { id: 'forged', role: 'manager', active: true }]) {
    const f = fixture(); f.ports.authenticate = async () => identity
    assert.equal((await invoke(f, { action: 'preview', target: f.target })).status, 403); assert.equal(f.calls.length, 0)
  }
  const f = fixture()
  assert.equal((await invoke(f, { action: 'preview', target: f.target }, false)).status, 409); assert.equal(f.calls.length, 0)
})

test('request cannot supply actor, source, provider/media/Teams proof or omit explicit confirmation', async () => {
  const f = fixture()
  for (const body of [
    { action: 'preview', target: f.target, actorId: randomUUID() },
    { action: 'preview', target: f.target, rolloutApproved: true },
    { action: 'preview', target: { ...f.target, mediaContractVerified: true } },
    { action: 'confirm', target: f.target, expectedFingerprint: 'a'.repeat(64), confirmPublication: false },
    { action: 'confirm', target: f.target, expectedFingerprint: 'a'.repeat(64), confirmPublication: 'true' },
    { action: 'confirm', target: f.target, expectedFingerprint: 'a'.repeat(64) },
  ]) assert.equal((await invoke(f, body)).status, 400)
  assert.equal(f.calls.length, 0)
})

test('foreign context, stale preflight, missing or foreign proof fail closed', async () => {
  const f = fixture(), read = f.ports.readCandidate
  for (const mutate of [
    c => { c.context.binding.accountId = '999' }, c => { c.evidence.checkedAt = new Date(NOW - 300_001).toISOString() },
    c => { c.evidence.checkedAt = new Date(NOW + 30_001).toISOString() }, c => { c.evidence.intentFingerprint = 'c'.repeat(64) },
    c => { c.evidence.teamsRecordId = '' }, c => { c.evidence.untrustedUrl = 'https://private.invalid' }, c => { c.evidence = null },
  ]) {
    f.ports.readCandidate = async (...args) => { const c = structuredClone(await read(...args)); mutate(c); return c }
    assert.equal((await invoke(f, { action: 'preview', target: f.target })).status, 409)
  }
  assert.equal(f.jobs.size, 0)
})

test('bounded body and malformed/prototype/unsupported-target requests never read private context', async () => {
  const f = fixture(), handler = auth.socialPublicationAuthorizationHandler(f.ports, true, () => NOW)
  for (const body of ['{broken', 'null', '[]', JSON.stringify({ action: 'preview', target: { ...f.target, route: '__proto__' } }), ' '.repeat(8193)]) {
    assert.equal((await handler(new Request('https://fixture.invalid', { method: 'POST', body }))).status, 400)
  }
  assert.equal((await handler(new Request('https://fixture.invalid'))).status, 405)
  assert.equal(f.calls.length, 0)
})

test('durable authorization errors are sanitized, and receipts expose only selected safe fields', async () => {
  const f = fixture(), preview = await invoke(f, { action: 'preview', target: f.target })
  const body = { action: 'confirm', target: f.target, expectedFingerprint: preview.body.preview.fingerprint, confirmPublication: true }
  f.ports.authorize = async () => { throw new Error('PRIVATE TOKEN /SIGNED URL') }
  const error = await invoke(f, body)
  assert.equal(error.status, 503); assert.equal(JSON.stringify(error.body).includes('PRIVATE'), false)
  f.ports.authorize = async (_i, _actor, fingerprint) => ({ jobId, authorizationId: randomUUID(), fingerprint, status: 'queued', state: 'queued', token: 'PRIVATE TOKEN' })
  const result = await invoke(f, body)
  assert.equal(result.status, 200); assert.equal(JSON.stringify(result.body).includes('PRIVATE'), false)
  f.ports.authorize = async () => ({ jobId, authorizationId: randomUUID(), fingerprint: 'c'.repeat(64) })
  assert.equal((await invoke(f, body)).status, 503)
})

test('revocation is explicit, client scoped and does not claim provider cancellation after a start', async () => {
  const f = fixture(), body = { action: 'revoke', jobId, clientId: f.target.clientId }
  const result = await invoke(f, body)
  assert.equal(result.status, 200); assert.equal(result.body.publication.state, 'cancelled')
  assert.deepEqual(f.calls[0], ['revoke', jobId, f.target.clientId, actorId])
  f.ports.revoke = async () => ({ jobId, status: 'running', state: 'submitting', authorizationRevoked: true, providerMayHaveStarted: true })
  assert.equal((await invoke(f, body)).body.publication.providerMayHaveStarted, true)
  f.ports.revoke = async () => null
  assert.equal((await invoke(f, body)).status, 404)
})

test('worker recovers the original authorization and rejects revocation, actor removal, retargeting and fingerprint drift', async () => {
  const f = fixture(), i = f.intent(), fingerprint = await auth.socialPublicationFingerprint(i)
  const job = { id: jobId, status: 'queued', payload: { intent: i, authorized_by: actorId },
    publication: { authorization: { id: i.authorizationId, actorId, fingerprint, confirmedAt: new Date(NOW).toISOString(), revokedAt: null } } }
  const profile = { id: actorId, is_active: true, role: 'manager' }
  const sb = { from(table) { const q = { select() { return q }, eq() { return q }, async maybeSingle() { return { data: table === 'profiles' ? profile : job, error: null } } }; return q } }
  const loaded = await storage.readSocialPublicationAuthorization(sb, jobId, i)
  assert.equal(loaded.id, i.authorizationId); assert.equal(loaded.accountId, i.accountId)
  for (const change of [() => { job.status = 'cancelled' }, () => { job.publication.authorization.revokedAt = '2026-11-16T11:00:00Z' },
    () => { profile.is_active = false }, () => { job.payload.intent = { ...i, connectionId: randomUUID() } },
    () => { job.payload.intent = { ...i, authorizationId: randomUUID() } }, () => { job.payload.intent = { ...i, key: 'foreign-job' } }]) {
    job.status = 'queued'; job.publication.authorization.revokedAt = null; profile.is_active = true; job.payload.intent = i
    change(); assert.equal(await storage.readSocialPublicationAuthorization(sb, jobId, i), null)
  }
})
