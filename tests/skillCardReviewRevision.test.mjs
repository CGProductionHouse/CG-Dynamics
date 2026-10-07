import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, edge, frontend, registry, review, legacy, db
const hash = 'a'.repeat(64)
const edgeCard = patch => ({ id: 'fixture-card', title: 'Verified guidance', status: 'active', principle: 'Use proof', summary: null,
  knowledge_layer: 'universal_principle', client_specific: false, active_client_id: null, source_type: 'book', source_id: 'fixture-source',
  source_reference: 'Section 2', relevant_agents: ['creative_director'], review_expires_at: '2026-10-08',
  content_hash: hash, reviewed_content_hash: hash, ...patch })
const frontendCard = patch => ({ id: 'fixture-card', title: 'Verified guidance', status: 'active',
  knowledgeLayer: 'universal', clientSpecific: false, activeClientId: null, sourceType: 'book', sourceId: 'fixture-source',
  relevantAgents: ['creative_director'], reviewExpiresAt: '2026-10-08', contentHash: hash, reviewedContentHash: hash, ...patch })
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  edge = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/skilledAgents.ts')
  frontend = await server.ssrLoadModule('/src/features/ai-workforce/retrieval/retrievalV1.ts')
  registry = await server.ssrLoadModule('/src/features/ai-workforce/agents/agentRegistry.ts')
  review = await server.ssrLoadModule('/src/lib/skillCardReview.ts')
  legacy = await server.ssrLoadModule('/src/lib/marketing-library/skillCardsData.ts')
  db = (await server.ssrLoadModule('/src/lib/supabase.ts')).supabase
})
after(async () => { await server?.close() })
const edgeContext = mode => ({ agent: edge.AGENT_CONTRACTS.creative_director, activeClientId: 'fixture-client', today: '2026-10-07', mode })
const frontendContext = mode => ({ agent: registry.getAgentProfile('creative_director'),
  activeClientId: 'fixture-client', industry: null, today: '2026-10-07', mode })

test('server production rejects active historical approval without the reviewed content binding', () => {
  assert.equal(edge.isCardRetrievable(edgeCard({ reviewed_content_hash: null }), edgeContext('production')), false)
  assert.equal(edge.isCardRetrievable(edgeCard({ content_hash: null, reviewed_content_hash: null }), edgeContext('production')), false)
})
test('server production rejects changed, malformed and forged approval revision', () => {
  for (const value of ['b'.repeat(64), 'approved', '', 1]) {
    assert.equal(edge.isCardRetrievable(edgeCard({ reviewed_content_hash: value }), edgeContext('production')), false)
  }
})
test('exact reviewed current content retains existing routing and client isolation gates', () => {
  assert.equal(edge.isCardRetrievable(edgeCard({}), edgeContext('production')), true)
  assert.equal(edge.isCardRetrievable(edgeCard({ client_specific: true, active_client_id: 'another-client' }), edgeContext('production')), false)
  assert.equal(edge.isCardRetrievable(edgeCard({ relevant_agents: ['paid_ads_agent'] }), edgeContext('production')), false)
})
test('frontend production must have identical fail-closed revision authority', () => {
  const context = frontendContext('production')
  assert.ok(context.agent, 'use existing specialist registry')
  assert.equal(frontend.isCardRetrievable(frontendCard({ reviewedContentHash: null }), context), false)
  assert.equal(frontend.isCardRetrievable(frontendCard({ reviewedContentHash: 'b'.repeat(64) }), context), false)
  assert.equal(frontend.isCardRetrievable(frontendCard({}), context), true)
})
test('admin research can inspect unapproved historical guidance without making it production knowledge', () => {
  assert.equal(edge.isCardRetrievable(edgeCard({ reviewed_content_hash: null, status: 'needs_review' }), edgeContext('admin_research')), true)
  assert.equal(edge.isCardRetrievable(edgeCard({ reviewed_content_hash: null, status: 'needs_review' }), edgeContext('production')), false)
})

test('both human review adapters send the displayed revision to one atomic canonical RPC', async () => {
  const original = db.rpc, calls = []
  db.rpc = async (name, input) => { calls.push({ name, input }); return { data: null, error: { message: 'Changed: reload current card' } } }
  try {
    const modern = await review.recordSkillCardReview({ cardId: 'exact-card', expectedContentHash: hash, decision: 'approved', note: 'Reviewed', edits: { summary: 'Human change' } })
    const old = await legacy.submitSkillCardReviewAction({ skillCardId: 'exact-card', expectedContentHash: hash, action: 'approve', note: 'Reviewed' })
    assert.equal(modern.error.message, 'Changed: reload current card')
    assert.equal(old.error, 'Changed: reload current card')
    assert.equal(calls.length, 2, 'No fallback insert/update or retry on changed card')
    for (const call of calls) {
      assert.equal(call.name, 'skill_card_record_review'); assert.equal(call.input.p_expected_content_hash, hash)
      assert.equal(call.input.p_card_id, 'exact-card'); assert.equal(call.input.p_decision, 'approved')
      assert.equal(call.input.reviewed_by, undefined, 'Actor cannot be caller-supplied')
    }
  } finally { db.rpc = original }
})

test('legacy readiness never counts activation/routing audit or a different content review', () => {
  const card = { source_id: 's', last_reviewed: '2026-10-07', content_hash: hash, reviewed_content_hash: hash }
  const source = { trust_tier: 'tier_1_primary' }
  const human = { review_status: 'approved', review_kind: 'content_review', reviewed_content_hash: hash, reviewer_profile_id: 'admin' }
  assert.equal(legacy.evaluateSkillCardActivation(card, source, [human]).ready, true)
  for (const patch of [{ review_kind: 'audit' }, { reviewed_content_hash: 'b'.repeat(64) }, { reviewer_profile_id: null }]) {
    assert.equal(legacy.evaluateSkillCardActivation(card, source, [{ ...human, ...patch }]).ready, false)
  }
  assert.equal(legacy.evaluateSkillCardActivation({ ...card, reviewed_content_hash: null }, source, [human]).ready, false)
})

test('canonical active/shared read never hands historical or changed approvals to guideline projections', async () => {
  const original = db.from
  const current = { id: 'current', content_hash: hash, reviewed_content_hash: hash }
  const rows = [current, { id: 'historical' }, { id: 'changed', content_hash: 'b'.repeat(64), reviewed_content_hash: hash }]
  db.from = table => {
    assert.equal(table, 'skill_cards')
    const q = { select() { return q }, eq() { return q }, or() { return q }, order() { return { data: rows, error: null } } }
    return q
  }
  try { assert.deepEqual((await legacy.listActiveSharedSkillCards()).data, [current]) }
  finally { db.from = original }
})
