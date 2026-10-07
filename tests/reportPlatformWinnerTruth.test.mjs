import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('platform ranking requires observed finite reach, preserving zero and stable known ranking', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  try {
    const { bestPlatform, buildMasterReport } = await server.ssrLoadModule('/src/lib/reportStats.ts')
    const { ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')
    const { buildReportPerformance } = await server.ssrLoadModule('/src/lib/reportPerformance.ts')
    const breakdown = (platform, reach, hasData = true) => ({ platform, hasData, stats: { totalReach: reach } })
    for (const reach of [null, undefined, NaN, Infinity]) {
      assert.equal(bestPlatform([breakdown('facebook', reach), breakdown('instagram', reach)]), null)
    }
    assert.equal(bestPlatform([breakdown('facebook', null), breakdown('instagram', 0)]).platform, 'instagram')
    assert.equal(bestPlatform([breakdown('facebook', 10), breakdown('instagram', 20)]).platform, 'instagram')
    assert.equal(bestPlatform([breakdown('instagram', 20), breakdown('facebook', 20)]).platform, 'facebook')
    assert.equal(bestPlatform([breakdown('facebook', 10, false)]), null)
    const post = (platform, reach) => ({ id: platform, platform, reach, impressions: null, engagements: null,
      engagementKnownSubtotal: null, engagementDefinitionId: null, engagementDefinitionLabel: null,
      engagementSource: null, engagementObservedAt: null, engagementCoverage: null, engagementCompleteness: 'unavailable',
      caption: 'Exact fixture content', permalink: null, publish_time: '2026-09-15T12:00:00Z', post_type: 'Photo', imageUrl: null, metaObjectId: null })
    const missingPosts = [post('facebook', null), post('instagram', null)]
    const before = structuredClone(missingPosts)
    const missing = buildMasterReport(missingPosts, [])
    assert.equal(missing.bestPlatform, null)
    const performance = buildReportPerformance({ master: missing, previousMaster: null, currentManual: [], previousManual: [], monthLabel: 'September 2026', previousMonthLabel: null })
    assert.doesNotMatch(JSON.stringify(performance.nextSteps), /Use Instagram as the visibility driver|Extend Facebook reach to Instagram/)
    assert.equal(buildMasterReport([], []).bestPlatform, null)
    assert.equal(buildMasterReport([post('facebook', null), post('instagram', 0)], []).bestPlatform.platform, 'instagram')
    assert.equal(buildMasterReport([post('facebook', 10), post('instagram', 20)], []).bestPlatform.platform, 'instagram')
    assert.deepEqual(missingPosts, before)
    const report = { id: 'fixture-report', client_id: 'fixture-client', status: 'published', period_start: '2026-09-01', period_end: '2026-09-30', report_title: 'Local report', posts: [] }
    const render = (posts, props = {}) => renderToStaticMarkup(createElement(ClientReportView, { report: { ...report, posts }, client: null,
      googleAds: null, googleAdsState: 'unmapped', googleAdsError: null, ...props }))
    assert.doesNotMatch(render([]), /Best platform/)
    assert.doesNotMatch(render(missingPosts), /Best platform/)
    assert.match(render([post('instagram', 0)]), /Best platform/)
    assert.match(render([post('facebook', 10)]), /Best platform/)
    assert.match(render([], { normalizedFactsAttempted: true }), /No verified performance figures for this period/)
    const fact = { platform: 'facebook', metricKey: 'brand_views', value: null, availability: 'unavailable', comparableGroup: null, aggregation: 'sum' }
    assert.match(render([], { facts: [fact], normalizedFactsAttempted: true }), /No verified performance figures for this period/)
    const observedZero = render([], { facts: [{ ...fact, value: 0, availability: 'valid_zero' }], normalizedFactsAttempted: true })
    assert.doesNotMatch(observedZero, /No verified performance figures for this period/)
    assert.match(observedZero, /Facebook views/)
    assert.match(observedZero, />0<\/p>/)
    assert.match(render([], { normalizedFactsAttempted: true, showAdminDiagnostics: true }), /Verified platform figures are unavailable for this month/)
    const lowSignal = render([post('facebook', 0)])
    assert.match(lowSignal, /Content learning/)
    assert.doesNotMatch(lowSignal, /Top overall performer/)
    assert.match(render([post('facebook', 100)]), /Top overall performer/)
  } finally { await server.close() }
})
