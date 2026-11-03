import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, stats, ClientReportView
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, esbuild: { jsx: 'automatic' }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  stats = await server.ssrLoadModule('/src/lib/reportStats.ts')
  ;({ ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx'))
})
after(async () => { await server?.close() })

const post = (id, value) => ({ id, platform: 'facebook', caption: `${id} private creative caption`, permalink: null,
  publish_time: '2026-10-10T12:00:00Z', reach: value, impressions: value, engagements: null,
  engagementKnownSubtotal: null, engagementDefinitionId: null, engagementDefinitionLabel: null,
  engagementSource: null, engagementObservedAt: null, engagementCoverage: null, engagementCompleteness: 'unavailable',
  post_type: 'Photo', imageUrl: null, metaObjectId: id })

test('strict creative evidence fails closed without changing page totals or mutating posts', () => {
  const posts = [post('unknown', 900), post('client-created', 800), post('third-party', 700)]
  const before = structuredClone(posts)
  const page = stats.buildMasterReport(posts, [])
  const strict = stats.buildMasterReport(posts, [], new Set(), { requireVerifiedCg: true })
  assert.equal(strict.bestPostOverall, null)
  assert.deepEqual(strict.platforms[0].topPosts, [])
  assert.equal(strict.platforms[0].bestPost, null)
  for (const key of ['reach', 'views', 'engagements', 'postCount']) assert.equal(strict.platforms[0][key], page.platforms[0][key])
  assert.deepEqual(posts, before)
})

test('only an independent exact-post allowlist admits CG work; exclusions win and top two stay bounded', () => {
  const posts = [post('unknown', 9999), ...[1, 2, 3].map(n => post(`verified-${n}`, n * 10))]
  const verifiedCgPostIds = new Set(['verified-1', 'verified-2', 'verified-3', 'not-in-this-report'])
  const strict = stats.buildMasterReport(posts, [], new Set(['facebook:verified-3']), { requireVerifiedCg: true, verifiedCgPostIds })
  assert.deepEqual(strict.platforms[0].topPosts.map(p => p.id), ['verified-2', 'verified-1'])
  assert.equal(strict.bestPostOverall.id, 'verified-2')
  assert.equal(strict.platforms[0].postCount, 4)
  assert.equal(strict.platforms[0].views, 10059)
  const two = stats.buildMasterReport(posts, [], new Set(), { requireVerifiedCg: true, verifiedCgPostIds })
  assert.deepEqual(two.platforms[0].topPosts.map(p => p.id), ['verified-3', 'verified-2'])
})

test('provider/raw origin claims and captions do not establish CG creation', () => {
  const forged = { ...post('forged', 99999), cg_created: true, creative_origin: 'cg_created', raw: { cg_created: true, creative_origin: 'cg_created' } }
  assert.equal(stats.buildMasterReport([forged], [], new Set(), { requireVerifiedCg: true }).bestPostOverall, null)
})

test('actual client Overview and platform readers omit unverified highlights, including stored auto-cover fallback', () => {
  const report = { id: 'report-a', platform: null, status: 'published', period_start: '2026-10-01', period_end: '2026-10-31',
    report_title: 'Exact report', posts: [{ ...post('unknown', 999), post_type: 'Photo', excluded: false,
      image_url: 'https://scontent.example.fbcdn.net/a.jpg', engagement_known_subtotal: null,
      strategy_data: { topContent: { autoCaption: 'unknown private creative caption' } } }],
    strategy_data: { topContent: { autoCaption: 'unknown private creative caption', autoImageUrl: 'https://scontent.example.fbcdn.net/a.jpg', whyItWorked: ['Unverified CG credit'], whatThisTellsUs: 'Unverified CG credit' } } }
  for (const initialTab of ['overview', 'facebook']) {
    const html = renderToStaticMarkup(React.createElement(ClientReportView, { report, client: null, googleAds: null,
      googleAdsState: 'unmapped', initialTab, onTabChange: () => {} }))
    assert.doesNotMatch(html, /Top performing content|unknown private creative caption|Unverified CG credit|data-post-media/)
    assert.match(html, /Facebook/)
  }
})
