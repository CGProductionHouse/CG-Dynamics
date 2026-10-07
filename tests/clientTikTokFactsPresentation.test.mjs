import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('TikTok client facts retain partial/zero/null truth and distinguish account snapshots from followers', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  try {
    const { ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')
    const { buildOverviewSections } = await server.ssrLoadModule('/src/lib/overviewModel.ts')
    const fact = (metricKey, value, aggregation = 'sum', availability = 'partial') => ({
      platform: 'tiktok', metricKey, value, aggregation, availability, comparableGroup: 'tiktok-provider-video-cohort',
      sourceMetric: metricKey, periodStart: '2026-09-01', periodEnd: '2026-09-30',
    })
    const report = { id: 'synthetic-report', client_id: 'synthetic-client', status: 'published', period_start: '2026-09-01', period_end: '2026-09-30', report_title: 'Exact TikTok fixture', posts: [] }
    const render = facts => renderToStaticMarkup(createElement(ClientReportView, {
      report, client: null, googleAds: null, googleAdsState: 'unmapped', googleAdsError: null,
      normalizedFactsAttempted: true, facts, initialTab: 'tiktok', onTabChange: () => {},
    }))
    const facts = [fact('views', 57944), fact('comments', 0), fact('shares', null, 'sum', 'unavailable'),
      fact('current_followers', 6582, 'snapshot'), fact('total_likes', 52555, 'snapshot'), fact('video_count', 174, 'snapshot')]
    const before = structuredClone(facts)
    const html = render(facts)
    assert.match(html, /TikTok performance/)
    assert.match(html, /57,944/)
    assert.match(html, /Partial platform coverage/)
    assert.doesNotMatch(html, /Coming soon|Current followers snapshot at the latest sync/)
    assert.match(html, /Account snapshot for this report/)
    assert.match(html, /TikTok comments/)
    assert.match(html, />0<\/p>/)
    assert.doesNotMatch(html, /vs last month|Unavailable from the connected Meta source/)
    const lines = buildOverviewSections(facts, facts).flatMap(section => section.lines)
    assert.equal(lines.find(line => line.metricKey === 'comments').value, 0)
    assert.equal(lines.find(line => line.metricKey === 'shares').hasValue, false)
    assert.equal(lines.find(line => line.metricKey === 'total_likes').isSnapshot, true)
    assert.ok(lines.every(line => !line.comparable))
    assert.doesNotMatch(render([fact('views', null, 'sum', 'unavailable')]), />0<\/p>/)
    assert.deepEqual(facts, before)
  } finally { await server.close() }
})
