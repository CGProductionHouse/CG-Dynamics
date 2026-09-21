// #450: the Content Production Autopilot's deterministic rules.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, ap
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ap = await server.ssrLoadModule('/src/lib/contentAutopilot.ts')
})
after(async () => { await server?.close() })

const runFolder = { driveId: 'drive-1', monthFolderItemId: 'item-month', clientFolderName: 'Econofoods' }
const video = (overrides = {}) => ({
  id: 'video-1', position: 1, title: 'Fresh produce walkthrough', month: '2026-09-01', deliverable_id: null,
  script: null, shot_breakdown: null, requirements: null, cta: null, production_status: 'not_shot', ...overrides,
})

// ── Coverage (Phase 3) ──────────────────────────────────────────────────────

test('coverage keeps real future schedule months and never fabricates deliverables', () => {
  const scheduled = ap.planCoverageWindow({ runDate: '2026-09-23', scheduleMonths: ['2026-09-04', '2026-10-01', '2026-11-01'] })
  assert.deepEqual(scheduled.months, ['2026-09-01', '2026-10-01', '2026-11-01'])
  assert.equal(scheduled.basis, 'schedule')

  // Only the current month is scheduled: future months are PLANNED, not invented deliverables.
  const planned = ap.planCoverageWindow({ runDate: '2026-09-23', scheduleMonths: ['2026-09-04'] })
  assert.deepEqual(planned.months, ['2026-09-01', '2026-10-01', '2026-11-01'])
  assert.equal(planned.basis, 'planned')
  assert.equal(planned.start, '2026-09-01')
  assert.equal(planned.end, '2026-11-01')
})

test('one run may cover several months and a year boundary', () => {
  assert.deepEqual(ap.planCoverageWindow({ runDate: '2026-11-20' }).months, ['2026-11-01', '2026-12-01', '2027-01-01'])
  assert.equal(ap.shiftMonth('2026-12-01', 1), '2027-01-01')
})

// ── Draft preparation (Phase 3) ─────────────────────────────────────────────

test('preparation is idempotent and only develops videos without a real script', () => {
  const base = {
    guidelineStatus: 'draft', runDate: '2026-09-23', clientContextReady: true, aiProviderAvailable: true,
    scheduleMonths: ['2026-09-04'], videos: [video(), video({ id: 'video-2', position: 2, script: 'Real script.' })],
  }
  const first = ap.planGuidelinePreparation(base)
  const second = ap.planGuidelinePreparation(base)
  assert.deepEqual(first, second, 'running twice asks for the same work')
  assert.deepEqual(first.developVideoIds, ['video-1'], 'a written script is never regenerated')
  assert.equal(first.requestIdeas, true)
  assert.equal(first.ideasWanted, 1)

  const placeholder = ap.planGuidelinePreparation({ ...base, videos: [video({ script: 'Script pending AI development.' })] })
  assert.deepEqual(placeholder.developVideoIds, ['video-1'], 'a placeholder does not count as a script')
})

test('generation blocks explicitly instead of faking completed content', () => {
  const base = { guidelineStatus: 'draft', runDate: '2026-09-23', videos: [video()], clientContextReady: true, aiProviderAvailable: true }
  assert.equal(ap.planGuidelinePreparation({ ...base, clientContextReady: false }).blocked, 'CLIENT_CONTEXT_NOT_READY')
  assert.equal(ap.planGuidelinePreparation({ ...base, aiProviderAvailable: false }).blocked, 'NO_AI_PROVIDER')
  assert.equal(ap.planGuidelinePreparation({ ...base, runDate: null }).blocked, 'NO_COVERAGE_WINDOW')
  for (const status of ['ready', 'published', 'archived']) {
    const plan = ap.planGuidelinePreparation({ ...base, guidelineStatus: status })
    assert.equal(plan.blocked, 'GUIDELINE_APPROVED', status)
    assert.equal(plan.requestIdeas, false)
    assert.deepEqual(plan.developVideoIds, [], 'an approved guideline is never touched')
  }
})

test('a video with no real schedule slot is truthfully unallocated, not an error', () => {
  const plan = ap.planGuidelinePreparation({
    guidelineStatus: 'draft', runDate: '2026-09-23', clientContextReady: true, aiProviderAvailable: true,
    deliverableMonths: ['2026-09-01'],
    videos: [video({ month: '2026-09-01', deliverable_id: 'deliverable-1' }), video({ id: 'video-2', position: 2, month: '2026-11-01' })],
  })
  assert.deepEqual(plan.unallocatedVideoIds, ['video-2'])
  assert.equal(plan.blocked, null)
})

test('a draft never overwrites a human-edited field', () => {
  const edited = video({ script: 'Human written script.', cta: 'Visit us today.' })
  const { fill, conflicts } = ap.applyDraftSafely(edited, {
    script: 'AI script.', cta: 'AI cta.', shot_breakdown: 'Wide, mid, close.', requirements: '',
  })
  assert.deepEqual(conflicts.sort(), ['cta', 'script'])
  assert.deepEqual(fill, { shot_breakdown: 'Wide, mid, close.' }, 'only empty fields are filled')
})

// ── Canonical destinations (Phase 5) ────────────────────────────────────────

test('the canonical per-video folder uses the configured short code only', () => {
  const plan = ap.planVideoProductionFolder({ shortCode: 'ECONO', monthDate: '2026-09-01', position: 2, runFolder })
  assert.equal(plan.folderName, '2026_09_ECONO_VIDEO_02')
  assert.equal(plan.path, 'Clients / Econofoods / Videos / 2026 / 2026_09_SEP / 2026_09_ECONO_VIDEO_02')
  assert.equal(plan.state, 'ready_to_create')
})

test('a missing short code or mapping blocks rather than guessing', () => {
  assert.equal(ap.planVideoProductionFolder({ shortCode: null, monthDate: '2026-09-01', position: 1, runFolder }).blocked, 'BLOCKED_MISSING_SHORT_CODE')
  assert.equal(ap.planVideoProductionFolder({ shortCode: '   ', monthDate: '2026-09-01', position: 1, runFolder }).blocked, 'BLOCKED_MISSING_SHORT_CODE')
  const unmapped = ap.planVideoProductionFolder({ shortCode: 'ECONO', monthDate: '2026-09-01', position: 1, runFolder: null })
  assert.equal(unmapped.blocked, 'BLOCKED_MISSING_ONEDRIVE_MAPPING')
  assert.equal(unmapped.folderName, null, 'a blocked plan proposes no name at all')
})

test('an existing legacy folder is mapped by durable id, never renamed', () => {
  const plan = ap.planVideoProductionFolder({
    shortCode: 'ECONO', monthDate: '2026-09-01', position: 1, runFolder,
    existing: { driveId: 'drive-1', itemId: 'item-legacy', folderName: 'Econo Video 1 FINAL' },
  })
  assert.equal(plan.state, 'mapped')
  assert.equal(plan.itemId, 'item-legacy')
  assert.equal(plan.folderName, 'Econo Video 1 FINAL', 'the legacy name is preserved as-is')
})

test('final output resolves through the existing portal Video authority', () => {
  const category = { driveId: 'drive-1', folderItemId: 'portal-video' }
  assert.equal(ap.planPortalFinalOutput({ portalVideoCategory: null }).state, 'blocked_no_portal')
  assert.equal(ap.planPortalFinalOutput({ portalVideoCategory: category }).state, 'not_published')
  assert.equal(ap.planPortalFinalOutput({ portalVideoCategory: category, portalReadable: false }).state, 'unverified')
  const published = ap.planPortalFinalOutput({ portalVideoCategory: category, publishedAsset: { driveId: 'drive-1', itemId: 'asset-1', active: true } })
  assert.equal(published.state, 'published')
  assert.equal(published.itemId, 'asset-1')
})

// ── Raw evidence and readiness (Phase 6) ────────────────────────────────────

test('unreadable or unmapped evidence is UNVERIFIED, never MISSING', () => {
  assert.equal(ap.deriveRawEvidence({ folderState: 'mapped', providerReadable: false, closeoutUploadStatus: 'verified' }), 'UNVERIFIED')
  assert.equal(ap.deriveRawEvidence({ folderState: 'ready_to_create', closeoutUploadStatus: 'verified' }), 'UNVERIFIED')
  assert.equal(ap.deriveRawEvidence({ folderState: 'blocked', closeoutUploadStatus: 'missing' }), 'UNVERIFIED')
  assert.equal(ap.deriveRawEvidence({ folderState: 'mapped', closeoutUploadStatus: null }), 'UNVERIFIED')
})

test('raw evidence prefers exact per-video verification over the run closeout', () => {
  assert.equal(ap.deriveRawEvidence({ folderState: 'mapped', closeoutUploadStatus: 'verified', videoUploadStatus: 'missing' }), 'MISSING')
  assert.equal(ap.deriveRawEvidence({ folderState: 'mapped', closeoutUploadStatus: 'partial' }), 'PARTIAL')
  assert.equal(ap.deriveRawEvidence({ folderState: 'mapped', closeoutUploadStatus: 'verified' }), 'VERIFIED')
})

test('edit readiness is deterministic and always carries a reason and next action', () => {
  const mapped = { folderName: '2026_09_ECONO_VIDEO_01', path: null, itemId: 'i', driveId: 'd', state: 'mapped', blocked: null }
  const blocked = { folderName: null, path: null, itemId: null, driveId: null, state: 'blocked', blocked: 'BLOCKED_MISSING_SHORT_CODE' }
  const cases = [
    [{ folder: blocked, raw: 'UNVERIFIED', productionStatus: 'not_shot' }, 'BLOCKED_NO_MAPPING'],
    [{ folder: mapped, raw: 'MISSING', productionStatus: 'not_shot' }, 'BLOCKED_RAW_MISSING'],
    [{ folder: mapped, raw: 'PARTIAL', productionStatus: 'not_shot' }, 'RAW_PARTIAL'],
    [{ folder: mapped, raw: 'UNVERIFIED', productionStatus: 'shot' }, 'RAW_UNVERIFIED'],
    [{ folder: mapped, raw: 'VERIFIED', productionStatus: 'shot' }, 'READY_TO_EDIT'],
    [{ folder: mapped, raw: 'VERIFIED', productionStatus: 'editing' }, 'IN_EDIT'],
    [{ folder: mapped, raw: 'VERIFIED', productionStatus: 'internal_review' }, 'IN_REVIEW'],
    [{ folder: mapped, raw: 'VERIFIED', productionStatus: 'client_approved' }, 'FINAL_READY'],
  ]
  for (const [input, expected] of cases) {
    const answer = ap.deriveEditReadiness(input)
    assert.equal(answer.readiness, expected, `${input.productionStatus}/${input.raw}`)
    assert.ok(answer.reason.length > 10 && answer.nextAction.length > 5, 'every answer explains itself')
    assert.deepEqual(ap.deriveEditReadiness(input), answer, 'deterministic')
  }
})

test('work a human already started is never dragged backwards', () => {
  const blocked = { folderName: null, path: null, itemId: null, driveId: null, state: 'blocked', blocked: 'BLOCKED_MISSING_ONEDRIVE_MAPPING' }
  assert.equal(ap.deriveEditReadiness({ folder: blocked, raw: 'UNVERIFIED', productionStatus: 'editing' }).readiness, 'IN_EDIT')
  assert.equal(ap.deriveEditReadiness({ folder: blocked, raw: 'MISSING', productionStatus: 'client_approved' }).readiness, 'FINAL_READY')
})

// ── Run and client rollups (Phases 7 and 8) ─────────────────────────────────

const run = { id: 'run-1', client_id: 'client-1', client_name: 'Econofoods', run_date: '2026-09-23' }

test('run readiness counts exactly what the Content surface must show', () => {
  const readiness = ap.buildRunReadiness({
    run,
    guideline: { id: 'guideline-1', status: 'draft' },
    videos: [
      video({ id: 'video-1', position: 1, deliverable_id: 'deliverable-1', script: 'Written.', production_status: 'editing' }),
      video({ id: 'video-2', position: 2, month: '2026-10-01' }),
    ],
    shortCode: 'ECONO', runFolder,
    videoFolders: { 'video-1': { driveId: 'drive-1', itemId: 'item-1', folderName: '2026_09_ECONO_VIDEO_01' } },
    closeoutUploadStatus: 'verified',
    clientContextReady: true, aiProviderAvailable: true,
    scheduleMonths: ['2026-09-04'], deliverableMonths: ['2026-09-01'],
  })
  assert.equal(readiness.plannedVideos, 2)
  assert.equal(readiness.linkedVideos, 1)
  assert.equal(readiness.unallocatedVideos, 1)
  assert.equal(readiness.folderReadyVideos, 1)
  assert.equal(readiness.readinessCounts.IN_EDIT, 1)
  assert.equal(readiness.readinessCounts.BLOCKED_NO_MAPPING, 1, 'the unmapped video is blocked, not ready')
  assert.deepEqual(readiness.coverageMonths, ['2026-09-01', '2026-10-01', '2026-11-01'])
  assert.equal(readiness.videos[0].name, 'Video 01 - Fresh produce walkthrough')
  assert.deepEqual(readiness.preparation.developVideoIds, ['video-2'])
})

test('a client with no upcoming run reports NO_FUTURE_CONTENT_RUN instead of a fake run', () => {
  const past = ap.buildRunReadiness({ run: { ...run, run_date: '2026-08-01' }, guideline: null, videos: [], shortCode: 'ECONO', runFolder })
  const client = ap.buildClientReadiness({ id: 'client-1', name: 'Econofoods' }, [past], '2026-09-21')
  assert.deepEqual(client.runs, [])
  assert.ok(client.blockers.includes('NO_FUTURE_CONTENT_RUN'))
})

test('a missing guideline is a blocker, and the pass summary records what really happened', () => {
  const readiness = ap.buildRunReadiness({ run, guideline: null, videos: [video()], shortCode: null, runFolder: null })
  assert.ok(readiness.blockers.includes('NO_GUIDELINE'))
  assert.ok(readiness.blockers.includes('BLOCKED_MISSING_SHORT_CODE'))
  assert.equal(readiness.preparation, null)
  const client = ap.buildClientReadiness({ id: 'client-1', name: 'Econofoods' }, [readiness], '2026-09-21')
  const summary = ap.summariseAutopilotPass('2026-09-21T03:00:00Z', [client])
  assert.equal(summary.runsPrepared, 1)
  assert.equal(summary.videosPlanned, 1)
  assert.equal(summary.readyToEdit, 0)
  assert.equal(summary.blockers.NO_GUIDELINE, 1)
  assert.equal(summary.ranAt, '2026-09-21T03:00:00Z')
})

test('nothing in the autopilot core can write a deliverable or rename a file', () => {
  const source = readFileSync('src/lib/contentAutopilot.ts', 'utf8')
  // Compare the executable code only; the file's own comments state these rules.
  const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /monthly_deliverables/, 'the Client Schedule is never written from here')
  assert.doesNotMatch(code, /rename|\bmove\b|\bdelete\b/i, 'no destructive file operation is expressible')
  assert.doesNotMatch(code, /from '\.\/supabase'|fetch\(/, 'the core stays pure')
  assert.doesNotMatch(code, /deriveClientCode/, 'short codes are configured, never derived from a name')
})
