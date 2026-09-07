import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// #220 content operations dashboard — pure classifier (no DB).
let server, ops
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ops = await server.ssrLoadModule('/src/lib/contentOps.ts')
})
after(async () => { await server?.close() })

const d = (over = {}) => ({
  id: 'd1', title: 'Poster', deliverable_type: 'design', production_status: 'in_progress',
  assigned_to_name: 'Franco', scheduled_date: '2026-09-20', client_name: 'Red Oak', ...over,
})
const TODAY = '2026-09-10'

test('production_status maps to the right operational bucket', () => {
  const rows = [
    d({ id: 'a', production_status: 'ready_internal_review' }),
    d({ id: 'b', production_status: 'waiting_client' }),
    d({ id: 'c', production_status: 'approved' }),
    d({ id: 'e', production_status: 'scheduled' }),
    d({ id: 'f', production_status: 'posted' }),
    d({ id: 'g', production_status: 'internal_changes' }),
  ]
  const s = ops.classifyContentOps(rows, new Set(), new Map(), TODAY)
  assert.equal(s.buckets.awaiting_internal[0].id, 'a')
  assert.equal(s.buckets.awaiting_client[0].id, 'b')
  assert.equal(s.buckets.ready_to_schedule[0].id, 'c')
  assert.equal(s.buckets.scheduled[0].id, 'e')
  assert.equal(s.buckets.posted[0].id, 'f')
  assert.equal(s.buckets.changes[0].id, 'g')
})

test('a future-dated item not yet in the flow is a future draft', () => {
  const s = ops.classifyContentOps([d({ production_status: 'in_progress', scheduled_date: '2026-12-01' })], new Set(), new Map(), TODAY)
  assert.equal(s.buckets.future_draft.length, 1)
  assert.equal(s.buckets.in_progress.length, 0)
})

test('overdue only when the date has passed and it is not scheduled/posted', () => {
  const past = ops.classifyContentOps([d({ scheduled_date: '2026-09-01', production_status: 'in_progress' })], new Set(), new Map(), TODAY)
  assert.equal(past.risks.overdue.length, 1)
  const posted = ops.classifyContentOps([d({ scheduled_date: '2026-09-01', production_status: 'posted' })], new Set(), new Map(), TODAY)
  assert.equal(posted.risks.overdue.length, 0)
  const scheduled = ops.classifyContentOps([d({ scheduled_date: '2026-09-01', production_status: 'scheduled' })], new Set(), new Map(), TODAY)
  assert.equal(scheduled.risks.overdue.length, 0)
})

test('missing creative link flags posters without a Canva link, never videos', () => {
  const poster = ops.classifyContentOps([d({ id: 'p', deliverable_type: 'design' })], new Set(), new Map(), TODAY)
  assert.equal(poster.risks.missingCreativeLink.length, 1)
  const linked = ops.classifyContentOps([d({ id: 'p', deliverable_type: 'design' })], new Set(['p']), new Map(), TODAY)
  assert.equal(linked.risks.missingCreativeLink.length, 0)
  const video = ops.classifyContentOps([d({ id: 'v', deliverable_type: 'video' })], new Set(), new Map(), TODAY)
  assert.equal(video.risks.missingCreativeLink.length, 0, 'video creative link is its guideline video, tracked elsewhere')
})

test('missing schedule date is flagged unless already scheduled/posted', () => {
  const s = ops.classifyContentOps([d({ scheduled_date: null, production_status: 'in_progress' })], new Set(), new Map(), TODAY)
  assert.equal(s.risks.missingSchedule.length, 1)
})

test('channels come from the current review version', () => {
  const reviews = new Map([['d1', { channels: ['facebook', 'instagram'] }]])
  const s = ops.classifyContentOps([d()], new Set(), reviews, TODAY)
  assert.deepEqual(s.items[0].channels, ['facebook', 'instagram'])
  assert.equal(s.items[0].hasCurrentReview, true)
})
