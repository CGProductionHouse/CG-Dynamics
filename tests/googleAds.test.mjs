import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let calculateGoogleAdsReport
let googleAdsCampaignQuery
let isGoogleAdsManagerRole
let normalizeCustomerId
let validGoogleAdsDate
let validateGoogleAdsDateRange

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ calculateGoogleAdsReport } = await server.ssrLoadModule('/src/lib/googleAds.ts'))
  ;({
    googleAdsCampaignQuery,
    isGoogleAdsManagerRole,
    normalizeCustomerId,
    validGoogleAdsDate,
    validateGoogleAdsDateRange,
  } = await server.ssrLoadModule('/supabase/functions/_shared/google-ads-policy.ts'))
})

after(async () => { await server.close() })

test('customer IDs normalize to canonical ten digits and reject invalid values', () => {
  assert.equal(normalizeCustomerId('customers/123-456-7890'), '1234567890')
  assert.equal(normalizeCustomerId(1234567890), '1234567890')
  assert.equal(normalizeCustomerId('12345'), null)
  assert.equal(normalizeCustomerId('not-an-account'), null)
  assert.equal(normalizeCustomerId('unsafe1234567890suffix'), null)
})

test('date validation rejects impossible, reversed, future, and oversized ranges', () => {
  assert.equal(validGoogleAdsDate('2024-02-29'), true)
  assert.equal(validGoogleAdsDate('2025-02-29'), false)
  assert.match(validateGoogleAdsDateRange('2026-07-02', '2026-07-01', '2026-07-23'), /before startDate/)
  assert.match(validateGoogleAdsDateRange('2026-07-01', '2026-07-24', '2026-07-23'), /future/)
  assert.match(validateGoogleAdsDateRange('2025-01-01', '2026-01-02', '2026-07-23'), /366 days/)
  assert.equal(validateGoogleAdsDateRange('2026-07-01', '2026-07-23', '2026-07-23'), null)
})

test('GAQL is the fixed campaign reporting query with only validated dates interpolated', () => {
  const query = googleAdsCampaignQuery('2026-07-01', '2026-07-23')
  for (const field of ['campaign.id', 'campaign.name', 'campaign.status', 'segments.date', 'metrics.impressions', 'metrics.clicks', 'metrics.cost_micros', 'metrics.conversions', 'metrics.conversions_value']) {
    assert.ok(query.includes(field), `missing ${field}`)
  }
  assert.match(query, /FROM campaign/)
  assert.match(query, /segments\.date BETWEEN '2026-07-01' AND '2026-07-23'/)
  assert.throws(() => googleAdsCampaignQuery("2026-07-01' OR TRUE", '2026-07-23'), /invalid dates/)
})

test('metric calculations use weighted totals and provider conversion values', () => {
  const summary = calculateGoogleAdsReport([
    { date: '2026-07-01', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', currencyCode: 'ZAR', spendMicros: 2_000_000, impressions: 100, clicks: 10, conversions: 1.5, conversionValue: 300 },
    { date: '2026-07-02', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', currencyCode: 'ZAR', spendMicros: 1_000_000, impressions: 50, clicks: 5, conversions: 0.5, conversionValue: 100 },
  ])
  assert.equal(summary.spendMicros, 3_000_000)
  assert.equal(summary.impressions, 150)
  assert.equal(summary.clicks, 15)
  assert.equal(summary.ctr, 10)
  assert.equal(summary.averageCpcMicros, 200_000)
  assert.equal(summary.conversions, 2)
  assert.equal(summary.conversionValue, 400)
  assert.equal(summary.campaignCount, 1)
})

test('monetary totals are not combined across currencies', () => {
  const base = { date: '2026-07-01', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', spendMicros: 1_000_000, impressions: 10, clicks: 1, conversions: 0, conversionValue: 0 }
  const summary = calculateGoogleAdsReport([{ ...base, currencyCode: 'ZAR' }, { ...base, customerId: '0987654321', currencyCode: 'USD' }])
  assert.equal(summary.hasMixedCurrencies, true)
  assert.equal(summary.spendMicros, null)
  assert.equal(summary.conversionValue, null)
})

test('only admin and manager roles pass Google Ads setup permission policy', () => {
  assert.equal(isGoogleAdsManagerRole('admin'), true)
  assert.equal(isGoogleAdsManagerRole('manager'), true)
  assert.equal(isGoogleAdsManagerRole('staff'), false)
  assert.equal(isGoogleAdsManagerRole('team'), false)
  assert.equal(isGoogleAdsManagerRole('client'), false)
  assert.equal(isGoogleAdsManagerRole(null), false)
})
