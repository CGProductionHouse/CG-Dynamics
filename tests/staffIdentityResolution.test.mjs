import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Canonical staff identity resolution (PR 1).
//
// The DIRECTORY below is the real production profile set. The imported segments
// are the real distinct values found in planner_tasks.assigned_to_name. Nothing
// in the implementation may name a person, so these tests also assert the same
// generic rules produce the right answer for a fabricated future hire.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const lib = read('../src/lib/staffIdentity.ts')
const sql = read('../supabase/migrations/20260805100000_canonical_staff_identity.sql')

let server, M

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  M = await server.ssrLoadModule('/src/lib/staffIdentity.ts')
})
after(async () => { await server.close() })

// Production profiles, verbatim.
const DIRECTORY = [
  { id: 'p-alana', fullName: 'Alana', email: 'alana@cgproductionhouse.com', role: 'team', isActive: true },
  { id: 'p-ca', fullName: 'CA', email: 'info@cgproductionhouse.com', role: 'admin', isActive: true },
  { id: 'p-christie', fullName: 'Christie-Ann', email: 'ca@cgproductionhouse.com', role: 'team', isActive: true },
  { id: 'p-qa', fullName: 'Codex Automated QA', email: 'codex-qa-admin@cgproductionhouse.com', role: 'admin', isActive: true },
  { id: 'p-franco', fullName: 'Franco', email: 'franco@cgproductionhouse.com', role: 'manager', isActive: true },
  { id: 'p-germarie', fullName: 'Ger-Marie', email: 'ger-marie@cgproductionhouse.com', role: 'team', isActive: true },
  { id: 'p-kg', fullName: 'KG', email: 'kg@cgproductionhouse.com', role: 'team', isActive: true },
  { id: 'p-sydney', fullName: 'Sydney', email: 'sydney@cgproductionhouse.com', role: 'manager', isActive: true },
]

// ── No hardcoding ───────────────────────────────────────────────────────────
test('the resolver contains no staff names or addresses', () => {
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const name of ['Franco', 'Sydney', 'Ger-Marie', 'Amonique', 'Christie', 'KG', 'Alana', 'Lessing', 'Oosthuizen', 'Pretorius', 'Groenewald', 'Fourie']) {
    assert.ok(!code.includes(name), `resolver must not mention ${name}`)
  }
  assert.ok(!code.includes('cgproductionhouse'))
  const sqlCode = sql.replace(/^\s*--.*$/gm, '')
  for (const name of ['Franco', 'Sydney', 'Amonique', 'Lessing', 'Oosthuizen']) {
    assert.ok(!sqlCode.includes(name), `migration must not mention ${name}`)
  }
})

// ── Splitting combined strings ──────────────────────────────────────────────
test('combined imported strings split into individual identities', () => {
  assert.deepEqual(M.splitIdentityString('Amonique Fourie;Franco Lessing'), ['Amonique Fourie', 'Franco Lessing'])
  // Production really contained doubled and trailing separators.
  assert.deepEqual(
    M.splitIdentityString('Christie-Ann Groenewald;;Sydney Oosthuizen;;Amonique Fourie;Franco Lessing;'),
    ['Christie-Ann Groenewald', 'Sydney Oosthuizen', 'Amonique Fourie', 'Franco Lessing'],
  )
  assert.deepEqual(M.splitIdentityString(''), [])
  assert.deepEqual(M.splitIdentityString(null), [])
})

test('the original imported text is preserved verbatim on every result', () => {
  const r = M.resolveTaskAssignment('Ger-Marie Pretorius;Franco Lessing', DIRECTORY)
  assert.deepEqual([...r.resolved, ...r.unresolved].map(x => x.segment), ['Ger-Marie Pretorius', 'Franco Lessing'])
})

// ── The 11 real production segments ─────────────────────────────────────────
test('every unambiguous production identity resolves, by a stated rule', () => {
  const expect = [
    ['Christie-Ann Groenewald', 'p-christie', 'unique_first_token'],
    ['Franco Lessing', 'p-franco', 'unique_first_token'],
    ['Sydney Oosthuizen', 'p-sydney', 'unique_first_token'],
    ['Ger-Marie Pretorius', 'p-germarie', 'unique_first_token'],
    ['KG', 'p-kg', 'exact_full_name'],
    ['Christie-Ann', 'p-christie', 'exact_full_name'],
    ['Franco', 'p-franco', 'exact_full_name'],
    ['Sydney', 'p-sydney', 'exact_full_name'],
    ['Ger-Marie', 'p-germarie', 'exact_full_name'],
  ]
  for (const [segment, profileId, rule] of expect) {
    const r = M.resolveIdentitySegment(segment, DIRECTORY)
    assert.equal(r.profileId, profileId, segment)
    assert.equal(r.matchRule, rule, segment)
    assert.equal(r.reason, null)
  }
})

test('a person with no account stays unresolved rather than being guessed', () => {
  // 4,053 production rows carry this name; there is no matching profile.
  const r = M.resolveIdentitySegment('Amonique Fourie', DIRECTORY)
  assert.equal(r.profileId, null)
  assert.equal(r.reason, 'no_match')
})

test('a genuinely ambiguous identity stays unresolved and names its candidates', () => {
  // "CA" is one profile's full name AND another profile's email local part.
  const r = M.resolveIdentitySegment('CA', DIRECTORY)
  assert.equal(r.profileId, null)
  assert.equal(r.reason, 'ambiguous')
  assert.equal(r.candidateIds.length, 2)
})

test('the same ambiguity is reported as a duplicate-account signal', () => {
  const dupes = M.findDuplicateIdentityForms(DIRECTORY)
  assert.ok(dupes.some(d => d.profileIds.length > 1), 'a shared identity form must be surfaced')
})

// ── Generic for future staff, with no code change ───────────────────────────
test('a brand-new hire resolves through the identical rules', () => {
  const withHire = [...DIRECTORY, { id: 'p-new', fullName: 'Thandiwe', email: 'thandiwe@cgproductionhouse.com', role: 'team', isActive: true }]
  assert.equal(M.resolveIdentitySegment('Thandiwe Mokoena', withHire).profileId, 'p-new')
  assert.equal(M.resolveIdentitySegment('Thandiwe', withHire).profileId, 'p-new')
  // And before that person exists, the same name is honestly unresolved.
  assert.equal(M.resolveIdentitySegment('Thandiwe Mokoena', DIRECTORY).reason, 'no_match')
})

test('two future staff sharing a first name are ambiguous, never guessed', () => {
  const twins = [...DIRECTORY,
    { id: 'p-a', fullName: 'Jordan Smith', email: 'jordan.smith@cgproductionhouse.com', role: 'team', isActive: true },
    { id: 'p-b', fullName: 'Jordan Brown', email: 'jordan.brown@cgproductionhouse.com', role: 'team', isActive: true }]
  const r = M.resolveIdentitySegment('Jordan', twins)
  assert.equal(r.profileId, null)
  assert.equal(r.reason, 'ambiguous')
})

test('inactive and client accounts are never resolution targets', () => {
  const mixed = [
    { id: 'p-old', fullName: 'Retired Person', email: 'retired@cgproductionhouse.com', role: 'team', isActive: false },
    { id: 'p-client', fullName: 'Client Person', email: 'someone@aclient.co.za', role: 'client', isActive: true },
  ]
  assert.equal(M.resolveIdentitySegment('Retired Person', mixed).reason, 'no_match')
  assert.equal(M.resolveIdentitySegment('Client Person', mixed).reason, 'no_match')
})

// ── Production acceptance cases ─────────────────────────────────────────────
test('HENDE - LINKDN PROFILE: an unambiguous identity is no longer Unassigned', () => {
  const r = M.resolveTaskAssignment('Franco Lessing', DIRECTORY)
  assert.equal(r.resolved.length, 1)
  assert.equal(r.resolved[0].profileId, 'p-franco')
  assert.equal(r.reviewState, 'ok')
})

test('DESIGN FOR OAK MAP: both named people resolve from the imported evidence', () => {
  const r = M.resolveTaskAssignment('Ger-Marie Pretorius;Franco Lessing', DIRECTORY)
  assert.deepEqual(r.resolved.map(x => x.profileId).sort(), ['p-franco', 'p-germarie'])
  assert.equal(r.reviewState, 'ok')
})

test('a task with one unresolvable co-assignee keeps its real links but is held back', () => {
  // "Amonique Fourie;Franco Lessing": Franco genuinely IS an assignee, so the
  // link is real — but ownership is only partly known, so the task must not be
  // presented as Franco's confirmed work.
  const r = M.resolveTaskAssignment('Amonique Fourie;Franco Lessing', DIRECTORY)
  assert.equal(r.resolved.length, 1)
  assert.equal(r.resolved[0].profileId, 'p-franco')
  assert.equal(r.unresolved.length, 1)
  assert.equal(r.unresolved[0].segment, 'Amonique Fourie')
  assert.equal(r.reviewState, 'unresolved')
  assert.equal(M.canAppearInPersonSummary(r.reviewState), false)
})

test('unresolved and conflicting ownership never reaches a person summary', () => {
  assert.equal(M.canAppearInPersonSummary('ok'), true)
  assert.equal(M.canAppearInPersonSummary('unresolved'), false)
  assert.equal(M.canAppearInPersonSummary('conflict'), false)
})

// ── Database is the enforcement authority ───────────────────────────────────
test('the migration derives staff dynamically and resolves by the same rules', () => {
  assert.match(sql, /from public\.profiles\s*\n?\s*where is_active and role in \('admin', 'manager', 'team'\)/)
  assert.match(sql, /exact_full_name/)
  assert.match(sql, /exact_email_local/)
  assert.match(sql, /unique_first_token/)
  // Only a single match may resolve.
  assert.match(sql, /array_length\(v_ids, 1\) = 1/)
  assert.match(sql, /'ambiguous'/)
  assert.match(sql, /'no_match'/)
})

test('the migration keeps an audit trail and a rollback path', () => {
  assert.match(sql, /create table if not exists public\.staff_identity_aliases/)
  assert.match(sql, /create table if not exists public\.staff_identity_review/)
  assert.match(sql, /create table if not exists public\.assignment_corrections/)
  assert.match(sql, /before_value jsonb/)
  assert.match(sql, /after_value jsonb/)
  assert.match(sql, /reverted_at timestamptz/)
})

test('the review state gates person-specific summaries at the database level', () => {
  assert.match(sql, /assignment_review_state text not null default 'ok'/)
  assert.match(sql, /check \(assignment_review_state in \('ok', 'unresolved', 'conflict'\)\)/)
  assert.match(sql, /excluded from person-specific summaries/)
})

test('PR 1 does no title-based task deduplication — that is PR 2', () => {
  const code = lib.replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/dedup|duplicate.*title|title.*match/i.test(code), 'no title dedup belongs in PR 1')
  assert.ok(!/delete from public\.planner_tasks/i.test(sql), 'PR 1 must never delete tasks')
  assert.ok(!/update public\.planner_tasks[\s\S]{0,200}set assigned_to_name/i.test(sql), 'PR 1 must never rewrite imported text')
})
