import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

test('published website presentation preserves half-open dates, partial coverage and missing enquiry truth', async () => {
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
    assert.equal(result.enquiries, null)
    assert.match(result.sourceLabel, /Vercel/)
    for (const total of [0, 3, null]) assert.equal(present({ ...report, conversions: { total, byType: [] } }).enquiries, null)
    for (const count of [0, 2]) assert.equal(present({ ...report, conversions: { total: count, byType: [{ type: 'enquiry_submit', count }] } }).enquiries, count)
    for (const count of [-1, 1.5, NaN, '2']) assert.equal(present({ ...report, conversions: { total: 3, byType: [{ type: 'enquiry_submit', count }] } }).enquiries, null)
    for (const sourceReadAt of [null, 'invalid']) assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, sourceReadAt } }).stale, true)
    assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, sourceReadAt: '2026-09-30T22:10:00Z' } }).stale, false)
    assert.equal(present({ ...report, period: { ...report.period, timezone: 'invalid' } }).stale, true)
    for (const coverageFrom of [null, 'invalid', '2026-08-31', '2026-10-01']) assert.equal(present({ ...report, period: { ...report.period, coverageFrom } }).coverageFrom, null)
    assert.equal(present({ ...report, period: { ...report.period, to: '2026-02-30' } }).periodEnd, null)
    assert.equal(present({ ...report, dataQuality: { ...report.dataQuality, trafficProvider: 'unavailable' } }).sourceLabel.includes('Meta'), false)
  } finally { await server.close() }
})

test('website tab cannot inherit the Meta source footer or manufacture enquiry zero', () => {
  const source = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')
  assert.match(source, /showMetaSource \|\| showGoogleSource/)
  assert.match(source, /activeTab === 'overview' \|\| activeTab === 'google'/)
  assert.match(source, /presentation.enquiries === null \? 'Measurement unavailable'/)
  assert.doesNotMatch(source, /conversions.total === null \? null : 0/)
  assert.match(source, /Report window:/)
  assert.match(source, /Measurement details and limitations/)
  assert.match(source, /report.website_report \|\| managedWebsite\s*\?/)
  assert.match(source, /PerformanceServiceStory service="web"/)
  assert.doesNotMatch(source, /report.website_report \|\| managedWebsite \|\| showAdminDiagnostics/)
})
