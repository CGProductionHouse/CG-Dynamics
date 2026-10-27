import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const origin = 'http://127.0.0.1:54027'
const fixture = {
  name: 'meta-readiness-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:meta-readiness') return '\0virtual:meta-readiness' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/lib/supabase.ts')) return `
      const read = table => { const q = {select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},then(resolve){resolve({data:[]})}};return q };
      export const supabase = { from:read, functions:{async invoke(name){const r=await fetch('/__fixture/'+name+location.search,{method:'POST'});return {data:await r.json(),error:null}}} };`
    if (path.endsWith('/lib/db/clients.ts')) return `export async function listClients(){return {data:[]}}`
    if (path.endsWith('/integrations/InstagramConnectionQueue.tsx')) return `import React from 'react';export function InstagramConnectionQueue(){return <section style={{minHeight:3000}}><h2>Instagram connection queue</h2></section>}`
  },
  load(id) {
    if (id === '\0virtual:meta-readiness') return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import Page from '/src/pages/admin/MetaIntegrationPage.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith('/__meta-readiness')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:meta-readiness"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-meta-readiness-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 54027, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const actions = [], errors = []
    let releaseStart
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      assert.equal(url.origin, origin, 'No production/provider request')
      if (url.pathname === '/__oauth') return route.fulfill({ contentType: 'text/html', body: '<h1>Existing Meta renewal</h1>' })
      if (!url.pathname.startsWith('/__fixture/')) return route.continue()
      const action = url.pathname.split('/').at(-1); actions.push(action)
      if (action === 'meta-oauth-start') {
        if (actions.filter(a => a === action).length === 2) return route.fulfill({ json: { ok: true, url: `${origin}/__oauth` } })
        await new Promise(resolve => { releaseStart = resolve })
        return route.fulfill({ json: { ok: false, error: 'Synthetic connection unavailable. Try again.' } })
      }
      assert.equal(action, 'meta-connection-status', 'No sync, mapping or other provider writes')
      const mode = url.searchParams.get('case')
      const response = mode === 'unknown' ? { ok: true, connected: false, message: 'Reconnect Meta.' }
        : mode === 'blocked' ? { ok: true, connected: false, schemaReady: false, tokenSecurity: { encryptedAtRest: false } }
        : mode === 'connected' ? { ok: true, connected: true, schemaReady: true, connection: { grantedScopes: ['read_insights'] }, tokenSecurity: { encryptedAtRest: true } }
        : { ok: true, connected: false, schemaReady: true, message: 'Meta data access expired. Reconnect Meta.', tokenLifecycle: { state: 'data_access_expired' } }
      return route.fulfill({ json: response })
    })
    await page.goto(`${origin}/__meta-readiness?case=expired`)
    const connect = page.getByRole('button', { name: 'Connect Meta', exact: true })
    await connect.waitFor(); await page.getByText('Meta data access expired. Reconnect Meta.', { exact: true }).waitFor()
    const box = await connect.boundingBox()
    assert.ok(box && box.y >= 0 && box.y + box.height <= 900, `${width}: connect must be visible without scrolling past the queue`)
    const health = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Meta connection health', exact: true }) })
    const tile = label => health.locator('div.rounded-xl').filter({ has: page.getByText(label, { exact: true }) })
    assert.match(await tile('OAuth schema').innerText(), /Ready/)
    assert.match(await tile('Token storage').innerText(), /Not reported/)
    assert.match(await tile('Last connected').innerText(), /Not reported/)
    assert.match(await tile('Token validity').innerText(), /Data access expired/)
    assert.equal(await health.getByText('Migration required', { exact: true }).count(), 0)
    await connect.click(); await page.getByRole('button', { name: 'Connecting…', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Connecting…', exact: true }).isDisabled(), true)
    assert.equal(actions.filter(a => a === 'meta-oauth-start').length, 1)
    releaseStart(); await page.getByText('Synthetic connection unavailable. Try again.', { exact: true }).waitFor()
    assert.equal(await connect.isEnabled(), true)
    for (const mode of ['unknown', 'blocked', 'connected']) {
      await page.goto(`${origin}/__meta-readiness?case=${mode}`)
      await page.getByRole('button', { name: mode === 'connected' ? 'Reconnect Meta' : 'Connect Meta', exact: true }).waitFor()
      await page.waitForFunction(() => !document.body.innerText.includes('Checking...'))
      assert.match(await tile('OAuth schema').innerText(), new RegExp(mode === 'unknown' ? 'Not reported' : mode === 'blocked' ? 'Migration required' : 'Ready'))
      assert.match(await tile('Token storage').innerText(), new RegExp(mode === 'unknown' ? 'Not reported' : mode === 'blocked' ? 'encryption hardening required' : 'Encrypted at rest'))
      assert.equal(await page.getByText('Token storage remains server-only but is not yet encrypted at rest', { exact: false }).count(), mode === 'blocked' ? 1 : 0)
    }
    await page.screenshot({ path: join(tmpdir(), `cg-meta-readiness-${width}.png`), fullPage: false })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`)
    assert.deepEqual(errors, [])
    assert.equal(actions.filter(a => a === 'meta-oauth-start').length, 1, 'No automatic reconnect/retry')
    await page.getByRole('button', { name: 'Reconnect Meta', exact: true }).click()
    await page.getByRole('heading', { name: 'Existing Meta renewal', exact: true }).waitFor()
    assert.equal(actions.filter(a => a === 'meta-oauth-start').length, 2, 'Explicit retry navigates via the existing OAuth endpoint')
    console.log(`PASS ${width}px: visible connect, preserved expiry/schema, unknown vs explicit false, one manual OAuth attempt and retryable error`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
