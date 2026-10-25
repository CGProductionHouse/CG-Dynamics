import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'

if(!process.env.CG_PLAYWRIGHT_MODULE)throw Error('Local Playwright module required')
const {chromium}=await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture={name:'read-only-conflict-fixture',resolveId(id){if(id==='virtual:conflict-review')return '\0conflict-review'},load(id){if(id==='\0conflict-review')return `
import React from 'react';import{createRoot}from'react-dom/client';import Review from '/src/components/admin/MicrosoftRunConflictReview.tsx';import '/src/index.css';
const run={id:'10000000-0000-4000-8000-000000000001',summary:{conflicts:383},snapshotExportedAt:'2026-10-19T07:27:07Z',finishedAt:'2026-10-19T07:35:09Z',status:'partial'};
const items=Array.from({length:381},(_,n)=>({id:'10000000-0000-4000-8000-'+String(n+1).padStart(12,'0'),itemKey:'key'+n,sourceType:'planner_task',sourceContainerId:'plan',sourceItemId:'task'+n,sourceName:n===380?'Calendar':'To Do',destination:'planner',destinationId:null,action:'conflict',resultStatus:'skipped',sourceComplete:true,details:{title:'Private sentinel',conflict_reason:'Private sentinel'}}));
createRoot(document.getElementById('root')).render(React.createElement(Review,{run,items,state:new URLSearchParams(location.search).get('state')??'ready'}));
`},configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__conflicts'))return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#080e0d"><div id="root"></div><script type="module" src="/@id/virtual:conflict-review"></script></body></html>')})}}
const server=await createServer({configFile:false,cacheDir:join(tmpdir(),'cg-conflict-review-vite'),plugins:[fixture,react()],server:{host:'127.0.0.1',port:54042,strictPort:true,hmr:false},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-runtime']}})
let browser
try{
  await server.listen();browser=await chromium.launch({headless:true})
  for(const width of [1440,375]){
    const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true});let writes=0
    page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes++})
    await page.goto('http://127.0.0.1:54042/__conflicts');await page.getByRole('heading',{name:'Conflict review — no changes applied'}).waitFor()
    assert.match(await page.getByRole('alert').innerText(),/differ by 2/)
    assert.equal(await page.getByText(/Fresh canonical preview required/).count(),50)
    await page.getByRole('button',{name:'Next conflict page'}).click();await page.getByText('Page 2 of 8 · 381 references',{exact:true}).waitFor()
    await page.getByLabel('Conflict source',{exact:true}).selectOption('Calendar');await page.getByText('Page 1 of 1 · 1 references',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Next conflict page'}).isDisabled(),true)
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download private review packet'}).click();const download=await downloadPromise
    const packet=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(packet.rows.length,381);assert.equal(packet.count_gap,2);assert.equal(packet.apply_ready,false);assert.ok(!JSON.stringify(packet).includes('Private sentinel'))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    await page.goto('http://127.0.0.1:54042/__conflicts?state=error');await page.getByText(/Run journal unavailable/).waitFor();assert.equal(await page.getByRole('button',{name:'Download private review packet'}).count(),0)
    assert.equal(writes,0);await page.close();console.log('PASS '+width+'px: actual381-row review,383 summary, mismatch hold,50-row paging, source filter, private download, unavailable state, no overflow/writes')
  }
}finally{await browser?.close();await server.close()}
