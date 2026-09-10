import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, ops, ctx, catalog
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  const load = p => server.ssrLoadModule(`/supabase/functions/cg-dynamics-mcp/${p}`)
  ops = await load('opsActions.ts')
  ctx = await load('projectContext.ts')
  catalog = await load('toolCatalog.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')

const slice = (from, to) => INDEX.slice(INDEX.indexOf(from), INDEX.indexOf(to))

// ── 1. Microsoft reconciliation execution ───────────────────────────────────

test('a job with every required source complete is PASS', () => {
  const r = ops.gradeSyncRun('complete', [
    { sourceName: 'Outlook', required: true, complete: true, recordCount: 12 },
    { sourceName: 'To Do', required: true, complete: true, recordCount: 30 },
  ])
  assert.equal(r.verdict, 'PASS')
  assert.equal(r.records_fetched, 42)
  assert.match(r.reason, /Still perform the live Microsoft read/)
})

test('an incomplete REQUIRED source is FAIL, never a silent pass', () => {
  const r = ops.gradeSyncRun('complete', [
    { sourceName: 'Outlook', required: true, complete: false },
    { sourceName: 'To Do', required: true, complete: true },
  ])
  assert.equal(r.verdict, 'FAIL')
  assert.deepEqual(r.required_incomplete, ['Outlook'])
  assert.match(r.reason, /SYNC FAILED/)
})

test('an optional or errored source degrades rather than fails', () => {
  const r = ops.gradeSyncRun('complete', [
    { sourceName: 'To Do', required: true, complete: true },
    { sourceName: 'Archive plan', required: false, complete: false },
  ])
  assert.equal(r.verdict, 'DEGRADED')
  const e = ops.gradeSyncRun('complete', [
    { sourceName: 'To Do', required: true, complete: true, safeError: 'graph 429' },
  ])
  assert.equal(e.verdict, 'DEGRADED')
  assert.equal(e.sources_failed, 1)
})

test('a failed, cancelled, still-running or empty job never reports PASS', () => {
  assert.equal(ops.gradeSyncRun('failed', [{ required: true, complete: true }]).verdict, 'FAIL')
  assert.equal(ops.gradeSyncRun('cancelled', [{ required: true, complete: true }]).verdict, 'FAIL')
  assert.equal(ops.gradeSyncRun('running', [{ required: true, complete: true }]).verdict, 'DEGRADED')
  assert.equal(ops.gradeSyncRun('complete', []).verdict, 'FAIL')
  assert.equal(ops.gradeSyncRun('complete', null).verdict, 'FAIL')
})

test('run_microsoft_sync drives the existing durable engine and builds no second one', () => {
  const h = slice('const handleRunMicrosoftSync', 'const PROVIDER_STATUS_FUNCTIONS')
  assert.match(h, /'microsoft-transition-sync'/)
  for (const action of ['job_start', 'job_process', 'job_status']) {
    assert.ok(h.includes(action), `uses existing ${action}`)
  }
  // No Microsoft Graph client of its own.
  assert.doesNotMatch(h, /graph\.microsoft\.com|login\.microsoftonline/i)
  // Bounded so the Edge budget is never exceeded, and resumable.
  assert.match(h, /MAX_SYNC_PROCESS_STEPS/)
  assert.match(h, /continuation/)
})

test('run_microsoft_sync never auto-applies protected business decisions', () => {
  const h = slice('const handleRunMicrosoftSync', 'const PROVIDER_STATUS_FUNCTIONS')
  assert.doesNotMatch(h, /\.from\('monthly_deliverables'\)/, 'the sync action never writes Client Schedule')
  assert.match(h, /scope_note/)
  assert.match(h, /MASTER CLIENT TO DO/)
  assert.match(h, /apply_note/)
})

// ── 2. CG Calendar dual-write ───────────────────────────────────────────────

test('calendar write matches by durable identity, never by title', () => {
  const h = slice('const handleUpsertCalendarEvent', 'async function invokeSiblingFunction')
  assert.match(h, /\.eq\('microsoft_event_id', microsoftEventId\)/)
  assert.match(h, /\.eq\('id', eventId\)/)
  assert.match(h, /Refusing to match by title/)
  assert.doesNotMatch(h, /\.ilike\(|\.eq\('title'/, 'no title-based matching')
})

test('calendar write records PARTIAL SYNC and withholds Microsoft freshness', () => {
  const h = slice('const handleUpsertCalendarEvent', 'async function invokeSiblingFunction')
  assert.match(h, /outlook_write_succeeded === false/)
  assert.match(h, /if \(!partialSync && effectiveMicrosoftEventId && effectiveMicrosoftCalendarId\)[\s\S]*writable\.microsoft_last_synced_at = nowIso/,
    'freshness is only stamped when the Outlook side actually landed')
  assert.match(h, /PARTIAL_SYNC/)
  assert.match(h, /never claim both were updated/)
  assert.match(h, /typeof input\.outlook_write_succeeded !== 'boolean'/)
  assert.match(h, /requires both microsoft_event_id and microsoft_calendar_id/)
  assert.match(h, /resolve to different durable identities/)
})

test('calendar write keeps CG Calendar separate from Client Schedule', () => {
  const h = slice('const handleUpsertCalendarEvent', 'async function invokeSiblingFunction')
  assert.match(h, /\.from\('company_calendar_events'\)/)
  assert.doesNotMatch(h, /\.from\('monthly_deliverables'\)/, 'Client Schedule is never written here')
  assert.match(h, /never merged into CG Calendar/)
  assert.match(h, /assertRecordClientMatchesContext/, 'client Projects stay pinned')
})

// ── 3. Content Run discovery ────────────────────────────────────────────────

test('discovery finds runs by every required entry point', () => {
  const h = slice('const handleFindContentRuns', 'const handleLinkContentRunDeliverables')
  for (const f of ['run_date', 'calendar_event_id', 'deliverable_id', 'client_id']) {
    assert.ok(h.includes(f), `supports lookup by ${f}`)
  }
  assert.match(h, /\.from\('content_guidelines'\)/)
  assert.match(h, /\.from\('content_guide_ideas'\)/)
  assert.match(h, /\.order\('position', \{ ascending: true \}\)/, 'videos are returned in order')
})

test('discovery never leaks raw OneDrive identifiers or URLs', () => {
  const h = slice('const handleFindContentRuns', 'const handleLinkContentRunDeliverables')
  assert.match(h, /classifyOneDriveReadiness/)
  // The classifier is what reaches the caller; it must not carry drive/item ids or urls.
  const r = ops.classifyOneDriveReadiness({ drive_id: 'DRV', month_folder_item_id: 'ITM', web_url: 'https://x', folder_name: 'Sep' })
  assert.equal(r.readiness, 'mapped')
  assert.equal(r.durable_ids_present, true)
  const json = JSON.stringify(r)
  assert.ok(!json.includes('DRV') && !json.includes('ITM') && !json.includes('https://x'), 'no raw ids or urls')
})

test('an unmapped Content Run is reported, and no folder convention is invented', () => {
  const r = ops.classifyOneDriveReadiness(null)
  assert.equal(r.readiness, 'unmapped')
  assert.equal(r.durable_ids_present, false)
  assert.match(r.note, /Do not guess or create a folder/)
  assert.match(r.note, /open CA decision/)
  // Partial mapping is still unmapped - both durable ids are required.
  assert.equal(ops.classifyOneDriveReadiness({ drive_id: 'D' }).readiness, 'unmapped')
})

// ── 4. Assistant-owned linkage ──────────────────────────────────────────────

const RUN_CLIENT = 'c1'

test('the Assistant resolves links itself by exact month and video number', () => {
  const plan = ops.planGuidelineVideoLinks(
    [
      { id: 'v2', position: 2, month: '2026-09', video_number: 2, client_id: RUN_CLIENT },
      { id: 'v1', position: 1, month: '2026-09', video_number: 1, client_id: RUN_CLIENT },
    ],
    [
      { id: 'd_late', client_id: RUN_CLIENT, month: '2026-09', instance_number: 2, scheduled_date: '2026-09-20', title: 'Late' },
      { id: 'd_early', client_id: RUN_CLIENT, month: '2026-09', instance_number: 1, scheduled_date: '2026-09-10', title: 'Early' },
    ],
    RUN_CLIENT,
  )
  assert.deepEqual(plan.map(p => p.video_id), ['v1', 'v2'], 'ordered by position')
  assert.equal(plan[0].deliverable_id, 'd_early')
  assert.equal(plan[1].deliverable_id, 'd_late')
  assert.ok(plan.every(p => p.outcome === 'linkable'))
})

test('one deliverable is never claimed by two videos', () => {
  const plan = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, title: 'Video' }, { id: 'v2', position: 2, title: 'Video' }],
    [{ id: 'd1', client_id: RUN_CLIENT, title: 'Video', scheduled_date: '2026-09-10' }],
    RUN_CLIENT,
  )
  assert.equal(plan[0].outcome, 'linkable')
  assert.equal(plan[1].outcome, 'no_candidate')
  assert.match(plan[1].reason, /Reported rather than guessed/)
})

test('ambiguous or merely ordered same-client candidates are never guessed', () => {
  const ambiguous = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, month: '2026-09', title: 'Video' }],
    [
      { id: 'd1', client_id: RUN_CLIENT, month: '2026-09', title: 'Video' },
      { id: 'd2', client_id: RUN_CLIENT, month: '2026-09', code: 'Video' },
    ],
    RUN_CLIENT,
  )
  assert.equal(ambiguous[0].outcome, 'ambiguous')

  const orderOnly = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, title: 'Unrelated concept' }],
    [{ id: 'd1', client_id: RUN_CLIENT, title: 'Different item', scheduled_date: '2026-09-01' }],
    RUN_CLIENT,
  )
  assert.equal(orderOnly[0].outcome, 'no_candidate')
})

test('deliverables claimed by another active guideline are unavailable', () => {
  const plan = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, title: 'Video' }],
    [{ id: 'd1', client_id: RUN_CLIENT, title: 'Video', claimed_elsewhere: true }],
    RUN_CLIENT,
  )
  assert.equal(plan[0].outcome, 'no_candidate')
})

test('cross-client linkage fails closed', () => {
  const other = ops.planGuidelineVideoLinks([{ id: 'v1', position: 1, client_id: 'OTHER' }], [], RUN_CLIENT)
  assert.equal(other[0].outcome, 'blocked_cross_client')

  const staleLink = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, deliverable_id: 'd_other' }],
    [{ id: 'd_mine', client_id: RUN_CLIENT }],
    RUN_CLIENT,
  )
  assert.equal(staleLink[0].outcome, 'blocked_cross_client')
  assert.match(staleLink[0].reason, /Refusing to silently relink/)
})

test('already-linked videos are left untouched (idempotent replan)', () => {
  const plan = ops.planGuidelineVideoLinks(
    [{ id: 'v1', position: 1, deliverable_id: 'd1' }],
    [{ id: 'd1', client_id: RUN_CLIENT }],
    RUN_CLIENT,
  )
  assert.equal(plan[0].outcome, 'already_linked')
  assert.equal(plan[0].deliverable_id, 'd1')
})

test('linkage defaults to a dry run and never modifies Client Schedule rows', () => {
  const h = slice('const handleLinkContentRunDeliverables', 'const CALENDAR_EVENT_TYPES')
  assert.match(h, /const dryRun = input\.dry_run !== false/, 'dry run is the default')
  assert.match(h, /\.from\('content_guide_ideas'\)\s*\n\s*\.update\(/, 'only the guideline video row is updated')
  assert.match(h, /\.is\('deliverable_id', null\)/, 'guarded so a repeat call cannot double-link')
  assert.match(h, /Client Schedule rows themselves were NOT modified/)
  assert.match(h, /blocked\.length > 0/, 'refuses to apply while a cross-client link exists')
})

// ── 5. Provider health ──────────────────────────────────────────────────────

test('an unreadable provider is UNKNOWN and degraded, never disconnected', () => {
  const t = ops.summarizeProviderHealth('meta', null, 'timeout')
  assert.equal(t.state, 'unavailable')
  assert.equal(t.degraded, true)
  assert.match(t.detail, /not as disconnected/)
  assert.equal(ops.summarizeProviderHealth('meta', null, null).state, 'unavailable')
  assert.equal(ops.summarizeProviderHealth('meta', {}, null).state, 'unavailable')
})

test('connected and not-connected are determinate states', () => {
  assert.equal(ops.summarizeProviderHealth('meta', { connected: true }).state, 'connected')
  const nc = ops.summarizeProviderHealth('tiktok', { connected: false })
  assert.equal(nc.state, 'not_connected')
  assert.equal(nc.degraded, true, 'a known-absent connection is not ready for Morning Ops')
  assert.equal(ops.summarizeProviderHealth('meta', { error: 'token expired' }).state, 'degraded')
})

test('provider actions reuse existing functions and change no authorisation', () => {
  const h = slice('const handleGetProviderHealth', 'const handleListCompanyTasks')
  for (const fn of ['meta-connection-status', 'google-ads-connection-status', 'tiktok-connection-status']) {
    assert.ok(INDEX.includes(fn), `reuses ${fn}`)
  }
  // Assert on what is INVOKED, not on prose: the provider handlers may only delegate to the
  // pre-existing status/sync functions, never to an auth, mapping or publishing endpoint.
  const allowed = new Set([
    ...Object.values({ meta: 'meta-connection-status', google_ads: 'google-ads-connection-status', tiktok: 'tiktok-connection-status' }),
    ...Object.values({ meta: 'meta-sync', google_ads: 'google-ads-sync', tiktok: 'tiktok-sync' }),
  ])
  const invoked = [...h.matchAll(/invokeSiblingFunction\([^,]+,\s*(?:'([^']+)'|([A-Z_]+)\[[^\]]+\])/g)]
    .map(m => m[1]).filter(Boolean)
  for (const fn of invoked) {
    assert.ok(allowed.has(fn), `${fn} is an approved existing provider function`)
  }
  // No direct provider HTTP calls of its own.
  assert.doesNotMatch(h, /graph\.facebook\.com|googleads\.googleapis|open-api\.tiktok|oauth2?\/token/i)
  assert.match(INDEX, /Routine sync runs only for an already-authorised provider connection/)
  // Routine sync is refused unless the provider is already connected.
  const sync = slice('const handleRunProviderSync', 'const handleListCompanyTasks')
  assert.match(sync, /summary\.state !== 'connected'/)
  assert.match(sync, /skipped: true/)
  assert.match(sync, /mode: 'previous_completed_month'/)
  assert.match(sync, /startDate: input\.start_date, endDate: input\.end_date/)
  assert.match(sync, /periodMonth/)
  assert.match(sync, /client_id is required/)
})

// ── Catalogue + gating ──────────────────────────────────────────────────────

test('the six new tools are exposed, contexted and correctly classified', () => {
  const expected = {
    run_microsoft_sync: false, get_provider_health: true, run_provider_sync: false,
    find_content_runs: true, link_content_run_deliverables: false, upsert_calendar_event: false,
  }
  for (const [name, readOnly] of Object.entries(expected)) {
    const t = catalog.CG_DYNAMICS_MCP_TOOLS.find(x => x.name === name)
    assert.ok(t, `${name} exposed`)
    assert.equal(t.annotations.readOnlyHint, readOnly, `${name} readOnly=${readOnly}`)
    assert.ok(t.inputSchema.required.includes('context'), `${name} requires Project context`)
    assert.equal(t.annotations.destructiveHint, false)
  }
})

test('company-wide actions require an explicit company_admin context', () => {
  for (const name of ['run_microsoft_sync', 'get_provider_health', 'run_provider_sync']) {
    assert.ok(ctx.COMPANY_ADMIN_TOOLS.includes(name), `${name} is admin-gated`)
    assert.equal(ctx.assertToolAllowedInContext(name, 'staff').allowed, false)
    assert.equal(ctx.assertToolAllowedInContext(name, 'client').allowed, false)
    assert.equal(ctx.assertToolAllowedInContext(name, 'company_admin').allowed, true)
  }
})

test('internal calendar/content-run actions are unavailable in client Projects', () => {
  for (const name of ['find_content_runs', 'link_content_run_deliverables', 'upsert_calendar_event']) {
    assert.equal(ctx.assertToolAllowedInContext(name, 'client').allowed, false)
    assert.equal(ctx.assertToolAllowedInContext(name, 'staff').allowed, true)
    assert.equal(ctx.assertToolAllowedInContext(name, 'company_admin').allowed, true)
  }
})

test('default staff task reads exclude terminal, archived and source-removed history', () => {
  const activeStates = slice('const ACTIVE_TASK_STATES', 'const handleGetMyDay')
  for (const state of ['to_do', 'in_progress', 'blocked', 'waiting_client', 'ready_internal_review', 'approved', 'scheduled']) {
    assert.match(activeStates, new RegExp(`'${state}'`), `${state} remains visible as active work`)
  }
  assert.doesNotMatch(activeStates, /'done'|'completed'/, 'terminal states are not in the default active set')
  const day = slice('const handleGetMyDay', 'const handleListMyTasks')
  const tasks = slice('const handleListMyTasks', 'const handleGetTask')
  for (const handler of [day, tasks]) {
    assert.match(handler, /\.is\('archived_at', null\)/)
    assert.match(handler, /\.is\('microsoft_source_removed_at', null\)/)
    assert.match(handler, /\.in\('status', ACTIVE_TASK_STATES\)/)
  }
  assert.match(tasks, /if \(input\.status\)/, 'explicit status still allows a history query')
})

test('record mutations are idempotency-keyed', () => {
  for (const name of ['link_content_run_deliverables', 'upsert_calendar_event']) {
    const t = catalog.CG_DYNAMICS_MCP_TOOLS.find(x => x.name === name)
    assert.ok(t.inputSchema.required.includes('idempotency_key'), `${name} requires idempotency_key`)
    assert.equal(t.annotations.idempotentHint, true)
  }
  assert.match(INDEX, /'link_content_run_deliverables', 'upsert_calendar_event'/, 'enforced in WRITE_TOOLS')
})

test('the caller token is forwarded for delegation but never returned', () => {
  assert.match(INDEX, /accessToken: match\[1\]/)
  assert.match(INDEX, /Authorization: `Bearer \$\{connection\.accessToken\}`/)
  // It must not be echoed into any tool result.
  assert.doesNotMatch(INDEX, /accessToken: staff\.connection\.accessToken,/)
  assert.doesNotMatch(INDEX, /access_token:/)
})
