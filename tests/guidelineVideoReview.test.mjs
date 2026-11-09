import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer } from 'vite'
import { shapeGuidelineClientReviews } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'
let server, api
before(async () => { server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } }); api = await server.ssrLoadModule('/src/lib/guidelineReviews.ts') })
after(async () => { await server?.close() })
const id = '60000000-0000-4000-8000-000000000001'
const response = { id, action: 'approved', reviewer_name: 'Client reviewer', message: '', created_at: '2026-11-09T11:00:00Z' }
const data = { published_at: '2026-11-09T10:00:00Z', videos: [{ position: 1, revision: id, decision: 'approved', responses: [response] }, { position: 2, revision: null, decision: 'pending', responses: [] }] }
test('per-video decisions stay separate and public response projection excludes internal fields', () => {
  const result = api.projectGuidelineReviews({ ...data, client_id: 'PRIVATE', videos: [{ ...data.videos[0], responses: [{ ...response, actor_profile_id: 'PRIVATE', raw_url: 'PRIVATE' }] }, data.videos[1]] })
  assert.equal(result.videos[0].decision, 'approved'); assert.equal(result.videos[1].decision, 'pending')
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|actor_profile_id|raw_url|client_id/)
})
test('malformed or contradictory review receipts fail closed', () => {
  for (const patch of [{ position: 0 }, { revision: 'bad' }, { decision: 'posted' }, { revision: null }, { responses: [{ ...response, message: 'x'.repeat(3001) }] }, { responses: [{ ...response, action: 'declined' }] }, { responses: [{ ...response, created_at: 'bad' }] }]) {
    assert.equal(api.projectGuidelineReviews({ ...data, videos: [{ ...data.videos[0], ...patch }] }), null)
  }
  assert.equal(api.projectGuidelineReviews({ ...data, videos: [data.videos[0], data.videos[0]] }), null)
})
test('amendments, declines and comments need useful feedback; approval can have an optional comment', () => {
  assert.equal(api.reviewInputError('Reviewer', '', 'approved'), null)
  for (const action of ['changes_requested', 'declined', 'comment']) {
    assert.ok(api.reviewInputError('Reviewer', '  ', action)); assert.equal(api.reviewInputError('Reviewer', 'Use this wording.', action), null)
  }
  assert.ok(api.reviewInputError('', '', 'approved'))
  assert.ok(api.reviewInputError('x'.repeat(81), '', 'approved'))
})
test('comments preserve text literally, including HTML-like text, for React text rendering', () => {
  const value = { ...response, action: 'comment', message: '<script>alert(1)</script> & exact wording' }
  assert.equal(api.projectGuidelineResponse(value).message, value.message)
})
test('assistant response projection is exact-run bound and distinguishes prior-version evidence', () => {
  const result = shapeGuidelineClientReviews({ content_run_id: 'run', guideline_id: 'guide', responses: [{ ...response, position: 1, title: 'Video', published_at: data.published_at, current_publication: false, matches_current_video: false, share_token: 'PRIVATE' }] }, 'run', 'guide')
  assert.equal(result.state, 'verified'); assert.equal(result.responses[0].current_publication, false)
  assert.match(result.note, /No final-asset/); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|share_token/)
  assert.equal(shapeGuidelineClientReviews({ content_run_id: 'foreign', guideline_id: 'guide', responses: [] }, 'run', 'guide').state, 'unavailable')
  assert.equal(shapeGuidelineClientReviews(null, 'run', 'guide').state, 'unavailable')
})
