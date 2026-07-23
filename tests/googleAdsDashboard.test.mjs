import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const readSource = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const DASHBOARD_LIB_SOURCE = readSource('../src/lib/googleAdsDashboard.ts')
const GOOGLE_ADS_LIB_SOURCE = readSource('../src/lib/googleAds.ts')
const PREVIEW_SOURCE = readSource('../src/pages/admin/PublishedPreview.tsx')
const CLIENT_DASHBOARD_SOURCE = readSource('../src/pages/client/Dashboard.tsx')
const REPORT_VIEW_SOURCE = readSource('../src/pages/client/ClientReportView.tsx')
const GOOGLE_ADS_PAGE_SOURCE = readSource('../src/pages/admin/GoogleAdsIntegrationPage.tsx')
const INTEGRATIONS_SOURCE = readSource('../src/pages/admin/IntegrationsPage.tsx')
const SQL_SOURCE = readSource('../supabase/phase-20c-google-ads-client-dashboard.sql')
const USER_FACING_SOURCES = [
  PREVIEW_SOURCE,
  CLIENT_DASHBOARD_SOURCE,
  REPORT_VIEW_SOURCE,
  GOOGLE_ADS_PAGE_SOURCE,
  INTEGRATIONS_SOURCE,
].join('\n')

let server
let loadGoogleAdsDashboard
let formatGoogleAdsCustomerId
let supabase
let originalRpc

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ loadGoogleAdsDashboard } = await server.ssrLoadModule('/src/lib/googleAdsDashboard.ts'))
  ;({ formatGoogleAdsCustomerId } = await server.ssrLoadModule('/src/lib/googleAds.ts'))
  ;({ supabase } = await server.ssrLoadModule('/src/lib/supabase.ts'))
  originalRpc = supabase.rpc
})

after(async () => {
  if (supabase) {
    supabase.rpc = originalRpc
  }
  await server?.close()
})

function mockDashboardRpc({ metrics = [], status = [{ connected: true, has_mapping: true, has_successful_sync: true }], errorFor = null } = {}) {
  const calls = []
  supabase.rpc = async (name, args) => {
    calls.push({ name, args })
    if (name === errorFor) return { data: null, error: { message: 'RPC failed' } }
    if (name === 'get_google_ads_dashboard_campaign_metrics') return { data: metrics, error: null }
    if (name === 'get_google_ads_dashboard_status') return { data: status, error: null }
    throw new Error(`Unexpected RPC: ${name}`)
  }
  return calls
}

test('dashboard loader calls the report-bound RPCs with exact calendar-month arguments', async () => {
  const calls = mockDashboardRpc()
  const result = await loadGoogleAdsDashboard('report-123', '2026-02')

  assert.equal(result.state, 'no-activity')
  assert.deepEqual(calls, [
    {
      name: 'get_google_ads_dashboard_campaign_metrics',
      args: { p_report_id: 'report-123', p_period_start: '2026-02-01', p_period_end: '2026-02-28' },
    },
    {
      name: 'get_google_ads_dashboard_status',
      args: { p_report_id: 'report-123', p_period_start: '2026-02-01', p_period_end: '2026-02-28' },
    },
  ])
})

test('dashboard loader consumes the SQL RPC row contract and keeps weighted Google Ads totals', async () => {
  mockDashboardRpc({
    metrics: [
      { campaign_name: 'Brand Search', campaign_status: 'ENABLED', campaign_type: 'SEARCH', cost: 20, impressions: 150, clicks: 15, conversions: 3, value: 75, currency: 'ZAR' },
    ],
  })

  const result = await loadGoogleAdsDashboard('report-123', '2026-06')
  assert.equal(result.state, 'data')
  assert.equal(result.error, null)
  assert.equal(result.data.month, '2026-06')
  assert.equal(result.data.spendMicros, 20_000_000)
  assert.equal(result.data.impressions, 150)
  assert.equal(result.data.clicks, 15)
  assert.equal(result.data.ctr, 10)
  assert.equal(result.data.averageCpcMicros, 20_000_000 / 15)
  assert.equal(result.data.conversions, 3)
  assert.equal(result.data.conversionValue, 75)
  assert.equal(result.data.currencyCode, 'ZAR')
  assert.equal(result.data.campaignCount, 1)
})

test('dashboard loader returns distinct, client-safe setup, empty, and failure states', async () => {
  const cases = [
    [{ connected: false, has_mapping: false, has_successful_sync: false }, 'disconnected'],
    [{ connected: true, has_mapping: false, has_successful_sync: false }, 'unmapped'],
    [{ connected: true, has_mapping: true, has_successful_sync: false }, 'not-synced'],
    [{ connected: true, has_mapping: true, has_successful_sync: true }, 'no-activity'],
  ]

  for (const [status, expectedState] of cases) {
    mockDashboardRpc({ status: [status] })
    const result = await loadGoogleAdsDashboard('report-safe', '2026-05')
    assert.deepEqual(result, { data: null, state: expectedState, error: null })
  }

  mockDashboardRpc({ errorFor: 'get_google_ads_dashboard_campaign_metrics' })
  assert.deepEqual(
    await loadGoogleAdsDashboard('report-safe', '2026-05'),
    { data: null, state: 'error', error: 'Google Ads data could not be loaded.' },
  )
  assert.deepEqual(
    await loadGoogleAdsDashboard('', 'not-a-month'),
    { data: null, state: 'error', error: 'Google Ads data could not be loaded.' },
  )
})

test('unnamed provider accounts receive a neutral customer-specific label', () => {
  assert.equal(formatGoogleAdsCustomerId('1234567890'), '123-456-7890')
  assert.match(GOOGLE_ADS_LIB_SOURCE, /providerName\.toLowerCase\(\) === 'unnamed account'/)
  assert.match(GOOGLE_ADS_LIB_SOURCE, /`Shared Google Ads account · \$\{formatGoogleAdsCustomerId\(customerId\)\}`/)
  assert.doesNotMatch(GOOGLE_ADS_LIB_SOURCE, /Action Sport/i)
})

test('admin preview and client dashboard automatically load current and previous Google Ads months', () => {
  for (const source of [PREVIEW_SOURCE, CLIENT_DASHBOARD_SOURCE]) {
    assert.match(source, /loadGoogleAdsDashboard\(data\.id, currentMonth\)/)
    assert.match(source, /previousMonth\s*\?\s*loadGoogleAdsDashboard\(data\.id, previousMonth\)/s)
    assert.match(source, /Promise\.all\(\[[\s\S]*googleAdsResult[\s\S]*previousGoogleAdsResult/)
    assert.match(source, /previousGoogleAds=\{previousGoogleAds\}/)
  }
})

test('client route uses only its published report list and passes Google Ads to the report view', () => {
  assert.match(CLIENT_DASHBOARD_SOURCE, /listPublishedReportsForClient\(profile\.client_id\)/)
  assert.doesNotMatch(CLIENT_DASHBOARD_SOURCE, /\blistReports\s*\(/)
  assert.match(CLIENT_DASHBOARD_SOURCE, /googleAds=\{googleAds\}/)
  assert.match(CLIENT_DASHBOARD_SOURCE, /googleAdsState=\{googleAdsState\}/)
  assert.match(CLIENT_DASHBOARD_SOURCE, /googleAdsError=\{googleAdsError\}/)
  assert.doesNotMatch(CLIENT_DASHBOARD_SOURCE, /showAdminDiagnostics/)
})

test('admin Client View passes Google Ads while diagnostics remain role-gated', () => {
  assert.match(PREVIEW_SOURCE, />\s*Client View\s*</)
  assert.match(PREVIEW_SOURCE, /googleAds=\{googleAds\}/)
  assert.match(PREVIEW_SOURCE, /previousGoogleAds=\{previousGoogleAds\}/)
  assert.match(PREVIEW_SOURCE, /showAdminDiagnostics=\{isStaff\}/)
  assert.match(REPORT_VIEW_SOURCE, /\{showAdminDiagnostics && <AdminDataHealth/)
})

test('dashboard and integration surfaces have no manual report loader or diagnostic client default', () => {
  assert.doesNotMatch(USER_FACING_SOURCES, />\s*Load report\s*</i)
  assert.doesNotMatch(USER_FACING_SOURCES, /Action Sport/i)
  assert.doesNotMatch(GOOGLE_ADS_PAGE_SOURCE, /queryGoogleAdsReport/)
})

test('report-bound SQL permits staff preview but requires a published same-client report for clients', () => {
  const functions = SQL_SOURCE.split(/create or replace function public\./).slice(1)
  assert.equal(functions.length, 2)
  for (const body of functions) {
    assert.match(body, /from public\.reports r[\s\S]*where r\.id = p_report_id/)
    assert.match(body, /coalesce\(public\.is_staff\(\), false\)[\s\S]*or \([\s\S]*r\.status = 'published'/)
    assert.match(body, /from public\.profiles p[\s\S]*p\.id = auth\.uid\(\)[\s\S]*p\.client_id = r\.client_id[\s\S]*p\.role = 'client'/)
    assert.match(body, /if report_client_id is null then[\s\S]*raise exception 'Report access denied'/)
    assert.match(body, /p_period_start = report_month_start and p_period_end = report_month_end/)
    assert.match(body, /p_period_start = previous_month_start and p_period_end = previous_month_end/)
    assert.match(body, /Google Ads period must be the report month or previous month/)
  }
})

test('client metrics RPC aggregates campaigns server-side without provider IDs or daily rows', () => {
  const signature = SQL_SOURCE.match(/get_google_ads_dashboard_campaign_metrics\([\s\S]*?\)\s*returns table \(([\s\S]*?)\)\s*language plpgsql/)?.[1] ?? ''
  assert.doesNotMatch(signature, /campaign_id|metric_date|customer_id|account_id/)
  assert.match(SQL_SOURCE, /group by r\.google_ads_account_id, r\.campaign_id, r\.campaign_name, r\.currency_code/)
  assert.match(SQL_SOURCE, /sum\(r\.impressions\)/)
  assert.match(SQL_SOURCE, /sum\(r\.cost_micros\)/)
})

test('SQL excludes cross-client and unmapped metrics for dedicated and shared accounts', () => {
  assert.match(SQL_SOURCE, /al\.google_ads_account_id = a\.id[\s\S]*al\.client_id = report_client_id[\s\S]*al\.is_active/)
  assert.match(SQL_SOURCE, /cl\.google_ads_account_id = a\.id[\s\S]*cl\.customer_id = m\.customer_id[\s\S]*cl\.campaign_id = m\.campaign_id[\s\S]*cl\.client_id = report_client_id[\s\S]*cl\.is_active/)
  assert.doesNotMatch(SQL_SOURCE, /from public\.google_ads_campaign_daily_metrics m[\s\S]*\bleft join public\.google_ads_campaign_links/)
})

test('loader RPC names exactly match both SQL function declarations', () => {
  const loaderNames = [...DASHBOARD_LIB_SOURCE.matchAll(/supabase\.rpc\('([^']+)'/g)].map(match => match[1]).sort()
  const sqlNames = [...SQL_SOURCE.matchAll(/create or replace function public\.(get_google_ads_dashboard_[a-z_]+)\(/g)].map(match => match[1]).sort()
  assert.deepEqual(loaderNames, sqlNames)
})

test('Google Ads comparisons render month-over-month without entering Meta totals', () => {
  assert.match(REPORT_VIEW_SOURCE, /function googleAdsMetrics\([\s\S]*previous: GoogleAdsDashboardData \| null/)
  assert.match(REPORT_VIEW_SOURCE, /googleAdsMetrics\(googleAds, previousGoogleAds\)/)
  assert.match(REPORT_VIEW_SOURCE, /compareNullable\(metric\.current, metric\.previous\)/)
  assert.match(REPORT_VIEW_SOURCE, /<ChannelGrowthPill label="MoM" movement=\{movement\}/)
  assert.match(REPORT_VIEW_SOURCE, /<CombinedHero master=\{master\} performance=\{performance\} \/>/)
  assert.doesNotMatch(REPORT_VIEW_SOURCE, /<CombinedHero[^>]*googleAds/)
  assert.match(REPORT_VIEW_SOURCE, /Paid campaign performance is shown separately from organic social results\./)
})

test('source labels are exact and existing Meta report construction remains in place', () => {
  assert.match(REPORT_VIEW_SOURCE, /'Sources: Meta Business Sync and Google Ads Sync\.'/)
  assert.match(REPORT_VIEW_SOURCE, /'Source: Google Ads Sync\.'/)
  assert.match(REPORT_VIEW_SOURCE, /'Source: Meta Business Sync\.'/)
  assert.match(REPORT_VIEW_SOURCE, /buildMasterReport\(statsPosts, manualMetrics, excludedContentKeys\)/)
  assert.match(REPORT_VIEW_SOURCE, /buildMetaPlatformMetrics\(view\)/)
  assert.match(REPORT_VIEW_SOURCE, /isMetaSyncedManualMetric\(view\.manual\)/)
})

test('client-facing Google Ads states remain distinct', () => {
  for (const label of [
    'Google Ads is not connected',
    'No paid campaigns are linked',
    'Google Ads is not synced for this month',
    'No Google Ads activity this month',
    'Google Ads performance is unavailable',
  ]) assert.match(REPORT_VIEW_SOURCE, new RegExp(label))
})

test('integration sync uses clear result labels and links affected clients to the synced month', () => {
  for (const label of ['Run sync', 'mapped /', 'unmapped campaigns', 'rows imported']) {
    assert.ok(GOOGLE_ADS_PAGE_SOURCE.includes(label), `missing integration sync label: ${label}`)
  }
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /mapped client\{affectedClientIds\.size === 1 \? '' : 's'\}/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /\/admin\/client-dashboard\?client=\$\{encodeURIComponent\(client\.id\)\}&month=\$\{encodeURIComponent\(syncResult\.month\)\}/)
  assert.match(PREVIEW_SOURCE, /searchParams\.get\('client'\)/)
  assert.match(PREVIEW_SOURCE, /searchParams\.get\('month'\)/)
  assert.match(PREVIEW_SOURCE, /getReportMonthFromPeriod\(report\) === initialMonth/)
})

test('integration client picker is searchable, explicit, and never auto-saves suggestions', () => {
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /placeholder="Search clients"/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /role="combobox"/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /role="listbox"/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /client\.name\.toLowerCase\(\)\.includes\(searchTerm\)/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /onChange\(exact\?\.id \?\? ''\)/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /No client selected/)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /Suggestions never save automatically\./)
  assert.match(GOOGLE_ADS_PAGE_SOURCE, /Confirm selected mappings/)
})

test('integrations index preserves Meta status while exposing Google Ads sync management labels', () => {
  assert.match(INTEGRATIONS_SOURCE, /meta-connection-status/)
  assert.match(INTEGRATIONS_SOURCE, /meta_client_assets/)
  assert.match(INTEGRATIONS_SOURCE, /Meta Business/)
  assert.match(INTEGRATIONS_SOURCE, /Google Ads/)
  assert.match(INTEGRATIONS_SOURCE, /Manage Google Ads/)
  assert.match(INTEGRATIONS_SOURCE, /Set up Google Ads/)
  assert.match(INTEGRATIONS_SOURCE, /Google Ads data sync/)
})
