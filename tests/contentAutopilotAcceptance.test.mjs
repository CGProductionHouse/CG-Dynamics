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

test('the autopilot pass never creates a run, writes the schedule or moves a file', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile('supabase/functions/_shared/contentAutopilotPass.ts', 'utf8')
  const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /from\('content_runs'\)[\s\S]{0,80}\.insert/, 'a Content Run is never created')
  assert.doesNotMatch(code, /monthly_deliverables/, 'the Client Schedule is never touched')
  assert.doesNotMatch(code, /\.delete\(|rename|conflictBehavior/i, 'no file operation exists here')
  assert.doesNotMatch(code, /set_content_guideline_publication|client_published_at/, 'nothing is published')
  // The only inserts are the guideline a run must have (via the canonical RPC) and the pass record.
  const inserts = code.match(/\.insert\(/g) ?? []
  assert.equal(inserts.length, 1)
  assert.match(code, /from\('content_autopilot_runs'\)\s*\.insert/)
  assert.match(code, /get_or_create_content_guideline/)
  assert.equal(pass.MAX_RUNS_PER_PASS, 25, 'one pass is bounded')
})
