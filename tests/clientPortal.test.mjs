import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const readSource = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const APP_SOURCE = readSource('../src/App.tsx')
const SHELL_SOURCE = readSource('../src/components/client/ClientPortalShell.tsx')
const HOME_SOURCE = readSource('../src/pages/client/ClientPortalHome.tsx')
const PERFORMANCE_SOURCE = readSource('../src/pages/client/Dashboard.tsx')
const CAMPAIGNS_SOURCE = readSource('../src/pages/client/ClientCampaignsPage.tsx')
const CALENDAR_PAGE_SOURCE = readSource('../src/pages/client/ClientContentCalendarPage.tsx')
const CALENDAR_LIB_SOURCE = readSource('../src/lib/clientPortalCalendar.ts')
const REPORTS_SOURCE = readSource('../src/lib/db/reports.ts')
const CLIENT_RPC_SOURCE = readSource('../supabase/phase-11a-client-portal-read-access.sql')

let server
let activeOrganicPlatforms
let buildClientStrategyPreview

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ activeOrganicPlatforms, buildClientStrategyPreview } = await server.ssrLoadModule('/src/lib/clientPortal.ts'))
})

after(async () => {
  await server?.close()
})

test('all portal routes sit behind the existing client-only guard and legacy dashboard redirects safely', () => {
  const clientRoutes = APP_SOURCE.slice(
    APP_SOURCE.indexOf('{/* Client routes */}'),
    APP_SOURCE.indexOf('<Route path="*"')
  )

  assert.ok(clientRoutes.includes('<Route element={<RequireClient />}>'))
  assert.ok(clientRoutes.includes('path="/client"'))
  assert.ok(clientRoutes.includes('path="/client/performance"'))
  assert.ok(clientRoutes.includes('path="/client/campaigns"'))
  assert.ok(clientRoutes.includes('path="/client/content-calendar"'))
  assert.ok(clientRoutes.includes('path="/dashboard" element={<Navigate to="/client" replace />}'))
  assert.ok(APP_SOURCE.includes(`profile.role === 'client') return <Navigate to="/client" replace />`))
})

test('shared portal navigation links every client area and keeps sign out available', () => {
  for (const route of ['/client', '/client/performance', '/client/campaigns', '/client/content-calendar']) {
    assert.ok(SHELL_SOURCE.includes(`to: '${route}'`))
  }
  assert.match(SHELL_SOURCE, /onClick=\{\(\) => void signOut\(\)\}/)
})

test('portal pages use the signed-in client and only published monthly reports', () => {
  assert.match(HOME_SOURCE, /profile\.client_id/)
  assert.match(HOME_SOURCE, /listPublishedReportsForClient\(profile\.client_id\)/)
  assert.match(PERFORMANCE_SOURCE, /listPublishedReportsForClient\(profile\.client_id\)/)
  assert.match(CAMPAIGNS_SOURCE, /listPublishedReportsForClient\(profile\.client_id\)/)
  assert.match(REPORTS_SOURCE, /\.eq\('client_id', clientId\)[\s\S]*\.eq\('status', 'published'\)/)
})

test('client calendar uses only safe RPC projections and database ownership enforcement', () => {
  assert.match(CALENDAR_PAGE_SOURCE, /fetchClientMonthAhead\(profile\.client_id, month\)/)
  assert.doesNotMatch(CALENDAR_PAGE_SOURCE, /monthly_deliverables|company_calendar_events|assigned_to|internal_notes|priority/)
  assert.match(CALENDAR_LIB_SOURCE, /client_portal_month_ahead_posts/)
  assert.match(CALENDAR_LIB_SOURCE, /client_portal_month_ahead_events/)
  assert.match(CLIENT_RPC_SOURCE, /else public\.my_client_id\(\)/)
  assert.match(CLIENT_RPC_SOURCE, /revoke all on function public\.client_portal_month_ahead_posts/)
})

test('only genuinely available Facebook and Instagram facts become active platform claims', () => {
  const base = {
    metricKey: 'brand_views',
    comparableGroup: null,
    aggregation: 'sum',
    source: 'meta',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    confidence: 'high',
    methodology: null,
    rawMetricName: null,
    rawMetricValue: null,
  }
  const facts = [
    { ...base, platform: 'facebook', value: 20, availability: 'complete' },
    { ...base, platform: 'instagram', value: null, availability: 'unavailable' },
    { ...base, platform: 'tiktok', value: 500, availability: 'complete' },
  ]

  assert.deepEqual(activeOrganicPlatforms(facts), ['Facebook'])
  assert.doesNotMatch(HOME_SOURCE, /TikTok reporting is active|Google Business Profile reporting is active/)
  assert.match(CAMPAIGNS_SOURCE, /This campaign source is not connected in the client portal yet/)
})

test('strategy preview uses published reviewed fields and has an honest empty state', () => {
  const report = {
    id: 'report-1',
    client_id: 'client-1',
    platform: null,
    period_start: '2026-05-01',
    period_end: '2026-05-31',
    status: 'published',
    report_title: null,
    previous_month_strategy: null,
    previous_month_reflection: 'Short videos retained attention.',
    performance_comments: null,
    strategy_next_month: 'Test a stronger opening hook.',
    content_direction_next_month: null,
    boost_recommendation: null,
    general_notes: null,
    strategy_data: null,
    published_at: '2026-06-03T08:00:00Z',
    created_by: null,
    created_at: '2026-06-01T08:00:00Z',
  }
  const preview = buildClientStrategyPreview(report)

  assert.equal(preview[0].label, 'What CG observed')
  assert.equal(preview[0].value, 'Short videos retained attention.')
  assert.ok(preview.some(item => item.value === 'Test a stronger opening hook.'))
  assert.deepEqual(buildClientStrategyPreview({ ...report, status: 'draft' }), [])
  assert.match(HOME_SOURCE, /Your next strategy update will appear here once the current reporting review is complete\./)
})

test('verified performance reporting loaders and availability model remain in place', () => {
  assert.match(PERFORMANCE_SOURCE, /loadReportPlatformFacts/)
  assert.match(PERFORMANCE_SOURCE, /loadReportContentExclusions/)
  assert.match(PERFORMANCE_SOURCE, /loadGoogleAdsDashboard/)
  assert.match(PERFORMANCE_SOURCE, /previousReportMonth/)
  assert.doesNotMatch(HOME_SOURCE, /facts\.reduce|totalReach|totalViews/)
})
