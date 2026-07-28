import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const layout = read('../src/pages/admin/AdminLayout.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')

function arraySource(name) {
  const start = layout.indexOf(`const ${name}`)
  assert.notEqual(start, -1, `${name} exists`)
  const source = layout.slice(start).match(/^const [\s\S]*?\n\s*\]/)?.[0]
  assert.ok(source, `${name} array body exists`)
  return source
}

test('canonical and compatibility work routes preserve every former destination', () => {
  assert.match(app, /path="\/admin\/work" element=\{<MyWorkPage \/>\}/)
  assert.match(app, /path="\/admin\/my-work" element=\{<MyWorkPage \/>\}/)
  assert.match(app, /path="\/admin\/my-day" element=\{<Navigate to="\/admin\/work\?tab=my-day" replace \/>\}/)
  assert.match(app, /path="\/admin\/planner" element=\{<Navigate to="\/admin\/work\?tab=board" replace \/>\}/)
  assert.match(app, /path="\/admin\/command-centre" element=\{<Navigate to="\/admin\/work\?tab=daily-tasks" replace \/>\}/)
})

test('desktop and mobile primary navigation each expose one Work and no My Work or Planner', () => {
  for (const name of ['hubNav', 'hubMobileItems']) {
    const source = arraySource(name)
    assert.equal((source.match(/label: 'Work'/g) ?? []).length, 1)
    assert.doesNotMatch(source, /label: 'My Work'|label: 'Planner'/)
    assert.match(source, /to: '\/admin\/work'/)
  }
})

test('calendar and schedule remain separate while Content and Assistant navigation is unchanged', () => {
  const desktop = arraySource('hubNav')
  assert.match(desktop, /to: '\/admin\/cg-calendar', label: 'CG Calendar'/)
  assert.match(desktop, /to: '\/admin\/client-schedule', label: 'Client Schedule'/)
  assert.match(desktop, /to: '\/admin\/content-workflow', label: 'Content Workflow'/)
  assert.match(desktop, /to: '\/admin\/full-content-guide', label: 'Full Content Guide'/)
  assert.match(desktop, /to: '\/admin\/assistant', label: 'Assistant'/)
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
