import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('published report attribution includes only evidenced sources for the active tab', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { reportSourceAttribution } = await server.ssrLoadModule('/src/lib/reportSourceAttribution.ts')
    const sources = { meta: true, tiktok: true, googleAds: false }
    assert.equal(reportSourceAttribution('overview', sources), 'Sources: Meta Business Sync and TikTok reporting.')
    assert.equal(reportSourceAttribution('tiktok', sources), 'Source: TikTok reporting.')
    assert.equal(reportSourceAttribution('facebook', sources), 'Source: Meta Business Sync.')
    assert.equal(reportSourceAttribution('google', sources), null)
    assert.equal(reportSourceAttribution('web', sources), null)
    assert.equal(reportSourceAttribution('overview', { meta: false, tiktok: false, googleAds: false }), null)
    assert.equal(reportSourceAttribution('overview', { meta: true, tiktok: true, googleAds: true }), 'Sources: Meta Business Sync, TikTok reporting and Google Ads Sync.')
    assert.equal(reportSourceAttribution('google', { meta: true, tiktok: true, googleAds: true }), 'Source: Google Ads Sync.')
  } finally { await server.close() }
})
