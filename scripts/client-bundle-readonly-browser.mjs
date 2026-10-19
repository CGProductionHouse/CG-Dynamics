import assert from 'node:assert/strict'
import { preview } from 'vite'
import { readFileSync,readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

// Compiled local fixture bundle, real AuthProvider/SDK and real route chunks.
// Synthetic session is created inside a fresh isolated browser and never used
// outside loopback. No existing credentials, auth cookies or token files read.
if(!process.env.CG_PLAYWRIGHT_MODULE)throw Error('Approved local Playwright required')
const {chromium}=await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const chunks=readdirSync('dist/assets').filter(name=>name.endsWith('.js')).map(name=>readFileSync(`dist/assets/${name}`,'utf8'))
assert.ok(chunks.some(code=>code.includes('http://127.0.0.1:1')&&code.includes('local-public-fixture')),'Only an explicitly loopback fixture bundle may be tested')
assert.ok(chunks.some(code=>code.includes('client-schedule')),'Real application bundle required')
const client='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const allowed=new Set(['client_published_reports','client_monthly_strategy','client_portal_visibility_contract_version','client_portal_month_ahead_posts_v2','client_portal_month_ahead_events','client_portal_published_content_guidelines','client_content_review_queue','website_lead_metrics','website_lead_inbox','website_lead_breakdown'])
const server=await preview({configFile:false,preview:{host:'127.0.0.1',port:53998,strictPort:true,open:false}})
let browser
try{
  browser=await chromium.launch({headless:true})
  for(const width of [375,390,430,1440]){
    const page=await browser.newPage({viewport:{width,height:900}})
    await page.clock.install({time:new Date('2026-10-18T08:00:00Z')})
    const errors=[],reads=[];page.on('pageerror',error=>errors.push(error.message))
    await page.addInitScript(user=>{
      const encoded=value=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
      const expires=Math.floor(Date.now()/1000)+3600
      const token=encoded({alg:'HS256',typ:'JWT'})+'.'+encoded({sub:user,aud:'authenticated',role:'authenticated',exp:expires})+'.c3ludGhldGljLW9ubHk'
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'local-only-unused',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id:user,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-10-01T00:00:00Z'}}))
    },user)
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url())
      if(url.origin==='http://127.0.0.1:53998')return route.continue()
      // The built HTML references the existing font stylesheet. Fulfil it
      // locally rather than permitting any font-service network request.
      if(url.origin==='https://fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''})
      assert.equal(url.origin,'http://127.0.0.1:1','Never use the synthetic session outside loopback')
      reads.push({path:url.pathname,method:req.method()})
      if(url.pathname==='/auth/v1/user'){assert.equal(req.method(),'GET');return route.fulfill({json:{id:user,aud:'authenticated',role:'authenticated'}})}
      if(url.pathname==='/rest/v1/profiles'){
        assert.equal(req.method(),'GET');assert.equal(url.searchParams.get('id'),`eq.${user}`)
        return route.fulfill({json:{id:user,role:'client',client_id:client,full_name:'Synthetic bundle client'}})
      }
      if(url.pathname==='/rest/v1/clients'){
        assert.equal(req.method(),'GET');assert.equal(url.searchParams.get('id'),`eq.${client}`)
        return route.fulfill({json:{id:client,name:'Synthetic bundle client',active:true,logo_url:null,package_settings:null}})
      }
      if(url.pathname==='/functions/v1/client-onboarding'){
        assert.ok(['portal_load','portal_library_load'].includes(req.postDataJSON().action),'No mutations')
        return route.fulfill({status:503,json:{ok:false,error:'Synthetic unavailable library'}})
      }
      const name=url.pathname.split('/').at(-1)
      assert.ok(url.pathname.startsWith('/rest/v1/rpc/')&&allowed.has(name),`Unexpected request ${url.pathname}`)
      const args=req.postDataJSON()
      if(name==='client_portal_visibility_contract_version')return route.fulfill({json:1})
      if(name.startsWith('client_portal_month_ahead')||name==='client_portal_published_content_guidelines')assert.equal(args.p_client_id,client)
      if(name==='website_lead_metrics')return route.fulfill({json:{clientId:null,state:'available',period:{from:args.p_from,to:args.p_to,timezone:'Africa/Johannesburg'},total:0,new:0,contacted:0,qualified:0,won:0,closedLost:0,lost:0,good:0,poor:0,unreviewed:0,qualificationRate:null}})
      if(name==='website_lead_breakdown')return route.fulfill({status:404,json:{code:'PGRST202',message:'Synthetic unavailable breakdown'}})
      return route.fulfill({json:[]})
    })
    const nav=page.getByRole('navigation',{name:width<640?'Client portal mobile':'Client portal',exact:true})
    async function navigate(label){
      if(width<640&&['Leads','Brand Hub'].includes(label)){
        await nav.getByRole('button',{name:'More pages',exact:true}).click()
        await page.getByRole('navigation',{name:'More client pages',exact:true}).getByRole('link',{name:label,exact:true}).click()
      }else await nav.getByRole('link',{name:label,exact:true}).click()
    }
    await page.goto('http://127.0.0.1:53998/client')
    await page.getByRole('heading',{name:'Synthetic bundle client',exact:true}).waitFor()
    await navigate('Plan');await page.getByRole('heading',{name:'Your plan',exact:true}).waitFor()
    await page.getByRole('button',{name:'November 2026',exact:true}).click()
    for(const tab of ['Calendar','Content Guidelines','Your package']){
      await page.getByRole('tab',{name:tab,exact:true}).click()
      await page.getByRole('tabpanel',{name:tab,exact:true}).waitFor()
    }
    await navigate('Performance');await page.getByRole('heading',{name:'No published report yet',exact:true}).waitFor()
    await navigate('Approvals');await page.getByRole('heading',{name:'You’re up to date',exact:true}).waitFor()
    await navigate('Leads');await page.getByRole('heading',{name:'Leads',exact:true}).waitFor()
    await navigate('Brand Hub');await page.getByRole('heading',{name:'Brand Hub is not available yet',exact:true}).waitFor()
    const before=reads.filter(row=>row.path==='/functions/v1/client-onboarding').length
    // The old error heading remains mounted until React starts the retry.
    // Wait for both real SDK responses, not the already-visible old heading.
    const retried=['portal_load','portal_library_load'].map(action=>page.waitForResponse(response=>
      new URL(response.url()).pathname==='/functions/v1/client-onboarding'&&response.request().postDataJSON()?.action===action))
    await page.getByRole('button',{name:'Try again',exact:true}).click()
    assert.deepEqual((await Promise.all(retried)).map(response=>response.status()),[503,503])
    await page.getByRole('heading',{name:'Brand Hub is not available yet',exact:true}).waitFor()
    assert.equal(reads.filter(row=>row.path==='/functions/v1/client-onboarding').length,before+2,'Only the two canonical library/setup reads retry')
    assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    if(width===375)await page.screenshot({path:join(tmpdir(),'cg-final-local-compiled-brand-hub-375.png'),fullPage:true})
    console.log(`PASS compiled local App/SDK six-section journey ${width}px; ${reads.length} allowlisted reads`)
    await page.close()
  }
}finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve))}
