import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const MIG_A = read('../supabase/phase-26a-skill-card-governance-fields.sql')
const MIG_B = read('../supabase/phase-26b-platform-rights-risk-knowledge.sql')
const CARD_TYPES = read('../src/lib/marketing-library/skillCardsData.ts')

let server, reg, rt
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  reg = await server.ssrLoadModule('/src/features/ai-workforce/agents/agentRegistry.ts')
  rt = await server.ssrLoadModule('/src/features/ai-workforce/retrieval/retrievalV1.ts')
})
after(async () => { await server?.close() })

// A rights card shaped like the seeded MCR/TIK cards (needs_review, universal_principle).
const rightsCard = o => ({
  id: 'r', status: 'needs_review', knowledgeLayer: 'universal_principle', clientSpecific: false,
  activeClientId: null, sourceType: 'official_documentation', sourceId: 's', title: 'Rights', ...o,
})
const guardianCtx = (mode = 'production') => ({ agent: reg.getAgentProfile('brand_guardian'), activeClientId: null, industry: null, mode })

// ── Review-gating: seeded rights knowledge must NOT reach production unreviewed ─
test('needs_review rights cards are excluded from production retrieval; visible in admin research', () => {
  assert.equal(rt.isCardRetrievable(rightsCard(), guardianCtx('production')), false)
  assert.equal(rt.isCardRetrievable(rightsCard(), guardianCtx('admin_research')), true)
  // once a reviewer activates it, production may use it
  assert.equal(rt.isCardRetrievable(rightsCard({ status: 'active' }), guardianCtx('production')), true)
})

test('Brand Guardian may use the universal layer these cards live on', () => {
  const g = reg.getAgentProfile('brand_guardian')
  assert.ok(g.allowedKnowledgeLayers.includes('universal'))
  // universal_principle normalises to universal so the card is layer-eligible
  assert.equal(rt.normaliseKnowledgeLayer('universal_principle'), 'universal')
})

// ── Governance migration (phase-26a) ──────────────────────────────────────────
test('phase-26a adds the readiness governance fields, additively', () => {
  for (const col of ['safe_claim', 'prohibited_overclaim', 'jurisdiction', 'review_expires_at']) {
    assert.match(MIG_A, new RegExp(`add column if not exists ${col}`))
  }
})

// ── Seed integrity (phase-26b) ────────────────────────────────────────────────
test('every seeded rights card is needs_review, a platform_rule, and carries a prohibited overclaim', () => {
  // all cards seeded needs_review; none seeded active
  assert.match(MIG_B, /'needs_review', 'universal_principle'/)
  assert.doesNotMatch(MIG_B, /'active', 'universal_principle'/)
  assert.match(MIG_B, /'platform_rule'/)
  // 18 candidate slugs present (10 MCR + 8 TIK)
  const mcr = (MIG_B.match(/'mcr-\d\d-/g) || []).length
  const tik = (MIG_B.match(/'tik-hosp-\d\d-/g) || []).length
  assert.equal(mcr, 10)
  assert.equal(tik, 8)
  // every card summary encodes a boundary the retrieval will convey
  const neverCount = (MIG_B.match(/Never (claim|assume|say|recommend|treat|guarantee|collapse|present)/g) || []).length
  assert.ok(neverCount >= 18, `expected >=18 boundary statements, got ${neverCount}`)
})

test('no copyrighted full-book ingestion: sources are metadata/link or internal notes only', () => {
  // The CG research packs are stored user_owned / internal_notes_only, not full-text book ingestion.
  assert.match(MIG_B, /'user_owned', 'CG-authored research synthesis[\s\S]*?'internal_notes_only'/)
  // Official platform pages are metadata_and_link_only (cite + link, not mirrored).
  assert.match(MIG_B, /'official_reference', 'Official TikTok policy; copyrighted\.', 'metadata_and_link_only'/)
  assert.doesNotMatch(MIG_B, /full_text_allowed/)
})

// ── UI governance type ────────────────────────────────────────────────────────
test('SkillCardRecord exposes the governance fields for the review UI', () => {
  for (const f of ['safe_claim', 'prohibited_overclaim', 'jurisdiction', 'review_expires_at']) {
    assert.match(CARD_TYPES, new RegExp(`${f}\\??: string \\| null`))
  }
})
