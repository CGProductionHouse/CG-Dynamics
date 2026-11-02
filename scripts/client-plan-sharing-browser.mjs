import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const client = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const fixture = {
  name: 'plan-sharing-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:plan-sharing') return '\0virtual:plan-sharing' },
  load(id) {
    if (id !== '\0virtual:plan-sharing') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{ClientSchedulePlanSharing}from'/src/components/client/ClientSchedulePlanSharing.tsx';import'/src/index.css';
      function App(){const[scope,setScope]=useState('${client}');return React.createElement('main',{className:'mx-auto max-w-6xl p-4 sm:p-8'},
        React.createElement('h1',null,'Synthetic schedule sharing acceptance'),React.createElement('button',{onClick:()=>setScope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')},'Switch client'),
        React.createElement(ClientSchedulePlanSharing,{key:scope,clientId:scope,clientName:scope==='${client}'?'Synthetic Cape':'Synthetic B',month:'2026-11'}))};
      createRoot(document.getElementById('root')).render(React.createElement(App));`
  },
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/__sharing')) return next()
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c;color:white"><div id="root"></div><script type="module" src="/@id/virtual:plan-sharing"></script></body></html>')
  }) },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-plan-sharing-browser-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53981, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } })
    const errors = []; let writes = 0; let uncertain = false; let failRead = false
    const rows = [1, 2, 3].map(n => ({ id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`, updated_at: '2026-11-02T10:00:00Z',
      scheduled_date: n === 3 ? null : `2026-11-0${n + 1}`, client_plan_shared_date: null, deliverable_type: 'dp', instance_number: n }))
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53981') return route.continue()
      assert.equal(url.origin, 'http://127.0.0.1:1', 'No external network')
      if (url.pathname === '/rest/v1/monthly_deliverables') {
        assert.equal(request.method(), 'GET'); assert.equal(url.searchParams.get('month'), 'eq.2026-11-01')
        assert.equal(url.searchParams.get('archived_at'), 'is.null'); assert.equal(url.searchParams.get('limit'), '201')
        if (failRead) return route.fulfill({ status: 503, json: { message: 'Synthetic failed read' } })
        return route.fulfill({ json: url.searchParams.get('client_id') === `eq.${client}` ? rows : [] })
      }
      assert.equal(url.pathname, '/rest/v1/rpc/set_client_schedule_plan_visibility')
      assert.equal(request.method(), 'POST'); writes++
      const body = request.postDataJSON()
      assert.equal(body.p_client_id, client); assert.equal(body.p_month, '2026-11-01')
      assert.deepEqual(body.p_expected_rows.map(r => r.id), rows.slice(0, 2).map(r => r.id), 'Undated row never published')
      for (const row of rows.slice(0, 2)) { row.client_plan_shared_date = body.p_visible ? row.scheduled_date : null; row.updated_at = `2026-11-02T10:0${writes}:00Z` }
      if (uncertain) return route.fulfill({ status: 500, json: { message: 'Synthetic uncertain response after committed write' } })
      return route.fulfill({ json: { changed: 2, visible: body.p_visible } })
    })
    await page.goto('http://127.0.0.1:53981/__sharing')
    await page.getByText('0 dates shared · Synthetic Cape', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.getByRole('button', { name: 'Share planned dates', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    assert.match(await page.getByRole('dialog').innerText(), /2 dates.*2026-11-02, 2026-11-03/s)
    assert.match(await page.getByRole('dialog').innerText(), /Content approval and posting stay unchanged/)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(writes, 0)
    await page.getByRole('button', { name: 'Share planned dates', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Share planned dates', exact: true }).click()
    await page.getByText('2 dates shared · Synthetic Cape', { exact: true }).waitFor()
    assert.equal(writes, 1)
    assert.equal(await page.getByRole('button', { name: 'Share planned dates', exact: true }).isEnabled(), false)
    await page.screenshot({ path: join(tmpdir(), `cg-plan-sharing-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Hide shared dates', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hide planned dates', exact: true }).click()
    await page.getByText('0 dates shared · Synthetic Cape', { exact: true }).waitFor()
    assert.equal(writes, 2)
    uncertain = true
    await page.getByRole('button', { name: 'Share planned dates', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Share planned dates', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Share planned dates', exact: true }).count(), 0, 'No blind retry after uncertain write')
    assert.equal(writes, 3)
    failRead = true
    await page.getByRole('button', { name: 'Refresh sharing', exact: true }).click()
    await page.getByText('Plan sharing is unavailable. Refresh to check.', { exact: true }).waitFor()
    failRead = false
    await page.getByRole('button', { name: 'Refresh sharing', exact: true }).click()
    await page.getByText('2 dates shared · Synthetic Cape', { exact: true }).waitFor()
    assert.equal(writes, 3, 'Refresh only reads committed state')
    await page.getByRole('button', { name: 'Switch client', exact: true }).click()
    await page.getByText('0 dates shared · Synthetic B', { exact: true }).waitFor()
    assert.equal(await page.getByText(/Synthetic Cape/).count(), 0)
    assert.equal(writes, 3); assert.deepEqual(errors, [])
    await page.close(); console.log(`Plan date sharing ${width}px PASS`)
  }
} finally { await browser?.close(); await server.close() }
