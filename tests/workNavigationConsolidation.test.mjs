import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const layout = read('../src/pages/admin/AdminLayout.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')

const adminNav = read('../src/pages/admin/adminNavigation.ts')

test('canonical and compatibility work routes preserve every former destination', () => {
  assert.match(app, /path="\/admin\/work" element=\{<MyWorkPage \/>\}/)
  assert.match(app, /path="\/admin\/my-work" element=\{<MyWorkPage \/>\}/)
  assert.match(app, /path="\/admin\/my-day" element=\{<Navigate to="\/admin\/work\?tab=my-day" replace \/>\}/)
  assert.match(app, /path="\/admin\/planner" element=\{<Navigate to="\/admin\/work\?tab=board" replace \/>\}/)
  assert.match(app, /path="\/admin\/command-centre" element=\{<Navigate to="\/admin\/work\?tab=daily-tasks" replace \/>\}/)
})

test('desktop and mobile primary navigation each expose one Work and no My Work or Planner', () => {
  assert.equal((adminNav.match(/label: 'Work'/g) ?? []).length, 1)
  assert.doesNotMatch(adminNav, /label: 'My Work'|label: 'Planner'/)
  assert.match(adminNav, /to: '\/admin\/work'/)
})

test('calendar and schedule remain separate while Content navigates to unified path', () => {
  assert.match(adminNav, /to: '\/admin\/cg-calendar', label: 'CG Calendar'/)
  assert.match(adminNav, /to: '\/admin\/client-schedule', label: 'Client Schedule'/)
  assert.match(adminNav, /to: '\/admin\/content', label: 'Content'/)
  assert.match(adminNav, /\/admin\/content-workflow/)
  assert.match(adminNav, /\/admin\/full-content-guide/)
})

test('Work defaults staff to My Day and gates workload and unassigned controls to managers', () => {
  assert.match(work, /const canViewWorkload = isManagerRole\(profile\?\.role\)/)
  assert.match(work, /requestedTab === 'workload' && canViewWorkload/)
  assert.match(work, /: 'my-day'/)
  assert.match(work, /canViewWorkload \? \[\['workload', 'Workload'\]/)
  assert.match(work, /canViewWorkload && <Link to="\?tab=board&scope=unassigned"/)
})

test('Work renders embedded board and keeps personal content on My Day only', () => {
  assert.match(work, /tab === 'board' && <PlannerPage embedded \/>/)
  assert.doesNotMatch(work, /<PlannerPage key=/)
  assert.match(work, /tab === 'my-day' && <><MyVideoQueue \/><MyContentRuns \/><MyDayPage embedded \/><\/>/)
  assert.match(work, /tab === 'daily-tasks'[\s\S]*Capture client request[\s\S]*<CommandCentrePage embedded \/>/)
})

test('manager workload uses factual RPC metrics with complete states and workload-local summary links', () => {
  assert.match(work, /listPlannerWorkloadSummary\(\)/)
  for (const metric of ['active_task_count', 'overdue_count', 'blocked_count', 'due_today_count', 'due_next_7_days_count']) assert.match(work, new RegExp(metric))
  assert.match(work, /\?tab=workload&person=\$\{encodeURIComponent\(person\.profile_id\)\}/)
  assert.match(work, /\?tab=workload&person=unassigned/)
  assert.match(work, /if \(loading\)/)
  assert.match(work, /if \(error\)/)
  assert.match(work, /if \(people\.length === 0 && tasks\.length === 0\)/)
  assert.doesNotMatch(work, /score|productivity|performance rating/i)
})

test('workload detail uses the scoped RPC and active-only canonical assignment IDs', () => {
  assert.match(work, /Promise\.all\(\[listPlannerWorkloadSummary\(\), listPlannerWorkloadTasks\(\)\]\)/)
  assert.doesNotMatch(work, /listTasks|\.\.\/\.\.\/lib\/commandCentre/)
  assert.match(work, /task\.assignee_profile_ids\.includes\(selectedPerson\)/)
  assert.match(work, /task\.assignee_profile_ids\.length === 0/)
  for (const field of ['task.title', 'task.client_name', 'task.board_name', 'task.bucket_name', 'task.status', 'task.due_date', 'task.priority']) assert.match(work, new RegExp(field.replace('.', '\\.')))
  assert.match(work, /\?tab=board&scope=unassigned/)
  assert.match(work, /\?tab=board&assignee=\$\{encodeURIComponent\(selectedPerson \?\? ''\)\}/)
})
