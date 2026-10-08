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
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{role:'admin',client_id:null}}}`
  },
  load(id) {
    if (id !== '\0virtual:overview-schedule') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import ClientPortalHome from '/src/pages/client/ClientPortalHome.tsx';
      import {ClientPortalContext} from '/src/components/client/ClientPortalContext.ts';import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,
        React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}',name:'Synthetic A'},previewClientId:'${clientId}'}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(ClientPortalHome)))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__overview-schedule') return next()
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
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let state = 'unavailable'
    await page.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53991') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external/provider request')
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
      assert.ok(['client_portal_visibility_contract_version', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events'].includes(rpc), `No write-capable RPC: ${rpc}`)
      if (rpc === 'client_portal_visibility_contract_version') return route.fulfill({ json: 1 })
      assert.equal(request.postDataJSON().p_client_id, clientId)
      if (state === 'unavailable' && rpc === 'client_portal_month_ahead_posts_v2') return route.fulfill({ status: 503, json: { message: 'Synthetic calendar read failure' } })
      if (rpc === 'client_portal_month_ahead_events') return route.fulfill({ json: [] })
      const posts = state === 'empty' ? [] : [{ row_key: 'post-a', schedule_date: state === 'scheduled' ? '2026-10-09' : null, title: 'Exact client post', post_type: 'photo', client_safe_status: 'scheduled' }]
      return route.fulfill({ json: posts })
    })
    for (const [nextState, expected] of [
      ['unavailable', 'Schedule temporarily unavailable'],
      ['planning', 'Plan in progress'],
      ['scheduled', /scheduled item for the planning month/],
      ['empty', 'A clear canvas'],
    ]) {
      state = nextState
      await page.goto('http://127.0.0.1:53991/__overview-schedule')
      await page.getByText(expected, { exact: typeof expected === 'string' }).waitFor({ timeout: 5000 })
      if (nextState === 'scheduled') assert.equal(await page.getByText('1', { exact: true }).count(), 1)
      assert.equal(await page.getByText('Schedule pending', { exact: true }).count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
      assert.deepEqual(errors, [])
    }
    console.log(`PASS ${width}px: failed, undated, scheduled and empty states render truthfully; no body overflow or runtime errors`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
