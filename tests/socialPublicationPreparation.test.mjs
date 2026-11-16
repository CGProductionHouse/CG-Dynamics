import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createHash, randomUUID } from 'node:crypto'

let server, preparation, media, authorization, policy
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  preparation = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationPreparation.ts')
  media = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingMedia.ts')
  authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
})
after(async () => { await server?.close() })
const NOW = Date.parse('2026-11-16T10:00:00Z')
const bytes = Uint8Array.from([255, 216, 255, 20, 255, 217]) // Signature-only fixture; media qualification is explicitly stubbed.
const digest = createHash('sha256').update(bytes).digest('hex')
function fixture(route = 'facebook_page') {
  const target = { clientId: randomUUID(), deliverableId: randomUUID(), reviewVersionId: randomUUID(), connectionId: randomUUID(), accountId: '12345', route }
  const actorId = randomUUID(), calls = [], errors = new Set()
  const review = { id: target.reviewVersionId, client_id: target.clientId, deliverable_id: target.deliverableId, state: 'approved', asset_path: `${target.deliverableId}/exact.jpg`, media_type: 'image/jpeg',
    caption: 'Approved café caption', channels: [policy.PUBLISHING_PATHS[route].platform], scheduled_at: '2026-11-17T08:00:00Z' }
  const deliverable = { id: target.deliverableId, client_id: target.clientId, scheduled_date: '2026-11-17', archived_at: null, posted_at: null, production_status: 'not_started', microsoft_task_id: 'exact-task' }
  const proof = { contract: 'social_publication_schedule_evidence_v1', clientId: target.clientId, deliverableId: target.deliverableId, reviewVersionId: target.reviewVersionId,
    recordId: 'exact-task', revision: 'a'.repeat(64), scheduledDate: '2026-11-17', capturedAt: new Date(NOW - 60_000).toISOString(), checkedAt: new Date(NOW).toISOString() }
  const tables = { profiles: [{ id: actorId, role: 'manager', is_active: true }], clients: [{ id: target.clientId, active: true }], content_review_versions: [review], monthly_deliverables: [deliverable] }
  const sb = { from(table) {
    const filters = []
    const q = { select() { return q }, eq(k, v) { filters.push([k, v]); return q }, async maybeSingle() {
      calls.push(['read', table, filters]); const rows = tables[table].filter(r => filters.every(([k, v]) => r[k] === v))
      return { data: rows.length === 1 ? rows[0] : null, error: errors.has(table) || rows.length > 1 ? { message: 'PRIVATE ERROR' } : null }
    } }; return q
  }, async rpc(name, args) {
    calls.push(['rpc', name, args]); assert.equal(name, 'read_social_publication_schedule_evidence')
    return { data: proof, error: errors.has('schedule') ? { message: 'PRIVATE ERROR' } : null }
  }, storage: { from(bucket) { assert.equal(bucket, 'content-review-snapshots'); return {
    async download(path) { calls.push(['download', path]); return { data: new Blob([bytes], { type: 'image/jpeg' }), error: errors.has('download') ? { message: 'PRIVATE ERROR' } : null } },
    async createSignedUrl() { calls.push(['sign']); throw new Error('Preflight must not sign media') },
  } } } }
  const binding = { clientId: target.clientId, connectionId: target.connectionId, accountId: target.accountId, route: target.route,
    active: true, grantedScopes: [...policy.PUBLISHING_PATHS[route].scopes, ...(route === 'instagram_login' ? [] : ['pages_show_list'])], tokenValidUntil: '2026-11-18T10:00:00Z',
    appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: false, privateToken: 'PRIVATE TOKEN' }
  const mediaProof = { verified: true, profile: route === 'facebook_page' ? 'fixture_facebook_photo_v1' : 'instagram_baseline_jpeg_v1', checkedAt: new Date(NOW).toISOString(), privateUrl: 'https://PRIVATE.invalid' }
  const providerProof = { binding, checkedAt: new Date(NOW).toISOString() }
  const checks = { release: { ...target, approved: true }, now: () => NOW,
    async verifyProvider(selected) { calls.push(['provider', selected]); return providerProof },
    async verifyMedia(snapshot, selected) { calls.push(['media', selected]); assert.equal(snapshot.assetSha256, digest); assert.deepEqual([...snapshot.bytes], [...bytes]); return mediaProof } }
  return { target, actorId, review, deliverable, proof, binding, mediaProof, providerProof, tables, calls, errors, sb, checks }
}
const run = f => preparation.publicationCandidateReader(f.sb, f.checks)(f.target, f.actorId)

for (const route of ['instagram_login', 'instagram_facebook_login']) test(`${route} canonical preparation reuses the exact approved review and Teams evidence without publishing or signing`, async () => {
  const f = fixture(route), result = await run(f)
  assert.equal(result.context.binding.route, route)
  assert.deepEqual(result.context.review.channels, ['instagram'])
  assert.equal(result.context.assetSha256, digest)
  assert.equal(result.context.authorization, null)
  assert.equal(result.evidence.mediaProfile, 'instagram_baseline_jpeg_v1')
  assert.equal(result.context.binding.grantedScopes.includes('pages_manage_posts'), false)
  assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
})

for (const route of ['instagram_login', 'instagram_facebook_login']) test(`${route} cannot use foreign route grants or a Facebook media proof`, async () => {
  for (const change of [f => { f.binding.grantedScopes = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] },
    f => { f.binding.route = route === 'instagram_login' ? 'instagram_facebook_login' : 'instagram_login' },
    f => { f.mediaProof.profile = 'facebook_static_png_v1' }, f => { f.checks.release.route = 'facebook_page' }]) {
    const f = fixture(route); change(f)
    await assert.rejects(run(f)); assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  }
})

test('Instagram PNG/video or an unapproved channel stops before snapshot/provider access and an oversized JPEG before body materialization', async () => {
  for (const type of ['image/png', 'video/mp4']) {
    const f = fixture('instagram_login'); f.review.media_type = type
    await assert.rejects(run(f), /REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED/)
    assert.equal(f.calls.some(c => ['download', 'provider', 'media'].includes(c[0])), false)
  }
  const f = fixture('instagram_login'); f.review.channels = ['facebook']
  await assert.rejects(run(f), /CURRENT_UNSCHEDULED_REVIEW_REQUIRED/)
  assert.equal(f.calls.some(c => ['download', 'provider', 'media'].includes(c[0])), false)
  const large = fixture('instagram_login'); let read = false
  large.sb.storage.from = () => ({ download: async () => ({ data: { size: 8_000_001, type: 'image/jpeg', arrayBuffer() { read = true; throw new Error('PRIVATE') } }, error: null }) })
  await assert.rejects(run(large)); assert.equal(read, false)
})

test('provider completion after thirty seconds is checked against completion time rather than a stale entry clock', async () => {
  const f = fixture(); let clock = NOW
  f.checks.now = () => clock
  f.checks.verifyProvider = async () => { clock += 31_000; return { ...f.providerProof, checkedAt: new Date(clock).toISOString() } }
  const result = await run(f)
  assert.equal(result.evidence.checkedAt, new Date(clock).toISOString())
})

test('invalid Instagram captions fail canonical preparation before private bytes and provider checks', async () => {
  const f = fixture('instagram_login'); f.review.caption = 'x'.repeat(2201)
  await assert.rejects(run(f), /INSTAGRAM_CAPTION_TOO_LONG/)
  assert.equal(f.calls.some(c => ['download', 'media', 'provider'].includes(c[0])), false)
})

test('actual confirmation core reports the specific Instagram caption blocker with no queue write or raw private text', async () => {
  for (const [caption, code] of [['PRIVATE'.repeat(400), 'INSTAGRAM_CAPTION_TOO_LONG'], ['#PRIVATE '.repeat(31), 'INSTAGRAM_HASHTAG_LIMIT'],
    ['@PRIVATE '.repeat(21), 'INSTAGRAM_MENTION_LIMIT'], ['PRIVATE\ud800', 'INSTAGRAM_CAPTION_INVALID']]) {
    const f = fixture('instagram_login'); f.review.caption = caption; let writes = 0
    const handler = authorization.socialPublicationAuthorizationHandler({ authenticate: async () => ({ id: f.actorId, role: 'manager', active: true }),
      readCandidate: preparation.publicationCandidateReader(f.sb, f.checks), authorize: async () => { writes++; throw new Error('No write') }, revoke: async () => null }, true)
    const response = await handler(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ action: 'preview', target: f.target }) }))
    assert.equal(response.status, 409)
    const body = await response.json(); assert.deepEqual(body.blockers, [code]); assert.equal(JSON.stringify(body).includes('PRIVATE'), false)
    assert.equal(writes, 0); assert.equal(f.calls.some(c => ['download', 'provider', 'media', 'sign'].includes(c[0])), false)
  }
})

test('capture and token freshness must still hold after a long private preflight', async () => {
  for (const scenario of ['capture', 'token']) {
    const f = fixture(); let clock = NOW
    f.checks.now = () => clock
    if (scenario === 'token') f.binding.tokenValidUntil = new Date(NOW + 140_000).toISOString()
    f.checks.verifyProvider = async () => { clock += scenario === 'capture' ? 301_000 : 31_000; return f.providerProof }
    await assert.rejects(run(f))
  }
})

test('canonical preparation derives the approved hash without URLs/writes and returns only bounded server evidence', async () => {
  const f = fixture(), result = await run(f)
  assert.equal(result.context.assetSha256, digest); assert.equal(result.context.authorization, null)
  assert.equal(result.context.binding.mediaContractVerified, true)
  assert.equal(result.evidence.teamsRecordId, f.deliverable.microsoft_task_id)
  assert.match(result.evidence.intentFingerprint, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false); assert.equal(JSON.stringify(result).includes('bytes'), false)
  assert.equal(f.calls.some(c => c[0] === 'sign'), false)
  assert.deepEqual(f.calls.find(c => c[0] === 'rpc')[2], { p_actor: f.actorId, p_deliverable: f.target.deliverableId, p_review: f.target.reviewVersionId })
  const tentative = { ...result.context, authorization: { id: randomUUID(), reviewVersionId: f.review.id, clientId: f.target.clientId,
    connectionId: f.target.connectionId, accountId: f.target.accountId, route: f.target.route, scheduledAt: f.review.scheduled_at, assetSha256: digest } }
  assert.equal(await authorization.socialPublicationFingerprint(policy.preparePublishingIntent(tentative).intent), result.evidence.intentFingerprint)
})

test('snapshot inspection derives bytes independently and never invokes signing', async () => {
  const f = fixture(), source = { clientId: f.target.clientId, deliverableId: f.target.deliverableId, reviewVersionId: f.target.reviewVersionId,
    platform: 'facebook', assetPath: f.review.asset_path, mediaType: f.review.media_type, caption: f.review.caption, scheduledAt: f.review.scheduled_at }
  assert.equal((await media.inspectPublicationSnapshot(f.sb, source)).assetSha256, digest)
  await assert.rejects(media.inspectPublicationSnapshot(f.sb, { ...source, assetSha256: 'b'.repeat(64) }))
  assert.equal(f.calls.some(c => c[0] === 'sign'), false)
})

test('roles, inactive clients, wrong release and canonical scheduled state fail before provider/media access', async () => {
  for (const change of [
    f => { f.tables.profiles[0].role = 'client' }, f => { f.tables.profiles[0].is_active = false },
    f => { f.tables.clients[0].active = false }, f => { f.checks.release.approved = false },
    f => { f.checks.release.accountId = '999' }, f => { f.review.client_id = randomUUID() },
    f => { f.deliverable.production_status = 'scheduled' }, f => { f.deliverable.production_status = 'posted' },
    f => { f.review.state = 'superseded' },
  ]) { const f = fixture(); change(f); await assert.rejects(run(f)); assert.equal(f.calls.some(c => ['provider', 'media', 'download'].includes(c[0])), false) }
})

for (const [name, mutate] of [
  ['stale capture', f => { f.proof.capturedAt = new Date(NOW - 300_001).toISOString() }],
  ['future capture', f => { f.proof.capturedAt = new Date(NOW + 30_001).toISOString() }],
  ['foreign client', f => { f.proof.clientId = randomUUID() }],
  ['foreign task', f => { f.proof.recordId = 'another-task' }],
  ['changed date', f => { f.proof.scheduledDate = '2026-11-18' }],
  ['unknown contract', f => { f.proof.contract = 'legacy_mirror' }],
  ['query failure', f => { f.errors.add('schedule') }],
]) test(`${name} cannot manufacture fresh Teams permission or expose media`, async () => {
  const f = fixture(); mutate(f)
  await assert.rejects(run(f), /FRESH_TEAMS_EVIDENCE_REQUIRED/)
  assert.equal(f.calls.some(c => ['download', 'provider', 'media', 'sign'].includes(c[0])), false)
})

test('provider proof must bind the exact target and current app/scopes/token expiry', async () => {
  for (const change of [
    f => { f.binding.accountId = '999' }, f => { f.binding.connectionId = randomUUID() },
    f => { f.binding.grantedScopes = ['pages_show_list'] }, f => { f.binding.appAccessVerified = false },
    f => { f.binding.tokenValidUntil = new Date(NOW + 60_000).toISOString() },
    f => { f.providerProof.checkedAt = new Date(NOW - 300_001).toISOString() },
  ]) { const f = fixture(); change(f); await assert.rejects(run(f), /CURRENT_PROVIDER_PROOF_REQUIRED/) }
})

test('hash/signature alone is never provider media qualification; private errors and oversized profile facts are scrubbed', async () => {
  for (const change of [f => { f.mediaProof.verified = false }, f => { f.mediaProof.profile = 'https://PRIVATE.invalid' },
    f => { f.mediaProof.checkedAt = new Date(NOW - 300_001).toISOString() }]) {
    const f = fixture(); change(f); await assert.rejects(run(f), /REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED/)
  }
  const f = fixture(); f.checks.verifyMedia = async () => { throw new Error('PRIVATE TOKEN') }
  await assert.rejects(run(f), /^PublicationPreparationError: PRIVATE_PREFLIGHT_UNAVAILABLE$/)
})

test('release and target identity are captured, and media adapters cannot mutate the source hash bytes', async () => {
  const f = fixture(), read = preparation.publicationCandidateReader(f.sb, f.checks)
  f.checks.release.accountId = '999' // Already captured reviewed release cannot retarget.
  f.checks.verifyMedia = async snapshot => { snapshot.bytes.fill(0); return f.mediaProof }
  const result = await read(f.target, f.actorId)
  assert.equal(result.context.binding.accountId, '12345'); assert.equal(result.context.assetSha256, digest)
})

test('canonical scheduled/posted states independently block the pure admission policy with no posted_at', async () => {
  const f = fixture(), result = await run(f)
  for (const state of ['scheduled', 'posted']) {
    const c = { ...result.context, deliverable: { ...result.context.deliverable, production_status: state } }
    assert.equal(policy.preparePublishingIntent(c).intent, null)
    assert.ok(policy.preparePublishingIntent(c).blockers.includes('CURRENT_APPROVED_REVIEW_REQUIRED'))
  }
})

test('authorization surface returns only allowlisted preparation blockers, never raw private errors', async () => {
  const f = fixture(); f.checks.release.approved = false
  const ports = { authenticate: async () => ({ id: f.actorId, role: 'manager', active: true }), readCandidate: preparation.publicationCandidateReader(f.sb, f.checks),
    authorize: async () => { throw new Error('No enqueue expected') }, revoke: async () => null }
  const handler = authorization.socialPublicationAuthorizationHandler(ports, true, () => NOW)
  const request = () => new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ action: 'preview', target: f.target }) })
  const blocked = await handler(request())
  assert.equal(blocked.status, 409); assert.deepEqual((await blocked.json()).blockers, ['EXACT_ACCOUNT_RELEASE_REQUIRED'])
  ports.readCandidate = async () => { throw Object.assign(new Error('PRIVATE TOKEN'), { code: 'PRIVATE_TOKEN' }) }
  const unknown = await handler(request())
  assert.equal(unknown.status, 503); assert.equal((await unknown.text()).includes('PRIVATE'), false)
})
