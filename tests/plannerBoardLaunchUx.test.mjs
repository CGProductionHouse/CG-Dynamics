import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/admin/PlannerPage.tsx', import.meta.url), 'utf8')
const planner = readFileSync(new URL('../src/lib/planner.ts', import.meta.url), 'utf8')

test('uses one board horizontal scroller and local vertical bucket regions at every width', () => {
  assert.equal((page.match(/overflow-x-auto/g) ?? []).length, 1)
  assert.match(page, /data-testid="planner-board-scroller"[\s\S]*overflow-x-auto/)
  assert.match(page, /data-testid="planner-bucket-scroll"[\s\S]*overflow-y-auto overscroll-contain/)
  assert.doesNotMatch(page, /PlannerMobileTaskList|topScrollRef|topScrollSpacerRef/)
})

test('places each manager add control before its task list and creates with canonical people', () => {
  const column = page.slice(page.indexOf('function BucketColumn'), page.indexOf('function PlannerTaskCard'))
  assert.ok(column.indexOf('data-testid="bucket-add-task"') < column.indexOf('data-testid="planner-bucket-scroll"'))
  assert.match(column, /PlannerPeoplePicker/)
  assert.match(column, /createPlannerTask\([\s\S]*assignee_profile_ids:/)
  assert.doesNotMatch(column, /assigned_to_name:/)
  assert.match(column, /saving \|\| !title\.trim\(\)/)
})

test('cards expose launch fields, assignment identity, overdue, blocked, and checklist progress', () => {
  const card = page.slice(page.indexOf('function PlannerTaskCard'), page.indexOf('function PlannerTaskDrawer'))
  for (const token of ['task.title', 'task.client_name', 'task.status', 'task.priority', 'task.due_date', 'Overdue', 'Blocked', 'PlannerAssigneeAvatars', 'checklist']) assert.match(card, new RegExp(token.replace('.', '\\.')))
  assert.match(card, /unresolved_assignee_names/)
})

test('drawer integrates canonical assignment, core edits, checklist and activity history without raw assignment fields', () => {
  assert.match(page, /listPlannerAssignmentDirectory/)
  assert.match(page, /updatePlannerTaskWithAssignees/)
  assert.doesNotMatch(page, /setPlannerTaskAssignees|updatePlannerTask\(/)
  assert.match(page, /listPlannerActivity/)
  assert.match(page, /checklist: serializedChecklist\(\)/)
  assert.match(planner, /interface UpdatePlannerTaskWithAssigneesInput[\s\S]*assignee_profile_ids: string\[\][\s\S]*checklist: unknown\[\]/)
  assert.match(planner, /rpc\('update_planner_task_with_assignees',[\s\S]*p_profile_ids: input\.assignee_profile_ids/)
  assert.doesNotMatch(planner, /rpc\('update_planner_task_with_assignees',[\s\S]{0,500}p_assignee_profile_ids:/)
  assert.match(planner, /bucket_id: string \| null/)
  assert.doesNotMatch(page, /placeholder="Name"|Names separated by commas|>Assigned to<|>Helpers</)
  assert.doesNotMatch(page, />Timer<|>Start<|>Pause<|>Stop</)
})

test('permission gates keep manager core writes and assigned staff status-only writes', () => {
  assert.match(page, /if \(!canManage\)[\s\S]*updatePlannerTaskStatus/)
  assert.match(page, /canonicalAssignment \? Boolean\(currentProfileId/)
  assert.match(page, /!canonicalAssignment[\s\S]*legacyAssigned/)
  assert.match(page, /disabled=\{!canManage\}/)
  assert.match(page, /canManage \? <ClientPicker/)
})

test('preserves board context and reloads canonical task data after saves', () => {
  assert.match(page, /savedScroll/)
  assert.match(page, /captureScroll\(\)/)
  assert.match(page, /restoreScroll\(\)/)
  assert.match(page, /bucketScrollRefs/)
  assert.match(page, /await onReload\(\)/)
  assert.match(page, /export default function PlannerPage\(\{ embedded = false \}/)
})

test('consumes direct Work workload and quick-filter navigation', () => {
  assert.match(page, /useSearchParams/)
  assert.match(page, /const routeAssignee = routeParams\.get\('assignee'\)/)
  assert.match(page, /const effectiveAssigneeFilter = routeAssignee \? `person:\$\{routeAssignee\}` : assigneeFilter/)
  assert.match(page, /routeParams\.get\('scope'\)/)
  assert.match(page, /routeScope === 'all' \|\| routeScope === 'overdue' \|\| routeScope === 'blocked'/)
  assert.doesNotMatch(page, /useEffect\([\s\S]{0,250}setAssigneeFilter|useEffect\([\s\S]{0,250}setQuickScope/)
  assert.match(page, /const \[routeParams, setSearchParams\] = useSearchParams\(\)/)
  assert.match(page, /new URLSearchParams\(routeParams\)/)
  assert.match(page, /next\.delete\('assignee'\)/)
  assert.match(page, /next\.set\('assignee', value\.slice\(7\)\)/)
  assert.match(page, /next\.delete\('scope'\)/)
  assert.match(page, /next\.set\('scope', scope\)/)
  assert.match(page, /setSearchParams\(next, \{ replace: true \}\)/)
})

test('guards rapid board switches from stale buckets and task responses', () => {
  assert.match(page, /if \(!active \|\| requestId !== taskRequestRef\.current\) return/)
  assert.match(page, /bucketsBoardId === activeBoardRecord\?\.id \? buckets : \[\]/)
  assert.match(page, /tasksBoardId === activeBoardRecord\?\.id \? tasks : \[\]/)
  assert.match(page, /function selectBoard[\s\S]*taskRequestRef\.current \+= 1/)
  assert.match(page, /listPlannerBuckets[\s\S]*if \(!active\) return/)
  assert.match(page, /fetchBoardTasks[\s\S]*if \(!active \|\| requestId !== taskRequestRef\.current\) return/)
})

test('keeps bucket and task query failures distinct from truthful empty states', () => {
  assert.match(page, /if \(error\) return \{ data: null, error \}/)
  assert.doesNotMatch(page, /const \{ data \} = await listPlannerTasks/)
  assert.match(page, /Planner columns could not be loaded/)
  assert.match(page, /Planner tasks could not be loaded/)
  assert.match(page, /function retryBuckets/)
  assert.match(page, /function retryTasks/)
  assert.match(page, /!tasksError && tasks\.length === 0/)
})

test('manager save is one atomic RPC and only reports success after canonical reload', () => {
  const save = page.slice(page.indexOf('async function save()'), page.indexOf('async function archive()'))
  assert.equal((save.match(/updatePlannerTaskWithAssignees\(/g) ?? []).length, 1)
  assert.doesNotMatch(save, /setPlannerTaskAssignees|updatePlannerTask\(/)
  assert.match(save, /if \(result\.error\) \{ setSaveError\(`Task was not saved\./)
  assert.match(save, /await onReload\(\)[\s\S]*onClose\(\)/)
})

test('renders bucketless tasks in a synthetic column without invalid create controls', () => {
  assert.match(page, /const NO_BUCKET_ID = '__none__'/)
  assert.match(page, /tasksByBucket\.get\(NO_BUCKET_ID\) \?\? \[\]/)
  assert.match(page, /bucket=\{\{ id: NO_BUCKET_ID, name: 'No bucket' \}\}/)
  assert.match(page, /allowAdd=\{false\}/)
  assert.match(page, /allowAdd && canManage && workView === 'active'/)
  assert.match(page, /if \(!allowAdd \|\| !title\.trim\(\)/)
  assert.match(page, /<option value="">No bucket<\/option>/)
})

test('dirty drawer close paths require explicit discard confirmation', () => {
  const drawer = page.slice(page.indexOf('function PlannerTaskDrawer'), page.indexOf('function ActivityRow'))
  for (const field of ['title !== task.title', 'clientId !==', 'clientName !==', 'bucketId !==', 'status !== task.status', 'priority !== task.priority', 'startDate !==', 'dueDate !==', 'notes !==', "assigneeIds.join('|')", 'JSON.stringify(serializedChecklist())']) assert.match(drawer, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(drawer, /function requestClose\(\)[\s\S]*setConfirmDiscard\(true\)/)
  assert.match(drawer, /event\.key !== 'Escape'[\s\S]*setConfirmDiscard\(true\)/)
  assert.ok((drawer.match(/onClick=\{requestClose\}/g) ?? []).length >= 3)
  assert.match(drawer, /role="alertdialog"/)
  assert.match(drawer, /Discard unsaved changes\?/) 
  assert.match(drawer, />Stay</)
  assert.match(drawer, />Discard changes</)
  assert.match(drawer, /const refreshed = await onReload\(\)[\s\S]*onClose\(\)/)
})

test('board query failures are distinct from missing tables and genuine empty boards', () => {
  assert.match(page, /const \[boardError, setBoardError\]/)
  assert.match(page, /setBoardError\(error\.message \?\? 'Could not load Planner boards\.'\)/)
  assert.match(page, /Planner boards could not be loaded/)
  assert.match(page, /function retryBoards\(\)/)
  assert.ok(page.indexOf('if (boardError)') < page.indexOf('if (tableMissing || boards.length === 0)'))
  assert.match(page, /title=\{tableMissing \? 'Planner tables not set up yet' : 'No boards found'\}/)
})

test('recurrence materialization failures block an incomplete board load visibly', () => {
  assert.match(page, /const materialized = await materializeRecurringTasks\(\)/)
  assert.match(page, /if \(materialized\.error\) return \{ data: null, error:/)
  assert.match(page, /materialized\.migrationNeeded/)
  assert.match(page, /Recurring task migration is required before Planner can load safely/)
})
