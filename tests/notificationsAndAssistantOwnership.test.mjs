import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Canonical ownership for notifications and CG Assistant context (PR 3B).
//
// generate_due_assistant_notifications joined the canonical assignee table but
// ignored assignment_review_state and superseded_by_task_id. PR 1's 1,370 new
// canonical links therefore became notification candidates for unresolved and
// conflicted work — the fix made the notification path WORSE until now.
//
// Live dry run before/after (due-date window removed to isolate the filter):
//   78 candidates / 50 tasks  ->  23 candidates / 19 tasks
//   33 unresolved, 17 conflicted, 8 superseded, 10 helper rows blocked
//   CG TV VIDEO - RED OAK TV: 4 -> 0

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20260805120000_canonical_ownership_notifications.sql')
const planner = read('../src/lib/planner.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const assistant = read('../src/lib/assistant.ts')
const myDay = read('../src/lib/workforceMyDay.ts')

// ── Notifications ───────────────────────────────────────────────────────────
test('the notification defect and its measured impact are recorded', () => {
  assert.match(sql, /ignored PR 1's assignment_review_state and PR 2's supersession pointer/)
  assert.match(sql, /78 person-specific candidates across 50 distinct tasks/)
  assert.match(sql, /23 genuinely verified across 19 distinct tasks/)
  assert.match(sql, /CG TV VIDEO - RED OAK TV: 4 candidate notifications -> 0/)
})

test('person-specific notifications require canonical, non-superseded, verified tasks', () => {
  assert.match(sql, /from public\.planner_tasks_canonical\s+\(excludes archived \+ superseded\)/)
  assert.match(sql, /and task\.assignment_review_state = 'ok'\s+\(PR 1 verification gate\)/)
})

test('a helper never receives an owner notification', () => {
  assert.match(sql, /and NOT the person appearing in helper_names/)
})

test('unresolved and conflicting ownership raises a manager alert instead of being dropped', () => {
  assert.match(sql, /manager review alert so unresolved and conflicting ownership is\s*\n--\s*surfaced rather than silently dropped/)
})

// ── Assistant context ───────────────────────────────────────────────────────
test('the ownership review summary is manager gated server-side', () => {
  const fn = sql.slice(sql.indexOf('function public.assistant_ownership_review_summary'))
  assert.match(fn, /if not coalesce\(public\.is_manager\(\), false\) then/)
  assert.match(fn, /Manager access is required/)
  assert.match(fn, /revoke all on function public\.assistant_ownership_review_summary\(\) from public, anon/)
})

test('the summary reads canonical tasks only', () => {
  const fn = sql.slice(sql.indexOf('function public.assistant_ownership_review_summary'))
  assert.match(fn, /from public\.planner_tasks_canonical/)
  assert.ok(!/from public\.planner_tasks\b(?!_canonical)/.test(fn), 'must not read the base table')
})

test('the summary carries evidence without naming an owner', () => {
  const fn = sql.slice(sql.indexOf('function public.assistant_ownership_review_summary'))
  for (const field of ['importedText', 'unresolvedNames', 'helperEvidence', 'plannerLinked', 'canonicalLinks']) {
    assert.ok(fn.includes(field), `conflict evidence must include ${field}`)
  }
  assert.match(fn, /Never state that such a task belongs to a specific person/)
})

test('the Assistant is told the rule, not left to infer it', () => {
  assert.match(composer, /These have NO verified owner — never say such a task belongs to a specific person; say it needs assignment review\./)
})

test('ownership review reaches managers only', () => {
  assert.match(composer, /if \(isManager && ownershipReviewRef\.current\) parts\.push\(ownershipReviewRef\.current\)/)
  // Guarded by the same isManager block that gates the cross-team summary.
  const start = composer.indexOf('if (isManager) {')
  const block = composer.slice(start, composer.indexOf('admin-gated server-side', start))
  assert.match(block, /loadOwnershipReviewSummary\(\)/)
})

test('the review state is cleared when the signed-in user changes', () => {
  assert.match(composer, /ownershipReviewRef\.current = null/)
})

test('the data call lives in the lib, not the component', () => {
  assert.match(planner, /export async function loadOwnershipReviewSummary/)
  assert.match(planner, /assistant_ownership_review_summary/)
  assert.ok(!composer.includes("supabase.rpc('assistant_ownership_review_summary')"),
    'the component must not call the RPC directly')
})

// ── Personal Assistant context inherits the PR 3 fix ────────────────────────
test('personal Assistant task context comes from canonical My Day matching', () => {
  // buildAssistantLocalWorkContext reads MyDayContext, whose userMatches was
  // made canonical-id-only in PR 3. No name or helper matching remains.
  assert.match(assistant, /export function buildAssistantLocalWorkContext/)
  const fn = myDay.slice(myDay.indexOf('function userMatches'), myDay.indexOf('function localMinutesFromIso'))
  const code = fn.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\*\*[\s\S]*?\*\//m, '')
  assert.ok(!/nameMatches\(/.test(code))
  assert.ok(!/helperMatches\(/.test(code))
  assert.match(fn, /if \(reviewState && reviewState !== 'ok'\) return false/)
})

test('the stale name/helper setup note is gone', () => {
  assert.ok(!assistant.includes('name/helper-based imported work may be incomplete'),
    'the note implied name matching still happens')
  assert.match(assistant, /Task ownership is resolved by canonical user id/)
})

// ── No second ownership implementation ─────────────────────────────────────
test('PR 3B adds no competing ownership logic', () => {
  for (const file of [planner, composer]) {
    const code = file.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(!/helper_names.*===.*profile|profile.*===.*helper_names/.test(code))
  }
  // Ownership truth still has exactly one home.
  assert.ok(!planner.includes('export function resolveOwnership'))
  assert.ok(!composer.includes('export function resolveOwnership'))
})
