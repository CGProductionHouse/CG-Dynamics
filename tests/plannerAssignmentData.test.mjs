import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planner = readFileSync(new URL('../src/lib/planner.ts', import.meta.url), 'utf8')
const commandCentre = readFileSync(new URL('../src/lib/commandCentre.ts', import.meta.url), 'utf8')
const myDay = readFileSync(new URL('../src/lib/workforceMyDay.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260728180000_planner_multi_assignment.sql', import.meta.url), 'utf8')
const workloadAuthorityMigration = readFileSync(new URL('../supabase/migrations/20260809090000_planner_workload_completed_authority.sql', import.meta.url), 'utf8')

test('planner tasks expose ordered canonical assignees and safe unresolved defaults', () => {
  assert.match(planner, /assignees: PlannerAssignee\[\]/)
  assert.match(planner, /unresolved_assignee_names: string\[\]/)
  assert.match(planner, /listPlannerBoardAssignments\(boardId\)/)
  assert.match(planner, /assignees\.sort\(\(left, right\) => left\.position - right\.position\)/)
})

test('missing assignment RPC preserves legacy names as unresolved without UUID invention', () => {
  assert.match(planner, /error\?\.code === 'PGRST202' \|\| error\?\.code === '42883'/)
  assert.match(planner, /task\.assigned_to_name[\s\S]*stringArray\(task\.helper_names\)/)
  assert.match(planner, /assignmentRpcMissing \? \[\]/)
  assert.doesNotMatch(planner, /assigned_to_name[^\n]*randomUUID|helper_names[^\n]*randomUUID/)
})

test('directory, workload, activity, create and set loaders use the migration contract', () => {
  assert.match(planner, /rpc\('list_planner_assignment_directory'\)/)
  assert.match(planner, /full_name: person\.full_name\.trim\(\), is_active: true as const/)
  assert.match(planner, /rpc\('list_planner_workload_summary'\)/)
  assert.match(planner, /rpc\('list_planner_workload_tasks'\)/)
  assert.match(planner, /from\(ACTIVITY_LOG_TABLE\)[\s\S]*eq\('entity_type', 'planner_task'\)/)
  assert.match(planner, /rpc\('create_planner_task_with_assignees',[\s\S]*p_assignee_profile_ids: input\.assignee_profile_ids/)
  assert.match(planner, /rpc\('set_planner_task_assignees',[\s\S]*p_profile_ids: profileIds/)
})

test('workload task loader matches the RPC fields and paginates without implicit PostgREST limits', () => {
  for (const field of ['task_id', 'title', 'status', 'priority', 'start_date', 'due_date', 'client_name', 'board_id', 'board_name', 'bucket_id', 'bucket_name', 'assignee_profile_ids', 'is_unassigned']) {
    assert.match(planner, new RegExp(`${field}:`))
  }
  assert.match(planner, /const WORKLOAD_TASK_PAGE_SIZE = 1000/)
  assert.match(planner, /\.range\(from, from \+ WORKLOAD_TASK_PAGE_SIZE - 1\)/)
  assert.match(planner, /if \(page\.length < WORKLOAD_TASK_PAGE_SIZE\)/)
  assert.match(planner, /from \+= WORKLOAD_TASK_PAGE_SIZE/)
})

test('canonical Planner task and assignment reads paginate every 1000-row page', () => {
  assert.match(planner, /const PLANNER_READ_PAGE_SIZE = 1000/)
  const assignmentLoader = planner.slice(
    planner.indexOf('export async function listPlannerBoardAssignments'),
    planner.indexOf('export async function listPlannerWorkloadSummary'),
  )
  assert.match(assignmentLoader, /while \(true\)/)
  assert.match(assignmentLoader, /p_board_id: boardId \?\? null/)
  assert.match(assignmentLoader, /\.range\(from, from \+ PLANNER_READ_PAGE_SIZE - 1\)/)
  assert.match(assignmentLoader, /data\.push\(\.\.\.page\)/)
  assert.match(assignmentLoader, /if \(page\.length < PLANNER_READ_PAGE_SIZE\) return \{ data, error: null \}/)
  assert.match(assignmentLoader, /from \+= PLANNER_READ_PAGE_SIZE/)

  const taskLoader = planner.slice(
    planner.indexOf('export async function listPlannerTaskRows'),
    planner.indexOf('export async function listPlannerTasks'),
  )
  assert.match(taskLoader, /while \(true\)/)
  assert.match(taskLoader, /\.range\(from, from \+ PLANNER_READ_PAGE_SIZE - 1\)/)
  assert.match(taskLoader, /data\.push\(\.\.\.page\)/)
  assert.match(taskLoader, /from \+= PLANNER_READ_PAGE_SIZE/)
  assert.match(taskLoader, /order\('created_at',[\s\S]*order\('id'/)
})

test('paginated canonical reads fail closed instead of returning partial pages', () => {
  const assignmentLoader = planner.slice(
    planner.indexOf('export async function listPlannerBoardAssignments'),
    planner.indexOf('export async function listPlannerWorkloadSummary'),
  )
  const taskLoader = planner.slice(
    planner.indexOf('export async function listPlannerTaskRows'),
    planner.indexOf('export async function listPlannerTasks'),
  )
  assert.match(assignmentLoader, /if \(result\.error\) return \{ data: null, error:/)
  assert.match(taskLoader, /if \(result\.error\) return \{ data: null, error:/)
  assert.doesNotMatch(assignmentLoader, /if \(result\.error\) return \{ data, error:/)
  assert.doesNotMatch(taskLoader, /if \(result\.error\) return \{ data, error:/)
})

test('workload RPC treats inactive-only assignment as unassigned', () => {
  const workloadRpc = workloadAuthorityMigration.slice(workloadAuthorityMigration.indexOf('create or replace function public.list_planner_workload_tasks()'))
  assert.match(workloadRpc, /assignee_profile_ids uuid\[\]/)
  assert.match(workloadRpc, /assignee\.is_active/)
  assert.match(workloadRpc, /assignee\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(workloadRpc, /cardinality\(active_assignees\.profile_ids\) = 0/)
})

test('core planner writes cannot accept arbitrary assignment names', () => {
  const createInput = planner.slice(planner.indexOf('export interface CreatePlannerTaskInput'), planner.indexOf('export async function createPlannerTaskWithAssignees'))
  const updateInput = planner.slice(planner.indexOf('export interface UpdatePlannerTaskInput'), planner.indexOf('export async function updatePlannerTask('))
  assert.match(createInput, /assignee_profile_ids: string\[\]/)
  assert.doesNotMatch(createInput, /assigned_to_name|helper_names/)
  assert.doesNotMatch(updateInput, /assigned_to_name|helper_names/)
  assert.doesNotMatch(planner, /from\(PLANNER_TASKS_TABLE\)[\s\S]{0,300}assigned_to_name: input\./)
  assert.match(commandCentre, /if \(isPlannerTaskId\(id\)\) \{[\s\S]*delete patch\.assigned_to_name[\s\S]*delete patch\.helper_names/)
})

test('Command Centre carries every canonical assignee while retaining legacy fields', () => {
  assert.match(commandCentre, /assignee_user_ids\?: string\[\]/)
  assert.match(commandCentre, /assigned_to_user_id: assigneeUserIds\[0\] \?\? null/)
  assert.match(commandCentre, /assignee_user_ids: assigneeUserIds/)
  assert.match(commandCentre, /helper_names: row\.helper_names/)
  assert.match(commandCentre, /unresolved_assignee_names: row\.unresolved_assignee_names \?\? \[\]/)
  assert.match(commandCentre, /isMissingPlannerAssignmentRpcError\(assignmentResult\.error\)/)
  assert.match(commandCentre, /listPlannerTaskRows\(\{ order: 'due', activeOnly: options\.activeOnly \}\)/)
  assert.match(commandCentre, /listPlannerBoardAssignments\(\)/)
  assert.match(commandCentre, /current\.push\(assignment\.profile_id\)/)
  assert.doesNotMatch(commandCentre, /from\(PLANNER_TASKS_TABLE\)[\s\S]{0,160}select\('\*'\)/)
})

test('Hub and My Day exclude completed history at the query boundary', () => {
  assert.match(planner, /activeOnly\?: boolean/)
  // #176: activeOnly means "genuine active work". Scheduling states
  // (approved/scheduled/ready_internal_review) and deferral stay in the pool;
  // only operational completion is excluded at the query boundary. Hub / My Day
  // then apply the shared isActiveForToday helper for the today axis.
  assert.match(planner, /\.not\('status', 'in', '\(done,completed\)'\)/)
  assert.match(commandCentre, /nativeQuery = nativeQuery\.not\('status', 'in', '\(done,completed\)'\)/)
  assert.match(commandCentre, /listPlannerTaskRows\(\{ order: 'due', activeOnly: options\.activeOnly \}\)/)
  assert.match(myDay, /listTasks\(\{ activeOnly: true \}\)/)
})

// PR 3 removed the legacy name/helper fallback this test used to assert. My Day
// now matches canonical ids ONLY: the fallback was what put a task into someone's
// personal work because their name appeared in imported text, or because they
// were a helper rather than an owner.
test('My Day matches canonical assignees only, with no legacy name fallback, and uses Work links', () => {
  assert.match(myDay, /if \(assigneeUserIds\?\.length\) return assigneeUserIds\.includes\(profile\.id\)/)
  assert.match(myDay, /task\.assignee_user_ids/)
  const fn = myDay.slice(myDay.indexOf('function userMatches'), myDay.indexOf('function localMinutesFromIso'))
  const code = fn.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\*\*[\s\S]*?\*\//m, '')
  assert.ok(!/nameMatches\(/.test(code), 'no name fallback may remain')
  assert.ok(!/helperMatches\(/.test(code), 'no helper fallback may remain')
  assert.match(myDay, /\/admin\/work\?tab=board/)
  assert.doesNotMatch(myDay, /\/admin\/planner/)
})
