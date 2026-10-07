import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, getMyDayContext
before(async () => {
  server = await createServer({ root: process.cwd(), configFile: false, server: { hmr: false }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture'),
  } })
  ;({ getMyDayContext } = await server.ssrLoadModule('/src/lib/workforceMyDay.ts'))
})
after(async () => { await server?.close() })
const profile = { id: 'fixture-admin', full_name: 'Fixture Admin' }
const event = (id, start, end, extra = {}) => ({ id, title: id,
  start_at: `2026-10-07T${start}:00+02:00`, end_at: `2026-10-07T${end}:00+02:00`,
  all_day: false, status: 'scheduled', event_type: 'meeting', client_name: null,
  assigned_to_name: 'Fixture Admin', ...extra })
const data = events => ({ tasks: [], clients: [], deliverables: [], events })
const now = new Date('2026-10-07T16:30:00+02:00')

test('elapsed morning event is never NEXT; after-hours event keeps its own calendar identity', async () => {
  const input = data([event('past', '09:00', '10:00'), event('current', '16:00', '17:00'), event('future', '20:00', '21:00')])
  const original = structuredClone(input)
  const result = await getMyDayContext(profile, now, input)
  assert.equal(result.summary.currentTask?.title, 'current')
  assert.equal(result.summary.nextTask?.title, 'future')
  assert.equal(result.summary.nextTask?.href, '/admin/cg-calendar')
  assert.equal(result.summary.plannedMinutes, 120, 'after-hours work does not inflate normal workday capacity')
  assert.deepEqual(input, original)
})

test('all elapsed fixed events yield no invented next action', async () => {
  const result = await getMyDayContext(profile, now, data([event('past', '09:00', '10:00')]))
  assert.equal(result.summary.currentTask, null)
  assert.equal(result.summary.nextTask, null)
  assert.equal(result.summary.suggestedNextAction, 'No assigned focus work is due right now.')
})

test('Johannesburg current/next is independent of browser timezone', async () => {
  const previous = process.env.TZ
  try {
    for (const zone of ['Africa/Johannesburg', 'UTC', 'America/Los_Angeles']) {
      process.env.TZ = zone
      const result = await getMyDayContext(profile, now, data([event('past', '09:00', '10:00'), event('current', '16:00', '17:00'), event('future', '20:00', '21:00')]))
      assert.equal(result.today, '2026-10-07')
      assert.equal(result.summary.currentTask?.title, 'current')
      assert.equal(result.summary.nextTask?.title, 'future')
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('completed/cancelled and another named owner do not enter current or NEXT', async () => {
  const result = await getMyDayContext(profile, now, data([
    event('completed', '16:00', '17:00', { status: 'completed' }),
    event('cancelled', '20:00', '21:00', { status: 'cancelled' }),
    event('other-owner', '20:00', '21:00', { assigned_to_name: 'Other Staff' }),
  ]))
  assert.equal(result.summary.currentTask, null)
  assert.equal(result.summary.nextTask, null)
  assert.deepEqual(result.events, [])
})

test('unfinished exact-ID flexible work remains a valid fallback; foreign owner is excluded', async () => {
  const input = data([event('past', '09:00', '10:00')])
  input.tasks = [
    { id: 'own-task', title: 'Own work', status: 'todo', due_date: '2026-10-07', priority: 'normal', data_origin: 'planner_tasks', native_id: 'own-native', assigned_to_user_id: profile.id, assignment_review_state: 'ok' },
    { id: 'other-task', title: 'Other work', status: 'todo', due_date: '2026-10-07', priority: 'urgent', data_origin: 'planner_tasks', assigned_to_user_id: 'other', assignment_review_state: 'ok' },
  ]
  const result = await getMyDayContext(profile, now, input)
  assert.equal(result.summary.nextTask?.id, 'own-task')
  assert.equal(result.summary.nextTask?.nativePlannerId, 'own-native')
  assert.deepEqual(result.tasks.map(item => item.id), ['own-task'])
})

test('workday boundaries preserve the existing before-start preview and after-hours summary', async () => {
  const input = data([event('morning', '09:00', '10:00'), event('evening', '20:00', '21:00')])
  const beforeStart = await getMyDayContext(profile, new Date('2026-10-07T07:59:00+02:00'), input)
  assert.equal(beforeStart.summary.currentTask, null)
  assert.equal(beforeStart.summary.nextTask?.title, 'morning')
  const afterEnd = await getMyDayContext(profile, new Date('2026-10-07T17:00:00+02:00'), input)
  assert.equal(afterEnd.summary.currentTask, null)
  assert.equal(afterEnd.summary.nextTask, null)
  assert.equal(afterEnd.events.length, 2, 'calendar records remain visible, not deleted or rescheduled')
})
