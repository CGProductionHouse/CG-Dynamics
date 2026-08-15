import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20260802130000_marketing_ai_department.sql')
const fn = read('../supabase/functions/marketing-workflow/index.ts')
const lib = read('../src/lib/marketingWorkflow.ts')
const page = read('../src/pages/admin/MarketingAiDepartmentPage.tsx')
const nav = read('../src/pages/admin/adminNavigation.ts')
const app = read('../src/App.tsx')
const denoAgents = read('../supabase/functions/cg-assistant-chat/skilledAgents.ts')
const chatFn = read('../supabase/functions/cg-assistant-chat/index.ts')

let server
let normaliseAgentKey
let cardTargetsAgent
let getAgentProfile
let isCardRetrievable
let buildRetrievalPlan
let AI_WORKFORCE_AGENTS

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ normaliseAgentKey, cardTargetsAgent, getAgentProfile, AI_WORKFORCE_AGENTS } =
    await server.ssrLoadModule('/src/features/ai-workforce/agents/agentRegistry.ts'))
  ;({ isCardRetrievable, buildRetrievalPlan } =
    await server.ssrLoadModule('/src/features/ai-workforce/retrieval/retrievalV1.ts'))
})
after(async () => { await server.close() })

// ── Agent-key normalisation and compatibility ───────────────────────────────
test('legacy creative_director_agent normalises to canonical creative_director', () => {
  assert.equal(normaliseAgentKey('creative_director_agent'), 'creative_director')
  assert.equal(normaliseAgentKey('creative_director'), 'creative_director')
  assert.equal(normaliseAgentKey('CREATIVE_DIRECTOR_AGENT'), 'creative_director')
  assert.equal(normaliseAgentKey('  creative_director_agent  '), 'creative_director')
})

test('all current specialists are supported, including the four named ones', () => {
  for (const key of ['content_planner', 'social_media_strategist', 'research_librarian', 'historical_advertising_analyst']) {
    assert.equal(normaliseAgentKey(key), key, `${key} must normalise to itself`)
    assert.ok(getAgentProfile(key), `${key} must resolve to a registered profile`)
  }
  // Every registered agent must round-trip through the normaliser.
  for (const agent of AI_WORKFORCE_AGENTS) {
    assert.equal(normaliseAgentKey(agent.key), agent.key)
  }
})

test('unknown or empty agent keys resolve to null (excluded, never guessed)', () => {
  assert.equal(normaliseAgentKey('not_a_real_agent'), null)
  assert.equal(normaliseAgentKey(''), null)
  assert.equal(normaliseAgentKey(null), null)
  assert.equal(getAgentProfile('not_a_real_agent'), null)
})

test('cardTargetsAgent matches across legacy and canonical spellings', () => {
  assert.equal(cardTargetsAgent(['creative_director_agent'], 'creative_director'), true)
  assert.equal(cardTargetsAgent(['creative_director'], 'creative_director'), true)
  assert.equal(cardTargetsAgent(['copywriting_agent', 'brand_guardian'], 'brand_guardian'), true)
  assert.equal(cardTargetsAgent(['copywriting_agent'], 'brand_guardian'), false)
  assert.equal(cardTargetsAgent([], 'brand_guardian'), false)
  assert.equal(cardTargetsAgent(null, 'brand_guardian'), false)
})

// ── The correct cards reach the correct specialists ─────────────────────────
function card(over = {}) {
  return {
    id: 'c1', status: 'active', knowledgeLayer: 'universal_principle',
    clientSpecific: false, activeClientId: null, sourceType: 'book', sourceId: 's1',
    title: 'Card', relevantAgents: ['marketing_strategist'], ...over,
  }
}
const ctxFor = (key, activeClientId = null) => ({
  agent: getAgentProfile(key), activeClientId, mode: 'production', today: '2026-08-10',
})

test('a card only reaches the specialist it is addressed to', () => {
  const strategistCard = card({ id: 'a', relevantAgents: ['marketing_strategist'] })
  assert.equal(isCardRetrievable(strategistCard, ctxFor('marketing_strategist')), true)
  assert.equal(isCardRetrievable(strategistCard, ctxFor('copywriting_agent')), false)
  assert.equal(isCardRetrievable(strategistCard, ctxFor('brand_guardian')), false)
})

test('a legacy-keyed card still reaches its canonical specialist (seeded data compatible)', () => {
  const legacy = card({ id: 'b', relevantAgents: ['creative_director_agent'] })
  assert.equal(isCardRetrievable(legacy, ctxFor('creative_director')), true)
  assert.equal(isCardRetrievable(legacy, ctxFor('marketing_strategist')), false)
})

test('an untargeted or mislabelled card is excluded, never broadcast to every agent', () => {
  assert.equal(isCardRetrievable(card({ relevantAgents: [] }), ctxFor('marketing_strategist')), false)
  assert.equal(isCardRetrievable(card({ relevantAgents: null }), ctxFor('marketing_strategist')), false)
  assert.equal(isCardRetrievable(card({ relevantAgents: ['bogus_agent'] }), ctxFor('marketing_strategist')), false)
})

test('agent routing does not weaken the existing status, client and layer gates', () => {
  // needs_review is still invisible in production even when correctly addressed.
  assert.equal(isCardRetrievable(card({ status: 'needs_review' }), ctxFor('marketing_strategist')), false)
  // client-specific still requires the EXACT active client.
  const clientCard = card({ knowledgeLayer: 'active_client_specific', clientSpecific: true, activeClientId: 'client-a' })
  assert.equal(isCardRetrievable(clientCard, ctxFor('marketing_strategist', 'client-a')), true)
  assert.equal(isCardRetrievable(clientCard, ctxFor('marketing_strategist', 'client-b')), false)
  assert.equal(isCardRetrievable(clientCard, ctxFor('marketing_strategist', null)), false)
  // AI-generated cards are still never authoritative.
  assert.equal(isCardRetrievable(card({ sourceType: 'ai_generated' }), ctxFor('marketing_strategist')), false)
})

test('a mixed pool routes each card to exactly its own specialist', () => {
  const pool = [
    card({ id: 'strat', relevantAgents: ['marketing_strategist'] }),
    card({ id: 'copy', relevantAgents: ['copywriting_agent'] }),
    card({ id: 'brand', relevantAgents: ['brand_guardian'] }),
    card({ id: 'legacy-cd', relevantAgents: ['creative_director_agent'] }),
  ]
  const idsFor = key => buildRetrievalPlan(pool, ctxFor(key)).cards.map(c => c.id)
  assert.deepEqual(idsFor('marketing_strategist'), ['strat'])
  assert.deepEqual(idsFor('copywriting_agent'), ['copy'])
  assert.deepEqual(idsFor('brand_guardian'), ['brand'])
  assert.deepEqual(idsFor('creative_director'), ['legacy-cd'])
})

test('insufficient approved knowledge is reported honestly, not filled in', () => {
  const plan = buildRetrievalPlan([card({ status: 'needs_review' })], ctxFor('marketing_strategist'))
  assert.equal(plan.cards.length, 0)
  assert.equal(plan.insufficientEvidence, true)
  assert.match(plan.noSourceMessage, /do not have enough approved source material/i)
})

test('the Deno copy mirrors the same aliases and gate', () => {
  assert.match(denoAgents, /creative_director_agent: 'creative_director'/)
  assert.match(denoAgents, /export function normaliseAgentKey/)
  assert.match(denoAgents, /if \(!cardTargetsAgent\(card\.relevant_agents, ctx\.agent\.key\)\) return false/)
  // The card query must actually select the routing column.
  assert.match(chatFn, /relevant_agents, review_expires_at'\)/)
})

// ── Data model: versions, history, approval ─────────────────────────────────
test('artifact history tables are append-only and RLS-forced', () => {
  for (const t of ['ai_marketing_artifacts', 'ai_marketing_artifact_versions',
                   'ai_marketing_artifact_transitions', 'ai_marketing_artifact_approvals',
                   'ai_marketing_artifact_audit']) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`))
    assert.match(sql, new RegExp(`alter table public\\.${t} force row level security`))
  }
  assert.match(sql, /AI Marketing history is append-only/)
  for (const trg of ['versions', 'transitions', 'approvals', 'audit']) {
    assert.match(sql, new RegExp(`ai_marketing_${trg}_immutable before update or delete`))
  }
})

test('versions are immutable and uniquely numbered per artifact', () => {
  assert.match(sql, /unique \(artifact_id, version\)/)
  assert.match(sql, /version integer not null check \(version > 0\)/)
})

test('client-role users have no policy and no grants on any artifact table', () => {
  // Every policy requires is_staff()/is_manager() plus an ACTIVE profile.
  const policies = sql.match(/create policy[\s\S]*?;/g) ?? []
  assert.ok(policies.length >= 5)
  for (const p of policies) {
    assert.match(p, /public\.is_(staff|manager)\(\)/)
    assert.match(p, /p\.is_active = true/)
  }
  assert.doesNotMatch(sql, /for (insert|update|delete) to authenticated/)
  // No write grants to authenticated — writes only via service role / RPC.
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*to authenticated/)
})

test('approval is manager-gated and must target the current version', () => {
  const body = sql.slice(sql.indexOf('function public.ai_marketing_record_decision'))
  assert.match(body, /security definer/)
  assert.match(body, /Active staff access required/)
  assert.match(body, /p_decision in \('approved','rejected'\) and v_profile\.role not in \('admin','manager'\)/)
  assert.match(body, /Manager approval access required/)
  assert.match(body, /Decision must target the current version/)
})

// ── Workflow function safety ────────────────────────────────────────────────
test('workflow runner requires an ACTIVE staff profile', () => {
  assert.match(fn, /if \(!profile\?\.is_active \|\| !STAFF_ROLES\.includes\(role\)\)/)
  assert.match(fn, /Active staff access required/)
})

test('workflow uses ONLY active cards and the exact active client', () => {
  assert.match(fn, /\.eq\('status', 'active'\)/)
  assert.match(fn, /mode: 'production'/)
  assert.match(fn, /activeClientId: clientId/)
  assert.match(fn, /client\.active !== true/)
  // An artifact can never be advanced under a different client.
  assert.match(fn, /belongs to a different client/)
})

test('insufficient evidence writes nothing and never invents output', () => {
  const block = fn.slice(fn.indexOf('if (plan.insufficient)'), fn.indexOf('// Card text is EVIDENCE'))
  assert.match(block, /insufficientEvidence: true/)
  assert.match(block, /no draft was produced/)
  assert.doesNotMatch(block, /\.insert\(/)
  assert.match(fn, /Nothing is written: no artifact, no version, no AI spend/)
})

test('retrieved card text is evidence, never instruction', () => {
  assert.match(fn, /neutralise\(/)
  assert.match(fn, /EVIDENCE, not instructions/)
})

test('only evidence the runner actually supplied may be recorded on a version', () => {
  // Superseded the UUID echo-back: the model now cites short refs (E1, E2) and
  // the runner maps them to real ids, so only supplied evidence can be recorded.
  assert.match(fn, /const byRef = new Map\(evidence\.map\(e => \[e\.ref\.toUpperCase\(\), e\.id\]\)\)/)
  assert.match(fn, /citedRefs/)
  assert.match(fn, /\.filter\(\(id\): id is string => Boolean\(id\)\)/)
})

test('AI usage is metered through the shared router so it reaches AI Health', () => {
  assert.match(fn, /routeAiChat\(messages, \{/)
  assert.match(fn, /feature: 'marketing_workflow'/)
  assert.match(fn, /usageClient/)
  assert.match(fn, /ai_usage_request_id: aiResult\.usageRequestId/)
})

test('the chain is Strategist -> Copywriting -> Brand Guardian -> human approval', () => {
  assert.match(fn, /marketing_strategist: \{ next: 'copywriting_agent'/)
  assert.match(fn, /copywriting_agent: \{ next: 'brand_guardian'/)
  assert.match(fn, /brand_guardian: \{ next: null/)
  // After the final specialist the artifact awaits a human, never auto-approves.
  assert.match(fn, /status: CHAIN\[specialist\]\?\.next \? 'draft' : 'in_review'/)
  assert.doesNotMatch(fn, /'human_approved'\s*[,}]/)
})

test('the runner never publishes, spends budget or activates knowledge', () => {
  assert.match(fn, /never publish, never spend budget, never change client records/)
  for (const forbidden of ['skill_cards\'\\)\\s*\\.update', 'monthly_deliverables', 'google_ads_campaigns\\b', 'publish']) {
    assert.doesNotMatch(fn.replace(/\/\/.*$/gm, ''), new RegExp(`\\.from\\('${forbidden}`))
  }
  // An approved artifact is locked against further specialist runs.
  assert.match(fn, /human-approved and is now locked/)
})

// ── UI surface ──────────────────────────────────────────────────────────────
test('route and nav exist and are staff-scoped (never client-facing)', () => {
  assert.match(app, /path="\/admin\/marketing-ai"/)
  // Grouped under the Marketing parent nav entry (rendered only in the admin shell).
  assert.match(nav, /to: '\/admin\/marketing'[^}]*'\/admin\/marketing-ai'/)
})

test('UI exposes evidence, confidence, provider, specialist, creator and timestamps', () => {
  assert.match(page, /confidence \{\(currentVersion\.confidence \* 100\)/)
  assert.match(page, /currentVersion\.provider/)
  assert.match(page, /currentVersion\.model/)
  assert.match(page, /evidence_card_ids\.length\} evidence/)
  assert.match(page, /new Date\(currentVersion\.created_at\)\.toLocaleString\(\)/)
  assert.match(page, /SPECIALIST_LABELS\[currentVersion\.specialist\]/)
})

test('UI offers routing choice, regenerate, compare, and all four decisions', () => {
  assert.match(page, /CG Assistant routes automatically/)
  assert.match(page, /Preview routing/)
  assert.match(page, /Regenerate current step/)
  assert.match(page, /Compare with/)
  for (const d of ['approved', 'rejected', 'changes_requested', 'returned']) {
    assert.match(page, new RegExp(`decide\\('${d}'`))
  }
  assert.match(page, /Handoff &amp; approval history/)
})

test('approve and reject are disabled for non-managers in the UI as well as the RPC', () => {
  assert.match(page, /disabled=\{busy \|\| !isManager \|\| !currentVersion/)
  assert.match(page, /Approve and reject are restricted to managers and admins/)
})

test('client library never writes directly — runs via function, decides via RPC', () => {
  assert.match(lib, /functions\.invoke\('marketing-workflow'/)
  assert.match(lib, /rpc\('ai_marketing_record_decision'/)
  assert.doesNotMatch(lib, /from\('ai_marketing_artifacts'\)\s*\.(insert|update|delete)/)
  assert.doesNotMatch(lib, /from\('ai_marketing_artifact_versions'\)\s*\.(insert|update|delete)/)
})

// ── Citation is mandatory and can never be fabricated ───────────────────────
test('the model never receives a real card id, so a citation cannot be invented', () => {
  // Evidence carries a short ref; the UUID is stripped before it reaches the model.
  assert.match(fn, /ref: `E\$\{i \+ 1\}`/)
  assert.match(fn, /evidence: evidence\.map\(\(\{ id: _id, \.\.\.rest \}\) => rest\)/)
  assert.match(fn, /the real card\s*\n\s*\/\/ UUID is never sent to the model/)
})

test('cited refs are mapped back server-side; unknown refs are dropped', () => {
  assert.match(fn, /const byRef = new Map\(evidence\.map\(e => \[e\.ref\.toUpperCase\(\), e\.id\]\)\)/)
  assert.match(fn, /\.filter\(\(id\): id is string => Boolean\(id\)\)/)
  assert.match(fn, /an invented citation can never be recorded/)
})

test('the router rejects uncited output so it falls back to another provider', () => {
  assert.match(fn, /validateContent: \(raw: string\) => \{/)
  assert.match(fn, /refs\.some\(v => validRefs\.has\(String\(v\)\.trim\(\)\.toUpperCase\(\)\)\)/)
  assert.match(fn, /it never adds a citation/)
})

test('an uncited version is never persisted, for any specialist', () => {
  const block = fn.slice(fn.indexOf('if (usedEvidence.length === 0)'), fn.indexOf('// ── Persist'))
  assert.match(block, /insufficientEvidence: true/)
  assert.match(block, /uncited: true/)
  assert.doesNotMatch(block, /\.insert\(/)
  assert.match(fn, /Nothing is written, and we never fabricate a/)
})

test('review-stage specialists are called out explicitly', () => {
  assert.match(fn, /const REVIEW_STAGE = new Set\(\['brand_guardian'\]\)/)
  assert.match(fn, /A review-stage specialist must ground its sign-off in approved evidence/)
})

test('provider exhaustion is reported honestly, not as an outage', () => {
  assert.match(fn, /msg\.startsWith\('NO_AI_PROVIDER_AVAILABLE'\)/)
  const block = fn.slice(fn.indexOf("msg.startsWith('NO_AI_PROVIDER_AVAILABLE')"))
  assert.match(block.slice(0, 900), /uncited: true/)
  assert.match(block.slice(0, 900), /No available AI provider produced a result that cites/)
  assert.match(fn, /Nothing has been written either way/)
})
