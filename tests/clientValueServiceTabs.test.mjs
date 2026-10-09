import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

test('Performance keeps all service choices without inferring package or connection truth', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-anon-key'),
  } })
  try {
    const { ClientReportView } = await server.ssrLoadModule('/src/pages/client/ClientReportView.tsx')
    const { PERFORMANCE_SERVICE_TABS, serviceConversationUrl } = await server.ssrLoadModule('/src/lib/performanceServiceCatalog.ts')
    const report = { id: 'report-a', client_id: 'client-a', status: 'published', period_start: '2026-09-01', period_end: '2026-09-23', posts: [], report_title: 'Exact client A', summary: null }
    const client = { id: 'client-a', name: 'Exact client A' }
    const before = JSON.stringify({ client, report })
    const render = (tab, state = 'unmapped') => renderToStaticMarkup(createElement(ClientReportView, { report, client, googleAds: null, googleAdsState: state, googleAdsError: null, initialTab: tab, onTabChange: () => {} }))
    for (const tab of PERFORMANCE_SERVICE_TABS) {
      const html = render(tab.key)
      for (const choice of PERFORMANCE_SERVICE_TABS) assert.ok(html.includes(`aria-label="${choice.label}"`), choice.label)
      assert.match(html, /sm:hidden">TikTok<\/span>/, 'mobile report tabs show provider names without hover')
      assert.match(html, /sm:hidden">Website<\/span>/, 'long mobile labels remain readable')
      assert.doesNotMatch(html, /No paid campaigns are linked|border-amber-300\/20|This is not a completed monthly report/)
      assert.match(html, /Partial content reporting period/)
      assert.match(html, /Report content coverage:/)
      assert.doesNotMatch(html, /latest verified evidence|latest sync/)
    }
    for (const social of ['facebook', 'instagram']) {
      const html = render(social)
      assert.match(html, /standard in CG social packages/)
      assert.doesNotMatch(html, /Discuss my package on WhatsApp|Beyond your current package/)
    }
    for (const service of ['tiktok', 'linkedin', 'google', 'web', 'email']) {
      const html = render(service)
      assert.match(html, /wa.me\/27791152339/)
      assert.match(html, /check your existing scope/)
      assert.doesNotMatch(html, /Beyond your current package|Included · connected|No tracked data/)
    }
    assert.match(render('google'), /Google Business Profile/)
    assert.match(render('web'), /premium CG-built website/)
    assert.match(render('linkedin'), /professional decision-makers/)
    for (const state of ['disconnected', 'unmapped', 'not-synced', 'error', 'no-activity']) {
      assert.doesNotMatch(render('overview', state), /Google Ads|WhatsApp|connection before using|No paid campaigns/)
    }
    assert.match(render('google', 'error'), /Google Ads performance is unavailable/)
    // A Facebook source elsewhere in the report must not label an unrelated
    // service offer as Meta-synced evidence.
    for (const tab of ['google', 'web', 'linkedin', 'tiktok', 'email', 'instagram']) {
      const html = renderToStaticMarkup(createElement(ClientReportView, {
        report, client, facts: [{ platform: 'facebook' }], googleAds: null,
        googleAdsState: 'unmapped', initialTab: tab, onTabChange: () => {},
      }))
      assert.doesNotMatch(html, /Source: Meta Business Sync|Source: Google Ads Sync|Sources: Meta/)
    }
    const url = new URL(serviceConversationUrl('Google Business Profile', 'A & B'))
    assert.equal(url.hostname, 'wa.me')
    assert.equal(url.pathname, '/27791152339')
    assert.match(url.searchParams.get('text'), /A & B/)
    assert.equal(JSON.stringify({ client, report }), before)
  } finally { await server.close() }
})

test('Overview does not mount service upsells or empty paid-media setup cards', () => {
  const source = readFileSync(new URL('../src/pages/client/ClientPortalHome.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /ClientServiceExpansion/)
  assert.match(source, /data\.googleAdsState === 'data' && <MetricCard/)
})

test('client-mode admin preview separates drafts, diagnostics and curation from actual client presentation', () => {
  const source = readFileSync(new URL('../src/pages/admin/PublishedPreview.tsx', import.meta.url), 'utf8')
  assert.match(source, /mode === 'staff' \|\| report.status === 'published'/)
  assert.match(source, /monthlyStrategy=\{mode === 'staff' \|\| monthlyStrategy\?\.status === 'published' \? monthlyStrategy : null\}/)
  assert.match(source, /showAdminDiagnostics=\{mode === 'staff' && isStaff\}/)
  assert.match(source, /onSetContentExcluded=\{mode === 'staff' && isAdmin \? handleContentExcluded : undefined\}/)
  assert.match(source, /Staff review · may include drafts/)
})
