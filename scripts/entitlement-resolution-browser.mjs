import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'
import { resolutionFixtures } from '../tests/fixtures/entitlementResolution.mjs'
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to approved local Playwright')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const artifact = process.env.CG_389_ARTIFACT_DIR || join(tmpdir(),'cg-389-resolution')
mkdirSync(artifact,{recursive:true})
const fixture={name:'389-resolution-fixture',enforce:'pre',resolveId(id){if(id==='virtual:resolution')return '\0virtual:resolution'},
  transform(_code,id){if(id.replaceAll('\\','/').endsWith('/contexts/AuthContext.tsx'))return 'export function useAuth(){return {profile:window.fixtureProfile}}'},
  load(id){if(id!=='\0virtual:resolution')return;return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import PackageMasterPage from'/src/pages/admin/PackageMasterPage.tsx';import'/src/index.css';
    window.fixtureProfile={id:'local-admin',role:'admin',is_active:true};function App(){const[tick,setTick]=useState(0);window.setRole=(role,is_active=true)=>{window.fixtureProfile={id:role,role,is_active};setTick(tick+1)};return React.createElement(PackageMasterPage)}createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`},
  configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/__resolution')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@id/virtual:resolution"></script></body></html>')})}}
const server=await createServer({configFile:false,plugins:[react(),fixture],cacheDir:join(tmpdir(),'cg-389-resolution-vite'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:1'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-fixture-public-key')},server:{host:'127.0.0.1',port:53990,strictPort:true,hmr:false}})
let browser
try {
  await server.listen();browser=await chromium.launch({headless:true})
  for(const[name,width,height]of[['desktop',1440,1000],['mobile-375',375,844],['mobile-390',390,844],['mobile-430',430,900]]) {
    const page=await browser.newPage({viewport:{width,height}}),writes=[],errors=[]
    let scenario='normal',readCount=0,clients=resolutionFixtures()
    clients[0].entitlements=[{service_key:'linkedin',state:'unknown',evidence_note:'Local reviewed unknown',source_references:[],verified_at:'2026-10-02T10:00:00Z',revision:1,notes:null}]
    page.on('pageerror',error=>errors.push(error.message))
    await page.route('http://127.0.0.1:1/rest/v1/**',async route=>{
      const url=route.request().url(),payload=route.request().postDataJSON()
      if(url.includes('/clients?'))return route.fulfill({json:clients.map(c=>({id:c.client_id,name:c.client_name}))})
      if(url.includes('/client_aliases?'))return route.fulfill({json:[]})
      if(url.includes('/rpc/get_admin_entitlement_resolution_queue')) {
        readCount++
        const error={missing:['PGRST202',404],schema:['42P01',404],failed:['XX000',503]}[scenario]
        if(error)return route.fulfill({status:error[1],json:{code:error[0],message:'Local read failure'}})
        return route.fulfill({json:clients})
      }
      if(url.includes('/client_service_entitlements'))return route.fulfill({json:clients.find(c=>url.includes(c.client_id))?.entitlements??[]})
      if(url.includes('/rpc/get_client_service_expansion_review'))return route.fulfill({json:[]})
      if(url.includes('/rpc/verify_client_service_entitlement')) {
        writes.push(payload)
        const client=clients.find(c=>c.client_id===payload.p_client_id)
        client.entitlements.push({service_key:payload.p_service_key,state:payload.p_state,evidence_note:payload.p_evidence_note,source_references:payload.p_source_references,verified_at:'2026-10-02T12:00:00Z',revision:1,notes:null})
        return route.fulfill({status:204,body:''})
      }
      throw new Error(`Unexpected local request ${url}`)
    })
    const url=`${server.resolvedUrls.local[0]}__resolution`
    await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByText(/28 decisions needed/).waitFor()
    assert.equal(writes.length,0);assert.equal(await page.locator('article').count(),20)
    await page.getByLabel('Queue evidence').selectOption('ready');assert.equal(await page.locator('article').count(),3)
    await page.locator('article').filter({hasText:'Red Oak'}).getByText('Evidence and exact source references').click()
    await page.screenshot({path:join(artifact,`resolution-${name}.png`),fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow`)
    const red=page.locator('article').filter({hasText:'Red Oak'})
    await red.getByRole('button',{name:'Review this service'}).click()
    await red.getByLabel('Instagram scope').waitFor();assert.equal(await red.getByLabel('Instagram scope').inputValue(),'unknown')
    assert.equal(await red.getByLabel('Evidence summary').inputValue(),'')
    assert.equal(await page.locator('form').count(),1);assert.equal(writes.length,0)
    const stafford=page.locator('article').filter({hasText:'The Staffordshire'})
    await stafford.getByRole('button',{name:'Review this service'}).click();await stafford.getByLabel('Instagram scope').waitFor()
    assert.equal(await page.locator('form').count(),1)
    await red.getByRole('button',{name:'Review this service'}).click();await red.getByLabel('Instagram scope').selectOption('included')
    await red.getByLabel('Evidence summary').fill('Local approved exact Instagram evidence')
    await red.getByLabel('Approved source references (one per line)').fill('Local approved source')
    await red.getByRole('button',{name:'Verify service scope'}).click();await page.getByText(/27 decisions needed/).waitFor()
    assert.equal(writes.length,1);assert.equal(writes[0].p_client_id,'cdb11a82-339e-4b46-9b09-bde1a23efeaf');assert.equal(writes[0].p_service_key,'instagram');assert.equal(writes[0].p_expected_revision,0)
    await page.getByLabel('Queue evidence').selectOption('');await page.getByLabel('Queue review').selectOption('reviewed');assert.equal(await page.locator('article').count(),1)
    await page.getByLabel('Queue review').selectOption('');await page.getByLabel('Queue context').selectOption('excluded');assert.equal(await page.locator('article').count(),7)
    await page.getByLabel('Queue context').selectOption('');await page.getByLabel('Queue client').selectOption('cdb11a82-339e-4b46-9b09-bde1a23efeaf');await page.getByLabel('Queue service').selectOption('tiktok');assert.equal(await page.locator('article').count(),1)
    for(const failure of ['missing','schema','failed']){scenario=failure;await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('alert').waitFor();assert.equal(await page.locator('article,form').count(),0)}
    scenario='normal';await page.reload({waitUntil:'domcontentloaded'});await page.getByLabel('Queue service').waitFor()
    const prior=readCount;await page.evaluate(()=>window.setRole('client'));assert.equal(await page.getByRole('heading',{name:'Entitlement Resolution Queue'}).count(),0);assert.equal(readCount,prior)
    await page.evaluate(()=>window.setRole('admin',false));assert.equal(await page.locator('article,form').count(),0);assert.equal(readCount,prior)
    assert.deepEqual(errors,[]);await page.close()
    console.log(`PASS ${name}: five filters, exact evidence, one editor, explicit exact write fixture, no autofill/bulk writes, failed rollout reads and role isolation; ${join(artifact,`resolution-${name}.png`)}`)
  }
} finally {await browser?.close();await server.close()}
