import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bridgeAudienceLifecycleSources,
  summariseEligibility,
  AUDIENCE_LIFECYCLE_SOURCES,
} from '../src/lib/marketing-library/audienceLifecycleBridge.ts'
import { classifyRegistrations } from '../src/lib/marketing-library/sourceRegistry.ts'

// ── Audience Lifecycle source bridge tests (#426) ─────────────────────────────
//
// Proves the bridge correctly maps eligible FULL-READ official sources
// into RegistrationCandidate format and excludes ineligible sources.

test('eligible FULL-READ official source maps correctly', () => {
  const candidates = bridgeAudienceLifecycleSources()
  // G1 is a known FULL-READ official source
  const g1 = candidates.find(c => c.sourceIdentifier.includes('14530785'))
  assert.ok(g1, 'G1 (audience signals) is mapped')
  assert.equal(g1.kind, 'cited_source')
  assert.equal(g1.sourceType, 'official_documentation')
  assert.equal(g1.family, 'official_documentation')
  assert.equal(g1.trustTier, 'needs_review')
  assert.equal(g1.ingestionEligibility, 'metadata_reference')
  assert.ok(g1.canonicalUrl, 'has canonical URL')
  assert.ok(g1.title, 'has title')
  assert.equal(g1.author, 'Google')
  assert.ok(g1.citedIn[0].includes('sources.json#G1'), 'citedIn traces to source key')
})

test('all 9 eligible sources are mapped', () => {
  const candidates = bridgeAudienceLifecycleSources()
  // G1-G5 (5 Google) + T1-T3 (3 TikTok) + M1 (1 Meta) = 9
  assert.equal(candidates.length, 9, '9 eligible FULL-READ sources')
})

test('blocked source (M2 - blocked_login) is excluded', () => {
  const candidates = bridgeAudienceLifecycleSources()
  const m2 = candidates.find(c => c.sourceIdentifier.includes('meta-advantage-plus'))
  assert.ok(!m2, 'M2 (blocked_login) is not mapped')
})

test('blocked source (M3 - blocked_login) is excluded', () => {
  const candidates = bridgeAudienceLifecycleSources()
  const m3 = candidates.find(c => c.sourceIdentifier.includes('ad-objectives'))
  assert.ok(!m3, 'M3 (blocked_login) is not mapped')
})

test('inaccessible source (M4 - rate_limited) is excluded', () => {
  const candidates = bridgeAudienceLifecycleSources()
  const m4 = candidates.find(c => c.sourceIdentifier.includes('deduplicate-pixel'))
  assert.ok(!m4, 'M4 (rate_limited) is not mapped')
})

test('evidence/access level is preserved and never silently upgraded', () => {
  const candidates = bridgeAudienceLifecycleSources()
  for (const c of candidates) {
    assert.equal(c.trustTier, 'needs_review', `trustTier stays needs_review for ${c.sourceIdentifier}`)
    assert.equal(c.ingestionEligibility, 'metadata_reference', `ingestionEligibility stays metadata_reference for ${c.sourceIdentifier}`)
  }
})

test('mapped entries remain needs_review', () => {
  const candidates = bridgeAudienceLifecycleSources()
  for (const c of candidates) {
    assert.equal(c.trustTier, 'needs_review', `entry remains needs_review: ${c.sourceIdentifier}`)
  }
})

test('no runtime activation occurs', () => {
  const candidates = bridgeAudienceLifecycleSources()
  for (const c of candidates) {
    assert.equal(c.ingestionEligibility, 'metadata_reference', `no activation: ${c.sourceIdentifier}`)
    assert.ok(!('enabled' in c), `no enabled field: ${c.sourceIdentifier}`)
    assert.ok(!('active' in c), `no active field: ${c.sourceIdentifier}`)
  }
})

test('duplicate stable source is not re-added via classifyRegistrations', () => {
  const candidates = bridgeAudienceLifecycleSources()
  // Simulate all already registered
  const existing = candidates.map(c => ({ source_identifier: c.sourceIdentifier }))
  const classification = classifyRegistrations(candidates, existing)
  assert.equal(classification.counts.unregistered, 0, 'all already registered: nothing new')
  assert.equal(classification.counts.registered, 9, 'all 9 recognized as already registered')
})

test('repeated run produces identical result', () => {
  const first = bridgeAudienceLifecycleSources()
  const second = bridgeAudienceLifecycleSources()
  assert.deepEqual(first, second, 'two runs produce identical candidates')
})

test('deterministic sort by key', () => {
  const candidates = bridgeAudienceLifecycleSources()
  const keys = candidates.map(c => {
    const match = c.citedIn[0]?.match(/#(\w+)$/)
    return match?.[1] ?? ''
  })
  const sorted = [...keys].sort()
  assert.deepEqual(keys, sorted, 'candidates are sorted by key')
})

test('eligibility summary is correct', () => {
  const summary = summariseEligibility()
  assert.equal(summary.eligible, 9, '9 eligible')
  assert.equal(summary.excluded, 3, '3 excluded')
  assert.equal(summary.byReason.blocked_login, 2, '2 blocked_login')
  assert.equal(summary.byReason.rate_limited, 1, '1 rate_limited')
})

test('all mapped candidates have required RegistrationCandidate fields', () => {
  const candidates = bridgeAudienceLifecycleSources()
  for (const c of candidates) {
    assert.ok(c.sourceIdentifier, 'has sourceIdentifier')
    assert.equal(c.kind, 'cited_source', 'kind is cited_source')
    assert.ok(c.family, 'has family')
    assert.ok(c.title, 'has title')
    assert.ok(c.sourceType, 'has sourceType')
    assert.equal(c.ingestionEligibility, 'metadata_reference', 'ingestionEligibility is metadata_reference')
    assert.ok(Array.isArray(c.citedIn), 'citedIn is array')
    assert.ok(c.citedIn.length >= 1, 'citedIn has at least one entry')
  }
})

test('M1 (Meta WhatsApp) is mapped as professional_source', () => {
  const candidates = bridgeAudienceLifecycleSources()
  const m1 = candidates.find(c => c.sourceIdentifier.includes('manage-your-businesses-chats'))
  assert.ok(m1, 'M1 is mapped')
  assert.equal(m1.sourceType, 'professional_source')
  assert.equal(m1.family, 'professional_source')
  assert.equal(m1.author, 'Meta')
})
