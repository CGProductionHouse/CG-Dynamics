import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const actions = read('../src/lib/assistantActions.ts')
const videos = read('../src/lib/assistantVideos.ts')
const workflow = read('../src/pages/admin/ContentWorkflowPage.tsx')
const planner = read('../src/pages/admin/PlannerPage.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')

test('Planner publishes plain task identity and clears stale task context on board switch', () => {
  assert.match(planner, /next\.set\('task', task\.title\)/)
  const selectBoard = planner.slice(planner.indexOf('function selectBoard'), planner.indexOf('function refreshActiveBoardTasks'))
  assert.match(selectBoard, /next\.delete\('id'\)/)
  assert.match(selectBoard, /next\.delete\('task'\)/)
  assert.match(selectBoard, /setSearchParams\(next, \{ replace: true \}\)/)
})
