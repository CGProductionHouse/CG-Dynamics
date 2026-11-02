import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync, mkdirSync } from 'node:fs'

// Actual report page and CSS, synthetic published client projection only.
// No real session, database mutation, external media request or cloud operation.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const origin = 'http://127.0.0.1:53972'
// Optional read-only visual proof using CA's actual published public posts.
// Never used by canonical synthetic acceptance or by the production build.
const example = process.env.CG_POST_GALLERY_EXAMPLE ? JSON.parse(readFileSync(process.env.CG_POST_GALLERY_EXAMPLE,'utf8')) : null
const fixture = {
  name: 'post-gallery-fixture',
  resolveId(id) { if (id === 'virtual:post-gallery') return '\0virtual:post-gallery' },
  load(id) {
    if (id !== '\0virtual:post-gallery') return
    return `import React from 'react';import{createRoot}from'react-dom/client';import{ClientReportView}from'/src/pages/client/ClientReportView.tsx';import'/src/index.css';
      const caption='Supplying quality you can build on. From bulk timber and fibre cement boards to laminated beams and imported hardwoods. Full original caption with product details and a clear enquiry action.';
      const post=(id,value)=>({id,platform:'facebook',publish_time:'2026-10-26T12:00:00Z',post_type:'Photo',caption,
        permalink:'https://www.facebook.com/example/posts/'+id,image_url:location.search.includes('missing')?null:'https://scontent.example.fbcdn.net/'+id+'.jpg',
        impressions:null,reach:null,engagements:value,engagement_known_subtotal:value,
        engagement_definition_id:'facebook_direct_reactions_comments_shares_v1',engagement_definition_label:'Facebook direct reactions + comments + shares',
        engagement_coverage:{observed:3,required:3},engagement_completeness:'complete',excluded:false});
      const report={id:'synthetic-report',report_title:'Local visual acceptance',platform:null,status:'published',period_start:'2026-10-01',period_end:'2026-10-31',
        posts:${example ? JSON.stringify(example.map((item,index)=>({...item,id:'example-'+index,platform:'facebook',impressions:null,reach:null,engagement_known_subtotal:item.engagements,engagement_definition_id:'facebook_direct_reactions_comments_shares_v1',engagement_definition_label:'Facebook direct reactions + comments + shares',engagement_coverage:{observed:3,required:3},engagement_completeness:'complete',excluded:false}))) : "[post('one',95),post('two',83),post('three',69)]"}};
      createRoot(document.getElementById('root')).render(React.createElement('main',{className:'mx-auto max-w-6xl p-4 sm:p-8'},React.createElement(ClientReportView,
        {report,client:{name:'Visual acceptance fixture'},googleAds:null,googleAdsState:'unmapped'})));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__gallery')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:post-gallery"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-post-gallery-vite-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react','react-dom/client','react/jsx-dev-runtime'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53972, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  if (example) {
    const directory=process.env.CG_POST_GALLERY_VISUAL_DIR
    assert.ok(directory,'Explicit local screenshot directory required');mkdirSync(directory,{recursive:true})
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:1000}})
      await page.route('**/*',route=>{
        const url=new URL(route.request().url())
        assert.equal(route.request().method(),'GET','Read-only visual acceptance')
        assert.ok(url.origin===origin||url.protocol==='https:'&&url.hostname.endsWith('.fbcdn.net'),'Only local app/public Meta image reads')
        return route.continue()
      })
      await page.goto(origin+'/__gallery')
      await page.getByRole('tab',{name:'Facebook',exact:true}).click()
      const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Top performing content',exact:true})})
      await section.scrollIntoViewIfNeeded()
      await page.waitForFunction(()=>[...document.querySelectorAll('img[data-post-media]')].every(img=>img.complete),null,{timeout:15000})
      console.log(JSON.stringify({visual:'local Cape public-post preview',width,visibleImages:await section.locator('img[data-post-media]').count()}))
      await section.screenshot({path:join(directory,`cape-visual-posts-${width}.png`)})
      await page.close()
    }
  } else {
  for (const width of [1440,375,390,430]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin === origin) return route.continue()
      // PNG bytes are local synthetic image; no invented client creative.
      if (url.hostname === 'scontent.example.fbcdn.net') {
        assert.equal(route.request().headers().referer,undefined,'Provider media must not receive the portal URL')
        return page.url().includes('broken') ? route.fulfill({status:404,body:'Unavailable'}) : route.fulfill({ contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64') })
      }
      throw Error('External request forbidden: '+url.origin)
    })
    await page.goto(origin+'/__gallery')
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    const section = page.locator('section').filter({has:page.getByRole('heading',{name:'Top performing content',exact:true})})
    assert.equal(await section.locator('img[data-post-media]').count(),3,'Real post media must reach the report gallery')
    assert.equal(await section.locator('article').count(),3,'Each ranked post appears once')
    assert.equal(await section.getByRole('button',{name:'Read caption',exact:true}).count(),3)
    const first = section.locator('article').first()
    const enlarge=first.getByRole('button',{name:'Enlarge post image',exact:true})
    await enlarge.click()
    const preview=page.getByRole('dialog',{name:'Post image preview',exact:true})
    await preview.waitFor({state:'visible'})
    assert.equal(await preview.getByRole('img',{name:'Full-size post image',exact:true}).count(),1)
    await page.keyboard.press('Escape');await preview.waitFor({state:'hidden'})
    assert.equal(await enlarge.evaluate(element=>element===document.activeElement),true,'Image preview returns focus')
    const read = first.getByRole('button',{name:'Read caption',exact:true})
    await read.focus();await page.keyboard.press('Enter')
    assert.equal(await first.getByRole('button',{name:'Less caption',exact:true}).getAttribute('aria-expanded'),'true')
    assert.match(await first.innerText(),/Full original caption/)
    await first.getByRole('button',{name:'Less caption',exact:true}).click()
    for (const link of await section.getByRole('link').all()) {
      assert.equal(await link.getAttribute('target'),'_blank')
      assert.match(await link.getAttribute('rel'),/noopener/)
      assert.equal(await link.getAttribute('referrerpolicy'),'no-referrer')
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' overflow')
    await page.getByRole('tab',{name:'Overview',exact:true}).click()
    assert.equal(await page.locator('img[data-post-media]').count(),1,'Overview uses the same visual post component')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' Overview overflow')
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    await page.screenshot({path:join(tmpdir(),`cg-post-gallery-${width}.png`),fullPage:true})
    await page.goto(origin+'/__gallery?broken')
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    await page.getByText('Preview unavailable',{exact:true}).first().waitFor()
    assert.equal(await page.locator('img[data-post-media]').count(),0,'Expired provider image falls back, never a broken box')
    assert.equal(await page.getByRole('link',{name:'View on Facebook',exact:true}).count(),3,'Original post remains accessible')
    await page.goto(origin+'/__gallery?missing')
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    assert.equal(await page.locator('img[data-post-media]').count(),0)
    assert.ok(await page.getByText('Preview unavailable',{exact:true}).count()>0)
    assert.deepEqual(errors,[])
    await page.close()
  }
  console.log('PASS actual report post gallery: desktop,375,390,430; Overview, media, caption keyboard, links, expired/missing image fallback and no overflow')
  }
} finally { await browser?.close();await server.close() }
