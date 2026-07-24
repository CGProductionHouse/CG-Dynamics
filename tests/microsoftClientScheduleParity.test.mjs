import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let deliverableIdentity, templateCodeInstance, buildMicrosoftImportPreview, resolveUnnumberedClientScheduleDeliverables
let flagDeliverableSlotConflicts, deliverableSlotKey

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ deliverableIdentity, templateCodeInstance, buildMicrosoftImportPreview, resolveUnnumberedClientScheduleDeliverables,
      flagDeliverableSlotConflicts, deliverableSlotKey } =
    await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts'))
})
after(async () => { await server?.close() })

// ── Parser: numbered variants (incl. the REAL Action Sport titles) ──────────
test('numbered DP/F/PHOTO/VIDEO/REEL titles parse to canonical identities', () => {
  const cases = [
    ['DP1', 'DP1', 'dp', 1], ['DP 1', 'DP1', 'dp', 1], ['DP-1', 'DP1', 'dp', 1], ['DP #1', 'DP1', 'dp', 1],
    ['DP 1- ACTION', 'DP1', 'dp', 1], ['DP 2 - ACTION', 'DP2', 'dp', 2], ['DP 3 ACTION', 'DP3', 'dp', 3], ['DP4 - ACTION', 'DP4', 'dp', 4],
    ['F1', 'F1', 'photo', 1], ['F 1', 'F1', 'photo', 1], ['F-1', 'F1', 'photo', 1], ['PHOTO 1', 'F1', 'photo', 1],
    ['F 1 - ACTION', 'F1', 'photo', 1], ['F 4 - ACTION', 'F4', 'photo', 4], ['F1 ACTION', 'F1', 'photo', 1],
    ['VIDEO 1 - ACTION', 'Video 1', 'video', 1], ['VIDEO1', 'Video 1', 'video', 1], ['VIDEO 1', 'Video 1', 'video', 1],
    ['REEL 2 ACTION', 'Reel 2', 'reel', 2], ['REEL1', 'Reel 1', 'reel', 1],
  ]
  for (const [title, code, type, instance] of cases) {
    const id = deliverableIdentity(title)
    assert.deepEqual(
      { code: id.code, deliverable_type: id.deliverable_type, instance_number: id.instance_number, unnumbered: id.unnumbered },
      { code, deliverable_type: type, instance_number: instance, unnumbered: false },
      `title "${title}"`,
    )
  }
})

// ── Parser: unnumbered VIDEO/REEL are recognised but left for safe resolution ─
test('unnumbered VIDEO/REEL are typed but carry no guessed instance', () => {
  for (const [title, type] of [['VIDEO - ACTION', 'video'], ['VIDEO CLIENT', 'video'], ['VIDEO - CLIENT', 'video'], ['REEL - CLIENT', 'reel'], ['REEL CLIENT', 'reel']]) {
    const id = deliverableIdentity(title)
    assert.equal(id.deliverable_type, type, title)
    assert.equal(id.instance_number, null, title)
    assert.equal(id.unnumbered, true, title)
    assert.equal(id.code, null, title)
  }
})

test('unnumbered DP/F/PHOTO is NOT a recognised deliverable (must be numbered)', () => {
  for (const title of ['DP - ACTION', 'F - ACTION', 'PHOTO ACTION', 'random task']) {
    const id = deliverableIdentity(title)
    assert.equal(id.deliverable_type, null, title)
    assert.equal(id.unnumbered, false, title)
  }
})

test('templateCodeInstance extracts the trailing number only', () => {
  assert.equal(templateCodeInstance('Video 1'), 1)
  assert.equal(templateCodeInstance('Reel 2'), 2)
  assert.equal(templateCodeInstance('DP3'), 3)
  assert.equal(templateCodeInstance('Video'), null)
})

// ── End-to-end preview fixtures ─────────────────────────────────────────────
const CLIENT = { id: 'client-action', name: 'Action Sport' }
const PKG = { id: 'pkg-1', clientId: CLIENT.id, status: 'active' }
const NUMBERED_TEMPLATES = [
  ...['DP1', 'DP2', 'DP3', 'DP4'].map((code, i) => ({ id: `t-${code}`, packageId: PKG.id, code, deliverableType: 'dp', active: true, instance: i + 1 })),
  ...['F1', 'F2', 'F3', 'F4'].map((code, i) => ({ id: `t-${code}`, packageId: PKG.id, code, deliverableType: 'photo', active: true, instance: i + 1 })),
]

function task(title, taskId) {
  return {
    sourceType: 'planner_task', sourcePlanId: 'plan-cs-jul', sourcePlanName: 'Client Socials - July 2026',
    sourceBucketId: 'bucket-action', sourceBucketName: 'Action Sport', sourceTaskId: taskId,
    title, description: null, startDate: '2026-07-01', dueDate: '2026-07-10',
    assigneeMicrosoftIds: [], percentComplete: 0,
  }
}

function context(templates) {
  return { clients: [CLIENT], boards: [], buckets: [], packages: [PKG], templates }
}

// The exact Action Sport source: 8 numbered + 1 unnumbered VIDEO, package has NO video template.
const ACTION_SPORT_TITLES = ['F 1 - ACTION', 'F 2 - ACTION', 'F 3 - ACTION', 'F 4 - ACTION', 'DP 1- ACTION', 'DP 2 - ACTION', 'DP 3 ACTION', 'DP4 - ACTION', 'VIDEO - ACTION']

test('Action Sport: 8 numbered map to new; unnumbered VIDEO proposes a Video 1 template correction', () => {
  const sources = ACTION_SPORT_TITLES.map((t, i) => task(t, `task-${i}`))
  const preview = buildMicrosoftImportPreview(sources, context(NUMBERED_TEMPLATES))

  const numbered = preview.filter(p => p.title !== 'VIDEO - ACTION')
  assert.equal(numbered.length, 8)
  for (const item of numbered) {
    assert.equal(item.previewStatus, 'new', `${item.title} should be new`)
    assert.equal(item.proposedPayload.template_id !== null, true)
  }
  // The one missing template is proposed as a reviewed correction (not a silent skip,
  // not a guessed number): Video 1, from the single unnumbered VIDEO source task.
  const video = preview.find(p => p.title === 'VIDEO - ACTION')
  assert.equal(video.reconciliationAction, 'package_template_create')
  assert.deepEqual(video.proposedTemplate, { code: 'Video 1', deliverable_type: 'video', instance_number: 1 })
})

test('unnumbered VIDEO resolves to the unique compatible video template', () => {
  const templates = [...NUMBERED_TEMPLATES, { id: 't-video1', packageId: PKG.id, code: 'Video 1', deliverableType: 'video', active: true }]
  const preview = buildMicrosoftImportPreview([task('VIDEO - ACTION', 'v1')], context(templates))
  const video = preview[0]
  assert.equal(video.previewStatus, 'new')
  assert.equal(video.conflictCode, null)
  assert.equal(video.proposedPayload.code, 'Video 1')
  assert.equal(video.proposedPayload.instance_number, 1)
  assert.equal(video.proposedPayload.template_id, 't-video1')
})

test('two unnumbered VIDEO tasks for the same client/month both stay conflicts (never guessed by order)', () => {
  const templates = [...NUMBERED_TEMPLATES, { id: 't-video1', packageId: PKG.id, code: 'Video 1', deliverableType: 'video', active: true }]
  const preview = buildMicrosoftImportPreview([task('VIDEO - ACTION', 'v1'), task('VIDEO - HYPE', 'v2')], context(templates))
  for (const item of preview) {
    assert.equal(item.previewStatus, 'conflict')
    assert.equal(item.conflictCode, 'ambiguous_unnumbered_deliverable')
  }
})

test('unnumbered VIDEO with two compatible video templates stays a conflict', () => {
  const templates = [
    { id: 't-video1', packageId: PKG.id, code: 'Video 1', deliverableType: 'video', active: true },
    { id: 't-video2', packageId: PKG.id, code: 'Video 2', deliverableType: 'video', active: true },
  ]
  const preview = buildMicrosoftImportPreview([task('VIDEO - ACTION', 'v1')], context(templates))
  assert.equal(preview[0].previewStatus, 'conflict')
  assert.equal(preview[0].conflictCode, 'ambiguous_unnumbered_deliverable')
})

test('resolver is a no-op on already-numbered items and preserves cross-client isolation', () => {
  // A numbered video for a DIFFERENT client must never be pulled into Action Sport.
  const other = { id: 'client-other', name: 'Other Co' }
  const ctx = { clients: [CLIENT, other], boards: [], buckets: [], packages: [PKG], templates: NUMBERED_TEMPLATES }
  const resolved = resolveUnnumberedClientScheduleDeliverables(
    buildMicrosoftImportPreview([task('F 1 - ACTION', 'f1')], ctx), ctx,
  )
  assert.equal(resolved[0].previewStatus, 'new')
  assert.equal(resolved[0].mappedClientId, CLIENT.id)
})

// ── link_existing: legacy rows link instead of duplicating ───────────────────
test('a create landing on an unlinked legacy slot becomes link_existing', () => {
  const [item] = buildMicrosoftImportPreview([task('F 1 - ACTION', 'f1')], context(NUMBERED_TEMPLATES))
  const p = item.proposedPayload
  const slot = deliverableSlotKey(p.package_id, p.template_id, p.instance_number, p.month)
  const unlinked = new Map([[slot, [{ id: 'legacy-row-1', updatedAt: '2026-07-01T00:00:00Z' }]]])
  const [flagged] = flagDeliverableSlotConflicts([item], new Set([slot]), unlinked)
  assert.equal(flagged.reconciliationAction, 'link_existing')
  assert.equal(flagged.existingTargetId, 'legacy-row-1')
  assert.equal(flagged.expectedTargetUpdatedAt, '2026-07-01T00:00:00Z')
  assert.equal(flagged.conflictCode, null)
})

test('an occupied slot with NO unlinked legacy row stays a conflict (never duplicates)', () => {
  const [item] = buildMicrosoftImportPreview([task('F 1 - ACTION', 'f1')], context(NUMBERED_TEMPLATES))
  const p = item.proposedPayload
  const slot = deliverableSlotKey(p.package_id, p.template_id, p.instance_number, p.month)
  // Slot occupied but the occupying row is already Microsoft-linked (not in the unlinked map).
  const [flagged] = flagDeliverableSlotConflicts([item], new Set([slot]), new Map())
  assert.equal(flagged.previewStatus, 'conflict')
  assert.equal(flagged.conflictCode, 'existing_deliverable_slot')
})

test('two source cards contesting one legacy slot both stay conflicts (no ambiguous link)', () => {
  const items = buildMicrosoftImportPreview([task('F 1 - ACTION', 'a'), task('F 1 - ACTION', 'b')], context(NUMBERED_TEMPLATES))
  // Same slot for both (duplicate source titles). Give that slot one legacy row.
  const p = items[0].proposedPayload
  const slot = deliverableSlotKey(p.package_id, p.template_id, p.instance_number, p.month)
  const flagged = flagDeliverableSlotConflicts(items, new Set([slot]), new Map([[slot, [{ id: 'legacy', updatedAt: 't' }]]]))
  assert.ok(flagged.every(i => i.reconciliationAction !== 'link_existing'))
})

// ── package_template_create: reviewed correction for a missing template ──────
test('unnumbered VIDEO with no video template proposes a Video 1 template correction', () => {
  const [item] = buildMicrosoftImportPreview([task('VIDEO - ACTION', 'v1')], context(NUMBERED_TEMPLATES))
  assert.equal(item.reconciliationAction, 'package_template_create')
  assert.deepEqual(item.proposedTemplate, { code: 'Video 1', deliverable_type: 'video', instance_number: 1 })
  assert.equal(item.proposedPayload.code, 'Video 1')
  assert.equal(item.proposedPayload.instance_number, 1)
})

test('unnumbered REEL with no reel template proposes a Reel 1 template correction', () => {
  const [item] = buildMicrosoftImportPreview([task('REEL - ACTION', 'r1')], context(NUMBERED_TEMPLATES))
  assert.equal(item.reconciliationAction, 'package_template_create')
  assert.deepEqual(item.proposedTemplate, { code: 'Reel 1', deliverable_type: 'reel', instance_number: 1 })
})

test('two unnumbered videos never propose a template correction (stay conflicts)', () => {
  const preview = buildMicrosoftImportPreview([task('VIDEO - ACTION', 'v1'), task('VIDEO - HYPE', 'v2')], context(NUMBERED_TEMPLATES))
  for (const item of preview) {
    assert.notEqual(item.reconciliationAction, 'package_template_create')
    assert.equal(item.previewStatus, 'conflict')
  }
})
