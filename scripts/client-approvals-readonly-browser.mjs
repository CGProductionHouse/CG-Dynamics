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
      rpc:async(name)=>{window.fixtureRpcNames.push(name);if(name==='decide_content_review'&&window.fixtureDecisionError){window.fixtureDecisionAttempts++;throw Error('PRIVATE_BACKEND_DIAGNOSTIC synthetic-only')}if(name!=='client_content_review_queue')throw Error('Mutation forbidden');return{data:window.fixtureRows,error:null}},
      storage:{from:(bucket)=>({createSignedUrl:async(path,expires)=>{window.fixtureAssetReads.push({bucket,path,expires});if(window.fixtureDecisionError||window.fixtureAssetRecovered)return{data:{signedUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E'},error:null};if(window.fixtureReject)throw Error('Synthetic transport rejection');if(window.fixtureBrokenMedia)return{data:{signedUrl:location.origin+'/fixture-missing-image.png'},error:null};return{data:null,error:{message:'PRIVATE_STORAGE_DIAGNOSTIC'}}}})}
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
  for (const width of [375, 390, 430, 1440]) for (const kind of ['malformed-row', 'internal-state', 'empty', 'approved', 'mixed', 'rejected', 'missing-queue', 'broken-media', 'decision-error']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => { assert.equal(new URL(route.request().url()).origin, 'http://127.0.0.1:53995', 'No external network'); return route.continue() })
    await page.addInitScript(kind => {
      window.fixtureReject = kind === 'rejected'
      window.fixtureBrokenMedia = kind === 'broken-media'
      window.fixtureDecisionError = kind === 'decision-error'
      window.fixtureDecisionAttempts = 0
      window.fixtureRpcNames = []
      window.fixtureAssetReads = []
      const row = { id:'11111111-1111-4111-8111-111111111111',title:'Reviewed delivery video',asset_path:'synthetic-only',media_type:'video/mp4',caption:'Exact delivery process.',channels:['facebook'],scheduled_at:'2026-10-12T10:00:00Z',state:'approved' }
      window.fixtureRows = kind !== 'approved' ? [row,{...row,id:'22222222-2222-4222-8222-222222222222',asset_path:'synthetic-only-next',state:'client_review',title:'Next delivery video'}] : [row]
      if (kind === 'missing-queue') window.fixtureRows = null
      if (kind === 'malformed-row') window.fixtureRows = [null]
      if (kind === 'internal-state') window.fixtureRows = [{...row,state:'internal_review',title:'PRIVATE_INTERNAL_DRAFT'}]
      if (kind === 'empty') window.fixtureRows = []
      if (['broken-media','rejected','decision-error'].includes(kind)) window.fixtureRows = window.fixtureRows.map(row => ({...row,media_type:'image/png'}))
    }, kind)
    await page.goto('http://127.0.0.1:53995/client/approvals')
    if (['missing-queue', 'malformed-row', 'internal-state'].includes(kind)) {
      await page.getByRole('heading', { name:'Approvals could not be loaded',exact:true }).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(), /Nothing waiting|You’re up to date|PRIVATE_INTERNAL_DRAFT/)
      assert.deepEqual(errors, [])
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path:join(tmpdir(), `cg-approvals-${kind}-${width}.png`),fullPage:true })
      assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),1,`${width} approval queue error offers a read-only retry`)
      await page.evaluate(()=>{window.fixtureRows=[]})
      await page.getByRole('button',{name:'Try again',exact:true}).click()
      await page.getByRole('heading',{name:'You’re up to date',exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>window.fixtureDecisionAttempts),0,'Read retry never resubmits a decision')
      assert.deepEqual(await page.evaluate(()=>window.fixtureRpcNames),['client_content_review_queue','client_content_review_queue'],'One initial read and one explicit retry only')
      console.log(`PASS actual client approvals ${width}px ${kind} is unavailable, never empty/actionable`)
      await page.close(); continue
    }
    if (kind === 'empty') {
      await page.getByRole('heading', { name:'You’re up to date',exact:true }).waitFor()
      assert.equal(await page.getByText('Nothing waiting',{exact:true}).count(),1)
      assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
      assert.deepEqual(errors,[])
      console.log(`PASS actual client approvals ${width}px verified empty stays all-clear`)
      await page.close(); continue
    }
    await page.getByRole('heading', { name: 'Approvals', exact: true }).waitFor()
    await page.getByText(kind !== 'approved' ? '1 item waiting' : 'Nothing waiting', { exact: true }).waitFor()
    await page.getByText('Your approval is recorded. Publication is managed by CG.', { exact: true }).waitFor()
    if (kind === 'decision-error') {
      await page.getByRole('button', { name:'Approve',exact:true }).click()
      assert.equal(await page.getByRole('alert').innerText(), 'Could not record your decision. Please try again shortly.')
      assert.doesNotMatch(await page.locator('body').innerText(), /PRIVATE_BACKEND_DIAGNOSTIC/)
      assert.equal(await page.evaluate(() => window.fixtureDecisionAttempts), 1, 'One synthetic failing attempt, no server writes')
      assert.equal(await page.getByText('1 item waiting', {exact:true}).count(), 1, 'Failed decision never appears approved')
      assert.deepEqual(errors, [])
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path:join(tmpdir(), `cg-approvals-${kind}-${width}.png`),fullPage:true })
      console.log(`PASS actual client approvals ${width}px: synthetic decision error is safe, no real write`)
      await page.close(); continue
    }
    await page.getByText('Content preview is unavailable. Please try again shortly.', { exact: true }).first().waitFor()
    assert.doesNotMatch(await page.locator('body').innerText(), /Publish manually|PRIVATE_STORAGE_DIAGNOSTIC/)
    if (kind !== 'approved') assert.equal(await page.getByRole('button', { name:'Approve',exact:true }).isDisabled(), true, 'No approval without asset preview')
    else assert.equal(await page.getByRole('button', { name:'Approve',exact:true }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No body overflow')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-approvals-${kind}-${width}.png`), fullPage:true })
    const card = page.locator('article').filter({has:page.getByRole('heading',{name:kind === 'approved' ? 'Reviewed delivery video' : 'Next delivery video',exact:true})})
    if (kind !== 'approved') await card.getByRole('textbox',{name:'Comment'}).fill('Please keep my comment')
    assert.equal(await card.getByRole('button',{name:'Try again',exact:true}).count(),1,'Unavailable preview offers explicit asset recovery')
    if (!['broken-media','rejected'].includes(kind)) {
      console.log(`PASS actual client approvals ${width}px ${kind}: safe unavailable preview with explicit recovery`)
      await page.close(); continue
    }
    const before = await page.evaluate(()=>({reads:window.fixtureAssetReads.length,target:window.fixtureAssetReads.at(-1),rpcs:[...window.fixtureRpcNames]}))
    await page.evaluate(()=>{window.fixtureAssetRecovered=true})
    await card.getByRole('button',{name:'Try again',exact:true}).click()
    await card.locator('img,video').waitFor()
    await card.getByRole('alert').waitFor({state:'hidden'})
    if (kind !== 'approved') {
      assert.equal(await card.getByRole('textbox',{name:'Comment'}).inputValue(),'Please keep my comment')
      assert.equal(await card.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true)
    }
    const after = await page.evaluate(()=>({reads:window.fixtureAssetReads,rpcs:window.fixtureRpcNames}))
    assert.equal(after.reads.length,before.reads+1,'One asset read only, no sibling refresh')
    assert.deepEqual(after.reads.at(-1),before.target,'Same selected asset bucket/path/expiry, not the sibling asset')
    assert.deepEqual(after.rpcs,before.rpcs,'Preview recovery does not replay decisions or queue reads')
    if(kind==='broken-media'&&width===375)await page.screenshot({path:join(tmpdir(),'cg-approval-preview-recovered-375.png'),fullPage:true})
    console.log(`PASS actual client approvals ${width}px ${kind}: decision count, approved history, safe missing preview, no writes/errors/overflow`)
    await page.close()
  }
} finally { await browser?.close(); await server.close() }
