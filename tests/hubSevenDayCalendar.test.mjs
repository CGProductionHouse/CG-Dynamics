import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let buildHubSevenDayCalendar

function event(id, startAt, overrides = {}) {
  return {
    id,
    title: id,
    event_type: 'meeting',
    client_id: null,
    client_name: null,
    start_at: startAt,
    end_at: null,
    all_day: false,
    location: null,
    notes: null,
    assigned_to_name: null,
    status: 'planned',
    linked_deliverable_id: null,
    linked_task_id: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ buildHubSevenDayCalendar } = await server.ssrLoadModule('/src/lib/hubCalendar.ts'))
})

after(async () => { await server.close() })

test('today and the next six dates produce seven chronological groups', () => {
  const groups = buildHubSevenDayCalendar([], '2026-07-22')
  assert.deepEqual(groups.map(group => group.date), [
    '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28',
  ])
  assert.equal(groups[0].isToday, true)
  assert.ok(groups.slice(1).every(group => !group.isToday))
})

test('events are assigned using the Johannesburg business date', () => {
  const groups = buildHubSevenDayCalendar([
    event('late-local', '2026-07-21T22:30:00Z'),
  ], '2026-07-22')
  assert.deepEqual(groups[0].events.map(item => item.id), ['late-local'])
})

test('cancelled events are excluded', () => {
  const groups = buildHubSevenDayCalendar([
    event('cancelled', '2026-07-22T08:00:00Z', { status: 'cancelled' }),
  ], '2026-07-22')
  assert.ok(groups.every(group => group.events.length === 0))
})

test('events outside the seven-day range are excluded', () => {
  const groups = buildHubSevenDayCalendar([
    event('before', '2026-07-21T08:00:00Z'),
    event('after', '2026-07-29T08:00:00Z'),
  ], '2026-07-22')
  assert.ok(groups.every(group => group.events.length === 0))
})

test('events inside each day are sorted chronologically', () => {
  const groups = buildHubSevenDayCalendar([
    event('afternoon', '2026-07-22T13:00:00Z'),
    event('morning', '2026-07-22T06:00:00Z'),
    event('midday', '2026-07-22T10:00:00Z'),
  ], '2026-07-22')
  assert.deepEqual(groups[0].events.map(item => item.id), ['morning', 'midday', 'afternoon'])
})

test('empty days remain present', () => {
  const groups = buildHubSevenDayCalendar([
    event('one-event', '2026-07-24T08:00:00Z'),
  ], '2026-07-22')
  assert.equal(groups.length, 7)
  assert.equal(groups.filter(group => group.events.length === 0).length, 6)
})

test('future events cannot fall back into an empty today group', () => {
  const groups = buildHubSevenDayCalendar([
    event('tomorrow', '2026-07-23T08:00:00Z'),
  ], '2026-07-22')
  assert.deepEqual(groups[0].events, [])
  assert.deepEqual(groups[1].events.map(item => item.id), ['tomorrow'])
})
