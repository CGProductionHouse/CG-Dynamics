import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let getSkillCardFreshness
let getSkillCardGovernanceWarnings
let getSkillCardStatusReason
let matchesSkillCardFilters

const card = {
  id: 'card-1',
  title: 'Verified agriculture finding',
  slug: 'verified-agriculture-finding',
  category: 'Paid Media',
  status: 'needs_review',
  knowledge_layer: 'industry_specific',
  source_id: 'source-1',
  source_type: 'official_documentation',
  confidence_level: 'high',
  evidence_label: 'platform_rule',
  principle: 'Use the documented finding.',
  relevant_industries: ['agriculture'],
  source_reference: 'Section 4, page 12',
  reference_state: 'human_verified',
  safe_claim: 'This documented behavior applies in the stated conditions.',
  prohibited_overclaim: 'Do not claim it applies outside the stated conditions.',
  jurisdiction: 'ZA',
  last_reviewed: '2026-07-20',
  review_expires_at: '2026-10-31',
}

const allFilters = {
  search: '',
  status: 'all',
  layer: 'all',
  industry: 'all',
  confidence: 'all',
  sourceType: 'all',
  evidence: 'all',
  category: 'all',
  source: 'all',
  reference: 'all',
  freshness: 'all',
  review: 'all',
}

before(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  })
  ;({
    getSkillCardFreshness,
    getSkillCardGovernanceWarnings,
    getSkillCardStatusReason,
    matchesSkillCardFilters,
  } = await server.ssrLoadModule('/src/lib/marketing-library/skillCardGovernance.ts'))
})

after(async () => { await server?.close() })

test('freshness distinguishes current, expired and missing expiry', () => {
  assert.equal(getSkillCardFreshness(card, '2026-07-27'), 'current')
  assert.equal(getSkillCardFreshness(card, '2026-11-01'), 'expired')
  assert.equal(getSkillCardFreshness({ review_expires_at: null }, '2026-07-27'), 'no_expiry')
})

test('complete human-verified governance has no warnings', () => {
  assert.deepEqual(getSkillCardGovernanceWarnings(card, '2026-07-27'), [])
})

test('missing, restricted and stale governance is surfaced', () => {
  const warnings = getSkillCardGovernanceWarnings({
    ...card,
    source_id: null,
    source_reference: null,
    reference_state: 'candidate_unverified',
    safe_claim: null,
    prohibited_overclaim: null,
    jurisdiction: null,
    review_expires_at: '2026-07-01',
  }, '2026-07-27')

  assert.ok(warnings.some(warning => warning.includes('supporting source')))
  assert.ok(warnings.some(warning => warning.includes('limitations')))
  assert.ok(warnings.some(warning => warning.includes('not human verified')))
  assert.ok(warnings.some(warning => warning.includes('expired')))
})

test('filters combine industry, discipline, source, rights, freshness and review state', () => {
  const filters = {
    ...allFilters,
    industry: 'agriculture',
    category: 'Paid Media',
    source: 'source-1',
    reference: 'human_verified',
    freshness: 'current',
    review: 'approved',
  }
  assert.equal(matchesSkillCardFilters(card, filters, 'approved', '2026-07-27'), true)
  assert.equal(matchesSkillCardFilters(card, { ...filters, review: 'rejected' }, 'approved', '2026-07-27'), false)
  assert.equal(matchesSkillCardFilters(card, { ...filters, freshness: 'expired' }, 'approved', '2026-07-27'), false)
})

test('reviewed cards do not claim readiness without the server-side review context', () => {
  const reason = getSkillCardStatusReason({ status: 'reviewed', source_id: 'source-1', last_reviewed: '2026-07-20' })
  assert.equal(reason, 'Reviewed; awaiting gated activation')
})
