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
const report = { id: reportId, client_id: clientId, platform: null, status: 'published', period_start: '2026-09-01', period_end: '2026-09-23', published_at: '2026-09-24T10:00:00Z', report_title: 'September review', website_report: null }
const fixture = {
  name: 'client-overview-fact-error-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:overview-fact-error') return '\0virtual:overview-fact-error' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{id:'local-profile',role:location.pathname.includes('performance')&&!location.pathname.includes('preview')?'client':'admin',client_id:'${clientId}'}}}`
  },
  load(id) {
    if (id !== '\0virtual:overview-fact-error') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import ClientPortalHome from '/src/pages/client/ClientPortalHome.tsx';
      import Dashboard from '/src/pages/client/Dashboard.tsx';
      import {ClientPortalContext} from '/src/components/client/ClientPortalContext.ts';import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,
        React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}',name:'Synthetic A'},previewClientId:location.pathname.includes('performance')&&!location.pathname.includes('preview')?undefined:'${clientId}'}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(location.pathname.includes('performance')?Dashboard:ClientPortalHome)))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!['/__overview-fact-error', '/__performance-fact-error', '/__preview-performance-exclusion'].includes(req.url?.split('?')[0])) return next()
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
  for (const width of [375, 390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; const reads = []; let factMode = 'missing', exclusionMode = 'missing', ownershipProved = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53990') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external/provider request')
      reads.push(url.pathname)
      if (url.pathname === '/rest/v1/reports') {
        assert.equal(request.method(), 'GET')
        if (url.searchParams.has('id')) {
          assert.equal(url.searchParams.get('id'),`eq.${reportId}`)
          if (url.searchParams.get('select')==='id') {
            assert.equal(url.searchParams.get('client_id'),`eq.${clientId}`)
            assert.equal(url.searchParams.get('status'),'eq.published')
            ownershipProved=true
            return route.fulfill({json:{id:reportId}})
          }
          assert.ok(ownershipProved,'Child report read follows exact published ownership proof')
          return route.fulfill({json:report})
        }
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: [report] })
      }
      if (url.pathname==='/rest/v1/posts' || url.pathname==='/rest/v1/report_content_exclusions') {
        assert.equal(request.method(),'GET');assert.ok(ownershipProved)
        assert.equal(url.searchParams.get('report_id'),`eq.${reportId}`)
        if (url.pathname.endsWith('/posts')) return route.fulfill({json:[
          {id:'33333333-3333-4333-8333-333333333333',report_id:reportId,platform:'facebook',caption:'Reviewed public post',publish_time:'2026-09-12T12:00:00Z',views:10,reach:5,raw:{},created_at:'2026-10-01T12:00:00Z'},
          {id:'44444444-4444-4444-8444-444444444444',report_id:reportId,platform:'facebook',caption:'Hidden report post',publish_time:'2026-09-15T12:00:00Z',views:999,reach:999,raw:{},created_at:'2026-10-01T12:00:00Z'},
        ]})
        assert.equal(url.searchParams.get('client_id'),`eq.${clientId}`)
        assert.match(request.headers().prefer,/count=exact/,'Visibility count is requested, not guessed from a capped result')
        if (exclusionMode==='failure') return route.fulfill({status:503,json:{message:'PRIVATE backend'}})
        return route.fulfill({headers:exclusionMode==='missing-count'?{}:{'content-range':exclusionMode==='truncated'?'0-0/2':'0-0/1','access-control-expose-headers':'Content-Range'},json:exclusionMode==='missing'?null:exclusionMode==='malformed'?[{post_id:'44444444-4444-4444-8444-444444444444',excluded:'false'}]:[{post_id:'44444444-4444-4444-8444-444444444444',excluded:true}]})
      }
      if (url.pathname==='/rest/v1/manual_platform_metrics') {
        assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('client_id'),`eq.${clientId}`)
        return route.fulfill({json:[]})
      }
      if (url.pathname === '/rest/v1/monthly_client_strategies') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: null })
      }
      assert.ok(url.pathname.startsWith('/rest/v1/rpc/'), `Only expected read RPCs: ${url.pathname}`)
      const rpc = url.pathname.split('/').at(-1)
      assert.ok(['get_report_metric_facts', 'get_report_metric_fact_status', 'get_google_ads_dashboard_campaign_metrics_v2', 'get_google_ads_dashboard_status_v2', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events', 'client_portal_visibility_contract_version', 'client_published_reports', 'client_published_report_posts', 'client_published_report_manual_metrics', 'client_monthly_strategy', 'get_my_client_service_entitlements'].includes(rpc), `No write-capable RPC: ${rpc}`)
      const body = request.postDataJSON()
      if (rpc === 'client_published_reports') return route.fulfill({ json:[report] })
      if (rpc === 'client_published_report_posts' || rpc === 'client_published_report_manual_metrics') {
        assert.equal(body.p_report_id,reportId)
        return route.fulfill({json:[]})
      }
      if (rpc === 'get_report_metric_facts') {
        assert.equal(body.p_report_id, reportId)
        if (factMode === 'failure') return route.fulfill({ status: 503, json: { message: 'Synthetic channel read failure' } })
        if (factMode === 'missing') return route.fulfill({ json: null })
        if (factMode === 'verified') return route.fulfill({ json: [
          ['facebook', 'brand_views', 100], ['instagram', 'brand_views', 200], ['tiktok', 'views', 300],
        ].map(([platform, metric_key, value]) => ({ platform, metric_key, value, period_month: '2026-09',
          period_start: '2026-09-01', period_end: '2026-09-23', availability: 'complete',
          aggregation: 'sum', comparable_group: `${platform}_views`, source_metric: 'synthetic_views', includes_paid: 'both' })) })
      }
      if (rpc === 'get_report_metric_fact_status') {
        assert.equal(body.p_report_id, reportId)
        if (factMode === 'missing-status') return route.fulfill({ json: null })
        return route.fulfill({ json: [{ normalized_attempted: factMode !== 'empty', current_fact_count: factMode === 'verified' ? 3 : 0, ready_fact_count: factMode === 'verified' ? 3 : 0 }] })
      }
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
    for (const mode of ['failure', 'missing-status']) {
      factMode = mode
      await page.reload()
      await page.getByText('Verified channel facts could not be loaded right now', { exact: true }).waitFor()
      assert.equal(await page.getByText('0 verified channels', { exact: true }).count(), 0)
      assert.deepEqual(errors, [])
    }
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
    for (const mode of ['missing','missing-status','failure']) {
      factMode=mode
      await page.goto('http://127.0.0.1:53990/__performance-fact-error')
      await page.getByRole('heading',{name:'Performance is temporarily unavailable',exact:true}).waitFor()
      assert.equal(await page.getByRole('heading',{name:'No published report yet',exact:true}).count(),0)
      assert.equal(await page.getByRole('tab',{name:'Facebook',exact:true}).count(),0,'Unavailable facts do not fall back to a legacy report')
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      assert.deepEqual(errors,[])
    }
    factMode='empty'
    for (const mode of ['missing','malformed','missing-count','truncated','failure']) {
      exclusionMode=mode;ownershipProved=false
      await page.goto('http://127.0.0.1:53990/__preview-performance-exclusion')
      try {
        await page.getByRole('heading',{name:'Performance is temporarily unavailable',exact:true}).waitFor({timeout:mode==='failure'?15000:1500})
      } catch(error) {
        console.log(JSON.stringify({exclusionMode:mode,text:await page.locator('main').innerText(),reads:reads.slice(-12)}))
        throw error
      }
      assert.equal(await page.getByText('Hidden report post',{exact:true}).count(),0)
      assert.equal(await page.getByRole('tab',{name:'Facebook',exact:true}).count(),0,'Missing display permission is not unrestricted highlights')
      assert.doesNotMatch(await page.locator('main').innerText(),/PRIVATE/)
      assert.deepEqual(errors,[])
    }
    exclusionMode='valid';ownershipProved=false
    await page.reload()
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    await page.getByText('Reviewed public post',{exact:true}).first().waitFor()
    assert.equal(await page.getByText('Hidden report post',{exact:true}).count(),0,'Explicitly hidden post never enters client highlights')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    assert.deepEqual(errors,[])
    await page.screenshot({path:join(tmpdir(),`cg-preview-post-visibility-${width}.png`),fullPage:true})
    console.log(`PASS ${width}px: failed facts unavailable, successful empty distinct, same-window verified views, published report remains, no body overflow`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
