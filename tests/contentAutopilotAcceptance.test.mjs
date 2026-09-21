// #450 Phase 9 — the Econofoods failure class, as a deterministic acceptance fixture.
//
// The 23 Sep 2026 run exposed: an Outlook event with no Dynamics Content Run mirror, a
// guideline that had to be created through a backend fallback, no governed OneDrive
// mapping, an unresolved client short code, and no trustworthy raw/edit state.
//
// No production ID is hard-coded and no Econofoods-specific behaviour exists in the
// code: this fixture is one ordinary client walked through the whole chain.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { FakeSupabase } from './helpers/fakeSupabase.mjs'

let server, ap, pass
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ap = await server.ssrLoadModule('/src/lib/contentAutopilot.ts')
  pass = await server.ssrLoadModule('/supabase/functions/_shared/contentAutopilotPass.ts')
})
after(async () => { await server?.close() })

const CLIENT = '2f1c6f0a-5a6d-4f2e-9c11-8a0c2d3e4f55'
const RUN = 'b7e1c0d2-3f4a-4b5c-9d6e-7f8a9b0c1d2e'
const GUIDELINE = 'c8f2d1e3-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const VIDEO_A = '11111111-2222-4333-8444-555555555555'
const VIDEO_B = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const OTHER_CLIENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const EVENT = '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f'
const TODAY = '2026-09-21'
const RUN_DATE = '2026-09-23'

const video = (id, overrides = {}) => ({
  id, position: id === VIDEO_A ? 1 : 2, title: id === VIDEO_A ? 'Deli counter in 30 seconds' : 'Weekend braai basket',
  month: '2026-09-01', deliverable_id: null, script: null, shot_breakdown: null, requirements: null, cta: null,
  production_status: 'not_shot', ...overrides,
})

const runRow = { id: RUN, client_id: CLIENT, client_name: 'Econofoods', run_date: RUN_DATE }

/** The state the day before the shoot, with nothing configured yet. */
function bareRun(overrides = {}) {
  return ap.buildRunReadiness({
    run: runRow,
    guideline: { id: GUIDELINE, status: 'draft' },
    videos: [video(VIDEO_A), video(VIDEO_B)],
    shortCode: null,
    runFolder: null,
    clientContextReady: true,
    aiProviderAvailable: true,
    scheduleMonths: ['2026-09-04'],
    deliverableMonths: ['2026-09-01'],
    ...overrides,
  })
}

test('an Outlook content-run event with exact client identity produces one run mirror and one guideline', () => {
  // The mirror itself is the existing trigger's job; what #450 adds is that the run is
  // never without its ONE canonical guideline, and a missing one is a named blocker.
  const missing = ap.buildRunReadiness({ run: runRow, guideline: null, videos: [], shortCode: 'ECONO', runFolder: null })
  assert.ok(missing.blockers.includes('NO_GUIDELINE'))
  const ensured = bareRun()
  assert.equal(ensured.guidelineId, GUIDELINE)
  assert.equal(ensured.guidelineStatus, 'draft')
  assert.ok(!ensured.blockers.includes('NO_GUIDELINE'))
})

test('draft videos exist even though September slots are unresolved', () => {
  const readiness = bareRun()
  assert.equal(readiness.plannedVideos, 2)
  assert.equal(readiness.linkedVideos, 0)
  assert.equal(readiness.unallocatedVideos, 2, 'unallocated is a truthful state, not a failure')
  assert.deepEqual(readiness.preparation.developVideoIds, [VIDEO_A, VIDEO_B])
  assert.equal(readiness.preparation.blocked, null)
})

test('the run covers future months without one run being forced to equal one month', () => {
  const readiness = bareRun()
  assert.deepEqual(readiness.coverageMonths, ['2026-09-01', '2026-10-01', '2026-11-01'])
  assert.equal(readiness.preparation.coverage.basis, 'planned', 'only September is really scheduled')
})

test('a same-client deliverable links only with exact provenance', () => {
  const linked = bareRun({ videos: [video(VIDEO_A, { deliverable_id: 'd-1' }), video(VIDEO_B)] })
  assert.equal(linked.linkedVideos, 1)
  assert.equal(linked.unallocatedVideos, 1)
  assert.deepEqual(linked.preparation.unallocatedVideoIds, [VIDEO_B])
})

test('a missing short code blocks folder creation instead of guessing from the client name', () => {
  const readiness = bareRun()
  assert.ok(readiness.blockers.includes('BLOCKED_MISSING_SHORT_CODE'))
  for (const entry of readiness.videos) {
    assert.equal(entry.folder.folderName, null, 'nothing is named while the code is unknown')
    assert.equal(entry.readiness.readiness, 'BLOCKED_NO_MAPPING')
    assert.match(entry.readiness.nextAction, /short code/i)
  }
  // "Econofoods" must never become ECONOFOODS/ECONO by inference.
  assert.doesNotMatch(JSON.stringify(readiness), /ECONO/)
})

test('a missing OneDrive run mapping reports UNVERIFIED, never a false missing or success', () => {
  const readiness = bareRun({ shortCode: 'ECONO', closeoutUploadStatus: 'verified' })
  assert.ok(readiness.blockers.includes('BLOCKED_MISSING_ONEDRIVE_MAPPING'))
  assert.equal(readiness.rawCounts.UNVERIFIED, 2)
  assert.equal(readiness.rawCounts.MISSING, 0, 'an unmapped run is never reported as missing footage')
  assert.equal(readiness.rawCounts.VERIFIED, 0, 'a run-level closeout cannot verify an unmapped video')
})

test('with the exact short code and mapping supplied, canonical per-video names are produced', () => {
  const readiness = bareRun({
    shortCode: 'ECONO',
    runFolder: { driveId: 'drive-x', monthFolderItemId: 'item-month', clientFolderName: 'Econofoods' },
  })
  assert.deepEqual(readiness.videos.map(entry => entry.folder.folderName), ['2026_09_ECONO_VIDEO_01', '2026_09_ECONO_VIDEO_02'])
  assert.equal(readiness.videos[0].folder.path, 'Clients / Econofoods / Videos / 2026 / 2026_09_SEP / 2026_09_ECONO_VIDEO_01')
  assert.equal(readiness.videos[0].name, 'Video 01 - Deli counter in 30 seconds')
  assert.ok(!readiness.blockers.includes('BLOCKED_MISSING_SHORT_CODE'))
})

test('verified raw footage in the exact mapped folder drives READY_TO_EDIT', () => {
  const mapped = {
    shortCode: 'ECONO',
    runFolder: { driveId: 'drive-x', monthFolderItemId: 'item-month', clientFolderName: 'Econofoods' },
    videoFolders: {
      [VIDEO_A]: { driveId: 'drive-x', itemId: 'item-a', folderName: '2026_09_ECONO_VIDEO_01' },
      [VIDEO_B]: { driveId: 'drive-x', itemId: 'item-b', folderName: '2026_09_ECONO_VIDEO_02' },
    },
  }
  const unchecked = bareRun(mapped)
  assert.equal(unchecked.readinessCounts.RAW_UNVERIFIED, 2, 'mapped but unchecked is unknown, not ready')

  const verified = bareRun({ ...mapped, videoUploadStatuses: { [VIDEO_A]: 'verified', [VIDEO_B]: 'partial' } })
  assert.equal(verified.readinessCounts.READY_TO_EDIT, 1)
  assert.equal(verified.readinessCounts.RAW_PARTIAL, 1)
  assert.match(verified.videos[1].readiness.nextAction, /remaining raw footage/i)

  const missing = bareRun({ ...mapped, videoUploadStatuses: { [VIDEO_A]: 'missing', [VIDEO_B]: 'missing' } })
  assert.equal(missing.readinessCounts.BLOCKED_RAW_MISSING, 2)
  assert.ok(missing.blockers.includes('RAW_MISSING'))
})

test('the client-facing final output stays inside the portal authority', () => {
  const mapped = {
    shortCode: 'ECONO',
    runFolder: { driveId: 'drive-x', monthFolderItemId: 'item-month', clientFolderName: 'Econofoods' },
    portalVideoCategory: { driveId: 'drive-x', folderItemId: 'portal-video' },
    portalAssets: { [VIDEO_A]: { driveId: 'drive-x', itemId: 'asset-a', active: true } },
  }
  const readiness = bareRun(mapped)
  assert.equal(readiness.videos[0].finalOutput.state, 'published')
  assert.equal(readiness.videos[1].finalOutput.state, 'not_published')
  assert.equal(readiness.videos[0].readiness.readiness, 'FINAL_READY')
  // The internal production folder never appears in the client-facing resolution.
  assert.equal(readiness.videos[0].finalOutput.itemId, 'asset-a')
})

test('a client with only a past run is reported, never given an invented shoot date', () => {
  const past = ap.buildRunReadiness({ ...{ run: { ...runRow, run_date: '2026-08-12' }, guideline: { id: GUIDELINE, status: 'draft' }, videos: [], shortCode: 'ECONO', runFolder: null } })
  const client = ap.buildClientReadiness({ id: CLIENT, name: 'Econofoods' }, [past], TODAY)
  assert.deepEqual(client.runs, [])
  assert.ok(client.blockers.includes('NO_FUTURE_CONTENT_RUN'))
})

test('the autopilot pass cannot express a destructive or schedule-writing operation', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile('supabase/functions/_shared/contentAutopilotPass.ts', 'utf8')
  const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // monthly_deliverables is READ to find link candidates, and never written.
  const scheduleUses = code.match(/from\('monthly_deliverables'\)[\s\S]{0,200}/g) ?? []
  assert.equal(scheduleUses.length, 1)
  assert.match(scheduleUses[0], /\.select\(/)
  assert.doesNotMatch(code, /from\('monthly_deliverables'\)[\s\S]{0,200}\.(insert|update|delete|upsert)\(/)
  assert.doesNotMatch(code, /\.delete\(|rename|conflictBehavior/i, 'no file operation exists here')
  assert.doesNotMatch(code, /set_content_guideline_publication|client_published_at/, 'nothing is published')
  // A run is only ever created through the exact-identity RPC, never by an insert here.
  assert.doesNotMatch(code, /from\('content_runs'\)[\s\S]{0,120}\.insert/)
  assert.match(code, /ensure_content_run_for_calendar_event/)
  const inserts = code.match(/\.insert\(/g) ?? []
  assert.equal(inserts.length, 1)
  assert.match(code, /from\('content_autopilot_runs'\)\s*\.insert/)
  assert.equal(pass.MAX_RUNS_PER_PASS, 25, 'one pass is bounded')
})

// ── The failure class, EXECUTED end to end ──────────────────────────────────
//
// These drive the real runContentAutopilotPass() against an in-memory database whose
// RPCs mirror the SQL rules. Nothing is asserted by reading source text.

function econofoodsWorld(overrides = {}) {
  return new FakeSupabase({
    clients: [
      { id: CLIENT, name: 'Econofoods', short_code: null, active: true },
      { id: OTHER_CLIENT, name: 'Another client', short_code: 'OTHR', active: true },
    ],
    company_calendar_events: [
      {
        id: EVENT, event_type: 'content_run', status: 'confirmed', client_id: CLIENT,
        client_name: 'Econofoods', title: 'Econofoods content run', microsoft_event_id: 'AAMk-exact',
        microsoft_calendar_id: 'cal-1', start_at: `${RUN_DATE}T07:00:00Z`, location: 'Store', assigned_to_name: 'CA',
      },
      // An ordinary meeting for the same client, on the same day, with a similar title.
      {
        id: 'event-meeting', event_type: 'meeting', status: 'confirmed', client_id: CLIENT,
        client_name: 'Econofoods', title: 'Econofoods content run catch-up', microsoft_event_id: 'AAMk-meeting',
        microsoft_calendar_id: 'cal-1', start_at: `${RUN_DATE}T12:00:00Z`,
      },
    ],
    content_runs: [],
    content_guidelines: [],
    content_guide_ideas: [],
    monthly_deliverables: [],
    content_run_closeouts: [],
    content_guide_video_onedrive_folders: [],
    content_autopilot_runs: [],
    ...overrides,
  })
}

test('EXECUTED: an exact Microsoft content-run event creates its run and its one guideline', async () => {
  const db = econofoodsWorld()
  const result = await pass.runContentAutopilotPass(db, { today: TODAY })

  assert.equal(result.runs_ensured, 1, 'exactly one run was ensured')
  assert.equal(db.tables.content_runs.length, 1)
  assert.equal(db.tables.content_runs[0].calendar_event_id, EVENT, 'identity is the durable calendar event row')
  assert.equal(db.tables.content_runs[0].client_id, CLIENT)
  assert.equal(db.tables.content_guidelines.length, 1, 'the run immediately has its ONE canonical guideline')
  assert.equal(db.tables.content_guidelines[0].content_run_id, db.tables.content_runs[0].id)
  assert.equal(result.runs_prepared, 1)

  // The similarly-titled ordinary meeting never became a run.
  assert.ok(!db.tables.content_runs.some(run => run.calendar_event_id === 'event-meeting'))
})

test('EXECUTED: running the pass twice creates nothing the second time', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  const before = JSON.stringify({ runs: db.tables.content_runs, guidelines: db.tables.content_guidelines })
  const second = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.equal(second.runs_ensured, 0)
  assert.equal(second.guidelines_created, 0)
  assert.equal(JSON.stringify({ runs: db.tables.content_runs, guidelines: db.tables.content_guidelines }), before)
})

test('EXECUTED: a cancelled event, an unresolved client and a meeting never become runs', async () => {
  const db = econofoodsWorld({
    company_calendar_events: [
      { id: 'e-cancelled', event_type: 'content_run', status: 'cancelled', client_id: CLIENT, title: 'Cancelled shoot', microsoft_event_id: 'm1', start_at: `${RUN_DATE}T07:00:00Z` },
      { id: 'e-noclient', event_type: 'content_run', status: 'confirmed', client_id: null, title: 'Unknown client shoot', microsoft_event_id: 'm2', start_at: `${RUN_DATE}T08:00:00Z` },
      { id: 'e-meeting', event_type: 'meeting', status: 'confirmed', client_id: CLIENT, title: 'Shoot planning', microsoft_event_id: 'm3', start_at: `${RUN_DATE}T09:00:00Z` },
    ],
  })
  const result = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.equal(result.runs_ensured, 0)
  assert.equal(db.tables.content_runs.length, 0, 'no run was invented')
  assert.equal(result.clients_without_future_run.length, 2, 'both active clients truthfully have no future run')
})

test('EXECUTED: an unambiguous same-client slot is linked; an ambiguous or foreign one is not', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  const guideline = db.tables.content_guidelines[0]
  db.tables.content_guide_ideas.push(
    { id: VIDEO_A, content_guideline_id: guideline.id, client_id: CLIENT, title: 'Deli counter', month: '2026-09-01', position: 1, script: null, deliverable_id: null, production_status: 'not_shot', status: 'idea' },
    { id: VIDEO_B, content_guideline_id: guideline.id, client_id: CLIENT, title: 'Weekend braai', month: '2026-10-01', position: 2, script: null, deliverable_id: null, production_status: 'not_shot', status: 'idea' },
  )
  db.tables.monthly_deliverables.push(
    { id: 'slot-sep', client_id: CLIENT, month: '2026-09-01', deliverable_type: 'video' },
    // October is ambiguous: two free slots, so a human decides.
    { id: 'slot-oct-1', client_id: CLIENT, month: '2026-10-01', deliverable_type: 'video' },
    { id: 'slot-oct-2', client_id: CLIENT, month: '2026-10-01', deliverable_type: 'reel' },
    // Another client's September slot must never be reachable.
    { id: 'slot-foreign', client_id: OTHER_CLIENT, month: '2026-09-01', deliverable_type: 'video' },
  )

  const result = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.equal(result.videos_linked, 1)
  assert.equal(db.tables.content_guide_ideas.find(v => v.id === VIDEO_A).deliverable_id, 'slot-sep')
  assert.equal(db.tables.content_guide_ideas.find(v => v.id === VIDEO_B).deliverable_id, null, 'ambiguity is left to a human')
  assert.equal(result.blockers.SCHEDULE_LINK_AMBIGUOUS, 1)
  // The Client Schedule itself was never written.
  assert.ok(!db.writes.some(write => write.table === 'monthly_deliverables'))
})

test('EXECUTED: a link a human already set is never moved', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  const guideline = db.tables.content_guidelines[0]
  db.tables.content_guide_ideas.push(
    { id: VIDEO_A, content_guideline_id: guideline.id, client_id: CLIENT, title: 'Deli counter', month: '2026-09-01', position: 1, script: null, deliverable_id: 'slot-human', production_status: 'not_shot', status: 'idea' },
  )
  db.tables.monthly_deliverables.push(
    { id: 'slot-human', client_id: CLIENT, month: '2026-09-01', deliverable_type: 'video' },
    { id: 'slot-other', client_id: CLIENT, month: '2026-09-01', deliverable_type: 'reel' },
  )
  const result = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.equal(result.videos_linked, 0)
  assert.equal(db.tables.content_guide_ideas[0].deliverable_id, 'slot-human')
})

test('EXECUTED: draft generation is latent — off by default, executable when enabled', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  const guideline = db.tables.content_guidelines[0]
  db.tables.content_guide_ideas.push(
    { id: VIDEO_A, content_guideline_id: guideline.id, client_id: CLIENT, title: 'Deli counter', month: '2026-09-01', position: 1, script: null, deliverable_id: null, production_status: 'not_shot', status: 'idea' },
  )
  const calls = []
  const generateDrafts = async input => { calls.push(input); return { ok: true, generated: 1 } }

  const off = await pass.runContentAutopilotPass(db, { today: TODAY, generateDrafts })
  assert.equal(calls.length, 0, 'nothing is generated until CA switches it on')
  assert.equal(off.generation_enabled, false)
  assert.equal(off.blockers.GENERATION_NOT_ENABLED, 1)

  const on = await pass.runContentAutopilotPass(db, { today: TODAY, generateDrafts, generationEnabled: true })
  assert.equal(calls.length, 1, 'the path really executes once enabled')
  assert.equal(calls[0].clientId, CLIENT)
  assert.deepEqual(calls[0].videoIds, [VIDEO_A])
  assert.equal(on.drafts_generated, 1)

  // An approved guideline is never regenerated, enabled or not.
  guideline.status = 'ready'
  const approved = await pass.runContentAutopilotPass(db, { today: TODAY, generateDrafts, generationEnabled: true })
  assert.equal(calls.length, 1)
  assert.equal(approved.blockers.GUIDELINE_APPROVED, 1)
})

test('EXECUTED: a client whose run is outside this pass is never called NO_FUTURE_CONTENT_RUN', async () => {
  const db = econofoodsWorld()
  db.tables.content_runs.push(
    { id: 'run-other', calendar_event_id: 'event-other', client_id: OTHER_CLIENT, client_name: 'Another client', run_date: '2026-09-25', status: 'planning' },
  )
  // Only one run may be processed this pass; the other client's real run is beyond it.
  const result = await pass.runContentAutopilotPass(db, { today: TODAY, maxRuns: 1 })
  assert.equal(result.runs_unprocessed, 1)
  assert.deepEqual(result.clients_without_future_run, [], 'a client with a real upcoming run is never misclassified')
  assert.equal(result.blockers.NO_FUTURE_CONTENT_RUN, undefined)
  assert.equal(result.blockers.RUNS_UNPROCESSED_THIS_PASS, 1)
})

test('EXECUTED: a failed preparation is reported as failed, not as "no future run"', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  db.makeUnreadable('content_guide_ideas')
  const result = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.deepEqual(result.clients_preparation_failed, [CLIENT])
  assert.equal(result.clients_without_future_run.includes(CLIENT), false)
  assert.equal(result.blockers.PREPARATION_FAILED, 1)
})

test('EXECUTED: unreadable folder evidence is UNVERIFIED, never missing', async () => {
  const db = econofoodsWorld()
  await pass.runContentAutopilotPass(db, { today: TODAY })
  const guideline = db.tables.content_guidelines[0]
  db.tables.content_guide_ideas.push(
    { id: VIDEO_A, content_guideline_id: guideline.id, client_id: CLIENT, title: 'Deli counter', month: '2026-09-01', position: 1, script: 'Written.', deliverable_id: null, production_status: 'shot', status: 'idea' },
  )
  db.tables.content_run_closeouts.push({ content_run_id: db.tables.content_runs[0].id, upload_status: 'verified' })
  db.makeUnreadable('content_guide_video_onedrive_folders')
  const result = await pass.runContentAutopilotPass(db, { today: TODAY })
  assert.equal(result.ready_to_edit, 0, 'a run-level closeout cannot verify an unreadable per-video folder')
  assert.equal(result.blockers.RAW_UNVERIFIED, 1)
  assert.equal(result.runs[0].production_folder_state_readable, false)
})
