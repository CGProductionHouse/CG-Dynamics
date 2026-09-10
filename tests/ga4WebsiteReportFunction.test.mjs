import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const FN = readFileSync(
  new URL('../supabase/functions/ga4-website-report/index.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

// ── read-only ───────────────────────────────────────────────────────────────

test('the function never writes anything', () => {
  for (const forbidden of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/, /\.rpc\(/]) {
    assert.doesNotMatch(FN, forbidden, `write path found: ${forbidden}`)
  }
})

test('it only ever GETs metadata and POSTs runReport to Google', () => {
  const googleUrls = FN.match(/ga4(MetadataUrl|RunReportUrl)\(/g) ?? []
  assert.ok(googleUrls.length >= 2)
  // No Ads mutation, no analytics admin surface, no tracking/link changes.
  assert.doesNotMatch(FN, /analyticsadmin/i)
  assert.doesNotMatch(FN, /googleads\.googleapis/i)
  assert.doesNotMatch(FN, /autoTagging|finalUrlSuffix|trackingUrlTemplate/i)
})

// ── exact-client mapping, no fuzzy matching ─────────────────────────────────

test('the campaign is verified to belong to THIS client before anything is requested', () => {
  assert.match(FN, /from\('google_ads_campaign_links'\)/)
  assert.match(FN, /\.eq\('client_id', clientId\)\.eq\('campaign_id', campaignId\)/)
  // Compare the actual query calls, not the header comment that names both tables.
  const campaignCheck = FN.indexOf("from('google_ads_campaign_links')")
  const propertyLookup = FN.indexOf("from('client_ga4_properties')")
  assert.ok(campaignCheck > 0, 'campaign ownership query must exist')
  assert.ok(propertyLookup > 0, 'property lookup must exist')
  assert.ok(campaignCheck < propertyLookup, 'ownership check must come first')
})

test('the GA4 property is resolved by exact client_id only', () => {
  assert.match(FN, /from\('client_ga4_properties'\)[\s\S]*?\.eq\('client_id', clientId\)\.eq\('is_active', true\)/)
})

test('there is no property-name search anywhere in the path', () => {
  assert.doesNotMatch(FN, /displayName/i)
  assert.doesNotMatch(FN, /accountSummaries/i)
  assert.doesNotMatch(FN, /ilike/i)
})

test('identifiers are validated before use', () => {
  assert.match(FN, /UUID\.test\(clientId\)/)
  assert.match(FN, /\^\\d\{1,20\}\$\/\.test\(campaignId\)/)
  assert.match(FN, /validGa4Date\(startDate\)/)
  assert.match(FN, /endDate < startDate/)
})

// ── credentials are a separate, gated concern ───────────────────────────────

test('GA4 uses its own env vars and never reuses the Google Ads credential', () => {
  assert.match(FN, /GOOGLE_ANALYTICS_CLIENT_ID/)
  assert.match(FN, /GOOGLE_ANALYTICS_CLIENT_SECRET/)
  assert.match(FN, /GOOGLE_ANALYTICS_REFRESH_TOKEN/)
  assert.doesNotMatch(FN, /GOOGLE_ADS_REFRESH_TOKEN/, 'must not borrow the Ads credential')
  assert.doesNotMatch(FN, /GOOGLE_ADS_DEVELOPER_TOKEN/)
})

test('missing credentials return a truthful not-configured state', () => {
  assert.match(FN, /Google Analytics reporting is not configured yet/)
})

// ── schema validated before requesting ──────────────────────────────────────

test('metadata is fetched and the selection validated before any report is requested', () => {
  const metadataAt = FN.indexOf('ga4MetadataUrl(')
  const reportAt = FN.indexOf('ga4RunReportUrl(')
  assert.ok(metadataAt > 0 && metadataAt < reportAt, 'metadata must be fetched first')
  assert.match(FN, /validateGa4Selection\(wantedMetrics, metadata\.metrics\)/)
  assert.match(FN, /resolveGa4JoinStrategy\(metadata\)/)
})

test('an unusable join or unsupported schema returns unavailable rather than a request', () => {
  assert.match(FN, /join\.strategy === 'unavailable'[\s\S]*?return jsonResponse\(unavailable\(/)
  assert.match(FN, /metricSelection\.supported\.length === 0[\s\S]*?return jsonResponse\(unavailable\(/)
})

// ── nothing is ever zero-filled ─────────────────────────────────────────────

test('every unavailable payload nulls all metrics instead of zeroing them', () => {
  const block = FN.slice(FN.indexOf('function unavailable'), FN.indexOf('function ga4Config'))
  for (const field of ['sessions', 'activeUsers', 'engagedSessions', 'engagementRate', 'keyEvents']) {
    assert.match(block, new RegExp(`${field}: null`), `${field} must be null`)
  }
  assert.doesNotMatch(block, /: 0\b/, 'no zero-filled metric')
})

test('a rate metric is never summed across rows', () => {
  assert.match(FN, /engagementRate: singleRowGa4Metric\(summaryRows, 'engagementRate'\)/)
  assert.doesNotMatch(FN, /sumGa4Metric\(summaryRows, 'engagementRate'\)/)
})

test('CTA results come from the client configured taxonomy, not from guessed events', () => {
  assert.match(FN, /from\('client_cta_event_definitions'\)/)
  assert.match(FN, /\.eq\('client_id', clientId\)/)
  assert.match(FN, /evaluateCtas\(\{ definitions, observedEventNames, eventCounts, ga4Reachable: true \}\)/)
})

test('the function requires an authenticated admin or manager', () => {
  assert.match(FN, /requireAdminOrManager\(request\)/)
  assert.match(FN, /if \(!auth\.ok\) return jsonResponse/)
})
