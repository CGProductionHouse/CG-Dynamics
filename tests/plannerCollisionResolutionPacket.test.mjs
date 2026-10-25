import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { preparePlannerCollisionResolutionPacket } from '../scripts/lib/planner-collision-resolution-packet.mjs'
import { reviewPlannerCollisionNativeDetails } from '../scripts/lib/planner-collision-native-details.mjs'
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
function fixture(role = 'monthly') {
  const master = ['m1', 'm2'].map((id, i) => ({ id, title: `F${i ? '' : ' '}1`, plan_id: 'master', bucket_id: 'bucket',
    percent_complete: 0, due_date: `2026-11-${i ? '02' : '05'}`, start_date: null, description: i ? null : 'THURSDAYS; four branded photos' }))
  const sources = role === 'master' ? master : ['a', 'b'].map(id => ({ id, title: 'F 1', plan_id: 'oct', bucket_id: 'monthly-bucket', percent_complete: 100 }))
  const source_evidence = [...master.map(m => ({ role: 'master', task_id: m.id, plan_id: m.plan_id, bucket_id: m.bucket_id, title: m.title, progress: m.percent_complete, source_date: m.due_date, source_notes: m.description })),
    ...(role === 'monthly' ? sources.map(s => ({ role, task_id: s.id, plan_id: s.plan_id, bucket_id: s.bucket_id, title: s.title, progress: s.percent_complete })) : [])]
  const review = { contract: 'teams_held_evidence_review_v1', writes: 0, apply_ready: false, reviews: [{ client_id: 'client', client: 'Exact Client', month: '2026-10', package_evidence: { confirmed: 4 },
    formats: [{ field: 'photo_posts_per_month', package_state: 'known', confirmed_quantity: 4, source_card_counts: { master: 2, monthly: 2 },
      duplicate_slots: [{ slot: 'photo/1', master_task_ids: role === 'master' ? ['m1', 'm2'] : ['m1'], monthly_task_ids: role === 'monthly' ? ['a', 'b'] : [] }] }], source_evidence }] }
  // Both master cards form a collision in the master fixture only.
  const rows = sources.map(s => ({ expected: { id: s.id, plan_id: s.plan_id, bucket_id: s.bucket_id, title: s.title, progress: s.percent_complete, client_id: 'client', client: 'Exact Client', role },
    observed_at: '2026-10-19T10:00:00Z', error: null, source: { ...s, start_date_time: null, due_date_time: null } }))
  const metadata = { contract: 'planner_exact_task_metadata_readback_v1', source_review_sha256: hash(review), read_only: true, writes: 0, apply_ready: false, rows }
  const nativeProof = { binding: { kind: 'owner_confirmed_master', plan_id: 'master', source_name: 'Master', source_ref: 'owner decision' },
    receipt: { contract: 'planner_native_export_v1', plan: { 'Plan ID': 'master', 'Plan name': 'Master', 'Date of export': '2026-10-19' },
      file_sha256: 'a'.repeat(64), consolidated_task_identity_and_source_fields_match: true, writes: 0, apply_ready: false,
      buckets: [{ 'Bucket ID': 'bucket', 'Bucket Name': 'Exact Client' }], task_count: 2, bucket_count: 1,
      tasks: master.map(m => ({ 'Task ID': m.id, 'Task Name': m.title, Bucket: m.bucket_id, Status: 'Not started', 'Due date': m.due_date, 'Start date': null, 'Completed Date': null, Notes: m.description })) },
    anchors: [{ id: 'bucket', name: 'Exact Client', plan_id: 'master', tasks: master }] }
  return { review, metadata, nativeProof }
}
const run = f => preparePlannerCollisionResolutionPacket(f.review, f.metadata, f.nativeProof)
test('monthly detail absence is not blank notes; November master date is never inherited into October', () => {
  const f = fixture(), before = structuredClone(f), result = run(f)
  assert.equal(result.group_count, 1); assert.equal(result.contender_count, 2)
  assert.ok(result.groups[0].flags.includes('master_reference_not_same_calendar_month_no_date_inheritance'))
  assert.ok(result.groups[0].members.every(m => m.notes_state === 'not_retrieved' && m.survivor === null))
  assert.equal(result.groups[0].contexts[0].confirmed_quantity, 4)
  assert.equal(result.resolved_groups, 0); assert.equal(result.writes, 0); assert.equal(result.apply_ready, false)
  assert.deepEqual(f, before)
})
test('differing master dates and rich versus blank notes preserve both durable identities', () => {
  const result = run(fixture('master')), g = result.groups[0]
  assert.ok(g.flags.includes('master_dates_differ')); assert.ok(g.flags.includes('master_notes_differ'))
  assert.ok(g.members.every(m => m.notes_state === 'native_export_observed'))
  assert.equal(g.members[1].notes, null); assert.equal(g.survivor, null)
})
test('edited package/month/client, master note/date/bucket drift, incomplete native proof refuse', () => {
  for (const mutate of [f => f.review.reviews[0].month = '2026-11', f => f.review.reviews[0].client_id = 'foreign',
    f => f.review.reviews[0].formats[0].confirmed_quantity = 8,
    f => f.nativeProof.receipt.tasks[0].Notes = 'changed', f => f.nativeProof.receipt.tasks[0]['Due date'] = '2026-11-06',
    f => f.nativeProof.receipt.tasks[0].Bucket = 'foreign', f => f.nativeProof.receipt.tasks.pop()]) {
    const f = fixture(); mutate(f); assert.throws(() => run(f))
  }
})
test('fresh failed metadata cannot be replaced by richer old master context', () => {
  const f = fixture(); f.metadata.rows[0].retry = { observed_at: '2026-10-19T11:00:00Z', source: null, error: 'unreadable' }
  const r = run(f); assert.ok(r.groups[0].flags.includes('metadata_read_or_drift_hold'))
  assert.equal(r.held_groups, 1); assert.equal(r.groups[0].survivor, null)
})
test('unknown capacity remains null and confirmed zero is preserved, neither resolves a collision', () => {
  for (const [state, quantity] of [['unknown', null], ['known', 0]]) {
    const f = fixture(), format = f.review.reviews[0].formats[0]
    format.package_state = state; format.confirmed_quantity = quantity
    f.metadata.source_review_sha256 = hash(f.review)
    const r = run(f), context = r.groups[0].contexts[0]
    assert.equal(context.package_state, state); assert.equal(context.confirmed_quantity, quantity)
    assert.equal(r.resolved_groups, 0); assert.equal(r.groups[0].survivor, null)
  }
})
test('actual CLI preserves legacy mode, reproduces richer packet and refuses overwrite/private-source replacement', () => {
  const f = fixture(), dir = mkdtempSync(join(tmpdir(), 'cg-collision-packet-'))
  try {
    const paths = ['review', 'metadata', 'input'].map(name => join(dir, `${name}.json`))
    for (const [i, value] of [f.review, f.metadata, { native_master_export: f.nativeProof }].entries()) writeFileSync(paths[i], JSON.stringify(value))
    const execute = args => execFileSync(process.execPath, ['scripts/teams-source-collision-review.mjs', ...args], { encoding: 'utf8', stdio: 'pipe' })
    const rich = join(dir, 'rich.json'), old = join(dir, 'old.json')
    const receipt = JSON.parse(execute([paths[0], paths[1], rich, paths[2]]))
    assert.deepEqual(JSON.parse(readFileSync(rich, 'utf8')), run(f))
    assert.equal(receipt.exact_source_rows, 2); assert.equal(receipt.collision_groups, 1)
    execute([paths[0], paths[1], old])
    assert.equal(JSON.parse(readFileSync(old, 'utf8')).contract, 'planner_contested_source_review_v1')
    assert.throws(() => execute([paths[0], paths[1], rich, paths[2]]), /New private output/)
    assert.throws(() => execute([paths[0], paths[1], paths[2], paths[2]]), /New private output/)
    assert.deepEqual(JSON.parse(readFileSync(paths[2], 'utf8')), { native_master_export: f.nativeProof })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

function nativeDetailFixture(role = 'monthly') {
  const f = fixture(role), masterRows = f.nativeProof.anchors[0].tasks
  const monthlyRows = role === 'monthly' ? f.metadata.rows.map(r => r.source) : []
  const input = { native_master_export: f.nativeProof,
    master: { plan_id: 'master', bucket_list_complete: true, expected_bucket_count: 1, buckets: [{ ...f.nativeProof.anchors[0], read_complete: true, expected_count: masterRows.length, tasks: masterRows }] },
    months: [{ plan_id: 'oct', month: '2026-10', bucket_list_complete: true, expected_bucket_count: 1,
      buckets: [{ id: 'monthly-bucket', name: 'Exact Client', plan_id: 'oct', read_complete: true, expected_count: monthlyRows.length, tasks: monthlyRows }] }] }
  const addDetails = r => ({ ...structuredClone(r), tasks: r.tasks.map(t => ({ ...t, 'Checklist Items': null, 'Completed Checklist Items': null, Labels: null })) })
  const master = addDetails(f.nativeProof.receipt)
  const month = { ...structuredClone(master), task_count: monthlyRows.length, plan: { 'Plan ID': 'oct', 'Plan name': 'October ', 'Date of export': '2026-10-19' },
    buckets: [{ 'Bucket ID': 'monthly-bucket', 'Bucket Name': 'Exact Client' }],
    tasks: monthlyRows.map((t, i) => ({ 'Task ID': t.id, 'Task Name': t.title, Bucket: t.bucket_id, Status: 'Completed', 'Created Date': '2026-10-01',
      'Start date': null, 'Due date': null, 'Completed Date': '2026-10-03', Notes: i ? null : master.tasks[0].Notes,
      'Checklist Items': null, 'Completed Checklist Items': null, Labels: null })) }
  const authority = { relationship: 'monthly_cross_check_of_master_not_additional_capacity', source_ref: 'owner decision',
    master: { plan_id: 'master', source_name: 'Master', kind: 'owner_confirmed_master' }, monthly: [{ plan_id: 'oct', source_name: 'October', month: '2026-10' }] }
  const exports = [master, month].map(receipt => ({ observed_at: '2026-10-19T12:00:00Z', receipt }))
  return { ...f, input, authority, exports }
}
const detailRun = f => reviewPlannerCollisionNativeDetails(f.review, f.metadata, f.input, f.authority, f.exports)
test('native notes and blank checklists replace missing-detail state but never select the richer record', () => {
  const f = nativeDetailFixture(), before = structuredClone(f), r = detailRun(f), g = r.groups[0]
  assert.equal(g.native_detail_state, 'master_note_correspondence_not_survivor_authority')
  assert.deepEqual(g.members[0].context_note_matches, ['m1'])
  assert.equal(g.members[1].notes, null); assert.equal(g.members[1].notes_state, 'native_export_observed')
  assert.ok(g.members.every(m => m.checklist_state === 'native_export_observed' && m.attachments_state === 'not_in_native_export' && m.source_revision === null))
  assert.equal(g.survivor, null); assert.equal(r.resolved_groups, 0); assert.equal(r.held_groups, 1)
  assert.deepEqual(f, before)
})
test('no title/order/completion/note-richness winner, and source dates are never inherited', () => {
  const f = nativeDetailFixture(); f.exports[1].receipt.tasks.forEach(t => { t.Notes = null })
  const r = detailRun(f), g = r.groups[0]
  assert.equal(g.native_detail_state, 'observed_blank_notes_no_identity_discriminator')
  assert.ok(g.members.every(m => m.due_date === null && m.start_date === null && m.survivor === null))
  assert.equal(g.contexts[0].master[0].due_date, '2026-11-05')
})
test('foreign/repeated/missing source, client bucket, month, absent detail column and master context drift refuse', () => {
  for (const mutate of [f => f.exports.pop(), f => f.exports[1] = f.exports[0], f => f.authority.monthly[0].month = '2026-11',
    f => f.exports[1].receipt.tasks.pop(), f => f.exports[1].receipt.tasks[0]['Task ID'] = 'foreign',
    f => f.exports[1].receipt.buckets[0]['Bucket Name'] = 'Foreign Client',
    f => delete f.exports[1].receipt.tasks[0]['Checklist Items'],
    f => f.exports[0].receipt.tasks[0].Notes = 'New unreviewed master notes',
    f => f.exports[0].receipt.tasks[0]['Due date'] = '2026-11-06',
    f => f.exports[1].receipt.tasks[0]['Due date'] = '2026-02-30',
    f => f.input.months[0].buckets[0].read_complete = false,
    f => { const b = f.input.months[0].buckets[0]; b.tasks.push(b.tasks[0]); b.expected_count++ },
    f => f.input.months[0].buckets[0].tasks[0].bucket_id = 'foreign']) {
    const f = nativeDetailFixture(); mutate(f); assert.throws(() => detailRun(f))
  }
})
test('new native progress/title drift remains held and a newly observed date is not still labelled undated', () => {
  const f = nativeDetailFixture(), task = f.exports[1].receipt.tasks[0]
  task.Status = 'Not started'; task['Task Name'] = 'Changed source title'; task['Due date'] = '2026-10-25'
  const g = detailRun(f).groups[0]
  assert.equal(g.native_detail_state, 'source_drift_or_read_failure_held')
  assert.deepEqual(g.members[0].changes_since_metadata, ['title', 'percent_complete'])
  assert.ok(!g.flags.includes('monthly_cards_undated')); assert.equal(g.survivor, null)
})
test('a master card matching its own notes is not counted as monthly correspondence or supersession', () => {
  const r = detailRun(nativeDetailFixture('master')), g = r.groups[0]
  assert.equal(g.native_detail_state, 'distinct_master_records_no_supersession_evidence')
  assert.ok(g.members.every(m => m.context_note_matches.length === 0 && m.survivor === null))
  assert.equal(r.resolved_groups, 0)
})
test('actual five-argument CLI compiles bound native details, preserves files and refuses native source replacement', () => {
  const f = nativeDetailFixture(), dir = mkdtempSync(join(tmpdir(), 'cg-native-collision-'))
  try {
    const paths = Object.fromEntries(['review', 'metadata', 'input', 'authority', 'master', 'month', 'manifest', 'output'].map(k => [k, join(dir, `${k}.json`)]))
    const values = { review: f.review, metadata: f.metadata, input: f.input, authority: f.authority, master: f.exports[0].receipt, month: f.exports[1].receipt,
      manifest: { authority_path: paths.authority, exports: [{ receipt_path: paths.master, observed_at: f.exports[0].observed_at }, { receipt_path: paths.month, observed_at: f.exports[1].observed_at }] } }
    for (const [key, value] of Object.entries(values)) writeFileSync(paths[key], JSON.stringify(value))
    const args = ['scripts/teams-source-collision-review.mjs', paths.review, paths.metadata, paths.output, paths.input, paths.manifest]
    const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' }))
    assert.equal(result.exact_source_rows, 2)
    assert.deepEqual(JSON.parse(readFileSync(paths.output, 'utf8')), detailRun(f))
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }))
    args[3] = paths.month
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }))
    for (const [key, value] of Object.entries(values)) assert.deepEqual(JSON.parse(readFileSync(paths[key], 'utf8')), value)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
