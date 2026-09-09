import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, policy, msf, cgtime, ctx, catalog
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  const load = p => server.ssrLoadModule(`/supabase/functions/cg-dynamics-mcp/${p}`)
  policy = await load('coexistencePolicy.ts')
  msf = await load('microsoftSourceFields.ts')
  cgtime = await load('cgTime.ts')
  ctx = await load('projectContext.ts')
  catalog = await load('toolCatalog.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')

// ── 1. Microsoft sync health ────────────────────────────────────────────────

test('sync health is degraded when no reconciliation has ever run', () => {
  const h = msf.summarizeSyncHealth(null, '2026-09-10T06:00:00Z')
  assert.equal(h.state, 'never_run')
  assert.equal(h.degraded, true)
  assert.match(h.reason, /SYNC STALE/)
})

test('a failed or in-flight reconciliation is degraded, never treated as success', () => {
  assert.equal(msf.summarizeSyncHealth({ status: 'failed', safe_error: 'graph 429' }, '2026-09-10T06:00:00Z').state, 'failed')
  assert.equal(msf.summarizeSyncHealth({ status: 'failed' }, '2026-09-10T06:00:00Z').degraded, true)
  for (const status of ['previewed', 'applying']) {
    const h = msf.summarizeSyncHealth({ status }, '2026-09-10T06:00:00Z')
    assert.equal(h.state, 'in_progress')
    assert.equal(h.degraded, true)
  }
})

test('a fresh completed reconciliation is healthy but still requires the live Microsoft read', () => {
  const h = msf.summarizeSyncHealth({ status: 'completed', finished_at: '2026-09-10T05:30:00Z' }, '2026-09-10T06:00:00Z')
  assert.equal(h.state, 'healthy')
  assert.equal(h.degraded, false)
  assert.equal(h.age_minutes, 30)
  assert.match(h.reason, /Still perform the live Microsoft read/)
})

test('a stale reconciliation past the daily threshold is flagged', () => {
  const h = msf.summarizeSyncHealth({ status: 'completed', finished_at: '2026-09-08T06:00:00Z' }, '2026-09-10T06:00:00Z')
  assert.equal(h.state, 'stale')
  assert.equal(h.degraded, true)
  assert.equal(h.age_minutes, 2880)
})

test('a PARTIAL run inside the window is usable but still reports degraded coverage', () => {
  const h = msf.summarizeSyncHealth({ status: 'partial', finished_at: '2026-09-10T05:45:00Z' }, '2026-09-10T06:00:00Z')
  assert.equal(h.degraded, true)
  assert.match(h.reason, /PARTIAL/)
})

test('unknown or unparseable completion time is degraded, never assumed fresh', () => {
  assert.equal(msf.summarizeSyncHealth({ status: 'completed' }, '2026-09-10T06:00:00Z').degraded, true)
  assert.equal(msf.summarizeSyncHealth({ status: 'completed', finished_at: 'not-a-date' }, '2026-09-10T06:00:00Z').degraded, true)
})

test('sync status handler reads the existing run architecture and triggers nothing', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleGetMicrosoftSyncStatus'), INDEX.indexOf('const handleGetClientContext'))
  assert.match(h, /\.from\('microsoft_sync_runs'\)/)
  assert.match(h, /summarizeSyncHealth\(/)
  assert.doesNotMatch(h, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/, 'sync status must be read-only')
})

// ── 2. Durable source identity / classification ─────────────────────────────

test('a Microsoft-backed task yields a durable composite source key', () => {
  const l = msf.classifyMicrosoftLinkage({
    microsoft_plan_id: 'PLAN1', microsoft_task_id: 'TASK1', microsoft_bucket_id: 'B1',
    microsoft_last_synced_at: '2026-09-10T05:00:00Z',
  }, 'planner')
  assert.equal(l.classification, 'microsoft_backed')
  assert.equal(l.source_key, 'planner:PLAN1:TASK1')
  assert.equal(l.microsoft.task_id, 'TASK1')
  assert.equal(l.freshness.last_synced_at, '2026-09-10T05:00:00Z')
})

test('Dynamics-only work is legitimate, keyed null, and never hidden', () => {
  const l = msf.classifyMicrosoftLinkage({ title: 'Poster daily' }, 'planner')
  assert.equal(l.classification, 'dynamics_only')
  assert.equal(l.source_key, null)
  assert.equal(l.microsoft, null)
})

test('a removed Microsoft source is classified for suppression, not deletion', () => {
  const l = msf.classifyMicrosoftLinkage({
    microsoft_calendar_id: 'CAL', microsoft_event_id: 'EV', microsoft_source_removed_at: '2026-09-09T10:00:00Z',
  }, 'calendar')
  assert.equal(l.classification, 'microsoft_source_removed')
  assert.equal(l.source_key, 'calendar:CAL:EV')
  assert.equal(l.freshness.source_removed_at, '2026-09-09T10:00:00Z')
})

test('withSourceLinkage preserves human fields and folds raw microsoft columns into source', () => {
  const [row] = msf.withSourceLinkage([{
    id: 't1', title: 'Edit reel', status: 'to_do',
    microsoft_plan_id: 'P', microsoft_task_id: 'T', microsoft_source_hash: 'h',
  }], 'planner')
  assert.equal(row.title, 'Edit reel')
  assert.equal(row.status, 'to_do')
  assert.ok(!('microsoft_plan_id' in row), 'raw columns are folded into the source block')
  assert.equal(row.source.source_key, 'planner:P:T')
  assert.deepEqual(msf.withSourceLinkage(null, 'planner'), [])
})

test('task, calendar and Client Schedule reads all expose durable source identity', () => {
  assert.match(INDEX, /withSourceLinkage\(data, 'planner'\)/)
  assert.match(INDEX, /withSourceLinkage\(data, 'calendar'\)/)
  for (const f of ['microsoft_plan_id', 'microsoft_task_id']) {
    assert.ok(msf.PLANNER_MICROSOFT_FIELDS.includes(f))
  }
  for (const f of ['microsoft_calendar_id', 'microsoft_event_id']) {
    assert.ok(msf.CALENDAR_MICROSOFT_FIELDS.includes(f))
  }
})

// ── 3. Company-admin gating ─────────────────────────────────────────────────

test('company inventories require an explicit company_admin context', () => {
  for (const tool of ctx.COMPANY_ADMIN_TOOLS) {
    assert.equal(ctx.assertToolAllowedInContext(tool, 'company_admin').allowed, true)
    for (const kind of ['staff', 'client']) {
      const r = ctx.assertToolAllowedInContext(tool, kind)
      assert.equal(r.allowed, false, `${tool} must be refused in ${kind}`)
      assert.match(r.error, /company_admin/)
    }
  }
  assert.ok(ctx.COMPANY_ADMIN_TOOLS.includes('list_company_tasks'))
  assert.ok(ctx.COMPANY_ADMIN_TOOLS.includes('list_company_recurring_tasks'))
})

test('company task inventory never infers completion and performs no cleanup', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleListCompanyTasks'), INDEX.indexOf('const handleListCompanyRecurringTasks'))
  assert.doesNotMatch(h, /\.delete\(|\.insert\(|\.update\(/, 'inventory is read-only')
  assert.doesNotMatch(h, /due_date.*completed|completed.*due_date/i, 'completion is never inferred from due date')
  assert.match(h, /state === 'source_removed'/)
  assert.match(h, /audit_note/)
})

// ── 4. Canonical runtime policy ─────────────────────────────────────────────

test('policy carries a version, effective timestamp and authority', () => {
  const p = policy.buildStaffAssistantPolicy('staff')
  assert.equal(p.policy_version, policy.STAFF_ASSISTANT_POLICY_VERSION)
  assert.equal(p.effective_at, policy.STAFF_ASSISTANT_POLICY_EFFECTIVE_AT)
  assert.match(p.authority, /#325/)
  assert.ok(p.policy_version.length > 0 && p.effective_at.endsWith('Z'))
})

test('policy states the mandatory dual-source rule and forbids title matching', () => {
  const p = policy.buildStaffAssistantPolicy('staff')
  const all = JSON.stringify(p)
  assert.match(all, /MUST read BOTH the live Microsoft side and the relevant CG Dynamics side/)
  assert.match(all, /[Tt]itle-only/)
  assert.match(all, /PARTIAL SYNC/)
  assert.match(all, /SYNC STALE/)
  assert.ok(p.daily_sequence.length >= 9)
})

test('policy explicitly supersedes the stale fallback-only wording', () => {
  const s = policy.buildStaffAssistantPolicy('staff').supersedes.join(' ')
  assert.match(s, /fallback-only/)
  assert.match(s, /read-only with no write-back/)
})

test('policy keeps Microsoft freshness authority and Client Schedule protection', () => {
  const p = policy.buildStaffAssistantPolicy('staff')
  assert.match(p.freshness_authority.microsoft_backed_tasks, /Teams\/Planner is the freshness authority/)
  assert.match(p.freshness_authority.microsoft_backed_calendar, /Outlook/)
  assert.match(p.client_schedule_protection.join(' '), /approval path/)
  assert.match(p.client_schedule_protection.join(' '), /MASTER CLIENT TO DO/)
  assert.match(p.mail_rule.join(' '), /DRAFT-ONLY/)
})

test('company_admin gets the admin section; staff and client do not', () => {
  assert.ok(policy.buildStaffAssistantPolicy('company_admin').company_admin_rule)
  assert.equal(policy.buildStaffAssistantPolicy('staff').company_admin_rule, undefined)
  assert.equal(policy.buildStaffAssistantPolicy('client').company_admin_rule, undefined)
})

test('bootstrap returns the canonical policy, including when the workspace table is absent', () => {
  assert.equal((INDEX.match(/buildStaffAssistantPolicy\(staff\.contextKind\)/g) ?? []).length, 2,
    'policy returned on both the normal and missing-workspace bootstrap paths')
  assert.match(INDEX, /staff_assistant_policy: buildStaffAssistantPolicy/)
  assert.match(INDEX, /policy_version: STAFF_ASSISTANT_POLICY_VERSION/)
  assert.match(INDEX, /effective_at: STAFF_ASSISTANT_POLICY_EFFECTIVE_AT/)
  assert.match(INDEX, /context_kind: staff\.contextKind/)
})

// ── 5. SAST operating-day defect ────────────────────────────────────────────

test('the CG operating day is Africa/Johannesburg, not UTC', () => {
  // 00:37 SAST on 10 Sep 2026 == 22:37 UTC on 9 Sep. The brief must say 10 Sep.
  const justAfterMidnightSast = new Date('2026-09-09T22:37:00Z')
  assert.equal(cgtime.cgDate(justAfterMidnightSast), '2026-09-10')
  assert.equal(justAfterMidnightSast.toISOString().slice(0, 10), '2026-09-09', 'the old UTC path was a day behind')
  assert.equal(cgtime.cgDatePlusDays(1, justAfterMidnightSast), '2026-09-11')
})

test('the operating day is stable across the day and at the UTC rollover', () => {
  assert.equal(cgtime.cgDate(new Date('2026-09-10T09:00:00Z')), '2026-09-10')
  assert.equal(cgtime.cgDate(new Date('2026-09-10T21:59:00Z')), '2026-09-10')
  assert.equal(cgtime.cgDate(new Date('2026-09-10T22:00:00Z')), '2026-09-11', 'SAST midnight is 22:00 UTC')
})

test('get_my_day uses the operating-day helper and reports the timezone', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleGetMyDay'), INDEX.indexOf('const handleListMyTasks'))
  assert.match(h, /const today = cgDate\(now\)/)
  assert.match(h, /const tomorrow = cgDatePlusDays\(1, now\)/)
  assert.match(h, /timezone: CG_TIMEZONE/)
  assert.doesNotMatch(h, /toISOString\(\)\.slice\(0, 10\)/, 'the UTC day derivation must be gone')
})

// ── 6. get_client_context schema regressions ────────────────────────────────

test('get_client_context no longer queries nonexistent columns or tables', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleGetClientContext'), INDEX.indexOf('const handleListMyLeads'))
  assert.doesNotMatch(h, /\.from\('client_notes'\)/, 'public.client_notes does not exist')
  assert.doesNotMatch(h, /\.from\('marketing_library_sources'\)/, 'that table has no client_id and no content_type')
  assert.doesNotMatch(h, /\.select\([^)]*content_type/, 'content_type is not a real column')
  assert.doesNotMatch(h, /\.in\('trust_tier', \['approved', 'verified'\]\)/, 'those trust_tier values do not exist')
})

test('get_client_context resolves the canonical exact-client guide with no fallback', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleGetClientContext'), INDEX.indexOf('const handleListMyLeads'))
  assert.match(h, /\.from\('client_guides'\)/)
  assert.match(h, /\.eq\('client_id', clientId\)/)
  assert.match(h, /context_coverage/)
  assert.match(h, /No sibling, group or national fallback/)
})

test('missing client context is reported as such, never as silently empty', () => {
  const h = INDEX.slice(INDEX.indexOf('const handleGetClientContext'), INDEX.indexOf('const handleListMyLeads'))
  assert.match(h, /none_recorded/)
  assert.match(h, /unavailable_sources/)
  assert.match(h, /Do not substitute another client/)
})

// ── Catalog wiring ──────────────────────────────────────────────────────────

test('the three new read-only tools are exposed with per-tool OAuth and context', () => {
  const names = catalog.CG_DYNAMICS_MCP_TOOLS.map(t => t.name)
  for (const n of ['get_microsoft_sync_status', 'list_company_tasks', 'list_company_recurring_tasks']) {
    assert.ok(names.includes(n), `${n} exposed`)
    const t = catalog.CG_DYNAMICS_MCP_TOOLS.find(x => x.name === n)
    assert.equal(t.annotations.readOnlyHint, true, `${n} is read-only`)
    assert.ok(t.inputSchema.required.includes('context'), `${n} requires Project context`)
  }
})
