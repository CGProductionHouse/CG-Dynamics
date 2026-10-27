import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFile } from 'node:fs/promises'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the existing approved Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId='11111111-1111-4111-8111-111111111111'
const fixture={name:'library-local-readonly',enforce:'pre',
  resolveId(id){if(id==='virtual:library-fixture')return '\0virtual:library-fixture'},
  load(id){if(id!=='\0virtual:library-fixture')return
    return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import{ClientPortalContext}from'/src/components/client/ClientPortalContext.ts';import{ClientPortalLibrary}from'/src/features/client-portal-library/ClientPortalLibrary.tsx';import'/src/index.css';
      const library={clientName:'Synthetic A',clientLogoUrl:null,available:true,categories:[{category:'brand_identity',fileCount:1,years:[]},{category:'graphic_design',fileCount:2,years:[{year:2026,fileCount:1,months:[{month:10,fileCount:1}]},{year:2025,fileCount:1,months:[{month:9,fileCount:1}]}]},{category:'video',fileCount:1,years:[{year:2026,fileCount:1,months:[{month:10,fileCount:1}]}]}]};
      window.fixtureOpened=[];window.fixtureOpenedAttributes=[];const nativeClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.fixtureOpened.push(this.href);window.fixtureOpenedAttributes.push({target:this.target,rel:this.rel});if(window.fixtureNavigate)nativeClick.call(this)};
      function Fixture(){const[show,setShow]=React.useState(true);return React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}'},previewClientId:'${clientId}'}},React.createElement('main',{className:'mx-auto max-w-6xl p-4 sm:p-8'},React.createElement('button',{onClick:()=>setShow(false)},'Leave client files'),show?React.createElement(ClientPortalLibrary,{library}):React.createElement('h2',null,'Different client scope')))}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Fixture)));`
  },
  configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__library')return next()
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:library-fixture"></script></body></html>')
  })},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-library-browser-cache'),
  optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:53988'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-fixture-public-key')},
  server:{host:'127.0.0.1',port:53987,strictPort:true,hmr:false}})
let browser
try{
  await server.listen();browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--disable-popup-blocking']})
  for(const width of [1440,375,390,430]){
    const page=await browser.newPage({viewport:{width,height:1000}})
    const errors=[]; const reads=[]; let brandFailure=true;let malformed=true;let accessMode='invalid';let releaseAccess;let holdMonth=false;let releaseMonth;let successfulAttachment=false
    const attachmentBytes=Buffer.from('%PDF-1.4\n% Synthetic client-safe download fixture\n%%EOF\n')
    page.on('pageerror',error=>errors.push(error.message))
    await page.context().route('**/*',async route=>{
      const request=route.request();const url=new URL(request.url())
      if(url.origin==='http://127.0.0.1:53987')return route.continue()
      assert.equal(url.origin,'http://127.0.0.1:53988','No external or write-capable route')
      assert.equal(url.pathname,'/functions/v1/client-onboarding')
      if(request.method()==='GET'){
        if(successfulAttachment&&url.searchParams.get('purpose')==='download'){
          assert.equal(request.headers().referer,undefined,'The real attachment request must not disclose the portal URL')
          return route.fulfill({status:200,contentType:'application/pdf',headers:{'content-disposition':'attachment; filename="reviewed-final.pdf"'},body:attachmentBytes})
        }
        return route.fulfill({status:410,contentType:'text/plain',body:'Synthetic expired media grant'})
      }
      const body=request.postDataJSON();reads.push(body)
      assert.equal(body.clientId,clientId)
      if(body.action==='staff_preview_portal_library_access'){
        if(body.purpose==='thumbnail')return route.fulfill({json:{ok:false,error:'Synthetic thumbnail unavailable'}})
        assert.ok(['inline','download','stream'].includes(body.purpose))
        if(accessMode==='invalid')return route.fulfill({json:{ok:true,data:{url:'https://foreign.example/private',expiresAt:new Date(Date.now()+300000).toISOString()}}})
        if(accessMode==='slow')await new Promise(resolve=>setTimeout(resolve,6000))
        if(accessMode==='held')await new Promise(resolve=>{releaseAccess=resolve})
        const expires=Math.floor(Date.now()/1000)+300
        return route.fulfill({json:{ok:true,data:{url:`http://127.0.0.1:53988/functions/v1/client-onboarding?asset=${body.assetId}&purpose=${body.purpose}&expires=${expires}&signature=${'a'.repeat(64)}`,expiresAt:new Date(expires*1000).toISOString()}}})
      }
      assert.equal(body.action,'staff_preview_portal_library_month','Only existing read actions')
      if(body.category==='brand_identity'&&brandFailure)return route.fulfill({status:503,json:{ok:false,error:'Synthetic unavailable'}})
      if(body.category==='graphic_design'&&malformed)return route.fulfill({json:{ok:true,data:{assets:null,nextOffset:null}}})
      if(body.category==='graphic_design'&&holdMonth)await new Promise(resolve=>{releaseMonth=resolve})
      const video=body.category==='video'
      return route.fulfill({json:{ok:true,data:{assets:[{id:video?'33333333-3333-4333-8333-333333333333':'22222222-2222-4222-8222-222222222222',category:body.category,displayName:video?'Reviewed final video':'Reviewed final PDF',mimeType:video?'video/mp4':'application/pdf',sizeBytes:null,publishedAt:'2026-10-01T12:00:00Z',deliverableTitle:body.category==='graphic_design'?'Exact linked poster':null,planMonth:body.category==='graphic_design'?'2026-10':null}],nextOffset:null}}})
    })
    await page.goto('http://127.0.0.1:53987/__library')
    const brand=page.locator('article').filter({has:page.getByRole('heading',{name:'Brand Identity',exact:true})})
    await brand.getByRole('button',{name:'View files',exact:true}).click()
    await brand.getByRole('alert').waitFor()
    assert.equal(await brand.getByText('No files in this section yet.',{exact:true}).count(),0)
    brandFailure=false
    await brand.getByRole('button',{name:'View files',exact:true}).click()
    await brand.getByText('Reviewed final PDF',{exact:true}).waitFor()
    assert.equal(await brand.getByRole('alert').count(),0)
    const design=page.locator('article').filter({has:page.getByRole('heading',{name:'Graphic Design',exact:true})})
    await design.getByRole('button',{name:'2026 (1)',exact:true}).click()
    assert.equal(await design.getByRole('button',{name:'2026 (1)',exact:true}).getAttribute('aria-pressed'),'true',`${width} Brand Hub announces selected year`)
    assert.equal(await design.getByRole('button',{name:'2025 (1)',exact:true}).getAttribute('aria-pressed'),'false')
    await design.getByRole('group',{name:'Year',exact:true}).waitFor()
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    assert.equal(await design.getByRole('button',{name:'October (1)',exact:true}).getAttribute('aria-pressed'),'true','Brand Hub announces selected month')
    await design.getByRole('group',{name:'Month',exact:true}).waitFor()
    await design.getByRole('alert').waitFor()
    assert.equal(await design.getByText('No files in this section yet.',{exact:true}).count(),0)
    malformed=false
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    await design.getByText('Reviewed final PDF',{exact:true}).waitFor()
    const target=new URL(await design.getByRole('link',{name:'View in Plan',exact:true}).getAttribute('href'),'http://127.0.0.1:53987')
    assert.equal(target.searchParams.get('client'),clientId);assert.equal(target.searchParams.get('tab'),'calendar');assert.equal(target.searchParams.get('month'),'2026-10')
    assert.equal(target.pathname,'/admin/client-portal-preview')
    await design.getByRole('button',{name:'View',exact:true}).click()
    await design.getByRole('alert').waitFor()
    assert.deepEqual(await page.evaluate(()=>window.fixtureOpened),[],'Malformed access must never open a file')
    assert.equal(page.context().pages().length,1,'Malformed grants close the reserved blank window')
    const readsBeforeBlocked=reads.length
    await page.evaluate(()=>{window.fixtureNativeOpen=window.open;window.open=()=>null})
    await design.getByRole('button',{name:'View',exact:true}).click()
    await design.getByText('Allow file windows for CG Dynamics, then try again.',{exact:true}).waitFor()
    assert.equal(reads.length,readsBeforeBlocked,'A blocked window must not request an unused grant')
    assert.equal(page.context().pages().length,1)
    await page.evaluate(()=>{window.open=window.fixtureNativeOpen;delete window.fixtureNativeOpen})
    accessMode='slow'
    await page.evaluate(()=>{window.fixtureNavigate=true})
    const [viewTab]=await Promise.all([page.context().waitForEvent('page',{timeout:10000}),design.getByRole('button',{name:'View',exact:true}).click()])
    assert.equal(await viewTab.evaluate(()=>window.opener===null),true,'Reserved windows detach the opener before authorisation completes')
    assert.equal(await viewTab.locator('meta[name="referrer"]').getAttribute('content'),'no-referrer')
    await viewTab.getByText('Synthetic expired media grant',{exact:true}).waitFor()
    assert.equal(await viewTab.evaluate(()=>window.opener===null),true,'View must isolate the file window from the authenticated portal')
    assert.equal(await viewTab.evaluate(()=>document.referrer),'','View must not send the client portal URL as a referrer')
    assert.equal(page.url(),'http://127.0.0.1:53987/__library','View keeps the exact portal window open')
    await viewTab.close()
    accessMode='valid'
    await page.waitForFunction(()=>window.fixtureOpened.length===1)
    const opened=new URL((await page.evaluate(()=>window.fixtureOpened))[0])
    assert.equal(opened.origin,'http://127.0.0.1:53988');assert.equal(opened.searchParams.get('asset'),'22222222-2222-4222-8222-222222222222');assert.equal(opened.searchParams.get('purpose'),'inline')
    const [downloadTab]=await Promise.all([page.context().waitForEvent('page'),design.getByRole('button',{name:'Download',exact:true}).click()])
    await downloadTab.getByText('Synthetic expired media grant',{exact:true}).waitFor()
    assert.equal(await downloadTab.evaluate(()=>window.opener===null),true,'Download errors must not retain access to the authenticated portal window')
    assert.equal(await downloadTab.evaluate(()=>document.referrer),'','Download must not send the client portal URL as a referrer')
    assert.equal(page.url(),'http://127.0.0.1:53987/__library','Expired download never replaces the portal')
    await downloadTab.close()
    await page.evaluate(()=>{window.fixtureNavigate=false})
    await page.waitForFunction(()=>window.fixtureOpened.length===2)
    const download=new URL((await page.evaluate(()=>window.fixtureOpened))[1])
    assert.equal(download.searchParams.get('purpose'),'download')
    const downloadAttributes=(await page.evaluate(()=>window.fixtureOpenedAttributes))[1]
    const accessFailures=[]
    if(downloadAttributes.target!=='_self'||downloadAttributes.rel!=='noopener noreferrer')accessFailures.push('Download must navigate only its reserved window without a referrer')
    successfulAttachment=true;accessMode='slow'
    await page.evaluate(()=>{window.fixtureNavigate=true})
    const [attachmentTab]=await Promise.all([page.context().waitForEvent('page'),design.getByRole('button',{name:'Download',exact:true}).click()])
    const attachment=await attachmentTab.waitForEvent('download',{timeout:15000})
    assert.equal(attachment.suggestedFilename(),'reviewed-final.pdf')
    assert.deepEqual(await readFile(await attachment.path()),attachmentBytes,'A real browser download preserves the exact fixture bytes')
    assert.equal(page.url(),'http://127.0.0.1:53987/__library','Successful attachment download keeps the portal open')
    await attachmentTab.close()
    successfulAttachment=false;accessMode='valid'
    await page.evaluate(()=>{window.fixtureNavigate=false})
    const video=page.locator('article').filter({has:page.getByRole('heading',{name:'Video',exact:true})})
    await video.getByRole('button',{name:'2026 (1)',exact:true}).click()
    await video.getByRole('button',{name:'October (1)',exact:true}).click()
    await video.getByText('Reviewed final video',{exact:true}).waitFor()
    const mediaFailure=page.waitForResponse(response=>response.url().includes('purpose=stream')&&response.status()===410)
    await video.getByRole('button',{name:'Play',exact:true}).click()
    await mediaFailure
    await page.waitForFunction(()=>!document.querySelector('video')||document.querySelector('video').error)
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    if(await video.locator('video').count()||!await video.getByRole('alert').count())accessFailures.push('Expired or failed video stays in a broken player with no recovery message')
    assert.deepEqual(accessFailures,[])
    const streamCount=reads.filter(r=>r.action==='staff_preview_portal_library_access'&&r.purpose==='stream').length
    const retryFailure=page.waitForResponse(response=>response.url().includes('purpose=stream')&&response.status()===410)
    await video.getByRole('button',{name:'Play',exact:true}).click()
    await retryFailure
    await video.getByRole('alert').waitFor()
    assert.equal(reads.filter(r=>r.action==='staff_preview_portal_library_access'&&r.purpose==='stream').length,streamCount+1,'Only an explicit Play retries the grant')
    accessMode='held';releaseAccess=undefined
    const [closedTab]=await Promise.all([page.context().waitForEvent('page'),design.getByRole('button',{name:'View',exact:true}).click()])
    for(let tick=0;!releaseAccess&&tick<100;tick++)await new Promise(resolve=>setTimeout(resolve,10))
    assert.ok(releaseAccess,'Closed-window request held')
    await closedTab.close()
    const closedResponse=page.waitForResponse(response=>response.url().includes('/functions/v1/client-onboarding'))
    releaseAccess();await closedResponse
    await design.getByText('The file window was closed. Tap View or Download to try again.',{exact:true}).waitFor()
    assert.equal(page.context().pages().length,1,'Closing a pending window must not trigger a replacement popup')
    accessMode='valid';releaseAccess=undefined
    await page.evaluate(()=>{window.fixtureOpened=[]})
    holdMonth=true
    const monthRequest=page.waitForRequest(request=>request.url().includes('/functions/v1/client-onboarding')&&request.postDataJSON()?.action==='staff_preview_portal_library_month')
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    await monthRequest
    // Abandon a pending 2026 read without immediately choosing a new month.
    await design.getByRole('button',{name:'2025 (1)',exact:true}).click()
    assert.equal(await design.getByRole('button',{name:'2025 (1)',exact:true}).getAttribute('aria-pressed'),'true')
    assert.equal(await design.getByRole('button',{name:'2026 (1)',exact:true}).getAttribute('aria-pressed'),'false')
    assert.equal(await design.getByRole('button',{name:'September (1)',exact:true}).getAttribute('aria-pressed'),'false','Changing year clears selected month')
    assert.equal(await design.getByRole('status').count(),0,'A newly selected year must not inherit the abandoned month spinner')
    assert.equal(await design.getByText('Reviewed final PDF',{exact:true}).count(),0)
    await design.getByRole('button',{name:'September (1)',exact:true}).waitFor()
    const monthResponse=page.waitForResponse(response=>response.url().includes('/functions/v1/client-onboarding'))
    assert.ok(releaseMonth,'Old month request held')
    releaseMonth();await monthResponse
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    assert.equal(await design.getByRole('status').count(),0)
    assert.equal(await design.getByText('Reviewed final PDF',{exact:true}).count(),0,'A late response must not populate the new year')
    holdMonth=false
    await design.getByRole('button',{name:'2026 (1)',exact:true}).click()
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    await design.getByText('Reviewed final PDF',{exact:true}).waitFor()
    await page.screenshot({path:join(tmpdir(),`cg-library-${width}.png`),fullPage:true})
    accessMode='held'
    await design.getByRole('button',{name:'View',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('button')!==null)
    for(let tick=0;!releaseAccess&&tick<100;tick++)await new Promise(resolve=>setTimeout(resolve,10))
    assert.ok(releaseAccess,'Access request held')
    await page.getByRole('button',{name:'Leave client files',exact:true}).click()
    await page.getByRole('heading',{name:'Different client scope',exact:true}).waitFor()
    assert.equal(page.context().pages().length,1,'Leaving the client closes its pending file window')
    const completed=page.waitForResponse(response=>response.url().includes('127.0.0.1:53988/functions/v1/client-onboarding'))
    releaseAccess();await completed
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,100)))
    assert.deepEqual(await page.evaluate(()=>window.fixtureOpened),[],'A departed client scope must not open a late file response')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} body overflow`)
    assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);assert.equal(reads.length,16,'Existing14 reads plus successful attachment and manually closed pending-window requests; blocked windows add none')
    await page.screenshot({path:join(tmpdir(),`cg-library-departed-${width}.png`),fullPage:true})
    console.log(`PASS ${width}px: slow View/Download survives normal popup blocking, actual attachment bytes/filename, isolated no-referrer windows, blocked/closed/abandoned-window recovery, portal retained, video retry, exact Calendar link, stale-response fences, read-only, no errors/overflow`)
    await page.close()
  }
}finally{if(browser)await browser.close();await server.close()}
