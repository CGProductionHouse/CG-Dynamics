import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Synthetic read-only fixtures; actual Plan and Guideline components. No auth
// copying, production project, provider request or mutation is permitted.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientA = '11111111-1111-4111-8111-111111111111'
const clientB = '22222222-2222-4222-8222-222222222222'
const fixture = {
  name: 'client-plan-readonly-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:plan-fixture') return '\0virtual:plan-fixture' },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:window.fixtureProfile}}'
  },
  load(id) {
    if (id !== '\0virtual:plan-fixture') return
    return `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{BrowserRouter}from'react-router-dom';import ClientPlanPage from'/src/pages/client/ClientPlanPage.tsx';
      import ClientContentCalendarPage from'/src/pages/client/ClientContentCalendarPage.tsx';
      import{ClientPortalContext}from'/src/components/client/ClientPortalContext.ts';import'/src/index.css';
      const initialClient=location.pathname.includes('standalone')?'${clientB}':'${clientA}';
      window.fixtureProfile={role:'client',client_id:initialClient};
      function App(){const[id,setId]=useState(initialClient);window.switchClient=()=>{window.fixtureProfile.client_id='${clientB}';setId('${clientB}')};
        return React.createElement(ClientPortalContext.Provider,{value:{client:{id,name:id==='${clientA}'?'Synthetic A':'Synthetic B'},previewClientId:id}},
          React.createElement('main',{className:'mx-auto max-w-6xl min-w-0 p-4 sm:p-8'},React.createElement(location.pathname.includes('standalone')?ClientContentCalendarPage:ClientPlanPage)));}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req,res,next)=>{
      if (!req.url?.startsWith('/__plan')) return next()
      res.setHeader('Content-Type','text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:plan-fixture"></script></body></html>')
    })
  },
}
const server = await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-plan-browser-cache'),
  optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:1'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-public-fixture')},
  server:{host:'127.0.0.1',port:53988,strictPort:true,hmr:false}})
let browser
try {
  await server.listen()
  browser=await chromium.launch({headless:true})
  for (const width of [1440,375,390,430]) {
    const page=await browser.newPage({viewport:{width,height:1000}})
    const errors=[]; const reads=[]; let scenario='valid'; let hold=false; let assetScenario='valid'; const pending=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',async route=>{
      const request=route.request(); const url=new URL(request.url())
      if (url.origin==='http://127.0.0.1:53988') return route.continue()
      assert.equal(url.origin,'http://127.0.0.1:1','No external network')
      if (url.pathname==='/rest/v1/clients') {
        assert.equal(request.method(),'GET','Client reads only')
        return route.fulfill({json:{id:url.searchParams.get('id')?.slice(3),name:'Synthetic client'}})
      }
      if (url.pathname==='/rest/v1/rpc/client_portal_visibility_contract_version') return route.fulfill({json:1})
      const payload=request.postDataJSON()
      if(url.pathname==='/rest/v1/rpc/client_portal_post_assets'){
        assert.equal(payload.p_client_id,clientB);assert.equal(payload.p_post_key,'post-aaaaaaaaaaaaaaaa');assert.match(payload.p_month,/^2027-0[23]-01$/)
        return route.fulfill({json:assetScenario==='malformed'?null:assetScenario==='empty'?[]:[{id:'33333333-3333-4333-8333-333333333333',category:'graphic_design',displayName:'Exact published final B',mimeType:'application/pdf',sizeBytes:null,publishedAt:'2026-10-01T12:00:00Z',deliverableTitle:'Planned poster B',planMonth:payload.p_month.slice(0,7)}]})
      }
      if (hold && url.pathname.includes('month_ahead')) await new Promise(resolve=>pending.push(resolve))
      if (url.pathname==='/rest/v1/rpc/client_portal_month_ahead_posts_v2') {
        assert.equal(payload.p_client_id,clientB)
        return route.fulfill({json:[{row_key:'post-aaaaaaaaaaaaaaaa',schedule_date:payload.p_month.slice(0,8)+'12',title:'Planned poster B',post_type:'dp',client_safe_status:'scheduled'}]})
      }
      if (url.pathname==='/rest/v1/rpc/client_portal_month_ahead_events') {
        assert.equal(payload.p_client_id,clientB)
        return route.fulfill({json:[{row_key:'synthetic-event',title:'Filming B',event_type:'content_run',start_time:payload.p_month.slice(0,8)+'12T08:00:00Z',end_time:null,all_day:false,location:null,guideline_row_key:'synthetic-guide'}]})
      }
      assert.equal(url.pathname,'/rest/v1/rpc/client_portal_published_content_guidelines','Only canonical client read RPCs')
      reads.push(payload)
      if (hold) await new Promise(resolve=>pending.push(resolve))
      const label=(payload.p_client_id===clientA?'A':'B')+' '+payload.p_month.slice(0,7)
      const videos=[{position:1,title:'Film',script:scenario==='missing_script'?null:'Complete script '+label+'\nSecond line',objective:null,hook:null,shot_breakdown:null,cta:null,visual_notes:null,platform:null,format:null}]
      await route.fulfill({json:scenario==='malformed'?null:scenario==='empty'?[]:[{row_key:'synthetic-guide',title:'Guide '+label,month:payload.p_month,run_name:'Synthetic run',filming_date:null,published_at:'2026-10-01T12:00:00Z',videos}]})
    })
    await page.goto('http://127.0.0.1:53988/__plan?tab=guidelines&month=2026-10')
    await page.getByText('Complete script A 2026-10\nSecond line',{exact:true}).waitFor()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} body overflow`)
    for (const tab of await page.getByRole('tab').all()) {
      const bounds=await tab.boundingBox()
      assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width,`${width} clipped Plan tab`)
      assert.ok(await tab.evaluate(element=>element.scrollWidth<=element.clientWidth),`${width} clipped tab text`)
    }
    await page.screenshot({path:join(tmpdir(),`cg-plan-${width}.png`),fullPage:true})
    hold=true
    await page.getByRole('button',{name:'Next month',exact:true}).click()
    // history changes before React commits; assert against the newly rendered
    // working-month label, not an intermediate URL-only navigation state.
    await page.getByText('November 2026',{exact:true}).waitFor()
    assert.equal(await page.getByText('Complete script A 2026-10\nSecond line',{exact:true}).count(),0,'Old month removed before new read')
    await page.waitForTimeout(100)
    hold=false; pending.splice(0).forEach(resolve=>resolve())
    await page.getByText('Complete script A 2026-11\nSecond line',{exact:true}).waitFor()
    hold=true
    await page.evaluate(()=>window.switchClient())
    await page.waitForFunction(()=>window.fixtureProfile.client_id==='22222222-2222-4222-8222-222222222222' && !document.body.textContent.includes('Complete script A 2026-11'))
    assert.equal(await page.getByText('Complete script A 2026-11\nSecond line',{exact:true}).count(),0,'Old client removed before new read')
    await page.waitForTimeout(100)
    hold=false; pending.splice(0).forEach(resolve=>resolve())
    await page.getByText('Complete script B 2026-11\nSecond line',{exact:true}).waitFor()
    scenario='malformed'
    await page.getByRole('button',{name:'Next month',exact:true}).click()
    await page.getByRole('heading',{name:'Content Guidelines could not be loaded'}).waitFor()
    assert.equal(await page.getByText(/No published Content Guidelines/).count(),0,'Failure not verified empty')
    scenario='empty'
    await page.getByRole('button',{name:'Next month',exact:true}).click()
    await page.getByText(/No published Content Guidelines are available for January 2027/).waitFor()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} empty layout overflow`)
    assert.equal(await page.locator('vite-error-overlay').count(),0)
    assert.deepEqual(errors,[])
    assert.equal(reads.length,5)
    scenario='missing_script'
    await page.getByRole('button',{name:'Next month',exact:true}).click()
    await page.getByText('A script is not available for this video.',{exact:true}).waitFor()
    assert.equal(await page.getByText('Complete script',{exact:true}).count(),0,'Missing script not labelled complete')
    scenario='valid'
    await page.getByRole('tab',{name:'Calendar',exact:true}).click()
    if (width<640) await page.getByRole('button',{name:'2027-02-12, 2 item(s)',exact:true}).click()
    const eventLink=page.getByRole('link',{name:'Open Content Guideline for Filming B'}).filter({visible:true})
    await eventLink.waitFor()
    await page.getByRole('button',{name:'View published files',exact:true}).filter({visible:true}).click()
    await page.getByText('Exact published final B',{exact:true}).filter({visible:true}).waitFor()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} calendar overflow`)
    await page.screenshot({path:join(tmpdir(),`cg-plan-calendar-${width}.png`),fullPage:true})
    const target=new URL(await eventLink.getAttribute('href'),'http://127.0.0.1:53988')
    assert.equal(target.searchParams.get('client'),clientB)
    assert.equal(target.searchParams.get('month'),'2027-02')
    assert.equal(target.searchParams.get('tab'),'guidelines')
    assert.equal(target.searchParams.get('guide'),'synthetic-guide')
    await eventLink.click()
    await page.getByText('Complete script B 2027-02\nSecond line',{exact:true}).waitFor()
    // Exercise the calendar without Plan's protective remount, holding both
    // reads while the visible month changes. Old posts must disappear at once.
    await page.goto('http://127.0.0.1:53988/__plan-standalone?month=2027-02')
    await page.evaluate(()=>window.switchClient())
    if(width<640) await page.getByRole('button',{name:'2027-02-12, 2 item(s)',exact:true}).click()
    await page.getByText('Planned poster B',{exact:true}).filter({visible:true}).waitFor()
    assetScenario='malformed'
    await page.getByRole('button',{name:'View published files',exact:true}).filter({visible:true}).click()
    await page.getByRole('alert').filter({visible:true}).waitFor()
    assert.equal(await page.getByText('No published file is linked to this post yet.',{exact:true}).count(),0,'Unavailable asset read must not become empty')
    assetScenario='empty'
    await page.getByRole('button',{name:'Try again',exact:true}).filter({visible:true}).click()
    await page.getByText('No published file is linked to this post yet.',{exact:true}).filter({visible:true}).waitFor()
    hold=true
    await page.getByRole('button',{name:'Next',exact:true}).click()
    await page.getByText('Upcoming deliverables and client-facing schedule details for March 2027.',{exact:true}).waitFor()
    assert.equal(await page.getByText('Planned poster B',{exact:true}).filter({visible:true}).count(),0,'Standalone calendar must not display old posts under a new month')
    await page.waitForTimeout(100)
    hold=false;pending.splice(0).forEach(resolve=>resolve())
    if(width<640) await page.getByRole('button',{name:'2027-03-12, 2 item(s)',exact:true}).click()
    await page.getByText('Planned poster B',{exact:true}).filter({visible:true}).waitFor()
    assert.deepEqual(errors,[])
    console.log(`PASS ${width}px: complete scripts, exact month/client transition fence, unavailable vs empty, visible tabs, calendar-to-guide exact scope, read-only network, no body overflow/runtime errors; screenshot ${join(tmpdir(),`cg-plan-${width}.png`)}`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
