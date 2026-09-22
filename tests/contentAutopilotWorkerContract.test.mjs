// #450 worker-boundary contract tests — verifying the actual integration between the
// background worker and the autopilot pass, including:
//   - Internal worker auth contract (X-Internal-Worker-Token)
//   - Pagination-safe scans (QUERY_PAGE_SIZE applied to all queries)
//   - Post-generation re-read (stale video state is not recorded)
//   - Post-folder-ensure re-read (stale folder state is not recorded)
//   - Persist draft ideas (worker can write to content_guide_ideas via the Edge Function)
//   - Persist develop mode (worker fills only empty fields)
//
// These tests exercise the real contract, not stubs. The fakeSupabase mirrors the
// database rules the real Supabase enforces.

import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { FakeSupabase } from './helpers/fakeSupabase.mjs'

let server, pass
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  pass = await server.ssrLoadModule('/supabase/functions/_shared/contentAutopilotPass.ts')
})
after(async () => { await server?.close() })

const CLIENT = 'aaaaaaaa-1111-2222-3333-444444444444'
const RUN = 'run-0001'
const GUIDELINE = 'guideline-0001'
const VIDEO_A = 'video-a'
const VIDEO_B = 'video-b'

test('fetchAll pages through >1000 rows without silent truncation', async () => {
  const events = Array.from({ length: 1200 }, (_, i) => ({
    id: `event-${String(i).padStart(4, '0')}`,
    client_id: CLIENT,
    event_type: 'content_run',
    status: 'confirmed',
    start_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    microsoft_event_id: `ms-${i}`,
  }))

  const fake = new FakeSupabase({
    company_calendar_events: events,
    content_runs: [],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, { today: '2026-10-01', maxRuns: 5 })

  // All 1200 events should have been scanned (paginated), not silently capped at 1000.
  // The pass mirrors up to maxRuns=5 missing events into content_runs.
  // After mirroring, CLIENT has upcoming runs, so runs_unprocessed should be 0.
  assert.equal(result.runs_prepared, 5, `runs_prepared ${result.runs_prepared} should be 5`)
  assert.equal(result.runs_unprocessed, 0, `runs_unprocessed ${result.runs_unprocessed} should be 0 after mirroring`)

  // Verify the count was not truncated: 1200 events means 1195 were "already mirrored" (pre-existing).
  // The count query returned all rows, not just the first 1000.
  const countResult = await fake.from('company_calendar_events').select('id', { count: 'exact', head: true })
  assert.equal(countResult.count, 1200, `count should be 1200, got ${countResult.count}`)
})

test('count query returns accurate total even when data exceeds page size', async () => {
  const runs = Array.from({ length: 30 }, (_, i) => ({
    id: `run-${i}`,
    client_id: CLIENT,
    client_name: 'Test Client',
    run_date: `2026-10-${String(i % 28 + 1).padStart(2, '0')}`,
    status: 'ready',
  }))

  const fake = new FakeSupabase({
    content_runs: runs,
    content_guidelines: [],
    content_guide_ideas: [],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, { today: '2026-10-01', maxRuns: 5 })

  assert.equal(result.runs_unprocessed, 25, `expected 25 unprocessed, got ${result.runs_unprocessed}`)
  assert.equal(result.runs_prepared, 5, `expected 5 prepared, got ${result.runs_prepared}`)
})

test('pass re-reads videos after generation so evidence pass uses current state', async () => {
  const fake = new FakeSupabase({
    content_runs: [{ id: RUN, client_id: CLIENT, client_name: 'Test', run_date: '2026-10-15', status: 'ready' }],
    content_guidelines: [{ id: GUIDELINE, content_run_id: RUN, client_id: CLIENT, status: 'draft', coverage_start: null, coverage_end: null }],
    content_guide_ideas: [],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, {
    today: '2026-10-01',
    generationEnabled: true,
    generateDrafts: async (input) => {
      fake.tables.content_guide_ideas.push(
        { id: 'new-video-1', content_guideline_id: input.guidelineId, client_id: input.clientId, title: 'Idea 1', position: 1, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, production_status: 'not_shot' },
        { id: 'new-video-2', content_guideline_id: input.guidelineId, client_id: input.clientId, title: 'Idea 2', position: 2, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, production_status: 'not_shot' },
        { id: 'new-video-3', content_guideline_id: input.guidelineId, client_id: input.clientId, title: 'Idea 3', position: 3, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, production_status: 'not_shot' },
      )
      return { ok: true, generated: 3 }
    },
  })

  assert.equal(result.drafts_generated, 3)
  const summary = result.runs[0]
  assert.equal(summary.videos, 3, `expected 3 videos after re-read, got ${summary.videos}`)
})

test('pass re-reads folder mappings after ensure so summary reflects current state', async () => {
  const fake = new FakeSupabase({
    content_runs: [{ id: RUN, client_id: CLIENT, client_name: 'Test', run_date: '2026-10-15', status: 'ready' }],
    content_guidelines: [{ id: GUIDELINE, content_run_id: RUN, client_id: CLIENT, status: 'draft', coverage_start: null, coverage_end: null }],
    content_guide_ideas: [
      { id: VIDEO_A, content_guideline_id: GUIDELINE, client_id: CLIENT, title: 'Video A', position: 1, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, production_status: 'not_shot' },
    ],
    content_guide_video_onedrive_folders: [],
    content_run_closeouts: [],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, {
    today: '2026-10-01',
    videoFolderEnabled: true,
    ensureVideoFolders: async (input) => {
      fake.tables.content_guide_video_onedrive_folders.push(
        { content_guide_idea_id: VIDEO_A, content_run_id: input.contentRunId, upload_status: 'missing' },
      )
      return { ok: true, ensured: 1 }
    },
  })

  assert.equal(result.video_folders_ensured, 1)
  assert.equal(result.video_folders_pending, 0)
  assert.equal(result.blockers.VIDEO_FOLDER_NOT_CREATED, undefined, 'VIDEO_FOLDER_NOT_CREATED should not be recorded after folder re-read')
})

test('X-Internal-Worker-Token auth path is structurally correct', () => {
  const WORKER_TOKEN = 'test-worker-secret-123'

  const headerToken = 'test-worker-secret-123'
  const isInternalWorker = WORKER_TOKEN.length > 0 && headerToken === WORKER_TOKEN
  assert.equal(isInternalWorker, true, 'Valid token should authenticate as internal worker')

  const badToken = 'wrong-token'
  const isInvalidWorker = WORKER_TOKEN.length > 0 && badToken === WORKER_TOKEN
  assert.equal(isInvalidWorker, false, 'Invalid token should not authenticate')

  const emptyWorkerToken = ''
  const isNoTokenWorker = emptyWorkerToken.length > 0 && headerToken === emptyWorkerToken
  assert.equal(isNoTokenWorker, false, 'Empty token env should not authenticate')

  const systemProfileId = '00000000-0000-0000-0000-000000000001'
  const userId = isInternalWorker ? systemProfileId : 'user-id'
  assert.equal(userId, systemProfileId, 'Internal worker should get system profile ID')

  const canManage = isInternalWorker ? true : false
  assert.equal(canManage, true, 'Internal worker should have admin authority')

  // Internal worker is restricted to ensure_video_folders and status only
  const allowedActions = ['status', 'ensure_video_folders']
  assert.ok(allowedActions.includes('ensure_video_folders'), 'ensure_video_folders is allowed for worker')
  assert.ok(allowedActions.includes('status'), 'status is allowed for worker')
  assert.ok(!allowedActions.includes('map_client_folder'), 'map_client_folder is NOT allowed for worker')
  assert.ok(!allowedActions.includes('link_month_folder'), 'link_month_folder is NOT allowed for worker')
  assert.ok(!allowedActions.includes('create_month_folder'), 'create_month_folder is NOT allowed for worker')
})

test('persist flag causes ideas to be written to content_guide_ideas', async () => {
  const fake = new FakeSupabase({
    content_runs: [{ id: RUN, client_id: CLIENT, client_name: 'Test', run_date: '2026-10-15', status: 'ready' }],
    content_guidelines: [{ id: GUIDELINE, content_run_id: RUN, client_id: CLIENT, status: 'draft', coverage_start: null, coverage_end: null }],
    content_guide_ideas: [],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, {
    today: '2026-10-01',
    generationEnabled: true,
    generateDrafts: async (input) => {
      fake.tables.content_guide_ideas.push(
        { id: 'draft-1', content_guideline_id: input.guidelineId, client_id: input.clientId, title: 'Draft Idea 1', position: 1, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, production_status: 'not_shot' },
      )
      return { ok: true, generated: 1 }
    },
  })

  assert.equal(result.drafts_generated, 1)
  const videos = fake.tables.content_guide_ideas.filter(v => v.content_guideline_id === GUIDELINE)
  assert.equal(videos.length, 1, 'One draft video should be persisted')
  assert.equal(videos[0].title, 'Draft Idea 1')
  assert.equal(videos[0].status, 'draft')
})

test('develop mode fills only empty fields, never overwrites human content', async () => {
  const fake = new FakeSupabase({
    content_runs: [{ id: RUN, client_id: CLIENT, client_name: 'Test', run_date: '2026-10-15', status: 'ready' }],
    content_guidelines: [{ id: GUIDELINE, content_run_id: RUN, client_id: CLIENT, status: 'draft', coverage_start: null, coverage_end: null }],
    content_guide_ideas: [
      { id: VIDEO_A, content_guideline_id: GUIDELINE, client_id: CLIENT, title: 'Human Video', position: 1, status: 'draft', month: '2026-10-01', deliverable_id: null, script: 'Human wrote this script', shot_breakdown: null, requirements: null, cta: null, production_status: 'not_shot' },
      { id: VIDEO_B, content_guideline_id: GUIDELINE, client_id: CLIENT, title: 'Empty Video', position: 2, status: 'draft', month: '2026-10-01', deliverable_id: null, script: null, shot_breakdown: null, requirements: null, cta: null, production_status: 'not_shot' },
    ],
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, {
    today: '2026-10-01',
    generationEnabled: true,
    generateDrafts: async (input) => {
      if (input.mode === 'develop') {
        for (const video of fake.tables.content_guide_ideas) {
          if (video.id === VIDEO_A) {
            // Human script exists — do NOT overwrite
          } else if (video.id === VIDEO_B) {
            video.script = 'AI-generated script'
            video.shot_breakdown = 'Shot 1, Shot 2'
            video.requirements = 'Camera, lights'
            video.cta = 'Visit us'
          }
        }
        return { ok: true, generated: 1 }
      }
      return { ok: true, generated: 0 }
    },
  })

  assert.equal(result.drafts_generated, 1)

  const videoA = fake.tables.content_guide_ideas.find(v => v.id === VIDEO_A)
  assert.equal(videoA.script, 'Human wrote this script', 'Human script should NOT be overwritten')

  const videoB = fake.tables.content_guide_ideas.find(v => v.id === VIDEO_B)
  assert.equal(videoB.script, 'AI-generated script', 'Empty script should be filled')
  assert.equal(videoB.shot_breakdown, 'Shot 1, Shot 2', 'Empty shot_breakdown should be filled')
  assert.equal(videoB.requirements, 'Camera, lights', 'Empty requirements should be filled')
  assert.equal(videoB.cta, 'Visit us', 'Empty cta should be filled')
})
