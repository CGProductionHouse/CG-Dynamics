import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

let server, policy, execution, facebook
before(async () => {
  server = await createServer({ logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  policy = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishing.ts')
  execution = await server.ssrLoadModule('/supabase/functions/_shared/socialPublishingExecution.ts')
  facebook = await server.ssrLoadModule('/supabase/functions/_shared/facebookPublishing.ts')
})
after(async () => { await server?.close() })

test('Facebook photo adapter submits approved caption once and persists identity before any status polling', async () => {
  const c = context(); c.binding.accountId = '123'; c.authorization.accountId = '123'
  const intent = policy.preparePublishingIntent(c).intent, requests = []
  const transport = {
    approvedMediaUrl: async () => 'https://media.example.test/approved.jpg?bounded=fixture',
    request: async (...args) => { requests.push(args); return { id: '456', post_id: '123_789' } },
  }
  const receipt = await facebook.submitFacebookPhoto(intent, transport)
  assert.deepEqual(receipt, { state: 'processing', postId: '123_789', operationId: '456' })
  assert.deepEqual(requests, [['POST', '/123/photos', { url: 'https://media.example.test/approved.jpg?bounded=fixture', caption: c.review.caption, published: true }]])
  // No signed delivery URL is returned as durable receipt data.
  assert.equal(JSON.stringify(receipt).includes('bounded'), false)
  transport.request = async (...args) => { requests.push(args); return { id: '123_789', is_published: true } }
  assert.equal((await facebook.readFacebookPhotoStatus({ ...intent, providerPostId: receipt.postId }, transport)).state, 'posted')
  assert.equal(requests[1][0], 'GET')
})

test('Facebook media/account contract fails closed and ambiguous receipt is reconciled without claiming publication', async () => {
  const c = context(); c.binding.accountId = '123'; c.authorization.accountId = '123'
  const intent = policy.preparePublishingIntent(c).intent
  let calls = 0
  const transport = { approvedMediaUrl: async () => 'http://media.example.test/a.jpg', request: async () => { calls++; return {} } }
  await assert.rejects(facebook.submitFacebookPhoto(intent, transport), /HTTPS/)
  await assert.rejects(facebook.submitFacebookPhoto({ ...intent, route: 'instagram_login' }, transport), /contract/)
  assert.equal(calls, 0)
  transport.approvedMediaUrl = async () => 'https://media.example.test/a.jpg'
  for (const receipt of [{ id: '456' }, { post_id: '999_789' }, { error: { code: 190 } }]) {
    transport.request = async () => receipt
    assert.equal((await facebook.submitFacebookPhoto(intent, transport)).state, 'unknown_outcome')
  }
  transport.request = async () => { calls++; return { id: '999_789', is_published: true } }
  assert.equal((await facebook.readFacebookPhotoStatus({ ...intent, providerPostId: '999_789' }, transport)).state, 'unknown_outcome')
  assert.equal(calls, 0)
  assert.equal((await facebook.readFacebookPhotoStatus({ ...intent, providerPostId: '123_789' }, transport)).state, 'unknown_outcome')
})

const NOW = '2026-11-15T10:00:00Z'
function context(route = 'facebook_page') {
  const platforms = { facebook_page: 'facebook', instagram_login: 'instagram', instagram_facebook_login: 'instagram', tiktok_accounts: 'tiktok', linkedin_organization: 'linkedin', youtube_channel: 'youtube' }
  return {
    review: { id: 'review-1', deliverable_id: 'deliverable-1', client_id: 'client-1', state: 'approved', asset_path: 'deliverable-1/final.jpg', media_type: route === 'youtube_channel' ? 'video/mp4' : 'image/jpeg', caption: 'The exact approved caption.', channels: [platforms[route]], scheduled_at: NOW },
    deliverable: { id: 'deliverable-1', client_id: 'client-1', scheduled_date: '2026-11-15', archived_at: null, posted_at: null },
    binding: { clientId: 'client-1', connectionId: 'connection-1', accountId: 'account-1', route, active: true, grantedScopes: [...policy.PUBLISHING_PATHS[route].scopes], tokenValidUntil: '2026-11-16T10:00:00Z', appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true, accountsContractVerified: true },
    authorization: { id: 'authorization-1', reviewVersionId: 'review-1', clientId: 'client-1', connectionId: 'connection-1', accountId: 'account-1', route, scheduledAt: NOW, assetSha256: 'a'.repeat(64) },
    assetSha256: 'a'.repeat(64), teamsScheduleVerified: true, rolloutApproved: true,
  }
}

test('each provider retains its own scopes, timing and upload/publication lifecycle', () => {
  for (const route of Object.keys(policy.PUBLISHING_PATHS)) {
    const c = context(route)
    assert.deepEqual(policy.preparePublishingIntent(c).blockers, [])
    assert.equal(policy.preparePublishingIntent(c).intent.route, route)
  }
  assert.equal(policy.PUBLISHING_PATHS.youtube_channel.timing, 'provider_scheduled')
  assert.equal(policy.PUBLISHING_PATHS.instagram_login.timing, 'due_time')
  assert.ok(policy.PUBLISHING_PATHS.instagram_login.lifecycle.includes('poll_container'))
  assert.ok(policy.PUBLISHING_PATHS.linkedin_organization.lifecycle.includes('poll_media'))
  assert.equal(policy.preparePublishingIntent({ ...context(), binding: { ...context().binding, route: 'consumer_direct_post' } }).intent, null)
})

test('approval, native dashboard access and analytics scopes never authorize publishing', () => {
  for (const mutate of [
    c => { c.authorization = null }, c => { c.rolloutApproved = false },
    c => { c.teamsScheduleVerified = false }, c => { c.binding.appAccessVerified = false },
    c => { c.binding.accountPublishingVerified = false }, c => { c.binding.grantedScopes = ['pages_show_list'] },
    c => { c.binding.mediaContractVerified = false }, c => { c.binding.tokenValidUntil = null },
  ]) {
    const c = context(); mutate(c)
    assert.equal(policy.preparePublishingIntent(c).intent, null)
  }
  const tik = context('tiktok_accounts'); tik.binding.accountsContractVerified = false
  assert.ok(policy.preparePublishingIntent(tik).blockers.includes('TIKTOK_ACCOUNTS_CONTRACT_UNVERIFIED'))
})

test('exact client, target, approved asset/version and schedule remain bound', () => {
  for (const mutate of [
    c => { c.binding.clientId = 'other' }, c => { c.review.client_id = 'other' },
    c => { c.review.deliverable_id = 'other' }, c => { c.authorization.accountId = 'other' },
    c => { c.authorization.reviewVersionId = 'stale' }, c => { c.authorization.assetSha256 = 'b'.repeat(64) },
    c => { c.authorization.connectionId = 'other' }, c => { c.authorization.route = 'instagram_login' },
    c => { c.review.asset_path = 'other/final.jpg' }, c => { c.review.state = 'superseded' },
    c => { c.review.channels = ['linkedin'] }, c => { c.deliverable.archived_at = NOW },
    c => { c.deliverable.posted_at = NOW }, c => { c.deliverable.scheduled_date = '2026-11-16' },
    c => { c.review.scheduled_at = '2026-11-15T10:00:00' }, c => { c.review.scheduled_at = '2026-11-31T10:00:00Z' },
  ]) { const c = context(); mutate(c); assert.equal(policy.preparePublishingIntent(c).intent, null) }
  assert.equal(policy.johannesburgPublishingDate('2026-11-15T23:30:00Z'), '2026-11-16')
})

test('Instagram PNG/WebP and YouTube photos require deliberate media preparation', () => {
  for (const media of ['image/png', 'image/webp']) {
    const c = context('instagram_login'); c.review.media_type = media
    assert.ok(policy.preparePublishingIntent(c).blockers.includes('INSTAGRAM_MEDIA_CONVERSION_REQUIRED'))
  }
  const c = context('youtube_channel'); c.review.media_type = 'image/jpeg'
  assert.ok(policy.preparePublishingIntent(c).blockers.includes('YOUTUBE_VIDEO_REQUIRED'))
})

test('repeated scheduling authorizations keep the same channel intent identity', () => {
  const a = context(), b = context(); b.authorization.id = 'new-click'
  assert.equal(policy.preparePublishingIntent(a).intent.key, policy.preparePublishingIntent(b).intent.key)
  b.binding.connectionId = 'reconnected'; b.authorization.connectionId = 'reconnected'
  assert.equal(policy.preparePublishingIntent(a).intent.key, policy.preparePublishingIntent(b).intent.key)
  assert.equal(policy.publishingDispatchDecision(policy.preparePublishingIntent(a).intent, b, NOW), 'blocked_source_changed')
  const ig = context('instagram_login')
  assert.notEqual(policy.preparePublishingIntent(a).intent.key, policy.preparePublishingIntent(ig).intent.key)
})

test('due-time dispatch refuses stale consent, revoked access, expiration and late catch-up', () => {
  const c = context(), intent = policy.preparePublishingIntent(c).intent
  assert.equal(policy.publishingDispatchDecision(intent, c, NOW), 'submit')
  assert.equal(policy.publishingDispatchDecision(intent, c, '2026-11-15T09:59:59Z'), 'wait_until_due')
  assert.equal(policy.publishingDispatchDecision(intent, c, '2026-11-15T10:16:00Z'), 'blocked_overdue_review')
  const expired = structuredClone(c); expired.binding.tokenValidUntil = NOW
  assert.equal(policy.publishingDispatchDecision(intent, expired, NOW), 'blocked_token_or_time')
  for (const mutate of [c => { c.review.caption = 'Unapproved change' }, c => { c.binding.accountId = 'other' }, c => { c.authorization.id = 'replacement' }, c => { c.binding.active = false }]) {
    const changed = structuredClone(c); mutate(changed)
    assert.equal(policy.publishingDispatchDecision(intent, changed, NOW), 'blocked_source_changed')
  }
  for (const state of ['posted', 'processing', 'provider_scheduled', 'submitting', 'cancelled', 'unknown_outcome', 'failed']) {
    assert.equal(policy.publishingDispatchDecision({ ...intent, state }, c, NOW), 'do_not_submit')
  }
})

test('container, upload, scheduled and unknown states never masquerade as posted', () => {
  const normalize = policy.normalizePublishingObservation
  assert.equal(normalize('instagram', { status: 'FINISHED', operationId: 'container' }).state, 'processing')
  assert.equal(normalize('instagram', { status: 'PUBLISHED' }).state, 'unknown_outcome')
  assert.equal(normalize('instagram', { status: 'PUBLISHED', postId: 'media' }).state, 'posted')
  assert.equal(normalize('tiktok', { status: 'PUBLISH_COMPLETE' }).state, 'unknown_outcome')
  assert.equal(normalize('tiktok', { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['post'] }).state, 'posted')
  assert.equal(normalize('tiktok', { status: 'SENDING_TO_USER_INBOX' }).state, 'processing')
  assert.equal(normalize('facebook', { is_published: false, postId: 'post', scheduled_publish_time: 1800000000 }).state, 'provider_scheduled')
  assert.equal(normalize('linkedin', { status: 'PUBLISHED', postId: 'urn:li:share:1' }).state, 'posted')
  assert.equal(normalize('youtube', { privacyStatus: 'private', publishAt: '2026-11-16T10:00:00Z', uploadStatus: 'processed', postId: 'video' }).state, 'provider_scheduled')
  assert.equal(normalize('youtube', { privacyStatus: 'private', uploadStatus: 'processed', postId: 'video' }).state, 'unknown_outcome')
  assert.equal(normalize('youtube', { privacyStatus: 'public', uploadStatus: 'processed', postId: 'video' }).state, 'posted')
  for (const p of ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube']) assert.equal(normalize(p, { status: 'NEW_UNKNOWN_PROVIDER_STATE' }).state, 'unknown_outcome')
})

test('ambiguous submissions reconcile; proven throttles back off with bounded attempts', () => {
  const decide = policy.publishingRetryDecision
  assert.equal(decide({ stage: 'submission', httpStatus: 503, attempt: 0 }).action, 'reconcile')
  assert.deepEqual(decide({ stage: 'submission', explicitlyRejected: true, httpStatus: 429, retryAfterSeconds: 600, attempt: 1 }), { action: 'retry', delaySeconds: 600 })
  assert.equal(decide({ stage: 'status', httpStatus: 403, attempt: 0 }).action, 'reauthorize')
  assert.equal(decide({ stage: 'status', httpStatus: 503, attempt: 3 }).action, 'stop')
  assert.equal(decide({ stage: 'status', httpStatus: 429, attempt: 0, retryAfterSeconds: Infinity }).action, 'stop')
})

// Fixture for the required future transactional adapter. This is NOT a production store.
function ports(c = context()) {
  const intent = policy.preparePublishingIntent(c).intent
  let claimed = false, submitting = false, submissions = 0
  const port = {
    async claim() { if (claimed || submitting) return null; claimed = true; return { intent, fence: 'fence-1' } },
    async readCurrent() { return c },
    async beginAttempt() { submitting = true; return true },
    async submit() { submissions++; return { state: 'posted', postId: 'post-1' } },
    async saveObservation() { return true },
  }
  return { port, intent, count: () => submissions }
}
test('two workers submit one channel once; completed siblings do not resend', async () => {
  const f = ports()
  const results = await Promise.all([1, 2].map(() => execution.executePublishingIntent(f.port, f.intent.key, NOW)))
  assert.equal(f.count(), 1)
  assert.ok(results.some(r => r.state === 'not_claimed'))
  const sibling = ports(context('instagram_login'))
  sibling.port.submit = async () => ({ state: 'failed', errorCode: 'CONTAINER_ERROR' })
  assert.equal((await execution.executePublishingIntent(sibling.port, sibling.intent.key, NOW)).state, 'failed')
  assert.equal((await execution.executePublishingIntent(f.port, f.intent.key, NOW)).state, 'not_claimed')
})
test('cancel/reschedule race caught by atomic beginAttempt prevents provider mutation', async () => {
  const f = ports(); f.port.beginAttempt = async () => false
  assert.equal((await execution.executePublishingIntent(f.port, f.intent.key, NOW)).state, 'claim_or_source_lost')
  assert.equal(f.count(), 0)
})
test('provider timeout, receipt error and missing public ID preserve reconciliation barrier', async () => {
  for (const kind of ['timeout', 'receipt-false', 'receipt-throw', 'missing-id']) {
    const f = ports()
    if (kind === 'timeout') f.port.submit = async () => { throw new Error('accepted then timeout') }
    if (kind === 'receipt-false') f.port.saveObservation = async () => false
    if (kind === 'receipt-throw') f.port.saveObservation = async () => { throw new Error('DB unavailable') }
    if (kind === 'missing-id') f.port.submit = async () => ({ state: 'posted' })
    assert.equal((await execution.executePublishingIntent(f.port, f.intent.key, NOW)).state, 'unknown_outcome')
    assert.equal((await execution.executePublishingIntent(f.port, f.intent.key, NOW)).state, 'not_claimed')
  }
})

function statusHandler({ receiptError = null, mappingError = null, providerStatus = { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['public-post'] } } = {}) {
  let handler, mappingCalls = 0
  const sb = {
    auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) },
    from(table) {
      return {
        select() { return this }, eq() { return this },
        async single() { return { data: table === 'profiles' ? { role: 'manager' } : { connection_id: 'connection-1', client_id: 'client-1' } } },
        update() { return { eq: async () => ({ error: receiptError }) } },
        async upsert() { mappingCalls++; return { error: mappingError } },
      }
    },
  }
  const source = readFileSync('supabase/functions/tiktok-post-status/index.ts', 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, {
    exports: {}, Response,
    Deno: { env: { get: () => 'fixture-only' }, serve: fn => { handler = fn } },
    require: name => name.includes('cors') ? { corsHeaders: {}, jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }) }
      : name.includes('socialPublishing') ? policy
      : name.includes('tiktok') ? { getTiktokAccessToken: async () => ({ accessToken: 'fixture-only' }), getTiktokPublishStatus: async () => ({ status: providerStatus }) }
      : { createClient: () => sb },
  })
  return { call: () => handler(new Request('https://fixture.invalid/status', { method: 'POST', headers: { Authorization: 'Bearer fixture-only', 'Content-Type': 'application/json' }, body: JSON.stringify({ publishId: 'existing-operation' }) })), mappings: () => mappingCalls }
}
test('actual status entrypoint refuses false success on receipt or content-map persistence errors', async () => {
  for (const config of [{ receiptError: { code: 'fixture' } }, { mappingError: { code: 'fixture' } }]) {
    const h = statusHandler(config), response = await h.call(), body = await response.json()
    assert.equal(response.status, 503); assert.equal(body.ok, false)
    assert.match(body.error, /do not submit again/)
    if (config.receiptError) assert.equal(h.mappings(), 0)
  }
  const good = await statusHandler().call()
  assert.equal(good.status, 200); assert.equal((await good.json()).status, 'published')
})
test('actual status entrypoint preserves unknown provider outcomes and missing public IDs', async () => {
  for (const status of ['PUBLISH_COMPLETE', 'FUTURE_STATUS']) {
    const h = statusHandler({ providerStatus: { status } }), response = await h.call()
    assert.equal(response.status, 502); assert.equal((await response.json()).ok, false); assert.equal(h.mappings(), 0)
  }
})
