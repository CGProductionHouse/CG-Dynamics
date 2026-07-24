import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let buildMicrosoftApplyRpcArgs
let microsoftApplyPreflightError
let microsoftRunFinalStatus

const snapshot = {
  format: 'cg-dynamics-microsoft-snapshot',
  version: 3,
  exportedAt: '2026-07-22T09:00:00Z',
  exportedBy: 'test',
  triggerType: 'admin',
  plannerCompletedCutoff: null,
  sources: [],
  records: [],
  assigneeMap: {},
}

function plannerPayload(overrides = {}) {
  return {
    destination: 'planner',
    board_id: '11111111-1111-4111-8111-111111111111',
    bucket_id: '22222222-2222-4222-8222-222222222222',
    title: 'Planner task',
    client_id: null,
    client_name: null,
    status: 'to_do',
    priority: 'normal',
    start_date: null,
    due_date: '2026-07-23',
    notes: null,
    source: 'microsoft_import',
    original_plan_name: 'To Do',
    original_bucket_name: 'ADMIN / TO DO',
    microsoft_source_type: 'planner_task',
    microsoft_plan_id: 'plan-1',
    microsoft_bucket_id: 'bucket-1',
    microsoft_task_id: 'task-1',
    microsoft_source_description: null,
    assigned_to_name: 'Alice Smith',
    helper_names: ['Bob Jones'],
    ...overrides,
  }
}

function schedulePayload(overrides = {}) {
  return {
    destination: 'client_schedule',
    client_id: '33333333-3333-4333-8333-333333333333',
    package_id: '44444444-4444-4444-8444-444444444444',
    template_id: '55555555-5555-4555-8555-555555555555',
    board_id: null,
    bucket_id: null,
    month: '2026-07-01',
    code: 'DP1',
    instance_number: 1,
    title: 'DP1 Launch',
    deliverable_type: 'dp',
    production_status: 'to_do',
    priority: 'normal',
    scheduled_date: '2026-07-24',
    notes: null,
    microsoft_source_type: 'planner_client_social',
    microsoft_plan_id: 'plan-social',
    microsoft_bucket_id: 'bucket-client',
    microsoft_task_id: 'task-social',
    microsoft_source_description: null,
    assigned_to_user_id: '66666666-6666-4666-8666-666666666666',
    assigned_to_name: 'Alice Smith',
    helper_names: ['Bob Jones'],
    ...overrides,
  }
}

function previewItem(payload, overrides = {}) {
  const planner = payload?.destination !== 'client_schedule'
  return {
    sourceType: planner ? 'planner_task' : 'planner_client_social',
    sourcePlanId: planner ? 'plan-1' : 'plan-social',
    sourceCalendarId: null,
    sourceBucketId: planner ? 'bucket-1' : 'bucket-client',
    sourceTaskId: planner ? 'task-1' : 'task-social',
    sourceEventId: null,
    sourceName: planner ? 'To Do' : 'Client Socials - July 2026',
    title: payload?.title ?? 'Blocked item',
    description: null,
    startDate: null,
    endDate: null,
    dueDate: null,
    assigneeMicrosoftIds: [],
    destination: payload?.destination ?? 'review',
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: null,
    previewStatus: 'new',
    conflictCode: null,
    conflictReason: null,
    warnings: [],
    proposedPayload: payload,
    reconciliationAction: 'create',
    sourceHash: 'fnv1a-test',
    sourceComplete: true,
    ...overrides,
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ buildMicrosoftApplyRpcArgs, microsoftApplyPreflightError, microsoftRunFinalStatus } = await server.ssrLoadModule('/src/lib/microsoftApply.ts'))
})

after(async () => { await server.close() })

test('new create sends explicit null expected timestamp and destination ID', () => {
  const args = buildMicrosoftApplyRpcArgs(previewItem(plannerPayload()), snapshot, 'run-1', 'item-1', false)
  assert.equal(args.p_expected_updated_at, null)
  assert.equal(args.p_destination_id, null)
})

test('conflict and skipped items without targets send null rather than omitting expected timestamp', () => {
  for (const action of ['conflict', 'skipped']) {
    const item = previewItem(null, { reconciliationAction: action, previewStatus: action === 'conflict' ? 'conflict' : 'skipped' })
    const args = buildMicrosoftApplyRpcArgs(item, snapshot, 'run-1', `item-${action}`, false)
    assert.equal(args.p_expected_updated_at, null)
    assert.equal(args.p_should_apply, false)
  }
})

test('existing update sends its real expected updated_at timestamp', () => {
  const expected = '2026-07-22T08:30:00Z'
  const item = previewItem(plannerPayload(), { reconciliationAction: 'update', existingTargetId: '77777777-7777-4777-8777-777777777777', expectedTargetUpdatedAt: expected })
  const args = buildMicrosoftApplyRpcArgs(item, snapshot, 'run-1', 'item-update', false)
  assert.equal(args.p_expected_updated_at, expected)
  assert.equal(args.p_destination_id, item.existingTargetId)
})

test('every required RPC property is present and no top-level value is undefined', () => {
  const args = buildMicrosoftApplyRpcArgs(previewItem(plannerPayload()), snapshot, 'run-1', 'item-1', false)
  const required = [
    'p_run_id', 'p_item_key', 'p_destination', 'p_destination_id', 'p_expected_updated_at',
    'p_action', 'p_should_apply', 'p_patch', 'p_source_type', 'p_source_container_id',
    'p_source_item_id', 'p_source_name', 'p_source_complete', 'p_details',
  ]
  assert.deepEqual(Object.keys(args), required)
  assert.ok(Object.values(args).every(value => value !== undefined))
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(args))), required)
})

test('Planner create and update patches include owner and helpers', () => {
  const createArgs = buildMicrosoftApplyRpcArgs(previewItem(plannerPayload()), snapshot, 'run-1', 'create', false)
  assert.equal(createArgs.p_patch.assigned_to_name, 'Alice Smith')
  assert.deepEqual(createArgs.p_patch.helper_names, ['Bob Jones'])

  const updateItem = previewItem(plannerPayload({ assigned_to_name: 'Carol King', helper_names: [] }), {
    reconciliationAction: 'update', existingTargetId: '77777777-7777-4777-8777-777777777777', expectedTargetUpdatedAt: '2026-07-22T08:30:00Z',
  })
  const updateArgs = buildMicrosoftApplyRpcArgs(updateItem, snapshot, 'run-1', 'update', false)
  assert.equal(updateArgs.p_patch.assigned_to_name, 'Carol King')
  assert.deepEqual(updateArgs.p_patch.helper_names, [])
})

test('Client Schedule create and update patches include user ID, owner name and helpers', () => {
  const createArgs = buildMicrosoftApplyRpcArgs(previewItem(schedulePayload()), snapshot, 'run-1', 'create', false)
  assert.equal(createArgs.p_patch.assigned_to_user_id, '66666666-6666-4666-8666-666666666666')
  assert.equal(createArgs.p_patch.assigned_to_name, 'Alice Smith')
  assert.deepEqual(createArgs.p_patch.helper_names, ['Bob Jones'])

  const updateItem = previewItem(schedulePayload({ assigned_to_user_id: null, assigned_to_name: null, helper_names: [] }), {
    reconciliationAction: 'update', existingTargetId: '88888888-8888-4888-8888-888888888888', expectedTargetUpdatedAt: '2026-07-22T08:30:00Z',
  })
  const updateArgs = buildMicrosoftApplyRpcArgs(updateItem, snapshot, 'run-1', 'update', false)
  assert.equal(updateArgs.p_patch.assigned_to_user_id, null)
  assert.equal(updateArgs.p_patch.assigned_to_name, null)
  assert.deepEqual(updateArgs.p_patch.helper_names, [])
})

test('missing or outdated apply version blocks while version 3 passes', () => {
  // v3 ships link_existing support via phase-21a; the preflight now requires it.
  assert.match(microsoftApplyPreflightError(null, { message: 'missing' }), /phase-21a-microsoft-link-existing\.sql/)
  assert.match(microsoftApplyPreflightError(1, null), /phase-21a-microsoft-link-existing\.sql/)
  assert.match(microsoftApplyPreflightError(2, null), /phase-21a-microsoft-link-existing\.sql/)
  assert.equal(microsoftApplyPreflightError(3, null), null)
})

test('known failed runs finalize as failed and mixed outcomes finalize as partial', () => {
  assert.equal(microsoftRunFinalStatus(0, 3, 0), 'failed')
  assert.equal(microsoftRunFinalStatus(2, 1, 0), 'partial')
  assert.equal(microsoftRunFinalStatus(0, 0, 1), 'partial')
  assert.equal(microsoftRunFinalStatus(2, 0, 0), 'completed')
})

test('preflight occurs before microsoft_sync_runs insert in the apply implementation', () => {
  const source = readFileSync('src/lib/microsoftImportData.ts', 'utf8')
  const preflight = source.indexOf('await checkMicrosoftApplyVersion()')
  const runInsert = source.indexOf("from('microsoft_sync_runs').insert")
  assert.ok(preflight >= 0 && runInsert > preflight)
})

test('Phase 19c preserves the exact apply signature and safely parses helper arrays', () => {
  const sql = readFileSync('supabase/phase-19c-microsoft-sync-apply-reliability.sql', 'utf8')
  const signature = [
    'p_run_id uuid', 'p_item_key text', 'p_destination text', 'p_destination_id uuid',
    'p_expected_updated_at timestamptz', 'p_action text', 'p_should_apply boolean',
    'p_patch jsonb', 'p_source_type text', 'p_source_container_id text',
    'p_source_item_id text', 'p_source_name text', 'p_source_complete boolean', 'p_details jsonb',
  ]
  for (const parameter of signature) assert.ok(sql.includes(parameter), `missing ${parameter}`)
  assert.match(sql, /jsonb_typeof\(p_patch->'helper_names'\) = 'array'/)
  assert.match(sql, /array\(select jsonb_array_elements_text\(p_patch->'helper_names'\)\)/)
  assert.match(sql, /helper_names must be a JSON array or null/)
})

test('Phase 19c writes assignments only to Planner and Client Schedule and reloads PostgREST', () => {
  const sql = readFileSync('supabase/phase-19c-microsoft-sync-apply-reliability.sql', 'utf8')
  assert.match(sql, /insert into public\.planner_tasks[\s\S]*assigned_to_name[\s\S]*helper_names/)
  assert.match(sql, /update public\.planner_tasks set[\s\S]*assigned_to_name = case[\s\S]*helper_names = case/)
  assert.match(sql, /insert into public\.monthly_deliverables[\s\S]*assigned_to_user_id[\s\S]*assigned_to_name[\s\S]*helper_names/)
  assert.match(sql, /update public\.monthly_deliverables set[\s\S]*assigned_to_user_id = case[\s\S]*assigned_to_name = case[\s\S]*helper_names = case/)
  const calendarWrite = sql.slice(sql.indexOf("elsif p_destination = 'cg_calendar' then"), sql.indexOf("else\n      raise exception 'Unsupported Microsoft sync destination/action'"))
  assert.doesNotMatch(calendarWrite, /assigned_to_user_id|assigned_to_name|helper_names/)
  assert.match(sql, /NOTIFY pgrst, 'reload schema';/)
})

test('Phase 19c version RPC remains admin-only with restricted grants', () => {
  const sql = readFileSync('supabase/phase-19c-microsoft-sync-apply-reliability.sql', 'utf8')
  assert.match(sql, /create or replace function public\.microsoft_sync_apply_version\(\)[\s\S]*security definer set search_path = public[\s\S]*if not public\.is_admin\(\)/)
  assert.match(sql, /revoke all on function public\.microsoft_sync_apply_version\(\) from public;/)
  assert.match(sql, /revoke all on function public\.microsoft_sync_apply_version\(\) from anon;/)
  assert.match(sql, /grant execute on function public\.microsoft_sync_apply_version\(\) to authenticated;/)
})
