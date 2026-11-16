import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Isolated local application test, never attaches to a user's browser/profile.
// Actual login, router, portal shell, Overview and CSS; synthetic reads/auth only.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Approved local Playwright module required')
const engines = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const origin = 'http://127.0.0.1:54009'
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = {
  name: 'client-opening-viewport', enforce: 'pre',
  resolveId(id) { if (id.startsWith('virtual:opening-')) return `\0${id}` },
  transform(code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{role:'client',client_id:'${clientId}'},signOut:()=>{throw Error('No sign out')},signIn:async()=>{await new Promise(r=>setTimeout(r,20));return {error:null,role:'client'}}}}`
    if (path.endsWith('/components/client/ClientPortalShell.tsx')) {
      code = code.replace("'../../lib/clientLeadsNavigation'", "'virtual:opening-reads'")
      if (process.env.CG_VIEWPORT_BASELINE === '1') code = code.replace('return restoreClientOpeningViewport()', 'return undefined')
    }
    if (path.endsWith('/pages/client/ClientPortalHome.tsx')) {
      for (const module of ['db/reports', 'db/reportingTruth', 'googleAdsDashboard', 'monthlyStrategy', 'clientPortalCalendar']) {
        code = code.replace(`'../../lib/${module}'`, "'virtual:opening-reads'")
      }
    }
    return code
  },
  load(id) {
    if (id === '\0virtual:opening-reads') return `
      export async function hasClientLeadsDestination(){return false}
      export async function listClientPublishedReports(){return {data:[{id:'local-report',client_id:'${clientId}',status:'published',platform:null,period_start:'2026-10-01',period_end:'2026-10-31'}],error:null}}
      export async function loadReportPlatformFacts(){return {facts:[],error:null}}
      export async function loadGoogleAdsDashboard(){return {state:'no-activity'}}
      export async function getClientPublishedMonthlyStrategy(){return {data:null,error:null}}
      export async function fetchClientMonthAhead(){return null}
    `
    if (id !== '\0virtual:opening-app') return
    return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';
      import Login from'/src/pages/Login.tsx';import{ClientPortalShell}from'/src/components/client/ClientPortalShell.tsx';import Home from'/src/pages/client/ClientPortalHome.tsx';import{ClientPortalContext}from'/src/components/client/ClientPortalContext.ts';import'/src/index.css';
      const client={id:'${clientId}',name:new URLSearchParams(location.search).has('long')?'Synthetic Very Long Client Name For Phone Width Checking':'Synthetic Client',active:true,logo_url:null};
      function Portal(){return React.createElement(ClientPortalContext.Provider,{value:{client}},React.createElement(ClientPortalShell,{client},React.createElement(Routes,null,React.createElement(Route,{path:'/',element:React.createElement(Home)}),React.createElement(Route,{path:'plan',element:React.createElement('h1',null,'Fixture plan')}))))}
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(BrowserRouter,null,React.createElement(Routes,null,React.createElement(Route,{path:'/login',element:React.createElement(Login)}),React.createElement(Route,{path:'/client/*',element:React.createElement(Portal)})))));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!/^\/(login|client)([/?]|$)/.test(req.url ?? '')) return next()
      res.setHeader('Content-Type', 'text/html')
      // Use the real production head/viewport, not an invented mobile fixture.
      res.end(readFileSync('index.html', 'utf8').replace('/src/main.tsx', '/@id/virtual:opening-app'))
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()],
  cacheDir: join(tmpdir(), 'cg-client-opening-viewport-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 54009, strictPort: true, hmr: false },
})
const output = join(tmpdir(), 'cg-client-opening-viewport')
mkdirSync(output, { recursive: true })
let browser
try {
  await server.listen()
  for (const engine of ['chromium', 'webkit']) {
    browser = await engines[engine].launch({ headless: true })
    for (const width of [320, 375, 393, 430, 1440]) {
      const mobile = width < 768
      const page = await browser.newPage({ viewport: { width, height: 850 }, isMobile: mobile, hasTouch: mobile,
        ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
      })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
      await page.goto(`${origin}/login`)
      const identifier = page.getByLabel('Username or email')
      await identifier.fill('fixtureclient')
      await page.getByLabel('Password', { exact: true }).fill('synthetic-local-only')
      assert.equal(await identifier.evaluate(e => getComputedStyle(e).fontSize), mobile ? '16px' : '14px')
      await page.getByRole('button', { name: 'Show password' }).click()
      assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(e => getComputedStyle(e).fontSize), mobile ? '16px' : '14px')
      // Native Chromium page magnification reproduces the cropped visual
      // viewport while layout/scrollWidth still look perfectly responsive.
      let cdp
      if (mobile && engine === 'chromium') {
        cdp = await page.context().newCDPSession(page)
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 16 / 14 })
        assert.ok(await page.evaluate(() => visualViewport.width < document.documentElement.clientWidth - 20))
      }
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.getByRole('heading', { name: 'Synthetic Client', exact: true }).waitFor()
      await page.waitForFunction(() => !document.querySelector('meta[name="viewport"]').content.includes('maximum-scale'))
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, visual: visualViewport.width, scale: visualViewport.scale,
        signOut: document.querySelector('header button').getBoundingClientRect().right,
        focusedInput: document.activeElement.matches('input'),
      }))
      assert.ok(metrics.scroll <= width + 1, `${engine}/${width} document overflow ${JSON.stringify(metrics)}`)
      assert.ok(metrics.signOut <= metrics.visual + 1, `${engine}/${width} cropped sign out ${JSON.stringify(metrics)}`)
      assert.ok(Math.abs(metrics.scale - 1) < 0.02, `${engine}/${width} retained opening zoom ${JSON.stringify(metrics)}`)
      assert.equal(metrics.focusedInput, false)
      if (cdp) {
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 })
        // Keyboard activation avoids CDP's fixed-element hit-test mismatch at
        // magnification, while still performing real React Router navigation.
        const plan = page.getByRole('navigation', { name: 'Client portal mobile', exact: true }).getByRole('link', { name: 'Plan', exact: true })
        await plan.focus()
        await plan.press('Enter')
        await page.getByRole('heading', { name: 'Fixture plan', exact: true }).waitFor()
        assert.ok(await page.evaluate(() => visualViewport.scale > 1.4), 'Later intentional zoom is preserved')
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
      }
      await page.screenshot({ path: join(output, `${engine}-${width}.png`), fullPage: true })
      await page.goto(`${origin}/client?long=1`)
      await page.getByRole('heading', { name: 'Synthetic Very Long Client Name For Phone Width Checking', exact: true }).waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Direct entry with long client name fits')
      assert.deepEqual(errors, [])
      console.log(`${engine} ${width}: opening/login/revealed-password/long-name PASS ${JSON.stringify(metrics)}`)
      await page.close()
    }
    await browser.close()
    browser = null
  }
  console.log(`Local screenshots: ${output}; no physical iPhone or production session used`)
} finally {
  await browser?.close()
  await server.close()
}
