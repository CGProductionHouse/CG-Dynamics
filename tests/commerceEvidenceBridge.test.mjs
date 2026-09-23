import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bridgeCommerceEvidenceSources,
  summariseCommerceEligibility,
  COMMERCE_EVIDENCE_SOURCES,
} from '../src/lib/marketing-library/commerceEvidenceBridge.ts'
import { classifyRegistrations } from '../src/lib/marketing-library/sourceRegistry.ts'

// ── Commerce evidence source bridge tests (#441) ──────────────────────────────

test('abstract_only stays abstract_only', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s01 = candidates.find(c => c.citedIn[0]?.includes('#S01'))
  assert.ok(s01, 'S01 is mapped')
  assert.equal(s01.accessCoverage, 'abstract_only', 'access coverage preserved exactly')
  assert.equal(s01.trustTier, 'needs_review')
  assert.equal(s01.ingestionEligibility, 'metadata_reference')
})

test('selected_full_text_sections stays selected_full_text_sections', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s03 = candidates.find(c => c.citedIn[0]?.includes('#S03'))
  assert.ok(s03, 'S03 is mapped')
  assert.equal(s03.accessCoverage, 'selected_full_text_sections')
})

test('full_page stays full_page', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s07 = candidates.find(c => c.citedIn[0]?.includes('#S07'))
  assert.ok(s07, 'S07 is mapped')
  assert.equal(s07.accessCoverage, 'full_page')
})

test('official_summary stays official_summary', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s12 = candidates.find(c => c.citedIn[0]?.includes('#S12'))
  assert.ok(s12, 'S12 is mapped')
  assert.equal(s12.accessCoverage, 'official_summary')
})

test('unknown accessLevel fails closed', () => {
  const synthetic = [
    { id: 'X1', title: 'Bad', publisher: 'P', publicationDate: null, sourceIdentifier: 'https://x.com', canonicalUrl: 'https://x.com', accessedAt: '2026-09-19', accessLevel: 'full_read', sourceType: 'research_paper', finding: 'f', limitations: 'l', reviewStatus: 'needs_review', fullTextReviewed: false, fullTextCopied: false, rights: 'r', jurisdiction: 'j' },
  ]
  const candidates = bridgeCommerceEvidenceSources(synthetic)
  assert.equal(candidates.length, 0, 'full_read accessLevel excluded (fail closed)')
})

test('unknown sourceType fails closed', () => {
  const synthetic = [
    { id: 'X2', title: 'Bad', publisher: 'P', publicationDate: null, sourceIdentifier: 'https://x2.com', canonicalUrl: 'https://x2.com', accessedAt: '2026-09-19', accessLevel: 'full_page', sourceType: 'unsourced_blog', finding: 'f', limitations: 'l', reviewStatus: 'needs_review', fullTextReviewed: false, fullTextCopied: false, rights: 'r', jurisdiction: 'j' },
  ]
  const candidates = bridgeCommerceEvidenceSources(synthetic)
  assert.equal(candidates.length, 0, 'unsourced_blog sourceType excluded')
})

test('incomplete metadata fails closed: missing title excluded', () => {
  const synthetic = [
    { id: 'X3', title: '', publisher: 'P', publicationDate: null, sourceIdentifier: 'https://x3.com', canonicalUrl: 'https://x3.com', accessedAt: '2026-09-19', accessLevel: 'full_page', sourceType: 'research_paper', finding: 'f', limitations: 'l', reviewStatus: 'needs_review', fullTextReviewed: false, fullTextCopied: false, rights: 'r', jurisdiction: 'j' },
  ]
  const candidates = bridgeCommerceEvidenceSources(synthetic)
  assert.equal(candidates.length, 0, 'empty title excluded')
})

test('incomplete metadata fails closed: missing publisher excluded', () => {
  const synthetic = [
    { id: 'X4', title: 'T', publisher: '', publicationDate: null, sourceIdentifier: 'https://x4.com', canonicalUrl: 'https://x4.com', accessedAt: '2026-09-19', accessLevel: 'full_page', sourceType: 'research_paper', finding: 'f', limitations: 'l', reviewStatus: 'needs_review', fullTextReviewed: false, fullTextCopied: false, rights: 'r', jurisdiction: 'j' },
  ]
  const candidates = bridgeCommerceEvidenceSources(synthetic)
  assert.equal(candidates.length, 0, 'empty publisher excluded')
})

test('incomplete metadata fails closed: missing rights excluded', () => {
  const synthetic = [
    { id: 'X5', title: 'T', publisher: 'P', publicationDate: null, sourceIdentifier: 'https://x5.com', canonicalUrl: 'https://x5.com', accessedAt: '2026-09-19', accessLevel: 'full_page', sourceType: 'research_paper', finding: 'f', limitations: 'l', reviewStatus: 'needs_review', fullTextReviewed: false, fullTextCopied: false, rights: '', jurisdiction: 'j' },
  ]
  const candidates = bridgeCommerceEvidenceSources(synthetic)
  assert.equal(candidates.length, 0, 'empty rights excluded')
})

test('stable-source duplicate is not re-added', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const existing = candidates.map(c => ({ source_identifier: c.sourceIdentifier }))
  const classification = classifyRegistrations(candidates, existing)
  assert.equal(classification.counts.unregistered, 0, 'all already registered: nothing new')
  assert.equal(classification.counts.registered, candidates.length, 'all recognized as registered')
})

test('repeated bridge is deterministic/idempotent', () => {
  const first = bridgeCommerceEvidenceSources()
  const second = bridgeCommerceEvidenceSources()
  assert.deepEqual(first, second, 'two runs produce identical candidates')
})

test('all outputs remain needs_review/reference_only', () => {
  const candidates = bridgeCommerceEvidenceSources()
  for (const c of candidates) {
    assert.equal(c.trustTier, 'needs_review', `needs_review: ${c.sourceIdentifier}`)
    assert.equal(c.ingestionEligibility, 'metadata_reference', `metadata_reference: ${c.sourceIdentifier}`)
  }
})

test('finding/limitation cannot become active card through bridge', () => {
  const candidates = bridgeCommerceEvidenceSources()
  for (const c of candidates) {
    assert.ok(!('principle' in c), `no principle field: ${c.sourceIdentifier}`)
    assert.ok(!('status' in c) || !['active', 'reviewed'].includes(c.status), `no active status: ${c.sourceIdentifier}`)
    assert.ok(!('activationEligibility' in c), `no activation eligibility: ${c.sourceIdentifier}`)
  }
})

test('no production mutation path exists in bridge', () => {
  const candidates = bridgeCommerceEvidenceSources()
  for (const c of candidates) {
    assert.equal(c.ingestionEligibility, 'metadata_reference', `no ingestion: ${c.sourceIdentifier}`)
    assert.ok(!('id' in c) || typeof c.id !== 'string' || !c.id.startsWith('db-'), `no database id: ${c.sourceIdentifier}`)
  }
})

test('all 12 eligible sources are mapped', () => {
  const candidates = bridgeCommerceEvidenceSources()
  assert.equal(candidates.length, 12, '12 eligible sources')
})

test('eligibility summary is correct by access level', () => {
  const summary = summariseCommerceEligibility()
  assert.equal(summary.eligible, 12, '12 eligible')
  assert.equal(summary.excluded, 0, '0 excluded')
  assert.equal(summary.byAccess.abstract_only, 3, '3 abstract_only')
  assert.equal(summary.byAccess.selected_full_text_sections, 5, '5 selected_full_text_sections')
  assert.equal(summary.byAccess.full_page, 3, '3 full_page')
  assert.equal(summary.byAccess.official_summary, 1, '1 official_summary')
})

test('research_paper and official_documentation both eligible', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const research = candidates.filter(c => c.sourceType === 'research_paper')
  const official = candidates.filter(c => c.sourceType === 'official_documentation')
  assert.ok(research.length >= 6, 'at least 6 research_paper')
  assert.ok(official.length >= 6, 'at least 6 official_documentation')
})

// ── Review context preservation tests (#441) ──────────────────────────────────

test('S10 jurisdiction = United States preserved verbatim', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s10 = candidates.find(c => c.citedIn[0]?.includes('#S10'))
  assert.ok(s10, 'S10 mapped')
  assert.ok(s10.reviewContext, 'S10 has reviewContext')
  assert.equal(s10.reviewContext.jurisdiction, 'United States', 'jurisdiction preserved exactly')
})

test('S11 jurisdiction = South Africa preserved verbatim', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s11 = candidates.find(c => c.citedIn[0]?.includes('#S11'))
  assert.ok(s11, 'S11 mapped')
  assert.ok(s11.reviewContext, 'S11 has reviewContext')
  assert.equal(s11.reviewContext.jurisdiction, 'South Africa', 'jurisdiction preserved exactly')
})

test('S01 finding preserved as review context', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s01 = candidates.find(c => c.citedIn[0]?.includes('#S01'))
  assert.ok(s01, 'S01 mapped')
  assert.ok(s01.reviewContext, 'S01 has reviewContext')
  assert.equal(
    s01.reviewContext.finding,
    'Laboratory studies describe increased search with a single option and context-dependent increases in selection when alternatives are present.',
    'finding preserved verbatim',
  )
})

test('S01 limitation preserved as review context', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const s01 = candidates.find(c => c.citedIn[0]?.includes('#S01'))
  assert.ok(s01, 'S01 mapped')
  assert.ok(s01.reviewContext?.limitations, 'S01 has limitations')
  assert.equal(
    s01.reviewContext.limitations,
    'No Coke/Pepsi field verification, current retail forecast or universal lift. Full article not reviewed.',
    'limitations preserved verbatim',
  )
})

test('reviewContext is optional and not doctrine', () => {
  const candidates = bridgeCommerceEvidenceSources()
  for (const c of candidates) {
    if (c.reviewContext) {
      assert.ok(!('principle' in c.reviewContext), `no principle in reviewContext: ${c.sourceIdentifier}`)
      assert.ok(!('status' in c.reviewContext), `no status in reviewContext: ${c.sourceIdentifier}`)
    }
  }
})

test('deterministic sort by id', () => {
  const candidates = bridgeCommerceEvidenceSources()
  const ids = candidates.map(c => {
    const match = c.citedIn[0]?.match(/#(\w+)$/)
    return match?.[1] ?? ''
  })
  const sorted = [...ids].sort()
  assert.deepEqual(ids, sorted, 'candidates sorted by id')
})
