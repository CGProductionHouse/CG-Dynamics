import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const SOURCE = readFileSync(
  new URL('../supabase/functions/_shared/ga4-data-api.ts', import.meta.url),
  'utf8',
)

let server, api, contract
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  api = await server.ssrLoadModule('/supabase/functions/_shared/ga4-data-api.ts')
  contract = await server.ssrLoadModule('/supabase/functions/_shared/ga4-contract.ts')
})
after(async () => { await server?.close() })

const adsJoin = { strategy: 'google-ads-campaign-id', dimensions: ['sessionGoogleAdsCampaignId'], reason: '' }
const fallbackJoin = { strategy: 'session-campaign-id', dimensions: ['sessionCampaignId', 'sessionSourceMedium'], reason: '' }
const splitJoin = { strategy: 'session-campaign-id', dimensions: ['sessionCampaignId', 'sessionSource', 'sessionMedium'], reason: '' }

// ── exact property identity, never a name ───────────────────────────────────

test('property ids must be numeric; a client or property NAME is rejected', () => {
  assert.equal(api.normalizeGa4PropertyId('123456789'), '123456789')
  assert.equal(api.normalizeGa4PropertyId('properties/123456789'), '123456789')
  assert.equal(api.normalizeGa4PropertyId('Cape Lumber'), null)
  assert.equal(api.normalizeGa4PropertyId('G-ABC123'), null)
  assert.equal(api.normalizeGa4PropertyId(''), null)
  assert.equal(api.normalizeGa4PropertyId(null), null)
})

test('the module contains no property-name search path', () => {
  assert.doesNotMatch(SOURCE, /displayName/i, 'a name lookup would be fuzzy matching')
  assert.doesNotMatch(SOURCE, /accountSummaries/i)
})

test('URLs are built from the numeric property id only', () => {
  assert.equal(api.ga4MetadataUrl('123456789'), 'https://analyticsdata.googleapis.com/v1beta/properties/123456789/metadata')
  assert.equal(api.ga4RunReportUrl('123456789'), 'https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport')
})

// ── metadata drives what may be requested ───────────────────────────────────

test('metadata parsing yields the property actual field names', () => {
  const meta = api.parseGa4Metadata({
    dimensions: [{ apiName: 'sessionCampaignId' }, { apiName: 'landingPage' }],
    metrics: [{ apiName: 'sessions' }, { apiName: 'engagedSessions' }],
  })
  assert.deepEqual(meta.dimensions, ['sessionCampaignId', 'landingPage'])
  assert.deepEqual(meta.metrics, ['sessions', 'engagedSessions'])
})

test('malformed metadata yields empty support rather than assumed defaults', () => {
  const meta = api.parseGa4Metadata({ dimensions: 'nope', metrics: null })
  assert.deepEqual(meta.dimensions, [])
  assert.deepEqual(meta.metrics, [])
})

test('property timezone is read for period-alignment honesty', () => {
  assert.equal(api.parseGa4PropertyTimeZone({ timeZone: 'Africa/Johannesburg' }), 'Africa/Johannesburg')
  assert.equal(api.parseGa4PropertyTimeZone({}), null)
})

// ── paid campaign isolation ─────────────────────────────────────────────────

test('the Google Ads campaign dimension needs no source/medium guard', () => {
  const filter = api.buildPaidCampaignFilter(adsJoin, '23937664317')
  assert.equal(filter.filter.fieldName, 'sessionGoogleAdsCampaignId')
  assert.equal(filter.filter.stringFilter.value, '23937664317')
})

test('the generic campaign fallback is ALWAYS combined with a paid source/medium filter', () => {
  const filter = api.buildPaidCampaignFilter(fallbackJoin, '23937664317')
  const expressions = filter.andGroup.expressions
  assert.equal(expressions.length, 2)
  assert.equal(expressions[0].filter.fieldName, 'sessionCampaignId')
  assert.equal(expressions[1].filter.fieldName, 'sessionSourceMedium')
  const values = expressions[1].filter.inListFilter.values
  assert.ok(values.every(v => v.startsWith('google / ')), 'only google paid source/medium pairs')
  assert.ok(!values.includes('google / organic'), 'organic must never be included')
})

test('a split source/medium property filters source AND medium separately', () => {
  const filter = api.buildPaidCampaignFilter(splitJoin, '23937664317')
  const fields = filter.andGroup.expressions.map(e => e.filter.fieldName)
  assert.deepEqual(fields, ['sessionCampaignId', 'sessionSource', 'sessionMedium'])
})

test('an unusable join or non-numeric campaign id produces no filter at all', () => {
  assert.equal(api.buildPaidCampaignFilter({ strategy: 'unavailable', dimensions: [], reason: '' }, '1'), null)
  assert.equal(api.buildPaidCampaignFilter(adsJoin, 'Cape Lumber'), null)
  assert.equal(api.buildPaidCampaignFilter(adsJoin, ''), null)
})

test('the paid medium list stays narrow so organic google is unreachable', () => {
  assert.deepEqual([...api.GOOGLE_PAID_MEDIUMS], ['cpc', 'ppc', 'paid'])
})

// ── request building fails closed ───────────────────────────────────────────

const goodRange = { startDate: '2026-08-01', endDate: '2026-08-31' }

test('a valid request carries the exact range, validated fields and campaign filter', () => {
  const body = api.buildGa4ReportRequest({
    range: goodRange, join: adsJoin, campaignId: '23937664317',
    dimensions: ['landingPage'], metrics: ['sessions', 'engagedSessions'],
  })
  assert.deepEqual(body.dateRanges, [{ startDate: '2026-08-01', endDate: '2026-08-31' }])
  assert.deepEqual(body.metrics, [{ name: 'sessions' }, { name: 'engagedSessions' }])
  assert.deepEqual(body.dimensions, [{ name: 'landingPage' }])
  assert.ok(body.dimensionFilter)
  assert.equal(body.keepEmptyRows, false)
})

test('invalid dates, a reversed range, no metrics or an unusable join build nothing', () => {
  const base = { range: goodRange, join: adsJoin, campaignId: '23937664317', dimensions: [], metrics: ['sessions'] }
  assert.equal(api.buildGa4ReportRequest({ ...base, range: { startDate: 'x', endDate: '2026-08-31' } }), null)
  assert.equal(api.buildGa4ReportRequest({ ...base, range: { startDate: '2026-08-31', endDate: '2026-08-01' } }), null)
  assert.equal(api.buildGa4ReportRequest({ ...base, metrics: [] }), null)
  assert.equal(api.buildGa4ReportRequest({ ...base, join: { strategy: 'unavailable', dimensions: [], reason: '' } }), null)
})

test('only metadata-validated fields reach a request', () => {
  const metadata = { dimensions: ['landingPage'], metrics: ['sessions'] }
  const wanted = contract.validateGa4Selection(['sessions', 'engagedSessions'], metadata.metrics)
  assert.deepEqual(wanted.unsupported, ['engagedSessions'])
  const body = api.buildGa4ReportRequest({
    range: goodRange, join: adsJoin, campaignId: '23937664317',
    dimensions: ['landingPage'], metrics: wanted.supported,
  })
  assert.deepEqual(body.metrics, [{ name: 'sessions' }])
})

// ── response parsing never fabricates ───────────────────────────────────────

const response = {
  dimensionHeaders: [{ name: 'landingPage' }],
  metricHeaders: [{ name: 'sessions' }, { name: 'engagedSessions' }],
  rows: [
    { dimensionValues: [{ value: '/decking' }], metricValues: [{ value: '120' }, { value: '64' }] },
    { dimensionValues: [{ value: '/contact' }], metricValues: [{ value: '30' }, { value: '11' }] },
  ],
}

test('rows are keyed by header name', () => {
  const rows = api.parseGa4ReportRows(response)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].dimensions.landingPage, '/decking')
  assert.equal(rows[0].metrics.sessions, 120)
  assert.equal(rows[1].metrics.engagedSessions, 11)
})

test('a missing or non-numeric metric value becomes null, never zero', () => {
  const rows = api.parseGa4ReportRows({
    dimensionHeaders: [], metricHeaders: [{ name: 'sessions' }],
    rows: [{ dimensionValues: [], metricValues: [{}] }, { dimensionValues: [], metricValues: [{ value: 'n/a' }] }],
  })
  assert.equal(rows[0].metrics.sessions, null)
  assert.equal(rows[1].metrics.sessions, null)
})

test('an empty or malformed response yields no rows rather than throwing', () => {
  assert.deepEqual(api.parseGa4ReportRows({}), [])
  assert.deepEqual(api.parseGa4ReportRows(null), [])
})

test('summing returns null when NO row supplied the metric, so absent stays absent', () => {
  const rows = api.parseGa4ReportRows(response)
  assert.equal(api.sumGa4Metric(rows, 'sessions'), 150)
  assert.equal(api.sumGa4Metric(rows, 'keyEvents'), null)
  assert.equal(api.sumGa4Metric([], 'sessions'), null)
})

test('a rate metric is only trusted from a single row, never averaged across rows', () => {
  const single = api.parseGa4ReportRows({
    dimensionHeaders: [], metricHeaders: [{ name: 'engagementRate' }],
    rows: [{ dimensionValues: [], metricValues: [{ value: '0.55' }] }],
  })
  assert.equal(api.singleRowGa4Metric(single, 'engagementRate'), 0.55)
  assert.equal(api.singleRowGa4Metric(api.parseGa4ReportRows(response), 'sessions'), null)
})
