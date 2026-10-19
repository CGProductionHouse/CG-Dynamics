import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual App/AuthProvider/guards/router/layout/pages and Supabase read SDK.
// Only the auth event adapter and loopback responses are synthetic. No tokens,
// browser profiles, production requests, mutations or provider calls are used.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Approved local Playwright required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientA='11111111-1111-4111-8111-111111111111',clientB='22222222-2222-4222-8222-222222222222'
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const values={professional_videos_per_month:1,reels_per_month:null,photo_posts_per_month:3,design_posters_per_month:3,animated_posters_per_month:null,campaign_management_included:null,monthly_campaign_budget:null,shoot_days_per_month:null,website_updates_per_month:null,other_agreed_deliverables:null,package_notes:null,package_exclusions:null}
const packageSettings={...values,verification:{status:'confirmed',version:2,confirmed_at:'2026-10-01T12:00:00Z',confirmed_by_profile_id:'synthetic-reviewer',evidence_note:'Synthetic acceptance only',source_references:['fixture:confirmed-package'],field_states:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value===null?'unknown':'known']))}}
const fixture={
  name:'actual-full-client-app',enforce:'pre',
  resolveId(id){if(id==='virtual:client-app')return '\0virtual:client-app'},
  transform(_code,id){
    if(id.replaceAll('\\','/').endsWith('/lib/supabase.ts'))return `import{createClient}from'@supabase/supabase-js';export const supabase=createClient('http://127.0.0.1:1','local-public-fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});let first=true;supabase.auth.getSession=async()=>{const value={data:{session:{user:{id:window.fixtureUserId}}},error:null};if(first&&window.fixtureDeferSession){first=false;return new Promise((resolve,reject)=>window.fixtureResolveSession=()=>window.fixtureRejectSession?reject(Error('Synthetic initial session failure')):resolve(value))}first=false;return value};supabase.auth.onAuthStateChange=callback=>{window.fixtureEmitAuth=(event,id)=>{window.fixtureUserId=id;callback(event,id?{user:{id}}:null)};return{data:{subscription:{unsubscribe(){}}}}};supabase.auth.signInWithPassword=async()=>{throw Error('Auth mutation forbidden')};supabase.auth.setSession=async()=>{throw Error('Session copying forbidden')};`
  },
  load(id){if(id==='\0virtual:client-app')return `import React from'react';import{createRoot}from'react-dom/client';import App from'/src/App.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(App));`},
  configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/client')&&!req.url?.startsWith('/admin')&&req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#030706"><div id="root"></div><script type="module" src="/@id/virtual:client-app"></script></body></html>')})},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-client-app-browser-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom','@supabase/supabase-js']},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:1'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-public-fixture')},server:{host:'127.0.0.1',port:53997,strictPort:true,hmr:false}})
const allowedRpcs=new Set(['client_published_reports','client_monthly_strategy','client_portal_visibility_contract_version','client_portal_month_ahead_posts_v2','client_portal_month_ahead_events','client_portal_published_content_guidelines','client_content_review_queue','website_lead_metrics','website_lead_inbox','website_lead_breakdown'])
let browser
try{
  await server.listen();browser=await chromium.launch({headless:true})
  for(const width of [375,390,430,1440])for(const scenario of ['journey','initial-session-race','initial-session-error','profile-recovery','profile-recovery-race']){
    const page=await browser.newPage({viewport:{width,height:900}})
    await page.clock.install({time:new Date('2026-10-18T08:00:00Z')})
    const errors=[],reads=[];let holdProfile=false,holdProfileId=null,resolveProfile=null,profileFailure=scenario.startsWith('profile-recovery')
    page.on('pageerror',e=>errors.push(e.message))
    await page.addInitScript(({userA,scenario})=>{window.fixtureUserId=userA;window.fixtureDocument='same-document';window.fixtureDeferSession=scenario.startsWith('initial-session');window.fixtureRejectSession=scenario==='initial-session-error'},{userA,scenario})
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url())
      if(url.origin==='http://127.0.0.1:53997')return route.continue()
      assert.equal(url.origin,'http://127.0.0.1:1','No external network')
      reads.push({path:url.pathname,search:url.search,method:req.method(),body:req.postData()})
      if(url.pathname==='/rest/v1/profiles'){
        assert.equal(req.method(),'GET');const id=url.searchParams.get('id')?.slice(3)
        assert.ok([userA,userB].includes(id))
        if(profileFailure)return route.fulfill({status:400,json:{message:'PRIVATE_PROFILE_DIAGNOSTIC',code:'XX000'}})
        if(holdProfile&&(holdProfileId===null||holdProfileId===id))await new Promise(resolve=>{resolveProfile=resolve})
        return route.fulfill({json:{id,full_name:'Synthetic client',role:'client',client_id:id===userA?clientA:clientB}})
      }
      if(url.pathname==='/rest/v1/clients'){
        assert.equal(req.method(),'GET');const id=url.searchParams.get('id')?.slice(3)
        assert.ok([clientA,clientB].includes(id),'Exact own client query')
        return route.fulfill({json:{id,name:id===clientA?'Synthetic client A':'Synthetic client B',active:true,logo_url:null,package_settings:packageSettings}})
      }
      if(url.pathname==='/functions/v1/client-onboarding'){
        assert.ok(['portal_load','portal_library_load'].includes(req.postDataJSON().action),'No file/mapping/upload writes')
        return route.fulfill({status:503,json:{ok:false,error:'Synthetic library unavailable'}})
      }
      const name=url.pathname.split('/').at(-1);assert.ok(url.pathname.startsWith('/rest/v1/rpc/')&&allowedRpcs.has(name),`Unexpected request ${url.pathname}`)
      const args=req.postDataJSON()
      if(name==='client_portal_visibility_contract_version')return route.fulfill({json:1})
      if(name.startsWith('client_portal_month_ahead')||name==='client_portal_published_content_guidelines'){
        if(scenario!=='journey')assert.ok([clientA,clientB].includes(args.p_client_id))
        else assert.equal(args.p_client_id,page.url().includes('switched=1')?clientB:clientA)
      }
      if(name==='website_lead_metrics'){
        assert.equal(args.p_client_id,null,'Normal-client reads remain server pinned')
        return route.fulfill({json:{clientId:null,state:'available',period:{from:args.p_from,to:args.p_to,timezone:'Africa/Johannesburg'},total:0,new:0,contacted:0,qualified:0,won:0,closedLost:0,lost:0,good:0,poor:0,unreviewed:0,qualificationRate:null}})
      }
      if(name==='website_lead_inbox')assert.equal(args.p_client_id,null)
      if(name==='client_monthly_strategy')assert.match(args.p_strategy_month,/^2026-(10|11)-01$/)
      return route.fulfill({json:[]})
    })
    const nav=()=>page.getByRole('navigation',{name:width<640?'Client portal mobile':'Client portal',exact:true})
    if(scenario.startsWith('profile-recovery')){
      await page.goto('http://127.0.0.1:53997/client')
      await page.waitForFunction(()=>document.body.innerText.includes('profile'))
      assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE_PROFILE_DIAGNOSTIC/,'Client profile failures do not expose backend diagnostics')
      assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),1,'Initial profile failure has read recovery')
      if(width===375&&scenario==='profile-recovery')await page.screenshot({path:join(tmpdir(),'cg-last-local-profile-recovery-375.png'),fullPage:true})
      profileFailure=false
      if(scenario==='profile-recovery-race'){holdProfile=true;holdProfileId=userA}
      await page.getByRole('button',{name:'Try again',exact:true}).click()
      if(scenario==='profile-recovery-race'){
        for(let attempt=0;attempt<100&&!resolveProfile;attempt++)await page.waitForTimeout(10)
        assert.ok(resolveProfile,'Explicit profile retry is pending')
        await page.evaluate(userB=>window.fixtureEmitAuth('SIGNED_IN',userB),userB)
        await page.getByRole('heading',{name:'Synthetic client B',exact:true}).waitFor()
        holdProfile=false;resolveProfile()
        await page.waitForTimeout(100)
        assert.equal(await page.getByRole('heading',{name:'Synthetic client B',exact:true}).count(),1,'Late retry cannot replace a new identity')
      }else await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
      assert.equal(reads.filter(r=>r.path==='/rest/v1/profiles').length,scenario==='profile-recovery-race'?3:2,'Only expected exact-user reads')
      assert.equal(await page.evaluate(()=>window.fixtureDocument),'same-document')
      assert.deepEqual(errors,[])
      console.log(`PASS actual App ${scenario} ${width}px`);await page.close();continue
    }
    if(scenario.startsWith('initial-session')){
      await page.goto('http://127.0.0.1:53997/client')
      await page.waitForFunction(()=>typeof window.fixtureResolveSession==='function'&&typeof window.fixtureEmitAuth==='function')
      await page.evaluate(userB=>window.fixtureEmitAuth('SIGNED_IN',userB),userB)
      await page.getByRole('heading',{name:'Synthetic client B',exact:true}).waitFor()
      const profilesBefore=reads.filter(r=>r.path==='/rest/v1/profiles').length
      await page.evaluate(()=>window.fixtureResolveSession())
      await page.waitForTimeout(100)
      assert.equal(await page.getByRole('heading',{name:'Synthetic client B',exact:true}).count(),1,'Late initial session cannot replace a newer authenticated identity')
      assert.equal(reads.filter(r=>r.path==='/rest/v1/profiles').length,profilesBefore,'Stale initial session must not start another profile read')
      assert.deepEqual(errors,[])
      console.log(`PASS actual App ${scenario} ordering ${width}px`);await page.close();continue
    }
    async function navigate(label){
      if(width<640&&['Leads','Brand Hub'].includes(label)){
        await nav().getByRole('button',{name:'More pages',exact:true}).click()
        await page.getByRole('navigation',{name:'More client pages',exact:true}).getByRole('link',{name:label,exact:true}).click()
      }else await nav().getByRole('link',{name:label,exact:true}).click()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${label} overflow`)
    }
    await page.goto(`http://127.0.0.1:53997/client?client=${clientB}`)
    await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
    if(width===375)await page.screenshot({path:join(tmpdir(),'cg-last-local-full-app-overview-375.png'),fullPage:true})
    assert.doesNotMatch(await page.locator('main').innerText(),/To confirm|Connect|Add .*package/)
    await navigate('Plan')
    await page.getByRole('heading',{name:'Your plan',exact:true}).waitFor()
    await page.getByRole('button',{name:'November 2026',exact:true}).click()
    await page.getByRole('tabpanel',{name:'Strategy',exact:true}).getByText('November 2026',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'September 2026',exact:true}).count(),0)
    for(const tab of ['Calendar','Content Guidelines','Your package']){
      await page.getByRole('tab',{name:tab,exact:true}).click()
      await page.getByRole('tabpanel',{name:tab,exact:true}).waitFor()
    }
    await page.getByRole('heading',{name:'What we create together',exact:true}).waitFor()
    assert.equal(await page.getByText('6 per month',{exact:true}).count(),1)
    assert.doesNotMatch(await page.locator('main').innerText(),/To confirm|Shoot days|Reels/)
    await page.getByText('Amend package',{exact:false}).click()
    const whatsapp=page.getByRole('link',{name:'WhatsApp Amonique',exact:true})
    assert.equal(await whatsapp.getAttribute('href'),'https://wa.me/27791152339');assert.equal(await whatsapp.getAttribute('target'),'_blank')
    assert.equal(await page.getByRole('link',{name:'Call Amonique',exact:true}).getAttribute('href'),'tel:+27791152339')
    const packageReads=reads.length,packageUrl=page.url()
    for(const event of ['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'])await page.evaluate(({event,userA})=>window.fixtureEmitAuth(event,userA),{event,userA})
    await page.waitForTimeout(50)
    assert.equal(await whatsapp.isVisible(),true,'Same-user refresh preserves an open disclosure, not merely its text')
    assert.equal(page.url(),packageUrl);assert.equal(reads.length,packageReads,'No same-user refresh reads')
    if(width<640){
      const lastValue=page.getByText('6 per month',{exact:true})
      await lastValue.evaluate(element=>element.scrollIntoView({block:'center'}))
      const valueBox=await lastValue.boundingBox(),navBox=await nav().boundingBox()
      assert.ok(valueBox&&navBox&&valueBox.y+valueBox.height<=navBox.y,'Last package value can scroll clear of the fixed phone navigation')
    }
    if(width===375)await page.screenshot({path:join(tmpdir(),'cg-last-local-full-app-package-375.png'),fullPage:true})
    await navigate('Performance');await page.getByRole('heading',{name:'No published report yet',exact:true}).waitFor()
    await navigate('Approvals');await page.getByRole('heading',{name:'You’re up to date',exact:true}).waitFor()
    await navigate('Leads');await page.getByRole('heading',{name:'Leads',exact:true}).waitFor()
    await navigate('Brand Hub');await page.getByRole('heading',{name:'Brand Hub is not available yet',exact:true}).waitFor()
    await navigate('Overview');await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
    await page.goto('http://127.0.0.1:53997/admin/users')
    await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
    assert.equal(new URL(page.url()).pathname,'/client','Client cannot open a staff route')
    await page.goto(`http://127.0.0.1:53997/admin/client-portal-preview?client=${clientB}&area=plan`)
    await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
    assert.equal(new URL(page.url()).pathname,'/client','Client cannot use manager preview to select another client')
    for(const [legacy,tab,requested,canonical]of [['strategy','Strategy','2026-09','2026-10'],['content-calendar','Calendar','2026-11','2026-11'],['content-guides','Content Guidelines','2026-11','2026-11']]){
      await page.goto(`http://127.0.0.1:53997/client/${legacy}?month=${requested}&marker=keep-me`)
      await page.getByRole('tab',{name:tab,exact:true}).waitFor()
      await page.waitForFunction(({canonical})=>location.pathname==='/client/plan'&&new URLSearchParams(location.search).get('month')===canonical,{canonical})
      assert.equal(new URL(page.url()).searchParams.get('marker'),'keep-me','Legacy navigation preserves unrelated context')
      assert.equal(await page.getByRole('tab',{name:tab,exact:true}).getAttribute('aria-selected'),'true')
    }
    await navigate('Overview');await page.getByRole('heading',{name:'Synthetic client A',exact:true}).waitFor()
    const profilesBefore=reads.filter(r=>r.path==='/rest/v1/profiles').length
    await page.evaluate(userA=>window.fixtureEmitAuth('TOKEN_REFRESHED',userA),userA)
    await page.waitForTimeout(50)
    assert.equal(reads.filter(r=>r.path==='/rest/v1/profiles').length,profilesBefore,'Same-user refresh does not refetch/unmount')
    assert.equal(await page.getByRole('heading',{name:'Synthetic client A',exact:true}).count(),1)
    holdProfile=true
    await page.evaluate(userB=>window.fixtureEmitAuth('SIGNED_IN',userB),userB)
    await page.waitForFunction(()=>window.fixtureUserId==='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    for(let attempt=0;attempt<100&&!resolveProfile;attempt++)await page.waitForTimeout(10)
    assert.ok(resolveProfile,'Second profile read is pending')
    await page.waitForTimeout(50)
    assert.equal(await page.getByRole('heading',{name:'Synthetic client A',exact:true}).count(),0,'Different authenticated user must not retain old client content while the new profile is pending')
    if(width===375)await page.screenshot({path:join(tmpdir(),'cg-last-local-full-app-identity-loading-375.png'),fullPage:true})
    await page.evaluate(()=>history.replaceState(history.state,'','/client?switched=1'))
    holdProfile=false;resolveProfile()
    await page.getByRole('heading',{name:'Synthetic client B',exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{name:'Synthetic client A',exact:true}).count(),0)
    await page.evaluate(()=>window.fixtureEmitAuth('SIGNED_OUT',null))
    await page.waitForURL('**/login')
    assert.equal(await page.getByRole('heading',{name:'Synthetic client B',exact:true}).count(),0,'Sign-out drops client content')
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    console.log(`PASS actual full App client journey and identity transition ${width}px; ${reads.length} allowlisted synthetic reads`)
    await page.close()
  }
}finally{await browser?.close();await server.close()}
