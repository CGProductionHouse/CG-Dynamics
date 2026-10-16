import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyStrategyData } from '../src/lib/strategyEngine.ts'
import { loadMonthlyStrategyWorkspace, shapeMonthlyStrategyBrief, strategyMcpInputHash, strategyMonthIsCurrentOrNext, submitMonthlyStrategyProposal } from '../supabase/functions/cg-dynamics-mcp/monthlyStrategyWorkspace.ts'
import { assertToolAllowedInContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { amendMonthlyStrategyFields } from '../supabase/functions/cg-dynamics-mcp/monthlyStrategyAmendment.ts'

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
    if (name === 'propose_monthly_client_strategy_generation' || name === 'amend_monthly_client_strategy_with_context') {
      if (row.version !== args.p_expected_version || row.workflow_status !== 'draft') return { data: null, error: { message: 'Strategy version conflict' } }
      row.version += 1
      row.strategy_data = args.p_strategy_data
      if (name === 'amend_monthly_client_strategy_with_context') row.staff_amended_at = '2026-10-16T12:00:00Z'
    } else if (name === 'seed_monthly_client_strategy') {
      if (row) return { data: { created: false, strategy_id: row.id }, error: null }
      this.tables.monthly_client_strategies.push({ id: 'strategy-2', client_id: CLIENT, strategy_month: MONTH,
        workflow_status: 'draft', published_version: null, version: 1, strategy_data: args.p_strategy_data, seed_context: args.p_seed_context })
    } else throw new Error(`Unexpected RPC: ${name}`)
    const receipt = { strategy_id: row?.id ?? 'strategy-2', client_id: CLIENT, strategy_month: MONTH, version: row?.version ?? 1, workflow_status: 'draft', created: !row,
      after_seed_context: args.p_seed_context }
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
  for (const tool of ['list_monthly_strategy_clients', 'get_monthly_strategy_brief', 'submit_monthly_strategy_draft', 'amend_monthly_strategy_draft']) {
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

test('an untouched November autopilot row promotes legacy package prose through the guarded draft RPC', async () => {
  const db = new FakeDb()
  const row = db.tables.monthly_client_strategies[0]
  row.internal_notes = null
  row.strategy_data.goldStandard.formatsAndRationale = 'Work within Piek Group’s confirmed package of 1 professional video, 3 design posters; each format still needs an evidence-backed role.'
  row.strategy_data.goldStandard.nextMonthGamePlan = 'Sequence only the confirmed 1 professional video, 3 design posters; do not add channels or deliverables outside package.'
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  const result = await submitMonthlyStrategyProposal(db, submitInput(brief), deps(db))
  assert.equal(result.state, 'draft_filled')
  assert.deepEqual(result.conflicts, [])
  assert.ok(result.filled_fields.includes('goldStandard.formatsAndRationale'))
  assert.ok(result.filled_fields.includes('goldStandard.nextMonthGamePlan'))
  assert.equal(row.strategy_data.goldStandard.formatsAndRationale, goldStandard.formatsAndRationale)
  assert.equal(row.strategy_data.goldStandard.nextMonthGamePlan, goldStandard.nextMonthGamePlan)
  assert.equal(row.version, 2)
  assert.equal(row.workflow_status, 'draft')
  assert.equal(row.published_version, null)
  assert.equal(db.calls.length, 1)
})

test('MCP accepts exact confirmed twelve-poster scope without widening an unknown format', async () => {
  const db = new FakeDb()
  const exact = { ...proposal, actionPlan: { ...proposal.actionPlan, design_poster: Array.from({ length: 12 }, (_, index) =>
    `Poster ${index + 1}: make one verified Piek customer choice clear with a practical next step.`) } }
  const largePackage = { ...deps(db), prepare: async () => {
    const packet = prepared(db)
    packet.seedContext.source_windows.confirmed_package_scope = { professional_video: 4, design_poster: 12, reels: null }
    return packet
  } }
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, largePackage))
  const result = await submitMonthlyStrategyProposal(db, submitInput(brief, { proposal: exact }), largePackage)
  assert.equal(result.state, 'draft_filled')
  assert.equal(result.published, false)
  assert.equal(db.tables.monthly_client_strategies[0].strategy_data.actionPlan.design_poster.items.length, 12)
  assert.equal(db.tables.monthly_client_strategies[0].strategy_data.actionPlan.reels.enabled, false)
  assert.equal(db.calls.length, 1)
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
  const invalid = await submitMonthlyStrategyProposal(db, submitInput(brief, { proposal: { ...proposal, clientId: OTHER } }), deps(db))
  assert.equal(invalid.error, 'STRATEGY_PROPOSAL_INVALID')
  assert.deepEqual(invalid.issues, [{ path: 'clientId/strategyMonth', code: 'EXACT_TARGET_MISMATCH' }])
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

test('an otherwise confirmed package with no confirmed monthly content scope cannot accept a proposal', async () => {
  const db = new FakeDb()
  db.draft = emptyStrategyData()
  db.tables.monthly_client_strategies[0].strategy_data = db.draft
  const noMonthlyScope = { ...deps(db), prepare: async () => {
    const packet = prepared(db)
    packet.seedContext.source_windows.confirmed_package_scope = {
      professional_video: null, photo_content: null, design_poster: null,
    }
    return packet
  } }
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, noMonthlyScope))
  assert.deepEqual(brief.confirmed_formats, [])
  assert.equal(brief.state, 'blocked')
  assert.ok(brief.blockers.includes('NO_CONFIRMED_MONTHLY_CONTENT_SCOPE'))
  const result = await submitMonthlyStrategyProposal(db, submitInput(brief), noMonthlyScope)
  assert.equal(result.error, 'STRATEGY_BLOCKED')
  assert.ok(result.blockers.includes('NO_CONFIRMED_MONTHLY_CONTENT_SCOPE'))
  assert.equal(db.calls.length, 0)
})

test('connector wiring has no approve/publish action and reuses guarded strategy RPC', () => {
  const index = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
  assert.match(index, /submit_monthly_strategy_draft: handleSubmitMonthlyStrategyDraft/)
  assert.match(index, /'submit_monthly_strategy_draft'/)
  assert.doesNotMatch(index, /transition_monthly_client_strategy/)
})

async function amendmentFixture() {
  const db = new FakeDb()
  const row = db.tables.monthly_client_strategies[0]
  row.strategy_data.goldStandard = structuredClone(goldStandard)
  for (const [key, items] of Object.entries(proposal.actionPlan)) row.strategy_data.actionPlan[key].items = [...items]
  row.strategy_data.calendarSelections = [{ eventId: 'keep', title: 'Staff selected', date: null, use: false, note: 'Preserve.' }]
  row.strategy_data.futureExtension = { keep: true }
  row.seed_context = { ...row.seed_context, client_id: CLIENT, strategy_month: MONTH, generation: { provider: 'old-provider' } }
  row.staff_amended_at = '2026-10-15T12:00:00Z'
  const brief = shapeMonthlyStrategyBrief(await loadMonthlyStrategyWorkspace(db, CLIENT, MONTH, TODAY, deps(db)))
  const input = {
    clientId: CLIENT, strategyMonth: MONTH, today: TODAY, expectedVersion: row.version,
    evidenceFingerprint: brief.evidence_fingerprint, sourceIds: ['guide-1'],
    actorProfileId: ACTOR, idempotencyKey: KEY,
    changes: [{ path: 'goldStandard.testAndChange', expected: goldStandard.testAndChange,
      replacement: 'Compare one service-led opening with a customer-question opening; keep the route producing better qualified enquiries.' }],
  }
  return { db, row, input }
}

test('explicit strategy amendment changes only the compared field through the audited staff RPC', async () => {
  const { db, row, input } = await amendmentFixture()
  const before = structuredClone(row.strategy_data)
  const result = await amendMonthlyStrategyFields(db, input, deps(db))
  assert.equal(result.state, 'draft_amended')
  assert.equal(result.published, false)
  assert.deepEqual(result.changed_fields, ['goldStandard.testAndChange'])
  before.goldStandard.testAndChange = input.changes[0].replacement
  assert.deepEqual(row.strategy_data, before)
  assert.equal(db.calls.length, 1)
  assert.equal(db.calls[0].name, 'amend_monthly_client_strategy_with_context')
  assert.equal(db.calls[0].args.p_actor_profile_id, ACTOR)
  assert.equal(db.calls[0].args.p_internal_notes, 'Keep staff note.')
  assert.deepEqual(db.calls[0].args.p_seed_context.generation, { provider: 'old-provider' })
  assert.equal(db.calls[0].args.p_seed_context.editorial_amendment.provider, 'chatgpt_company_admin_mcp')
  const replay = await amendMonthlyStrategyFields(db, input, deps(db))
  assert.equal(replay.state, 'replayed')
  assert.equal(db.calls.length, 1)
  const changedRetry = await amendMonthlyStrategyFields(db, { ...input, sourceIds: ['other'] }, deps(db))
  assert.equal(changedRetry.error, 'STRATEGY_IDEMPOTENCY_CONFLICT')
  const otherActor = await amendMonthlyStrategyFields(db, { ...input, actorProfileId: OTHER }, deps(db))
  assert.equal(otherActor.error, 'STRATEGY_IDEMPOTENCY_CONFLICT')
})

test('amendment never overrides a newer field, version, source or reviewed/publication state', async () => {
  for (const change of ['field', 'version', 'source', 'approved', 'published', 'missing', 'source-error']) {
    const { db, row, input } = await amendmentFixture()
    if (change === 'field') row.strategy_data.goldStandard.testAndChange = 'A newer staff decision.'
    if (change === 'version') row.version++
    if (change === 'source') db.tables.client_guides[0].guide_markdown += ' Changed.'
    if (change === 'approved') row.workflow_status = 'approved'
    if (change === 'published') row.published_version = row.version
    if (change === 'missing') db.tables.monthly_client_strategies = []
    if (change === 'source-error') db.errors.add('client_guides')
    const result = await amendMonthlyStrategyFields(db, input, deps(db)).catch(error => ({ error: error.message }))
    assert.ok(result.error, change)
    assert.equal(db.calls.length, 0, change)
  }
})

test('amendment rejects protected paths, duplicates, bad old text, invented citations and quality failures', async () => {
  const variants = [
    { changes: [{ path: '__proto__.polluted', expected: null, replacement: true }] },
    { changes: [{ path: 'actionPlan.reels.enabled', expected: false, replacement: true }] },
    { changes: [{ path: 'calendarSelections', expected: [], replacement: [] }] },
    { sourceIds: ['invented-source'] },
    { changes: [{ path: 'goldStandard.testAndChange', expected: 'wrong', replacement: goldStandard.testAndChange }] },
    { changes: [{ path: 'goldStandard.testAndChange', expected: goldStandard.testAndChange, replacement: 'No influencer language, forced humour, slang or hype.' }] },
    { changes: [] },
    { changes: [{ path: 'goldStandard.testAndChange', expected: goldStandard.testAndChange, replacement: 5 }] },
  ]
  for (const variant of variants) {
    const { db, input } = await amendmentFixture()
    const result = await amendMonthlyStrategyFields(db, { ...input, ...variant }, deps(db))
    assert.ok(result.error, JSON.stringify(variant))
    assert.equal(db.calls.length, 0)
  }
  const { db, input } = await amendmentFixture()
  const duplicate = await amendMonthlyStrategyFields(db, { ...input, changes: [...input.changes, ...input.changes] }, deps(db))
  assert.equal(duplicate.error, 'INVALID_STRATEGY_FIELD_CHANGES')
  assert.equal(db.calls.length, 0)
})

test('confirmed concept-array amendment preserves notes/enabled and refuses an unconfirmed format', async () => {
  const { db, row, input } = await amendmentFixture()
  row.strategy_data.actionPlan.professional_video.notes = 'Staff production note.'
  const result = await amendMonthlyStrategyFields(db, { ...input, changes: [{
    path: 'actionPlan.professional_video.items', expected: proposal.actionPlan.professional_video,
    replacement: ['Show a genuine buyer question followed by the verified service response and useful next step.'],
  }] }, deps(db))
  assert.equal(result.state, 'draft_amended')
  assert.equal(row.strategy_data.actionPlan.professional_video.notes, 'Staff production note.')
  assert.equal(row.strategy_data.actionPlan.professional_video.enabled, true)
  const fresh = await amendmentFixture()
  const refused = await amendMonthlyStrategyFields(fresh.db, { ...fresh.input, changes: [{
    path: 'actionPlan.reels.items', expected: [], replacement: ['An extra unconfirmed reel must not be introduced.'],
  }] }, deps(fresh.db))
  assert.ok(refused.error)
  assert.equal(fresh.db.calls.length, 0)
})

test('a source race immediately before amendment is refused and unchanged text does not write', async () => {
  const { db, input } = await amendmentFixture()
  let reads = 0
  const racing = { ...deps(db), prepare: async () => {
    if (++reads === 2) db.tables.client_guides[0].guide_markdown += ' A concurrent change.'
    return prepared(db)
  } }
  const raced = await amendMonthlyStrategyFields(db, input, racing)
  assert.equal(raced.error, 'STRATEGY_SOURCE_OR_VERSION_CHANGED')
  assert.equal(db.calls.length, 0)
  const fresh = await amendmentFixture()
  const unchanged = await amendMonthlyStrategyFields(fresh.db, { ...fresh.input, changes: [{
    ...fresh.input.changes[0], replacement: fresh.input.changes[0].expected,
  }] }, deps(fresh.db))
  assert.equal(unchanged.state, 'unchanged')
  assert.equal(fresh.db.calls.length, 0)
})

test('amendment handles replay/source/provenance failures and cannot report a false successful RPC', async () => {
  for (const failure of ['replay', 'provenance', 'rpc', 'receipt']) {
    const { db, row, input } = await amendmentFixture()
    if (failure === 'replay') db.errors.add('monthly_client_strategy_revisions')
    if (failure === 'provenance') row.seed_context.client_id = OTHER
    if (failure === 'rpc') db.rpc = async () => ({ data: null, error: { message: 'controlled write failure' } })
    if (failure === 'receipt') db.rpc = async () => ({ data: { version: 999, workflow_status: 'published' }, error: null })
    const result = await amendMonthlyStrategyFields(db, input, deps(db))
    assert.ok(result.error, failure)
    assert.notEqual(result.state, 'draft_amended')
    assert.equal(db.calls.length, 0)
  }
})
