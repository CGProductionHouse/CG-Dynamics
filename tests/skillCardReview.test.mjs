import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20260803090000_skill_card_review_workflow.sql')
const page = read('../src/pages/admin/SkillCardReviewPage.tsx')
const nav = read('../src/pages/admin/adminNavigation.ts')
const app = read('../src/App.tsx')

// Extract exactly one function body, so an assertion about one function can
// never accidentally read the next one.
function fnBody(name) {
  const start = sql.indexOf(`function public.${name}`)
  assert.ok(start > -1, `function not found: ${name}`)
  const rest = sql.slice(start + 1)
  const next = rest.search(/^create or replace function/m)
  return next === -1 ? sql.slice(start) : sql.slice(start, start + 1 + next)
}

let server, lib
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  lib = await server.ssrLoadModule('/src/lib/skillCardReview.ts')
})
after(async () => { await server.close() })

const card = (o = {}) => ({
  id: 'c1', slug: 's', title: 'T', category: 'Marketing Library', subcategory: null,
  status: 'needs_review', knowledge_layer: 'universal_principle', principle: 'P', summary: 'S',
  why_it_matters: null, how_to_apply: null, agent_instructions: null, safe_claim: null,
  prohibited_overclaim: null, jurisdiction: null, evidence_label: 'proven_principle',
  confidence_level: 'high', source_reference: null, reference_state: null,
  relevant_agents: ['marketing_strategist'], resolved_agents: ['marketing_strategist'],
  unrecognised_agents: [], relevant_industries: null, client_specific: false,
  active_client_id: null, active_client_name: null, active_client_is_active: null,
  source_id: 'src', source_name: 'Book', source_trust_tier: 'tier_1_primary',
  last_reviewed: null, review_expires_at: null, review_count: 0, approved_review_count: 0,
  latest_review_status: null, latest_review_by: null, latest_review_notes: null,
  latest_reviewed_at: null, blockers: [], ready_to_activate: false, priority_group: 2, ...o,
})

// ── The gate is strengthened, never weakened ────────────────────────────────
test('the activation gate keeps every original requirement', () => {
  const gate = fnBody('enforce_skill_card_activation_gate')
  for (const req of [
    'a linked source is required',
    'the linked source could not be found',
    'is not trusted enough',
    'at least one approved review is required',
    'last_reviewed must be set',
  ]) assert.ok(gate.includes(req), `gate lost: ${req}`)
  assert.match(gate, /needs_review', 'tier_4_low_trust'/)
})

test('the gate now also requires an exact ACTIVE client for client-specific cards', () => {
  const gate = fnBody('enforce_skill_card_activation_gate')
  assert.match(gate, /if new\.client_specific then/)
  assert.match(gate, /client-specific card requires an exact active client/)
  assert.match(gate, /the linked client is not active/)
})

test('activation happens one card at a time — there is no bulk path', () => {
  assert.match(sql, /function public\.skill_card_activate\(\s*p_card_id uuid\s*\)/)
  // No statement that flips many cards to active at once.
  assert.doesNotMatch(sql, /update public\.skill_cards set status = 'active'\s+where status/i)
  assert.doesNotMatch(sql, /update public\.skill_cards set status = 'active';/)
  assert.doesNotMatch(page, /activateAll|bulkActivate|Activate all/i)
})

test('review and activation are admin-gated', () => {
  for (const fn of ['skill_card_record_review', 'skill_card_activate']) {
    const body = fnBody(fn)
    assert.match(body, /security definer/)
    assert.match(body, /if not public\.is_admin\(\) then/)
  }
  assert.match(sql, /where public\.is_admin\(\)/) // the queue itself
  for (const fn of ['canonical_agent_key\\(text\\)', 'skill_card_review_queue\\(\\)',
                    'skill_card_record_review\\(uuid, text, text, jsonb\\)', 'skill_card_activate\\(uuid\\)']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn} from public, anon`))
  }
})

test('approving records the review date but never activates', () => {
  const body = fnBody('skill_card_record_review')
  assert.match(body, /if p_decision = 'approved' then\s+update public\.skill_cards set last_reviewed = now\(\)/)
  assert.doesNotMatch(body, /set status = 'active'/)
})

test('reviewer edits are limited to wording; routing and provenance are untouchable', () => {
  const body = fnBody('skill_card_record_review')
  const allow = body.slice(body.indexOf('v_allowed'), body.indexOf('begin'))
  for (const f of ['principle', 'summary', 'safe_claim', 'prohibited_overclaim', 'jurisdiction']) {
    assert.ok(allow.includes(`'${f}'`), `expected editable: ${f}`)
  }
  for (const f of ['status', 'source_id', 'active_client_id', 'client_specific', 'relevant_agents']) {
    assert.ok(!allow.includes(`'${f}'`), `must NOT be editable: ${f}`)
  }
})

test('reviewer, note and timestamp are recorded on every decision', () => {
  const body = fnBody('skill_card_record_review')
  assert.match(body, /insert into public\.skill_card_reviews \(skill_card_id, reviewed_by, review_status, review_notes\)/)
  assert.match(body, /select coalesce\(full_name, 'admin'\) into v_reviewer/)
})

// ── Agent-key handling ──────────────────────────────────────────────────────
test('canonical_agent_key normalises legacy keys and rejects unknown ones', () => {
  assert.match(sql, /when 'creative_director_agent' then 'creative_director'/)
  assert.match(sql, /else null/)
  for (const k of ['content_planner', 'social_media_strategist', 'research_librarian', 'historical_advertising_analyst']) {
    assert.ok(sql.includes(`when '${k}' then '${k}'`), `missing specialist: ${k}`)
  }
})

test('the queue separates resolved specialists from unrecognised keys', () => {
  const q = fnBody('skill_card_review_queue')
  assert.match(q, /canonical_agent_key\(a\) is not null/)
  assert.match(q, /canonical_agent_key\(a\) is null/)
  assert.match(q, /unrecognised_agents/)
})

test('priority groups implement the agreed first-review order', () => {
  const q = fnBody('skill_card_review_queue')
  assert.match(q, /'Music & Copyright Rights', 'TikTok Platform Risk'\) then 1/)
  assert.match(q, /'Marketing Library' then 2/)
  assert.match(q, /c\.client_specific then 3/)
  assert.match(q, /else 4/)
})

// ── Blocker reporting mirrors the gate ──────────────────────────────────────
test('advisory blockers cover every gate condition, in reviewer language', () => {
  const b = fnBody('skill_card_activation_blockers')
  for (const needle of [
    'No linked source', 'not trusted enough', 'No approved review yet',
    'No last-reviewed date', 'Client-specific card has no exact client assigned',
    'The linked client is not active', 'The review has expired',
  ]) assert.ok(b.includes(needle), `blocker missing: ${needle}`)
  assert.match(b, /array_append\(v_out,/)
})

// ── Library behaviour ───────────────────────────────────────────────────────
test('readiness summary reports every required count', () => {
  const rows = [
    card({ id: 'a', status: 'active', ready_to_activate: false, blockers: [] }),
    card({ id: 'b', blockers: ['No linked source. Link a trusted source before activation.', 'No approved review yet. Approve the card first.'] }),
    card({ id: 'c', blockers: ['No last-reviewed date. Approving the card sets this.'] }),
    card({ id: 'd', blockers: ['Source trust tier "needs_review" is not trusted enough for activation.'] }),
    card({ id: 'e', blockers: [], ready_to_activate: true }),
  ]
  const s = lib.summariseReadiness(rows)
  assert.equal(s.total, 5)
  assert.equal(s.active, 1)
  assert.equal(s.needsReview, 4)
  assert.equal(s.readyToActivate, 1)
  assert.equal(s.blockedMissingSource, 1)
  assert.equal(s.blockedMissingApprovedReview, 1)
  assert.equal(s.blockedMissingLastReviewed, 1)
  assert.equal(s.blockedUnsafeTrust, 1)
})

test('every required filter narrows the list correctly', () => {
  const rows = [
    card({ id: 'active', status: 'active' }),
    card({ id: 'ready', ready_to_activate: true }),
    card({ id: 'blocked', blockers: ['No linked source. Link a trusted source before activation.'] }),
    card({ id: 'client', client_specific: true }),
    card({ id: 'copy', resolved_agents: ['copywriting_agent'] }),
    card({ id: 'lowtrust', source_trust_tier: 'tier_3_internal_learning' }),
    card({ id: 'expired', review_expires_at: new Date(Date.now() - 86_400_000).toISOString() }),
  ]
  const ids = f => lib.applyQueueFilters(rows, { ...lib.EMPTY_FILTERS, ...f }).map(r => r.id)
  assert.deepEqual(ids({ status: 'active' }), ['active'])
  assert.deepEqual(ids({ status: 'ready_to_activate' }), ['ready'])
  assert.deepEqual(ids({ status: 'activation_blocked' }), ['blocked'])
  assert.deepEqual(ids({ status: 'client_specific' }), ['client'])
  assert.ok(!ids({ status: 'needs_review' }).includes('active'))
  assert.deepEqual(ids({ specialist: 'copywriting_agent' }), ['copy'])
  assert.deepEqual(ids({ trust: 'tier_3_internal_learning' }), ['lowtrust'])
  assert.deepEqual(ids({ expiry: 'expired' }), ['expired'])
  assert.ok(!ids({ expiry: 'none' }).includes('expired'))
})

test('the recommended queue prioritises safety, then principles, then client limits — and excludes "later"', () => {
  const rows = [
    card({ id: 'agri', priority_group: 4, category: 'Agriculture' }),
    card({ id: 'client', priority_group: 3, client_specific: true }),
    card({ id: 'principle', priority_group: 2 }),
    card({ id: 'music', priority_group: 1, category: 'Music & Copyright Rights' }),
    card({ id: 'live', priority_group: 1, status: 'active' }),
  ]
  const q = lib.recommendedQueue(rows).map(r => r.id)
  assert.deepEqual(q, ['music', 'principle', 'client'])
  assert.ok(!q.includes('agri'), 'group 4 is intentionally left for later')
  assert.ok(!q.includes('live'), 'already-active cards are not re-queued')
})

test('within a group the closest-to-activation card is suggested first', () => {
  const rows = [
    card({ id: 'far', priority_group: 1, blockers: ['a', 'b', 'c'] }),
    card({ id: 'near', priority_group: 1, blockers: ['a'] }),
  ]
  assert.deepEqual(lib.recommendedQueue(rows).map(r => r.id), ['near', 'far'])
})

test('the recommended queue only orders work — it approves nothing', () => {
  const libSrc = read('../src/lib/skillCardReview.ts')
  const fn = libSrc.slice(libSrc.indexOf('export function recommendedQueue'))
  assert.doesNotMatch(fn, /recordSkillCardReview|activateSkillCard|supabase/)
})

// ── UI surface ──────────────────────────────────────────────────────────────
test('route is admin-only in nav and mounted in the admin shell', () => {
  assert.match(app, /path="\/admin\/skill-card-review"/)
  assert.match(nav, /to: '\/admin\/skill-card-review'[^}]*access: 'admin'/)
})

test('non-admin staff see a refusal, not the queue', () => {
  assert.match(page, /const isAdmin = isAdminRole\(profile\?\.role\)/)
  assert.match(page, /if \(!isAdmin\) \{/)
  assert.match(page, /restricted to admins/)
})

test('the card view shows source, trust, safety, jurisdiction, expiry, evidence and routing', () => {
  for (const label of ['Source', 'Trust tier', 'Evidence label', 'Jurisdiction',
                       'Review expiry', 'Last reviewed', 'Who will receive this']) {
    assert.ok(page.includes(label), `detail missing: ${label}`)
  }
  assert.match(page, /Safe claim/)
  assert.match(page, /Prohibited overclaim/)
})

test('blockers are shown in plain language and gate the activate button', () => {
  assert.match(page, /Cannot activate yet/)
  assert.match(page, /open\.blockers\.map/)
  assert.match(page, /disabled=\{busy \|\| !open\.ready_to_activate\}/)
})

test('overconfident wording is flagged for softening before approval', () => {
  assert.match(page, /ABSOLUTE_WORDING/)
  assert.match(page, /Absolute wording found/)
  assert.match(page, /Soften before approving/)
})

test('all five lifecycle decisions plus single-card activation are offered', () => {
  for (const d of ['approved', 'changes_requested', 'rejected', 'deprecated']) {
    assert.match(page, new RegExp(`decide\\('${d}'\\)`))
  }
  assert.match(page, /Activate this card/)
})

test('unrecognised agent keys are surfaced as a blocker to fix', () => {
  assert.match(page, /unknown agent key/)
  assert.match(page, /Unrecognised agent key/)
  assert.match(page, /would reach nobody/)
})

test('client-specific routing and inactive clients are made obvious', () => {
  assert.match(page, /Client-specific: only/)
  assert.match(page, /client is not active/)
})

// ── Routing review (separate from wording review) ───────────────────────────
const routingSql = read('../supabase/migrations/20260803140000_skill_card_routing_review.sql')

test('routing changes are admin-gated and refuse unrecognised specialist keys', () => {
  assert.match(routingSql, /if not public\.is_admin\(\) then/)
  assert.match(routingSql, /Admin access required to change Skill Card routing/)
  assert.match(routingSql, /Unrecognised specialist key/)
  assert.match(routingSql, /revoke all on function public\.skill_card_set_routing\(uuid, text\[\], text\) from public, anon/)
})

test('a card can never be routed to nobody', () => {
  assert.match(routingSql, /cardinality\(p_agents\) = 0 then/)
  assert.match(routingSql, /A card must route to at least one specialist/)
})

test('routing changes never touch status and are recorded in the review trail', () => {
  assert.doesNotMatch(routingSql, /set status =/)
  assert.match(routingSql, /insert into public\.skill_card_reviews/)
  assert.match(routingSql, /Routing updated to \[/)
})

test('routing stays out of the wording-review allow-list', () => {
  const body = fnBody('skill_card_record_review')
  const allow = body.slice(body.indexOf('v_allowed'), body.indexOf('begin'))
  assert.ok(!allow.includes("'relevant_agents'"), 'routing must not be editable via wording review')
})

test('the review UI offers routing as a deliberate, separate action', () => {
  assert.match(page, /Change routing/)
  assert.match(page, /setSkillCardRouting/)
  assert.match(page, /Save routing/)
  assert.match(page, /A card must reach at least one specialist/)
})
