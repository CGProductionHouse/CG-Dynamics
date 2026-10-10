import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { emptyStrategyData } from '../src/lib/strategyEngine.ts'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
const { runNextMonthStrategyGeneration, runCurrentMonthStrategyContextRevision } = await server.ssrLoadModule('/supabase/functions/_shared/monthlyStrategyGeneration.ts')
const { monthlyStrategySourceDigest } = await server.ssrLoadModule('/supabase/functions/_shared/monthlyStrategyModel.ts')
after(() => server.close())

const clientId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const month = '2026-11-01'
const today = '2026-10-09'
const settings = {
  professional_videos_per_month: 1, reels_per_month: 0, photo_posts_per_month: 0,
  design_posters_per_month: 1, animated_posters_per_month: 0,
  campaign_management_included: false, monthly_campaign_budget: 0,
  shoot_days_per_month: 0, website_updates_per_month: 0,
  other_agreed_deliverables: '', package_notes: '', package_exclusions: '',
  verification: { status: 'confirmed', version: 1, confirmed_at: '2026-09-20T08:00:00Z', confirmed_by_profile_id: actorId, evidence_note: 'Signed package', inference_note: '', source_references: ['signed-package'] },
}
const gold = Object.fromEntries([
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale', 'testAndChange',
  'pillarsAndHooks', 'mustAvoid', 'channelIntegration', 'successSignals', 'nextMonthGamePlan',
].map(key => [key, `Evidence-bounded proposed ${key} for an exact local buyer question and test.`]))
const proposal = { clientId, strategyMonth: month, sourceIds: ['guide-1'], goldStandard: gold,
  actionPlan: { professional_video: ['Film one exact service demonstration with a buyer question.'], design_poster: ['Design one question-to-enquiry poster for the verified service.'] } }

class Query {
  constructor(fake, table) { this.fake = fake; this.table = table; this.filters = []; this.sort = null; this.max = null }
  select(columns) {
    if (this.table === 'monthly_client_strategies' && this.fake.requireStrategyAmendmentField &&
        columns.includes('workflow_status') && columns.includes('seed_context')) {
      assert.match(columns, /(?:^|,)staff_amended_at(?:,|$)/)
    }
    return this
  }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  neq(key, value) { this.filters.push(row => row[key] !== value); return this }
  not(key, operator, value) { assert.equal(operator, 'is'); this.filters.push(row => value === null ? row[key] != null : row[key] !== value); return this }
  is(key, value) { this.filters.push(row => row[key] === value); return this }
  lt(key, value) { this.filters.push(row => String(row[key]) < String(value)); return this }
  gte(key, value) { this.filters.push(row => String(row[key]) >= String(value)); return this }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
  or() { return this }
  order(key, options) { this.sort = [key, options.ascending]; return this }
  limit(value) { this.max = value; return this }
  maybeSingle() { return Promise.resolve({ data: this.result().data[0] ?? null, error: null }) }
  result() {
    let data = [...(this.fake.tables[this.table] ?? [])].filter(row => this.filters.every(filter => filter(row)))
    if (this.sort) data.sort((a, b) => String(a[this.sort[0]]).localeCompare(String(b[this.sort[0]])) * (this.sort[1] ? 1 : -1))
    if (this.max != null) data = data.slice(0, this.max)
    return { data, error: null }
  }
  then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject) }
}

function fixture() {
  const data = emptyStrategyData()
  data.actionPlan.professional_video.enabled = true
  data.actionPlan.design_poster.enabled = true
  const row = { id: 'strategy-1', client_id: clientId, strategy_month: month, workflow_status: 'draft',
    published_version: null, version: 1, strategy_data: data, seed_context: { client_id: clientId, strategy_month: month }, internal_notes: 'Staff note stays.' }
  const fake = {
    tables: {
      clients: [{ id: clientId, name: 'Exact Client', active: true, package_settings: structuredClone(settings) }],
      monthly_client_strategies: [row], monthly_deliverables: [], company_calendar_events: [],
      reports: [], posts: [], client_context_updates: [],
      client_guides: [{ id: 'guide-1', client_id: clientId, runtime_readiness: 'ready', version: 1,
        guide_markdown: '## Client identity and positioning\n- Serves exact local buyers with a verified service.' }],
      client_packages: [], client_industry_profiles: [], skill_cards: [],
    },
    writes: [],
    from(table) { return new Query(this, table) },
    async rpc(name, args) {
      assert.equal(name, 'propose_monthly_client_strategy_generation')
      this.writes.push(args)
      if (this.conflict) return { data: null, error: { message: 'Strategy version conflict' } }
      assert.equal(args.p_client_id, clientId)
      assert.equal(args.p_strategy_month, row.strategy_month)
      assert.equal(args.p_expected_version, row.version)
      assert.equal(row.workflow_status, 'draft')
      row.strategy_data = args.p_strategy_data
      row.seed_context = args.p_seed_context
      row.version += 1
      return { data: { version: row.version }, error: null }
    },
  }
  return { fake, row }
}

const input = { clientId, strategyMonth: month, today, systemProfileId: actorId }
function generated(sourceDigest = 'digest-a') { return { proposal, sourceDigest, provider: 'fixture' } }

test('fills an exact next-month draft, preserves staff fields and keeps it unpublished', async () => {
  const { fake, row } = fixture()
  row.strategy_data.goldStandard.objective = 'Staff-owned commercial objective remains unchanged.'
  const result = await runNextMonthStrategyGeneration(fake, input, {
    sourceDigest: async () => 'digest-a', generateProposal: async () => generated(),
  })
  assert.equal(result.state, 'review_conflicts')
  assert.equal(row.strategy_data.goldStandard.objective, 'Staff-owned commercial objective remains unchanged.')
  assert.equal(row.strategy_data.goldStandard.audienceAndIntent, gold.audienceAndIntent)
  assert.equal(row.strategy_data.actionPlan.professional_video.items.length, 1)
  assert.equal(row.workflow_status, 'draft')
  assert.equal(row.published_version, null)
  assert.equal(row.internal_notes, 'Staff note stays.')
  assert.equal(fake.writes.length, 1)
  assert.deepEqual(Object.keys(fake.tables.monthly_deliverables), [])
})

test('production-shaped untouched package placeholders are replaced once, without publishing or changing scope', async () => {
  const { fake, row } = fixture()
  fake.requireStrategyAmendmentField = true
  const note = 'Scope comes from the explicitly confirmed client package; Client Schedule remains execution evidence.'
  row.seed_context.origin = 'monthly_strategy_autopilot'
  row.staff_amended_at = null
  row.strategy_data.actionPlan.professional_video.items = ['Prepare 1 professional video from the confirmed package.']
  row.strategy_data.actionPlan.professional_video.notes = note
  row.strategy_data.actionPlan.design_poster.items = ['Prepare 1 design poster from the confirmed package.']
  row.strategy_data.actionPlan.design_poster.notes = note
  const deps = { sourceDigest: async () => 'digest-a', generateProposal: async () => generated() }

  const first = await runNextMonthStrategyGeneration(fake, input, deps)
  assert.equal(first.state, 'draft_filled')
  assert.deepEqual(row.strategy_data.actionPlan.professional_video.items, proposal.actionPlan.professional_video)
  assert.deepEqual(row.strategy_data.actionPlan.design_poster.items, proposal.actionPlan.design_poster)
  assert.equal(row.strategy_data.actionPlan.professional_video.notes, '')
  assert.equal(row.strategy_data.actionPlan.design_poster.notes, '')
  assert.equal(row.workflow_status, 'draft')
  assert.equal(row.published_version, null)
  assert.equal(row.staff_amended_at, null)
  assert.equal(fake.writes.length, 1)
  assert.equal((await runNextMonthStrategyGeneration(fake, input, deps)).state, 'unchanged')
  assert.equal(fake.writes.length, 1)
})

test('unchanged evidence does not call the model again; an incorporated meeting note reopens the draft', async () => {
  const { fake, row } = fixture()
  let calls = 0
  const deps = { sourceDigest: async ({ evidence }) => evidence.some(item => item.source_id === 'meeting-1') ? 'digest-b' : 'digest-a',
    generateProposal: async ({ evidence }) => {
      calls++
      if (!evidence.some(item => item.source_id === 'meeting-1')) return generated()
      return { ...generated('digest-b'), proposal: { ...proposal,
        goldStandard: { ...gold, objective: 'Meeting decision changes the test to a more useful local service demonstration.' },
      } }
    } }
  assert.equal((await runNextMonthStrategyGeneration(fake, input, deps)).state, 'draft_filled')
  assert.equal((await runNextMonthStrategyGeneration(fake, input, deps)).state, 'unchanged')
  assert.equal(calls, 1)
  fake.tables.client_context_updates.push({ id: 'meeting-1', client_id: clientId, review_state: 'incorporated', title: 'Meeting decision', body: 'Test a more useful service demonstration for local buyers.' })
  const next = await runNextMonthStrategyGeneration(fake, input, deps)
  assert.equal(next.state, 'draft_filled')
  assert.equal(calls, 2)
  assert.equal(row.seed_context.generation.sourceDigest, 'digest-b')
  assert.match(row.strategy_data.goldStandard.objective, /Meeting decision/)
})

test('current-month revision needs a newly incorporated exact-client note and preserves staff work', async () => {
  const { fake, row } = fixture()
  row.strategy_month = '2026-10-01'
  row.seed_context = { origin: 'monthly_strategy_autopilot', sources: { approved_client_context_update_ids: ['old-note'] } }
  row.strategy_data.goldStandard.objective = 'Staff-owned objective.'
  fake.tables.client_context_updates.push({ id: 'old-note', client_id: clientId, review_state: 'incorporated', title: 'Old', body: 'Old decision' })
  const currentInput = { ...input, strategyMonth: row.strategy_month }
  const nextProposal = { ...proposal, strategyMonth: row.strategy_month, sourceIds: ['guide-1', 'new-note'] }
  const deps = { sourceDigest: async () => 'digest-current', generateProposal: async request => {
    assert.equal(request.generationPurpose, 'current_context')
    return { proposal: nextProposal, sourceDigest: 'digest-current', provider: 'fixture' }
  } }
  assert.equal((await runCurrentMonthStrategyContextRevision(fake, currentInput, deps)).blocker, 'NO_NEW_INCORPORATED_CONTEXT')
  assert.equal(fake.writes.length, 0)
  fake.tables.client_context_updates.push({ id: 'new-note', client_id: clientId, review_state: 'incorporated', title: 'Confirmed meeting decision', body: 'Test a local buyer question.' })
  const result = await runCurrentMonthStrategyContextRevision(fake, currentInput, deps)
  assert.equal(result.state, 'review_conflicts')
  assert.equal(row.strategy_data.goldStandard.objective, 'Staff-owned objective.')
  assert.equal(row.seed_context.sources.approved_client_context_update_ids.includes('new-note'), true)
  assert.deepEqual(row.seed_context.generation.incorporatedContextIds, ['new-note'])
  assert.equal(row.workflow_status, 'draft')
  assert.equal(row.published_version, null)
  assert.equal((await runCurrentMonthStrategyContextRevision(fake, currentInput, deps)).blocker, 'NO_NEW_INCORPORATED_CONTEXT')
  assert.equal(fake.writes.length, 1)
})

test('current-month proposal that ignores the new meeting decision cannot amend the draft', async () => {
  const { fake, row } = fixture()
  row.strategy_month = '2026-10-01'
  row.seed_context = { origin: 'monthly_strategy_autopilot', sources: { approved_client_context_update_ids: [] } }
  fake.tables.client_context_updates.push({ id: 'new-note', client_id: clientId, review_state: 'incorporated', title: 'Decision', body: 'Test the exact local buyer question.' })
  const before = structuredClone(row)
  const result = await runCurrentMonthStrategyContextRevision(fake, { ...input, strategyMonth: row.strategy_month }, {
    sourceDigest: async () => 'digest-current',
    generateProposal: async () => ({ ...generated('digest-current'), proposal: { ...proposal, strategyMonth: row.strategy_month } }),
  })
  assert.equal(result.blocker, 'NEW_CONTEXT_NOT_CITED')
  assert.deepEqual(row, before)
  assert.equal(fake.writes.length, 0)
})

test('current-month note revision refuses an unreviewed note or a published version', async () => {
  const { fake, row } = fixture()
  row.strategy_month = '2026-10-01'
  row.seed_context = { origin: 'monthly_strategy_autopilot', sources: { approved_client_context_update_ids: [] } }
  const currentInput = { ...input, strategyMonth: row.strategy_month }
  fake.tables.client_context_updates.push({ id: 'pending-note', client_id: clientId, review_state: 'pending', title: 'Unreviewed', body: 'Do not use.' })
  assert.equal((await runCurrentMonthStrategyContextRevision(fake, currentInput)).blocker, 'NO_NEW_INCORPORATED_CONTEXT')
  row.published_version = 1
  assert.equal((await runCurrentMonthStrategyContextRevision(fake, currentInput)).blocker, 'REVIEWED_OR_PUBLISHED_STRATEGY')
  assert.equal(fake.writes.length, 0)
})

test('reviewed, published, cross-client and wrong-month targets fail closed before model work', async () => {
  const { fake, row } = fixture()
  let calls = 0
  const deps = { sourceDigest: async () => 'digest-a', generateProposal: async () => { calls++; return generated() } }
  row.workflow_status = 'approved'
  assert.equal((await runNextMonthStrategyGeneration(fake, input, deps)).blocker, 'REVIEWED_OR_PUBLISHED_STRATEGY')
  row.workflow_status = 'draft'; row.published_version = 1
  assert.equal((await runNextMonthStrategyGeneration(fake, input, deps)).blocker, 'REVIEWED_OR_PUBLISHED_STRATEGY')
  row.published_version = null
  assert.equal((await runNextMonthStrategyGeneration(fake, { ...input, clientId: 'other' }, deps)).blocker, 'EXACT_CLIENT_STRATEGY_UNAVAILABLE')
  assert.equal((await runNextMonthStrategyGeneration(fake, { ...input, strategyMonth: '2026-10-01' }, deps)).blocker, 'NOT_NEXT_MONTH')
  assert.equal(calls, 0)
  assert.equal(fake.writes.length, 0)
})

test('mid-generation staff edit returns conflict instead of overwriting', async () => {
  const { fake, row } = fixture()
  fake.conflict = true
  const before = structuredClone(row)
  const result = await runNextMonthStrategyGeneration(fake, input, { sourceDigest: async () => 'digest-a', generateProposal: async () => generated() })
  assert.equal(result.blocker, 'MID_GENERATION_STAFF_EDIT')
  assert.deepEqual(row, before)
})

test('incorporated evidence arriving during model work fences the stale proposal before any write', async () => {
  const { fake, row } = fixture()
  const before = structuredClone(row)
  const result = await runNextMonthStrategyGeneration(fake, input, {
    sourceDigest: async ({ evidence }) => evidence.some(item => item.source_id === 'meeting-1') ? 'digest-b' : 'digest-a',
    generateProposal: async () => {
      fake.tables.client_context_updates.push({ id: 'meeting-1', client_id: clientId, review_state: 'incorporated',
        title: 'New decision', body: 'Test the exact local service question.', created_at: '2026-10-09T10:00:00Z' })
      return generated()
    },
  })
  assert.equal(result.state, 'conflict')
  assert.equal(result.blocker, 'SOURCE_CHANGED_DURING_GENERATION')
  assert.deepEqual(row, before)
  assert.equal(fake.writes.length, 0)
})

test('a package correction during model work fences the old deliverable scope', async () => {
  const { fake, row } = fixture()
  const before = structuredClone(row)
  const result = await runNextMonthStrategyGeneration(fake, input, {
    sourceDigest: async () => 'digest-a',
    generateProposal: async () => {
      fake.tables.clients[0].package_settings.photo_posts_per_month = 3
      return generated()
    },
  })
  assert.equal(result.blocker, 'SOURCE_CHANGED_DURING_GENERATION')
  assert.deepEqual(row, before)
  assert.equal(fake.writes.length, 0)
})

test('a positive quantity correction fences the proposal even when enabled formats stay the same', async () => {
  const { fake, row } = fixture()
  const before = structuredClone(row)
  const result = await runNextMonthStrategyGeneration(fake, input, {
    generateProposal: async request => {
      const sourceDigest = await monthlyStrategySourceDigest(request)
      fake.tables.clients[0].package_settings.design_posters_per_month = 2
      return generated(sourceDigest)
    },
  })
  assert.equal(result.blocker, 'SOURCE_CHANGED_DURING_GENERATION')
  assert.deepEqual(row, before)
  assert.equal(fake.writes.length, 0)
})

test('unverified package or missing substantive exact-client evidence never invokes model', async () => {
  const { fake } = fixture()
  fake.tables.clients[0].package_settings.verification.status = 'unverified'
  assert.equal((await runNextMonthStrategyGeneration(fake, input, { sourceDigest: async () => 'digest-a', generateProposal: async () => generated() })).state, 'blocked')
  assert.equal(fake.writes.length, 0)
})

test('changed package scope and provider failure leave the canonical draft untouched', async () => {
  const { fake, row } = fixture()
  row.strategy_data.actionPlan.reels.enabled = true
  const before = structuredClone(row)
  assert.equal((await runNextMonthStrategyGeneration(fake, input, {
    sourceDigest: async () => 'digest-a', generateProposal: async () => generated(),
  })).blocker, 'PACKAGE_STRATEGY_SCOPE_DRIFT')
  assert.deepEqual(row, before)
  row.strategy_data.actionPlan.reels.enabled = false
  const reset = structuredClone(row)
  await assert.rejects(() => runNextMonthStrategyGeneration(fake, input, {
    sourceDigest: async () => 'digest-a', generateProposal: async () => { throw new Error('provider unavailable') },
  }), /provider unavailable/)
  assert.deepEqual(row, reset)
  assert.equal(fake.writes.length, 0)
})
