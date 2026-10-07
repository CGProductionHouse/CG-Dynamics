import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'actual-client-approval-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:approval') return '\0virtual:approval' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{role:'client',client_id:'synthetic-only'}}}`
    if (path.endsWith('/lib/supabase.ts')) return `export const supabase={
      rpc:async(name)=>{if(name!=='client_content_review_queue')throw Error('Mutation forbidden');return{data:window.fixtureRows,error:null}},
      storage:{from:()=>({createSignedUrl:async()=>{if(window.fixtureReject)throw Error('Synthetic transport rejection');if(window.fixtureBrokenMedia)return{data:{signedUrl:location.origin+'/fixture-missing-image.png'},error:null};return{data:null,error:{message:'PRIVATE_STORAGE_DIAGNOSTIC'}}}})}
    }`
  },
  load(id) {
    if (id !== '\0virtual:approval') return
    return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from'/src/pages/admin/ContentReviewsPage.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page,{clientView:true})));`
  },
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/client/approvals')) return next()
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:approval"></script></body></html>')
  }) },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-approval-browser-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53995, strictPort: true, hmr: false },
})
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const width of [375, 390, 430, 1440]) for (const kind of ['approved', 'mixed', 'rejected', 'missing-queue', 'broken-media']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => { assert.equal(new URL(route.request().url()).origin, 'http://127.0.0.1:53995', 'No external network'); return route.continue() })
    await page.addInitScript(kind => {
      window.fixtureReject = kind === 'rejected'
      window.fixtureBrokenMedia = kind === 'broken-media'
      const row = { id:'approved',title:'Reviewed delivery video',asset_path:'synthetic-only',media_type:'video/mp4',caption:'Exact delivery process.',channels:['facebook'],scheduled_at:'2026-10-12T10:00:00Z',state:'approved' }
      window.fixtureRows = kind !== 'approved' ? [row,{...row,id:'pending',state:'client_review',title:'Next delivery video'}] : [row]
      if (kind === 'missing-queue') window.fixtureRows = null
      if (kind === 'broken-media') window.fixtureRows = window.fixtureRows.map(row => ({...row,media_type:'image/png'}))
    }, kind)
    await page.goto('http://127.0.0.1:53995/client/approvals')
    if (kind === 'missing-queue') {
      await page.getByRole('heading', { name:'Approvals could not be loaded',exact:true }).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(), /Nothing waiting|You’re up to date/)
      assert.deepEqual(errors, [])
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path:join(tmpdir(), `cg-approvals-${kind}-${width}.png`),fullPage:true })
      console.log(`PASS actual client approvals ${width}px missing queue is unavailable, never empty`)
      await page.close(); continue
    }
    await page.getByRole('heading', { name: 'Approvals', exact: true }).waitFor()
    await page.getByText(kind !== 'approved' ? '1 item waiting' : 'Nothing waiting', { exact: true }).waitFor()
    await page.getByText('Your approval is recorded. Publication is managed by CG.', { exact: true }).waitFor()
    await page.getByText('Content preview is unavailable. Please try again shortly.', { exact: true }).first().waitFor()
    assert.doesNotMatch(await page.locator('body').innerText(), /Publish manually|PRIVATE_STORAGE_DIAGNOSTIC/)
    if (kind !== 'approved') assert.equal(await page.getByRole('button', { name:'Approve',exact:true }).isDisabled(), true, 'No approval without asset preview')
    else assert.equal(await page.getByRole('button', { name:'Approve',exact:true }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No body overflow')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-approvals-${kind}-${width}.png`), fullPage:true })
    console.log(`PASS actual client approvals ${width}px ${kind}: decision count, approved history, safe missing preview, no writes/errors/overflow`)
    await page.close()
  }
} finally { await browser?.close(); await server.close() }
