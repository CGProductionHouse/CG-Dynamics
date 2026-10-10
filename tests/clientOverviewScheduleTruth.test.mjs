import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, summarizeClientOverviewSchedule
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ summarizeClientOverviewSchedule } = await server.ssrLoadModule('/src/lib/clientOverviewSchedule.ts'))
})
after(async () => { await server?.close() })

const month = { month: '2026-10', posts: [], events: [], loadFailed: false }
const datedPost = { id: 'dated', date: '2026-10-09', title: 'Dated post', type: 'photo', status: 'scheduled' }
const undatedPost = { ...datedPost, id: 'undated', date: null }
const event = { id: 'event', startAt: '2026-10-10T10:00:00+02:00', endAt: null, allDay: false, title: 'Shoot', type: 'shoot', location: null, guidelineKey: null }
const now = new Date('2026-10-08T10:00:00+02:00')

test('only dated posts and client-visible events count as scheduled', () => {
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [datedPost, undatedPost], events: [event] }, now), {
    scheduledCount: 2,
    unscheduledCount: 1,
    state: 'scheduled',
  })
})

test('undated work is planning, not an empty month or a scheduled item', () => {
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [undatedPost] }, now), {
    scheduledCount: 0,
    unscheduledCount: 1,
    state: 'planning',
  })
})

test('past-dated posts and elapsed events never appear as coming up', () => {
  const past = new Date('2026-10-10T14:00:00+02:00')
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [datedPost], events: [event] }, past), {
    scheduledCount: 0,
    unscheduledCount: 0,
    state: 'empty',
  })
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [datedPost, undatedPost], events: [event] }, past), {
    scheduledCount: 0,
    unscheduledCount: 1,
    state: 'planning',
  })
})

test('completed posts are not upcoming, and an all-day event remains upcoming through its day', () => {
  const midday = new Date('2026-10-10T14:00:00+02:00')
  const allDay = { ...event, allDay: true, startAt: '2026-10-10T00:00:00+02:00' }
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [{ ...datedPost, date: '2026-10-11', status: 'posted' }], events: [allDay] }, midday), {
    scheduledCount: 1,
    unscheduledCount: 0,
    state: 'scheduled',
  })
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [{ ...undatedPost, status: 'posted' }], events: [{ ...allDay, startAt: '2026-10-09T00:00:00+02:00', endAt: '2026-10-11T00:00:00+02:00' }] }, midday), {
    scheduledCount: 1,
    unscheduledCount: 0,
    state: 'scheduled',
  })
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [], events: [{ ...allDay, startAt: '2026-10-09T00:00:00+02:00', endAt: '2026-10-10T00:00:00+02:00' }] }, midday), {
    scheduledCount: 0,
    unscheduledCount: 0,
    state: 'empty',
  })
})

test('verified empty and failed/missing reads remain distinct', () => {
  assert.deepEqual(summarizeClientOverviewSchedule(month), { scheduledCount: 0, unscheduledCount: 0, state: 'empty' })
  assert.deepEqual(summarizeClientOverviewSchedule({ ...month, posts: [datedPost], loadFailed: true }), {
    scheduledCount: 0,
    unscheduledCount: 0,
    state: 'unavailable',
  })
  assert.deepEqual(summarizeClientOverviewSchedule(null), { scheduledCount: 0, unscheduledCount: 0, state: 'unavailable' })
})

test('client Overview highlights real planning or dated work without empty/unavailable noise', () => {
  const home = readFileSync('src/pages/client/ClientPortalHome.tsx', 'utf8')
  assert.match(home, /summarizeClientOverviewSchedule/)
  assert.match(home, /data\.schedule\.state === 'scheduled' \|\| data\.schedule\.state === 'planning'/)
  assert.match(home, /Plan in progress/)
  assert.doesNotMatch(home, /No items scheduled|A clear canvas|Schedule temporarily unavailable/)
  assert.match(home, /hasDirectionHighlight && <article/)
  assert.doesNotMatch(home, /direction will appear once its strategy is reviewed/)
})
