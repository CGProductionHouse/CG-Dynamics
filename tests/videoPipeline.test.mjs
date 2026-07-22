import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Pure video-pipeline rules are loaded through Vite SSR (no Supabase import, so
// nothing hits the network). Migration and Client Schedule contracts are
// validated by parsing source files. No database is touched.

let server
let r

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  r = await server.ssrLoadModule('/src/lib/videoPipelineRules.ts')
})
after(async () => { await server?.close() })

// ── 1–4 canonical name + sanitisation + client codes ──────────────────────────

test('1. canonical name generation', () => {
  assert.equal(
    r.buildCanonicalName({ month: '2026-07', clientCode: 'DULUX', videoNumber: 1, conceptTitle: 'ASMR Mixing Station' }),
    '2026_07_DULUX_VIDEO_01_ASMR_MIXING_STATION',
  )
})

test('2. punctuation, emoji and slashes collapse to single underscores', () => {
  assert.equal(r.sanitiseSegment('ASMR / Mixing—Station!! 🎬'), 'ASMR_MIXING_STATION')
  assert.equal(r.sanitiseSegment('  leading & trailing  '), 'LEADING_TRAILING')
})

test('3. Dulux derives DULUX', () => {
  assert.equal(r.deriveClientCode('Dulux Paint Bloemfontein'), 'DULUX')
})

test('4. Econo derives ECONO', () => {
  assert.equal(r.deriveClientCode('Econo Foods'), 'ECONO')
  assert.equal(r.deriveClientCode('Econo'), 'ECONO')
})

test('5. linked deliverable instance_number supplies the video number', () => {
  assert.equal(r.videoNumberFromInstance(1), 1)
  assert.equal(r.videoNumberFromInstance(null), null)
  assert.equal(
    r.buildCanonicalName({ month: '2026-07', clientCode: 'DULUX', videoNumber: r.videoNumberFromInstance(1), conceptTitle: 'x' }),
    '2026_07_DULUX_VIDEO_01_X',
  )
})

test('6. explicit client-code override wins over derivation', () => {
  // The UI passes folder_client_code straight through to clientCode.
  assert.equal(
    r.buildCanonicalName({ month: '2026-07', clientCode: 'CUSTOM', videoNumber: 2, conceptTitle: 'Y' }),
    '2026_07_CUSTOM_VIDEO_02_Y',
  )
})

// ── 9–18 transitions ──────────────────────────────────────────────────────────

const ok = (status, action, ctx) => r.applyVideoTransition(status, action, ctx)

test('9. not_shot -> shot', () => {
  assert.deepEqual(ok('not_shot', 'mark_shot'), { ok: true, next: 'shot' })
})

test('10. shot -> ready_to_edit requires a footage URL', () => {
  assert.equal(ok('shot', 'mark_footage_uploaded', {}).ok, false)
  assert.equal(ok('shot', 'mark_footage_uploaded', { footageUrl: 'not-a-url' }).ok, false)
  assert.deepEqual(ok('shot', 'mark_footage_uploaded', { footageUrl: 'https://onedrive.example/f' }), { ok: true, next: 'ready_to_edit' })
})

test('11. ready_to_edit -> editing requires an editor', () => {
  assert.equal(ok('ready_to_edit', 'start_editing', {}).ok, false)
  assert.deepEqual(ok('ready_to_edit', 'start_editing', { editorUserId: 'user-1' }), { ok: true, next: 'editing' })
})

test('12. editing -> internal_review', () => {
  assert.deepEqual(ok('editing', 'send_to_internal_review'), { ok: true, next: 'internal_review' })
})

test('13. internal_review -> internal_changes', () => {
  assert.deepEqual(ok('internal_review', 'request_internal_changes'), { ok: true, next: 'internal_changes' })
})

test('14. internal_review -> ready_for_client', () => {
  assert.deepEqual(ok('internal_review', 'approve_internal'), { ok: true, next: 'ready_for_client' })
})

test('15. ready_for_client -> sent_to_client requires a client approval URL', () => {
  assert.equal(ok('ready_for_client', 'mark_sent_to_client', {}).ok, false)
  assert.deepEqual(ok('ready_for_client', 'mark_sent_to_client', { clientApprovalUrl: 'https://x.example/a' }), { ok: true, next: 'sent_to_client' })
})

test('16. sent_to_client -> client_changes', () => {
  assert.deepEqual(ok('sent_to_client', 'request_client_changes'), { ok: true, next: 'client_changes' })
})

test('17. sent_to_client -> client_approved', () => {
  assert.deepEqual(ok('sent_to_client', 'mark_client_approved'), { ok: true, next: 'client_approved' })
  // internal_changes and client_changes both resume editing.
  assert.deepEqual(ok('internal_changes', 'resume_editing'), { ok: true, next: 'editing' })
  assert.deepEqual(ok('client_changes', 'resume_editing'), { ok: true, next: 'editing' })
})

test('18. impossible transitions fail', () => {
  assert.equal(ok('not_shot', 'mark_client_approved').ok, false)
  assert.equal(ok('editing', 'mark_client_approved').ok, false)
  assert.equal(ok('not_shot', 'start_editing', { editorUserId: 'u' }).ok, false)
  assert.equal(ok('client_approved', 'mark_shot').ok, false)
})

// ── 19–20 queue visibility ────────────────────────────────────────────────────

test('19. My Video Queue shows an editor their active videos only', () => {
  assert.equal(r.editorQueueMatch({ editor_user_id: 'me', production_status: 'editing' }, 'me'), true)
  assert.equal(r.editorQueueMatch({ editor_user_id: 'me', production_status: 'ready_to_edit' }, 'me'), true)
  assert.equal(r.editorQueueMatch({ editor_user_id: 'me', production_status: 'sent_to_client' }, 'me'), false)
  assert.equal(r.editorQueueMatch({ editor_user_id: 'other', production_status: 'editing' }, 'me'), false)
})

test('20. internal review visibility is manager/admin-only', () => {
  assert.equal(r.internalReviewMatch({ production_status: 'internal_review' }, true), true)
  assert.equal(r.internalReviewMatch({ production_status: 'internal_review' }, false), false)
  assert.equal(r.internalReviewMatch({ production_status: 'editing' }, true), false)
})

// ── 21 URL validation ─────────────────────────────────────────────────────────

test('21. URL validation rejects non-http/https schemes', () => {
  assert.equal(r.isSafeHttpUrl('https://onedrive.live.com/folder'), true)
  assert.equal(r.isSafeHttpUrl('http://example.com/a-b_c'), true)
  assert.equal(r.isSafeHttpUrl('javascript:alert(1)'), false)
  assert.equal(r.isSafeHttpUrl('data:text/html,x'), false)
  assert.equal(r.isSafeHttpUrl('file:///etc/passwd'), false)
  assert.equal(r.isSafeHttpUrl('/relative/path'), false)
  assert.equal(r.isSafeHttpUrl(''), false)
  assert.equal(r.isSafeHttpUrl(null), false)
})

// ── 7–8, 22 migration contract ────────────────────────────────────────────────

const MIG = readFileSync(new URL('../supabase/phase-19e-video-production-pipeline.sql', import.meta.url), 'utf8')

test('7–8. one active guide per deliverable; archived does not block a replacement', () => {
  // Partial unique index on deliverable_id, excluding archived rows.
  assert.match(MIG, /create unique index if not exists uniq_content_guide_active_deliverable/)
  assert.match(MIG, /on public\.content_guide_ideas \(deliverable_id\)[\s\S]*?where deliverable_id is not null and status <> 'archived'/)
  // Duplicates are detected and refused, not deleted or guessed.
  assert.match(MIG, /raise exception 'phase-19e blocked/)
  assert.doesNotMatch(MIG, /delete from public\.content_guide_ideas/i)
})

test('22. phase-19e is additive and does not weaken RLS', () => {
  assert.match(MIG, /add column if not exists/)
  assert.doesNotMatch(MIG, /drop policy/i)
  assert.doesNotMatch(MIG, /disable row level security/i)
  assert.doesNotMatch(MIG, /drop table/i)
  // No client access is introduced.
  assert.doesNotMatch(MIG, /role\s*=\s*'client'/)
  assert.doesNotMatch(MIG, /to public/i)
  // production_status constraint has the exact ten values.
  for (const status of ['not_shot', 'shot', 'ready_to_edit', 'editing', 'internal_review', 'internal_changes', 'ready_for_client', 'sent_to_client', 'client_changes', 'client_approved']) {
    assert.ok(MIG.includes(`'${status}'`), `constraint must list ${status}`)
  }
})

// ── 23 Client Schedule calendar labels unchanged ──────────────────────────────

test('23. Client Schedule keeps its deliverable label rendering', () => {
  const CS = readFileSync(new URL('../src/pages/admin/ClientSchedulePage.tsx', import.meta.url), 'utf8')
  // The drawer/calendar label is still the schedule code + title, not the concept title.
  assert.match(CS, /\{displayCode\(deliverable\)\} · \{deliverable\.title\}/)
  // The linked-video section is read-only (an Open link, no writes to the schedule).
  assert.match(CS, /Open in Content Workflow/)
  assert.doesNotMatch(CS, /updateMonthlyDeliverable\w*\([^)]*canonical_name/)
})
