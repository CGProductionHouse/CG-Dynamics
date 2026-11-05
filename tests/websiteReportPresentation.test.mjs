import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('published website form events are never presented as verified enquiries or sales', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
    } })
  try {
    const { ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')
    const snapshot = {
      version: 1, websiteId: 1, generatedAt: '2026-10-01T12:00:00Z',
      identity: { dynamicsClientId: 'synthetic-client', canonicalHost: 'fixture.example', environment: 'production' },
      period: { from: '2026-09-01', to: '2026-10-01', timezone: 'Africa/Johannesburg', coverageFrom: '2026-09-01' },
      traffic: { visitors: 22, pageviews: 500, topPages: [], sources: [] },
      conversions: { total: 9, byType: [{ type: 'enquiry_submit', count: 7 }, { type: 'whatsapp_click', count: 2 }] },
      commerce: null,
      dataQuality: { state: 'available', sourceReadAt: '2026-10-01T12:00:00Z', trafficProvider: 'vercel', gaps: [] },
    }
    const report = { id: 'synthetic-report', client_id: 'synthetic-client', status: 'published',
      period_start: '2026-09-01', period_end: '2026-09-30', posts: [], website_report: snapshot }
    const before = structuredClone(snapshot)
    const html = renderToStaticMarkup(createElement(ClientReportView, {
      report, googleAds: null, googleAdsState: 'unmapped', googleAdsError: null,
      initialTab: 'web', onTabChange: () => {},
    }))
    assert.match(html, /Form submissions/)
    assert.match(html, /Tracked contact actions/)
    assert.match(html, /form events do not confirm enquiries or sales/)
    assert.doesNotMatch(html, /Submitted enquiries|Qualified leads|AI leads|AI sales/)
    assert.match(html, />7<\/p>/)
    assert.deepEqual(snapshot, before, 'publication snapshot is never rewritten')
  } finally { await server.close() }
})

test('published website presentation preserves half-open dates, partial coverage and form-event truth', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { websiteReportPresentation: present } = await server.ssrLoadModule('/src/lib/websiteReportPresentation.ts')
    const report = { period: { from: '2026-09-01', to: '2026-10-01', coverageFrom: '2026-09-27', timezone: 'Africa/Johannesburg' }, conversions: { total: 3, byType: [] }, dataQuality: { state: 'partial', sourceReadAt: '2026-09-27T12:00:00Z', trafficProvider: 'vercel' } }
    const result = present(report)
    assert.equal(result.periodEnd, '2026-09-30')
    assert.equal(result.coverageFrom, '2026-09-27')
    assert.equal(result.partial, true)
    assert.equal(result.stale, true)
    assert.match(result.stateLabel, /Partial coverage/)
    assert.equal(result.formSubmissions, null)
    assert.match(result.sourceLabel, /Vercel/)
    for (const total of [0, 3, null]) assert.equal(present({ ...report, conversions: { total, byType: [] } }).formSubmissions, null)
    for (const count of [0, 2]) assert.equal(present({ ...report, conversions: { total: count, byType: [{ type: 'enquiry_submit', count }] } }).formSubmissions, count)
    for (const count of [-1, 1.5, NaN, '2']) assert.equal(present({ ...report, conversions: { total: 3, byType: [{ type: 'enquiry_submit', count }] } }).formSubmissions, null)
    for (const byType of [null, {}, [null], [{ type: 'enquiry_submit', count: 2 }, { type: 'enquiry_submit', count: 3 }]]) {
      assert.equal(present({ ...report, conversions: { total: 5, byType } }).formSubmissions, null)
    }
    assert.equal('enquiries' in result, false, 'provider events cannot acquire lead meaning')
    for (const sourceReadAt of [null, 'invalid']) assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, sourceReadAt } }).stale, true)
    assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, sourceReadAt: '2026-09-30T22:10:00Z' } }).stale, false)
    assert.equal(present({ ...report, period: { ...report.period, timezone: 'invalid' } }).stale, true)
    for (const coverageFrom of [null, 'invalid', '2026-08-31', '2026-10-01']) assert.equal(present({ ...report, period: { ...report.period, coverageFrom } }).coverageFrom, null)
    assert.equal(present({ ...report, period: { ...report.period, to: '2026-02-30' } }).periodEnd, null)
    assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, trafficProvider: 'unavailable' } }).sourceLabel.includes('Meta'), false)
  } finally { await server.close() }
})

test('website tab cannot inherit the Meta source footer or manufacture form-event zero', () => {
  const source = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')
  assert.match(source, /reportSourceAttribution\(activeTab/)
  assert.match(source, /presentation.formSubmissions === null \? 'Measurement unavailable'/)
  assert.doesNotMatch(source, /conversions.total === null \? null : 0/)
  assert.match(source, /Report window:/)
  assert.match(source, /Measurement details and limitations/)
  assert.match(source, /report.website_report \|\| managedWebsite \|\| knownWebsiteMaintenance\s*\?/)
  assert.match(source, /PerformanceServiceStory service="web"/)
  assert.doesNotMatch(source, /report.website_report \|\| managedWebsite \|\| showAdminDiagnostics/)
})
