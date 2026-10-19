import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = { name: 'brand-management-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:brand-management') return '\0virtual:brand-management' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{id:'fixture-admin',role:new URLSearchParams(location.search).get('role')??'admin'}}}`
  },
  load(id) {
    if (id !== '\0virtual:brand-management') return
    return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import Page from '/src/features/client-portal-library/LibraryManagementPage.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url.startsWith('/__brand-management')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:brand-management"></script></body></html>')
    })
  },
}
const port = 54018
const origin = `http://127.0.0.1:${port}`
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-brand-management-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom', '@supabase/supabase-js'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    let prepared = false, enabled = false, active = false, failWrite = false, failRead = false, verificationUnavailable = false
    const actions = [], errors = []
    page.on('pageerror', e => errors.push(e.message))
    const reply = (route, data) => route.fulfill({ json: { ok: true, data } })
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin === origin) return route.continue()
      assert.equal(url.href, 'http://127.0.0.1:1/functions/v1/client-onboarding', 'No production/provider request')
      const body = request.postDataJSON(); actions.push(body)
      assert.equal(body.clientId, clientId)
      if (body.action === 'staff_library_review') {
        if (failRead) return route.fulfill({ json: { ok: false, error: 'private raw failure' } })
        return reply(route, { clientId, clientName: 'Synthetic Client', prepared: verificationUnavailable ? false : prepared, enabled, verificationError: verificationUnavailable ? 'Folder unavailable' : null, assets: active ? [{ id: 'asset', displayName: 'Client logo', active: true, publishedAt: '2026-10-18T00:00:00Z' }] : [] })
      }
      if (body.action === 'staff_library_browse') return reply(route, { entries: body.category === 'brand_identity' ? [
        { id: 'logo', name: 'Logo.png', folder: false, size: 100, mimeType: 'image/png', selectable: true, reviewUrl: 'https://onedrive.live.com/?id=fixture' },
        { id: 'source', name: 'Internal.psd', folder: false, size: 200, mimeType: 'application/vnd.adobe.photoshop', selectable: false, reviewUrl: null },
      ] : [], nextOffset: null })
      if (failWrite) { failWrite = false; return route.fulfill({ json: { ok: false, error: 'private unconfirmed write' } }) }
      if (body.action === 'staff_library_prepare') prepared = true
      else if (body.action === 'staff_library_enable') { assert.equal(body.confirmed, true); enabled = body.enabled }
      else if (body.action === 'staff_library_publish') { assert.equal(body.itemId, 'logo'); assert.equal(body.confirmed, true); assert.equal(body.displayName, 'Client logo'); active = true }
      else if (body.action === 'staff_library_hide') { assert.equal(body.assetId, 'asset'); active = false }
      else assert.fail(`Unknown action ${body.action}`)
      return reply(route, body.action === 'staff_library_prepare' ? { clientId, clientName: 'Synthetic Client', prepared, enabled, assets: [] } : body.action === 'staff_library_enable' ? { enabled } : body.action === 'staff_library_publish' ? { published: true } : { hidden: true })
    })
    await page.goto(`${origin}/__brand-management?client=${clientId}`)
    await page.getByRole('heading', { name: 'Synthetic Client' }).waitFor()
    assert.deepEqual(actions.map(a => a.action), ['staff_library_review'])
    await page.getByRole('button', { name: 'Link verified folders' }).click()
    await page.getByRole('button', { name: 'Select file' }).waitFor()
    assert.equal(actions.filter(a => a.action === 'staff_library_publish').length, 0)
    assert.equal(await page.getByRole('button', { name: 'Internal format' }).isDisabled(), true)
    await page.getByRole('button', { name: 'Select file' }).click()
    assert.equal(await page.getByRole('button', { name: 'Publish selected file' }).isDisabled(), true)
    const review = page.getByRole('link', { name: 'Review source file' })
    assert.equal(await review.getAttribute('target'), '_blank')
    assert.equal(await review.getAttribute('rel'), 'noopener noreferrer')
    await page.getByLabel('Client-facing name').fill('Client logo')
    await page.getByRole('checkbox').check()
    await page.screenshot({ path: join(tmpdir(), `cg-brand-management-${width}.png`), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`)
    await page.getByRole('button', { name: 'Publish selected file' }).click()
    await page.getByRole('button', { name: 'Hide file', exact: true }).waitFor()
    assert.equal(enabled, false, 'Publishing a file never enables a library implicitly')
    await page.getByRole('button', { name: 'Enable library', exact: true }).click()
    await page.getByText('Visible to client', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Hide file', exact: true }).click()
    await page.getByText('No files published.', { exact: true }).waitFor()
    failWrite = true
    const before = actions.filter(a => a.action === 'staff_library_enable').length
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await page.getByText('Action unconfirmed.', { exact: false }).waitFor()
    await page.getByText('Visible to client', { exact: true }).waitFor()
    assert.equal(actions.filter(a => a.action === 'staff_library_enable').length, before + 1, 'Never retry a write automatically')
    failRead = true
    await page.reload()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByText('private raw failure', { exact: false }).count(), 0)
    failRead = false
    await page.getByRole('button', { name: 'Reload', exact: true }).click()
    await page.getByRole('heading', { name: 'Synthetic Client' }).waitFor()
    verificationUnavailable = true
    await page.reload()
    await page.getByText('Folder verification is unavailable.', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await page.getByRole('button', { name: 'Link verified folders', exact: true }).waitFor()
    assert.equal(enabled, false, 'Admin can hide a live library during provider outage')
    for (const role of ['manager', 'client', 'staff']) {
      const count = actions.length
      await page.goto(`${origin}/__brand-management?client=${clientId}&role=${role}`)
      await page.getByText('Admin access required.', { exact: true }).waitFor()
      assert.equal(actions.length, count, `${role} must not invoke privileged operations`)
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${width}px: read-only discovery, explicit single-file publication, enable/hide, recovery, admin-only and no overflow`)
    await page.close()
  }
} finally { if (browser) await browser.close(); await server.close() }
