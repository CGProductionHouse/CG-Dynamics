import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Meta sync failed-item retry and terminal result (issue #166).
//
// Fixtures below are the ACTUAL seven failed rows from the completed 74-item
// production batch 79d1ff0d, copied verbatim including their warnings.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('../src/pages/admin/MetaIntegrationPage.tsx')
const sql = read('../supabase/migrations/20260805090000_meta_sync_failed_item_retry.sql')

let server, classifyMetaFailure, groupMetaFailuresByClient, summariseMetaTerminalResult

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ classifyMetaFailure, groupMetaFailuresByClient, summariseMetaTerminalResult } =
    await server.ssrLoadModule('/src/lib/metaSyncFailures.ts'))
})
after(async () => { await server.close() })

const PERMISSION_TEXT = "Facebook posts fetch page 1 failed (HTTP 400): (#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature. Refer to https://developers.facebook.com/docs/apps/review/login-permissions#manage-pages and https://developers.facebook.com/docs/apps/review/feature#reference-PAGES_ACCESS for details., type: OAuthException, code: 10"
const STAGE_TEXT = 'One or more Meta platform stages failed. Completed platform data was preserved.'

const PROD_FAILURES = [
  { id: 'i1', clientId: 'c-av', clientName: 'AV Event Life', month: '2026-06', error: PERMISSION_TEXT, warnings: [PERMISSION_TEXT], facebookState: 'failed', instagramState: 'complete', postsSynced: 8, attempts: 1 },
  { id: 'i2', clientId: 'c-av', clientName: 'AV Event Life', month: '2026-07', error: PERMISSION_TEXT, warnings: [PERMISSION_TEXT], facebookState: 'failed', instagramState: 'complete', postsSynced: 8, attempts: 2 },
  { id: 'i3', clientId: 'c-bloem', clientName: 'Bloem Marble & Granite', month: '2026-06', error: STAGE_TEXT, warnings: ['Facebook sync paused because Meta rate-limited the Page token request.', 'Instagram media fetch paused before page 7 to preserve the worker lease budget.', 'Instagram sync error: Error: Instagram media fetch paused before page 7 to preserve the worker lease budget.', 'Facebook posts fetch paused before page 1 to preserve the worker lease budget.'], facebookState: 'complete', instagramState: 'failed', postsSynced: 103, attempts: 2 },
  { id: 'i4', clientId: 'c-cape', clientName: 'Cape Lumber', month: '2026-06', error: STAGE_TEXT, warnings: ['Facebook sync paused because Meta rate-limited the Page token request.'], facebookState: 'failed', instagramState: 'complete', postsSynced: 15, attempts: 4 },
  { id: 'i5', clientId: 'c-lora', clientName: 'Loraclox', month: '2026-07', error: STAGE_TEXT, warnings: [], facebookState: 'complete', instagramState: 'failed', postsSynced: 12, attempts: 1 },
  { id: 'i6', clientId: 'c-red', clientName: 'Red Oak', month: '2026-06', error: 'Facebook sync error: AbortError: The signal has been aborted', warnings: ['Facebook sync paused because Meta rate-limited the Page token request.', 'Facebook sync error: AbortError: The signal has been aborted'], facebookState: 'failed', instagramState: 'not_applicable', postsSynced: 0, attempts: 1 },
  { id: 'i7', clientId: 'c-sec', clientName: 'Securiforce', month: '2026-06', error: STAGE_TEXT, warnings: ['Facebook sync paused because Meta rate-limited the Page token request.', 'Instagram sync error: Error: Instagram post upserts paused to preserve the worker lease budget.'], facebookState: 'complete', instagramState: 'failed', postsSynced: 16, attempts: 1 },
]

// ── Acceptance case: Red Oak transient abort is retryable ───────────────────
test('Red Oak transient abort is classified retryable', () => {
  const verdict = classifyMetaFailure(PROD_FAILURES.find(f => f.clientName === 'Red Oak'))
  assert.equal(verdict.category, 'transient')
  assert.equal(verdict.retryable, true)
  assert.equal(verdict.stage, 'facebook')
})

// ── Acceptance case: AV Event Life stays blocked and explains the permission ─
test('AV Event Life is a permission failure and is never auto-retried', () => {
  const verdict = classifyMetaFailure(PROD_FAILURES[0])
  assert.equal(verdict.category, 'permission')
  assert.equal(verdict.retryable, false)
  assert.match(verdict.action, /pages_read_user_content/)
  assert.match(verdict.action, /Reconnect/i)
})

// ── Acceptance case: two failed months group under one client ───────────────
test("AV Event Life's two failed months group under one client", () => {
  const groups = groupMetaFailuresByClient(PROD_FAILURES)
  const av = groups.filter(g => g.clientName === 'AV Event Life')
  assert.equal(av.length, 1, 'AV Event Life must appear exactly once')
  assert.deepEqual(av[0].months, ['2026-06', '2026-07'])
  assert.equal(av[0].itemIds.length, 2)
  assert.equal(av[0].retryable, false)
})

test('the seven production month-items group into six clients', () => {
  const groups = groupMetaFailuresByClient(PROD_FAILURES)
  assert.equal(groups.length, 6)
  assert.equal(groups.flatMap(g => g.itemIds).length, 7)
  // Permission problems are listed first — they need a human, not a retry.
  assert.equal(groups[0].category, 'permission')
})

// ── Acceptance case: stage failures name the stage, without raw text ────────
test('a generic stage failure identifies the affected stage', () => {
  const loraclox = classifyMetaFailure(PROD_FAILURES.find(f => f.clientName === 'Loraclox'))
  assert.equal(loraclox.category, 'stage')
  assert.equal(loraclox.stage, 'instagram')
  assert.match(loraclox.headline, /Instagram/)
  assert.doesNotMatch(loraclox.headline, /One or more Meta platform stages/)
})

test('preserved platform data is stated so a month never looks entirely lost', () => {
  const bloem = classifyMetaFailure(PROD_FAILURES.find(f => f.clientName === 'Bloem Marble & Granite'))
  assert.match(bloem.headline, /Facebook data was collected and kept \(103 posts\)/)
})

// ── No raw technical text reaches the user ──────────────────────────────────
test('AbortError, OAuth codes and Graph URLs never appear in user-facing text', () => {
  for (const item of PROD_FAILURES) {
    const verdict = classifyMetaFailure(item)
    const shown = `${verdict.headline} ${verdict.action}`
    assert.doesNotMatch(shown, /AbortError/, item.clientName)
    assert.doesNotMatch(shown, /OAuthException/, item.clientName)
    assert.doesNotMatch(shown, /https?:\/\//, item.clientName)
    assert.doesNotMatch(shown, /HTTP \d{3}/, item.clientName)
    assert.doesNotMatch(shown, /code: \d+/, item.clientName)
    assert.doesNotMatch(shown, /worker lease budget/, item.clientName)
  }
})

test('full diagnostics are preserved for the expandable detail', () => {
  const bloem = classifyMetaFailure(PROD_FAILURES.find(f => f.clientName === 'Bloem Marble & Granite'))
  // error + its four warnings, nothing dropped.
  assert.equal(bloem.diagnostics.length, 5)
  assert.ok(bloem.diagnostics.some(d => d.includes('worker lease budget')))
  const av = groupMetaFailuresByClient(PROD_FAILURES).find(g => g.clientName === 'AV Event Life')
  assert.ok(av.diagnostics.some(d => d.includes('OAuthException')))
})

// ── Unique clients vs client-month items ────────────────────────────────────
test('clients and client-month items are counted as different units', () => {
  // 37 clients x 2 months = 74 items; 67 succeeded, 7 failed across 6 clients.
  const items = []
  for (let c = 0; c < 37; c++) {
    for (const month of ['2026-06', '2026-07']) {
      items.push({ clientId: `c${c}`, clientName: `Client ${c}`, month, status: 'completed', postsSynced: 10, reportsReused: 1 })
    }
  }
  // Mirror production: 6 clients failing, one of them on both months.
  items[0].status = 'failed'; items[1].status = 'failed'          // client 0, both months
  items[2].status = 'failed'; items[4].status = 'failed'
  items[6].status = 'failed'; items[8].status = 'failed'; items[10].status = 'failed'

  const totals = summariseMetaTerminalResult(items)
  assert.equal(totals.itemsAttempted, 74)
  assert.equal(totals.itemsFailed, 7)
  assert.equal(totals.itemsSucceeded, 67)
  assert.equal(totals.clientsAttempted, 37)
  assert.equal(totals.clientsFailed, 6, 'a client failing two months is still one client')
  assert.equal(totals.clientsSucceeded, 31)
  // The two client numbers must always reconcile.
  assert.equal(totals.clientsSucceeded + totals.clientsFailed, totals.clientsAttempted)
  assert.equal(totals.monthsCovered, 2)
})

test('the UI reports items and clients with distinct labels', () => {
  assert.match(page, /Client-month items synced: \{syncResult\.itemsSucceeded \?\? 0\} of \{syncResult\.itemsAttempted\}/)
  assert.match(page, /Clients fully synced:/)
  assert.match(page, /Clients needing attention:/)
  assert.match(page, /summariseMetaTerminalResult/)
  // The old conflation is gone.
  assert.doesNotMatch(page, /clientsAttempted: totalItems/)
})

// ── Retry: retryable only, existing batch, nothing successful re-run ────────
test('Retry failed items is offered only for retryable failures', () => {
  const groups = groupMetaFailuresByClient(PROD_FAILURES)
  const retryableIds = groups.filter(g => g.retryable).flatMap(g => g.itemIds)
  assert.equal(retryableIds.length, 5, 'five of seven items are retryable')
  assert.ok(!retryableIds.includes('i1') && !retryableIds.includes('i2'), 'permission items must never be offered')
  assert.match(page, /Retry \$\{retryableItemIds\.length\} failed item/)
  assert.match(page, /const retryable = groups\.filter\(g => g\.retryable\)/)
})

test('the server enforces the retryable-only rule, not just the UI', () => {
  const fn = sql.slice(sql.indexOf('function public.meta_sync_retry_failed_items'))
  assert.match(fn, /public\.meta_sync_failure_category\(i\.error, i\.warnings\) <> 'permission'/)
  assert.match(fn, /Every remaining failure needs a Meta permission fix/)
  assert.match(fn, /is_staff/)
})

test('retry targets the existing batch and never creates another', () => {
  const fn = sql.slice(sql.indexOf('function public.meta_sync_retry_failed_items'))
  assert.doesNotMatch(fn, /insert into public\.meta_sync_batches/)
  assert.doesNotMatch(fn, /insert into public\.meta_sync_batch_items/)
  assert.match(fn, /update public\.meta_sync_batches/)
  assert.match(page, /p_batch_id: batchIdValue/)
})

test('retry only ever touches failed items, so successes are never re-run', () => {
  const fn = sql.slice(sql.indexOf('function public.meta_sync_retry_failed_items'))
  // Both the count and the update are constrained to status = 'failed'.
  assert.equal((fn.match(/i\.status = 'failed'/g) ?? []).length, 2)
  assert.doesNotMatch(fn, /status = 'completed'/)
})

test('only the failed platform stage is reset, preserving collected data', () => {
  const fn = sql.slice(sql.indexOf('function public.meta_sync_retry_failed_items'))
  assert.match(fn, /facebook_sync_state = case when retryable\.facebook_sync_state = 'failed' then 'pending' else retryable\.facebook_sync_state end/)
  assert.match(fn, /instagram_sync_state = case when retryable\.instagram_sync_state = 'failed' then 'pending' else retryable\.instagram_sync_state end/)
  // A completed stage keeps its cursor so it is not re-fetched.
  assert.match(fn, /facebook_next_cursor = case when retryable\.facebook_sync_state = 'failed' then null else item\.facebook_next_cursor end/)
})

test('counters are recalculated truthfully after retry', () => {
  const fn = sql.slice(sql.indexOf('function public.meta_sync_retry_failed_items'))
  assert.match(fn, /perform public\.recalculate_batch_status\(p_batch_id\)/)
  assert.match(fn, /recovery_watermark = v_settled/)
  // The UI re-derives every counter from the items after the retry drains.
  assert.match(page, /startPolling\(batchIdValue\)/)
})

test('permission failures are never retried automatically anywhere', () => {
  const permission = classifyMetaFailure(PROD_FAILURES[0])
  assert.equal(permission.retryable, false)
  const groups = groupMetaFailuresByClient(PROD_FAILURES)
  assert.equal(groups.find(g => g.clientName === 'AV Event Life').retryable, false)
  assert.match(page, /None of these can be fixed by retrying/)
})

test('a client with mixed causes takes the worst category and blocks retry', () => {
  const mixed = [
    { ...PROD_FAILURES[5], id: 'm1', clientId: 'c-mix', clientName: 'Mixed', month: '2026-06' },
    { ...PROD_FAILURES[0], id: 'm2', clientId: 'c-mix', clientName: 'Mixed', month: '2026-07' },
  ]
  const [group] = groupMetaFailuresByClient(mixed)
  assert.equal(group.category, 'permission')
  assert.equal(group.retryable, false, 'one blocked month blocks the whole client')
  assert.deepEqual(group.months, ['2026-06', '2026-07'])
})

// ── Raw text is available but not shown by default ──────────────────────────
test('raw provider text lives behind an expandable technical detail', () => {
  assert.match(page, /Technical detail/)
  assert.match(page, /group\.diagnostics\.map/)
  assert.match(page, /<details/)
})
