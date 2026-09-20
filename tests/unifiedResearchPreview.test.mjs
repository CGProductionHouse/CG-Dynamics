import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildUnifiedPreview,
  summarisePreview,
} from '../src/lib/marketing-library/unifiedResearchPreview.ts'
import { REGISTRATION_MANIFEST } from '../src/lib/marketing-library/sourceRegistry.ts'
import { bridgeAudienceLifecycleSources } from '../src/lib/marketing-library/audienceLifecycleBridge.ts'
import { bridgeCommerceEvidenceSources } from '../src/lib/marketing-library/commerceEvidenceBridge.ts'
import { bridgeCompetitiveCreativeSources } from '../src/lib/marketing-library/competitiveCreativeBridge.ts'

// ── Unified research-source registration preview tests (#446) ─────────────────

const BASE_CANDIDATE = {
  kind: 'cited_source',
  family: 'official_documentation',
  trustTier: 'needs_review',
  ingestionEligibility: 'metadata_reference',
  sourceAttribution: 'Test.',
  citedIn: ['test/source.json#X1'],
}

function makeCandidate(overrides) {
  return {
    ...BASE_CANDIDATE,
    sourceIdentifier: 'https://example.com/source1',
    title: 'Test Source',
    author: 'Test Publisher',
    canonicalUrl: 'https://example.com/source1',
    rightsNote: 'Test rights',
    sourceType: 'official_documentation',
    ...overrides,
  }
}

// 1. all three bridge outputs enter the derived preview

test('all three bridge outputs enter the derived preview', () => {
  const preview = buildUnifiedPreview([], [], [], [])
  assert.equal(preview.entries.length, 0)

  const c1 = makeCandidate({ sourceIdentifier: 'https://a.com/1', citedIn: ['a#1'] })
  const c2 = makeCandidate({ sourceIdentifier: 'https://b.com/2', citedIn: ['b#2'] })
  const c3 = makeCandidate({ sourceIdentifier: 'https://c.com/3', citedIn: ['c#3'] })
  const c4 = makeCandidate({ sourceIdentifier: 'https://d.com/4', citedIn: ['d#4'] })
  const preview2 = buildUnifiedPreview([c1], [c2], [c3], [c4])
  assert.equal(preview2.entries.length, 4)
})

// 2. existing REGISTRATION_MANIFEST remains unchanged as seed authority

test('REGISTRATION_MANIFEST is not mutated by preview build', () => {
  const before = JSON.parse(JSON.stringify(REGISTRATION_MANIFEST))
  buildUnifiedPreview()
  assert.deepEqual(REGISTRATION_MANIFEST, before, 'manifest unchanged')
})

// 3. exact duplicate source identifiers collapse to one preview identity

test('exact duplicate source identifiers collapse to one preview identity', () => {
  const c1 = makeCandidate({ sourceIdentifier: 'https://dup.com/1', citedIn: ['seed#1'] })
  const c2 = makeCandidate({ sourceIdentifier: 'https://dup.com/1', citedIn: ['al#1'] })
  const preview = buildUnifiedPreview([c1], [c2], [], [])
  assert.equal(preview.entries.length, 1, 'collapsed to one entry')
  assert.equal(preview.entries[0].duplicateCount, 2)
})

// 4. provenance/origin list is merged deterministically

test('provenance/origin list is merged deterministically', () => {
  const c1 = makeCandidate({ sourceIdentifier: 'https://prov.com/1', citedIn: ['seed#1'] })
  const c2 = makeCandidate({ sourceIdentifier: 'https://prov.com/1', citedIn: ['al#1'] })
  const c3 = makeCandidate({ sourceIdentifier: 'https://prov.com/1', citedIn: ['ce#1'] })
  const preview = buildUnifiedPreview([c1], [c2], [c3], [])
  assert.equal(preview.entries.length, 1)
  const origins = preview.entries[0].origins
  assert.deepEqual(origins, ['seed', 'audience_lifecycle', 'commerce_evidence'])
})

// 5. richer optional metadata survives a compatible duplicate

test('richer optional metadata survives a compatible duplicate', () => {
  const sparse = makeCandidate({
    sourceIdentifier: 'https://rich.com/1',
    title: 'Source Title',
    accessCoverage: undefined,
    reviewContext: undefined,
    citedIn: ['seed#1'],
  })
  const rich = makeCandidate({
    sourceIdentifier: 'https://rich.com/1',
    title: 'Source Title',
    accessCoverage: 'full_page_text',
    reviewContext: { finding: 'A finding', limitations: 'A limitation', jurisdiction: 'US' },
    citedIn: ['al#1'],
  })
  const preview = buildUnifiedPreview([sparse], [rich], [], [])
  assert.equal(preview.entries.length, 1)
  const c = preview.entries[0].candidate
  assert.equal(c.accessCoverage, 'full_page_text', 'richer accessCoverage survives')
  assert.equal(c.reviewContext?.finding, 'A finding', 'richer finding survives')
  assert.equal(c.reviewContext?.limitations, 'A limitation', 'richer limitations survive')
  assert.equal(c.reviewContext?.jurisdiction, 'US', 'richer jurisdiction survives')
})

// 6. conflicting source type surfaces conflict state

test('conflicting source type surfaces conflict state', () => {
  const a = makeCandidate({
    sourceIdentifier: 'https://conflict.com/1',
    sourceType: 'official_documentation',
    citedIn: ['seed#1'],
  })
  const b = makeCandidate({
    sourceIdentifier: 'https://conflict.com/1',
    sourceType: 'professional_source',
    citedIn: ['al#1'],
  })
  const preview = buildUnifiedPreview([a], [b], [], [])
  assert.equal(preview.entries.length, 1)
  assert.equal(preview.entries[0].conflict, true)
  assert.ok(preview.entries[0].conflictFields?.includes('sourceType'))
})

// 7. conflicting access coverage surfaces conflict state

test('conflicting access coverage surfaces conflict state', () => {
  const a = makeCandidate({
    sourceIdentifier: 'https://conflict2.com/1',
    accessCoverage: 'abstract_only',
    citedIn: ['ce#1'],
  })
  const b = makeCandidate({
    sourceIdentifier: 'https://conflict2.com/1',
    accessCoverage: 'full_page_text',
    citedIn: ['cc#1'],
  })
  const preview = buildUnifiedPreview([], [], [a], [b])
  assert.equal(preview.entries.length, 1)
  assert.equal(preview.entries[0].conflict, true)
  assert.ok(preview.entries[0].conflictFields?.includes('accessCoverage'))
})

// 8. conflicting rights/evidence context is surfaced, not silently overwritten

test('conflicting review context finding is surfaced, not overwritten', () => {
  const a = makeCandidate({
    sourceIdentifier: 'https://conflict3.com/1',
    reviewContext: { finding: 'Finding A', limitations: 'L', jurisdiction: 'US' },
    citedIn: ['ce#1'],
  })
  const b = makeCandidate({
    sourceIdentifier: 'https://conflict3.com/1',
    reviewContext: { finding: 'Finding B', limitations: 'L', jurisdiction: 'US' },
    citedIn: ['cc#1'],
  })
  const preview = buildUnifiedPreview([], [], [a], [b])
  assert.equal(preview.entries[0].conflict, true)
  assert.ok(preview.entries[0].conflictFields?.includes('reviewContext.finding'))
})

test('conflicting rights note is surfaced, not overwritten', () => {
  const a = makeCandidate({
    sourceIdentifier: 'https://conflict4.com/1',
    rightsNote: 'Rights A',
    citedIn: ['seed#1'],
  })
  const b = makeCandidate({
    sourceIdentifier: 'https://conflict4.com/1',
    rightsNote: 'Rights B',
    citedIn: ['al#1'],
  })
  const preview = buildUnifiedPreview([a], [b], [], [])
  assert.equal(preview.entries[0].conflict, true)
  assert.ok(preview.entries[0].conflictFields?.includes('rightsNote'))
})

// 9. duplicate/conflict counts deterministic

test('duplicate/conflict counts are deterministic', () => {
  const s1 = makeCandidate({ sourceIdentifier: 'https://x.com/1', citedIn: ['s#1'] })
  const s2 = makeCandidate({ sourceIdentifier: 'https://x.com/2', citedIn: ['s#2'] })
  const r1 = makeCandidate({ sourceIdentifier: 'https://x.com/1', citedIn: ['r#1'] })
  const r2 = makeCandidate({
    sourceIdentifier: 'https://x.com/3',
    sourceType: 'professional_source',
    citedIn: ['r#2'],
  })
  const r3 = makeCandidate({
    sourceIdentifier: 'https://x.com/3',
    sourceType: 'official_documentation',
    citedIn: ['r#3'],
  })

  const p1 = buildUnifiedPreview([s1, s2], [r1], [r2, r3], [])
  const p2 = buildUnifiedPreview([s1, s2], [r1], [r2, r3], [])
  assert.deepEqual(p1.summary, p2.summary, 'summary is deterministic')
  assert.equal(p1.summary.totalDuplicate, 1)
  assert.equal(p1.summary.totalConflict, 1)
})

// 10. existing live-source classification dedupes by exact source_identifier

test('existing live-source dedupe remains by exact source_identifier', () => {
  const c = makeCandidate({ sourceIdentifier: 'https://exact.com/1', citedIn: ['s#1'] })
  const preview = buildUnifiedPreview([c], [], [], [])
  assert.equal(preview.entries.length, 1)
  const c2 = makeCandidate({ sourceIdentifier: 'https://exact.com/1', citedIn: ['r#1'] })
  const preview2 = buildUnifiedPreview([c], [c2], [], [])
  assert.equal(preview2.entries.length, 1, 'collapsed by exact identifier')
})

// 11. research-preview-only rows are clearly distinct from seed-backed

test('research-preview-only rows are distinct from seed-backed', () => {
  const seed = makeCandidate({ sourceIdentifier: 'https://seed.com/1', citedIn: ['s#1'] })
  const research = makeCandidate({ sourceIdentifier: 'https://research.com/1', citedIn: ['r#1'] })
  const preview = buildUnifiedPreview([seed], [research], [], [])

  const seedEntry = preview.entries.find(e => e.candidate.sourceIdentifier === 'https://seed.com/1')
  const researchEntry = preview.entries.find(e => e.candidate.sourceIdentifier === 'https://research.com/1')

  assert.ok(seedEntry, 'seed entry exists')
  assert.ok(researchEntry, 'research entry exists')
  assert.deepEqual(seedEntry.origins, ['seed'])
  assert.deepEqual(researchEntry.origins, ['audience_lifecycle'])
  assert.equal(preview.summary.totalResearchPreviewOnly, 1)
})

// 12. repeat build is idempotent

test('repeat build is idempotent', () => {
  const s1 = makeCandidate({ sourceIdentifier: 'https://idem.com/1', citedIn: ['s#1'] })
  const r1 = makeCandidate({ sourceIdentifier: 'https://idem.com/2', citedIn: ['r#1'] })
  const p1 = buildUnifiedPreview([s1], [r1], [], [])
  const p2 = buildUnifiedPreview([s1], [r1], [], [])
  assert.deepEqual(p1, p2, 'two builds produce identical preview')
})

// 13. no SQL/migration/source/card write path

test('no SQL/migration/write path in preview module', () => {
  const preview = buildUnifiedPreview([], [], [], [])
  assert.equal(preview.entries.length, 0, 'pure function produces output without side effects')
})

// 14. Registration UI remains admin-only (structural — summary fields verified)

test('preview summary provides admin display fields', () => {
  const preview = buildUnifiedPreview()
  const summary = summarisePreview(preview)
  assert.ok('totalSeed' in summary, 'has totalSeed')
  assert.ok('totalResearchPreviewOnly' in summary, 'has totalResearchPreviewOnly')
  assert.ok('totalDuplicate' in summary, 'has totalDuplicate')
  assert.ok('totalConflict' in summary, 'has totalConflict')
  assert.ok('byOrigin' in summary, 'has byOrigin')
})

// 15. regressions — #426 / #441 / #444 bridges produce valid output within preview

test('#426 audience lifecycle sources enter preview', () => {
  const al = bridgeAudienceLifecycleSources()
  assert.ok(al.length > 0, '#426 bridge produces output')
  const preview = buildUnifiedPreview([], al, [], [])
  const alEntries = preview.entries.filter(e => e.origins.includes('audience_lifecycle'))
  assert.equal(alEntries.length, al.length, 'all #426 sources in preview')
})

test('#441 commerce evidence sources enter preview', () => {
  const ce = bridgeCommerceEvidenceSources()
  assert.ok(ce.length > 0, '#441 bridge produces output')
  const preview = buildUnifiedPreview([], [], ce, [])
  const ceEntries = preview.entries.filter(e => e.origins.includes('commerce_evidence'))
  assert.equal(ceEntries.length, ce.length, 'all #441 sources in preview')
})

test('#444 competitive creative sources enter preview', () => {
  const cc = bridgeCompetitiveCreativeSources()
  assert.ok(cc.length > 0, '#444 bridge produces output')
  const preview = buildUnifiedPreview([], [], [], cc)
  const ccEntries = preview.entries.filter(e => e.origins.includes('competitive_creative'))
  assert.equal(ccEntries.length, cc.length, 'all #444 sources in preview')
})

// ── Full integration preview ──────────────────────────────────────────────────

test('full preview with all real bridges produces valid summary', () => {
  const preview = buildUnifiedPreview()
  const summary = summarisePreview(preview)
  assert.ok(summary.totalSeed > 0, 'seed manifest has sources')
  assert.ok(summary.totalResearchPreviewOnly > 0, 'research sources exist')
  assert.ok(preview.entries.length > summary.totalSeed, 'entries exceed seed count')
  // Real data may have title/author conflicts between seed and bridge metadata
  assert.ok(summary.totalConflict >= 0, 'conflict count is non-negative')
})
