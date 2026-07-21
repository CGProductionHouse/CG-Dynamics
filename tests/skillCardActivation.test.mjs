import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Loads the pure activation-readiness logic from the data module through a Vite
// SSR server. import.meta.env is defined so the supabase client import does not
// throw on missing env vars — no network or Supabase access happens here.

let server
let evaluateSkillCardActivation

const tier1Source = { trust_tier: 'tier_1_primary' }
const readyCard = { source_id: 'source-1', last_reviewed: '2026-07-20' }
const approvedReview = [{ review_status: 'approved' }]

before(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  })
  ;({ evaluateSkillCardActivation } = await server.ssrLoadModule('/src/lib/marketing-library/skillCardsData.ts'))
})

after(async () => { await server?.close() })

test('a card with source, trusted tier, approved review and last_reviewed is ready', () => {
  const result = evaluateSkillCardActivation(readyCard, tier1Source, approvedReview)
  assert.equal(result.ready, true)
  assert.deepEqual(result.missing, [])
})

test('missing linked source blocks activation', () => {
  const result = evaluateSkillCardActivation({ source_id: null, last_reviewed: '2026-07-20' }, null, approvedReview)
  assert.equal(result.ready, false)
  assert.equal(result.hasSource, false)
  assert.ok(result.missing.some(item => item.toLowerCase().includes('source')))
})

test('a needs_review source blocks activation', () => {
  const result = evaluateSkillCardActivation(readyCard, { trust_tier: 'needs_review' }, approvedReview)
  assert.equal(result.ready, false)
  assert.equal(result.sourceTrustAcceptable, false)
})

test('a tier_4_low_trust source blocks activation', () => {
  const result = evaluateSkillCardActivation(readyCard, { trust_tier: 'tier_4_low_trust' }, approvedReview)
  assert.equal(result.ready, false)
  assert.equal(result.sourceTrustAcceptable, false)
})

test('a source_id present but source not loaded is not acceptable', () => {
  const result = evaluateSkillCardActivation(readyCard, null, approvedReview)
  assert.equal(result.ready, false)
  assert.equal(result.sourceTrustAcceptable, false)
  assert.ok(result.missing.some(item => item.toLowerCase().includes('could not be loaded')))
})

test('no approved review blocks activation even with other reviews', () => {
  const result = evaluateSkillCardActivation(readyCard, tier1Source, [{ review_status: 'changes_requested' }, { review_status: 'rejected' }])
  assert.equal(result.ready, false)
  assert.equal(result.hasApprovedReview, false)
})

test('missing last_reviewed blocks activation', () => {
  const result = evaluateSkillCardActivation({ source_id: 'source-1', last_reviewed: null }, tier1Source, approvedReview)
  assert.equal(result.ready, false)
  assert.equal(result.lastReviewedSet, false)
})

test('tier_2 and tier_3 sources are acceptable', () => {
  for (const tier of ['tier_2_trusted_professional', 'tier_3_internal_learning']) {
    const result = evaluateSkillCardActivation(readyCard, { trust_tier: tier }, approvedReview)
    assert.equal(result.ready, true, `expected ${tier} to be acceptable`)
  }
})
