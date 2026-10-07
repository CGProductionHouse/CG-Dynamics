import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const event = (id, start, end) => ({ id, title: id, start_at: `2026-10-07T${start}:00+02:00`, end_at: `2026-10-07T${end}:00+02:00`, all_day: false, status: 'scheduled', event_type: 'meeting', client_name: null, assigned_to_name: 'Fixture Admin' })
const input = { tasks: [], clients: [], deliverables: [], events: [event('past', '09:00', '10:00'), event('current', '16:00', '17:00'), event('future', '20:00', '21:00')] }
const fixture = {
  name: 'myday-next-readonly', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:myday-next') return '\0virtual:myday-next' },
  transform(code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return "export function useAuth(){return {profile:{id:'fixture-admin',full_name:'Fixture Admin'}}}"
    if (path.endsWith('/lib/supabase.ts')) return "window.fixtureCalls=0; const forbidden=()=>{window.fixtureCalls++;throw new Error('No DB/auth/provider invocation permitted')};export const supabase=new Proxy({},{get:()=>forbidden});"
    if (path.endsWith('/lib/workforceMyDay.ts')) {
      assert.ok(code.includes('prefetched?: MyDayPrefetchData,'), 'existing prefetch seam required')
      return code.replace('baseDate = new Date(),', "baseDate = new Date('2026-10-07T16:30:00+02:00'),")
        .replace('prefetched?: MyDayPrefetchData,', `prefetched: MyDayPrefetchData = ${JSON.stringify(input)} as MyDayPrefetchData,`)
    }
  },
  load(id) {
    if (id === '\0virtual:myday-next') return "import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import MyDayPage from'/src/pages/admin/MyDayPage.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(MyDayPage)));"
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__myday-next') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:myday-next"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-myday-next-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  server: { host: '127.0.0.1', port: 53992, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [375, 390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request()
      if (new URL(request.url()).origin !== 'http://127.0.0.1:53992' || request.method() !== 'GET') { errors.push('Non-local/read request'); return route.abort() }
      return route.continue()
    })
    await page.goto('http://127.0.0.1:53992/__myday-next')
    await page.getByRole('heading', { name: 'Start: current', exact: true }).waitFor()
    const next = await page.getByText('Next', { exact: true }).locator('..').innerText()
    assert.match(next, /future/)
    assert.doesNotMatch(next, /past/)
    assert.ok(await page.getByRole('heading', { name: 'past', exact: true }).isVisible(), 'elapsed record retained in assigned history')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.evaluate(() => window.fixtureCalls), 0)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-myday-next-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS actual My Day ${width}px: Johannesburg current/NEXT, elapsed history retained, no overflow/errors/DB calls`)
  }
} finally { await browser?.close(); await server.close() }
