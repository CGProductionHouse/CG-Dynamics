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

let server, ov, cp
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ov = await server.ssrLoadModule('/src/lib/overviewModel.ts')
  cp = await server.ssrLoadModule('/src/lib/clientPortal.ts')
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
