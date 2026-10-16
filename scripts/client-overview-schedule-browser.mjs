import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real client Overview, synthetic exact-client reads only. No production connection.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = {
  name: 'client-overview-schedule-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:overview-schedule') return '\0virtual:overview-schedule' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `const clientScope=new URLSearchParams(location.search).get('scope')==='client';export function useAuth(){return {profile:{role:clientScope?'client':'admin',client_id:clientScope?'${clientId}':null}}}`
  },
  load(id) {
    if (id !== '\0virtual:overview-schedule') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,useLocation} from 'react-router-dom';
      import ClientPortalHome from '/src/pages/client/ClientPortalHome.tsx';
      import ClientPlanPage from '/src/pages/client/ClientPlanPage.tsx';
      import {ClientPortalContext} from '/src/components/client/ClientPortalContext.ts';import '/src/index.css';
      function Journey(){const location=useLocation();const inPlan=location.pathname==='/client/plan'||new URLSearchParams(location.search).get('area')==='plan';return React.createElement(inPlan?ClientPlanPage:ClientPortalHome)}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,
        React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}',name:'Synthetic A'},previewClientId:new URLSearchParams(location.search).get('scope')==='client'?undefined:'${clientId}'}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(Journey)))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/__overview-schedule') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:overview-schedule"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-overview-schedule-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53991, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const [scope, width] of ['client', 'preview'].flatMap(scope => [1440, 375, 390, 430].map(width => [scope, width]))) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.clock.install({ time: new Date('2026-10-08T10:00:00+02:00') })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let state = 'unavailable'
    await page.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53991') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external/provider request')
      if (url.pathname === '/rest/v1/clients') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('id'), `eq.${clientId}`)
        return route.fulfill({ json: { id: clientId, name: 'Synthetic A' } })
      }
      if (url.pathname === '/rest/v1/reports') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: [] })
      }
      if (url.pathname === '/rest/v1/monthly_client_strategies') {
        assert.equal(request.method(), 'GET')
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`)
        return route.fulfill({ json: null })
      }
      assert.ok(url.pathname.startsWith('/rest/v1/rpc/'), `Only expected read RPCs: ${url.pathname}`)
      const rpc = url.pathname.split('/').at(-1)
      assert.ok(['client_published_reports', 'client_monthly_strategy', 'client_portal_visibility_contract_version', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events'].includes(rpc), `No write-capable RPC: ${rpc}`)
      if (rpc === 'client_published_reports') return route.fulfill({ json: [] })
      if (rpc === 'client_monthly_strategy') return route.fulfill({ json: [] })
      if (rpc === 'client_portal_visibility_contract_version') return route.fulfill({ json: 1 })
      assert.equal(request.postDataJSON().p_client_id, clientId)
      if (state === 'unavailable' && rpc === 'client_portal_month_ahead_posts_v2') return route.fulfill({ status: 503, json: { message: 'Synthetic calendar read failure' } })
      if (rpc === 'client_portal_month_ahead_events') return route.fulfill({ json: [] })
      const posts = state === 'empty' ? [] : [{ row_key: 'post-a', schedule_date: state === 'scheduled' ? '2026-10-09' : state === 'past' ? '2026-10-07' : null, title: 'Exact client post', post_type: 'photo', client_safe_status: 'scheduled' }]
      return route.fulfill({ json: posts })
    })
    for (const [nextState, expected] of [
      ['unavailable', null],
      ['planning', 'Plan in progress'],
      ['scheduled', /upcoming item this month/],
      ['past', null],
      ['empty', null],
    ]) {
      state = nextState
      await page.goto(`http://127.0.0.1:53991/__overview-schedule?scope=${scope}`)
      if (expected) await page.getByText(expected, { exact: typeof expected === 'string' }).waitFor({ timeout: 5000 })
      else {
        await page.getByRole('link', { name: 'View the plan' }).waitFor({ timeout: 5000 })
        assert.equal(await page.getByText('Coming up', { exact: true }).count(), 0)
      }
      if (nextState === 'scheduled') assert.equal(await page.getByText('1', { exact: true }).count(), 1)
      assert.equal(await page.getByText('Schedule pending', { exact: true }).count(), 0)
      assert.equal(await page.getByText('A clear canvas', { exact: true }).count(), 0)
      assert.equal(await page.getByText('Schedule temporarily unavailable', { exact: true }).count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
      assert.deepEqual(errors, [])
      if (nextState === 'scheduled' || nextState === 'planning') {
        // Inspect both rendered anchors, even when responsive CSS hides one.
        const calendarName = /^(Calendar|Open calendar)(?:\s*↗)?$/
        const links = page.getByRole('link', { name: calendarName, includeHidden: true })
        assert.equal(await links.count(), 2)
        for (const href of await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')))) {
          const target = new URL(href, 'http://127.0.0.1:53991')
          assert.equal(target.searchParams.get('tab'), 'calendar', `${scope}/${width}: calendar must not open Strategy`)
          assert.equal(target.searchParams.get('month'), '2026-10', 'Use the displayed working month')
          if (scope === 'preview') {
            assert.equal(target.pathname, '/admin/client-portal-preview')
            assert.equal(target.searchParams.get('area'), 'plan')
            assert.equal(target.searchParams.get('client'), clientId)
          } else {
            assert.equal(target.pathname, '/client/plan')
            assert.equal(target.searchParams.get('client'), null, 'Client navigation never supplies an identity override')
          }
        }
        await page.getByRole('link', { name: calendarName }).click()
        assert.equal(new URL(page.url()).searchParams.get('tab'), 'calendar')
        assert.equal(await page.getByRole('tab', { name: 'Calendar', exact: true }).getAttribute('aria-selected'), 'true')
        await page.getByRole('heading', { name: 'Content calendar', exact: true }).waitFor()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px destination overflow`)
        assert.deepEqual(errors, [])
      }
    }
    console.log(`PASS ${scope} ${width}px: real planned work, exact calendar navigation, no overflow/runtime errors`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
