import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'test-public-key'

let server
let guidelineScheduleCandidates
let guidelineScriptFromDeliverable
let normalizeGuidelineVideoMonth

const guideline = {
  id: 'guideline-1',
  content_run_id: 'run-1',
  client_id: 'client-1',
  title: 'July guide',
  month: '2026-07-01',
  coverage_start: '2026-07-01',
  coverage_end: '2026-08-01',
  status: 'draft',
  client_published_at: null,
  created_by: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
}

function deliverable(overrides = {}) {
  return {
    id: 'deliverable-1',
    client_id: 'client-1',
    month: '2026-07-01',
    code: 'Video 1',
    instance_number: 1,
    title: 'Product introduction',
    deliverable_type: 'video',
    notes: null,
    microsoft_source_description: null,
    ...overrides,
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ guidelineScheduleCandidates, guidelineScriptFromDeliverable, normalizeGuidelineVideoMonth } = await server.ssrLoadModule('/src/lib/contentWorkflow.ts'))
})

after(async () => { await server.close() })

test('target months are normalized to PostgreSQL date values', () => {
  assert.equal(normalizeGuidelineVideoMonth('2026-08'), '2026-08-01')
  assert.equal(normalizeGuidelineVideoMonth('2026-08-01'), '2026-08-01')
  assert.equal(normalizeGuidelineVideoMonth(null), null)
})

test('schedule candidates are restricted to the guideline client and coverage window', () => {
  const candidates = guidelineScheduleCandidates(guideline, [
    deliverable(),
    deliverable({ id: 'other-client', client_id: 'client-2' }),
    deliverable({ id: 'second-month', month: '2026-08-01', instance_number: 2 }),
    deliverable({ id: 'outside-coverage', month: '2026-09-01', instance_number: 3 }),
    deliverable({ id: 'dp-1', deliverable_type: 'dp' }),
    deliverable({ id: 'reel-1', code: 'Reel 1', deliverable_type: 'reel', instance_number: 4 }),
  ], [])

  assert.deepEqual(candidates.map(candidate => candidate.deliverable.id), ['deliverable-1', 'second-month', 'reel-1'])
})

test('already linked schedule videos are excluded instead of duplicated', () => {
  const candidates = guidelineScheduleCandidates(guideline, [
    deliverable(),
    deliverable({ id: 'deliverable-2', instance_number: 2 }),
  ], [{ deliverable_id: 'deliverable-1' }])

  assert.deepEqual(candidates.map(candidate => candidate.deliverable.id), ['deliverable-2'])
})

test('Teams description is the script source with notes as a safe fallback', () => {
  assert.equal(guidelineScriptFromDeliverable(deliverable({
    microsoft_source_description: '  Teams script  ',
    notes: 'Fallback notes',
  })), 'Teams script')
  assert.equal(guidelineScriptFromDeliverable(deliverable({
    microsoft_source_description: ' ',
    notes: '  Schedule notes  ',
  })), 'Schedule notes')
  assert.equal(guidelineScriptFromDeliverable(deliverable()), '')
})

test('schedule candidates keep deterministic production order', () => {
  const candidates = guidelineScheduleCandidates(guideline, [
    deliverable({ id: 'video-3', code: 'Video 3', instance_number: 3 }),
    deliverable({ id: 'video-1', code: 'Video 1', instance_number: 1 }),
    deliverable({ id: 'video-2', code: 'Video 2', instance_number: 2 }),
  ], [])

  assert.deepEqual(candidates.map(candidate => candidate.deliverable.id), ['video-1', 'video-2', 'video-3'])
})

test('bootstrap is one explicit atomic insert and never mutates Client Schedule', () => {
  const source = readFileSync('src/lib/contentWorkflow.ts', 'utf8')
  const start = source.indexOf('export async function importGuidelineVideosFromSchedule')
  const end = source.indexOf('export async function updateGuidelineVideo', start)
  const implementation = source.slice(start, end)

  assert.match(implementation, /guidelineScheduleCandidates/)
  assert.match(implementation, /\.from\('content_guide_ideas'\)[\s\S]*\.insert\(rows\)/)
  assert.match(implementation, /deliverable_id: deliverable\.id/)
  assert.doesNotMatch(implementation, /from\('monthly_deliverables'\)|update\(|delete\(/)
})
