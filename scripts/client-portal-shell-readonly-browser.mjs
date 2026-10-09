import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real portal shell and lazy page routes; synthetic local read responses only.
// No production auth/cookies, service credentials, cloud build or provider call.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to approved local Playwright')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientA = '11111111-1111-4111-8111-111111111111'
const clientB = '22222222-2222-4222-8222-222222222222'
const fixture = {
  name: 'portal-shell-readonly-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:portal-shell') return '\0virtual:portal-shell' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{id:'local-staff',role:window.fixtureRole??'admin'},signOut:()=>{throw new Error('Auth writes forbidden')}}}`
  },
  load(id) {
    if (id !== '\0virtual:portal-shell') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Preview from'/src/pages/admin/ClientPortalPreview.tsx';import'/src/index.css';
      function App(){const[tick,setTick]=useState(0);window.setRole=role=>{window.fixtureRole=role;setTick(tick+1)};return React.createElement(Preview)}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/admin/client-portal-preview')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:portal-shell"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-portal-shell-browser-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53987, strictPort: true, hmr: false },
})
const areas = ['overview', 'plan', 'performance', 'approvals', 'brand-hub', 'leads']
const labels = ['Overview', 'Plan', 'Performance', 'Approvals', 'Brand Hub', 'Leads']
const readRpcs = new Set(['client_portal_visibility_contract_version', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events', 'get_my_client_service_entitlements', 'website_lead_inbox'])
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []; const reads = []; let failing = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53987') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external network')
      reads.push({ path: url.pathname, search: url.search, method: request.method() })
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        assert.ok(readRpcs.has(url.pathname.split('/').at(-1)), 'Only allowlisted read RPCs')
        if (url.pathname.endsWith('client_portal_visibility_contract_version')) return route.fulfill({ json: 1 })
        if (url.pathname.endsWith('website_lead_inbox')) return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Local unavailable fixture' } })
        if (url.pathname.endsWith('get_my_client_service_entitlements')) return route.fulfill({ status: 503, json: { message: 'Local unavailable fixture' } })
        const payload = request.postDataJSON()
        assert.ok([clientA, clientB].includes(payload.p_client_id), 'Exact named preview scope')
        return route.fulfill({ json: [] })
      }
      if (url.pathname === '/functions/v1/client-onboarding') {
        const payload = request.postDataJSON()
        assert.ok(['staff_preview_portal_library_load', 'staff_preview_portal_load'].includes(payload.action), 'Read action only')
        assert.ok([clientA, clientB].includes(payload.clientId))
        return route.fulfill({ status: 503, json: { ok: false, error: 'Local library unavailable' } })
      }
      assert.equal(request.method(), 'GET', 'No table writes')
      assert.ok(['clients', 'reports', 'monthly_client_strategies', 'content_review_versions'].includes(url.pathname.split('/').at(-1)), `Only expected table reads: ${url.pathname}`)
      if (url.pathname.endsWith('/clients')) return route.fulfill({ json: [{ id: clientA, name: 'Synthetic client A', active: true, logo_url: null }, { id: clientB, name: 'Synthetic client B', active: true, logo_url: null }] })
      assert.ok([`eq.${clientA}`, `eq.${clientB}`].includes(url.searchParams.get('client_id')), 'Table read must name exact client')
      if (failing && url.pathname.endsWith('/reports')) return route.fulfill({ status: 503, json: { message: 'Local unavailable report fixture' } })
      return route.fulfill({ json: url.pathname.endsWith('/monthly_client_strategies') ? null : [] })
    })
    const base = 'http://127.0.0.1:53987/admin/client-portal-preview'
    await page.goto(`${base}?client=${clientA}&area=overview`)
    await page.getByLabel('Selected client').selectOption(clientA)
    await page.getByRole('heading', { name: 'Synthetic client A', exact: true }).waitFor()
    for (let i = 0; i < areas.length; i++) {
      if (width < 640 && ['Brand Hub', 'Leads'].includes(labels[i])) await page.getByRole('button', { name: 'More pages' }).click()
      const nav = page.getByRole('navigation', { name: width < 640 && ['Brand Hub', 'Leads'].includes(labels[i]) ? 'More client pages' : width < 640 ? 'Client portal mobile' : 'Client portal' })
      await nav.getByRole('link', { name: labels[i], exact: true }).click()
      await page.waitForURL(url => url.searchParams.get('area') === areas[i])
      const ready = ['Synthetic client A', 'Your plan', 'No published report yet', 'Approvals', 'Brand Hub is not available yet', 'Leads'][i]
      await page.getByRole('heading', { name: ready, exact: true }).waitFor()
      await page.getByLabel('Loading your workspace', { exact: true }).waitFor({ state: 'hidden' })
      assert.equal(await page.getByLabel('Selected client').inputValue(), clientA)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${areas[i]} body overflow`)
      if (width < 640) {
        const bottomNav = page.getByRole('navigation', { name: 'Client portal mobile' })
        assert.ok(await bottomNav.isVisible(), 'Primary destinations remain discoverable on mobile')
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
        assert.ok(await bottomNav.isVisible(), 'Mobile navigation remains visible after scrolling')
      }
      assert.equal(await page.getByRole('button', { name: /Approve|Request changes|Upload|Publish|Connect/i }).count(), 0, 'No write controls in preview')
      await page.screenshot({ path: join(tmpdir(), `cg-portal-${areas[i]}-${width}.png`), fullPage: true })
    }
    // Switch exact client inside the actual persistent shell; no auth exchange.
    await page.getByLabel('Selected client').selectOption(clientB)
    await page.waitForURL(url => url.searchParams.get('client') === clientB)
    await page.waitForTimeout(150)
    assert.equal(await page.locator('header').getByText('Synthetic client A', { exact: true }).count(), 0, 'Old client header absent')
    failing = true
    await page.goto(`${base}?client=${clientB}&area=overview`)
    await page.getByText('Your overview could not be loaded', { exact: true }).waitFor()
    assert.equal(await page.getByText('No items scheduled', { exact: true }).count(), 0, 'Failed read is not empty/zero')
    const before = reads.length
    for (const role of ['staff', 'client', 'anonymous']) {
      await page.evaluate(value => window.setRole(value), role)
      await page.getByText('Manager preview access required', { exact: true }).waitFor()
      await page.waitForTimeout(150)
      assert.equal(reads.length, before, 'Denied role issues no new client reads')
    }
    assert.deepEqual(errors, [])
    console.log(`PASS actual full preview ${width}px: six routes, exact scope, read-only controls, unavailable/empty and role denial; local synthetic only`)
    await page.close()
  }
} catch (error) {
  const page = browser?.contexts().at(-1)?.pages().at(-1)
  if (page) {
    await page.screenshot({ path: join(tmpdir(), 'cg-portal-shell-failure.png'), fullPage: true })
    console.log(await page.evaluate(() => ({ width: innerWidth, buttons: [...document.querySelectorAll('button')].map(button => button.textContent), area: location.search })))
  }
  throw error
} finally {
  await browser?.close()
  await server.close()
}
