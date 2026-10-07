import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual components and RPC helper, isolated auth + network fixtures. Never
// accesses a real provider, Supabase project, account or production client.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const dashboardMocks = {
  '../../components/client/ClientPortalContext': `export function useClientPortal(){return {client:{name:'Local client',id:window.fixtureProfile.client_id},previewClientId:null}}`,
  '../../components/client/ClientMonthAhead': `export function ClientMonthAhead(){return null}`,
  '../../lib/db/reports': `const report={id:'local-report',client_id:'fixture-a',report_title:'Local published report',status:'published',period_start:'2026-09-01',period_end:'2026-09-30',posts:[]};export async function listClientPublishedReports(){return {data:window.fixtureNoReports?[]:[report],error:null}};export async function getClientPublishedReportWithPosts(){return {data:report,error:null}}`,
  '../../lib/db/manualMetrics': `export async function listClientReportManualMetrics(){return {data:[],error:null}}`,
  '../../lib/googleAdsDashboard': `export async function loadGoogleAdsDashboard(){return {data:null,state:'unmapped',error:null}}`,
  '../../lib/db/reportingTruth': `export async function loadReportPlatformFacts(){return {facts:[],previousFacts:[],normalizedAttempted:true,error:null}}`,
  '../../lib/monthlyStrategy': `export async function getClientPublishedMonthlyStrategy(){return {data:null,error:null}}`,
  '../../lib/clientPortalPreview': `export async function getPreviewMetrics(){throw Error('Unexpected preview read')};export async function getPreviewReport(){throw Error('Unexpected preview read')};export async function getPreviewStrategy(){throw Error('Unexpected preview read')};export async function listPreviewReports(){throw Error('Unexpected preview read')}`,
}
const fixture = {
  name: '389-local-browser-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:389' || id.startsWith('virtual:389-dashboard:')) return `\0${id}` },
  transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/contexts/AuthContext.tsx')) return 'export function useAuth(){return {profile:window.fixtureProfile}}'
    if (id.replaceAll('\\', '/').endsWith('/pages/client/Dashboard.tsx')) {
      let code = _code
      for (const [path, index] of Object.keys(dashboardMocks).map((path,index)=>[path,index])) code = code.replaceAll(`'${path}'`,`'virtual:389-dashboard:${index}'`)
      return code
    }
  },
  load(id) {
    if (id.startsWith('\0virtual:389-dashboard:')) return Object.values(dashboardMocks)[Number(id.split(':').at(-1))]
    if (id !== '\0virtual:389') return
    return `import React,{useState} from 'react'; import{createRoot}from'react-dom/client';
      import{ClientServiceExpansion}from'/src/components/client/ClientServiceExpansion.tsx';
      import{ServiceEntitlementReview}from'/src/components/admin/ServiceEntitlementReview.tsx';
      import Dashboard from'/src/pages/client/Dashboard.tsx';
      import{BrowserRouter}from'react-router-dom'; import'/src/index.css';
      window.fixtureProfile={id:'fixture-a',client_id:'fixture-a',role:'client'};
      function App(){const [mode,setMode]=useState('performance'); const [client,setClient]=useState('fixture-a');
        window.switchFixture=(id)=>{window.fixtureProfile={id,client_id:id,role:'client'};setClient(id)};
        return React.createElement('main',{className:'mx-auto max-w-6xl p-5 sm:p-10'},
          React.createElement('nav',{className:'flex flex-wrap gap-4 text-white'},...['overview','performance','admin','dashboard'].map(m=>React.createElement('button',{key:m,onClick:()=>setMode(m)},m))),
          mode==='dashboard'?React.createElement(Dashboard):mode==='admin'?React.createElement(ServiceEntitlementReview,{clientId:client}):React.createElement(ClientServiceExpansion,{surface:mode}));}
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(App)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__389') return next()
      res.setHeader('Content-Type','text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@id/virtual:389"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [react(), fixture],
  cacheDir: join(tmpdir(), 'cg-389-browser-vite-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-fixture-public-key') },
  server: { host: '127.0.0.1', port: 53989, strictPort: true, hmr: false },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const keys = ['linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience']
  const states = ['not_included','included','not_applicable','included','unknown','not_included','included']
  for (const [name, width, height] of [['desktop',1440,1000],['mobile-375',375,844],['mobile-390',390,844],['mobile-430',430,900]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []; const requests = []; let failOnce = true; let receipt = null; let verifyPayload
    let scenario = 'mixed'; let releaseRead; let measurements = 0; let entitlementReads = 0
    page.on('pageerror', error => errors.push(error.message))
    await page.route('http://127.0.0.1:1/rest/v1/**', async route => {
      const url = route.request().url()
      const payload = route.request().postDataJSON()
      if (url.includes('/rpc/get_my_client_service_entitlements')) {
        entitlementReads += 1
        if (scenario === 'loading') await new Promise(resolve => { releaseRead = resolve })
        const failure = { missing_rpc: ['PGRST202',404], missing_schema: ['42P01',404], read_failure: ['XX000',503] }[scenario]
        if (failure) { await route.fulfill({ status: failure[1], json: { code: failure[0], message: 'Local rollout failure fixture' } }); return }
        if (scenario === 'malformed') { await route.fulfill({ json: [] }); return }
        const identity = await page.evaluate(() => window.fixtureProfile.client_id)
        const rows = keys.map((service_key,i) => ({ service_key, state: scenario === 'all_unknown' || identity !== 'fixture-a' ? 'unknown' : scenario === 'three_opportunities' && [0,4,5].includes(i) ? 'not_included' : states[i],
          connection: i === 3 ? 'connected' : i === 1 ? 'needs_connection' : 'unavailable', verified_at: '2026-10-02T12:00:00Z', requested_at: identity === 'fixture-a' && i === 0 ? receipt : null }))
        await route.fulfill({ json: rows })
      } else if (url.includes('/rpc/submit_client_service_expansion_request')) {
        requests.push(payload)
        if (failOnce) { failOnce = false; await route.fulfill({ status: 503, json: { message: 'Fixture ambiguous failure' } }) }
        else { receipt = '2026-10-02T12:01:00Z'; await route.fulfill({ json: { submitted_at: receipt, replayed: false } }) }
      } else if (url.includes('/rpc/record_client_service_surface')) {
        measurements += 1
        await route.fulfill({ body: '', status: 204 })
      } else if (url.includes('/rpc/get_client_service_expansion_review')) {
        await route.fulfill({ json: [] })
      } else if (url.includes('/rpc/verify_client_service_entitlement')) {
        verifyPayload = payload; await route.fulfill({ body: '', status: 204 })
      } else if (url.includes('/client_service_entitlements')) {
        await route.fulfill({ json: [] })
      } else throw new Error(`Unexpected local request: ${url}`)
    })
    await page.goto(`${server.resolvedUrls.local[0]}__389`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Included · connected', { exact: true }).waitFor()
    assert.equal(await page.locator('article').count(),6)
    assert.equal(await page.getByRole('button',{name:/Ask CG about this/}).count(),2)
    assert.equal(await page.getByText('Included · connection needed',{exact:true}).count(),1)
    assert.equal(await page.getByText('Package verification pending',{exact:true}).count(),0)
    assert.equal(await page.getByRole('heading',{name:'TikTok',exact:true}).count(),0)
    assert.equal(await page.locator('vite-error-overlay').count(),0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`)
    await page.screenshot({ path: join(tmpdir(),`cg-389-${name}.png`), fullPage:true })
    const linkedin = page.locator('article').filter({has:page.getByRole('heading',{name:'LinkedIn',exact:true})})
    await linkedin.getByRole('button',{name:/Ask CG about this/}).click()
    await linkedin.getByRole('textbox').fill('Please discuss our professional presence')
    await linkedin.getByRole('button',{name:'Send request'}).click()
    await linkedin.getByRole('alert').waitFor()
    assert.equal(await linkedin.getByRole('textbox').isDisabled(),true)
    await linkedin.getByRole('button',{name:'Send request'}).click()
    await linkedin.getByText(/Request received/).waitFor()
    assert.equal(requests.length,2)
    assert.deepEqual(requests[0],requests[1],`${name} exact retry payload/key`)
    assert.deepEqual(Object.keys(requests[0]).sort(),['p_idempotency_key','p_message','p_service_key','p_surface'])
    await page.waitForLoadState('networkidle')
    const beforeOverview = { entitlementReads, measurements, requests: requests.length }
    await page.getByRole('button',{name:'overview',exact:true}).click()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('article').count(),0)
    assert.equal(await page.getByText(/Request received/).count(),0)
    assert.deepEqual({ entitlementReads, measurements, requests: requests.length },beforeOverview,`${name} Overview does not read/measure/request service offers`)
    await page.screenshot({ path: join(tmpdir(),`cg-overview-no-upsell-${name}.png`), fullPage:true })
    const switchedRead = page.waitForResponse(response => response.url().includes('/rpc/get_my_client_service_entitlements'))
    await page.evaluate(() => window.switchFixture('fixture-b'))
    await page.getByRole('button',{name:'performance',exact:true}).click()
    await switchedRead
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0)
    assert.equal(await page.getByText(/Request received/).count(),0)
    assert.equal(await page.getByRole('button',{name:/Ask CG about this/}).count(),0)
    await page.getByRole('button',{name:'admin',exact:true}).click()
    const scope = page.getByLabel('LinkedIn scope')
    await scope.selectOption('not_included')
    const form = scope.locator('xpath=ancestor::form')
    await form.getByLabel('Evidence summary').fill('Reviewed signed agreement')
    await form.getByLabel('Approved source references (one per line)').fill('approved agreement fixture')
    await form.getByRole('button',{name:'Verify service scope'}).click()
    await page.waitForFunction(() => document.querySelectorAll('form textarea')[0].value === 'Reviewed signed agreement')
    for (let i=0;i<30 && !verifyPayload;i++) await new Promise(resolve=>setTimeout(resolve,100))
    assert.equal(verifyPayload.p_client_id,'fixture-b')
    assert.equal(verifyPayload.p_expected_revision,0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} admin overflow`)

    // A fresh mount must stay invisible for an in-flight read as well as every
    // absent-migration/error/unknown case. These execute the actual RPC helper,
    // parser, effects and rendered component, not a duplicated fake selector.
    scenario = 'loading'
    const loadingRequest = page.waitForRequest(request => request.url().includes('/rpc/get_my_client_service_entitlements'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await loadingRequest
    assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0)
    releaseRead()
    await page.getByText('Included · connected',{exact:true}).waitFor()
    await page.waitForLoadState('networkidle')
    for (const failureScenario of ['missing_rpc','missing_schema','read_failure','all_unknown','malformed']) {
      scenario = failureScenario
      const before = measurements
      await page.reload({ waitUntil: 'networkidle' })
      for (const surface of ['performance','overview']) {
        if (surface === 'overview') {
          await page.getByRole('button',{name:surface,exact:true}).click()
          await page.waitForLoadState('networkidle')
        }
        assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0,`${name} ${failureScenario} ${surface} has no module`)
        assert.equal(await page.locator('article').count(),0)
        assert.equal(await page.getByRole('button',{name:/Ask CG about this/}).count(),0)
        assert.equal(await page.getByText(/Package verification pending|Checking your verified services|Service verification is temporarily unavailable/).count(),0)
      }
      assert.equal(measurements,before,`${name} hidden ${failureScenario} is not measured`)
    }
    scenario = 'three_opportunities'
    await page.reload({waitUntil:'networkidle'})
    const beforeThreeOverview = { entitlementReads, measurements }
    await page.getByRole('button',{name:'overview',exact:true}).click()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('article').count(),0,`${name} Overview excludes every opportunity`)
    assert.equal(await page.getByRole('heading',{name:'Google Business Profile',exact:true}).count(),0)
    assert.deepEqual({ entitlementReads, measurements },beforeThreeOverview)
    await page.getByRole('button',{name:'performance',exact:true}).click()
    await page.getByRole('heading',{name:'Google Business Profile',exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{name:'TikTok',exact:true}).count(),1)
    assert.equal(await page.getByRole('heading',{name:'LinkedIn',exact:true}).count(),1)
    // Unmount the preceding Performance fixture before pinning the Dashboard
    // baseline: its deliberately asynchronous view receipt is not an Overview call.
    await page.getByRole('button',{name:'overview',exact:true}).click()
    await page.waitForLoadState('networkidle')
    const beforeDashboard = { entitlementReads, measurements }
    await page.getByRole('button',{name:'dashboard',exact:true}).click()
    await page.getByRole('tab',{name:'Facebook',exact:true}).waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0,`${name} actual Dashboard default Overview is clean`)
    assert.deepEqual({ entitlementReads, measurements },beforeDashboard)
    await page.getByRole('tab',{name:'Facebook',exact:true}).click()
    await page.locator('#services-performance').waitFor()
    await page.waitForLoadState('networkidle')
    const beforeDashboardOverview = { entitlementReads, measurements }
    await page.getByRole('tab',{name:'Overview',exact:true}).click()
    await page.locator('[aria-labelledby^="services-"]').waitFor({state:'hidden'})
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0)
    assert.deepEqual({ entitlementReads, measurements },beforeDashboardOverview)
    await page.screenshot({path:join(tmpdir(),`cg-dashboard-clean-overview-${name}.png`),fullPage:true})
    await page.evaluate(() => { window.fixtureNoReports=true; window.switchFixture('fixture-empty') })
    await page.getByText('No published report yet',{exact:true}).waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('[aria-labelledby^="services-"]').count(),0,`${name} actual empty Dashboard Overview is clean`)
    assert.deepEqual({ entitlementReads, measurements },beforeDashboardOverview)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${name} Dashboard overflow`)
    assert.deepEqual(errors,[])
    await page.close()
    console.log(`PASS ${name}: verified-only states, no UI for loading/missing RPC/schema/read failure/all unknown/malformed reads, Overview no offers/reads/measurement, Performance opportunities preserved, safe retry/receipt, route/client switching, admin evidence, no overflow/runtime errors`)
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
