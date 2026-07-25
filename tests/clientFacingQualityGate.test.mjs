// ============================================================================
// Client-facing quality gate — one enforced contract for every client-visible
// trust invariant. A failure here means a client could see wrong, unsafe, or
// dishonest data. Consolidates the non-negotiable rules across all client
// surfaces so a regression in any one of them fails a single, obvious gate.
// ============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const CAMPAIGNS = read('../src/pages/client/ClientCampaignsPage.tsx')
const CALENDAR = read('../src/pages/client/ClientContentCalendarPage.tsx')
const REPORT_VIEW = read('../src/pages/client/ClientReportView.tsx')
const HOME = read('../src/pages/client/ClientPortalHome.tsx')
const PERFORMANCE = read('../src/pages/client/Dashboard.tsx')
const REPORTS_DB = read('../src/lib/db/reports.ts')
const CALENDAR_LIB = read('../src/lib/clientPortalCalendar.ts')
const CAMPAIGNS_DB_LOADER = read('../src/lib/googleAdsDashboard.ts')
const CALENDAR_RPC = read('../supabase/phase-11a-client-portal-read-access.sql')

let server, ov, cp, ga
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ov = await server.ssrLoadModule('/src/lib/overviewModel.ts')
  cp = await server.ssrLoadModule('/src/lib/clientPortal.ts')
  ga = await server.ssrLoadModule('/src/lib/googleAdsDashboard.ts')
})
after(async () => { await server?.close() })

// ── 1. Client isolation ──────────────────────────────────────────────────────
test('client pages load only via the signed-in profile.client_id, never a URL param', () => {
  for (const [name, src] of [['home', HOME], ['performance', PERFORMANCE], ['campaigns', CAMPAIGNS], ['calendar', CALENDAR]]) {
    assert.match(src, /profile\??\.client_id/, `${name} uses profile.client_id`)
    // No client id sourced from route/query params (that would allow cross-client access).
    assert.doesNotMatch(src, /useParams[\s\S]{0,80}client_?[iI]d/, `${name} must not read client id from the URL`)
    assert.doesNotMatch(src, /searchParams\.get\(['"]client/i, `${name} must not read client id from the query`)
  }
})

test('client report queries are filtered to published + own client', () => {
  assert.match(REPORTS_DB, /\.eq\('client_id', clientId\)[\s\S]*\.eq\('status', 'published'\)/)
})

// ── 2. Published-only, no draft/strategy leakage ─────────────────────────────
test('strategy preview is published-only with an honest empty state', () => {
  const published = { id: 'r', client_id: 'c', platform: null, period_start: '2026-05-01', period_end: '2026-05-31', status: 'published', previous_month_reflection: 'Observed.', strategy_next_month: 'Do X.', strategy_data: null, content_direction_next_month: null, boost_recommendation: null, performance_comments: null, report_title: null }
  assert.ok(cp.buildClientStrategyPreview(published).length > 0)
  assert.deepEqual(cp.buildClientStrategyPreview({ ...published, status: 'draft' }), [])
  assert.deepEqual(cp.buildClientStrategyPreview(null), [])
})

// ── 3. Meta truth: unavailable ≠ zero; unique audiences never summed ─────────
test('unavailable never renders as a value; valid_zero does', () => {
  assert.equal(ov.hasShownValue('unavailable'), false)
  assert.equal(ov.hasShownValue('valid_zero'), true)
  assert.equal(ov.hasRenderableFact({ platform: 'facebook', metricKey: 'brand_views', value: null, availability: 'unavailable', comparableGroup: null, aggregation: 'sum' }), false)
})

test('unique-audience metrics are never summed across platforms', () => {
  const facts = [
    { platform: 'facebook', metricKey: 'reach', value: 6600, availability: 'complete', comparableGroup: 'fb_reach_v1', aggregation: 'unique' },
    { platform: 'instagram', metricKey: 'reach', value: 473, availability: 'complete', comparableGroup: 'ig_reach_v1', aggregation: 'unique' },
  ]
  assert.equal(ov.sumComparableValues(facts), null)
})

test('month-on-month movement is suppressed when the reporting definition changed', () => {
  const base = { platform: 'facebook', metricKey: 'brand_views', value: 100, availability: 'complete', comparableGroup: 'fb_views_v1', aggregation: 'sum', sourceMetric: 'page_impressions', includesPaid: 'both', periodStart: '2026-06-01', periodEnd: '2026-06-30' }
  const r = ov.compareFacts({ ...base, value: 120, comparableGroup: 'fb_views_v2' }, { ...base, periodStart: '2026-05-01', periodEnd: '2026-05-31' })
  assert.equal(r.comparable, false)
  assert.match(r.reason, /reporting source changed/i)
})

// ── 4. Unsupported integrations never appear connected ───────────────────────
test('only genuinely available Facebook/Instagram become active organic platforms', () => {
  const base = { metricKey: 'brand_views', value: 10, availability: 'complete', comparableGroup: null, aggregation: 'sum' }
  const facts = [
    { ...base, platform: 'facebook' },
    { ...base, platform: 'instagram', value: null, availability: 'unavailable' },
    { ...base, platform: 'tiktok', value: 999 },
  ]
  assert.deepEqual(cp.activeOrganicPlatforms(facts), ['Facebook'])
})

test('campaigns page shows unsupported ad platforms as not connected, never fake-active', () => {
  assert.match(CAMPAIGNS, /not connected in the client portal yet/i)
  assert.match(CAMPAIGNS, /Meta Ads/)
  assert.match(CAMPAIGNS, /TikTok Ads/)
  // No confirmed-revenue framing; spend goes "Unavailable" on mixed currency.
  assert.match(CAMPAIGNS, /hasMixedCurrencies[\s\S]{0,60}Unavailable/)
})

// ── 5. No staff-only data in client projections ──────────────────────────────
test('client content calendar exposes no staff notes/assignments and uses safe RPCs', () => {
  assert.doesNotMatch(CALENDAR, /assigned_to|internal_notes|helper_names|staff_note|priority/)
  assert.match(CALENDAR, /fetchClientMonthAhead\(profile\.client_id/)
  assert.match(CALENDAR_LIB, /client_portal_month_ahead_(posts|events)/)
})

// ── 6. No fake submission workflows ──────────────────────────────────────────
test('client campaign feedback is informational only — no fake DB submission', () => {
  assert.doesNotMatch(CAMPAIGNS, /\.from\([^)]*\)\.(insert|update|upsert)\(/)
})

// ── 7. Forward-looking month rules ───────────────────────────────────────────
test('the planning month is the month AFTER the completed report month', () => {
  assert.equal(cp.nextMonth('2026-06'), '2026-07')
  assert.equal(cp.nextMonth('2026-12'), '2027-01')
  const report = { period_start: '2026-06-01', period_end: '2026-06-30' }
  assert.equal(cp.actionMonthForReport(report), '2026-07') // never the completed report month
})

// ── 8. Reporting methodology / provenance is present ─────────────────────────
test('the client report exposes reporting methodology + honest source language', () => {
  assert.match(REPORT_VIEW, /methodology|disclaimer/i)
})

// ══════════════════════════════════════════════════════════════════════════════
//  9. Loading, empty and error states for every client page
// ══════════════════════════════════════════════════════════════════════════════

test('home page has loading, error and empty states', () => {
  assert.match(HOME, /loading.*portal|preparing/i)
  assert.match(HOME, /could not be loaded|unavailable/i)
  assert.match(HOME, /no published report/i)
  assert.match(HOME, /Your next strategy update will appear here/i)
})

test('performance dashboard has loading, error and empty states', () => {
  assert.match(PERFORMANCE, /loading.*report/i)
  assert.match(PERFORMANCE, /could not load/i)
  assert.match(PERFORMANCE, /No published report yet/i)
  assert.match(PERFORMANCE, /account is pending setup/i)
})

test('campaigns page has loading, error, empty and disconnected states', () => {
  assert.match(CAMPAIGNS, /loading.*campaign/i)
  assert.match(CAMPAIGNS, /could not be loaded/i)
  assert.match(CAMPAIGNS, /No published campaign/i)
  assert.match(CAMPAIGNS, /not connected/i)
  assert.match(CAMPAIGNS, /not been linked/i)
  assert.match(CAMPAIGNS, /verified campaign data is not available/i)
  assert.match(CAMPAIGNS, /no campaign activity/i)
})

test('calendar page has loading, error and empty states', () => {
  assert.match(CALENDAR, /loading.*calendar|content calendar/i)
  assert.match(CALENDAR, /could not be loaded/i)
  assert.match(CALENDAR, /No.*schedule items.*available/i)
})

// ── 10. Mobile rendering ──────────────────────────────────────────────────────
test('calendar page renders a mobile agenda view and a desktop grid', () => {
  assert.match(CALENDAR, /hidden lg:block/) // desktop grid
  assert.match(CALENDAR, /lg:hidden/)       // mobile agenda
  assert.match(CALENDAR, /Agenda/)
  assert.match(CALENDAR, /MonthGrid/)
})

test('calendar page supports month navigation via Previous/Next buttons and URL params', () => {
  assert.match(CALENDAR, /Previous/)
  assert.match(CALENDAR, /Next/)
  assert.match(CALENDAR, /searchParams.*month/)
  assert.match(CALENDAR, /shiftMonth/)
})

// ── 11. Client-safe labels only ───────────────────────────────────────────────
test('calendar uses client-safe status labels, never internal codes', () => {
  assert.match(CALENDAR, /CLIENT_SAFE_STATUS_LABELS/)
  assert.doesNotMatch(CALENDAR, /internal_notes|assigned_to|helper_names|priority/)
})

test('campaigns page uses client-safe spend formatting (Unavailable on mixed currency)', () => {
  assert.match(CAMPAIGNS, /formatSpend/)
  assert.match(CAMPAIGNS, /hasMixedCurrencies[\s\S]{0,60}Unavailable/)
})

// ── 12. Google Ads dashboard data model invariants ────────────────────────────
test('Google Ads spend formatting handles null and mixed currencies', () => {
  const data = { spendMicros: null, currencyCode: 'ZAR', hasMixedCurrencies: false, impressions: 0, clicks: 0, ctr: null, campaigns: [], campaignCount: 0 }
  assert.equal(ga.formatGoogleAdsSpend(data), 'Unavailable')
  const mixed = { ...data, spendMicros: 1_500_000, hasMixedCurrencies: true }
  assert.equal(ga.formatGoogleAdsSpend(mixed), 'Unavailable')
  const valid = { ...data, spendMicros: 2_500_000, hasMixedCurrencies: false }
  const formatted = ga.formatGoogleAdsSpend(valid)
  assert.ok(formatted.includes('2')) // en-ZA: R 2,50
  assert.ok(formatted.includes('50'))
})

test('Google Ads CTR formats correctly', () => {
  assert.equal(ga.formatGoogleAdsCTR(null), 'Unavailable')
  assert.equal(ga.formatGoogleAdsCTR(3.45), '3.45%')
  assert.equal(ga.formatGoogleAdsCTR(0), '0.00%')
})

// ── 13. Calendar data model safety ────────────────────────────────────────────
test('client calendar fetch uses SECURITY-DEFINER RPCs keyed to profile.client_id', () => {
  assert.match(CALENDAR_RPC, /security definer/i)
  assert.match(CALENDAR_RPC, /my_client_id/)
  assert.match(CALENDAR_RPC, /is_staff/)
  assert.match(CALENDAR_LIB, /client_portal_month_ahead_posts/)
  assert.match(CALENDAR_LIB, /client_portal_month_ahead_events/)
})

test('unscheduled calendar posts appear in a separate section', () => {
  assert.match(CALENDAR, /unscheduledPosts/)
  assert.match(CALENDAR, /Unscheduled/)
  assert.match(CALENDAR, /Date being finalised/i)
})

// ── 14. Client portal home invariants ─────────────────────────────────────────
test('home page shows report month badge and action month badge when data available', () => {
  assert.match(HOME, /reportMonth/)
  assert.match(HOME, /actionMonth/)
  assert.match(HOME, /monthDisplayLabel/)
  assert.match(HOME, /Latest report:|Planning month:/i)
})

test('portal home does not sum facts or show totalViews/totalReach across platforms', () => {
  assert.doesNotMatch(HOME, /facts\.reduce/)
  assert.doesNotMatch(HOME, /totalViews/)
  assert.doesNotMatch(HOME, /totalReach/)
  assert.match(HOME, /activeOrganic/)
  assert.match(HOME, /activeOrganicPlatforms/)
})

// ── 15. Cross-client isolation at every level ─────────────────────────────────
test('no client page uses useParams or URL search params for client identity', () => {
  for (const [name, src] of [['home', HOME], ['performance', PERFORMANCE], ['campaigns', CAMPAIGNS], ['calendar', CALENDAR]]) {
    assert.doesNotMatch(src, /useParams[\s\S]{0,80}client_?[iI]d/, `${name} must not read client id from route params`)
    assert.doesNotMatch(src, /searchParams\.get\(['"]client/i, `${name} must not read client id from query`)
  }
})

test('no client page directly queries monthly_deliverables or company_calendar_events', () => {
  assert.doesNotMatch(HOME, /monthly_deliverables/)
  assert.doesNotMatch(PERFORMANCE, /monthly_deliverables/)
  assert.doesNotMatch(CAMPAIGNS, /monthly_deliverables/)
  assert.doesNotMatch(CALENDAR, /monthly_deliverables/)
  assert.doesNotMatch(CALENDAR, /company_calendar_events/)
})

// ── 16. Google Ads campaign state machine coverage ────────────────────────────
test('Google Ads campaign state covers all documented states', () => {
  const states = ga.GOOGLE_ADS_DASHBOARD_STATES
  assert.ok(states.includes('disconnected'))
  assert.ok(states.includes('unmapped'))
  assert.ok(states.includes('not-synced'))
  assert.ok(states.includes('no-activity'))
  assert.ok(states.includes('data'))
  assert.ok(states.includes('error'))
})
