import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const SHARED_META = read('../supabase/functions/_shared/meta.ts')
const META_SYNC = read('../supabase/functions/meta-sync/index.ts')
const META_WORKER = read('../supabase/functions/meta-sync-worker/index.ts')
const REPORT_STATS = read('../src/lib/reportStats.ts')
const MIGRATION = read('../supabase/phase-20d-meta-reporting-truth.sql')
const PHASE_20E = read('../supabase/phase-20e-facts-client-access-and-curation.sql')
const REPORTING_TRUTH = read('../src/lib/db/reportingTruth.ts')
const CLIENT_VIEW = read('../src/pages/client/ClientReportView.tsx')
const CLIENT_DASHBOARD = read('../src/pages/client/Dashboard.tsx')
const ADMIN_PREVIEW = read('../src/pages/admin/PublishedPreview.tsx')
const META_OAUTH_START = read('../supabase/functions/meta-oauth-start/index.ts')
const META_OAUTH_CALLBACK = read('../supabase/functions/meta-oauth-callback/index.ts')
const META_LIST_ASSETS = read('../supabase/functions/meta-list-assets/index.ts')

let server
let ov
let ClientReportView
let reportStats

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ov = await server.ssrLoadModule('/src/lib/overviewModel.ts')
  ;({ ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx'))
  reportStats = await server.ssrLoadModule('/src/lib/reportStats.ts')
})
after(async () => { if (server) await server.close() })

// ── Availability semantics ──────────────────────────────────────────────────
test('valid_zero is a shown value; unavailable/error are not', () => {
  assert.equal(ov.hasShownValue('complete'), true)
  assert.equal(ov.hasShownValue('valid_zero'), true)
  assert.equal(ov.hasShownValue('partial'), true)
  assert.equal(ov.hasShownValue('unavailable'), false)
  assert.equal(ov.hasShownValue('permission_blocked'), false)
  assert.equal(ov.hasShownValue('error'), false)
  assert.equal(ov.isDefinitive('valid_zero'), true)
  assert.equal(ov.isDefinitive('partial'), false)
})

// ── Comparability gate ──────────────────────────────────────────────────────
const fact = (o) => ({
  platform: 'facebook', metricKey: 'brand_views', value: 100,
  availability: 'complete', comparableGroup: 'fb_views_v1', aggregation: 'sum',
  sourceMetric: 'page_impressions', includesPaid: 'both',
  periodStart: '2026-06-01', periodEnd: '2026-06-30', ...o,
})
const previousFact = (o = {}) => fact({ periodStart: '2026-05-01', periodEnd: '2026-05-31', ...o })

test('comparison renders only when definitions match', () => {
  const r = ov.compareFacts(fact({ value: 120 }), previousFact({ value: 100 }))
  assert.equal(r.comparable, true)
  assert.equal(Math.round(r.changePercent), 20)
})

test('comparison suppressed when the reporting source (comparable_group) changed', () => {
  const r = ov.compareFacts(fact({ value: 120, comparableGroup: 'fb_views_v2' }), previousFact({ value: 100 }))
  assert.equal(r.comparable, false)
  assert.equal(r.changePercent, null)
  assert.match(r.reason, /reporting source changed/i)
})

test('comparison suppressed when source metric definition differs', () => {
  const r = ov.compareFacts(fact({ sourceMetric: 'page_impressions_unique' }), previousFact({ sourceMetric: 'page_impressions' }))
  assert.equal(r.comparable, false)
})

test('comparison suppressed when either period is not verified', () => {
  const r = ov.compareFacts(fact({ value: 120 }), previousFact({ value: null, availability: 'unavailable' }))
  assert.equal(r.comparable, false)
  assert.equal(r.changePercent, null)
})

test('comparison suppressed when aggregation method differs', () => {
  const r = ov.compareFacts(fact({ aggregation: 'reconstructed' }), previousFact({ aggregation: 'sum' }))
  assert.equal(r.comparable, false)
})

test('comparison is suppressed for incomplete periods or paid-scope changes', () => {
  assert.equal(ov.compareFacts(fact({ periodEnd: '2026-06-15' }), previousFact()).comparable, false)
  assert.equal(ov.compareFacts(fact({ includesPaid: 'organic' }), previousFact()).comparable, false)
})

test('a complete fact without a numeric value is never rendered as zero', () => {
  const sections = ov.buildOverviewSections([fact({ value: null })], [])
  assert.equal(sections.length, 0)
})

// ── No cross-platform unique-audience summing ───────────────────────────────
test('unique-audience reach is never summed across platforms', () => {
  const facts = [
    { platform: 'facebook', metricKey: 'reach', value: 6600, availability: 'complete', comparableGroup: 'fb_reach_v1', aggregation: 'unique' },
    { platform: 'instagram', metricKey: 'reach', value: 473, availability: 'complete', comparableGroup: 'ig_reach_v1', aggregation: 'unique' },
  ]
  assert.equal(ov.sumComparableValues(facts), null)
})

test('additive metrics on one platform may be summed', () => {
  const facts = [
    { platform: 'facebook', metricKey: 'content_interactions', value: 400, availability: 'complete', aggregation: 'sum' },
    { platform: 'facebook', metricKey: 'content_interactions', value: 262, availability: 'complete', aggregation: 'sum' },
  ]
  assert.equal(ov.sumComparableValues(facts), 662)
})

// ── Overview sections are per-platform, never combined ───────────────────────
test('Instagram-only views are never presented as a combined all-channel total', () => {
  const current = [
    { platform: 'facebook', metricKey: 'brand_views', value: null, availability: 'unavailable', comparableGroup: 'fb_views_v1', aggregation: 'sum' },
    { platform: 'instagram', metricKey: 'brand_views', value: 1750, availability: 'complete', comparableGroup: 'ig_views_v1', aggregation: 'sum' },
  ]
  const sections = ov.buildOverviewSections(current, [])
  const visibility = sections.find(s => s.key === 'brand_visibility')
  assert.ok(visibility, 'brand visibility section exists')
  // Only the Instagram line is shown (FB unavailable is omitted, not zeroed) and
  // it is explicitly labelled Instagram — never a bare combined "Views".
  const viewLines = visibility.lines.filter(l => l.metricKey === 'brand_views')
  assert.equal(viewLines.length, 1)
  assert.equal(viewLines[0].platform, 'instagram')
  assert.match(viewLines[0].label, /instagram/i)
  assert.equal(viewLines[0].value, 1750)
})

test('valid_zero renders as 0 with a value; unavailable renders no line', () => {
  const current = [
    { platform: 'facebook', metricKey: 'content_interactions', value: 0, availability: 'valid_zero', comparableGroup: 'fb_interactions_v1', aggregation: 'sum' },
    { platform: 'instagram', metricKey: 'content_interactions', value: null, availability: 'unavailable', comparableGroup: 'ig_interactions_v1', aggregation: 'sum' },
  ]
  const sections = ov.buildOverviewSections(current, [])
  const response = sections.find(s => s.key === 'audience_response')
  const lines = response.lines.filter(l => l.metricKey === 'content_interactions')
  assert.equal(lines.length, 1)
  assert.equal(lines[0].platform, 'facebook')
  assert.equal(lines[0].isValidZero, true)
  assert.equal(lines[0].value, 0)
  assert.equal(lines[0].hasValue, true)
})

test('current followers is a snapshot and never shows month-on-month growth', () => {
  const current = [{ platform: 'instagram', metricKey: 'current_followers', value: 891, availability: 'complete', comparableGroup: 'ig_followers_snapshot_v1', aggregation: 'snapshot' }]
  const previous = [{ platform: 'instagram', metricKey: 'current_followers', value: 880, availability: 'complete', comparableGroup: 'ig_followers_snapshot_v1', aggregation: 'snapshot' }]
  const sections = ov.buildOverviewSections(current, previous)
  const line = sections.flatMap(s => s.lines).find(l => l.metricKey === 'current_followers')
  assert.ok(line)
  assert.equal(line.isSnapshot, true)
  assert.equal(line.comparable, false)
  assert.equal(line.changePercent, null)
})

// ── Structural guarantees in the connector + model ──────────────────────────
test('connector never coerces missing account metrics to zero', () => {
  // The engine writes the real value (nullable) and an availability state.
  assert.match(SHARED_META, /value: fact\.value/)
  assert.match(SHARED_META, /'complete'|'valid_zero'|'unavailable'|'permission_blocked'/)
  // The old zero-writing path is gone from meta-sync.
  assert.doesNotMatch(META_SYNC, /upsertSyncedPlatformMetric/)
  assert.doesNotMatch(META_SYNC, /views:\s*0,\s*\n?\s*reach:\s*0/)
  assert.match(META_SYNC, /syncAccountFacts/)
})

test('reportStats never produces a cross-platform combined views/reach total', () => {
  // No cross-platform sum, and no single-platform value promoted to a combined field.
  assert.doesNotMatch(REPORT_STATS, /sumOrNull\(withData\.map\(view => view\.reach\)\)/)
  assert.doesNotMatch(REPORT_STATS, /sumOrNull\(withData\.map\(view => view\.views\)\)/)
  assert.doesNotMatch(REPORT_STATS, /platformsWithReach\.length === 1/)
  // The master total is unconditionally null — views/reach live only per-platform.
  assert.match(REPORT_STATS, /totalReach:\s*null/)
  assert.match(REPORT_STATS, /totalViews:\s*null/)
})

test('scheduled worker uses the shared connector, not a competing one', () => {
  assert.match(META_WORKER, /from '\.\.\/_shared\/meta\.ts'/)
  assert.match(META_WORKER, /syncAccountFacts/)
  // Shares the network layer (no private retry loop competing with the shared one).
  assert.match(META_WORKER, /\bmetaFetch\b/)
  assert.match(META_WORKER, /runType: 'scheduled'/)
})

test('no active Meta function hardcodes a legacy Graph API version', () => {
  // The version is only ever the imported/resolved META_GRAPH_VERSION.
  for (const src of [META_SYNC, META_WORKER, META_OAUTH_START, META_OAUTH_CALLBACK, META_LIST_ASSETS]) {
    assert.doesNotMatch(src, /const\s+META_GRAPH_VERSION\s*=\s*['"]v\d/)
    assert.doesNotMatch(src, /graph\.facebook\.com\/v\d+\.\d+/)
  }
  // The shared resolver refuses unsupported versions and does not silently fall
  // back to an obsolete one.
  assert.match(SHARED_META, /resolveMetaGraphConfig/)
  assert.match(SHARED_META, /META_GRAPH_VERSION is missing/)
  assert.doesNotMatch(SHARED_META, /DEFAULT_GRAPH_VERSION/)
})

test('buildMasterReport never emits a combined views/reach total', async () => {
  const rs = await server.ssrLoadModule('/src/lib/reportStats.ts')
  const posts = [
    { id: 'p1', caption: null, permalink: null, publish_time: '2026-06-10T00:00:00Z', reach: 100, impressions: 200, engagements: 5, post_type: 'photo', platform: 'instagram', imageUrl: null, metaObjectId: 'ig-1' },
  ]
  const master = rs.buildMasterReport(posts, [])
  assert.equal(master.totalReach, null)
  assert.equal(master.totalViews, null)
  // Per-platform value is still present.
  const ig = master.platforms.find(p => p.platform === 'instagram')
  assert.equal(ig.reach, 100)
})

test('legacy automated Meta zeros cannot become verified client metrics', () => {
  const manualZero = {
    platform: 'facebook', views: 0, reach: 0, engagements: 0, profile_visits: 0, followers: 0,
    source_type: 'other', general_notes: 'Meta sync account totals for unavailable metrics',
  }
  const report = reportStats.buildMasterReport([], [manualZero])
  const facebook = report.platforms.find(view => view.platform === 'facebook')
  assert.equal(facebook.views, null)
  assert.equal(facebook.reach, null)
  assert.equal(report.totalViews, null)
  assert.equal(report.totalReach, null)
})

test('content exclusions change highlights but preserve aggregate totals', () => {
  const posts = [
    { id: 'p1', caption: 'First', permalink: null, publish_time: '2026-06-10T00:00:00Z', reach: 100, impressions: 500, engagements: 20, post_type: 'photo', platform: 'instagram', imageUrl: null, metaObjectId: 'ig-1' },
    { id: 'p2', caption: 'Second', permalink: null, publish_time: '2026-06-11T00:00:00Z', reach: 80, impressions: 300, engagements: 10, post_type: 'photo', platform: 'instagram', imageUrl: null, metaObjectId: 'ig-2' },
  ]
  const report = reportStats.buildMasterReport(posts, [], new Set(['instagram:ig-1']))
  assert.equal(report.platforms.find(view => view.platform === 'instagram').engagements, 30)
  assert.equal(report.bestPostOverall.metaObjectId, 'ig-2')
  assert.equal(report.platforms.find(view => view.platform === 'instagram').topPosts[0].metaObjectId, 'ig-2')
})

const baseReport = {
  id: 'report-1', client_id: 'client-1', platform: null,
  period_start: '2026-06-01', period_end: '2026-06-30', status: 'published',
  report_title: 'June report', previous_month_strategy: null, previous_month_reflection: null,
  performance_comments: null, strategy_next_month: null, content_direction_next_month: null,
  boost_recommendation: null, general_notes: null, strategy_data: null, published_at: null,
  created_by: null, created_at: '2026-07-01T00:00:00Z', posts: [],
}

function renderReport(overrides = {}) {
  return renderToStaticMarkup(React.createElement(ClientReportView, {
    report: baseReport,
    googleAds: null,
    previousGoogleAds: null,
    googleAdsState: 'disconnected',
    googleAdsError: null,
    ...overrides,
  }))
}

test('rendered ClientReportView uses normalized facts and only valid comparisons', () => {
  const html = renderReport({ facts: [fact({ value: 120 })], previousFacts: [previousFact({ value: 100 })] })
  assert.match(html, /Facebook views/)
  assert.match(html, /\+20\.0% vs last month/)

  const invalid = renderReport({ facts: [fact({ value: 120 })], previousFacts: [previousFact({ value: 100, sourceMetric: 'changed_metric' })] })
  assert.doesNotMatch(invalid, /\+20\.0% vs last month/)
  assert.match(invalid, /Comparison unavailable because the reporting definition changed/)
})

test('rendered current followers are a snapshot with no percentage', () => {
  const followers = fact({ platform: 'instagram', metricKey: 'current_followers', value: 891, aggregation: 'snapshot', sourceMetric: 'followers_count', comparableGroup: 'ig_followers_snapshot_v1', includesPaid: 'organic' })
  const html = renderReport({ facts: [followers], previousFacts: [previousFact({ ...followers, value: 880 })] })
  assert.match(html, /Current followers snapshot at the latest sync/)
  assert.doesNotMatch(html, /vs last month/)
})

test('rendered exclusions promote the next eligible post and expose admin controls only to staff callback', () => {
  const posts = [
    { id: 'post-1', report_id: 'report-1', meta_post_id: 'ig-1', platform: 'instagram', publish_time: '2026-06-10T00:00:00Z', meta_post_type: 'Photo', caption: 'First performer', permalink: null, views: 500, reach: 100, reactions: 20, comments: 0, shares: 0, total_clicks: 0, raw: { source: 'meta_sync', views: 500, reach: 100, engagements: 20 }, created_at: '2026-06-10T00:00:00Z' },
    { id: 'post-2', report_id: 'report-1', meta_post_id: 'ig-2', platform: 'instagram', publish_time: '2026-06-11T00:00:00Z', meta_post_type: 'Photo', caption: 'Second performer', permalink: null, views: 300, reach: 80, reactions: 10, comments: 0, shares: 0, total_clicks: 0, raw: { source: 'meta_sync', views: 300, reach: 80, engagements: 10 }, created_at: '2026-06-11T00:00:00Z' },
  ]
  const html = renderReport({
    report: { ...baseReport, posts },
    contentExclusions: [{ platform: 'instagram', meta_object_id: 'ig-1', excluded: true }],
    onSetContentExcluded: () => {},
  })
  assert.match(html, /Second performer/)
  assert.doesNotMatch(html, /First performer/)
  assert.match(html, /Top overall performer/)
  assert.match(html, /Skip from report/)
  assert.match(html, /Review skipped posts/)
})

test('legacy fallback renders no ungated prior-month percentage', () => {
  const manual = [{ platform: 'instagram', views: 100, reach: 50, engagements: 5, profile_visits: 2, followers: 10, source_type: 'manual', general_notes: null }]
  const previous = [{ ...manual[0], views: 50, reach: 25 }]
  const html = renderReport({ manualMetrics: manual, previousManualMetrics: previous })
  assert.doesNotMatch(html, /vs last month/)
  assert.doesNotMatch(html, /Versus last month/)
})

test('staff health renders only when explicitly enabled', () => {
  const health = [{
    period_month: '2026-06', platform: 'facebook', attempted: true, successful: true,
    latest_run_status: 'success', latest_health_state: 'verified', latest_attempted_at: '2026-07-01T12:00:00Z',
    last_successful_at: '2026-07-01T12:00:00Z', api_version: 'configured', connector_version: 'meta-connector-v2',
    metric_key: 'brand_views', fact_value: 120, fact_availability: 'complete', source_metric: 'page_impressions',
    aggregation: 'sum', comparable_group: 'fb_views_v1', includes_paid: 'both', fact_verified_at: '2026-07-01T12:00:00Z',
    permission_blocked: false, partial_error_or_stale: false, comparison_eligible: true,
    safe_reference: 'safe-reference', ready_for_client_reporting: true,
  }]
  assert.doesNotMatch(renderReport({ facts: [fact({ value: 120 })], dataHealth: health }), /connector health/)
  assert.match(renderReport({ facts: [fact({ value: 120 })], dataHealth: health, showAdminDiagnostics: true }), /connector health/)
})

test('real admin and client loaders use report-bound current and previous facts', () => {
  assert.match(REPORTING_TRUTH, /supabase\.rpc\('get_report_metric_facts'/)
  assert.match(REPORTING_TRUTH, /period_month === currentMonth/)
  assert.match(REPORTING_TRUTH, /period_month === previousMonth/)
  for (const source of [CLIENT_DASHBOARD, ADMIN_PREVIEW]) {
    assert.match(source, /loadReportPlatformFacts\(data\.id, currentMonth, previousMonth\)/)
    assert.match(source, /facts=\{facts\}/)
    assert.match(source, /previousFacts=\{previousFacts\}/)
    assert.match(source, /loadReportContentExclusions\(data\.id\)/)
  }
  assert.doesNotMatch(CLIENT_DASHBOARD, /loadReportFactHealth/)
  assert.match(ADMIN_PREVIEW, /loadReportFactHealth\(data\.id\)/)
})

test('Phase 20e is report-bound, client-isolated, and keeps health staff-only', () => {
  assert.match(PHASE_20E, /drop policy if exists "platform_metric_facts_monthly: client reads own"/)
  assert.match(PHASE_20E, /drop policy if exists "report_content_exclusions: client reads own"/)
  assert.match(PHASE_20E, /v_status = 'published'[\s\S]*v_client_id = public\.my_client_id\(\)/)
  assert.match(PHASE_20E, /get_report_fact_health[\s\S]*if not public\.is_staff\(\)/)
  assert.match(PHASE_20E, /set_report_content_exclusion[\s\S]*if not public\.is_admin\(\)/)
  assert.match(PHASE_20E, /upsert_platform_metric_fact_preserving_verified/)
  assert.match(PHASE_20E, /f\.availability in \('complete', 'valid_zero'\)[\s\S]*excluded\.availability not in \('complete', 'valid_zero'\)/)
  assert.doesNotMatch(META_SYNC + META_WORKER, /report_content_exclusions/)
})

test('rendered report includes methodology and curation controls without CG-generated wording', () => {
  assert.match(CLIENT_VIEW, /Reporting methodology &amp; disclaimer/)
  assert.match(CLIENT_VIEW, /Top overall performer/)
  assert.match(CLIENT_VIEW, /Skip from report/)
  assert.match(CLIENT_VIEW, /Undo skip/)
  assert.match(CLIENT_VIEW, /Review skipped posts/)
  assert.doesNotMatch(CLIENT_VIEW, /CG-generated content/i)
})

test('phase-20d migration defines the provenance-first truth tables', () => {
  for (const t of ['metric_registry', 'platform_sync_runs', 'platform_metric_snapshots', 'platform_metric_facts_monthly']) {
    assert.match(MIGRATION, new RegExp(`create table if not exists public\\.${t}`))
  }
  assert.match(MIGRATION, /valid_zero/)
  assert.match(MIGRATION, /cross_platform_additive/)
})
