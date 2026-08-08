import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  isActiveAssistantDayItem,
  isActiveForToday,
  isActiveWorkTask,
  isDeferredToTomorrow,
  isOperationallyCompletedStatus,
} from '../src/lib/taskLifecycle.ts'

// Operational completion authority (issue #176).
//
// ONE shared decision: is this operational task finished and therefore excluded
// from active Work surfaces? The lifecycle module is that authority; pages and
// list layers must route through it instead of inventing per-status rules.
//
// Domain corrections locked into this contract:
//   - 'done' (and legacy 'completed') are the ONLY completed statuses.
//   - 'approved' / 'scheduled' / 'ready_internal_review' are scheduling states,
//     NOT completion — they stay ACTIVE work and must never be filed under done.
//   - 'moved_to_tomorrow' is unfinished. It is filtered out of today-axis
//     surfaces only (focus/overdue/due-now) via isActiveForToday, and stays an
//     eligible item on its own future day.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const lifecycle = read('../src/lib/taskLifecycle.ts')
const commandCentre = read('../src/lib/commandCentre.ts')
const planner = read('../src/lib/planner.ts')
const cgHub = read('../src/pages/admin/CgHubPage.tsx')
const opsHub = read('../src/pages/admin/OpsHubPage.tsx')
const myDay = read('../src/lib/workforceMyDay.ts')
const commandCentrePage = read('../src/pages/admin/CommandCentrePage.tsx')
const plannerPage = read('../src/pages/admin/PlannerPage.tsx')
const taskCard = read('../src/components/operations/TaskCard.tsx')
const dailyAssistant = read('../src/lib/dailyAssistant.ts')
const dailyAssistantCapture = read('../src/components/assistant/DailyAssistantCapture.tsx')
const globalAssistantComposer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const assistantPage = read('../src/pages/admin/AssistantPage.tsx')
const assistantMigration = read('../supabase/migrations/20260806090001_assistant_linked_completed_authority.sql')
const originalAssistantMigration = read('../supabase/migrations/20260803163045_personal_daily_assistant.sql')
const originalPushMigration = read('../supabase/migrations/20260804070651_iphone_web_push_notifications.sql')
const effectivePushMigration = read('../supabase/migrations/20260804081500_web_push_multi_device_counts.sql')

// ── The one shared authority ─────────────────────────────────────────────────
test('the lifecycle module is the single completed-status authority', () => {
  for (const token of ['isOperationallyCompletedStatus', 'isActiveWorkTask', 'isDeferredToTomorrow', 'isActiveForToday', 'isCompletedTask']) {
    assert.ok(lifecycle.includes(`export function ${token}`), `taskLifecycle must export ${token}`)
  }
  assert.match(lifecycle, /OPERATIONAL_COMPLETED_STATUSES = \['done', 'completed'\]/)
  assert.match(lifecycle, /DEFERRED_TO_TOMORROW_STATUS = 'moved_to_tomorrow'/)
})

test('the authority names the consumers that must route through it', () => {
  for (const consumer of ['Work', 'My Work', 'Team Work', 'Planner', 'Command Centre', 'CG Hub', 'summaries', 'notifications', 'CG Assistant']) {
    assert.ok(lifecycle.includes(consumer), `the contract must name ${consumer}`)
  }
})

// ── Genuine completion semantics ─────────────────────────────────────────────
test("approved/scheduled/ready_internal_review are never completed or historically 'done'", () => {
  const mapper = commandCentre.slice(commandCentre.indexOf('function taskStatusFromPlanner'))
  assert.ok(!/(status\s*===\s*'approved'|status\s*===\s*'scheduled').*return 'done'/.test(mapper),
    'the old approved/scheduled -> done shortcut must be gone')
  assert.ok(
    /status === 'approved' \|\| status === 'scheduled' \|\| status === 'ready_internal_review'\) return 'in_progress'/.test(mapper),
    'approved/scheduled/ready project to an ACTIVE bucket, never done'
  )
})

test('the lifecycle helpers answer the semantics used everywhere', () => {
  for (const state of ['approved', 'scheduled', 'ready_internal_review', 'in_progress', 'blocked', 'waiting_client', 'to_do']) {
    assert.equal(isOperationallyCompletedStatus(state), false, `${state} must not count as completed`)
  }
  for (const s of ['done', 'completed']) assert.equal(isOperationallyCompletedStatus(s), true, `${s} is the only genuine completion`)

  assert.equal(isDeferredToTomorrow('moved_to_tomorrow'), true)
  assert.equal(isDeferredToTomorrow('done'), false)

  // Deferred is unfinished — active as work, but not part of TODAY's axis.
  assert.equal(isActiveWorkTask('moved_to_tomorrow'), true, 'deferred stays unfinished/active')
  assert.equal(isActiveForToday('moved_to_tomorrow'), false, 'deferred is not in today queue')
  assert.equal(isActiveForToday('approved'), true, 'approved is today-eligible active work')
  assert.equal(isActiveForToday('scheduled'), true)
  assert.equal(isActiveForToday('done'), false)
  assert.equal(isActiveForToday('completed'), false)
  assert.equal(isActiveWorkTask('done'), false)
})

// ── The DB already holds the single authority ────────────────────────────────
test('planner_tasks has no completed_at fabrication in the adapter', () => {
  const mapper = commandCentre.slice(commandCentre.indexOf('function plannerTaskToCommandTask'))
  // The adapter must set null with an explanation, because planner_tasks has no
  // completed_at column and scheduling states must never be fabricated as done.
  assert.match(mapper, /completed_at: null/)
  assert.match(mapper, /planner_tasks has no completed_at column/)
  assert.ok(!/completed_at: row\.updated_at/.test(mapper), 'must never fabricate a completion timestamp')
})

// ── Raw Planner label survives the projection ────────────────────────────────
test('raw planner status is preserved so cards can say Approved/Scheduled, not In progress', () => {
  assert.match(commandCentre, /planner_status\?: string/)
  assert.match(commandCentre, /planner_status: row\.status/)
  assert.ok(commandCentre.includes('export function taskStatusDisplayLabel'))
  const fn = commandCentre.slice(commandCentre.indexOf('export function taskStatusDisplayLabel'))
  assert.match(fn, /planner_tasks/)
  assert.match(fn, /PLANNER_TASK_STATUS_LABELS/)
})

test('visible surfaces resolve the label through the display helper', () => {
  assert.ok(cgHub.includes('taskStatusDisplayLabel'), 'CgHub must render approved/scheduled truthfully')
  assert.ok(myDay.includes('taskStatusDisplayLabel'), 'My Day labels come from the shared resolver')
  assert.ok(taskCard.includes('taskStatusDisplayLabel'), 'TaskCard labels come from the shared resolver')
  assert.ok(commandCentrePage.includes('taskStatusDisplayLabel'), 'Command Centre rows show the truthful label')
})

// ── No competing per-page status lists ───────────────────────────────────────
test('no page may re-declare a finished/done status list', () => {
  for (const src of [cgHub, opsHub, myDay, commandCentrePage]) {
    assert.ok(!/HUB_COMPLETED|HUB_EXCLUDED_STATUS|ACTIVE_TASK_STATUSES/.test(src), 'per-page completed sets must be gone')
  }
  // The old HUB_COMPLETED ignored scheduling states silently by listing only
  // done+moved as finished; cgHub now uses isActiveForToday for the today axis.
  assert.ok(cgHub.includes('isActiveForToday'), 'CgHub routes through the shared today-axis helper')
})

test('planner activeOnly list excludes only genuine completion (done/completed)', () => {
  const fn = planner.slice(planner.indexOf('export async function listPlannerTaskRows'))
  assert.ok(!/approved,scheduled/.test(fn), 'listPlannerTaskRows must stop excluding approved/scheduled')
  assert.match(fn, /\.not\('status', 'in', '\(done,completed\)'\)/)
})

test('native task list activeOnly excludes only genuine completion', () => {
  const fn = commandCentre.slice(commandCentre.indexOf('export async function listTasks'))
  assert.match(fn.slice(0, 300), /not\('status', 'in', '\(done,completed\)'\)/)
  assert.ok(!/moved_to_tomorrow/.test(fn.slice(0, 300)), 'moved_to_tomorrow must flow through for today-axis filtering')
})

test('workforce MyDay filters through isActiveForToday, not a local set', () => {
  assert.ok(myDay.includes('isActiveForToday'))
  assert.ok(!/ACTIVE_TASK_STATUSES\.has/.test(myDay))
})

test('Ops Hub board and admin board exclude completed via the shared helper', () => {
  assert.ok(opsHub.includes('isActiveWorkTask'))
  assert.ok(opsHub.includes('isActiveForToday'))
})

test('Command Centre routes filters through the shared reasons', () => {
  assert.ok(commandCentrePage.includes('isActiveForToday'))
  assert.ok(commandCentrePage.includes('isActiveWorkTask'))
  assert.ok(commandCentrePage.includes('matchesWorkFilter'))
  assert.match(commandCentrePage, /today: allActiveTasks\.filter\(t => isActiveForToday\(t\) && t\.due_date === today\)\.length/)
})

test('Planner history is genuinely completed + archived only', () => {
  const fn = plannerPage.slice(plannerPage.indexOf('function isPlannerHistoryTask'), plannerPage.indexOf('function isOverdue'))
  assert.match(fn, /isOperationallyCompletedStatus/)
  assert.ok(!/['"]approved['"]/.test(fn) && !/['"]scheduled['"]/.test(fn),
    'approved/scheduled must not be filed under Completed history')
})

// ── Reopen path stays truthful ───────────────────────────────────────────────
test('completion is a decision from status, never frozen by evidence', () => {
  const snippet = lifecycle.slice(lifecycle.indexOf('completed_at'))
  assert.match(snippet, /reopens \(done -> to_do\)/)
  assert.match(snippet, /active work again while keeping its history/)
})

// ── Linked Assistant item lifecycle ──────────────────────────────────────────
function assistantItem(state = 'open', linkedPlannerStatus = undefined) {
  return {
    state,
    planner_task_id: linkedPlannerStatus === undefined ? null : 'planner-task-1',
    linked_planner_status: linkedPlannerStatus,
  }
}

test('linked Assistant items hide only for genuine Planner completion', () => {
  assert.equal(isActiveAssistantDayItem(assistantItem('open', 'done')), false)
  assert.equal(isActiveAssistantDayItem(assistantItem('open', 'completed')), false)

  for (const status of ['approved', 'scheduled', 'ready_internal_review', 'waiting_client', 'to_do', 'in_progress']) {
    assert.equal(isActiveAssistantDayItem(assistantItem('open', status)), true, `${status} must remain active`)
  }
})

test('linked Assistant item reopening is derived while explicit item decisions win', () => {
  const item = assistantItem('open', 'done')
  assert.equal(isActiveAssistantDayItem(item), false)
  item.linked_planner_status = 'to_do'
  assert.equal(isActiveAssistantDayItem(item), true, 'done -> to_do must make an open linked item active again')
  item.state = 'completed'
  assert.equal(isActiveAssistantDayItem(item), false, 'explicit completion survives Planner reopen')
  item.state = 'dismissed'
  assert.equal(isActiveAssistantDayItem(item), false, 'explicit dismissal survives Planner reopen')
})

test('unlinked open Assistant items remain active', () => {
  assert.equal(isActiveAssistantDayItem(assistantItem('open')), true)
  assert.equal(isActiveAssistantDayItem(assistantItem('completed')), false)
  assert.equal(isActiveAssistantDayItem(assistantItem('dismissed')), false)
})

test('Assistant frontend exposes one derived helper backed by taskLifecycle', () => {
  assert.match(dailyAssistant, /import \{ isActiveAssistantDayItem \} from '\.\/taskLifecycle'/)
  assert.match(dailyAssistant, /export \{ isActiveAssistantDayItem \} from '\.\/taskLifecycle'/)
  assert.doesNotMatch(dailyAssistant, /\['done',\s*'completed'\]|new Set\(\['done',\s*'completed'\]\)/)
  assert.match(dailyAssistant, /items\.filter\(isActiveAssistantDayItem\)/)
  assert.match(dailyAssistantCapture, /items\.filter\(isActiveAssistantDayItem\)/)
  assert.match(globalAssistantComposer, /dailyAssistantContextLine\(captureResult\.data \?\? \[\], itemResult\.data \?\? \[\]\)/)
  assert.match(assistantPage, /dailyAssistantContextLine\(captureResult\.data \?\? \[\], itemResult\.data \?\? \[\]\)/)
})

test('both Assistant notification functions guard every assistant_day_items path', () => {
  const refresh = sqlFunction(assistantMigration, 'refresh_my_assistant_day_notifications')
  const push = sqlFunction(assistantMigration, 'generate_due_assistant_notifications')
  for (const [name, fn] of [['refresh', refresh], ['push', push]]) {
    const guards = [...fn.matchAll(/not exists \(\s*select 1 from public\.planner_tasks linked_task\s*where linked_task\.id = item\.planner_task_id\s*and linked_task\.status in \('done', 'completed'\)\s*\)/g)]
    assert.equal(guards.length, 4, `${name} must guard morning, midday, end-of-day and direct reminders`)
    for (const guard of guards) {
      assert.doesNotMatch(guard[0], /approved|scheduled|ready_internal_review|waiting_client/)
    }
  }
})

test('forward SQL changes only the linked-completed guard in the effective functions', () => {
  assert.equal(
    normalizeFunctionWithoutLinkedGuard(sqlFunction(assistantMigration, 'refresh_my_assistant_day_notifications')),
    normalizeSql(sqlFunction(originalAssistantMigration, 'refresh_my_assistant_day_notifications')),
  )
  assert.equal(
    normalizeFunctionWithoutLinkedGuard(sqlFunction(assistantMigration, 'generate_due_assistant_notifications')),
    normalizeSql(sqlFunction(effectivePushMigration, 'generate_due_assistant_notifications')),
  )
})

test('forward SQL preserves security, grants, and the original iphone notification contract', () => {
  for (const name of ['refresh_my_assistant_day_notifications', 'generate_due_assistant_notifications']) {
    const fn = sqlFunction(assistantMigration, name)
    assert.match(fn, /security definer set search_path = public/)
    assert.match(fn, /if v_hour < 7 or v_hour >= 19 then return 0/)
  }
  for (const fragment of [
    "'assistant_day', 'Morning plan'",
    "'assistant_day', 'Midday check'",
    "'assistant_day', 'Before you finish today'",
    "'assistant_reminder', 'Follow-up reminder'",
    "'assistant_day_item'",
    "'/admin/work?tab=my-day'",
    "on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing",
  ]) {
    assert.ok(originalPushMigration.includes(fragment), `iphone baseline must contain ${fragment}`)
    assert.ok(assistantMigration.includes(fragment), `forward migration must retain ${fragment}`)
  }
  assert.match(assistantMigration, /revoke all on function public\.refresh_my_assistant_day_notifications\(\) from public, anon, authenticated/)
  assert.match(assistantMigration, /grant execute on function public\.refresh_my_assistant_day_notifications\(\) to authenticated/)
  assert.match(assistantMigration, /revoke all on function public\.generate_due_assistant_notifications\(\) from public, anon, authenticated/)
  assert.match(assistantMigration, /grant execute on function public\.generate_due_assistant_notifications\(\) to service_role/)
  assert.doesNotMatch(assistantMigration, /create (?:or replace )?function public\.(?:snooze|dismiss)_my_assistant_notification/)
  assert.match(originalAssistantMigration, /create or replace function public\.snooze_my_assistant_notification/)
  assert.match(originalAssistantMigration, /create or replace function public\.dismiss_my_assistant_notification/)
})

test('Assistant linked-completion SQL is derived and non-destructive', () => {
  assert.doesNotMatch(assistantMigration, /update public\.assistant_day_items|delete from public\.assistant_day_items|insert into public\.assistant_day_items/i)
  assert.doesNotMatch(assistantMigration, /create trigger|completed_at\s*=/i)
  assert.match(assistantMigration, /item\.state = 'open'/)
})

test('linked Planner enrichment reads the exact FK row and propagates query errors', () => {
  assert.match(dailyAssistant, /\.from\('planner_tasks'\)\s*\.select\('id,status'\)/)
  assert.doesNotMatch(dailyAssistant, /\.from\('planner_tasks_canonical'\)/)
  assert.match(dailyAssistant, /if \(result\.error\) return \{ data: null, error: result\.error \}/)
  assert.match(dailyAssistant, /if \(enriched\.error\) return \{ \.\.\.result, data: null, error: enriched\.error \}/)
})

// ── Scope discipline ─────────────────────────────────────────────────────────
test('the fix does not touch the schedule source of truth or invite lifecycle', () => {
  assert.ok(!commandCentre.includes('monthly_deliverables'), 'commandCentre must not grow a second schedule table')
})

function sqlFunction(src, name) {
  const start = src.indexOf(`create or replace function public.${name}()`)
  assert.notEqual(start, -1, `${name} must exist`)
  const end = src.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} must terminate`)
  return src.slice(start, end + 4)
}

function normalizeSql(src) {
  return src.replace(/\s+/g, ' ').trim()
}

function normalizeFunctionWithoutLinkedGuard(src) {
  return normalizeSql(src.replace(
    /\s+and not exists \(\s*select 1 from public\.planner_tasks linked_task\s*where linked_task\.id = item\.planner_task_id\s*and linked_task\.status in \('done', 'completed'\)\s*\)/g,
    '',
  ))
}
