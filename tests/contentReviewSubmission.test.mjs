import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { setImmediate } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

let server, api, sdk
const deliverableId = '11111111-1111-4111-8111-111111111111'
const reviewId = '22222222-2222-4222-8222-222222222222'
before(async () => {
  server = await createServer({ configFile: false, plugins: [{ name: 'review-submission-ports', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {}'
  } }], server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  api = await server.ssrLoadModule('/src/lib/contentReviews.ts')
  sdk = (await server.ssrLoadModule('/src/lib/supabase.ts')).supabase
})
after(async () => server?.close())

function fixture({ persist = true, lost = false, response = reviewId, rowChanges = {}, readError = null, rpcError = null } = {}) {
  const events = [], rows = []
  const input = { deliverableId, file: new File([readFileSync('tests/fixtures/publication-baseline-320.jpg')], 'original.jpg', { type: 'image/jpeg' }),
    caption: ' Exact original caption ', channels: ['facebook'], scheduledAt: '2099-01-01T09:00:00+02:00', clientRequired: true }
  sdk.storage = { from(bucket) { assert.equal(bucket, 'content-review-snapshots'); return { async upload(path, file, options) {
    events.push(['upload', path]); assert.equal(file, input.file); assert.equal(options.upsert, false); return { data: { path }, error: null }
  } } } }
  sdk.rpc = (name, args) => ({ abortSignal() { return this }, async then(resolve, reject) { try {
    events.push(['rpc', name]); assert.equal(name, 'submit_content_review')
    if (persist) rows.push({ id: reviewId, deliverable_id: args.p_deliverable_id, asset_path: args.p_asset_path, media_type: input.file.type,
      caption: args.p_caption.trim(), channels: [...args.p_channels], scheduled_at: new Date(args.p_scheduled_at).toISOString(),
      client_approval_required: args.p_client_required, state: 'internal_review', ...rowChanges })
    if (lost) throw Error('PRIVATE lost response')
    return resolve({ data: response, error: rpcError })
  } catch (error) { return reject(error) } } })
  sdk.from = table => {
    assert.equal(table, 'content_review_versions'); const filters = []
    const query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query }, abortSignal() { return query },
      async maybeSingle() { events.push(['read', filters]); const matches = rows.filter(row => filters.every(([k, v]) => row[k] === v)); return { data: matches[0] ?? null, error: readError } } }
    return query
  }
  return { input, rows, events }
}

test('missing save receipt cannot claim a submitted review', async () => {
  const f = fixture({ persist: false, response: null })
  await assert.rejects(api.submitContentReview(f.input), /could not be verified/i)
})

test('lost save response reconciles the same immutable upload without a second submission', async () => {
  const f = fixture({ lost: true })
  assert.equal(await api.submitContentReview(f.input), reviewId)
  assert.equal(f.events.filter(e => e[0] === 'upload').length, 1)
  assert.equal(f.events.filter(e => e[0] === 'rpc').length, 1)
})

test('a successful UUID alone is insufficient when the saved caption differs', async () => {
  const f = fixture({ rowChanges: { caption: 'Foreign content' } })
  await assert.rejects(api.submitContentReview(f.input), /could not be verified/i)
})

test('a null mutation receipt can succeed only after the exact persisted review is independently read', async () => {
  const f = fixture({ response: null })
  assert.equal(await api.submitContentReview(f.input), reviewId)
  assert.deepEqual(f.events.find(e => e[0] === 'read')[1], [['deliverable_id', deliverableId], ['asset_path', f.rows[0].asset_path]])
  assert.equal(f.rows[0].scheduled_at, '2099-01-01T07:00:00.000Z')
})

for (const patch of [{ id: 'not-a-review' }, { deliverable_id: reviewId }, { asset_path: `${reviewId}/foreign.jpg` }, { media_type: 'image/png' },
  { channels: ['instagram'] }, { channels: ['facebook', 'tiktok'] }, { scheduled_at: '2099-01-02T07:00:00Z' },
  { client_approval_required: false }, { state: 'unknown' }]) test(`receipt refuses altered immutable scope ${Object.keys(patch)[0]}`, async () => {
  const f = fixture({ rowChanges: patch })
  await assert.rejects(api.submitContentReview(f.input), error => error instanceof api.UnverifiedContentReviewSubmission)
})

test('unreadable receipt is uncertainty, and checking the same attempt never uploads or submits again', async () => {
  const f = fixture({ persist: false, response: null }); let attempt
  await assert.rejects(api.submitContentReview(f.input), error => {
    assert.equal(error instanceof api.UnverifiedContentReviewSubmission, true)
    attempt = error.attempt; return true
  })
  assert.equal(Object.isFrozen(attempt), true); assert.equal(Object.isFrozen(attempt.channels), true)
  assert.equal(await api.reconcileContentReviewSubmission(attempt), null)
  f.rows.push({ id: reviewId, deliverable_id: attempt.deliverableId, asset_path: attempt.assetPath, media_type: attempt.mediaType,
    caption: attempt.caption, channels: [...attempt.channels], scheduled_at: attempt.scheduledAt, client_approval_required: true, state: 'client_review' })
  assert.equal(await api.reconcileContentReviewSubmission(attempt), reviewId)
  assert.equal(f.events.filter(e => e[0] === 'upload').length, 1); assert.equal(f.events.filter(e => e[0] === 'rpc').length, 1)
})

test('read failure and a contradictory mutation ID cannot confirm a different review', async () => {
  for (const options of [{ readError: { message: 'PRIVATE read failure' } }, { response: '33333333-3333-4333-8333-333333333333' }]) {
    const f = fixture(options)
    await assert.rejects(api.submitContentReview(f.input), error => {
      assert.equal(error instanceof api.UnverifiedContentReviewSubmission, true); assert.doesNotMatch(error.message, /PRIVATE/); return true
    })
  }
})

test('source rejection remains actionable while unexpected raw errors remain private', async () => {
  const f = fixture({ persist: false, response: null, rpcError: { code: 'P0001', message: 'Link the exact Canva page first' } })
  await assert.rejects(api.submitContentReview(f.input), /^Error: Link the exact Canva page first$/)
  const unknown = fixture({ persist: false, response: null, rpcError: { code: 'P0001', message: 'PRIVATE SQL details' } })
  await assert.rejects(api.submitContentReview(unknown.input), error => error instanceof api.UnverifiedContentReviewSubmission && !error.message.includes('PRIVATE'))
})

test('input is captured before upload; form edits cannot retarget a pending submission', async () => {
  const f = fixture(), pending = api.submitContentReview(f.input)
  f.input.caption = 'Changed after upload began'; f.input.channels.push('tiktok'); f.input.scheduledAt = '2099-01-02T09:00:00+02:00'
  assert.equal(await pending, reviewId)
  assert.equal(f.rows[0].caption, 'Exact original caption'); assert.deepEqual(f.rows[0].channels, ['facebook'])
  assert.equal(f.rows[0].scheduled_at, '2099-01-01T07:00:00.000Z')
})

test('invalid scope, caption, targets or time refuse before uploading', async () => {
  for (const patch of [{ deliverableId: 'wrong' }, { caption: ' ' }, { caption: 'x'.repeat(10001) }, { channels: ['youtube'] },
    { channels: [] }, { scheduledAt: '2099-01-01T09:00:00' }, { scheduledAt: '2020-01-01T09:00:00Z' }]) {
    const f = fixture(); await assert.rejects(api.submitContentReview({ ...f.input, ...patch })); assert.equal(f.events.length, 0)
  }
})

test('timed-out save checks the same attempt without a second mutation', async t => {
  const f = fixture(); let calls = 0
  sdk.rpc = () => { calls++; return { abortSignal(signal) { return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('PRIVATE timeout')), { once: true })) } } }
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = api.submitContentReview(f.input), rejection = assert.rejects(pending, error => error instanceof api.UnverifiedContentReviewSubmission)
  await setImmediate(); t.mock.timers.tick(12_001); await rejection
  assert.equal(calls, 1); assert.equal(f.events.filter(e => e[0] === 'read').length, 1)
})

test('installed Supabase SDK handles null RPC body and exact maybeSingle readback with no network escape', async () => {
  const f = fixture(), calls = []; let row
  const client = createClient('https://fixture.invalid', 'local-fixture-only', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input, init) => {
      const url = new URL(input); assert.equal(url.origin, 'https://fixture.invalid'); calls.push([init.method, url.pathname])
      if (url.pathname === '/rest/v1/rpc/submit_content_review') {
        assert.equal(init.method, 'POST'); const a = JSON.parse(init.body)
        row = { id: reviewId, deliverable_id: a.p_deliverable_id, asset_path: a.p_asset_path, media_type: 'image/jpeg',
          caption: a.p_caption, channels: a.p_channels, scheduled_at: '2099-01-01T07:00:00Z', client_approval_required: true, state: 'internal_review' }
        return new Response(null, { status: 204 })
      }
      assert.equal(url.pathname, '/rest/v1/content_review_versions'); assert.equal(init.method, 'GET')
      assert.equal(url.searchParams.get('deliverable_id'), `eq.${deliverableId}`)
      assert.equal(url.searchParams.get('asset_path'), `eq.${row.asset_path}`)
      return Response.json([row])
    } },
  })
  sdk.rpc = client.rpc.bind(client); sdk.from = client.from.bind(client)
  assert.equal(await api.submitContentReview(f.input), reviewId)
  assert.deepEqual(calls, [['POST','/rest/v1/rpc/submit_content_review'],['GET','/rest/v1/content_review_versions']])
  assert.equal(f.events.filter(e => e[0] === 'upload').length, 1)
})
