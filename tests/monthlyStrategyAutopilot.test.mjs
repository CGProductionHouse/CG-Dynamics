import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const autopilot = await import('../supabase/functions/_shared/monthlyStrategyAutopilot.ts')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

class Query {
  constructor(fake, table) { this.fake = fake; this.table = table; this.filters = []; this.max = null; this.slice = null; this.sort = null }
  select() { return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  neq(key, value) { this.filters.push(row => row[key] !== value); return this }
  is(key, value) { this.filters.push(row => row[key] === value); return this }
  lt(key, value) { this.filters.push(row => String(row[key]) < String(value)); return this }
  gte(key, value) { this.filters.push(row => String(row[key]) >= String(value)); return this }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
  or() { return this }
  order(key, options) { this.sort = [key, options.ascending]; return this }
  limit(value) { this.max = value; return this }
  range(from, to) { this.slice = [from, to + 1]; return Promise.resolve(this.result()) }
  maybeSingle() { const result = this.result(); return Promise.resolve({ data: result.data[0] ?? null, error: null }) }
  result() {
    let data = [...(this.fake.tables[this.table] ?? [])].filter(row => this.filters.every(filter => filter(row)))
    if (this.sort) data.sort((a, b) => String(a[this.sort[0]]).localeCompare(String(b[this.sort[0]])) * (this.sort[1] ? 1 : -1))
    if (this.max != null) data = data.slice(0, this.max)
    if (this.slice) data = data.slice(...this.slice)
    return { data, error: null }
  }
  then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject) }
}

class FakeSupabase {
  constructor(tables) { this.tables = tables; this.calls = [] }
  from(table) { return new Query(this, table) }
  async rpc(name, args) {
    assert.equal(name, 'seed_monthly_client_strategy')
    this.calls.push(args)
    const existing = this.tables.monthly_client_strategies.find(row => row.client_id === args.p_client_id && row.strategy_month === args.p_strategy_month)
    if (existing) return { data: { created: false, replayed: true, strategy_id: existing.id }, error: null }
    const row = { id: `strategy-${this.calls.length}`, client_id: args.p_client_id, strategy_month: args.p_strategy_month, workflow_status: 'draft', version: 1, strategy_data: args.p_strategy_data, seed_context: args.p_seed_context }
    this.tables.monthly_client_strategies.push(row)
    return { data: { created: true, replayed: false, strategy_id: row.id, client_id: row.client_id, strategy_month: row.strategy_month, workflow_status: 'draft', version: 1 }, error: null }
  }
}

function fixture(existing = []) {
  return new FakeSupabase({
    clients: [{ id: 'client-a', name: 'Client A', active: true }],
    monthly_client_strategies: existing,
    monthly_deliverables: [{ id: 'd-1', client_id: 'client-a', month: '2026-09-01', archived_at: null, deliverable_type: 'reel', title: 'Reel' }],
    company_calendar_events: [], reports: [], client_context_updates: [], client_guides: [],
    client_packages: [{ id: 'package-a', client_id: 'client-a', status: 'active', start_date: '2026-01-01', end_date: null }],
    client_industry_profiles: [], skill_cards: [],
  })
}

test('targets the Johannesburg operating month and next month', () => {
  assert.deepEqual(autopilot.strategyAutopilotMonths('2026-12-15'), ['2026-12-01', '2027-01-01'])
})

test('creates current and next draft through #391 and records truthful package gaps', async () => {
  const fake = fixture()
  const result = await autopilot.runMonthlyStrategyAutopilot(fake, { today: '2026-09-22', systemProfileId: 'system-profile' })
  assert.equal(result.drafts_created, 2)
  assert.equal(result.existing_untouched, 0)
  assert.equal(fake.calls.length, 2)
  assert.ok(fake.calls.every(call => call.p_strategy_data.version === 1))
  assert.ok(fake.calls.every(call => call.p_seed_context.origin === 'monthly_strategy_autopilot'))
  assert.equal(result.blockers.PACKAGE_UNVERIFIED, 1, 'next month has no confirmed deliverables')
})

test('an existing or staff-amended client/month strategy is never sent to the seed RPC', async () => {
  const fake = fixture([{ id: 'human-draft', client_id: 'client-a', strategy_month: '2026-09-01', workflow_status: 'draft', version: 4, staff_amended_at: '2026-09-20T10:00:00Z' }])
  const result = await autopilot.runMonthlyStrategyAutopilot(fake, { today: '2026-09-22', systemProfileId: 'system-profile' })
  assert.equal(result.existing_untouched, 1)
  assert.equal(result.drafts_created, 1)
  assert.equal(fake.calls.length, 1)
  assert.equal(fake.calls[0].p_strategy_month, '2026-10-01')
})

test('handler is worker-only and shared worker/sync ownership remains untouched', () => {
  const handler = read('../supabase/functions/monthly-strategy-autopilot/index.ts')
  const guideline = read('../supabase/functions/suggest-content-videos/index.ts')
  assert.match(handler, /workerToken\.length < 32 \|\| suppliedToken !== workerToken/)
  assert.match(handler, /WORKER_SYSTEM_PROFILE_ID/)
  assert.match(handler, /runMonthlyStrategyAutopilot/)
  assert.doesNotMatch(handler, /approved|published|transition_monthly_client_strategy/)
  assert.match(guideline, /from\('monthly_client_strategies'\)/)
  assert.match(guideline, /eq\('client_id', clientId\)/)
  assert.match(guideline, /Canonical monthly strategy/)
})

test('active-client scan is genuinely paginated and seed remains the only write contract', () => {
  const source = read('../supabase/functions/_shared/monthlyStrategyAutopilot.ts')
  assert.match(source, /\.range\(from, from \+ STRATEGY_AUTOPILOT_PAGE_SIZE - 1\)/)
  assert.match(source, /rpc\('seed_monthly_client_strategy'/)
  assert.doesNotMatch(source, /\.from\('monthly_client_strategies'\)\.insert|\.update\(/)
})
