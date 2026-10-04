import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the existing approved Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId='11111111-1111-4111-8111-111111111111'
const fixture={name:'library-local-readonly',enforce:'pre',
  resolveId(id){if(id==='virtual:library-fixture')return '\0virtual:library-fixture'},
  load(id){if(id!=='\0virtual:library-fixture')return
    return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import{ClientPortalContext}from'/src/components/client/ClientPortalContext.ts';import{ClientPortalLibrary}from'/src/features/client-portal-library/ClientPortalLibrary.tsx';import'/src/index.css';
      const library={clientName:'Synthetic A',clientLogoUrl:null,available:true,categories:[{category:'brand_identity',fileCount:1,years:[]},{category:'graphic_design',fileCount:1,years:[{year:2026,fileCount:1,months:[{month:10,fileCount:1}]}]}]};
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(ClientPortalContext.Provider,{value:{client:{id:'${clientId}'},previewClientId:'${clientId}'}},React.createElement('main',{className:'mx-auto max-w-6xl p-4 sm:p-8'},React.createElement(ClientPortalLibrary,{library})))));`
  },
  configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__library')return next()
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:library-fixture"></script></body></html>')
  })},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-library-browser-cache'),
  optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:1'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-fixture-public-key')},
  server:{host:'127.0.0.1',port:53987,strictPort:true,hmr:false}})
let browser
try{
  await server.listen();browser=await chromium.launch({headless:true})
  for(const width of [1440,375,390,430]){
    const page=await browser.newPage({viewport:{width,height:1000}})
    const errors=[]; const reads=[]; let brandFailure=true;let malformed=true
    page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',async route=>{
      const request=route.request();const url=new URL(request.url())
      if(url.origin==='http://127.0.0.1:53987')return route.continue()
      assert.equal(url.href,'http://127.0.0.1:1/functions/v1/client-onboarding','No external or write-capable route')
      const body=request.postDataJSON();reads.push(body)
      assert.equal(body.action,'staff_preview_portal_library_month','Only existing read action')
      assert.equal(body.clientId,clientId)
      if(body.category==='brand_identity'&&brandFailure)return route.fulfill({status:503,json:{ok:false,error:'Synthetic unavailable'}})
      if(body.category==='graphic_design'&&malformed)return route.fulfill({json:{ok:true,data:{assets:null,nextOffset:null}}})
      return route.fulfill({json:{ok:true,data:{assets:[{id:'22222222-2222-4222-8222-222222222222',category:body.category,displayName:'Reviewed final PDF',mimeType:'application/pdf',sizeBytes:null,publishedAt:'2026-10-01T12:00:00Z',deliverableTitle:body.category==='graphic_design'?'Exact linked poster':null,planMonth:body.category==='graphic_design'?'2026-10':null}],nextOffset:null}}})
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
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    await design.getByRole('alert').waitFor()
    assert.equal(await design.getByText('No files in this section yet.',{exact:true}).count(),0)
    malformed=false
    await design.getByRole('button',{name:'October (1)',exact:true}).click()
    await design.getByText('Reviewed final PDF',{exact:true}).waitFor()
    const target=new URL(await design.getByRole('link',{name:'View in Plan',exact:true}).getAttribute('href'),'http://127.0.0.1:53987')
    assert.equal(target.searchParams.get('client'),clientId);assert.equal(target.searchParams.get('tab'),'calendar');assert.equal(target.searchParams.get('month'),'2026-10')
    assert.equal(target.pathname,'/admin/client-portal-preview')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} body overflow`)
    assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);assert.equal(reads.length,4)
    await page.screenshot({path:join(tmpdir(),`cg-library-${width}.png`),fullPage:true})
    console.log(`PASS ${width}px: flat/read-malformed errors explicit, retry succeeds, null size retained, exact-client Calendar link, four reads only, no runtime errors/body overflow`)
    await page.close()
  }
}finally{if(browser)await browser.close();await server.close()}
