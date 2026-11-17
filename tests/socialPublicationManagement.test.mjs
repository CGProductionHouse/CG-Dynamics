import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, management, authorization, frontend, supabase, ReviewCard, functionsDescriptor
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-only') } })
  management = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationManagement.ts')
  authorization = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorization.ts')
  frontend = await server.ssrLoadModule('/src/lib/socialPublishing.ts')
  ;({ supabase } = await server.ssrLoadModule('/src/lib/supabase.ts'))
  functionsDescriptor = Object.getOwnPropertyDescriptor(supabase, 'functions')
  Object.defineProperty(supabase, 'functions', { configurable: true, value: { invoke: async () => { throw new Error('Fixture blocks network') } } })
  ;({ ContentReviewCard: ReviewCard } = await server.ssrLoadModule('/src/components/content/ContentReviewCard.tsx'))
})
after(async () => {
  try { await server?.close() }
  finally {
    if (functionsDescriptor) Object.defineProperty(supabase, 'functions', functionsDescriptor)
    else if (supabase) delete supabase.functions
  }
})
const ids = { actor: randomUUID(), client: randomUUID(), review: randomUUID(), deliverable: randomUUID(), connection: randomUUID(), job: randomUUID(), authorization: randomUUID() }
async function fixture() {
  const intent = { key: 'fixture-job', clientId: ids.client, deliverableId: ids.deliverable, reviewVersionId: ids.review, platform: 'facebook', route: 'facebook_page',
    connectionId: ids.connection, accountId: '12345', assetPath: `${ids.deliverable}/approved.jpg`, assetSha256: 'a'.repeat(64), mediaType: 'image/jpeg', caption: 'Approved caption',
    scheduledAt: '2026-11-17T08:00:00Z', authorizationId: ids.authorization }
  const row = { id: ids.job, job_type: 'social_publish', status: 'queued', payload: { intent, authorized_by: ids.actor }, publication: {
    state: 'queued', authorization: { id: ids.authorization, actorId: ids.actor, fingerprint: await authorization.socialPublicationFingerprint(intent), confirmedAt: '2026-11-16T10:00:00Z', revokedAt: null,
      evidence: { providerToken: 'PRIVATE MUST NOT LEAK' } } } }
  const tables = { profiles: [{ id: ids.actor, role: 'manager', is_active: true }], content_review_versions: [{ id: ids.review, client_id: ids.client, deliverable_id: ids.deliverable }],
    monthly_deliverables: [{ id: ids.deliverable, client_id: ids.client }], background_jobs: [row] }
  const calls = [], errors = new Set()
  const sb = { from(table) {
    const filters = []
    const matches = () => (tables[table] ?? []).filter(r => filters.every(([key, value]) => key.split(/->>?/).reduce((o, k) => o?.[k], r) === value))
    const q = { select() { return q }, eq(k, v) { filters.push([k, v]); return q }, order() { return q }, async maybeSingle() {
      calls.push(['read', table, filters]); const rows = matches(); return { data: rows.length === 1 ? rows[0] : null, error: errors.has(table) || rows.length > 1 ? { message: 'PRIVATE ERROR' } : null }
    }, async range(start, end) { calls.push(['read', table, filters, start, end]); return { data: matches().slice(start, end + 1), error: errors.has(table) ? { message: 'PRIVATE ERROR' } : null } } }
    return q
  }, async rpc(name, args) {
    calls.push(['rpc', name, args]); assert.equal(name, 'revoke_social_publication')
    row.publication.authorization.revokedAt = '2026-11-16T11:00:00Z'
    const started = !!row.publication.started_at
    if (!started) { row.status = 'cancelled'; row.publication.state = 'cancelled' }
    return { data: { jobId: ids.job, status: row.status, state: row.publication.state, authorizationRevoked: true, providerMayHaveStarted: started }, error: null }
  } }
  return { row, tables, sb, errors, calls }
}
const readStatus = f => management.readPublicationManagementStatus(f.sb, ids.actor, ids.review)
const makeRequest = body => new Request('https://fixture.invalid/social-publication', { method: 'POST', body: JSON.stringify(body) })
function handler(f) { return management.publicationManagementHandler({ authenticate: async () => ({ id: ids.actor, role: 'manager', active: true }),
  readStatus: reviewId => management.readPublicationManagementStatus(f.sb, ids.actor, reviewId), revoke: async (jobId, clientId, actorId) => (await f.sb.rpc('revoke_social_publication', { p_id: jobId, p_client: clientId, p_actor: actorId })).data }) }

test('status projects exact canonical scope and only safe receipt fields, never provider-health readiness', async () => {
  const f = await fixture(), status = await readStatus(f)
  assert.equal(status.reviewId, ids.review); assert.equal(status.clientId, ids.client); assert.equal(status.canAuthorize, false)
  assert.equal(status.items[0].state, 'queued'); assert.equal(status.items[0].authorizationState, 'recorded')
  assert.equal(JSON.stringify(status).includes('PRIVATE'), false); assert.equal(JSON.stringify(status).includes('assetPath'), false)
  const filters = f.calls.find(c => c[1] === 'background_jobs')[2]
  assert.ok(filters.some(([k, v]) => k === 'payload->intent->>clientId' && v === ids.client))
  assert.ok(filters.some(([k, v]) => k === 'payload->intent->>deliverableId' && v === ids.deliverable))
  assert.ok(filters.some(([k, v]) => k === 'payload->intent->>reviewVersionId' && v === ids.review))
})

for (const name of ['profiles', 'content_review_versions', 'monthly_deliverables', 'background_jobs']) test(`${name} failure is unavailable, never healthy empty`, async () => {
  const f = await fixture(); f.errors.add(name)
  await assert.rejects(readStatus(f))
  const response = await handler(f)(makeRequest({ action: 'status', reviewId: ids.review }))
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('PRIVATE'), false)
})

test('client/staff/inactive roles are rejected before any review/job read', async () => {
  for (const change of [{ role: 'client' }, { role: 'staff' }, { is_active: false }]) {
    const f = await fixture(); Object.assign(f.tables.profiles[0], change)
    await assert.rejects(readStatus(f)); assert.deepEqual(f.calls.map(c => c[1]), ['profiles'])
  }
})

test('missing source scope and inconsistent/duplicate receipt evidence fail closed', async () => {
  for (const mutate of [
    f => { f.tables.monthly_deliverables[0].client_id = randomUUID() },
    f => { f.tables.background_jobs.push(structuredClone(f.row)) },
    f => { f.row.publication.state = 'unknown_future_state' },
    f => { f.row.publication.authorization.fingerprint = 'b'.repeat(64) },
    f => { f.row.publication.state = 'posted'; f.row.status = 'succeeded' },
    f => { f.row.status = 'succeeded' },
    f => { f.row.publication.state = 'processing'; f.row.publication.started_at = '2026-11-16T10:00:00Z' },
  ]) { const f = await fixture(); mutate(f); await assert.rejects(readStatus(f)) }
})

test('posted requires a verified exact Page receipt; queued cancelled jobs never look actively queued', async () => {
  const f = await fixture(); f.row.publication.started_at = '2026-11-16T10:00:00Z'; f.row.publication.state = 'posted'; f.row.status = 'succeeded'
  f.row.publication.observation = { state: 'posted', postId: '12345_789' }
  assert.equal((await readStatus(f)).items[0].postUrl, 'https://www.facebook.com/12345_789')
  f.row.publication.observation.postId = '999_789'; await assert.rejects(readStatus(f))
  delete f.row.publication.started_at; f.row.publication.state = 'queued'; f.row.status = 'cancelled'
  assert.equal((await readStatus(f)).items[0].state, 'cancelled')
})

test('whole result pagination is bounded and contiguous; absent jobs are explicit empty evidence', async () => {
  const f = await fixture(), original = f.row
  f.tables.background_jobs = Array.from({ length: 101 }, () => ({ ...original, id: randomUUID() }))
  assert.equal((await readStatus(f)).items.length, 101)
  assert.deepEqual(f.calls.filter(c => c[1] === 'background_jobs').map(c => c.slice(3)), [[0, 99], [100, 199]])
  f.tables.background_jobs = []
  assert.deepEqual((await readStatus(f)).items, [])
})

test('management endpoint can only read status or withdraw authority; it cannot grant, submit or accept scope overrides', async () => {
  const f = await fixture(), h = handler(f)
  for (const body of [{ action: 'confirm', reviewId: ids.review }, { action: 'preview', reviewId: ids.review },
    { action: 'status', reviewId: ids.review, clientId: randomUUID() }, { action: 'revoke', reviewId: ids.review, jobId: ids.job, actorId: randomUUID() }]) {
    assert.equal((await h(makeRequest(body))).status, 400)
  }
  assert.equal(f.calls.length, 0)
  const response = await h(makeRequest({ action: 'status', reviewId: ids.review }))
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(f.calls.some(c => c[0] === 'rpc'), false)
})

test('withdrawal derives client from the review and refuses foreign jobs; no creation flag is required', async () => {
  const f = await fixture(), h = handler(f)
  assert.equal((await h(makeRequest({ action: 'revoke', reviewId: ids.review, jobId: randomUUID() }))).status, 404)
  assert.equal(f.calls.some(c => c[0] === 'rpc'), false)
  const response = await h(makeRequest({ action: 'revoke', reviewId: ids.review, jobId: ids.job }))
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.publication.state, 'cancelled')
  assert.deepEqual(f.calls.find(c => c[0] === 'rpc')[2], { p_id: ids.job, p_client: ids.client, p_actor: ids.actor })
})

test('withdrawal of a started operation preserves its status and never claims deletion', async () => {
  const f = await fixture(); f.row.status = 'running'; f.row.publication.state = 'submitting'; f.row.publication.started_at = '2026-11-16T10:00:00Z'
  const response = await handler(f)(makeRequest({ action: 'revoke', reviewId: ids.review, jobId: ids.job }))
  const p = (await response.json()).publication
  assert.equal(p.state, 'submitting'); assert.equal(p.providerMayHaveStarted, true)
})

test('frontend scope/projection rejects missing, foreign, duplicate and misleading receipt data', async () => {
  const f = await fixture(), status = await readStatus(f)
  const good = { ok: true, status }
  assert.equal(frontend.projectPublicationStatus(good, ids.review).items.length, 1)
  for (const mutate of [s => { s.status.reviewId = randomUUID() }, s => { s.status.canAuthorize = true }, s => { s.status.items.push(s.status.items[0]) },
    s => { s.status.items[0].state = 'healthy' }, s => { s.status.items[0].postUrl = 'https://evil.invalid' },
    s => { s.status.items[0].state = 'posted' }, s => { s.status.items[0].errorCode = 'PRIVATE https://token.invalid' }]) {
    const value = structuredClone(good); mutate(value); assert.equal(frontend.projectPublicationStatus(value, ids.review), null)
  }
  assert.equal(frontend.projectPublicationStatus(undefined, ids.review), null)
})

test('frontend absent backend never becomes empty; withdrawal sends exact review/job and validates readback', async () => {
  const f = await fixture(), status = await readStatus(f), calls = []
  supabase.functions.invoke = async (name, args) => { calls.push([name, args]); return { data: { ok: true, status }, error: null } }
  assert.equal((await frontend.getStaffPublicationStatus(ids.review)).items.length, 1)
  assert.deepEqual(calls[0], ['social-publication', { body: { action: 'status', reviewId: ids.review } }])
  supabase.functions.invoke = async () => ({ data: null, error: new Error('Function absent') })
  assert.equal(await frontend.getStaffPublicationStatus(ids.review), null)
  supabase.functions.invoke = async (name, args) => { calls.push([name, args]); return { data: { ok: true, publication: { jobId: ids.job, state: 'cancelled', authorizationRevoked: true, providerMayHaveStarted: false } }, error: null } }
  assert.equal((await frontend.withdrawStaffPublication(ids.review, ids.job)).state, 'cancelled')
  assert.deepEqual(calls.at(-1)[1].body, { action: 'revoke', reviewId: ids.review, jobId: ids.job })
  supabase.functions.invoke = async () => ({ data: { ok: true, publication: { jobId: randomUUID(), state: 'cancelled', authorizationRevoked: true, providerMayHaveStarted: false } }, error: null })
  assert.equal(await frontend.withdrawStaffPublication(ids.review, ids.job), null)
})

test('client and ordinary staff cards never expose publishing management; active manager surface has explicit access', () => {
  const review = { id: ids.review, title: 'Synthetic approved review', asset_path: 'fixture.jpg', media_type: 'image/jpeg', caption: 'Caption', channels: ['facebook'], scheduled_at: '2026-11-17T08:00:00Z', state: 'approved' }
  const markup = props => renderToStaticMarkup(React.createElement(ReviewCard, { review, canDecide: false, onChanged() {}, ...props }))
  assert.equal(markup({ staffView: false, canManagePublishing: true }).includes('Publishing status'), false)
  assert.equal(markup({ staffView: true, canManagePublishing: false }).includes('Publishing status'), false)
  assert.equal(markup({ staffView: true, canManagePublishing: true }).includes('Publishing status'), true)
  assert.equal(markup({ staffView: true }).includes('has not been scheduled or posted'), false)
})

test('actual Edge entrypoint validates active profile, preserves CORS/no-store and calls only the scoped management handler', async () => {
  const f = await fixture(); let serve
  const source = ts.transpileModule(readFileSync('supabase/functions/social-publication/index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const storeModule = await server.ssrLoadModule('/supabase/functions/_shared/socialPublicationAuthorizationStore.ts')
  const imports = { '../_shared/auth.ts': { requireAdminOrManager: async () => ({ ok: true, value: { supabase: f.sb, user: { id: ids.actor }, role: 'manager' } }) },
    '../_shared/cors.ts': { corsHeaders: { 'Access-Control-Allow-Origin': 'https://fixture.invalid' } },
    '../_shared/socialPublicationManagement.ts': management, '../_shared/socialPublicationAuthorizationStore.ts': storeModule }
  vm.runInNewContext(source, { exports: {}, require: id => { if (!(id in imports)) throw new Error(`Unexpected import ${id}`); return imports[id] },
    Deno: { serve: handler => { serve = handler } }, Request, Response, Headers })
  const response = await serve(makeRequest({ action: 'status', reviewId: ids.review }))
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://fixture.invalid')
  assert.equal(f.calls.some(c => c[0] === 'rpc'), false)
  f.tables.profiles[0].is_active = false; f.calls.length = 0
  assert.equal((await serve(makeRequest({ action: 'status', reviewId: ids.review }))).status, 403)
  assert.deepEqual(f.calls.map(c => c[1]), ['profiles'])
})

// Execute the REAL component's callbacks with a small lifecycle harness. This
// tests async ownership/confirmation behavior; it is not browser/visual QA.
function componentHarness(io, reviewId, confirmation = false, reviewChanges = {}) {
  const slots = [], cleanups = [], lateWrites = []; let cursor = 0, mounted = true
  const react = { useState(initial) {
    const slot = cursor++
    if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial
    return [slots[slot], value => { if (!mounted) lateWrites.push(value); else slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }]
  }, useRef(initial) { const slot = cursor++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot] },
  useEffect(effect) { const slot = cursor++; if (!(slot in slots)) { slots[slot] = true; cleanups.push(effect()) } } }
  const runtime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  const exports = {}
  const source = ts.transpileModule(readFileSync(`src/components/content/${confirmation ? 'ContentPublicationConfirmation' : 'ContentPublicationPanel'}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(source, { exports, require: name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return runtime
    if (name.endsWith('.svg')) return { default: '/fixture-imported-icon.svg' }
    if (name.endsWith('/socialPublishing')) return { PUBLICATION_STATE_LABELS: frontend.PUBLICATION_STATE_LABELS, canPrepareFacebookPhotoReview: frontend.canPrepareFacebookPhotoReview, publicationNextAction: frontend.publicationNextAction, FACEBOOK_INSPECTION_LABELS: frontend.FACEBOOK_INSPECTION_LABELS, ...io }
    if (name.endsWith('/ContentPublicationConfirmation')) return { ContentPublicationConfirmation: () => null }
    throw new Error(`Unexpected component import ${name}`)
  }, Date, Intl })
  const review = { id: reviewId, state: 'approved', channels: ['facebook'], media_type: 'image/png', ...reviewChanges }
  const root = confirmation ? { type: exports.ContentPublicationConfirmation, props: { reviewId, review, onConfirmed: io.onConfirmed ?? (() => {}) } } : exports.ContentPublicationPanel({ reviewId, review })
  const render = () => { cursor = 0; return root.type(root.props) }
  const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
  const text = value => value == null || typeof value === 'boolean' ? '' : Array.isArray(value) ? value.map(text).join('') : typeof value === 'object' ? text(value.props?.children) : String(value)
  return { render, text: () => text(render()), confirmationCount: () => nodes(render()).filter(n => typeof n.type === 'function' && n.type.name === 'ContentPublicationConfirmation').length, click(label) {
    const node = nodes(render()).find(n => n.type === 'button' && text(n.props.children) === label)
    assert.ok(node, `Missing button ${label}`); assert.notEqual(node.props.disabled, true); node.props.onClick()
  }, unmount() { cleanups.forEach(fn => fn?.()); mounted = false }, lateWrites }
}
const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve() }

test('actual Facebook confirmation is absent for unapproved, other-platform or unsupported-format reviews', () => {
  for (const change of [{ state: 'rejected' }, { state: 'superseded' }, { state: 'pending' }, { channels: ['instagram'] }, { channels: ['tiktok'] },
    { channels: ['linkedin'] }, { channels: ['manual'] }, { channels: [] }, { channels: null }, { media_type: 'video/mp4' }, { media_type: 'image/webp' }]) {
    let reads = 0
    const c = componentHarness({ prepareStaffPublication: async () => { reads++; return confirmationPreview } }, ids.review, true, change)
    assert.equal(c.text().includes('Prepare Facebook schedule'), false, JSON.stringify(change))
    assert.equal(reads, 0)
  }
})

for (const media_type of ['image/png', 'image/jpeg']) test(`supported approved Facebook ${media_type} metadata permits the candidate without implying provider access`, () => {
  const review = { id: ids.review, state: 'approved', media_type, channels: ['instagram', 'facebook'] }
  assert.equal(frontend.canPrepareFacebookPhotoReview(review), true)
  for (const value of [null, undefined, { ...review, id: 'not-a-review' }, { ...review, channels: null }]) assert.equal(frontend.canPrepareFacebookPhotoReview(value), false)
  const c = componentHarness({ prepareStaffPublication: async () => confirmationPreview }, ids.review, true, review)
  assert.match(c.text(), /Prepare Facebook schedule/)
})

test('panel hides new authority for unsupported reviews but preserves status and exact withdrawal', async () => {
  for (const change of [{ state: 'superseded' }, { channels: ['instagram'] }, { channels: ['tiktok'] }, { media_type: 'image/webp' }]) {
    const f = await fixture(), status = await readStatus(f); let writes = 0
    const panel = componentHarness({ PUBLICATION_CONFIRMATION_VISIBLE: true, getStaffPublicationStatus: async () => status,
      withdrawStaffPublication: async () => { writes++; return { state: 'cancelled', providerMayHaveStarted: false } } }, ids.review, false, change)
    panel.click('Publishing status'); await settle()
    assert.equal(panel.confirmationCount(), 0, JSON.stringify(change)); assert.match(panel.text(), /Queued in Dynamics/)
    panel.click('Stop queued publishing'); assert.equal(writes, 0)
    panel.click('Confirm withdrawal'); await settle(); assert.equal(writes, 1)
  }
  const eligible = componentHarness({ PUBLICATION_CONFIRMATION_VISIBLE: true, getStaffPublicationStatus: async () => ({ reviewId: ids.review, clientId: ids.client, canAuthorize: false, items: [] }) }, ids.review)
  eligible.click('Publishing status'); await settle(); assert.equal(eligible.confirmationCount(), 1)
})

test('actual panel requires a second confirmation and invalidates old data after uncertain withdrawal', async () => {
  const f = await fixture(), status = await readStatus(f); let writes = 0, reads = 0
  const panel = componentHarness({ getStaffPublicationStatus: async () => { reads++; return status }, withdrawStaffPublication: async () => { writes++; return null } }, ids.review)
  panel.click('Publishing status'); await settle()
  assert.equal(reads, 1); assert.match(panel.text(), /Queued in Dynamics/)
  panel.click('Stop queued publishing'); assert.equal(writes, 0)
  panel.click('Confirm withdrawal'); await settle()
  assert.equal(writes, 1); assert.match(panel.text(), /Withdrawal could not be verified/)
  assert.equal(panel.text().includes('Stop queued publishing'), false)
  assert.equal(panel.text().includes('No Dynamics publication jobs'), false)
  panel.click('Refresh status'); await settle(); assert.equal(reads, 2)
})

test('actual panel discards a previous review late response after the review key changes', async () => {
  const f = await fixture(), statusA = await readStatus(f); let resolveA
  const statusB = { ...statusA, reviewId: randomUUID(), items: [{ ...statusA.items[0], jobId: randomUUID(), accountLabel: 'Client B exact account' }] }
  const pendingA = new Promise(resolve => { resolveA = resolve })
  const a = componentHarness({ getStaffPublicationStatus: async () => pendingA }, ids.review)
  a.click('Publishing status'); a.unmount()
  const b = componentHarness({ getStaffPublicationStatus: async () => statusB }, statusB.reviewId)
  b.click('Publishing status'); await settle(); assert.match(b.text(), /Client B exact account/)
  resolveA(statusA); await settle()
  assert.equal(a.lateWrites.length, 0); assert.equal(b.text().includes('Facebook Page · 12345'), false)
})

test('actual panel preserves in-flight truth after withdrawal and never makes provider processing look cancelled', async () => {
  const f = await fixture(), status = await readStatus(f)
  status.items[0].state = 'submitting'; status.items[0].providerMayHaveStarted = true
  const panel = componentHarness({ getStaffPublicationStatus: async () => status,
    withdrawStaffPublication: async () => { status.items[0].authorizationState = 'revoked'; return { state: 'submitting', providerMayHaveStarted: true } } }, ids.review)
  panel.click('Publishing status'); await settle(); panel.click('Withdraw publishing authority'); panel.click('Confirm withdrawal'); await settle()
  assert.match(panel.text(), /Submission started/); assert.match(panel.text(), /nothing was deleted/)
  assert.equal(panel.text().includes('Stopped in Dynamics'), false)
})

test('manager sees the exact safe recovery action; uncertain attempts always take precedence over source errors', async () => {
  const f = await fixture(), status = await readStatus(f), item = status.items[0]
  Object.assign(item, { state: 'blocked', errorCode: 'FRESH_TEAMS_EVIDENCE_REQUIRED', providerMayHaveStarted: false })
  const panel = componentHarness({ getStaffPublicationStatus: async () => status }, ids.review)
  panel.click('Publishing status'); await settle()
  assert.match(panel.text(), /Publishing manager action needed/)
  assert.match(panel.text(), /scheduling owner.*sync hold/)
  item.providerMayHaveStarted = true
  assert.match(panel.text(), /A post may already exist/)
  assert.doesNotMatch(panel.text(), /refresh the approved capture/)
  Object.assign(item, { errorCode: 'PRIVATE_TOKEN_ERROR', providerMayHaveStarted: false })
  assert.doesNotMatch(panel.text(), /PRIVATE_TOKEN_ERROR/)
  for (const [errorCode, message] of [['BLOCKED_SOURCE_CHANGED', /approved content or schedule changed/],
    ['BLOCKED_OVERDUE_REVIEW', /planned time has passed/], ['BLOCKED_TOKEN_OR_TIME', /account token or scheduled time/]]) {
    assert.match(frontend.publicationNextAction({ state: 'blocked', errorCode, providerMayHaveStarted: false }), message)
  }
  for (const state of ['queued', 'processing', 'provider_scheduled', 'posted', 'cancelled']) {
    assert.equal(frontend.publicationNextAction({ state, errorCode: null, providerMayHaveStarted: false }), null)
  }
})

const confirmationPreview = { reviewId: ids.review, clientId: ids.client, accountId: '12345', platform: 'facebook', caption: 'Approved caption', mediaType: 'image/png',
  assetSha256: 'a'.repeat(64), fingerprint: 'b'.repeat(64), scheduledAt: '2026-11-17T08:00:00Z' }
const previewResponse = () => ({ ok: true, preview: { ...confirmationPreview, target: { reviewVersionId: ids.review, clientId: ids.client, accountId: '12345', route: 'facebook_page' } } })

const inspectionResponse = () => ({ ok: true, inspection: { contract: 'facebook_publication_readiness_v1', reviewId: ids.review, clientId: ids.client,
  accountId: '12345', accountName: 'Synthetic exact Page', scheduledAt: confirmationPreview.scheduledAt, checkedAt: new Date().toISOString(), assetSha256: 'a'.repeat(64), canConfirm: false, canPublish: false,
  checks: [{ key: 'account', status: 'pass', code: null }, { key: 'image', status: 'pass', code: null },
    { key: 'teams', status: 'unavailable', code: 'FRESH_TEAMS_EVIDENCE_REQUIRED' }, { key: 'time', status: 'pass', code: null }, { key: 'release', status: 'blocked', code: 'PUBLISHING_DISABLED' }] } })

test('readiness browser adapter is exact-review, rejects authority/foreign/partial reports and never invokes confirmation', async () => {
  const calls = [], response = inspectionResponse()
  supabase.functions.invoke = async (name, options) => { calls.push([name, options]); return { data: response, error: null } }
  const result = await frontend.inspectStaffPublication(ids.review)
  assert.equal(result.message, null); assert.equal(result.inspection.canPublish, false)
  assert.deepEqual(calls, [['social-publication-authorization', { body: { action: 'inspect', reviewId: ids.review } }]])
  for (const change of [p => { p.reviewId = randomUUID() }, p => { p.canPublish = true }, p => { p.canConfirm = true }, p => { p.checks.pop() },
    p => { p.checks[1] = { ...p.checks[0] } }, p => { p.checks[2].code = 'PRIVATE_TOKEN' }, p => { p.assetSha256 = null }, p => { p.accountName = 'bad\nname' }]) {
    const data = inspectionResponse(); change(data.inspection)
    assert.equal(frontend.projectFacebookInspection(data, ids.review), null)
  }
})

test('inspection failures expose only fixed staff recovery copy', async () => {
  supabase.functions.invoke = async () => ({ data: null, error: { context: Response.json({ error: 'EXACT_ACCOUNT_MAPPING_REQUIRED', raw: 'PRIVATE token' }, { status: 409 }) } })
  assert.match((await frontend.inspectStaffPublication(ids.review)).message, /single active Facebook Page mapping/)
  supabase.functions.invoke = async () => ({ data: null, error: { context: Response.json({ error: 'PRIVATE token' }, { status: 503 }) } })
  assert.doesNotMatch((await frontend.inspectStaffPublication(ids.review)).message, /PRIVATE token/)
})

test('actual read-only UI shows independent source/account checks and cannot prepare while a check is held', async () => {
  const p = frontend.projectFacebookInspection(inspectionResponse(), ids.review)
  const c = componentHarness({ inspectStaffPublication: async () => ({ inspection: p, message: null }) }, ids.review, true)
  c.click('Check Facebook readiness'); await settle()
  assert.match(c.text(), /Synthetic exact Page/); assert.match(c.text(), /No publishing job created/)
  assert.match(c.text(), /Facebook Page and permissions/); assert.match(c.text(), /Teams schedule/)
  assert.match(c.text(), /sync hold/); assert.doesNotMatch(c.text(), /Confirm this Facebook schedule/)
  assert.throws(() => c.click('Prepare Facebook schedule'))
})

test('late readiness cannot update a previous unmounted client review', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const c = componentHarness({ inspectStaffPublication: async () => pending }, ids.review, true)
  c.click('Check Facebook readiness'); c.unmount()
  resolve({ inspection: frontend.projectFacebookInspection(inspectionResponse(), ids.review), message: null }); await settle()
  assert.equal(c.lateWrites.length, 0)
})

test('browser preview is default-hidden, requests only review ID and refuses foreign or malformed evidence', async () => {
  assert.equal(frontend.PUBLICATION_CONFIRMATION_VISIBLE, false)
  const calls = []
  supabase.functions.invoke = async (name, options) => { calls.push([name, options]); return { data: previewResponse(), error: null } }
  assert.deepEqual(await frontend.prepareStaffPublication(ids.review), confirmationPreview)
  assert.deepEqual(calls, [['social-publication-authorization', { body: { action: 'preview', reviewId: ids.review } }]])
  const jpeg = previewResponse(); jpeg.preview.mediaType = 'image/jpeg'
  supabase.functions.invoke = async () => ({ data: jpeg, error: null })
  assert.deepEqual(await frontend.prepareStaffPublication(ids.review), { ...confirmationPreview, mediaType: 'image/jpeg' })
  for (const change of [p => { p.target.reviewVersionId = randomUUID() }, p => { p.target.route = 'instagram_login' }, p => { p.mediaType = 'image/webp' },
    p => { p.fingerprint = 'private' }, p => { p.scheduledAt = 'tomorrow' }, p => { p.target.accountId = 'invalid/page' }]) {
    const data = previewResponse(); change(data.preview); supabase.functions.invoke = async () => ({ data, error: null })
    assert.equal(await frontend.prepareStaffPublication(ids.review), null)
  }
})

test('browser confirmation supplies no account/media/proof overrides and uncertain receipts never become success', async () => {
  let captured
  const good = { ok: true, publication: { jobId: ids.job, authorizationId: ids.authorization, fingerprint: confirmationPreview.fingerprint, status: 'queued', state: 'queued' } }
  supabase.functions.invoke = async (name, options) => { captured = [name, options]; return { data: good, error: null } }
  assert.deepEqual(await frontend.confirmStaffPublication(confirmationPreview), { jobId: ids.job })
  assert.deepEqual(captured, ['social-publication-authorization', { body: { action: 'confirm', reviewId: ids.review, expectedFingerprint: confirmationPreview.fingerprint, confirmPublication: true } }])
  for (const data of [undefined, { ...good, publication: { ...good.publication, fingerprint: 'c'.repeat(64) } }, { ...good, publication: { ...good.publication, state: 'healthy' } }]) {
    supabase.functions.invoke = async () => ({ data, error: null }); assert.equal(await frontend.confirmStaffPublication(confirmationPreview), null)
  }
  supabase.functions.invoke = async () => { throw new Error('PRIVATE lost response') }
  assert.equal(await frontend.confirmStaffPublication(confirmationPreview), null)
})

test('actual confirmation UI requires a second action and clears uncertain confirmation before refreshing receipts', async () => {
  let writes = 0, refreshes = 0
  const c = componentHarness({ prepareStaffPublication: async () => confirmationPreview,
    confirmStaffPublication: async selected => { writes++; assert.equal(selected, confirmationPreview); return null }, onConfirmed: () => refreshes++ }, ids.review, true)
  c.click('Prepare Facebook schedule'); await settle(); assert.equal(writes, 0)
  assert.match(c.text(), /Approved caption/); assert.match(c.text(), /Facebook Page · 12345/); assert.match(c.text(), /not already scheduled/)
  c.click('Confirm this Facebook schedule'); await settle()
  assert.equal(writes, 1); assert.equal(refreshes, 1); assert.match(c.text(), /job may already exist/)
  assert.equal(c.text().includes('Confirm this Facebook schedule'), false)
})

test('actual confirmation UI cancellation is zero-write and success does not claim a live post', async () => {
  let writes = 0
  const c = componentHarness({ prepareStaffPublication: async () => confirmationPreview, confirmStaffPublication: async () => { writes++; return { jobId: ids.job } } }, ids.review, true)
  c.click('Prepare Facebook schedule'); await settle(); c.click('Cancel'); assert.equal(writes, 0)
  c.click('Prepare Facebook schedule'); await settle(); c.click('Confirm this Facebook schedule'); await settle()
  assert.equal(writes, 1); assert.match(c.text(), /not a verified live post yet/)
})

test('late confirmation preview cannot update an unmounted previous client review', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const c = componentHarness({ prepareStaffPublication: async () => pending }, ids.review, true)
  c.click('Prepare Facebook schedule'); c.unmount(); resolve(confirmationPreview); await settle()
  assert.equal(c.lateWrites.length, 0)
})
