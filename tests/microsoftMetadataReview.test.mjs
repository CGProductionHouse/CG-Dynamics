import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'
import { reviewPlannerMetadata } from '../src/lib/microsoftMetadataReview.ts'

const identity = { planId: 'synthetic-plan', taskId: 'synthetic-task', clientId: null }
const capture = '2026-10-20T11:00:00Z'
const details = { id: identity.taskId, '@odata.etag': 'revision-a', checklist: { a: { title: 'PRIVATE_TITLE', isChecked: true, orderHint: ' !' } }, references: {}, previewType: 'checklist' }
function fixture() {
  return structuredClone({
    source: { ...identity, complete: true, capturedAt: capture, details },
    target: { ...identity, id: 'synthetic-target', updatedAt: capture, checklist: [{ text: 'Staff-approved local wording', done: true }] },
    baseline: { ...identity, targetId: 'synthetic-target', capturedAt: capture, details: structuredClone(details), localChecklist: [{ text: 'Staff-approved local wording', done: true }] },
  })
}

test('exact unchanged baseline is read-only; input payload and staff wording remain byte-stable', () => {
  const packet = fixture(), before = JSON.stringify(packet)
  const result = reviewPlannerMetadata(packet)
  assert.equal(result.decision, 'unchanged')
  assert.equal(result.automaticApply, false)
  assert.equal(result.localChecklistPreserved, true)
  assert.equal(JSON.stringify(packet), before)
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TITLE|Staff-approved|synthetic-task|revision-a/)
})

test('absent versus explicit empty fields never clears local checklist; failed details is unknown', () => {
  for (const field of ['checklist', 'references', 'previewType']) {
    const packet = fixture(); delete packet.source.details[field]
    assert.equal(reviewPlannerMetadata(packet).decision, 'hold')
    assert.equal(reviewPlannerMetadata(packet)[field], 'missing')
  }
  const packet = fixture(); packet.source.details.checklist = {}; delete packet.baseline
  assert.equal(reviewPlannerMetadata(packet).checklist, 'observed_empty')
  assert.equal(reviewPlannerMetadata(packet).decision, 'review_required')
  for (const change of [{ complete: false }, { details: null }, { capturedAt: 'yesterday' }]) {
    assert.equal(reviewPlannerMetadata({ ...fixture(), source: { ...fixture().source, ...change } }).decision, 'hold')
  }
})

test('cross-plan/task/client/target identities and older capture stay held, never title-matched', () => {
  for (const field of ['planId', 'taskId', 'clientId']) {
    const packet = fixture(); packet.target[field] = 'another'
    assert.equal(reviewPlannerMetadata(packet).reason, 'IDENTITY_MISMATCH')
    const baseline = fixture(); baseline.baseline[field] = 'another'
    assert.equal(reviewPlannerMetadata(baseline).reason, 'BASELINE_IDENTITY_OR_CAPTURE_DRIFT')
  }
  for (const change of [{ targetId: 'other-target' }, { capturedAt: '2026-10-21T11:00:00Z' }]) {
    const packet = fixture(); Object.assign(packet.baseline, change)
    assert.equal(reviewPlannerMetadata(packet).decision, 'hold')
  }
  const wrongDetails = fixture(); wrongDetails.source.details.id = 'other'
  assert.equal(reviewPlannerMetadata(wrongDetails).reason, 'DETAIL_ID_MISMATCH')
  const noRevision = fixture(); delete noRevision.source.details['@odata.etag']
  assert.equal(reviewPlannerMetadata(noRevision).reason, 'SOURCE_REVISION_MISSING')
  const unknownClient = fixture(); delete unknownClient.source.clientId; delete unknownClient.target.clientId
  assert.equal(reviewPlannerMetadata(unknownClient).reason, 'IDENTITY_MISMATCH', 'unknown cannot become an exact null client')
})

test('staff-only and concurrent source/staff changes preserve staff; source-only changes require review', () => {
  const staff = fixture(); staff.target.checklist[0].done = false
  assert.equal(reviewPlannerMetadata(staff).decision, 'preserve_staff')
  staff.source.details.checklist.a.title = 'New source wording'
  assert.equal(reviewPlannerMetadata(staff).decision, 'source_and_staff_changed')
  const source = fixture(); source.source.details.checklist = {}
  assert.equal(reviewPlannerMetadata(source).decision, 'review_required', 'explicit source deletion is NOT applied locally')
  assert.equal(reviewPlannerMetadata(source).automaticApply, false)
  assert.equal(source.target.checklist.length, 1)
})

test('malformed Graph completion/reference collections or local payload stay held', () => {
  for (const checklist of [null, [], { a: null }, { a: { title: 'a', isChecked: 'true' } }, { a: { isChecked: true } }]) {
    const packet = fixture(); packet.source.details.checklist = checklist
    assert.equal(reviewPlannerMetadata(packet).checklist, 'invalid')
    assert.equal(reviewPlannerMetadata(packet).decision, 'hold')
  }
  for (const references of [null, [], { attachment: null }]) {
    const packet = fixture(); packet.source.details.references = references
    assert.equal(reviewPlannerMetadata(packet).decision, 'hold')
  }
  const packet = fixture(); packet.target.checklist = null
  assert.equal(reviewPlannerMetadata(packet).reason, 'LOCAL_CHECKLIST_UNVERIFIED')
})

test('object-key reordering is unchanged but array/item metadata and false are never lost', () => {
  const packet = fixture()
  packet.source.details.checklist.a = { orderHint: ' !', isChecked: true, title: 'PRIVATE_TITLE' }
  assert.equal(reviewPlannerMetadata(packet).decision, 'unchanged')
  packet.source.details.checklist.a.isChecked = false
  assert.equal(reviewPlannerMetadata(packet).decision, 'review_required')
})

test('native expanded Planner task is not a Graph task-details capture or a write permission', () => {
  const packet=fixture()
  const native={id:identity.taskId,planId:identity.planId,'@etag':'PRIVATE_NATIVE_REVISION',
    checklist:[{id:'item-b',displayName:'PRIVATE_NATIVE_TEXT',isChecked:false,orderHint:'z','@etag':'PRIVATE_ITEM_REVISION'},
      {id:'item-a',displayName:'PRIVATE_OTHER_TEXT',isChecked:true,orderHint:'a','@etag':'PRIVATE_ITEM_REVISION'}],links:[]}
  packet.source.details=native
  const before=JSON.stringify(packet)
  const result=reviewPlannerMetadata(packet)
  assert.equal(result.reason,'SOURCE_REVISION_MISSING','native @etag is not Graph details @odata.etag')
  assert.equal(result.decision,'hold')
  assert.equal(result.automaticApply,false)
  assert.equal(JSON.stringify(packet),before)
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|item-a|item-b/)
  packet.source.details['@odata.etag']=native['@etag']
  assert.equal(reviewPlannerMetadata(packet).reason,'METADATA_INCOMPLETE_OR_INVALID','renaming revision must not admit native array as Graph object')
  assert.deepEqual(packet.source.details.checklist.map(x=>x.id),['item-b','item-a'],'native response order never silently rewritten')
})

test('native empty list cannot masquerade as verified empty Graph checklist',()=>{
  const packet=fixture()
  packet.source.details={id:identity.taskId,'@odata.etag':'synthetic-alias',checklist:[],references:[],previewType:'checklist'}
  const result=reviewPlannerMetadata(packet)
  assert.equal(result.decision,'hold')
  assert.equal(result.checklist,'invalid')
  assert.equal(result.automaticApply,false)
  assert.equal(packet.target.checklist.length,1)
})

test('private local CLI emits no text/URLs/IDs, holds BOTH colliding identities, and performs no fetch', () => {
  const temp = mkdtempSync(join(tmpdir(), 'cg-metadata-review-'))
  try {
    const path = join(temp, 'packet.json'), packet = fixture()
    packet.source.details.references = { 'https%3A//private.example/PRIVATE_URL': { alias: 'PRIVATE_ALIAS', type: 'Other' } }
    const wrongClient = structuredClone(packet)
    wrongClient.source.clientId = 'another-client'; wrongClient.target.clientId = 'another-client'
    writeFileSync(path, JSON.stringify({ format: 'cg-planner-metadata-review', version: 1, rows: [packet, wrongClient] }))
    const out = execFileSync(process.execPath, ['scripts/review-planner-metadata.mjs', path], { encoding: 'utf8' })
    const receipt = JSON.parse(out)
    assert.equal(receipt.rows.length, 2)
    assert.ok(receipt.rows.every(row => row.decision === 'hold' && row.reason === 'DUPLICATE_SOURCE_IDENTITY' && !row.automaticApply))
    assert.doesNotMatch(out, /PRIVATE_|synthetic-task|private\.example/)
    writeFileSync(path, '{ PRIVATE_MALFORMED_SECRET')
    const invalid = spawnSync(process.execPath, ['scripts/review-planner-metadata.mjs', path], { encoding: 'utf8' })
    assert.notEqual(invalid.status, 0)
    assert.doesNotMatch(invalid.stderr + invalid.stdout, /PRIVATE_MALFORMED_SECRET/)
  } finally { rmSync(temp, { recursive: true }) }
})
