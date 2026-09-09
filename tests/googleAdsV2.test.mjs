import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const SYNC = read('../supabase/functions/google-ads-sync/index.ts')
const POLICY = read('../supabase/functions/_shared/google-ads-policy.ts')
const MIGRATION = read('../supabase/migrations/20260908181448_google_ads_v2_native_settings.sql')
const RESULTS = read('../src/components/client/GoogleAdsResults.tsx')

let server, native, dashboard, googleAds
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  native = await server.ssrLoadModule('/supabase/functions/_shared/google-ads-native.ts')
  dashboard = await server.ssrLoadModule('/src/lib/googleAdsDashboard.ts')
  googleAds = await server.ssrLoadModule('/src/lib/googleAds.ts')
})
after(async () => { await server?.close() })

test('budget snapshot retains daily/shared settings and never infers budget from cost', () => {
  const result = native.googleAdsNativeSnapshot({
    campaign: { primaryStatus: 'ELIGIBLE', primaryStatusReasons: ['BUDGET_CONSTRAINED'] },
    campaignBudget: {
      amountMicros: '100000000',
      period: 'DAILY',
      explicitlyShared: true,
      referenceCount: '2',
      deliveryMethod: 'STANDARD',
      status: 'ENABLED',
      type: 'STANDARD',
    },
    metrics: { costMicros: '572320000' },
  }, '2026-09-08T12:00:00Z')
  assert.equal(result.budget_amount_micros, 100000000)
  assert.equal(result.budget_total_amount_micros, null)
  assert.equal(result.budget_shared, true)
  assert.equal(result.budget_reference_count, 2)
  assert.deepEqual(result.primary_status_reasons, ['BUDGET_CONSTRAINED'])
  assert.equal(result.observed_at, '2026-09-08T12:00:00Z')
})

test('missing provider fields remain unavailable while explicit zero survives', () => {
  assert.equal(native.nullableGoogleAdsNumber(undefined), null)
  assert.equal(native.nullableGoogleAdsNumber(null), null)
  assert.equal(native.nullableGoogleAdsNumber(''), null)
  assert.equal(native.nullableGoogleAdsNumber('0'), 0)
  assert.equal(native.googleAdsNativeSnapshot({}, 'now').budget_shared, null)
})

test('sync requests and persists Google-native interactions without inventing missing zeros', () => {
  assert.match(POLICY, /metrics\.interactions/)
  assert.match(SYNC, /interactions: requiredMetricNumber\(values\?\.interactions/)
  assert.match(SYNC, /cost_micros: requiredMetricNumber/)
  assert.doesNotMatch(SYNC, /coalesce\(metric\.(?:impressions|clicks|cost_micros|conversions|conversion_value), 0\)/)
})

test('migration is least-privilege and projects only client-safe native settings', () => {
  assert.match(MIGRATION, /add column if not exists interactions bigint/)
  assert.match(MIGRATION, /add column if not exists native_settings jsonb/)
  assert.match(MIGRATION, /set search_path = ''/)
  assert.match(MIGRATION, /get_google_ads_dashboard_status_v2/)
  assert.match(MIGRATION, /create table if not exists public\.google_ads_monthly_targets/)
  assert.match(MIGRATION, /Client-approved CG monthly spend targets/)
  assert.match(MIGRATION, /set_google_ads_monthly_target/)
  assert.match(MIGRATION, /approval_note text not null/)
  assert.match(MIGRATION, /last_successful_sync timestamptz/)
  assert.match(MIGRATION, /revoke all on function public\.replace_google_ads_account_campaign_metrics[\s\S]*from public, anon, authenticated/)
  assert.match(MIGRATION, /grant execute on function public\.get_google_ads_dashboard_campaign_metrics_v2[\s\S]*to authenticated/)
  assert.doesNotMatch(MIGRATION, /'budget_resource_name'/)
  assert.doesNotMatch(MIGRATION, /4_000_000_000|2_875_000_000|R4,000|R2,875/)
})

test('Cape Lumber August truth parses exactly without inventing budget or conversion currency', () => {
  const parsed = dashboard.parseGoogleAdsDashboardData('2026-08', [{
    campaign_name: 'Cape Lumber',
    campaign_status: 'ENABLED',
    campaign_type: 'SMART',
    impressions: 5490,
    clicks: 151,
    interactions: null,
    cost: 572.317666,
    conversions: 37,
    value: 36.995573246,
    currency: 'ZAR',
    time_zone: 'Africa/Johannesburg',
    native_settings: null,
    first_activity: '2026-08-25',
    last_activity: '2026-08-31',
  }], '2026-09-08T05:56:52Z')

  assert.ok(parsed)
  assert.equal(parsed.spendMicros, 572317666)
  assert.equal(parsed.impressions, 5490)
  assert.equal(parsed.clicks, 151)
  assert.equal(parsed.conversions, 37)
  assert.equal(parsed.conversionValue, 36.995573246)
  assert.equal(parsed.conversionRate, null)
  assert.equal(parsed.currencyCode, 'ZAR')
  assert.equal(parsed.timeZone, 'Africa/Johannesburg')
  assert.equal(parsed.campaigns[0].nativeSettings, null)
  assert.equal(parsed.campaigns[0].firstActivity, '2026-08-25')
  assert.equal(parsed.campaigns[0].lastActivity, '2026-08-31')
})

test('provider-native conversion rate uses interactions and configured value stays unitless', () => {
  const parsed = dashboard.parseGoogleAdsDashboardData('2026-09', [{
    campaign_name: 'Example', campaign_status: 'ENABLED', campaign_type: 'SEARCH',
    impressions: 1000, clicks: 150, interactions: 200, cost: 500,
    conversions: 20, value: 40, currency: 'ZAR', time_zone: 'Africa/Johannesburg',
  }])
  assert.equal(parsed?.conversionRate, 10)
  assert.match(RESULTS, /Configured conversion value/)
  assert.match(RESULTS, /Unitless until conversion-action value configuration is verified/)
  assert.doesNotMatch(RESULTS, /formatMoney\(dashboard\.conversionValue/)
  assert.match(RESULTS, /No automatic month-on-month judgement is shown/)
})

test('near-live pacing keeps the CG monthly target separate and projects from elapsed calendar days', () => {
  const parsed = dashboard.parseGoogleAdsDashboardData('2026-09', [{
    campaign_name: 'Cape Lumber', campaign_status: 'ENABLED', campaign_type: 'SMART',
    impressions: 6989, clicks: 191, interactions: 191, cost: 627.405343,
    conversions: 52, value: 52, currency: 'ZAR', time_zone: 'Africa/Johannesburg',
    data_through_date: '2026-09-07', monthly_target_micros: 4_000_000_000,
    target_currency: 'ZAR',
  }])
  assert.ok(parsed)
  assert.equal(parsed.monthlyTargetMicros, 4_000_000_000)
  assert.equal(parsed.daysRemaining, 23)
  assert.equal(parsed.spendToTargetPercent, 627_405_343 / 4_000_000_000 * 100)
  assert.equal(parsed.projectedMonthEndSpendMicros, 627_405_343 / 7 * 30)
  assert.match(RESULTS, /Client-approved monthly target/)
  assert.match(RESULTS, /separate from every Google provider budget/)
  assert.match(RESULTS, /calendar-day run rate/i)
})

test('equal-window trends require two explicit seven-day windows from canonical rows', () => {
  const parsed = dashboard.parseGoogleAdsDashboardData('2026-09', [{
    campaign_name: 'Cape Lumber', campaign_status: 'ENABLED', campaign_type: 'SMART',
    impressions: 100, clicks: 20, interactions: 20, cost: 100,
    conversions: 5, value: 5, currency: 'ZAR', time_zone: 'Africa/Johannesburg',
    data_through_date: '2026-09-14',
    current_7d: { start_date: '2026-09-08', end_date: '2026-09-14', spend_micros: 100_000_000, impressions: 100, clicks: 20, conversions: 5 },
    previous_7d: { start_date: '2026-09-01', end_date: '2026-09-07', spend_micros: 80_000_000, impressions: 90, clicks: 10, conversions: 4 },
  }])
  assert.equal(parsed?.sevenDayTrend?.current.startDate, '2026-09-08')
  assert.equal(parsed?.sevenDayTrend?.previous.endDate, '2026-09-07')
  const weekly = dashboard.buildGoogleAdsWeeklyReportData(parsed)
  assert.equal(weekly?.provider, 'google_ads')
  assert.equal(weekly?.current.clicks, 20)
  assert.equal(weekly?.previous.clicks, 10)
  assert.match(MIGRATION, /data_through_date - 6/)
  assert.match(MIGRATION, /data_through_date - 13/)
  assert.match(MIGRATION, /trend_coverage/)
  assert.match(RESULTS, /Latest 7 days vs previous 7 days/)
})

test('tracking sync includes the prior thirteen days needed for equal windows', () => {
  assert.deepEqual(googleAds.googleAdsTrackingSyncDateRange('2026-09', '2026-09-08'), {
    startDate: '2026-08-19',
    endDate: '2026-09-08',
  })
})
