import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real Overview component, synthetic exact-client reads only; no production connection.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const reportId = '22222222-2222-4222-8222-222222222222'
const fixture = {
  name: 'client-overview-fact-error-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:overview-fact-error') return '\0virtual:overview-fact-error' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{role:'admin',client_id:null}}}`
  },
  load(id) {
    if (id !== '\0virtual:overview-fact-error') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import ClientPortalHome from '/src/pages/client/ClientPortalHome.tsx';
      import {ClientPortalContext} from '/src/components/client/ClientPortalContext.ts';import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,
        React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}',name:'Synthetic A'},previewClientId:'${clientId}'}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(ClientPortalHome)))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__overview-fact-error') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:overview-fact-error"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-overview-fact-error-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53990, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; const reads = []; let factMode = 'failure'
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53990') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external/provider request')
      reads.push(url.pathname)
      if (url.pathname === '/rest/v1/reports') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: [{ id: reportId, client_id: clientId, platform: null, status: 'published', period_start: '2026-09-01', period_end: '2026-09-23', published_at: '2026-09-24T10:00:00Z', report_title: 'September review', website_report: null }] })
      }
      if (url.pathname === '/rest/v1/monthly_client_strategies') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: null })
      }
      assert.ok(url.pathname.startsWith('/rest/v1/rpc/'), `Only expected read RPCs: ${url.pathname}`)
      const rpc = url.pathname.split('/').at(-1)
      assert.ok(['get_report_metric_facts', 'get_report_metric_fact_status', 'get_google_ads_dashboard_campaign_metrics_v2', 'get_google_ads_dashboard_status_v2', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events', 'client_portal_visibility_contract_version'].includes(rpc), `No write-capable RPC: ${rpc}`)
      const body = request.postDataJSON()
      if (rpc === 'get_report_metric_facts') {
        assert.equal(body.p_report_id, reportId)
        if (factMode === 'failure') return route.fulfill({ status: 503, json: { message: 'Synthetic channel read failure' } })
        if (factMode === 'verified') return route.fulfill({ json: [
          ['facebook', 'brand_views', 100], ['instagram', 'brand_views', 200], ['tiktok', 'views', 300],
        ].map(([platform, metric_key, value]) => ({ platform, metric_key, value, period_month: '2026-09',
          period_start: '2026-09-01', period_end: '2026-09-23', availability: 'complete',
          aggregation: 'sum', comparable_group: `${platform}_views`, source_metric: 'synthetic_views', includes_paid: 'both' })) })
      }
      if (rpc === 'get_report_metric_fact_status') assert.equal(body.p_report_id, reportId)
      if (rpc === 'client_portal_month_ahead_posts_v2' || rpc === 'client_portal_month_ahead_events') assert.equal(body.p_client_id, clientId)
      return route.fulfill({ json: rpc === 'client_portal_visibility_contract_version' ? 1 : [] })
    })
    await page.goto('http://127.0.0.1:53990/__overview-fact-error')
    await page.getByRole('heading', { name: 'Synthetic A', exact: true }).waitFor()
    await page.getByText('Unavailable', { exact: true }).waitFor({ timeout: 1500 })
    assert.equal(await page.getByText('0 verified channels', { exact: true }).count(), 0)
    await page.getByText('Verified channel facts could not be loaded right now', { exact: true }).waitFor()
    assert.ok(reads.includes('/rest/v1/rpc/get_report_metric_facts'))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-overview-fact-error-${width}.png`), fullPage: true })
    factMode = 'empty'
    await page.reload()
    await page.getByText('Published review', { exact: true }).waitFor()
    assert.equal(await page.getByText('Unavailable', { exact: true }).count(), 0, 'Successful empty facts read is not a failure')
    assert.equal(await page.getByText('0 verified channels', { exact: true }).count(), 0, 'Missing facts do not become zero')
    factMode = 'verified'
    await page.reload()
    await page.getByText('600', { exact: true }).waitFor()
    await page.getByText(/Facebook \+ Instagram \+ TikTok · 2026-09-01 to 2026-09-23\. Views, not unique people/).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px verified views overflow`)
    await page.screenshot({ path: join(tmpdir(), `cg-overview-recorded-views-${width}.png`), fullPage: true })
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: failed facts unavailable, successful empty distinct, same-window verified views, published report remains, no body overflow`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
