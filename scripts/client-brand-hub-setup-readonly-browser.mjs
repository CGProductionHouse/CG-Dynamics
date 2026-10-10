import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual Brand Hub component with synthetic, read-only local Edge responses.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = {
  name: 'client-brand-hub-setup-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:brand-hub-fixture') return '\0virtual:brand-hub-fixture' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{role:'admin',client_id:null}}}`
  },
  load(id) {
    if (id !== '\0virtual:brand-hub-fixture') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
      import ClientSetupPage from '/src/features/client-onboarding/ClientSetupPage.tsx';
      import {ClientPortalContext} from '/src/components/client/ClientPortalContext.ts';import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,
        React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}',name:'Synthetic A'},previewClientId:'${clientId}'}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(ClientSetupPage)))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__brand-hub') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:brand-hub-fixture"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-brand-hub-setup-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53989, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; const actions = []; let failSetup = true; let available = true
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:53989') return route.continue()
      assert.equal(url.href, 'http://127.0.0.1:1/functions/v1/client-onboarding', 'No external/provider request')
      assert.equal(request.method(), 'POST')
      const body = request.postDataJSON(); actions.push(body.action)
      assert.equal(body.clientId, clientId, 'Exact selected client only')
      if (body.action === 'staff_preview_portal_library_load') return route.fulfill({ json: { ok: true, data: { clientName: 'Synthetic A', clientLogoUrl: null, available, categories: [] } } })
      assert.equal(body.action, 'staff_preview_portal_load', 'Only existing read actions')
      return route.fulfill({ json: failSetup
        ? { ok: false, error: 'Synthetic setup read failure' }
        : { ok: true, data: null } })
    })
    await page.goto('http://127.0.0.1:53989/__brand-hub')
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor()
    await page.getByText('Brand foundation details are temporarily unavailable.', { exact: true }).waitFor({ timeout: 1500 })
    assert.deepEqual(actions.sort(), ['staff_preview_portal_library_load', 'staff_preview_portal_load'])
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    await page.screenshot({ path: join(tmpdir(), `cg-brand-hub-setup-${width}.png`), fullPage: true })
    failSetup = false
    await page.reload()
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor()
    assert.equal(await page.getByText('Brand foundation details are temporarily unavailable.', { exact: true }).count(), 0, 'No false failure for an empty successful setup read')
    available = false; failSetup = true
    await page.reload()
    await page.getByRole('heading', { name: 'Your library is being prepared' }).waitFor()
    assert.equal(await page.getByText('Brand foundation details are temporarily unavailable.', { exact: true }).count(), 0, 'Disabled library has one clear holding state, not an additional setup warning')
    assert.equal(await page.getByText('Approved brand files and final client-ready content, kept together in one clear space.', { exact: true }).count(), 0, 'Do not promise available files while the library is disabled')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px disabled-library overflow`)
    assert.deepEqual(actions.sort(), ['staff_preview_portal_library_load', 'staff_preview_portal_library_load', 'staff_preview_portal_library_load', 'staff_preview_portal_load', 'staff_preview_portal_load', 'staff_preview_portal_load'])
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: library remains available, failed setup explicit, successful empty setup not mislabeled, exact client and read-only`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
