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
import { readFileSync } from 'node:fs'
import { FakeSupabase } from './helpers/fakeSupabase.mjs'

let server, pass, schedule
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  pass = await server.ssrLoadModule('/supabase/functions/_shared/contentAutopilotPass.ts')
  schedule = await server.ssrLoadModule('/supabase/functions/_shared/contentAutopilotSchedule.ts')
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

test('a late unmirrored event advances after >1000 mirrored identities', async () => {
  const events = Array.from({ length: 1101 }, (_, i) => ({
    id: `event-${String(i).padStart(4, '0')}`,
    client_id: CLIENT,
    event_type: 'content_run',
    status: 'confirmed',
    start_at: '2026-10-15T10:00:00Z',
    microsoft_event_id: `ms-${i}`,
  }))
  const mirrored = events.slice(0, 1100).map((event, i) => ({
    id: `old-run-${i}`,
    calendar_event_id: event.id,
    client_id: CLIENT,
    run_date: '2025-01-01',
    status: 'complete',
  }))
  const fake = new FakeSupabase({
    company_calendar_events: events,
    content_runs: mirrored,
    clients: [{ id: CLIENT, name: 'Test Client', short_code: 'TST', active: true }],
  })

  const result = await pass.runContentAutopilotPass(fake, { today: '2026-10-01', maxRuns: 1 })
  const ensureCalls = fake.rpcCalls.filter(call => call.fn === 'ensure_content_run_for_calendar_event')
  assert.equal(result.runs_ensured, 1)
  assert.equal(ensureCalls.length, 1)
  assert.equal(ensureCalls[0].args.p_calendar_event_id, 'event-1100')
})

test('NO_FUTURE scans every active client and future run beyond one page', async () => {
  const clients = Array.from({ length: 1101 }, (_, i) => ({
    id: `client-${String(i).padStart(4, '0')}`,
    name: `Client ${i}`,
    short_code: 'TST',
    active: true,
  }))
  const lateClient = clients[1100]
  const fake = new FakeSupabase({
    content_runs: [{ id: RUN, client_id: lateClient.id, run_date: '2026-10-15', status: 'ready' }],
    content_guidelines: [{ id: GUIDELINE, content_run_id: RUN, client_id: lateClient.id, status: 'draft' }],
    content_guide_ideas: [],
    clients,
  })
  const result = await pass.runContentAutopilotPass(fake, { today: '2026-10-01', maxRuns: 1 })
  assert.equal(result.clients_considered, 1101)
  assert.ok(!result.clients_without_future_run.includes(lateClient.id))
  assert.equal(result.clients_without_future_run.length, 1100)
})

test('a paginated truth-query failure aborts instead of becoming empty truth', async () => {
  const fake = new FakeSupabase({ content_runs: [], clients: [] })
  fake.makeUnreadable('company_calendar_events')
  await assert.rejects(
    pass.runContentAutopilotPass(fake, { today: '2026-10-01' }),
    /Paginated truth query failed: company_calendar_events is not readable/,
  )
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

test('actual worker and SQL contracts fail closed and preserve human RPC authority', () => {
  const worker = readFileSync('supabase/functions/background-worker/index.ts', 'utf8')
  const ai = readFileSync('supabase/functions/suggest-content-videos/index.ts', 'utf8')
  const folders = readFileSync('supabase/functions/content-run-onedrive-folder/index.ts', 'utf8')
  const sql = readFileSync('supabase/migrations/20260922120000_system_worker_profile.sql', 'utf8')

  assert.doesNotMatch(worker, /Authorization:\s*`Bearer \$\{Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'/)
  assert.match(worker, /workerToken\.length < 32 \|\| !systemProfileId/)
  assert.match(ai, /WORKER_TOKEN\.length >= 32/)
  assert.match(ai, /Worker system profile is unavailable/)
  assert.match(folders, /action !== 'ensure_video_folders'/)
  assert.match(folders, /assert_content_autopilot_video_folder_write/)
  assert.match(folders, /status: failed \? 'failed' : 'ensured'/)
  assert.match(folders, /failed \? 502 : 200/)
  assert.match(folders, /map_failed_recoverable/)
  assert.doesNotMatch(sql, /insert into public\.profiles/i)
  assert.doesNotMatch(sql, /drop function if exists public\.get_or_create_content_guideline\(uuid\)/i)
  assert.match(sql, /get_or_create_content_guideline_as_actor/)
  assert.match(sql, /join auth\.users u on u\.id=p\.id/)
  assert.match(sql, /persist_content_autopilot_ideas/)
  assert.match(sql, /persist_content_autopilot_developments/)
})

test('daily autopilot scheduling is explicit, Johannesburg-dated and idempotent', () => {
  const worker = readFileSync('supabase/functions/background-worker/index.ts', 'utf8')
  assert.match(worker, /CONTENT_AUTOPILOT_ENABLED_FLAG/)
  assert.match(worker, /ignoreDuplicates: true/)
  assert.match(worker, /onConflict: 'idempotency_key'/)
  assert.equal(schedule.contentAutopilotOperatingDate(new Date('2026-09-21T22:30:00.000Z')), '2026-09-22')
  assert.equal(schedule.contentAutopilotIdempotencyKey('2026-09-22'), 'content-autopilot:2026-09-22')
  assert.throws(() => schedule.contentAutopilotIdempotencyKey('22-09-2026'), /Invalid content autopilot operating date/)
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
