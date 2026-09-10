import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, tracking
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  tracking = await server.ssrLoadModule('/supabase/functions/_shared/google-ads-tracking-contract.ts')
})
after(async () => { await server?.close() })

// ── the verified ValueTrack restriction ─────────────────────────────────────

test('Search keeps the keyword parameter because Google documents it as reliable there', () => {
  const suffix = tracking.recommendedFinalUrlSuffix('SEARCH')
  assert.match(suffix, /utm_source=google/)
  assert.match(suffix, /utm_medium=cpc/)
  assert.match(suffix, /utm_campaign=\{campaignid\}/)
  assert.match(suffix, /utm_term=\{keyword\}/)
})

test('Performance Max omits keyword AND creative because both resolve blank there', () => {
  const suffix = tracking.recommendedFinalUrlSuffix('PERFORMANCE_MAX')
  assert.doesNotMatch(suffix, /\{keyword\}/, 'keyword is blank on PMax and would look like missing data')
  assert.doesNotMatch(suffix, /\{creative\}/, 'PMax has no conventional creative id')
  assert.match(suffix, /utm_campaign=\{campaignid\}/, 'campaign id stays: it is the join key')
})

test('non-Search campaign types drop the keyword parameter', () => {
  for (const type of ['DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN']) {
    assert.doesNotMatch(tracking.recommendedFinalUrlSuffix(type), /\{keyword\}/, `${type} must not use keyword`)
  }
})

test('campaign id is never dropped for any campaign type', () => {
  for (const type of ['SEARCH', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO', 'SHOPPING', 'DEMAND_GEN', 'UNKNOWN']) {
    assert.match(tracking.recommendedFinalUrlSuffix(type), /\{campaignid\}/, `${type} needs the join key`)
  }
})

// ── validating an observed suffix, read-only ────────────────────────────────

test('a keyword suffix on Performance Max is flagged as resolving blank', () => {
  const findings = tracking.validateFinalUrlSuffix(
    'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}',
    'PERFORMANCE_MAX',
  )
  const warning = findings.find(f => f.severity === 'warning' && f.message.includes('{keyword}'))
  assert.ok(warning, 'must warn that keyword is blank on PMax')
  assert.match(warning.message, /blank/i)
})

test('the same suffix on Search produces no keyword warning', () => {
  const findings = tracking.validateFinalUrlSuffix(
    'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}',
    'SEARCH',
  )
  assert.equal(findings.filter(f => f.severity === 'warning').length, 0)
})

test('a suffix beginning with ? or & is a structural error', () => {
  for (const bad of ['?utm_source=google', '&utm_source=google']) {
    const findings = tracking.validateFinalUrlSuffix(bad, 'SEARCH')
    assert.ok(findings.some(f => f.severity === 'error'), `${bad} must be an error`)
  }
})

test('an absent suffix is reported as info, not invented', () => {
  const findings = tracking.validateFinalUrlSuffix('', 'SEARCH')
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'info')
})

test('unrecognised tokens are surfaced rather than silently accepted', () => {
  const findings = tracking.validateFinalUrlSuffix('utm_campaign={campaignid}&x={notarealtoken}', 'SEARCH')
  assert.ok(findings.some(f => f.message.includes('{notarealtoken}')))
})

// ── readiness reporting never mutates and always names the gate ─────────────

test('a fully configured client is ready with no gated changes', () => {
  const report = tracking.assessTrackingReadiness({
    autoTaggingEnabled: true,
    finalUrlSuffix: 'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}',
    campaignType: 'SEARCH',
    ga4PropertyMapped: true,
  })
  assert.equal(report.readiness, 'ready')
  assert.deepEqual(report.requiredGatedChanges, [])
})

test('disabled auto-tagging is a warning and names the gated account change', () => {
  const report = tracking.assessTrackingReadiness({
    autoTaggingEnabled: false,
    finalUrlSuffix: 'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}',
    campaignType: 'SEARCH',
    ga4PropertyMapped: true,
  })
  assert.equal(report.readiness, 'attention')
  assert.ok(report.requiredGatedChanges.some(c => /auto-tagging/i.test(c)))
})

test('an unmapped GA4 property is not-ready and never guesses a property', () => {
  const report = tracking.assessTrackingReadiness({
    autoTaggingEnabled: true,
    finalUrlSuffix: 'utm_campaign={campaignid}',
    campaignType: 'SEARCH',
    ga4PropertyMapped: false,
  })
  assert.equal(report.readiness, 'not-ready')
  assert.ok(report.requiredGatedChanges.some(c => /GA4 property/i.test(c)))
})

test('unreadable auto-tagging with no suffix is unknown rather than assumed working', () => {
  const report = tracking.assessTrackingReadiness({
    autoTaggingEnabled: null,
    finalUrlSuffix: null,
    campaignType: 'SEARCH',
    ga4PropertyMapped: true,
  })
  assert.equal(report.readiness, 'unknown')
})

test('a missing suffix proposes the campaign-type-correct suffix as a gated change', () => {
  const report = tracking.assessTrackingReadiness({
    autoTaggingEnabled: true,
    finalUrlSuffix: null,
    campaignType: 'PERFORMANCE_MAX',
    ga4PropertyMapped: true,
  })
  const gate = report.requiredGatedChanges.find(c => /Final URL suffix/i.test(c))
  assert.ok(gate)
  assert.doesNotMatch(gate, /\{keyword\}/, 'must not propose a blank-resolving parameter for PMax')
})
