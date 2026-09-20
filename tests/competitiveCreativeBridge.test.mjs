import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bridgeCompetitiveCreativeSources,
  summariseCompetitiveCreativeEligibility,
  COMPETITIVE_CREATIVE_SOURCES,
} from '../src/lib/marketing-library/competitiveCreativeBridge.ts'
import { classifyRegistrations } from '../src/lib/marketing-library/sourceRegistry.ts'

// ── Competitive-creative source bridge tests (#444) ───────────────────────────

// 1. all current coverage states preserved exactly

test('interface_shell_only stays interface_shell_only', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m0 = candidates.find(c => c.citedIn[0]?.includes('#M0'))
  assert.ok(m0, 'M0 is mapped')
  assert.equal(m0.accessCoverage, 'interface_shell_only')
})

test('indexed_excerpt_only stays indexed_excerpt_only', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m2 = candidates.find(c => c.citedIn[0]?.includes('#M2'))
  assert.ok(m2, 'M2 is mapped')
  assert.equal(m2.accessCoverage, 'indexed_excerpt_only')
})

test('selected_sections stays selected_sections', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m1 = candidates.find(c => c.citedIn[0]?.includes('#M1'))
  assert.ok(m1, 'M1 is mapped')
  assert.equal(m1.accessCoverage, 'selected_sections')
})

test('full_page_text stays full_page_text', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const t1 = candidates.find(c => c.citedIn[0]?.includes('#T1'))
  assert.ok(t1, 'T1 is mapped')
  assert.equal(t1.accessCoverage, 'full_page_text')
})

test('page_text_price_unavailable stays page_text_price_unavailable', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const b3 = candidates.find(c => c.citedIn[0]?.includes('#B3'))
  assert.ok(b3, 'B3 is mapped')
  assert.equal(b3.accessCoverage, 'page_text_price_unavailable')
})

// 2. interface-shell stays interface-shell (redundant but explicit)

test('M0 interface_shell_only is not upgraded to any fuller access', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m0 = candidates.find(c => c.citedIn[0]?.includes('#M0'))
  assert.ok(m0, 'M0 mapped')
  assert.equal(m0.accessCoverage, 'interface_shell_only')
  assert.notEqual(m0.accessCoverage, 'full_page_text')
  assert.notEqual(m0.accessCoverage, 'selected_sections')
})

// 3. indexed excerpt stays indexed excerpt

test('T5 indexed_excerpt_only is not upgraded', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const t5 = candidates.find(c => c.citedIn[0]?.includes('#T5'))
  assert.ok(t5, 'T5 mapped')
  assert.equal(t5.accessCoverage, 'indexed_excerpt_only')
})

// 4. page-price-unavailable stays that exact state

test('B3 page_text_price_unavailable is not coerced to full_page_text', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const b3 = candidates.find(c => c.citedIn[0]?.includes('#B3'))
  assert.ok(b3, 'B3 mapped')
  assert.equal(b3.accessCoverage, 'page_text_price_unavailable')
  assert.notEqual(b3.accessCoverage, 'full_page_text')
})

// 5. known official/provider/vendor/case sources classify deterministically

test('Meta official docs classify as official_documentation', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m1 = candidates.find(c => c.citedIn[0]?.includes('#M1'))
  assert.ok(m1, 'M1 mapped')
  assert.equal(m1.sourceType, 'official_documentation')
})

test('TikTok platform docs classify as official_documentation', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const t1 = candidates.find(c => c.citedIn[0]?.includes('#T1'))
  assert.ok(t1, 'T1 mapped')
  assert.equal(t1.sourceType, 'official_documentation')
})

test('TikTok case reports classify as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const c1 = candidates.find(c => c.citedIn[0]?.includes('#C1'))
  assert.ok(c1, 'C1 mapped')
  assert.equal(c1.sourceType, 'professional_source')
})

test('Google official docs classify as official_documentation', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const g1 = candidates.find(c => c.citedIn[0]?.includes('#G1'))
  assert.ok(g1, 'G1 mapped')
  assert.equal(g1.sourceType, 'official_documentation')
})

test('Brandsearch vendor sources classify as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const b1 = candidates.find(c => c.citedIn[0]?.includes('#B1'))
  assert.ok(b1, 'B1 mapped')
  assert.equal(b1.sourceType, 'professional_source')
})

test('WinningHunter vendor sources classify as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const w1 = candidates.find(c => c.citedIn[0]?.includes('#W1'))
  assert.ok(w1, 'W1 mapped')
  assert.equal(w1.sourceType, 'professional_source')
})

test('Kalodata vendor sources classify as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const k1 = candidates.find(c => c.citedIn[0]?.includes('#K1'))
  assert.ok(k1, 'K1 mapped')
  assert.equal(k1.sourceType, 'professional_source')
})

test('Foreplay API docs classify as official_documentation', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const f1 = candidates.find(c => c.citedIn[0]?.includes('#F1'))
  assert.ok(f1, 'F1 mapped')
  assert.equal(f1.sourceType, 'official_documentation')
})

test('Foreplay pricing page classifies as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const f2 = candidates.find(c => c.citedIn[0]?.includes('#F2'))
  assert.ok(f2, 'F2 mapped')
  assert.equal(f2.sourceType, 'professional_source')
})

test('Motion MCP docs classify as official_documentation', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const o1 = candidates.find(c => c.citedIn[0]?.includes('#O1'))
  assert.ok(o1, 'O1 mapped')
  assert.equal(o1.sourceType, 'official_documentation')
})

test('Motion pricing page classifies as professional_source', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const o2 = candidates.find(c => c.citedIn[0]?.includes('#O2'))
  assert.ok(o2, 'O2 mapped')
  assert.equal(o2.sourceType, 'professional_source')
})

// 6. unknown publisher/source identity fails closed

test('unknown publisher fails closed', () => {
  const synthetic = [
    { id: 'X1', title: 'Unknown Co docs', publisher: 'UnknownCo', url: 'https://x1.com', coverage: 'full_page_text', pageDate: null, finding: 'f', limitation: 'l', status: 'needs_review', accessedAt: '2026-09-19', reviewDue: '2026-10-19', rights: 'r' },
  ]
  const candidates = bridgeCompetitiveCreativeSources(synthetic)
  assert.equal(candidates.length, 0, 'unknown publisher excluded')
})

// 7. incomplete metadata fails closed

test('incomplete metadata fails closed: missing title', () => {
  const synthetic = [
    { id: 'X2', title: '', publisher: 'Meta', url: 'https://x2.com', coverage: 'full_page_text', pageDate: null, finding: 'f', limitation: 'l', status: 'needs_review', accessedAt: '2026-09-19', reviewDue: '2026-10-19', rights: 'r' },
  ]
  const candidates = bridgeCompetitiveCreativeSources(synthetic)
  assert.equal(candidates.length, 0, 'empty title excluded')
})

test('incomplete metadata fails closed: missing rights', () => {
  const synthetic = [
    { id: 'X3', title: 'T', publisher: 'Meta', url: 'https://x3.com', coverage: 'full_page_text', pageDate: null, finding: 'f', limitation: 'l', status: 'needs_review', accessedAt: '2026-09-19', reviewDue: '2026-10-19', rights: '' },
  ]
  const candidates = bridgeCompetitiveCreativeSources(synthetic)
  assert.equal(candidates.length, 0, 'empty rights excluded')
})

test('incomplete metadata fails closed: unsupported coverage', () => {
  const synthetic = [
    { id: 'X4', title: 'T', publisher: 'Meta', url: 'https://x4.com', coverage: 'full_read', pageDate: null, finding: 'f', limitation: 'l', status: 'needs_review', accessedAt: '2026-09-19', reviewDue: '2026-10-19', rights: 'r' },
  ]
  const candidates = bridgeCompetitiveCreativeSources(synthetic)
  assert.equal(candidates.length, 0, 'full_read coverage excluded')
})

// 8. stable-source duplicate not re-added

test('stable-source duplicate is not re-added', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const existing = candidates.map(c => ({ source_identifier: c.sourceIdentifier }))
  const classification = classifyRegistrations(candidates, existing)
  assert.equal(classification.counts.unregistered, 0, 'all already registered: nothing new')
  assert.equal(classification.counts.registered, candidates.length, 'all recognized as registered')
})

// 9. repeated bridge deterministic/idempotent

test('repeated bridge is deterministic/idempotent', () => {
  const first = bridgeCompetitiveCreativeSources()
  const second = bridgeCompetitiveCreativeSources()
  assert.deepEqual(first, second, 'two runs produce identical candidates')
})

// 10. all outputs remain needs_review + reference-only

test('all outputs remain needs_review/reference_only', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  for (const c of candidates) {
    assert.equal(c.trustTier, 'needs_review', `needs_review: ${c.sourceIdentifier}`)
    assert.equal(c.ingestionEligibility, 'metadata_reference', `metadata_reference: ${c.sourceIdentifier}`)
  }
})

// 11. finding/limitation preserved exactly for official provider + vendor source

test('M1 finding preserved verbatim (official provider)', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m1 = candidates.find(c => c.citedIn[0]?.includes('#M1'))
  assert.ok(m1, 'M1 mapped')
  assert.ok(m1.reviewContext?.finding, 'M1 has finding')
  assert.equal(
    m1.reviewContext.finding,
    'Describes EU ad archive expansion, targeting/delivery disclosure and one-year retention.',
    'M1 finding verbatim',
  )
})

test('M1 limitation preserved verbatim (official provider)', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const m1 = candidates.find(c => c.citedIn[0]?.includes('#M1'))
  assert.ok(m1, 'M1 mapped')
  assert.ok(m1.reviewContext?.limitations, 'M1 has limitations')
  assert.equal(
    m1.reviewContext.limitations,
    'Historical announcement, not the complete current API specification.',
    'M1 limitation verbatim',
  )
})

test('B1 finding preserved verbatim (vendor source)', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const b1 = candidates.find(c => c.citedIn[0]?.includes('#B1'))
  assert.ok(b1, 'B1 mapped')
  assert.ok(b1.reviewContext?.finding, 'B1 has finding')
  assert.equal(
    b1.reviewContext.finding,
    'Revenue/traffic estimates are directional and use public signals, panels and modelling, not accounting records.',
    'B1 finding verbatim',
  )
})

test('B1 limitation preserved verbatim (vendor source)', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const b1 = candidates.find(c => c.citedIn[0]?.includes('#B1'))
  assert.ok(b1, 'B1 mapped')
  assert.ok(b1.reviewContext?.limitations, 'B1 has limitations')
  assert.equal(
    b1.reviewContext.limitations,
    'Vendor description, not independently tested accuracy or South African category coverage.',
    'B1 limitation verbatim',
  )
})

// 12. no case/vendor metric becomes an active principle/performance claim

test('no finding/limitation becomes active principle', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  for (const c of candidates) {
    assert.ok(!('principle' in c), `no principle field: ${c.sourceIdentifier}`)
    assert.ok(!('status' in c) || !['active', 'reviewed'].includes(c.status), `no active status: ${c.sourceIdentifier}`)
    assert.ok(!('activationEligibility' in c), `no activation eligibility: ${c.sourceIdentifier}`)
  }
})

// 13. no competitor-media, scraping, provider API, credential, purchase or production mutation path

test('no production mutation path exists in bridge', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  for (const c of candidates) {
    assert.equal(c.ingestionEligibility, 'metadata_reference', `no ingestion: ${c.sourceIdentifier}`)
    assert.ok(!('id' in c) || typeof c.id !== 'string' || !c.id.startsWith('db-'), `no database id: ${c.sourceIdentifier}`)
  }
})

// ── Summary / structural tests ────────────────────────────────────────────────

test('all 22 eligible sources are mapped', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  assert.equal(candidates.length, 22, '22 eligible sources')
})

test('eligibility summary is correct by coverage', () => {
  const summary = summariseCompetitiveCreativeEligibility()
  assert.equal(summary.eligible, 22, '22 eligible')
  assert.equal(summary.excluded, 0, '0 excluded')
  assert.equal(summary.byCoverage.interface_shell_only, 2, '2 interface_shell_only')
  assert.equal(summary.byCoverage.indexed_excerpt_only, 3, '3 indexed_excerpt_only')
  assert.equal(summary.byCoverage.selected_sections, 11, '11 selected_sections')
  assert.equal(summary.byCoverage.full_page_text, 5, '5 full_page_text')
  assert.equal(summary.byCoverage.page_text_price_unavailable, 1, '1 page_text_price_unavailable')
})

test('source-type classification summary is correct', () => {
  const summary = summariseCompetitiveCreativeEligibility()
  assert.equal(summary.bySourceType.official_documentation, 11, '11 official_documentation')
  assert.equal(summary.bySourceType.professional_source, 11, '11 professional_source')
})

test('deterministic sort by id', () => {
  const candidates = bridgeCompetitiveCreativeSources()
  const ids = candidates.map(c => {
    const match = c.citedIn[0]?.match(/#(\w+)$/)
    return match?.[1] ?? ''
  })
  const sorted = [...ids].sort()
  assert.deepEqual(ids, sorted, 'candidates sorted by id')
})
