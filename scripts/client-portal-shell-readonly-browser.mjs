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
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:location.pathname==='/client/performance'?{id:'local-client',role:'client',client_id:'${clientA}'}:{id:'local-staff',role:window.fixtureRole??'admin'},signOut:()=>{throw new Error('Auth writes forbidden')}}}`
  },
  load(id) {
    if (id !== '\0virtual:portal-shell') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Preview from'/src/pages/admin/ClientPortalPreview.tsx';import Dashboard from'/src/pages/client/Dashboard.tsx';import{ClientPortalShell}from'/src/components/client/ClientPortalShell.tsx';import{ClientPortalContext}from'/src/components/client/ClientPortalContext.ts';import'/src/index.css';
      function App(){const[tick,setTick]=useState(0);window.setRole=role=>{window.fixtureRole=role;setTick(tick+1)};return React.createElement(Preview)}
      const client={id:'${clientA}',name:'Synthetic client A',active:true};
      const content=location.pathname==='/client/performance'?React.createElement(ClientPortalContext.Provider,{value:{client}},React.createElement(ClientPortalShell,{client},React.createElement(Dashboard))):React.createElement(App);
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,content));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/admin/client-portal-preview') && !req.url?.startsWith('/client/performance')) return next()
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
const readRpcs = new Set(['client_published_reports', 'client_published_report_posts', 'client_portal_visibility_contract_version', 'client_portal_month_ahead_posts_v2', 'client_portal_month_ahead_events', 'get_my_client_service_entitlements', 'website_lead_inbox', 'website_lead_metrics'])
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []; const reads = []; let failing = false, missingList = null, clientReportMode = 'missing'
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53987') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external network')
      reads.push({ path: url.pathname, search: url.search, method: request.method() })
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        assert.ok(readRpcs.has(url.pathname.split('/').at(-1)), 'Only allowlisted read RPCs')
        if (url.pathname.endsWith('client_published_reports')) return route.fulfill({ json: clientReportMode === 'missing' ? null : clientReportMode === 'empty' ? [] : [{ id: 'synthetic-report', platform: null, status: 'published', period_start: '2026-10-01', period_end: '2026-10-16' }] })
        if (url.pathname.endsWith('client_published_report_posts')) {
          assert.equal(request.postDataJSON().p_report_id, 'synthetic-report')
          return route.fulfill({ json: null })
        }
        if (url.pathname.endsWith('client_portal_visibility_contract_version')) return route.fulfill({ json: 1 })
        if (url.pathname.endsWith('website_lead_inbox')) {
          const payload = request.postDataJSON()
          assert.ok([clientA, clientB, null].includes(payload.p_client_id), 'Lead inbox remains exact preview or server-pinned client scoped')
          if (payload.p_limit === 1) return route.fulfill({ json: [] })
          return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Local unavailable fixture' } })
        }
        if (url.pathname.endsWith('website_lead_metrics')) {
          const payload = request.postDataJSON()
          assert.ok([clientA, clientB, null].includes(payload.p_client_id), 'Lead metrics remain exact preview or server-pinned client scoped')
          return route.fulfill({ json: { clientId: payload.p_client_id, state: payload.p_client_id === clientA ? 'not_connected' : 'available',
            period: { from: payload.p_from, to: payload.p_to, timezone: 'Africa/Johannesburg' },
            total: 0, new: 0, contacted: 0, qualified: 0, won: 0, closedLost: 0, lost: 0, good: 0, poor: 0, unreviewed: 0, qualificationRate: null } })
        }
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
      if (url.pathname.endsWith(`/${missingList}`)) return route.fulfill({ json: null })
      if (failing && url.pathname.endsWith('/reports')) return route.fulfill({ status: 503, json: { message: 'Local unavailable report fixture' } })
      return route.fulfill({ json: url.pathname.endsWith('/monthly_client_strategies') ? null : [] })
    })
    const base = 'http://127.0.0.1:53987/admin/client-portal-preview'
    await page.goto(`${base}?client=${clientA}&area=overview`)
    await page.getByLabel('Selected client').selectOption(clientA)
    await page.getByRole('heading', { name: 'Synthetic client A', exact: true }).waitFor()
    for (let i = 0; i < areas.length; i++) {
      if (areas[i] === 'leads') {
        if (width < 640) await page.getByRole('button', { name: 'More pages' }).click()
        assert.equal(await page.getByRole('link', { name: 'Leads', exact: true }).count(), 0, 'Disconnected client has no irrelevant Leads navigation')
        await page.goto(`${base}?client=${clientA}&area=leads`)
      } else {
        if (width < 640 && labels[i] === 'Brand Hub') {
          const more = page.getByRole('button', { name: 'More pages' })
          await more.click()
          await more.press('Tab')
          assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Brand Hub', 'Forward Tab reaches the disclosed destination')
          await page.getByRole('navigation', { name: 'More client pages' }).getByRole('link', { name: 'Brand Hub', exact: true }).press('Escape')
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More pages', 'Escape returns focus to the disclosure control')
          await more.press('Enter')
        }
        const nav = page.getByRole('navigation', { name: width < 640 && labels[i] === 'Brand Hub' ? 'More client pages' : width < 640 ? 'Client portal mobile' : 'Client portal' })
        await nav.getByRole('link', { name: labels[i], exact: true }).click()
      }
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
    if (width < 640) await page.getByRole('button', { name: 'More pages' }).click()
    await page.getByRole('link', { name: 'Leads', exact: true }).first().waitFor()
    if (width < 640) {
      const more = page.getByRole('button', { name: 'More pages' })
      await more.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Leads', 'Connected client menu begins with Leads')
      const secondary = page.getByRole('navigation', { name: 'More client pages' })
      await secondary.getByRole('link', { name: 'Leads', exact: true }).press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Brand Hub', 'Forward tab order includes both destinations')
      await secondary.getByRole('link', { name: 'Brand Hub', exact: true }).press('Escape')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More pages')
    }
    await page.waitForTimeout(150)
    assert.equal(await page.locator('header').getByText('Synthetic client A', { exact: true }).count(), 0, 'Old client header absent')
    for (const [table, area, heading] of [
      ['reports', 'performance', 'Performance is temporarily unavailable'],
      ['content_review_versions', 'approvals', 'Approvals could not be loaded'],
    ]) {
      missingList = table
      await page.goto(`${base}?client=${clientB}&area=${area}`)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 8000 })
      assert.doesNotMatch(await page.locator('main').innerText(), /No published report yet|Nothing waiting|You’re up to date/, 'Missing preview evidence is not an empty result')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    missingList = null
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
    for (const mode of ['missing', 'posts-missing', 'empty']) {
      clientReportMode = mode
      await page.goto('http://127.0.0.1:53987/client/performance')
      await page.getByRole('heading', { name: mode === 'empty' ? 'No published report yet' : 'Performance is temporarily unavailable', exact: true }).waitFor()
      if (mode !== 'empty') assert.equal(await page.getByRole('heading', { name: 'No published report yet', exact: true }).count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    if (width < 640) {
      const more = page.getByRole('button', { name: 'More pages' })
      await more.click()
      const secondary = page.getByRole('navigation', { name: 'More client pages' })
      const firstDestination = (await secondary.getByRole('link').allTextContents())[0].trim()
      await more.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), firstDestination, 'Normal client can Tab into the disclosed menu too')
      await secondary.getByRole('link').first().press('Escape')
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More pages')
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
