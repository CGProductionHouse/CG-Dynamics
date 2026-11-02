import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual report/strategy pages and CSS. Synthetic mutations only; all network
// outside this disposable localhost fixture is blocked. No production session.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientA = '11111111-1111-4111-8111-111111111111'
const clientB = '22222222-2222-4222-8222-222222222222'
const origin = 'http://127.0.0.1:53971'
const fixture = {
  name: 'client-publication-confirmation', enforce: 'pre',
  resolveId(id) { if (id.startsWith('virtual:publication-')) return '\0' + id },
  transform(code, id) {
    if (!/\/pages\/admin\/(PublishedPreview|MonthlyStrategyPage)\.tsx$/.test(id.replaceAll('\\', '/'))) return
    return code.replace(/from '(\.\.\/\.\.\/[^']+)'/g, (match, path) =>
      path.endsWith('/PublicationConfirmation') ? match : "from 'virtual:publication-data'")
  },
  load(id) {
    if (id === '\0virtual:publication-entry') return `
      import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
      import Report from'/src/pages/admin/PublishedPreview.tsx';import Strategy from'/src/pages/admin/MonthlyStrategyPage.tsx';import'/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(location.pathname.includes('monthly-strategy')?Strategy:Report)));`
    if (id !== '\0virtual:publication-data') return
    return `
      import React,{useSyncExternalStore}from'react';
      export{ActionButton}from'/src/components/ui/Buttons.tsx';
      export{StatusBadge}from'/src/components/ui/Badges.tsx';
      export{getReportMonthFromPeriod,monthDisplayLabel,previousReportMonth,selectMonthlyReports,isMonthComplete}from'/src/lib/reportPeriod.ts';
      export{businessMonthKey}from'/src/lib/businessTime.ts';
      export{ACTION_PLAN_LABELS,GOLD_STANDARD_FIELDS,assessGoldStandardStrategy,emptyStrategyData,readStrategyData}from'/src/lib/strategyEngine.ts';
      import{emptyStrategyData,GOLD_STANDARD_FIELDS}from'/src/lib/strategyEngine.ts';
      import{DEFAULT_OPTIONS}from'/src/lib/db/strategyOptions.ts';export{DEFAULT_OPTIONS};
      const clients=[{id:'${clientA}',name:'Fixture Timber',active:true},{id:'${clientB}',name:'Fixture Other Client',active:true}];
      const copy=x=>structuredClone(x);
      window.fixtureReports=clients.map((c,i)=>({id:'report-'+i,client_id:c.id,platform:null,status:'draft',period_start:window.fixtureCurrent?'2026-11-01':'2026-10-01',period_end:window.fixtureCurrent?'2026-11-30':'2026-10-31',report_title:c.name+' report',published_at:null,posts:[]}));
      window.fixtureWrites=[];window.fixtureVersion=5;window.fixtureStrategyStatus='approved';
      export function useAuth(){const role=useSyncExternalStore(cb=>{window.addEventListener('fixture-role',cb);return()=>window.removeEventListener('fixture-role',cb)},()=>window.fixtureRole,()=>window.fixtureRole);return{profile:{id:'fixture-admin',role}}}
      export{isStaffRole}from'/src/lib/roles.ts';
      export const listClients=async()=>({data:copy(clients),error:null});
      export const getClient=async id=>({data:copy(clients.find(c=>c.id===id)),error:null});
      export const listReports=async()=>({data:copy(window.fixtureReports),error:null});
      export const getReportWithPosts=async id=>window.fixtureReadFailure?({data:null,error:{message:'Synthetic read-back failure'}}):({data:copy(window.fixtureReports.find(r=>r.id===id)),error:null});
      async function write(value,apply){window.fixtureWrites.push(value);if(window.fixtureDefer)await new Promise(resolve=>{window.fixtureResolve=resolve});if(window.fixtureFail){window.fixtureFail=false;return{error:{message:'Synthetic write failure'}}}apply();return{error:null}}
      export const updateReportStatus=async(id,status)=>write({kind:'report',id,status},()=>{window.fixtureReports.find(r=>r.id===id).status=status});
      export const listManualMetricsForClientMonth=async()=>({data:[],error:null});
      export const loadGoogleAdsDashboard=async()=>({data:null,state:'no-activity',error:null});
      export const loadReportPlatformFacts=async()=>({facts:[],previousFacts:[],normalizedAttempted:true,error:null});
      export const loadReportFactHealth=async()=>({data:[],error:null});
      export const loadReportContentExclusions=async()=>({data:[],error:null});
      export const setReportContentExclusion=async()=>{throw Error('Unrelated mutation forbidden')};
      export const actionMonthForReport=()=>null;
      export const loadStaffSetupPreview=async()=>({data:null,error:null});
      export const ClientDashboardShell=({children})=>React.createElement('div',null,children);
      export const ClientReportView=()=>React.createElement('p',null,'Synthetic client projection');
      export const ClientMonthAhead=()=>null,ClientPackageSummary=()=>null,ClientSetupContent=()=>null;
      export const EmptyState=({title,message})=>React.createElement('p',null,title+' '+message);
      export const ClientContextReview=()=>null,GuidedStrategyEditor=()=>null;
      export const ClientPicker=({label})=>React.createElement('span',null,label);
      export const getMonthEvents=()=>[];
      export const listStrategyOptions=async()=>({byCategory:DEFAULT_OPTIONS,usingDefaults:true});
      export const readPackageAuthority=()=>({settings:{professional_videos_per_month:1,reels_per_month:0,photo_posts_per_month:0,design_posters_per_month:0,animated_posters_per_month:0,campaign_management_included:false}});
      export async function getMonthlyStrategy(clientId,month){const data=emptyStrategyData();for(const f of GOLD_STANDARD_FIELDS)data.goldStandard[f.key]='Show real timber and delivery preparation, testing a clearer specification and ordering prompt: '+f.label;data.strategyGoingForward='Show real timber products and compare specification-rich material enquiries.';return{error:null,data:{id:'strategy-'+clientId,client_id:clientId,strategy_month:month+'-01',workflow_status:window.fixtureStrategyStatus,version:window.fixtureVersion,strategy_data:data,internal_notes:'Preserve producer notes',seed_context:{source_coverage:{client_guide:'available'},sources:{previous_report_id:'source-report',deliverable_ids:[],client_calendar_event_ids:[],approved_client_context_update_ids:[]},intelligence_evidence:[{source_id:'fixture-guide'}]}}}}
      export const amendMonthlyStrategy=async()=>{throw Error('Draft amendment forbidden')};
      export const seedMonthlyStrategy=async()=>{throw Error('Strategy seed forbidden')};
      export const transitionMonthlyStrategy=async input=>write({kind:'strategy',...input},()=>{window.fixtureStrategyStatus=input.targetStatus;window.fixtureVersion++});`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/admin/')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:publication-entry"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()],
  cacheDir: join(tmpdir(), 'cg-publication-confirmation-cache'), optimizeDeps: { noDiscovery: true, include: ['react','react-dom/client','react/jsx-dev-runtime','react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53971, strictPort: true, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  for (const width of [375,390,430,1440]) for (const kind of ['report','strategy']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = [], nativeDialogs = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss() })
    await page.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'))
    await page.addInitScript(() => { window.fixtureRole='admin';window.fixtureFail=false;window.fixtureDefer=false })
    await page.route('**/*', route => { assert.equal(new URL(route.request().url()).origin,origin,'No external network');return route.continue() })
    const url=kind==='report'?`${origin}/admin/published?client=${clientA}&reportId=report-0`:`${origin}/admin/monthly-strategy?client=${clientA}&month=2026-11`
    await page.goto(url)
    if(kind==='report')await page.getByRole('button',{name:'Editor',exact:true}).click()
    const trigger=()=>page.getByRole('button',{name:kind==='report'?'Publish':'Publish to client',exact:true})
    try { await trigger().waitFor({timeout:8000}) } catch (error) { console.error(JSON.stringify({kind,errors,body:await page.locator('body').innerText()}));throw error }
    await trigger().click()
    const dialog=page.getByRole('dialog')
    assert.equal(await dialog.count(),1,'Publication needs an in-app confirmation, not a browser-native prompt')
    await dialog.waitFor({state:'visible'})
    assert.match(await dialog.innerText(),/Fixture Timber/)
    assert.match(await dialog.innerText(),kind==='report'?/October 2026/:/November 2026/)
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Opening a confirmation never writes')
    assert.deepEqual(nativeDialogs,[],'No native JavaScript dialog')
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Escape is cancel, never publication')
    assert.equal(await trigger().evaluate(el=>el===document.activeElement),true,'Return focus to the original action')
    await trigger().click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Cancel never writes')
    await trigger().click()
    await page.evaluate(()=>{window.fixtureRole='client';window.dispatchEvent(new Event('fixture-role'))})
    await dialog.waitFor({state:'hidden'})
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Losing staff permission invalidates consent')
    await page.evaluate(()=>{window.fixtureRole='admin';window.dispatchEvent(new Event('fixture-role'))})
    await trigger().click()
    if(kind==='report') {
      await page.getByRole('combobox',{name:'Client',exact:true}).selectOption(clientB,{force:true})
      await dialog.waitFor({state:'hidden'})
      assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Changing clients invalidates consent')
      // Drafts are deliberately not in the published-report picker. Reopen its exact deep link.
      await page.goto(url)
      await page.getByRole('button',{name:'Editor',exact:true}).click()
      await trigger().click()
      await page.getByRole('button',{name:'Client View',exact:true}).evaluate(button=>button.click())
      await dialog.waitFor({state:'hidden'})
      await page.getByRole('button',{name:'Editor',exact:true}).click()
    } else {
      await page.evaluate(clientId=>{history.pushState({},'',location.pathname+'?client='+clientId+'&month=2026-12');window.dispatchEvent(new PopStateEvent('popstate'))},clientB)
      await dialog.waitFor({state:'hidden'})
      await page.getByText('Fixture Other Client',{exact:true}).first().waitFor()
      await page.evaluate(clientId=>{history.pushState({},'',location.pathname+'?client='+clientId+'&month=2026-11');window.dispatchEvent(new PopStateEvent('popstate'))},clientA)
    }
    await trigger().waitFor()
    assert.equal(await dialog.count(),0,'Returning to an earlier scope never resurrects consent')
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[],'Switching clients never publishes either client')
    if(kind==='strategy') {
      const notes=page.getByPlaceholder('Internal only. Never included in the client projection.')
      await notes.fill('Unsaved staff correction')
      assert.equal(await trigger().isDisabled(),true,'Unsaved amendments still block publication')
      await notes.fill('Preserve producer notes')
    }
    await page.evaluate(()=>{window.fixtureFail=true})
    await trigger().click();await dialog.getByRole('button',{name:'Confirm publication',exact:true}).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(await dialog.isVisible(),true,'A rejected save is not successful publication')
    assert.equal(await page.evaluate(()=>window.fixtureWrites.length),1)
    await page.evaluate(()=>{window.fixtureDefer=true})
    await dialog.getByRole('button',{name:'Confirm publication',exact:true}).evaluate(button=>{button.click();button.click()})
    await page.waitForFunction(()=>typeof window.fixtureResolve==='function')
    assert.equal(await page.evaluate(()=>window.fixtureWrites.length),2,'One retry despite two rapid confirmations')
    assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true)
    await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true,'Cannot dismiss an uncertain in-flight save')
    await page.evaluate(()=>{window.fixtureResolve()})
    await dialog.waitFor({state:'hidden'})
    const writes=await page.evaluate(()=>window.fixtureWrites)
    if(kind==='report')assert.deepEqual(writes[1],{kind:'report',id:'report-0',status:'published'})
    else {assert.equal(writes[1].clientId,clientA);assert.equal(writes[1].month,'2026-11');assert.equal(writes[1].expectedVersion,5);assert.equal(writes[1].targetStatus,'published');assert.equal(writes[1].actorProfileId,'fixture-admin');assert.match(writes[1].idempotencyKey,/^[\da-f-]{36}$/)}
    assert.deepEqual(nativeDialogs,[])
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`)
    assert.deepEqual(errors,[])
    if(kind==='report') {
      const unpublish=page.getByRole('button',{name:'Unpublish',exact:true})
      await unpublish.click()
      assert.match(await dialog.innerText(),/Unpublish Fixture Timber/)
      assert.equal(await page.evaluate(()=>window.fixtureWrites.length),2,'Unpublish also needs explicit consent')
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.fixtureReports[0].status),'published')
    }
    console.log(`PASS ${kind} ${width}px: exact scope/role/edit gates, cancel/focus, failed-save retry, single-flight publication and no native prompts`)
    await page.close()
  }
  const uncertain=await browser.newPage()
  await uncertain.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'))
  await uncertain.addInitScript(()=>{window.fixtureRole='admin'})
  await uncertain.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,origin);return route.continue()})
  await uncertain.goto(`${origin}/admin/published?client=${clientA}&reportId=report-0`)
  await uncertain.getByRole('button',{name:'Editor',exact:true}).click()
  await uncertain.getByRole('button',{name:'Publish',exact:true}).click()
  await uncertain.evaluate(()=>{window.fixtureReadFailure=true})
  await uncertain.getByRole('button',{name:'Confirm publication',exact:true}).click()
  await uncertain.getByRole('dialog').getByRole('alert').waitFor()
  assert.equal(await uncertain.getByText('Dashboard published.',{exact:true}).count(),0,'No success without verified saved status')
  assert.equal(await uncertain.evaluate(()=>window.fixtureWrites.length),1)
  await uncertain.getByRole('button',{name:'Cancel',exact:true}).click()
  await uncertain.close()
  console.log('PASS failed report read-back stays uncertain instead of claiming publication')
  const current=await browser.newPage()
  current.on('dialog',()=>{throw Error('Native confirmation forbidden')})
  await current.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'))
  await current.addInitScript(()=>{window.fixtureRole='admin';window.fixtureCurrent=true})
  await current.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,origin);return route.continue()})
  await current.goto(`${origin}/admin/published?client=${clientA}&reportId=report-0`)
  await current.getByRole('button',{name:'Editor',exact:true}).click()
  await current.getByRole('button',{name:'Publish',exact:true}).click()
  await current.getByText('This month is still in progress. Publish the dashboard after month-end.',{exact:true}).waitFor()
  assert.deepEqual(await current.evaluate(()=>window.fixtureWrites),[])
  assert.equal(await current.getByRole('dialog').count(),0)
  await current.close()
  console.log('PASS current-month report stays private without a write or confirmation')
} finally { await browser?.close();await server.close() }
