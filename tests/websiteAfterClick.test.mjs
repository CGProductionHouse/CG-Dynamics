import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const CONTRACT_SHARED = read('../supabase/functions/_shared/ga4-contract.ts')
const CONTRACT_APP = read('../src/lib/ga4Contract.ts')
const REPORT_VIEW = read('../src/pages/client/ClientReportView.tsx')
const PREVIEW = read('../src/pages/admin/PublishedPreview.tsx')
const COMPONENT = read('../src/components/client/WebsiteAfterTheClick.tsx')

let server, lib
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  lib = await server.ssrLoadModule('/src/lib/websiteAfterClick.ts')
})
after(async () => { await server?.close() })

// ── the app copy must not drift from the Deno copy ──────────────────────────

test('GA4 contract app and Deno copies do not drift', () => {
  const stripHeader = s => s.split('\n').slice(1).join('\n')
  assert.equal(stripHeader(CONTRACT_APP), stripHeader(CONTRACT_SHARED), 'src/lib and _shared contract must match')
})

// ── deterministic fixtures (live GA4 credentials are a gated step) ───────────

const ads = {
  month: '2026-08', periodStart: '2026-08-01', periodEnd: '2026-08-31',
  timeZone: 'Africa/Johannesburg', impressions: 10_000, clicks: 400,
  spendMicros: 4_000_000_000, currencyCode: 'ZAR', campaigns: [],
}

const ga4 = {
  available: true, unavailableReason: null,
  propertyId: '123456789', propertyTimeZone: 'Africa/Johannesburg',
  dataThroughDate: '2026-08-31', fetchedAt: '2026-09-01T04:00:00.000Z',
  joinStrategy: 'google-ads-campaign-id',
  sessions: 380, activeUsers: 300, engagedSessions: 210, engagementRate: 0.55, keyEvents: 19,
  landingPages: [{ path: '/decking', sessions: 240, engagedSessions: 150 }],
  observedEventNames: ['whatsapp_click', 'page_view'],
  eventCounts: { whatsapp_click: 12 },
  unsupportedFields: [],
}

const ctaDefinitions = [
  { key: 'whatsapp_click', label: 'WhatsApp', eventNames: ['whatsapp_click'], expected: true },
  { key: 'phone_click', label: 'Phone', eventNames: ['phone_click'], expected: true },
]

test('a fully available projection reports GA4 behaviour alongside untouched Ads truth', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: ads, ga4, ctaDefinitions })
  assert.equal(p.state, 'data')
  assert.equal(p.sessions, 380)
  assert.equal(p.engagedSessions, 210)
  assert.equal(p.periodStart, '2026-08-01')
  const byKey = Object.fromEntries(p.funnel.map(s => [s.key, s]))
  assert.equal(byKey.ads_clicks.value, 400, 'Google Ads clicks are read straight from provider truth')
  assert.equal(byKey.ga4_paid_sessions.value, 380)
})

test('Google Ads numbers are never recalculated by this module', () => {
  const SOURCE = read('../src/lib/websiteAfterClick.ts')
  assert.doesNotMatch(SOURCE, /spendMicros\s*[/*+-]/, 'no arithmetic on Ads spend')
  assert.doesNotMatch(SOURCE, /impressions\s*[*/+-]\s/, 'no arithmetic on Ads impressions')
  assert.match(SOURCE, /adsImpressions: ads\.impressions/)
  assert.match(SOURCE, /adsClicks: ads\.clicks/)
})

// ── no zero fabrication in any unavailable state ────────────────────────────

test('an unmapped GA4 property keeps Ads stages and nulls every GA4 number', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: ads, ga4: null, ctaDefinitions })
  assert.equal(p.state, 'not-mapped')
  assert.ok(p.message)
  assert.equal(p.sessions, null)
  assert.equal(p.engagedSessions, null)
  assert.equal(p.conversionRate, null)
  const byKey = Object.fromEntries(p.funnel.map(s => [s.key, s]))
  assert.equal(byKey.ads_clicks.value, 400, 'Ads truth does not depend on GA4')
  assert.equal(byKey.ga4_paid_sessions.value, null)
  assert.ok(byKey.ga4_paid_sessions.unavailableReason)
})

test('a mapped but unreadable property is unavailable, distinct from not-mapped', () => {
  const p = lib.buildWebsiteAfterClickProjection({
    adsDashboard: ads,
    ga4: { ...ga4, available: false, unavailableReason: 'GA4 request failed.' },
    ctaDefinitions,
  })
  assert.equal(p.state, 'unavailable')
  assert.equal(p.message, 'GA4 request failed.')
  assert.equal(p.sessions, null)
})

test('no Google Ads context yields no-ads-context rather than an invented period', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: null, ga4, ctaDefinitions })
  assert.equal(p.state, 'no-ads-context')
  assert.equal(p.periodStart, null)
})

test('every unavailable state produces zero fabricated numbers', () => {
  for (const input of [
    { adsDashboard: ads, ga4: null, ctaDefinitions },
    { adsDashboard: ads, ga4: { ...ga4, available: false, unavailableReason: 'x' }, ctaDefinitions },
    { adsDashboard: null, ga4: null, ctaDefinitions },
  ]) {
    const p = lib.buildWebsiteAfterClickProjection(input)
    for (const field of ['sessions', 'activeUsers', 'engagedSessions', 'engagementRate', 'keyEvents', 'conversionRate']) {
      assert.equal(p[field], null, `${field} must be null, not 0`)
    }
    for (const cta of p.ctas) assert.equal(cta.count, null)
  }
})

// ── CTA truth surfaces through the projection ───────────────────────────────

test('an instrumented CTA shows a number and an uninstrumented one shows setup required', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: ads, ga4, ctaDefinitions })
  const byKey = Object.fromEntries(p.ctas.map(c => [c.key, c]))
  assert.equal(byKey.whatsapp_click.availability, 'tracked')
  assert.equal(byKey.whatsapp_click.count, 12)
  assert.equal(byKey.phone_click.availability, 'setup_required')
  assert.equal(byKey.phone_click.count, null)
  assert.equal(lib.ctaStatusLabel(byKey.phone_click), 'Setup required')
})

// ── attribution honesty ─────────────────────────────────────────────────────

test('clicks and sessions are always accompanied by a variance explanation', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: ads, ga4, ctaDefinitions })
  assert.match(p.varianceNote, /not expected to match/i)
})

test('a provider timezone mismatch is surfaced on the projection', () => {
  const p = lib.buildWebsiteAfterClickProjection({
    adsDashboard: ads, ga4: { ...ga4, propertyTimeZone: 'Etc/UTC' }, ctaDefinitions,
  })
  assert.equal(p.periodAlignment.aligned, false)
  assert.match(p.periodAlignment.note, /Etc\/UTC/)
})

test('conversion rate comes only from GA4 key events over GA4 paid sessions', () => {
  const p = lib.buildWebsiteAfterClickProjection({ adsDashboard: ads, ga4, ctaDefinitions })
  assert.equal(p.conversionRate.toFixed(2), '5.00')
  const noSessions = lib.buildWebsiteAfterClickProjection({
    adsDashboard: ads, ga4: { ...ga4, sessions: 0 }, ctaDefinitions,
  })
  assert.equal(noSessions.conversionRate, null, 'zero sessions must not divide')
})

test('engagement rate is rendered from the GA4 0..1 ratio', () => {
  assert.equal(lib.formatEngagementRate(0.55), '55.0%')
  assert.equal(lib.formatEngagementRate(null), 'Unavailable')
  assert.equal(lib.formatWebsiteMetric(null), 'Unavailable')
})

// ── one canonical projection across client and admin ────────────────────────

test('the report view computes the projection once and passes the same value to both surfaces', () => {
  assert.match(REPORT_VIEW, /const websiteAfterClick = useMemo\(/)
  const passes = REPORT_VIEW.match(/websiteAfterClick=\{websiteAfterClick\}/g) ?? []
  assert.ok(passes.length >= 2, 'overview and Google Ads tab must receive the same projection')
  const builds = REPORT_VIEW.match(/buildWebsiteAfterClickProjection\(/g) ?? []
  assert.equal(builds.length, 1, 'exactly one build call - no second projection path')
})

test('Admin Preview inherits parity by rendering the same ClientReportView', () => {
  assert.match(PREVIEW, /ClientReportView/)
  assert.doesNotMatch(PREVIEW, /WebsiteAfterTheClick/, 'preview must not render its own copy')
})

test('the section extends the Google Ads experience rather than creating an analytics area', () => {
  assert.match(REPORT_VIEW, /<WebsiteAfterTheClick/)
  // It is rendered inside the Google Ads overview section and the Google Ads tab.
  assert.match(REPORT_VIEW, /GoogleAdsResults dashboard=\{googleAds\} \/>\s*\n\s*<WebsiteAfterTheClick/)
})

test('the component never renders a zero in place of an unavailable metric', () => {
  assert.match(COMPONENT, /value === null \? 'Unavailable'/)
  assert.doesNotMatch(COMPONENT, /\?\?\s*0\b/, 'no null-coalescing to zero')
  assert.doesNotMatch(COMPONENT, /\|\|\s*0\b/, 'no falsy-coalescing to zero')
})

test('the component labels each funnel stage with its own provider', () => {
  assert.match(COMPONENT, /providerBadge/)
  assert.match(COMPONENT, /'Google Ads' : 'Website analytics'/)
})
