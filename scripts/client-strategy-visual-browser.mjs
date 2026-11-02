import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Actual client reader/CSS. Synthetic read-only acceptance; optional owner-reviewed
// published text is local visual proof only. No real auth, API or external media.
const example = process.env.CG_STRATEGY_VISUAL_EXAMPLE ? JSON.parse(readFileSync(process.env.CG_STRATEGY_VISUAL_EXAMPLE, 'utf8')) : null
const origin = 'http://127.0.0.1:53973'
const fixture = {
  name: 'client-strategy-visual-fixture',
  resolveId(id) { if (id === 'virtual:strategy-visual') return '\0virtual:strategy-visual' },
  load(id) {
    if (id !== '\0virtual:strategy-visual') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{GuidedStrategyView}from'/src/components/strategy/GuidedStrategy.tsx';
      import{emptyStrategyData,GOLD_STANDARD_FIELDS}from'/src/lib/strategyEngine.ts';import'/src/index.css';
      const data=emptyStrategyData();
      for(const field of GOLD_STANDARD_FIELDS)data.goldStandard[field.key]='Exact '+field.key+' direction. Preserve the condition: verify the material before naming it, and do not promise delivery, stock or a price.';
      data.strategyGoingForward=data.goldStandard.coreMessage;
      data.actionPlan.photo_content={enabled:true,items:['Show the real timber load, with the product and quantity the buyer needs. Keep this complete condition: confirm its material and do not assume current availability.','Explain the actual board label and application.','Compare real product details.'],notes:'Preserve this exact source note.'};
      data.actionPlan.design_poster={enabled:true,items:['A material-list checklist with exact product, size and quantity.','A quote-readiness card.','A verified delivery enquiry prompt.','A board application question.'],notes:''};
      data.actionPlan.campaign_recommendation={enabled:true,items:['Review existing Google Ads search relevance; no campaign or spend changes.'],notes:''};
      data.actionPlan.professional_video={enabled:false,items:['CANCELLED VIDEO MUST STAY HIDDEN'],notes:''};
      const initial=${example ? JSON.stringify(example) : 'data'};
      function App(){const[scope,setScope]=useState(initial);return React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},
        React.createElement('header',{className:'mb-7 flex items-center justify-between gap-4 border-b border-white/10 pb-5'},React.createElement('div',null,React.createElement('p',{className:'text-xs font-bold uppercase tracking-widest text-report-accent'},'${example ? 'Cape Lumber · November 2026' : 'Local strategy acceptance'}'),React.createElement('h1',{className:'mt-2 text-3xl font-bold tracking-tight text-report-text'},'Your plan')),React.createElement('button',{onClick:()=>{const next=emptyStrategyData();next.strategyGoingForward='Exact client B direction.';next.actionPlan.campaign_recommendation={enabled:true,items:['Exact client B campaign.'],notes:''};setScope(next)},className:'${example ? 'hidden' : 'min-h-11 rounded-xl border border-white/10 px-3 text-sm text-report-muted'}'},'Switch fixture client')),
        React.createElement(GuidedStrategyView,{data:scope,hideTopContent:true,variant:'report'}));}
      createRoot(document.getElementById('root')).render(React.createElement(App));`
  },
  configureServer(server) {
    server.middlewares.use((req,res,next)=>{
      if(!req.url?.startsWith('/__strategy'))return next()
      res.setHeader('Content-Type','text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#06110f"><div id="root"></div><script type="module" src="/@id/virtual:strategy-visual"></script></body></html>')
    })
  },
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-strategy-visual-cache'),
  optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime']},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:1'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-public-fixture')},
  server:{host:'127.0.0.1',port:53973,strictPort:true,hmr:false}})
let browser
try {
  await server.listen()
  if(process.argv.includes('--serve')) {
    console.log('Local visual only: '+origin+'/__strategy')
    await new Promise(()=>{})
  }
  assert.ok(process.env.CG_PLAYWRIGHT_MODULE,'Approved local Playwright module required')
  const{chromium}=await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
  browser=await chromium.launch({headless:true})
  const directory=process.env.CG_STRATEGY_VISUAL_DIR??join(tmpdir(),'cg-strategy-visual');mkdirSync(directory,{recursive:true})
  for(const width of [375,390,430,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000}})
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,origin,'No provider, credential or external media request');return route.continue()})
    await page.goto(origin+'/__strategy')
    await page.getByRole('heading',{name:'Monthly strategy',exact:true}).waitFor()
    const tabs=page.getByRole('tablist',{name:'Content formats'})
    assert.equal(await tabs.getByRole('tab').count(),3)
    assert.equal(await tabs.getByRole('tab',{name:/Videos|Reels/}).count(),0)
    assert.equal(await page.getByText('CANCELLED VIDEO MUST STAY HIDDEN',{exact:true}).count(),0)
    const photos=tabs.getByRole('tab',{name:/Photo posts.*3 ideas/})
    const posters=tabs.getByRole('tab',{name:/Posters.*4 ideas/})
    const campaigns=tabs.getByRole('tab',{name:/Campaigns.*1 focus/})
    await photos.waitFor();
    const goal=page.getByRole('region',{name:'Monthly strategy',exact:true}).locator('span.line-clamp-3').first();
    assert.ok(await goal.evaluate(el=>el.clientHeight<=parseFloat(getComputedStyle(el).lineHeight)*3+1),'Goal is physically limited to three lines, not just a computed clamp value');
    assert.equal(await photos.getAttribute('aria-selected'),'true')
    for(const tab of await tabs.getByRole('tab').all()) {
      const panel=page.locator('[role="tabpanel"]').filter({visible:true})
      assert.equal(await panel.count(),1)
      assert.equal(await page.locator('[role="tabpanel"]').evaluateAll((panels,id)=>panels.filter(p=>p.id===id).length,await tab.getAttribute('aria-controls')),1)
    }
    const idea=page.getByRole('tabpanel').filter({visible:true}).locator('details').first()
    const summary=idea.locator('summary')
    const preview=summary.locator('span.line-clamp-2')
    assert.equal(await preview.evaluate(el=>getComputedStyle(el).webkitLineClamp),'2');
    assert.ok(await preview.evaluate(el=>el.clientHeight<=parseFloat(getComputedStyle(el).lineHeight)*2+1),'Idea actually occupies at most two lines')
    await summary.click();assert.equal(await idea.getAttribute('open'),'')
    assert.equal(await preview.evaluate(el=>getComputedStyle(el).webkitLineClamp),'none','Full source conditions exposed')
    await summary.click()
    await photos.focus();await photos.press('ArrowRight')
    assert.equal(await posters.evaluate(el=>el===document.activeElement),true)
    assert.equal(await photos.getAttribute('aria-selected'),'true','Arrow focus does not activate')
    await posters.press('Enter');assert.equal(await posters.getAttribute('aria-selected'),'true')
    assert.equal(await page.getByRole('tabpanel').filter({visible:true}).locator('details').count(),4)
    await campaigns.click();assert.equal(await page.getByRole('tabpanel').filter({visible:true}).locator('details').count(),1)
    await photos.click()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px body overflow`)
    for(const tab of await tabs.getByRole('tab').all()){const box=await tab.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width)}
    await page.screenshot({path:join(directory,`strategy-${width}.png`),fullPage:true})
    if(!example){
      await page.getByText('Strategy details',{exact:true}).click()
      const audience=page.locator('details').filter({has:page.getByText('Who we’re reaching',{exact:true})}).last()
      assert.equal(await audience.getAttribute('open'),null)
      assert.equal(await audience.locator('span.line-clamp-3').evaluate(el=>getComputedStyle(el).webkitLineClamp),'3','Opening outer details does not unclip every nested brief')
    }
    if(!example){
    await page.getByRole('button',{name:'Switch fixture client'}).click()
    await page.getByText('Exact client B campaign.',{exact:true}).waitFor()
    assert.equal(await tabs.getByRole('tab').count(),1,'Stale selected format falls back to actual available format')
    assert.equal(await page.getByRole('tabpanel').count(),1)
    }
    assert.deepEqual(errors,[])
    console.log(`PASS client strategy visual ${width}px: compact/exact copy, disclosures, keyboard formats, no video, scope reset, no overflow/network/writes`)
    await page.close()
  }
} finally {await browser?.close();await server.close()}
