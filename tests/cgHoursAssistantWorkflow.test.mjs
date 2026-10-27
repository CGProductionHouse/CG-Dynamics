import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.CG_HOURS_MCP_SOURCE_ROOT ?? 'supabase/functions/cg-dynamics-mcp/'
const source = readFileSync(`${root}index.ts`, 'utf8')
function compile(source, exports, dependencies = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const output = { exports: {} }
  return new Function('exports', ...Object.keys(dependencies), `${js}; return {...exports,${exports.join(',')}}`)(output.exports, ...Object.values(dependencies))
}
const loggerSource = readFileSync(`${root}cgHoursStaffLogger.ts`, 'utf8')
const logger = compile(loggerSource, ['durableCgHoursRecordId'])
const catalogSource = readFileSync(`${root}toolCatalog.ts`, 'utf8')
const catalog = compile(catalogSource, [])
const staff = { contextKind: 'staff', effectiveStaffProfileId: '11111111-1111-4111-8111-111111111111' }
const client = '22222222-2222-4222-8222-222222222222'
const template = '33333333-3333-4333-8333-333333333333'
const id = '44444444-4444-4444-8444-444444444444'
function handlers(overrides = {}) {
  const calls = []
  const start = source.indexOf('function cgHoursStaffLoggerConfig()')
  const end = source.indexOf('// #435:', start)
  assert.ok(start > 0 && end > start)
  const impl = compile(source.slice(start, end), ['handleLogOrdinaryHours', 'handleReadMyRecentEntries', 'handleCorrectMyEntry'], {
    ...logger,
    CG_HOURS_NOT_CONFIGURED: { ok: false, error: 'CG_HOURS_NOT_CONFIGURED' },
    Deno: { env: { get: () => 'configured' } },
    validateCgHoursStaffLoggerConfig: () => ({ endpoint: 'https://fixture.invalid', secret: 'fixture-only' }),
    invokeCgHoursStaffLogger: async (_config, subject, tool, input) => {
      calls.push({ subject, tool, input })
      if (overrides[tool]) return overrides[tool](input)
      if (tool === 'list_my_logging_options') return { ok: true, data: { clients: [{ client_id: client }], tasks: [{ task_template_id: template }] } }
      if (tool === 'get_my_hours_today') return { ok: true, data: { entries: [{ id, duration_minutes: 45 }], total_minutes: 45, editable: true } }
      if (tool === 'get_my_travel_today') return { ok: true, data: { entries: [], total_km: 0 } }
      return { ok: true, message: 'Saved.', data: { entry_id: id } }
    },
  })
  return { ...impl, calls }
}
const input = hours => ({ client_id: client, date: '2026-10-27', hours, task_description: 'Confirmed editing work', task_template_id: template, idempotency_key: 'same-utterance-key' })

test('whole-minute speech durations survive decimal-hour conversion for creation and correction', async () => {
  for (const [hours, expected] of [[4.1, 246], [4.15, 249], [8.3, 498], [2.05, 123], [5 / 60, 5], [1 / 60, 1], [24, 1440]]) {
    const h = handlers()
    assert.equal((await h.handleLogOrdinaryHours(staff, input(hours))).ok, true, `create ${hours}`)
    assert.equal(h.calls.find(x => x.tool === 'add_my_time_entry').input.minutes, expected)
    assert.equal((await h.handleCorrectMyEntry(staff, { entry_id: id, entry_type: 'time', correction: { hours }, idempotency_key: 'correction' })).ok, true)
    assert.equal(h.calls.at(-1).input.minutes, expected)
  }
})

test('all 1440 exact minute durations round trip without rejecting floating point noise', () => {
  for (let minute = 1; minute <= 1440; minute++) assert.equal(logger.cgHoursDurationMinutes(minute / 60), minute)
  for (const invalid of [null, undefined, '', '4.1', true, NaN, Infinity, -1, 0, 0.001, 1.001, 24.0000001, 25]) {
    assert.equal(logger.cgHoursDurationMinutes(invalid), null, String(invalid))
  }
})

test('catalogue allows small confirmed tasks consistently for both create and correction', () => {
  const tools = catalog.CG_DYNAMICS_MCP_TOOLS
  assert.equal(tools.find(t => t.name === 'log_ordinary_hours').inputSchema.properties.hours.minimum, 1 / 60)
  assert.equal(tools.find(t => t.name === 'correct_my_entry').inputSchema.properties.correction.properties.hours.minimum, 1 / 60)
})

test('one narration uses exact staff and canonical Hours IDs and returns only a durable draft receipt', async () => {
  const h = handlers()
  const result = await h.handleLogOrdinaryHours(staff, { ...input(0.5), notes: 'First cut' })
  assert.deepEqual(h.calls.at(-1), { subject: staff.effectiveStaffProfileId, tool: 'add_my_time_entry', input: {
    date: '2026-10-27', client_id: client, task_template_id: template, minutes: 30,
    notes: 'Confirmed editing work\nFirst cut', idempotency_key: 'same-utterance-key',
  } })
  assert.equal(result.draft, true)
  assert.equal(result.receipt.record_id, id)
  assert.match(result.message, /review and submit the week manually/)
})

test('company context, unavailable clients and unavailable tasks never reach a write', async () => {
  for (const [actor, change] of [[{ contextKind: 'company_admin' }, {}], [staff, { client_id: id }], [staff, { task_template_id: id }]]) {
    const h = handlers()
    assert.equal((await h.handleLogOrdinaryHours(actor, { ...input(1), ...change })).ok, false)
    assert.ok(!h.calls.some(x => x.tool === 'add_my_time_entry'))
  }
})

test('unconfirmed/invalid durations and empty corrections do not invoke the backend', async () => {
  const h = handlers()
  for (const hours of [NaN, 0, -1, 24.1, 1.001, '1']) assert.equal((await h.handleLogOrdinaryHours(staff, input(hours))).ok, false)
  assert.equal((await h.handleCorrectMyEntry(staff, { entry_id: id, entry_type: 'time', correction: {}, idempotency_key: 'empty' })).ok, false)
  assert.equal(h.calls.length, 0)
})

test('day reconciliation preserves existing rows and refuses partial reads instead of suggesting an empty day', async () => {
  const h = handlers()
  const result = await h.handleReadMyRecentEntries(staff, { from_date: '2026-10-27', to_date: '2026-10-27', include_vehicle: true })
  assert.equal(result.time_entries[0].id, id)
  assert.equal(result.summary.total_minutes, 45)
  assert.equal(result.summary.total_km, 0)
  const failed = handlers({ get_my_travel_today: () => ({ ok: false, error: 'CG_HOURS_REFUSED' }) })
  assert.equal((await failed.handleReadMyRecentEntries(staff, { from_date: '2026-10-27', to_date: '2026-10-27', include_vehicle: true })).ok, false)
  assert.ok(!failed.calls.some(x => x.tool === 'list_my_logging_options'))
})

test('backend rejection or success without record id never claims a save', async () => {
  for (const response of [{ ok: false, error: 'CG_HOURS_REFUSED' }, { ok: true, message: 'Done', data: {} }]) {
    const h = handlers({ add_my_time_entry: () => response, edit_my_time_entry: () => response })
    const result = await h.handleLogOrdinaryHours(staff, input(1))
    assert.equal(result.ok, false)
    assert.equal(result.logged, undefined)
    assert.equal((await h.handleCorrectMyEntry(staff, { entry_id: id, entry_type: 'time', correction: { hours: 1 }, idempotency_key: 'correct' })).ok, false)
  }
})

test('staff bootstrap always delivers daily logging rules even before assistant profile setup', () => {
  const policy = logger.buildCgHoursLoggingPolicy('staff')
  assert.equal(policy.source_of_truth, 'CG Hours')
  assert.match(JSON.stringify(policy), /read_my_recent_entries/)
  assert.match(JSON.stringify(policy), /never invent/i)
  assert.match(JSON.stringify(policy), /already.logged|already logged/i)
  assert.match(JSON.stringify(policy), /same idempotency key/i)
  assert.match(JSON.stringify(policy), /correct_my_entry/)
  assert.match(JSON.stringify(policy), /submit.*manually/i)
  assert.equal(logger.buildCgHoursLoggingPolicy('client'), null)
  assert.equal(logger.buildCgHoursLoggingPolicy('company_admin'), null)
  const start = source.indexOf('const handleGetMyAssistantBootstrap:')
  const end = source.indexOf('\nconst handle', start + 1)
  const bootstrap = source.slice(start, end)
  assert.equal((bootstrap.match(/cg_hours_logging_policy: cgHoursLoggingPolicy/g) ?? []).length, 3, 'all bootstrap return branches carry the policy')
})

test('actual bootstrap returns the hours policy on normal, missing-workspace and failed-profile reads', async () => {
  const start = source.indexOf('const handleGetMyAssistantBootstrap:')
  const end = source.indexOf('\nconst handle', start + 1)
  const existingPolicy = { policy_version: 'existing-coexistence-policy' }
  for (const contextKind of ['staff', 'company_admin']) {
    for (const state of ['normal', 'missing-workspace', 'failed-profile']) {
      const { handleGetMyAssistantBootstrap } = compile(source.slice(start, end), ['handleGetMyAssistantBootstrap'], {
        ...logger,
        buildStaffAssistantPolicy: () => existingPolicy,
        buildDailyUpdateContract: () => ({ preserved: true }),
        STAFF_ASSISTANT_POLICY_VERSION: 'existing-coexistence-policy',
        ASSISTANT_PRESENTATION_VERSION: 'preserved',
        STAFF_ASSISTANT_POLICY_EFFECTIVE_AT: '2026-10-19T00:00:00Z',
        tableExists: async () => state !== 'missing-workspace',
        filterCapabilitiesByScope: () => [],
        CG_DYNAMICS_MCP_TOOLS: catalog.CG_DYNAMICS_MCP_TOOLS,
      })
      const query = {
        select() { return this }, eq() { return this },
        async maybeSingle() { return { data: null, error: state === 'failed-profile' ? { message: 'fixture failure' } : null } },
      }
      const result = await handleGetMyAssistantBootstrap({ ...staff, contextKind, fullName: 'Test staff', supabase: { from: () => query } })
      assert.equal(result.staff_assistant_policy, existingPolicy)
      assert.equal(result.daily_update_contract.preserved, true)
      assert.equal(result.cg_hours_logging_policy?.source_of_truth ?? null, contextKind === 'staff' ? 'CG Hours' : null)
    }
  }
})
