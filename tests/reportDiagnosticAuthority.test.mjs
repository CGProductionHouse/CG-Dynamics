import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

let server, Report
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    } })
  Report = (await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')).ClientReportView
})
after(async () => { await server?.close() })

const fact = { platform: 'facebook', metricKey: 'brand_views', value: 1474,
  availability: 'complete', sourceMetric: 'page_media_view', aggregation: 'sum',
  comparableGroup: null, periodStart: '2026-10-01', periodEnd: '2026-10-26' }
const health = { platform: 'facebook', period_month: '2026-10', metric_key: 'brand_views',
  source_metric: 'page_media_view', fact_availability: 'complete', latest_run_status: 'partial',
  latest_health_state: 'verified_partial', latest_attempted_at: '2026-10-27T14:45:21Z',
  last_successful_at: null, api_version: 'v25.0', connector_version: 'meta-connector-v3',
  comparison_eligible: false, ready_for_client_reporting: true, safe_reference: 'fixture-run' }
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Report, {
    report: { id: 'fixture-report', client_id: 'fixture-client', title: 'October', platform: null,
      period_start: '2026-10-01', period_end: '2026-10-31', status: 'draft', posts: [] },
    googleAds: null, googleAdsState: 'no-activity', googleAdsError: null,
    showAdminDiagnostics: true, normalizedFactsAttempted: true, facts: [fact], dataHealth: [health],
    ...overrides,
  })))
}

test('normalized report diagnostics do not contradict verified account figures with legacy missing totals', () => {
  const html = render()
  assert.match(html, /1,474/)
  assert.match(html, /Staff only · connector health/)
  assert.match(html, /page_media_view/)
  assert.doesNotMatch(html, /Not synced this month|account total not synced|All account-level metrics synced/)
})

test('an attempted normalized read with no renderable facts cannot fall back to legacy health claims', () => {
  const html = render({ facts: [], dataHealth: [{ ...health, fact_availability: 'permission_blocked',
    permission_blocked: true, ready_for_client_reporting: false }] })
  assert.match(html, /Verified platform figures are unavailable/)
  assert.match(html, /Permission blocked/)
  assert.match(html, /Review required/)
  assert.doesNotMatch(html, /Not synced this month|All account-level metrics synced/)
})

test('legacy reports retain their diagnostics and normal clients see neither staff panel', () => {
  assert.match(render({ normalizedFactsAttempted: false, facts: [], dataHealth: [] }), /Not synced this month/)
  const client = render({ showAdminDiagnostics: false })
  assert.match(client, /1,474/)
  assert.doesNotMatch(client, /Staff only|Data health|Not synced this month|page_media_view/)
})
