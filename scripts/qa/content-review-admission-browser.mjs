import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual production form, review cards, library and CSS. Synthetic SDK only;
// new temporary Chrome profile, external traffic blocked, no signed-in session.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const origin = 'http://127.0.0.1:54011'
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', reviewId = '33333333-3333-4333-8333-333333333333'
const fixture = { name: 'review-admission-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:review-admission') return '\0virtual:review-admission' },
  load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return `
      const mode=new URLSearchParams(location.search).get('mode')||'ok';
      window.reviewWrites={uploads:0,submissions:0,sourceSaves:0};window.reviewRows=[];window.receiptVisible=mode!=='unknown';
      export const supabase={storage:{from(){return{
        async upload(path,file,options){window.reviewWrites.uploads++;if(options.upsert!==false)throw Error('Overwrite forbidden');
          if(mode==='delayed')await new Promise(resolve=>{window.finishUpload=resolve});return{data:{path},error:null}},
        async createSignedUrl(){return{data:{signedUrl:'/tests/fixtures/publication-baseline-320.jpg'},error:null}}
      }}},rpc(name,args){return{abortSignal(){return this},async then(resolve,reject){try{
        if(name==='save_content_creative_source'){window.reviewWrites.sourceSaves++;return resolve({data:null,error:null})}
        if(name!=='submit_content_review')throw Error('Unexpected mutation');window.reviewWrites.submissions++;
        if(mode==='rejected')return resolve({data:null,error:{code:'P0001',message:'Link the exact Canva page first'}});
        window.reviewRows.push({id:'${reviewId}',title:'Synthetic exact review',deliverable_id:args.p_deliverable_id,client_id:'${b}',
          asset_path:args.p_asset_path,media_type:'image/jpeg',caption:args.p_caption,channels:args.p_channels,scheduled_at:args.p_scheduled_at,
          client_approval_required:args.p_client_required,state:'internal_review'});
        if(mode==='lost')throw Error('PRIVATE lost save response');
        return resolve({data:mode==='unknown'?null:'${reviewId}',error:null})
      }catch(error){return reject(error)}}}},from(table){const filters=[];const query={select(){return query},eq(k,v){filters.push([k,v]);return query},
        order(){return table==='content_review_events'?Promise.resolve({data:[],error:null}):query},abortSignal(){return query},
        async range(){return{data:window.reviewRows,error:null}},async maybeSingle(){
          if(table==='deliverable_creative_sources')return{data:{canva_design_id:'SYNTHETIC_DESIGN',canva_page_id:'SYNTHETIC_PAGE'},error:null};
          if(table!=='content_review_versions')throw Error('Unexpected read');
          return{data:window.receiptVisible?window.reviewRows.find(row=>filters.every(([k,v])=>row[k]===v))||null:null,error:null}
        }};return query}};`
    if (id !== '\0virtual:review-admission') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ContentProductionPanel}from'/src/components/content/ContentProductionPanel.tsx';import'/src/index.css';
      function App(){const[id,setId]=useState('${a}');window.switchItem=()=>setId('${b}');return React.createElement('main',{className:'mx-auto max-w-3xl p-4'},
        React.createElement('h1',null,id==='${a}'?'Synthetic item A':'Synthetic item B'),
        React.createElement(ContentProductionPanel,{key:id,deliverable:{id,client_id:'${b}',scheduled_date:'2099-01-01',deliverable_type:'dp'},canManage:new URLSearchParams(location.search).get('role')!=='staff'}))}
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));`
  }, configureServer(server) { server.middlewares.use((req, res, next) => {
    if (!/^\/admission([/?]|$)/.test(req.url ?? '')) return next()
    res.setHeader('Content-Type','text/html');res.end(readFileSync('index.html','utf8').replace('/src/main.tsx','/@id/virtual:review-admission'))
  }) },
}
const server = await createServer({ configFile:false, plugins:[fixture,react()], cacheDir:join(tmpdir(),'cg-review-admission-vite'),
  optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime']}, server:{host:'127.0.0.1',port:54011,strictPort:true,hmr:false} })
const output=join(tmpdir(),'cg-review-admission-browser');mkdirSync(output,{recursive:true})
let browser,cases=0
try {
  await server.listen();browser=await chromium.launch({headless:true,channel:'chrome'})
  for(const width of [375,390,430,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}}), errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
    async function fill(mode='ok',role='manager') {
      await page.goto(origin+'/admission?mode='+mode+'&role='+role)
      await page.getByText('Send final creative for review',{exact:true}).click()
      await page.getByLabel('Final JPG, PNG, WebP or MP4 · up to 50 MB').setInputFiles('tests/fixtures/publication-baseline-320.jpg')
      await page.getByLabel('Caption',{exact:true}).fill('Exact synthetic caption')
      await page.getByLabel('facebook',{exact:true}).check()
    }
    for(const mode of ['ok','lost']) {
      await fill(mode)
      // Two clicks in the same event turn, before React can disable the button.
      await page.getByRole('button',{name:'Send for review',exact:true}).evaluate(button=>{button.click();button.click()})
      await page.getByText(/Review saved\. Its current approval status/).waitFor()
      assert.deepEqual(await page.evaluate(()=>window.reviewWrites),{uploads:1,submissions:1,sourceSaves:0})
      assert.equal(await page.getByRole('button',{name:'Send for review',exact:true}).isDisabled(),true)
      assert.equal(await page.getByLabel('Unverified review submission').count(),0);cases++
    }
    await fill('unknown');await page.getByRole('button',{name:'Send for review',exact:true}).click()
    const unknown=page.getByLabel('Unverified review submission');await unknown.waitFor()
    assert.equal(await page.getByRole('button',{name:'Send for review',exact:true}).isDisabled(),true)
    assert.equal(await page.getByRole('button',{name:'Save Canva page link',exact:true}).isDisabled(),true)
    for(let i=0;i<2;i++){await page.getByRole('button',{name:'Check submission',exact:true}).click();await page.getByText(/submission is still unverified/).waitFor()}
    assert.deepEqual(await page.evaluate(()=>window.reviewWrites),{uploads:1,submissions:1,sourceSaves:0})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    await page.screenshot({path:join(output,'unverified-'+width+'.png'),fullPage:true})
    await page.evaluate(()=>{window.receiptVisible=true});await page.getByRole('button',{name:'Check submission',exact:true}).click()
    await page.getByText(/Review saved\. Its current approval status/).waitFor()
    assert.deepEqual(await page.evaluate(()=>window.reviewWrites),{uploads:1,submissions:1,sourceSaves:0});cases++
    await fill('rejected');await page.getByRole('button',{name:'Send for review',exact:true}).click()
    await page.getByRole('alert').getByText('Link the exact Canva page first',{exact:true}).waitFor()
    assert.equal(await unknown.count(),0);assert.equal(await page.getByRole('button',{name:'Send for review',exact:true}).isDisabled(),false);cases++
    await fill('delayed');await page.getByRole('button',{name:'Send for review',exact:true}).click()
    await page.waitForFunction(()=>typeof window.finishUpload==='function')
    await page.evaluate(()=>window.switchItem());await page.getByRole('heading',{name:'Synthetic item B'}).waitFor()
    await page.evaluate(()=>window.finishUpload());await page.waitForFunction(()=>window.reviewWrites.submissions===1)
    assert.equal(await page.getByText(/Review saved\. Its current approval status/).count(),0)
    assert.equal(await page.getByLabel('Caption',{exact:true}).inputValue(),'');assert.equal(await unknown.count(),0);cases++
    await fill('ok','staff');assert.equal(await page.getByLabel('Client approval required',{exact:true}).isDisabled(),true)
    assert.equal(await page.getByLabel('Client approval required',{exact:true}).isChecked(),true);cases++
    assert.deepEqual(errors,[]);await page.close()
  }
  console.log(JSON.stringify({passed:true,cases,widths:[375,390,430,1440],output,externalNetwork:'blocked',liveWrites:0}))
}finally{await browser?.close();await server.close()}
