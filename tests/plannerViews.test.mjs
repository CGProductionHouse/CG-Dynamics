import assert from 'node:assert/strict'
import test from 'node:test'
import { isPlannerMonth, plannerView, shiftPlannerMonth, plannerDateSpan, plannerTasksOnDate, plannerStatusCounts } from '../src/lib/plannerViews.ts'

test('Planner views and months reject malformed URL values without inventing a board', () => {
  for (const view of ['board', 'grid', 'calendar', 'charts']) assert.equal(plannerView(view), view)
  for (const view of [null, 'company-calendar', 'GRID', '']) assert.equal(plannerView(view), 'board')
  for (const month of ['2026-10', '1900-01', '9999-12']) assert.equal(isPlannerMonth(month), true)
  for (const month of [null, '0000-01', '0001-01', '0099-12', '2026-13', '2026-00', '2026-1', '2026-10-01']) assert.equal(isPlannerMonth(month), false)
  assert.equal(shiftPlannerMonth('2026-12', 1), '2027-01')
  assert.equal(shiftPlannerMonth('2026-01', -1), '2025-12')
  assert.equal(shiftPlannerMonth('1900-01', -1), '1900-01')
  assert.equal(shiftPlannerMonth('9999-12', 1), '9999-12')
  assert.equal(shiftPlannerMonth('bad', 1), 'bad')
})

test('Calendar uses actual task dates including spans, start-only and due-only; missing is not today', () => {
  const tasks = [
    { id: 'span', start_date: '2026-10-18', due_date: '2026-10-20', status: 'in_progress' },
    { id: 'due', start_date: null, due_date: '2026-10-19', status: 'not_started' },
    { id: 'start', start_date: '2026-10-19', due_date: null, status: 'blocked' },
    { id: 'none', start_date: null, due_date: null, status: 'not_started' },
    { id: 'invalid', start_date: '2026-02-30', due_date: null, status: 'not_started' },
    { id: 'reversed', start_date: '2026-10-20', due_date: '2026-10-18', status: 'not_started' },
  ]
  const before = JSON.stringify(tasks)
  assert.deepEqual(plannerTasksOnDate(tasks, '2026-10-19').map(task => task.id), ['span', 'due', 'start'])
  assert.deepEqual(plannerTasksOnDate(tasks, '2026-10-20').map(task => task.id), ['span'])
  assert.deepEqual(plannerDateSpan(tasks[3]), { kind: 'unscheduled' })
  assert.deepEqual(plannerDateSpan(tasks[4]), { kind: 'invalid' })
  assert.deepEqual(plannerDateSpan(tasks[5]), { kind: 'invalid' })
  assert.deepEqual(plannerStatusCounts(tasks.slice(0, 3)), [{ status: 'in_progress', count: 1 }, { status: 'not_started', count: 1 }, { status: 'blocked', count: 1 }])
  assert.deepEqual(plannerStatusCounts([]), [])
  assert.equal(JSON.stringify(tasks), before)
})
