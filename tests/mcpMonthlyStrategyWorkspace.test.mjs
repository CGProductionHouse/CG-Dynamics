import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyStrategyData } from '../src/lib/strategyEngine.ts'
import { loadMonthlyStrategyWorkspace, shapeMonthlyStrategyBrief, strategyMcpInputHash, strategyMonthIsCurrentOrNext, submitMonthlyStrategyProposal } from '../supabase/functions/cg-dynamics-mcp/monthlyStrategyWorkspace.ts'
import { assertToolAllowedInContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'

const CLIENT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ACTOR = '33333333-3333-4333-8333-333333333333'
const MONTH = '2026-11-01'
const TODAY = '2026-10-12'
const KEY = '44444444-4444-4444-8444-444444444444'
const goldStandard = {
  objective: 'Test whether a clearer Piek service enquiry route brings more qualified conversations.',
  audienceAndIntent: 'Compare local project buyers asking for a direct quote with those seeking detailed service guidance.',
  coreMessage: 'Show the exact customer problem, the relevant Piek service response and one useful next step.',
  formatsAndRationale: 'Use one confirmed video for a real demonstration and confirmed posters to explain the enquiry route.',
  testAndChange: 'Compare two opening questions, then keep the one associated with more qualified enquiries.',
  pillarsAndHooks: 'A real customer question, a documented service demonstration and a practical action to take next.',
  mustAvoid: 'Do not assert a price or service turnaround unless the client has confirmed the exact offer.',
  channelIntegration: 'Use connected channels for their observed results; do not infer a paid campaign from an organic post.',
  successSignals: 'Track genuine qualified enquiries and their source where the client has working measurement.',
  nextMonthGamePlan: 'Review enquiry quality and the stronger opening question before choosing the following month’s work.',
}
const proposal = {
  clientId: CLIENT, strategyMonth: MONTH, sourceIds: ['guide-1'], goldStandard,
  actionPlan: {
    professional_video: ['Film a genuine Piek service demonstration that answers one buyer question.'],
    design_poster: ['Design a concise route from the buyer problem to the exact enquiry contact.'],
  },
}

class Query {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.sort = null; this.max = null }
  select() { return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  order(key, options) { this.sort = [key, options.ascending]; return this }
  limit(value) { this.max = value; return this }
  maybeSingle() {
    if (this.db.errors.has(this.table)) return Promise.resolve({ data: null, error: { message: 'controlled failure' } })
    let rows = (this.db.tables[this.table] ?? []).filter(row => this.filters.every(filter => filter(row)))
    if (this.sort) rows = [...rows].sort((a, b) => String(a[this.sort[0]]).localeCompare(String(b[this.sort[0]])) * (this.sort[1] ? 1 : -1))
    return Promise.resolve({ data: rows[0] ?? null, error: null })
  }
}
class FakeDb {
  constructor(row = true) {
    const draft = emptyStrategyData()
    draft.actionPlan.professional_video.enabled = true
    draft.actionPlan.design_poster.enabled = true
    this.draft = draft
    this.tables = {
      clients: [{ id: CLIENT, name: 'Piek Group', active: true, package_settings: {} }],
      client_guides: [{ id: 'guide-1', client_id: CLIENT, version: 2, runtime_readiness: 'ready', guide_markdown: 'Piek offers exact verified service lines.' }],
      monthly_client_strategies: row ? [{ id: 'strategy-1', client_id: CLIENT, strategy_month: MONTH, workflow_status: 'draft',
        published_version: null, version: 1, strategy_data: draft, seed_context: { origin: 'monthly_strategy_autopilot' }, staff_amended_at: null, internal_notes: 'Keep staff note.' }] : [],
      monthly_client_strategy_revisions: [],
    }
    this.errors = new Set()
    this.calls = []
  }
  from(table) { return new Query(this, table) }
  async rpc(name, args) {
    this.calls.push({ name, args })
    const row = this.tables.monthly_client_strategies[0]
    if (name === 'propose_monthly_client_strategy_generation') {
      if (row.version !== args.p_expected_version || row.workflow_status !== 'draft') return { data: null, error: { message: 'Strategy version conflict' } }
      row.version += 1
      row.strategy_data = args.p_strategy_data
    } else if (name === 'seed_monthly_client_strategy') {
      if (row) return { data: { created: false, strategy_id: row.id }, error: null }
      this.tables.monthly_client_strategies.push({ id: 'strategy-2', client_id: CLIENT, strategy_month: MONTH,
        workflow_status: 'draft', published_version: null, version: 1, strategy_data: args.p_strategy_data, seed_context: args.p_seed_context })
    } else throw new Error(`Unexpected RPC: ${name}`)
    const receipt = { strategy_id: row?.id ?? 'strategy-2', version: row?.version ?? 1, workflow_status: 'draft', created: !row,
      after_seed_context: name === 'propose_monthly_client_strategy_generation' ? args.p_seed_context : undefined }
    this.tables.monthly_client_strategy_revisions.push({ client_id: CLIENT, strategy_month: MONTH, idempotency_key: KEY, actor_profile_id: ACTOR, receipt })
    return { data: receipt, error: null }
  }
}
function prepared(db, blockers = []) {
  return {
    draft: db.draft,
    evidence: [{ authority: 'client_guide', source_id: 'guide-1', field: 'strategyDrivers', excerpt: 'Piek exact client service lines.' }],
    blockers,
    previousReportId: null,
    seedContext: {
      origin: 'monthly_strategy_autopilot', client_id: CLIENT, strategy_month: MONTH,
      sources: { client_guide_id: 'guide-1' }, intelligence_evidence: [],
      source_coverage: { client_guide: 'available', previous_published_report: 'none' },
      source_windows: { confirmed_package_scope: { professional_video: 1, design_poster: 3 } },
    },
  }
}
const deps = db => ({ prepare: async () => prepared(db), sourceDigest: async () => 'source-digest' })
const submitInput = (brief, extra = {}) => ({
  clientId: CLIENT, strategyMonth: MONTH, today: TODAY,
  evidenceFingerprint: brief.evidence_fingerprint,
  expectedVersion: brief.canonical_draft?.version ?? null,
  proposal, actorProfileId: ACTOR, idempotencyKey: KEY, ...extra,
})

test('company strategy tools are unavailable to staff/client Projects', () => {
  for (const tool of ['list_monthly_strategy_clients', 'get_monthly_strategy_brief', 'submit_monthly_strategy_draft']) {
    assert.equal(assertToolAllowedInContext(tool, 'company_admin').allowed, true)
    assert.equal(assertToolAllowedInContext(tool, 'staff').allowed, false)
    assert.equal(assertToolAllowedInContext(tool, 'client').allowed, false)
  }
})

test('strategy MCP idempotency hash accepts Unicode and nested key reordering', async () => {
  const first = { client_id: CLIENT, proposal: { message: 'Bloemfontein – ŉ egte plan', sourceIds: ['guide-1'] }, idempotency_key: 'same' }
  const reordered = { proposal: { sourceIds: ['guide-1'], message: 'Bloemfontein – ŉ egte plan' }, client_id: CLIENT, idempotency_key: 'other' }
  assert.equal(await strategyMcpInputHash(first), await strategyMcpInputHash(reordered))
})

test('only current and next month are eligible, including year rollover', () => {
  assert.equal(strategyMonthIsCurrentOrNext(TODAY, MONTH), true)
  assert.equal(strategyMonthIsCurrentOrNext(TODAY, '2026-12-01'), false)
  assert.equal(strategyMonthIsCurrentOrNext('2026-12-15', '2027-01-01'), true)
  assert.equal(strategyMonthIsCurrentOrNext(TODAY, '2026-11-12'), false)
})

test('brief exposes exact source/window/version and never claims unknown report data as zero', async () => {
  const db = new FakeDb()
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  assert.equal(brief.state, 'ready_for_proposal')
  assert.equal(brief.canonical_draft.version, 1)
  assert.equal(brief.source_coverage.previous_published_report, 'none')
  assert.deepEqual(brief.source_windows.confirmed_package_scope, { professional_video: 1, design_poster: 3 })
  assert.equal(brief.evidence[0].source_id, 'guide-1')
  assert.equal(brief.ready_client_guide.version, 2)
})

test('cited proposal saves only a version-fenced unpublished canonical draft, preserving staff notes', async () => {
  const db = new FakeDb()
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  const result = await submitMonthlyStrategyProposal(db, submitInput(brief), deps(db))
  assert.equal(result.state, 'draft_filled')
  assert.equal(result.published, false)
  assert.equal(db.calls.length, 1)
  assert.equal(db.calls[0].name, 'propose_monthly_client_strategy_generation')
  assert.equal(db.calls[0].args.p_expected_version, 1)
  assert.equal(db.calls[0].args.p_internal_notes, 'Keep staff note.')
  assert.equal(db.calls[0].args.p_seed_context.generation.provider, 'chatgpt_company_admin_mcp')
  assert.equal(db.tables.monthly_client_strategies[0].strategy_data.goldStandard.objective, goldStandard.objective)
  assert.equal(db.tables.monthly_client_strategies[0].strategy_data.actionPlan.reels.enabled, false)
  const replay = await submitMonthlyStrategyProposal(db, submitInput(brief), deps(db))
  assert.equal(replay.state, 'replayed')
  assert.equal(db.calls.length, 1)
  const conflictingRetry = await submitMonthlyStrategyProposal(db, submitInput(brief, { proposal: { ...proposal, sourceIds: ['different-source'] } }), deps(db))
  assert.equal(conflictingRetry.error, 'STRATEGY_IDEMPOTENCY_CONFLICT')
})

test('missing canonical row seeds once through the existing exact-client RPC', async () => {
  const db = new FakeDb(false)
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  assert.equal(brief.canonical_draft, null)
  const result = await submitMonthlyStrategyProposal(db, submitInput(brief), deps(db))
  assert.equal(result.state, 'draft_filled')
  assert.equal(db.calls[0].name, 'seed_monthly_client_strategy')
  assert.equal(db.tables.monthly_client_strategies.length, 1)
})

test('changed guide, wrong version/client and failed source read refuse all writes', async () => {
  const db = new FakeDb()
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  db.tables.client_guides[0].guide_markdown = 'Revised exact-client guide.'
  assert.equal((await submitMonthlyStrategyProposal(db, submitInput(brief), deps(db))).error, 'STRATEGY_SOURCE_CHANGED')
  db.tables.client_guides[0].guide_markdown = 'Piek offers exact verified service lines.'
  assert.equal((await submitMonthlyStrategyProposal(db, submitInput(brief, { expectedVersion: 3 }), deps(db))).error, 'STRATEGY_VERSION_CONFLICT')
  assert.equal((await submitMonthlyStrategyProposal(db, submitInput(brief, { proposal: { ...proposal, clientId: OTHER } }), deps(db))).error, 'STRATEGY_PROPOSAL_INVALID')
  db.errors.add('client_guides')
  await assert.rejects(loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)), /GUIDE_READ_UNAVAILABLE/)
  assert.equal(db.calls.length, 0)
})

test('unconfirmed package, absent exact evidence and reviewed row remain blocked', async () => {
  const db = new FakeDb()
  const blocked = await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, { ...deps(db), prepare: async () => prepared(db, ['PACKAGE_UNVERIFIED']) })
  assert.deepEqual(blocked.blockers, ['PACKAGE_UNVERIFIED'])
  const withoutEvidence = await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, {
    ...deps(db), prepare: async () => ({ ...prepared(db), evidence: [] }),
  })
  assert.ok(withoutEvidence.blockers.includes('EXACT_STRATEGY_EVIDENCE_UNAVAILABLE'))
  db.tables.monthly_client_strategies[0].strategy_data = structuredClone(db.draft)
  db.tables.monthly_client_strategies[0].strategy_data.actionPlan.design_poster.enabled = false
  const scopeDrift = await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db))
  assert.ok(scopeDrift.blockers.includes('PACKAGE_STRATEGY_SCOPE_DRIFT'))
  db.tables.monthly_client_strategies[0].strategy_data.actionPlan.design_poster.enabled = true
  db.tables.monthly_client_strategies[0].workflow_status = 'approved'
  const reviewed = await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db))
  assert.ok(reviewed.blockers.includes('REVIEWED_OR_PUBLISHED_STRATEGY'))
  assert.equal(db.calls.length, 0)
})

test('connector wiring has no approve/publish action and reuses guarded strategy RPC', () => {
  const index = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
  assert.match(index, /submit_monthly_strategy_draft: handleSubmitMonthlyStrategyDraft/)
  assert.match(index, /'submit_monthly_strategy_draft'/)
  assert.doesNotMatch(index, /transition_monthly_client_strategy/)
})
