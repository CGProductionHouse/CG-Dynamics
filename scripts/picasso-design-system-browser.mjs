// Actual React panel, local synthetic dependencies, isolated headless Chrome.
// No real client/auth session or production/provider request is permitted.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
if(!process.env.CG_PLAYWRIGHT_MODULE)throw new Error('Use the approved existing local Playwright module; do not install another browser')
const {chromium}=await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const id='11111111-1111-4111-8111-111111111111'
const pack=JSON.parse(readFileSync('docs/ai-workforce/graphic-designer/design-brand-pack.example.json','utf8'))
Object.assign(pack,{clientId:id,revision:'fixture-1',status:'reviewed',reviewedBy:'Synthetic manager',reviewedAt:new Date(Date.now()-60_000).toISOString(),reviewDue:new Date(Date.now()+86_400_000).toISOString()})
Object.assign(pack.scopes[0],{key:'group',name:'Synthetic Group'})
const fixture={name:'picasso-local-ui-fixture',enforce:'pre',
  resolveId(id){if(id==='virtual:picasso-fixture')return '\0virtual:picasso-fixture'},
  transform(_code,moduleId){
    const path=moduleId.replaceAll('\\','/')
    if(path.endsWith('/contexts/AuthContext.tsx'))return `export function useAuth(){return {profile:{role:new URLSearchParams(location.search).get('role')??'manager'}}}`
    if(path.endsWith('/lib/commandCentre.ts'))return `export async function listActiveClients(){return {data:[{id:'${id}',name:'Synthetic Client'}],error:null}}`
    if(path.endsWith('/lib/db/designBrandPack.ts'))return `export async function getDesignBrandPack(){return window.picassoFixture.missing?{pack:null,error:'Structured Brand Packs are not available on this database yet.'}:{pack:structuredClone(window.picassoFixture.pack),updatedAt:'fixture-version',error:null}};export async function saveDesignBrandPack(clientId,pack,expected){if(window.picassoFixture.conflict)return {error:'Profile changed. Reload and reconcile before saving.'};window.picassoFixture.saves.push({clientId,pack,expected});window.picassoFixture.pack=structuredClone(pack);return {error:null}}`
    if(path.endsWith('/lib/db/clientBrand.ts'))return `export async function getBrandProfile(){return {data:null,error:null,tableMissing:false}};export async function listActiveBrandRules(){return {data:[],error:null,tableMissing:false}};export async function addBrandRule(){return {error:null}};export async function retireBrandRule(){return {error:null}};export async function saveBrandProfile(){return {data:null,error:'Fixture does not save legacy profiles'}}`
  },
  load(id){if(id==='\0virtual:picasso-fixture')return `import React from 'react';import {createRoot} from 'react-dom/client';import Panel from '/src/components/content/PicassoDesignSystemPanel.tsx';import '/src/index.css';window.picassoFixture={pack:${JSON.stringify(pack)},saves:[],missing:new URLSearchParams(location.search).has('missing'),conflict:false};createRoot(document.getElementById('root')).render(React.createElement('main',{className:'mx-auto max-w-6xl p-4'},React.createElement('p',null,'SYNTHETIC LOCAL UI TEST — no live client data'),React.createElement(Panel)));`},
  configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url.startsWith('/__picasso'))return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:picasso-fixture"></script></body></html>')})},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-picasso-ui-fixture-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime']},server:{host:'127.0.0.1',port:0,hmr:false}})
const output='artifacts/picasso-system-20261125';mkdirSync(output,{recursive:true})
let browser
try{
  await server.listen();const address=server.httpServer.address();const origin=`http://127.0.0.1:${address.port}`
  browser=await chromium.launch({headless:true,channel:'chrome'})
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,origin,'No external/production request');return route.continue()})
    await page.goto(`${origin}/__picasso`)
    await page.getByText('PICASSO · Design standards and Brand Packs',{exact:true}).click()
    await page.getByLabel('Client',{exact:true}).selectOption(id)
    await page.getByLabel('Brand scope',{exact:true}).selectOption('group')
    await page.getByText('Brand Pack ready for this scope.',{exact:false}).waitFor()
    assert.equal(await page.locator('ol > li').count(),27)
    await page.getByLabel('Format',{exact:true}).selectOption('animated_poster')
    assert.equal(await page.locator('li').filter({hasText:'motion readability'}).locator('p').first().innerText(),'Motion · motion readability')
    const replacement={...pack,revision:'fixture-2'}
    await page.getByLabel('Import Brand Pack JSON').setInputFiles({name:'fixture-pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))})
    await page.getByRole('button',{name:'Save Brand Pack revision fixture-2'}).waitFor()
    assert.equal(await page.evaluate(()=>window.picassoFixture.saves.length),0,'Import alone does not save')
    await page.evaluate(()=>window.picassoFixture.conflict=true)
    await page.getByRole('button',{name:'Save Brand Pack revision fixture-2'}).click()
    await page.getByText('Profile changed. Reload and reconcile before saving.',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.picassoFixture.saves.length),0)
    await page.evaluate(()=>window.picassoFixture.conflict=false)
    await page.getByRole('button',{name:'Save Brand Pack revision fixture-2'}).click()
    await page.getByText('Revision fixture-2',{exact:false}).waitFor()
    assert.equal(await page.evaluate(()=>window.picassoFixture.saves[0].clientId),id)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`)
    await page.screenshot({path:`${output}/panel-${width}.png`,fullPage:true})
    await page.goto(`${origin}/__picasso?role=staff`);await page.getByText('PICASSO · Design standards and Brand Packs',{exact:true}).click();await page.getByLabel('Client',{exact:true}).selectOption(id)
    await page.getByText('Revision fixture-1',{exact:false}).waitFor();assert.equal(await page.getByLabel('Import Brand Pack JSON').count(),0,'Staff cannot import profile changes')
    await page.goto(`${origin}/__picasso?missing`);await page.getByText('PICASSO · Design standards and Brand Packs',{exact:true}).click();await page.getByLabel('Client',{exact:true}).selectOption(id)
    await page.getByText('Structured Brand Packs are not available on this database yet.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Import Brand Pack JSON').count(),0)
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}px: actual panel, exact scope, motion, explicit manager save, conflict hold, staff read-only, missing-schema hold, no overflow/network`)
  }
}finally{await browser?.close();await server.close()}
