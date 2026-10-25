import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { reviewHeldScheduleEvidence } from '../scripts/lib/held-schedule-review.mjs'
import { verifyNativePlannerExport } from '../scripts/lib/native-planner-export.mjs'
let server, parse
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  parse = (await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts')).deliverableIdentity
})
after(async () => { await server?.close() })
function fixture() {
  const task = (id, role, title = 'VIDEO - Exact Studio') => ({ id, title, plan_id: role, bucket_id: `${role}-bucket`, percent_complete: 0, due_date: null })
  const client = { id: 'client', name: 'Exact Studio', active: true, package_settings: { professional_videos_per_month: 1, photo_posts_per_month: null,
    verification: { status: 'confirmed', field_states: { professional_videos_per_month: 'known', photo_posts_per_month: 'flexible' } } } }
  const input = { clients: [client], master: { plan_id: 'master', buckets: [{ id: 'master-bucket', tasks: [task('m', 'master')] }] }, months: [{ month: '2026-10', buckets: [{ id: 'monthly-bucket', plan_id: 'monthly', tasks: [task('o', 'monthly')] }] }] }
  const audit = { writes: 0, apply_ready: false, master_authority_verified: true, native_master_export_proof: { kind: 'native_planner_export' }, months: [{ month: '2026-10', source_complete: true, period_verified: true,
    buckets: [{ bucket_id: 'monthly-bucket', plan_id: 'monthly', client_id: 'client', source_complete: true }], slot_review: [{ client_id: 'client', client: 'Exact Studio', state: 'held', slots: [],
      unallocated: [{ role: 'master', task_id: 'm', reason: 'no_exact_numbered_slot' }, { role: 'monthly', task_id: 'o', reason: 'no_exact_numbered_slot' }] }] }] }
  const packet = { contract: 'teams_full_source_package_review_v1', writes: 0, apply_ready: false, clients: [{ client_id: 'client', client: 'Exact Studio', package_readback: 'numeric_mix_and_confirmation_timestamp_match' }] }
  return { input, audit, packet }
}
const review = f => reviewHeldScheduleEvidence(f.input, f.audit, f.packet, parse).reviews[0]

test('unique source video and confirmed singleton resolve capacity evidence, never a slot, date, package edit or apply', () => {
  const f = fixture(), before = structuredClone(f), r = review(f)
  assert.equal(r.evidence_state, 'evidence_resolved_no_client_decision')
  assert.equal(r.formats.find(f => f.type === 'video').verdict, 'singleton_format_evidence_resolved_no_slot_assigned')
  assert.equal(r.canonical_slot_state, 'unchanged_held'); assert.equal(r.posting_dates_assigned, 0)
  assert.equal(r.proposed_package_changes, 0); assert.equal(r.proposed_schedule_writes, 0)
  assert.deepEqual(f, before)
})
test('multi-video capacity match cannot guess the missing number or choose a compatible template', () => {
  const f = fixture(); f.input.clients[0].package_settings.professional_videos_per_month = 2
  for (const [role, b] of [['master', f.input.master.buckets[0]], ['monthly', f.input.months[0].buckets[0]]]) b.tasks.push({ ...b.tasks[0], id: `${role}-second`, title: 'VIDEO 2 - Exact Studio' })
  const r = review(f), video = r.formats.find(f => f.type === 'video')
  assert.equal(video.verdict, 'format_count_aligned_numbered_allocation_held'); assert.equal(video.canonical_slot_assignment, null)
  assert.equal(r.evidence_state, 'remaining_source_or_scope_review')
})
test('null/flexible/unknown never becomes zero and existing template or source video never confirms quantity', () => {
  for (const quantity of [null, undefined, 0]) {
    const f = fixture(); f.input.clients[0].package_settings.professional_videos_per_month = quantity
    const r = review(f), video = r.formats.find(f => f.type === 'video')
    assert.equal(video.confirmed_quantity, quantity === 0 ? 0 : null)
    assert.notEqual(video.verdict, 'singleton_format_evidence_resolved_no_slot_assigned')
    assert.equal(r.formats.find(f => f.type === 'photo').confirmed_quantity, null)
  }
})
test('monthly completion and equal titles never delete duplicate identities or assert publication/history', () => {
  const f = fixture(), b = f.input.months[0].buckets[0]; b.tasks.push({ ...b.tasks[0], id: 'second', percent_complete: 100 })
  f.audit.months[0].slot_review[0].slots.push({ slot: 'video/1', master_task_ids: ['m'], monthly_task_ids: ['o', 'second'] })
  const r = review(f), video = r.formats.find(f => f.type === 'video')
  assert.equal(video.verdict, 'duplicate_source_slot_held'); assert.equal(r.source_evidence.length, 3)
  assert.equal(r.proposed_schedule_writes, 0)
})
test('completed master history stays out of active capacity, unlike completed monthly evidence', () => {
  const f = fixture(), b = f.input.master.buckets[0]; b.tasks.push({ ...b.tasks[0], id: 'old', percent_complete: 100 })
  assert.equal(review(f).source_evidence.length, 2)
})
test('missing exact monthly bucket remains absence of planning evidence, not zero package or performance', () => {
  const f = fixture(); f.input.months[0].buckets = []; f.audit.months[0].buckets = []
  const r = review(f); assert.ok(r.issues.some(i => i.verdict === 'exact_monthly_bucket_not_observed'))
  assert.equal(r.formats.find(f => f.type === 'video').confirmed_quantity, 1)
  assert.equal(r.evidence_state, 'remaining_source_or_scope_review')
})
test('noncanonical web/T/unnumbered-photo cards stay separate and cannot be renamed to satisfy scope', () => {
  for (const title of ['WEB - Exact Studio', 'T 1 - Exact Studio', 'F - Exact Studio']) {
    const f = fixture(); f.input.months[0].buckets[0].tasks[0].title = title
    assert.ok(review(f).issues.some(i => i.verdict === 'noncanonical_card_purpose_or_scope_held'))
  }
})
test('unsafe cross-client/private source scope cannot be promoted by singleton package count', () => {
  const f = fixture(); f.audit.months[0].slot_review[0].unallocated[1].reason = 'identity_or_private_scope_held'
  const r = review(f); assert.notEqual(r.evidence_state, 'evidence_resolved_no_client_decision')
  assert.equal(r.source_evidence.find(r => r.role === 'monthly').type, null)
})
test('inactive/foreign client, plan, bucket, source completeness, period and package readback gates fail closed', () => {
  for (const mutate of [f => f.input.clients[0].active = false, f => f.packet.clients[0].client_id = 'foreign',
    f => f.audit.months[0].period_verified = false, f => f.audit.months[0].source_complete = false,
    f => f.audit.native_master_export_proof = null,
    f => f.audit.months[0].slot_review[0].slots.push({ verdict: 'coverage_or_identity_or_period_held' }),
    f => f.input.months[0].buckets[0].tasks[0].plan_id = 'foreign', f => f.input.months[0].buckets[0].tasks[0].bucket_id = 'foreign']) {
    const f = fixture(); mutate(f); assert.throws(() => review(f))
  }
  const f = fixture(); f.packet.clients[0].package_readback = 'held_missing_or_changed_package_receipt'
  assert.equal(review(f).evidence_state, 'remaining_source_or_scope_review')
})
test('CLI re-executes actual strict audit; forged audit/source/authority drift refuses output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-held-cli-'))
  try {
    const f = fixture(), inputPath = join(dir, 'input.json'), auditPath = join(dir, 'audit.json'), packetPath = join(dir, 'packet.json'), authorityPath = join(dir, 'authority.json'), out = join(dir, 'result.json')
    const sha = s => createHash('sha256').update(s).digest('hex')
    writeFileSync(inputPath, JSON.stringify(f.input)); writeFileSync(auditPath, JSON.stringify(f.audit)); writeFileSync(authorityPath, '{}')
    f.packet.source_hashes = [sha(readFileSync(auditPath)), sha(readFileSync(inputPath))]; writeFileSync(packetPath, JSON.stringify(f.packet))
    assert.throws(() => execFileSync(process.execPath, ['scripts/teams-held-evidence-review.mjs', auditPath, inputPath, packetPath, authorityPath, out], { stdio: 'pipe' }))
    f.input.clients[0].package_settings.professional_videos_per_month = 9; writeFileSync(inputPath, JSON.stringify(f.input))
    assert.throws(() => execFileSync(process.execPath, ['scripts/teams-held-evidence-review.mjs', auditPath, inputPath, packetPath, authorityPath, out], { stdio: 'pipe' }), /Packet\/source drift/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('actual audit → numeric readback → held-review CLI succeeds, preserves originals and refuses overwrite/drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-held-pipeline-'))
  try {
    const f = fixture(), inputPath = join(dir, 'input.json'), auditPath = join(dir, 'audit.json'), packetPath = join(dir, 'packet.json'), authorityPath = join(dir, 'authority.json'), receiptPath = join(dir, 'receipt.json'), out = join(dir, 'result.json')
    const input = f.input
    input.aliases = []; input.templates = []; input.schedule = []
    const authority = { version: 1, source_ref: 'synthetic explicit owner receipt', relationship: 'monthly_cross_check_of_master_not_additional_capacity', master: { kind: 'owner_confirmed_master', plan_id: 'master' }, monthly: [{ month: '2026-10', plan_id: 'monthly' }] }
    for (const plan of [input.master, input.months[0]]) {
      plan.bucket_list_complete = true; plan.expected_bucket_count = 1
      const b = plan.buckets[0]; b.name = 'Exact Studio'; b.plan_id = plan === input.master ? 'master' : 'monthly'; b.read_complete = true; b.expected_count = b.tasks.length
    }
    const native = { binding: { ...authority.master, source_name: 'Exact Master', source_ref: authority.source_ref },
      receipt: { contract: 'planner_native_export_v1', plan: { 'Plan ID': 'master', 'Plan name': 'Exact Master', 'Date of export': '2026-10-19' }, file_sha256: 'a'.repeat(64),
        consolidated_task_identity_and_source_fields_match: true, buckets: [{ 'Bucket ID': 'master-bucket', 'Bucket Name': 'Exact Studio' }],
        tasks: [{ 'Task ID': 'm', 'Task Name': 'VIDEO - Exact Studio', Bucket: 'master-bucket', Status: 'Not started', 'Start date': null, 'Due date': null, 'Completed Date': null, Notes: null }], task_count: 1, bucket_count: 1, writes: 0, apply_ready: false },
      anchors: structuredClone(input.master.buckets) }
    input.master = verifyNativePlannerExport(native.receipt, native.binding, native.anchors)
    input.native_master_export = native
    input.clients[0].package_settings.verification.confirmed_at = '2026-09-23'
    writeFileSync(inputPath, JSON.stringify(input)); writeFileSync(authorityPath, JSON.stringify(authority))
    const exec = args => execFileSync(process.execPath, args, { stdio: 'pipe' })
    exec(['scripts/teams-readiness-audit.mjs', inputPath, '--authority', authorityPath, '--output', auditPath])
    const receipt = { contract: 'canonical_package_excerpt_readback_v1', read_only: true, clients: [{ client: { id: 'client', name: 'Exact Studio' }, observed_at: '2026-10-19T10:00:00Z', error: null, client_package_coverage: 'available', package_evidence: [{ authority: 'confirmed_client_package', source_id: 'client', field: 'actionPlan', excerpt: 'Confirmed 2026-09-23: 1 professional video.' }] }] }
    writeFileSync(receiptPath, JSON.stringify(receipt))
    exec(['scripts/teams-package-readback-review.mjs', auditPath, inputPath, receiptPath, packetPath])
    const paths = [auditPath, inputPath, packetPath, authorityPath], before = paths.map(p => readFileSync(p, 'utf8'))
    const run = path => exec(['scripts/teams-held-evidence-review.mjs', ...paths, path])
    run(out); const result = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(result.reviews[0].evidence_state, 'evidence_resolved_no_client_decision')
    assert.equal(result.writes, 0); assert.equal(result.apply_ready, false)
    assert.deepEqual(paths.map(p => readFileSync(p, 'utf8')), before)
    assert.throws(() => run(out), /New private output/)
    authority.monthly[0].month = '2025-10'; writeFileSync(authorityPath, JSON.stringify(authority))
    assert.throws(() => run(join(dir, 'drift.json')), /Audit\/source\/authority drift/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
