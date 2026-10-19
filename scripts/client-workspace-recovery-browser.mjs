import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name:'actual-client-workspace-recovery',enforce:'pre',
  resolveId(id){if(id==='virtual:workspace')return '\0virtual:workspace'},
  transform(_code,id){
    const path=id.replaceAll('\\','/')
    if(path.endsWith('/contexts/AuthContext.tsx'))return `import{useSyncExternalStore}from'react';export function useAuth(){const client_id=useSyncExternalStore(cb=>{window.addEventListener('profile',cb);return()=>window.removeEventListener('profile',cb)},()=>window.fixtureClientId);return{profile:{role:window.fixtureRole??'client',client_id},signOut(){throw Error('Sign out forbidden in read recovery')}}}`
    if(path.endsWith('/lib/db/clients.ts'))return `export async function listClients(filter){window.fixtureReads.push(filter);if(window.fixtureMode==='throw')throw Error('PRIVATE_LIST_FAILURE');return window.fixtureMode==='error'?{data:[],error:{message:'PRIVATE_LIST_FAILURE'}}:{data:[{id:'11111111-1111-4111-8111-111111111111',name:'Exact preview client'}],error:null}};export async function getClient(id){window.fixtureReads.push(id);const mode=window.fixtureMode;if(mode==='throw')throw Error('PRIVATE_READ_FAILURE');if(mode==='error')return{data:null,error:{message:'PRIVATE_READ_FAILURE'}};if(mode==='missing')return{data:null,error:null};if(mode==='mismatch')return{data:{id:'other-client',name:'PRIVATE_OTHER_CLIENT'},error:null};if(mode==='delayed')await new Promise(r=>window.fixtureResolve=r);return{data:{id,name:'Workspace '+id},error:null}}`
    // Keep the actual shell; only its unrelated availability read is synthetic.
    if(path.endsWith('/lib/clientLeadsNavigation.ts'))return `export async function hasClientLeadsDestination(){return false}`
    if(path.endsWith('/pages/client/ClientPortalHome.tsx'))return `import React from'react';import{useClientPortal}from'/src/components/client/ClientPortalContext';export default function Home(){const{client,previewClientId}=useClientPortal();return React.createElement('h2',null,'Preview content '+client.id+' '+previewClientId)}`
  },
  load(id){if(id==='\0virtual:workspace')return `import React from'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route}from'react-router-dom';import{ClientPortalLayout}from'/src/components/client/ClientPortalLayout.tsx';import Preview from'/src/pages/admin/ClientPortalPreview.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/?client=11111111-1111-4111-8111-111111111111&area=overview']},window.fixturePreview?React.createElement(Preview):React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(ClientPortalLayout)},React.createElement(Route,{path:'/',element:React.createElement('h2',null,'Workspace content')})))))`},
  configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:workspace"></script></body></html>')})},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-workspace-recovery-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:53996,strictPort:true,hmr:false}})
let browser
try{
  await server.listen();browser=await chromium.launch({headless:true})
  for(const width of [375,390,430,1440])for(const mode of ['throw','error','missing','mismatch','no-profile','scope-race']){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'http://127.0.0.1:53996');return route.continue()})
    await page.addInitScript(mode=>{window.fixtureClientId=mode==='no-profile'?null:'client-a';window.fixtureMode=mode==='scope-race'?'error':mode;window.fixtureReads=[];window.fixtureMarker='same-document'},mode)
    await page.goto('http://127.0.0.1:53996/')
    await page.getByRole('heading',{name:'Your client workspace could not be loaded',exact:true}).waitFor()
    if(width===375&&mode==='throw')await page.screenshot({path:join(tmpdir(),'cg-workspace-recovery-error-375.png'),fullPage:true})
    assert.equal(await page.getByRole('heading',{name:'Workspace content',exact:true}).count(),0)
    assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE_/)
    const retry=page.getByRole('button',{name:'Try again',exact:true})
    if(mode==='no-profile'){assert.equal(await retry.count(),0);assert.deepEqual(await page.evaluate(()=>window.fixtureReads),[])}
    else{
      assert.equal(await retry.count(),1,'Actual layout failure has manual recovery')
      await page.evaluate(mode=>{window.fixtureMode=mode==='scope-race'?'delayed':'success'},mode)
      await retry.click()
      if(mode==='scope-race'){
        await page.waitForFunction(()=>typeof window.fixtureResolve==='function')
        await page.evaluate(()=>{window.fixtureMode='success';window.fixtureClientId='client-b';window.dispatchEvent(new Event('profile'))})
        await page.getByText('Workspace client-b',{exact:true}).waitFor()
        await page.evaluate(()=>window.fixtureResolve())
        await page.waitForTimeout(50)
        assert.equal(await page.getByText('Workspace client-a',{exact:true}).count(),0,'Late old-scope retry cannot replace current workspace')
      }else await page.getByText('Workspace client-a',{exact:true}).waitFor()
      await page.getByRole('heading',{name:'Workspace content',exact:true}).waitFor()
      if(width===375&&mode==='throw')await page.screenshot({path:join(tmpdir(),'cg-workspace-recovery-success-375.png'),fullPage:true})
      assert.equal(await page.evaluate(()=>window.fixtureMarker),'same-document')
      assert.deepEqual(await page.evaluate(()=>window.fixtureReads),mode==='scope-race'?['client-a','client-a','client-b']:['client-a','client-a'])
    }
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    console.log(`PASS workspace recovery ${width}px ${mode}`);await page.close()
  }
  for(const width of [375,390,430,1440])for(const mode of ['throw','error','denied']){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'http://127.0.0.1:53996');return route.continue()})
    await page.addInitScript(mode=>{window.fixturePreview=true;window.fixtureRole=mode==='denied'?'client':'admin';window.fixtureMode=mode;window.fixtureReads=[]},mode)
    await page.goto('http://127.0.0.1:53996/')
    if(mode==='denied'){
      await page.getByRole('heading',{name:'Manager preview access required',exact:true}).waitFor()
      assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),0)
      assert.deepEqual(await page.evaluate(()=>window.fixtureReads),[])
    }else{
      await page.getByRole('heading',{name:'Client options could not be loaded',exact:true}).waitFor()
      assert.equal(await page.getByRole('combobox',{name:'Selected client'}).isDisabled(),true)
      assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),1,'Actual preview options have manual recovery')
      await page.evaluate(()=>{window.fixtureMode='success'})
      await page.getByRole('button',{name:'Try again',exact:true}).click()
      await page.getByRole('heading',{name:'Preview content 11111111-1111-4111-8111-111111111111 11111111-1111-4111-8111-111111111111',exact:true}).waitFor()
      assert.equal(await page.getByRole('combobox',{name:'Selected client'}).inputValue(),'11111111-1111-4111-8111-111111111111')
      assert.deepEqual(await page.evaluate(()=>window.fixtureReads),['active','active'])
    }
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    console.log(`PASS preview options recovery ${width}px ${mode}`);await page.close()
  }
}finally{await browser?.close();await server.close()}
