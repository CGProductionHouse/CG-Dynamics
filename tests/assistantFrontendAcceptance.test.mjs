import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const actions = read('../src/lib/assistantActions.ts')
const videos = read('../src/lib/assistantVideos.ts')
const workflow = read('../src/pages/admin/ContentWorkflowPage.tsx')
const planner = read('../src/pages/admin/PlannerPage.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')

test('retained task assignment contract clarifies non-atomic updates and canonical matching', () => {
  assert.match(actions, /current backend cannot apply both atomically/)
  // PR #203 removed the "open Planner first" instruction for task assignment;
  // existing-task resolution now searches visible tasks with a canonical match.
  assert.doesNotMatch(actions, /Open the Planner task first so I know exactly which existing task to assign/)
  assert.match(actions, /matching active task/i)
})

test('supported Work board routes supply assistant task context and hydrate notification deep links', () => {
  assert.match(planner, /getPlannerTaskBoardId\(routeTaskId\)/)
  assert.match(planner, /setDrawerTask\(linkedTask\)/)
  assert.match(planner, /if \(isPlannerHistoryTask\(linkedTask\)\) setWorkView\('history'\)/)
  assert.match(work, /if \(taskId\) next\.set\('id', taskId\)/)
})

test('Planner publishes plain task identity and clears stale task context on board switch', () => {
  assert.match(planner, /next\.set\('task', task\.title\)/)
  const selectBoard = planner.slice(planner.indexOf('function selectBoard'), planner.indexOf('function refreshActiveBoardTasks'))
  assert.match(selectBoard, /next\.delete\('id'\)/)
  assert.match(selectBoard, /next\.delete\('task'\)/)
  assert.match(selectBoard, /setSearchParams\(next, \{ replace: true \}\)/)
})

test('Content Workflow and shared run resolver retain exact run identity', () => {
  assert.match(workflow, /next\.set\('runId', run\.id\)/)
  assert.match(workflow, /const legacyRunId = searchParams\.get\('run'\)[\s\S]*const runId = searchParams\.get\('runId'\) \?\? legacyRunId/)
  assert.match(workflow, /if \(canonicalize\) setSearchParams/)
  assert.match(videos, /\.eq\('id', runId\)[\s\S]*\.maybeSingle\(\)/)
  assert.doesNotMatch(videos, /order\('run_date'|limit\(1\)|eq\('client_id'/)
})

test('Meta preview uses plain previous-month wording while payload remains backend compatible', () => {
  assert.match(actions, /sync_previous_month/)
  assert.doesNotMatch(actions, /fields: \{ job: 'meta_sync', baseline:/)
})

test('schedule approval copy reflects manager and admin permissions', () => {
  assert.match(actions, /manager or admin approves them/)
  assert.doesNotMatch(actions, /until an Admin approves/)
})

// Keep the old route usable without replaying old query-string prompts.
test('legacy assistant route replace-redirects to the existing authenticated workspace', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /path="\/admin\/assistant" element=\{<Navigate to="\/admin\/my-assistant" replace \/>\}/)
  assert.match(app, /path="\/admin\/my-assistant" element=\{<MyAssistantPage \/>\}/)
  assert.doesNotMatch(app, /import\(['"].*\/AssistantPage['"]\)/)
  assert.match(app, /<RequireStaff/)
})

test('retained My Assistant offers existing setup and work without a model composer', () => {
  const page = read('../src/pages/admin/MyAssistantPage.tsx')
  assert.match(page, /getMyDayContext\(profile\)/)
  assert.match(page, /<TodayPanel/)
  assert.match(page, /<LeadsPanel/)
  assert.match(page, /<SetupPanel/)
  assert.doesNotMatch(page, /GlobalAssistantComposer|DailyAssistantCapture|cg-assistant-chat/)
})
