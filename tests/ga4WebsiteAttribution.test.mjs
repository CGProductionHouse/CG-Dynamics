import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, ga4
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  ga4 = await server.ssrLoadModule('/supabase/functions/_shared/ga4-contract.ts')
})
after(async () => { await server?.close() })

// ── schema validation fails closed ──────────────────────────────────────────

test('unknown GA4 field names are reported unsupported instead of being sent to the API', () => {
  const result = ga4.validateGa4Selection(
    ['sessions', 'engagedSessions', 'notARealMetric'],
    ['sessions', 'engagedSessions'],
  )
  assert.deepEqual(result.supported, ['sessions', 'engagedSessions'])
  assert.deepEqual(result.unsupported, ['notARealMetric'])
})

test('an empty property schema supports nothing rather than defaulting to a candidate list', () => {
  const result = ga4.validateGa4Selection(['sessions'], [])
  assert.deepEqual(result.supported, [])
  assert.deepEqual(result.unsupported, ['sessions'])
})

test('every declared candidate field carries an explicit confidence marker', () => {
  for (const table of [ga4.GA4_DIMENSIONS, ga4.GA4_METRICS]) {
    for (const [key, field] of Object.entries(table)) {
      assert.equal(typeof field.apiName, 'string', `${key} needs an apiName`)
      assert.ok(field.apiName.length > 0, `${key} apiName must not be empty`)
      assert.ok(
        field.confidence === 'doc-verified' || field.confidence === 'runtime-only',
        `${key} needs a confidence marker`,
      )
    }
  }
})

// ── Ads ↔ GA4 join strategy ─────────────────────────────────────────────────

test('the Google Ads campaign dimension is preferred when the property exposes it', () => {
  const decision = ga4.resolveGa4JoinStrategy({
    dimensions: ['sessionGoogleAdsCampaignId', 'sessionCampaignId', 'sessionSourceMedium'],
    metrics: [],
  })
  assert.equal(decision.strategy, 'google-ads-campaign-id')
  assert.deepEqual(decision.dimensions, ['sessionGoogleAdsCampaignId'])
})

test('campaign id fallback is always paired with a paid source/medium dimension', () => {
  const decision = ga4.resolveGa4JoinStrategy({
    dimensions: ['sessionCampaignId', 'sessionSourceMedium'],
    metrics: [],
  })
  assert.equal(decision.strategy, 'session-campaign-id')
  assert.ok(decision.dimensions.includes('sessionCampaignId'))
  assert.ok(decision.dimensions.includes('sessionSourceMedium'))
})

test('campaign id without any paid source/medium dimension is unavailable, not a loose match', () => {
  const decision = ga4.resolveGa4JoinStrategy({ dimensions: ['sessionCampaignId'], metrics: [] })
  assert.equal(decision.strategy, 'unavailable')
  assert.deepEqual(decision.dimensions, [])
})

test('a property with no session campaign dimension cannot be attributed at all', () => {
  const decision = ga4.resolveGa4JoinStrategy({ dimensions: ['landingPage'], metrics: [] })
  assert.equal(decision.strategy, 'unavailable')
})

test('organic google traffic is never counted as paid', () => {
  assert.equal(ga4.isGooglePaidSession('google', 'organic'), false)
  assert.equal(ga4.isGooglePaidSession('google', 'referral'), false)
  assert.equal(ga4.isGooglePaidSession('bing', 'cpc'), false)
  assert.equal(ga4.isGooglePaidSession(null, null), false)
  assert.equal(ga4.isGooglePaidSession('google', 'cpc'), true)
  assert.equal(ga4.isGooglePaidSession('  Google ', ' CPC '), true)
})

// ── CTA truth: never a fake zero ────────────────────────────────────────────

const defs = [
  { key: 'whatsapp_click', label: 'WhatsApp', eventNames: ['whatsapp_click'], expected: true },
  { key: 'phone_click', label: 'Phone', eventNames: ['phone_click', 'click_to_call'], expected: true },
  { key: 'newsletter', label: 'Newsletter', eventNames: ['newsletter_signup'], expected: false },
]

test('an expected CTA with no matching GA4 event is setup_required, never zero', () => {
  const [whatsapp] = ga4.evaluateCtas({
    definitions: [defs[0]], observedEventNames: ['page_view'], eventCounts: {}, ga4Reachable: true,
  })
  assert.equal(whatsapp.availability, 'setup_required')
  assert.equal(whatsapp.count, null)
})

test('an unexpected CTA with no matching event is not_tracked, never zero', () => {
  const [newsletter] = ga4.evaluateCtas({
    definitions: [defs[2]], observedEventNames: ['page_view'], eventCounts: {}, ga4Reachable: true,
  })
  assert.equal(newsletter.availability, 'not_tracked')
  assert.equal(newsletter.count, null)
})

test('a tracked event legitimately reporting zero is truthful and shown as zero', () => {
  const [whatsapp] = ga4.evaluateCtas({
    definitions: [defs[0]],
    observedEventNames: ['whatsapp_click'],
    eventCounts: { whatsapp_click: 0 },
    ga4Reachable: true,
  })
  assert.equal(whatsapp.availability, 'tracked')
  assert.equal(whatsapp.count, 0)
})

test('CTA event aliases match in priority order', () => {
  const [phone] = ga4.evaluateCtas({
    definitions: [defs[1]],
    observedEventNames: ['click_to_call'],
    eventCounts: { click_to_call: 12 },
    ga4Reachable: true,
  })
  assert.equal(phone.availability, 'tracked')
  assert.equal(phone.matchedEventName, 'click_to_call')
  assert.equal(phone.count, 12)
})

test('when GA4 cannot be reached every CTA is unavailable rather than zero or setup_required', () => {
  const results = ga4.evaluateCtas({
    definitions: defs, observedEventNames: [], eventCounts: {}, ga4Reachable: false,
  })
  assert.equal(results.length, 3)
  for (const r of results) {
    assert.equal(r.availability, 'unavailable')
    assert.equal(r.count, null)
  }
})

// ── funnel keeps provider semantics ─────────────────────────────────────────

const funnelInput = {
  adsImpressions: 10_000, adsClicks: 400,
  ga4PaidSessions: 380, ga4EngagedSessions: 210, ga4KeyEvents: 17,
  ga4Reachable: true, ga4UnavailableReason: null,
}

test('each funnel stage keeps its own provider so clicks and sessions are never merged', () => {
  const stages = ga4.buildAdsWebsiteFunnel(funnelInput)
  const byKey = Object.fromEntries(stages.map(s => [s.key, s]))
  assert.equal(byKey.ads_clicks.provider, 'google-ads')
  assert.equal(byKey.ga4_paid_sessions.provider, 'ga4')
  assert.notEqual(byKey.ads_clicks.provider, byKey.ga4_paid_sessions.provider)
})

test('GA4 sessions exceeding Ads clicks is preserved, not clamped to look like a funnel', () => {
  const stages = ga4.buildAdsWebsiteFunnel({ ...funnelInput, adsClicks: 100, ga4PaidSessions: 140 })
  const byKey = Object.fromEntries(stages.map(s => [s.key, s]))
  assert.equal(byKey.ads_clicks.value, 100)
  assert.equal(byKey.ga4_paid_sessions.value, 140)
})

test('unreachable GA4 nulls every GA4 stage with a reason and leaves Ads stages intact', () => {
  const stages = ga4.buildAdsWebsiteFunnel({
    ...funnelInput, ga4Reachable: false, ga4UnavailableReason: 'GA4 property is not mapped for this client.',
  })
  for (const stage of stages) {
    if (stage.provider === 'ga4') {
      assert.equal(stage.value, null, `${stage.key} must not show a number`)
      assert.equal(stage.unavailableReason, 'GA4 property is not mapped for this client.')
    } else {
      assert.notEqual(stage.value, null, `${stage.key} must still show Google Ads truth`)
    }
  }
})

test('click/session variance is always explained when both numbers are shown', () => {
  const note = ga4.describeClickSessionVariance(400, 380)
  assert.match(note, /not expected to match/i)
  assert.equal(ga4.describeClickSessionVariance(null, 380), null)
  assert.equal(ga4.describeClickSessionVariance(400, null), null)
})

// ── conversion rate validity ────────────────────────────────────────────────

test('conversion rate is only produced from a valid same-provider numerator and denominator', () => {
  assert.equal(ga4.paidSessionConversionRate(20, 200), 10)
  assert.equal(ga4.paidSessionConversionRate(20, 0), null, 'zero sessions must not divide')
  assert.equal(ga4.paidSessionConversionRate(null, 200), null)
  assert.equal(ga4.paidSessionConversionRate(20, null), null)
  assert.equal(ga4.paidSessionConversionRate(-1, 200), null)
})

// ── date / timezone boundaries ──────────────────────────────────────────────

test('matching provider timezones are reported aligned', () => {
  const alignment = ga4.describePeriodAlignment('Africa/Johannesburg', 'Africa/Johannesburg')
  assert.equal(alignment.aligned, true)
  assert.equal(alignment.note, null)
})

test('differing provider timezones are surfaced instead of implying an exact comparison', () => {
  const alignment = ga4.describePeriodAlignment('Africa/Johannesburg', 'Etc/UTC')
  assert.equal(alignment.aligned, false)
  assert.match(alignment.note, /Africa\/Johannesburg/)
  assert.match(alignment.note, /Etc\/UTC/)
})

test('an unknown provider timezone is never assumed to be aligned', () => {
  assert.equal(ga4.describePeriodAlignment(null, 'Etc/UTC').aligned, false)
  assert.equal(ga4.describePeriodAlignment('Africa/Johannesburg', null).aligned, false)
})
