import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const SHARED_META = read('../supabase/functions/_shared/meta.ts')
const META_SYNC = read('../supabase/functions/meta-sync/index.ts')
const REPORT_STATS = read('../src/lib/reportStats.ts')
const MIGRATION = read('../supabase/phase-20d-meta-reporting-truth.sql')

let server
let ov

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ov = await server.ssrLoadModule('/src/lib/overviewModel.ts')
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
const fact = (o) => ({ platform: 'facebook', metricKey: 'brand_views', value: 100, availability: 'complete', comparableGroup: 'fb_views_v1', aggregation: 'sum', sourceMetric: 'page_impressions', ...o })

test('comparison renders only when definitions match', () => {
  const r = ov.compareFacts(fact({ value: 120 }), fact({ value: 100 }))
  assert.equal(r.comparable, true)
  assert.equal(Math.round(r.changePercent), 20)
})

test('comparison suppressed when the reporting source (comparable_group) changed', () => {
  const r = ov.compareFacts(fact({ value: 120, comparableGroup: 'fb_views_v2' }), fact({ value: 100 }))
  assert.equal(r.comparable, false)
  assert.equal(r.changePercent, null)
  assert.match(r.reason, /reporting source changed/i)
})

test('comparison suppressed when source metric definition differs', () => {
  const r = ov.compareFacts(fact({ sourceMetric: 'page_impressions_unique' }), fact({ sourceMetric: 'page_impressions' }))
  assert.equal(r.comparable, false)
})

test('comparison suppressed when either period is not verified', () => {
  const r = ov.compareFacts(fact({ value: 120 }), fact({ value: null, availability: 'unavailable' }))
  assert.equal(r.comparable, false)
  assert.equal(r.changePercent, null)
})

test('comparison suppressed when aggregation method differs', () => {
  const r = ov.compareFacts(fact({ aggregation: 'reconstructed' }), fact({ aggregation: 'sum' }))
  assert.equal(r.comparable, false)
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

test('reportStats no longer sums unique audiences across platforms', () => {
  assert.doesNotMatch(REPORT_STATS, /sumOrNull\(withData\.map\(view => view\.reach\)\)/)
  assert.doesNotMatch(REPORT_STATS, /sumOrNull\(withData\.map\(view => view\.views\)\)/)
  assert.match(REPORT_STATS, /never be summed across platforms/i)
})

test('phase-20d migration defines the provenance-first truth tables', () => {
  for (const t of ['metric_registry', 'platform_sync_runs', 'platform_metric_snapshots', 'platform_metric_facts_monthly']) {
    assert.match(MIGRATION, new RegExp(`create table if not exists public\\.${t}`))
  }
  assert.match(MIGRATION, /valid_zero/)
  assert.match(MIGRATION, /cross_platform_additive/)
})
