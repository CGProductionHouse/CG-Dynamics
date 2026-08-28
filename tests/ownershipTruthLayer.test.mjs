import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Operational truth layer (PR 3).
//
// The two false-output paths this closes, both confirmed in production code:
//
//   CommandCentrePage.staffGroups  grouped by `assigned_to_name`, a RAW
//                                  imported string, so "Sydney Oosthuizen;
//                                  Franco Lessing" became a staff heading.
//   workforceMyDay.userMatches     matched on assigned_to_name AND
//                                  helper_names, so a HELPER received the task
//                                  as their own work.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('../src/pages/admin/CommandCentrePage.tsx')
const myDay = read('../src/lib/workforceMyDay.ts')
const commandCentre = read('../src/lib/commandCentre.ts')

let server, M, T
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  M = await server.ssrLoadModule('/src/lib/taskOwnership.ts')
  T = await server.ssrLoadModule('/src/lib/taskLifecycle.ts')
})
after(async () => { await server.close() })

const DIR = new Map([['u-franco', 'Franco'], ['u-sydney', 'Sydney'], ['u-kg', 'KG']])

const verified = { assignee_user_ids: ['u-franco'], assignment_review_state: 'ok', assigned_to_name: 'Franco' }
const unresolved = {
  assignee_user_ids: ['u-franco'], assignment_review_state: 'unresolved',
  assigned_to_name: 'Amonique Fourie;Franco Lessing', unresolved_assignee_names: ['Amonique Fourie'],
}
const conflict = {
  assignee_user_ids: ['u-sydney', 'u-franco'], assignment_review_state: 'conflict',
  assigned_to_name: 'Sydney', helper_names: ['Franco'],
}
const unassigned = { assignee_user_ids: [], assignment_review_state: 'ok', assigned_to_name: null }

const own = t => M.resolveOwnership(M.taskOwnershipInput(t), DIR)

// ── The four states ─────────────────────────────────────────────────────────
test('verified work names its canonical owners', () => {
  const o = own(verified)
  assert.equal(o.state, 'verified')
  assert.deepEqual(o.owners.map(x => x.name), ['Franco'])
  assert.equal(M.mayAppearUnderPerson(o), true)
})

test('unresolved ownership names NOBODY, even where some names resolved', () => {
  const o = own(unresolved)
  assert.equal(o.state, 'unresolved')
  assert.deepEqual(o.owners, [], 'a partly-resolved task must not be attributed')
  assert.equal(M.mayAppearUnderPerson(o), false)
  // The imported evidence survives for the manager.
  assert.deepEqual(o.unresolvedNames, ['Amonique Fourie'])
  assert.equal(o.importedText, 'Amonique Fourie;Franco Lessing')
  assert.match(o.reason, /Amonique Fourie/)
})

test('a conflict names NOBODY and keeps helper evidence separate', () => {
  const o = own(conflict)
  assert.equal(o.state, 'conflict')
  assert.deepEqual(o.owners, [])
  assert.equal(M.mayAppearUnderPerson(o), false)
  assert.deepEqual(o.helpers, ['Franco'], 'helpers are evidence, never owners')
})

test('unassigned is not invented ownership', () => {
  const o = own(unassigned)
  assert.equal(o.state, 'unassigned')
  assert.deepEqual(o.owners, [])
})

// ── Integrity: what must never happen ───────────────────────────────────────
test('an unresolved or conflict task never reaches a named staff section', () => {
  const g = M.groupByOwnership([verified, unresolved, conflict, unassigned], M.taskOwnershipInput, DIR)
  const named = [...g.byOwner.values()].flatMap(e => e.items)
  assert.equal(named.length, 1)
  assert.equal(named[0], verified)
  assert.equal(g.needsAssignmentReview.length, 1)
  assert.equal(g.assignmentConflict.length, 1)
  assert.equal(g.unassigned.length, 1)
})

test('a task appears in exactly one bucket', () => {
  const items = [verified, unresolved, conflict, unassigned]
  const g = M.groupByOwnership(items, M.taskOwnershipInput, DIR)
  const total = [...g.byOwner.values()].flatMap(e => e.items).length
    + g.needsAssignmentReview.length + g.assignmentConflict.length + g.unassigned.length
  assert.equal(total, items.length)
})

test('helper text is never promoted to a primary owner', () => {
  const helperOnly = { assignee_user_ids: [], assignment_review_state: 'ok', helper_names: ['Franco'], assigned_to_name: null }
  const o = own(helperOnly)
  assert.equal(o.state, 'unassigned')
  assert.equal(M.isVerifiedOwner(o, 'u-franco'), false)
})

test('free-text assigned_to_name never overrides canonical links', () => {
  // Text says KG, canonical link says Franco. Franco wins; KG is not an owner.
  const o = own({ assignee_user_ids: ['u-franco'], assignment_review_state: 'ok', assigned_to_name: 'KG' })
  assert.deepEqual(o.owners.map(x => x.id), ['u-franco'])
  assert.equal(M.isVerifiedOwner(o, 'u-kg'), false)
})

test('ownership is decided by user id, never by display name', () => {
  const o = own(verified)
  assert.equal(M.isVerifiedOwner(o, 'u-franco'), true)
  assert.equal(M.isVerifiedOwner(o, 'Franco'), false, 'a name must never satisfy an id check')
  assert.equal(M.isVerifiedOwner(o, null), false)
})

test('counts are truthful and never hide the unresolved backlog', () => {
  const g = M.groupByOwnership([verified, unresolved, unresolved, conflict, unassigned], M.taskOwnershipInput, DIR)
  assert.deepEqual(M.ownershipCounts(g), { verified: 1, needsReview: 2, conflicts: 1, unassigned: 1 })
})

// ── Consumers actually use it ───────────────────────────────────────────────
test('the morning message builds from the ownership grouping, not free text', () => {
  const fn = page.slice(page.indexOf('function buildMorningMessage'), page.indexOf('function buildEndOfDay'))
  assert.match(fn, /grouping: OwnershipGrouping<CommandCentreTask>/)
  assert.match(fn, /grouping\.byOwner\.values\(\)/)
  assert.match(fn, /@\$\{person\.name\}/)
  const code = fn.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!code.includes('assigned_to_name'), 'the morning message must not read imported text')
})

test('the morning message carries a manager-only review block', () => {
  const fn = page.slice(page.indexOf('function buildMorningMessage'), page.indexOf('function buildEndOfDay'))
  assert.match(fn, /MANAGER REVIEW \(not sent to staff\)/)
  assert.match(fn, /Assignment conflict: \$\{counts\.conflicts\}/)
  assert.match(fn, /Needs assignment review: \$\{counts\.needsReview\}/)
})

test('end of day labels only verified owners', () => {
  const fn = page.slice(page.indexOf('function buildEndOfDay'), page.indexOf('export default function'))
  assert.match(fn, /ownership\.state === 'verified'/)
  assert.match(fn, /assignment conflict — needs review/)
  assert.match(fn, /needs assignment review/)
  const code = fn.replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/\$\{t\.assigned_to_name\}/.test(code), 'must not print imported text as the owner')
})

test('board grouping keys on verified owners with explicit review headings', () => {
  const block = page.slice(page.indexOf('const focusGroupEntries'), page.indexOf('const ownershipGrouping'))
  assert.match(block, /groupByOwnership\(focusTasks, taskOwnershipInput, staffDirectory\)/)
  assert.match(block, /'Assignment conflict'/)
  assert.match(block, /'Needs assignment review'/)
  assert.ok(!block.includes('assigned_to_name'))
})

test('My Work uses canonical ids only and honours the review state', () => {
  const fn = myDay.slice(myDay.indexOf('function userMatches'), myDay.indexOf('function localMinutesFromIso'))
  assert.match(fn, /if \(reviewState && reviewState !== 'ok'\) return false/)
  assert.match(fn, /assigneeUserIds\.includes\(profile\.id\)/)
  const code = fn.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\*\*[\s\S]*?\*\//m, '')
  assert.ok(!/nameMatches\(/.test(code), 'My Work must not match on names')
  assert.ok(!/helperMatches\(/.test(code), 'My Work must not match on helpers')
})

test('KNOWN_STAFF is no longer an ownership or grouping authority', () => {
  // Comments may still reference it historically; code may not use it.
  const code = page.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!code.includes('KNOWN_STAFF'), 'the page must not use a hardcoded staff list')
  assert.match(page, /listStaffProfiles\(\)/)
  assert.match(page, /const staffDirectory = useMemo/)
})

test('canonical fields are threaded through the task model', () => {
  assert.match(commandCentre, /assignment_review_state\?: string \| null/)
  assert.match(commandCentre, /superseded_by_task_id\?: string \| null/)
  assert.match(commandCentre, /assignment_review_state: row\.assignment_review_state \?\? 'ok'/)
})

test('the truthful counts are shown, not hidden', () => {
  assert.match(page, /data-testid="ownership-summary"/)
  assert.match(page, /\{ownershipTotals\.verified\} verified/)
  assert.match(page, /\{ownershipTotals\.needsReview\} need assignment review/)
  assert.match(page, /\{ownershipTotals\.conflicts\} assignment conflict/)
})

// ── Recurrence must not be collapsed ────────────────────────────────────────
test('grouping never collapses recurring instances by title', () => {
  const a = { ...verified, id: 'a', title: 'RED OAK TV', due_date: '2026-04-07' }
  const b = { ...verified, id: 'b', title: 'RED OAK TV', due_date: '2026-04-14' }
  const g = M.groupByOwnership([a, b], M.taskOwnershipInput, DIR)
  assert.equal(g.byOwner.get('u-franco').items.length, 2, 'two dated instances stay two tasks')
})

// ── isVerifiedWorkTask: operational focus excludes review backlog ──────────
test('isVerifiedWorkTask excludes unresolved tasks from operational focus', () => {
  const task = { status: 'to_do', assignment_review_state: 'unresolved' }
  assert.equal(T.isVerifiedWorkTask(task), false, 'unresolved must not count as verified work')
})

test('isVerifiedWorkTask excludes conflict tasks from operational focus', () => {
  const task = { status: 'to_do', assignment_review_state: 'conflict' }
  assert.equal(T.isVerifiedWorkTask(task), false, 'conflict must not count as verified work')
})

test('isVerifiedWorkTask includes verified tasks in operational focus', () => {
  const task = { status: 'to_do', assignment_review_state: 'ok' }
  assert.equal(T.isVerifiedWorkTask(task), true, 'verified ok tasks must remain in operational focus')
})

test('isVerifiedWorkTask treats missing review state as valid (compatibility)', () => {
  const task = { status: 'to_do' }
  assert.equal(T.isVerifiedWorkTask(task), true, 'tasks without review state must preserve current compatibility')
  const taskNull = { status: 'to_do', assignment_review_state: null }
  assert.equal(T.isVerifiedWorkTask(taskNull), true, 'null review state must preserve current compatibility')
})

test('isVerifiedWorkTask excludes completed tasks regardless of review state', () => {
  const done = { status: 'done', assignment_review_state: 'ok' }
  assert.equal(T.isVerifiedWorkTask(done), false, 'completed tasks must be excluded even if verified')
})

// ── Focus tasks pool uses verifiedActiveTasks ─────────────────────────────
test('Command Centre focusTasks pool uses verifiedActiveTasks, not allActiveTasks', () => {
  assert.match(page, /const taskPool = workFilter === 'done' \? tasks : verifiedActiveTasks/)
  assert.ok(!page.includes("workFilter === 'done' ? tasks : allActiveTasks"),
    'focusTasks must not fall back to allActiveTasks for operational filters')
})

// ── Stats use verifiedActiveTasks ──────────────────────────────────────────
test('Command Centre stats use verifiedActiveTasks for operational counts', () => {
  assert.match(page, /clientRequests: verifiedActiveTasks\.filter/)
  assert.match(page, /inProgress: verifiedActiveTasks\.filter/)
  assert.match(page, /overdue: verifiedActiveTasks\.filter/)
  assert.match(page, /today: verifiedActiveTasks\.filter/)
})

// ── Ownership review section still uses allActiveTasks ────────────────────
test('ownership review section still shows full backlog via allActiveTasks', () => {
  assert.match(page, /groupByOwnership\(allActiveTasks, taskOwnershipInput, staffDirectory\)/,
    'ownershipGrouping must still use allActiveTasks to show the full review backlog')
})
