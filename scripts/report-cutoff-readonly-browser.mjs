import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set the approved local CG_PLAYWRIGHT_MODULE')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const port = 53986
const fixture = {
  name: 'report-cutoff-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:report-cutoff') return '\0virtual:report-cutoff' },
  load(id) {
    if (id !== '\0virtual:report-cutoff') return
    return `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
      import{ClientReportView}from'/src/pages/client/ClientReportView.tsx';import'/src/index.css';
      import{emptyStrategyData}from'/src/lib/strategyEngine.ts';
      const post=(id,time,caption,engagements)=>({id,platform:'facebook',publish_time:time,
        post_type:'Photo',caption,permalink:null,impressions:100,reach:50,engagements,excluded:false});
      const report={id:'synthetic-report',client_id:'synthetic-client',report_title:'Local cutoff fixture',
        status:'published',period_start:'2026-09-01',period_end:'2026-09-23',platform:null,
        posts:[post('covered','2026-09-24T06:59:59.999Z','Covered Pacific final-day result',0),
          post('later','2026-09-24T07:00:00Z','Uncovered later result',999)]};
      const strategyData=emptyStrategyData();strategyData.strategyGoingForward='Explain the application routes so contributors can prepare the correct submission.';
      function App(){const[status,setStatus]=useState('draft');const[client,setClient]=useState(null);const[lowSignal,setLowSignal]=useState(false);const[facts,setFacts]=useState([]);const[googleState,setGoogleState]=useState('unmapped');const[strategyReadUnavailable,setStrategyReadUnavailable]=useState(false);const[emptyStrategy,setEmptyStrategy]=useState(false);window.showPublishedFixture=()=>setStatus('published');
        window.showMissingGoogleCampaignFixture=()=>setGoogleState('no-campaign-data');
        window.showStrategyReadErrorFixture=()=>setStrategyReadUnavailable(true);
        window.showNoStrategyFixture=()=>{setStrategyReadUnavailable(false);setEmptyStrategy(true)};
        window.showPlatformWindowFixture=()=>setFacts([{platform:'tiktok',metricKey:'views',value:57944,availability:'partial',aggregation:'sum',comparableGroup:'tiktok-cohort',sourceMetric:'views',periodStart:'2026-09-01',periodEnd:'2026-09-30'},
          {platform:'tiktok',metricKey:'comments',value:0,availability:'partial',aggregation:'sum',comparableGroup:'tiktok-cohort',sourceMetric:'comments',periodStart:'2026-09-01',periodEnd:'2026-09-23'},
          {platform:'tiktok',metricKey:'total_likes',value:52555,availability:'partial',aggregation:'snapshot',comparableGroup:null,sourceMetric:'total_likes',periodStart:null,periodEnd:null}]);
        window.showLowSignalFixture=()=>setLowSignal(true);
        window.showMaintainedSiteFixture=()=>setClient({id:'aece5a86-c962-4234-a1fe-7904c20f03ff',name:'JFJ Electrical'});
        return React.createElement('main',{className:'mx-auto max-w-6xl p-3 sm:p-8'},
          React.createElement(ClientReportView,{report:{...report,client_id:client?.id??report.client_id,
            posts:lowSignal?report.posts.map(post=>({...post,impressions:0,reach:0,engagements:null})):report.posts},client,googleAds:null,googleAdsState:googleState,
            googleAdsError:null,facts,monthlyStrategy:strategyReadUnavailable||emptyStrategy?null:{month:'2026-09-01',status,strategyData},showEmptyStrategy:strategyReadUnavailable||emptyStrategy,strategyReadUnavailable}));}
      createRoot(document.getElementById('root')).render(React.createElement(App));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__cutoff') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@id/virtual:report-cutoff"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [react(), fixture],
  cacheDir: join(tmpdir(), 'cg-report-cutoff-vite-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
    })
    await page.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.hostname !== '127.0.0.1' || url.port !== String(port) || request.method() !== 'GET') {
        errors.push('Unexpected non-fixture request')
        await route.abort()
        return
      }
      await route.continue()
    })
    await page.goto(`http://127.0.0.1:${port}/__cutoff`, { waitUntil: 'networkidle' })
    await page.getByText('Covered Pacific final-day result', { exact: true }).first().waitFor()
    const overviewTab=page.getByRole('tab',{name:'Overview',exact:true})
    const facebookTab=page.getByRole('tab',{name:'Facebook',exact:true})
    await overviewTab.focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await facebookTab.evaluate(element=>element===document.activeElement),true,`${width} Performance ArrowRight focuses Facebook`)
    assert.equal(await overviewTab.getAttribute('aria-selected'),'true','Focus does not activate another service')
    await page.keyboard.press('Enter')
    const facebookPanel=page.getByRole('tabpanel',{name:'Facebook',exact:true})
    await facebookPanel.waitFor()
    assert.equal(await facebookTab.getAttribute('aria-controls'),await facebookPanel.getAttribute('id'))
    await page.keyboard.press('Tab')
    assert.equal(await facebookPanel.evaluate(element=>element===document.activeElement),true,'Tab enters selected service panel')
    assert.equal(await facebookPanel.evaluate(element=>getComputedStyle(element).outlineOffset),'-2px','Panel focus stays inside the report overflow boundary')
    await page.screenshot({path:join(tmpdir(),`cg-performance-keyboard-panel-${width}.png`),fullPage:true})
    await page.keyboard.press('Shift+Tab')
    assert.equal(await facebookTab.evaluate(element=>element===document.activeElement),true)
    await page.keyboard.press('Home')
    assert.equal(await overviewTab.evaluate(element=>element===document.activeElement),true)
    await page.keyboard.press('Tab')
    assert.equal(await facebookPanel.evaluate(element=>element===document.activeElement),true,'Tab exits from inactive focus before selected service')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowLeft')
    const emailTab=page.getByRole('tab',{name:'Email marketing',exact:true})
    assert.equal(await emailTab.evaluate(element=>element===document.activeElement),true,'Left wraps to final service')
    await page.keyboard.press('ArrowRight')
    assert.equal(await overviewTab.evaluate(element=>element===document.activeElement),true,'Right wraps to overview')
    await page.keyboard.press('End')
    assert.equal(await emailTab.evaluate(element=>element===document.activeElement),true,'End focuses final service')
    await page.keyboard.press('Home')
    await page.keyboard.press('Space')
    await page.getByRole('tabpanel',{name:'Overview',exact:true}).waitFor()
    assert.equal(await overviewTab.getAttribute('aria-selected'),'true','Space activates service')
    assert.equal(await page.getByRole('tab').evaluateAll(tabs=>tabs.filter(tab=>tab.tabIndex===0).length),1,'Only one service tab in normal tab order')
    for(const tab of await page.getByRole('tab').all()) {
      const target=await tab.getAttribute('aria-controls')
      assert.equal(await page.locator('[role="tabpanel"]').evaluateAll((panels,id)=>panels.filter(panel=>panel.id===id).length,target),1,'Each service controls one existing panel')
    }
    assert.equal(await page.getByText('Best platform', { exact: true }).count(), 1, `${width} observed reach keeps its headline`)
    assert.equal(await page.getByText('Top overall performer', { exact: true }).count(), 1, `${width} strong observed content keeps its badge`)
    assert.equal(await page.getByText('Uncovered later result', { exact: true }).count(), 0)
    assert.doesNotMatch(await page.locator('body').innerText(), /recommended weekly rhythm|Build posting consistency|compounding visibility|Where to focus next/)
    assert.ok((await page.locator('body').innerText()).includes('23 September 2026'))
    assert.equal(await page.getByText('Explain the application routes so contributors can prepare the correct submission.', { exact: true }).count(), 0)
    await page.evaluate(() => window.showPublishedFixture())
    await page.getByText('Explain the application routes so contributors can prepare the correct submission.', { exact: true }).waitFor()
    await page.getByRole('tab', { name: 'Facebook', exact: true }).click()
    await page.getByText('Covered Pacific final-day result', { exact: true }).first().waitFor()
    assert.equal(await page.getByText('Uncovered later result', { exact: true }).count(), 0)
    assert.doesNotMatch(await page.locator('body').innerText(), /Increase posting consistency|compounding visibility|Next steps for Facebook/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-report-cutoff-${width}.png`), fullPage: true })
    await page.evaluate(() => window.showMaintainedSiteFixture())
    await page.getByRole('tab', { name: 'Website Performance', exact: true }).click()
    await page.getByText('Your CG-built website is maintained by CG.', { exact: false }).waitFor()
    assert.doesNotMatch(await page.locator('body').innerText(), /Explore adding this service|Discuss my package|A premium CG-built website|aece5a86/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} maintained-site overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-maintained-site-${width}.png`), fullPage: true })
    await page.evaluate(() => window.showLowSignalFixture())
    await page.getByRole('tab', { name: 'Overview', exact: true }).click()
    await page.getByText('Content learning', { exact: true }).waitFor()
    assert.equal(await page.getByText('Top overall performer', { exact: true }).count(), 0, `${width} observed zero is not called a top performer`)
    assert.equal(await page.getByText('TOP', { exact: true }).count(), 0, `${width} placeholder does not invent a performance claim`)
    await page.getByText('Covered Pacific final-day result', { exact: true }).first().waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} zero-evidence overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-report-observed-zero-${width}.png`), fullPage: true })
    await page.evaluate(() => window.showPlatformWindowFixture())
    await page.getByText('Recorded platform window: 1 September 2026 – 30 September 2026', { exact: true }).waitFor()
    for (const tab of ['Overview', 'TikTok']) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      const body = await page.locator('body').innerText()
      assert.match(body, /Content month to date · through 23 September 2026/)
      assert.match(body, /Report content coverage:/)
      assert.match(body, /Recorded platform window: 1 September 2026 – 30 September 2026/)
      assert.match(body, /Recorded platform window: 1 September 2026 – 23 September 2026/)
      assert.match(body, /Platform window unavailable/)
      assert.match(body, /57,944/)
      assert.match(body, /Account snapshot for this report/)
      assert.doesNotMatch(body, /latest verified evidence|latest sync|vs last month/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} fact-window overflow`)
      assert.deepEqual(errors, [])
    }
    await page.screenshot({ path: join(tmpdir(), `cg-report-fact-window-${width}.png`), fullPage: true })
    await page.getByRole('tab', { name: 'Overview', exact: true }).click()
    await page.evaluate(() => window.showStrategyReadErrorFixture())
    await page.getByText('Monthly strategy is temporarily unavailable.', { exact: false }).waitFor()
    assert.equal(await page.getByText('The monthly strategy is still under review.', { exact: false }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} strategy-read overflow`)
    assert.deepEqual(errors, [])
    await page.evaluate(() => window.showNoStrategyFixture())
    await page.getByText('The monthly strategy is still under review.', { exact: false }).waitFor()
    assert.equal(await page.getByText('Monthly strategy is temporarily unavailable.', { exact: false }).count(), 0)
    await page.evaluate(() => window.showMissingGoogleCampaignFixture())
    await page.getByRole('tab', { name: 'Google', exact: true }).click()
    await page.getByText('Google Ads campaign figures are unavailable', { exact: true }).waitFor()
    assert.doesNotMatch(await page.getByRole('tabpanel', { name: 'Google', exact: true }).innerText(), /No Google Ads activity|The month was synced|Source: Google Ads/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} missing-Google-facts overflow`)
    await page.screenshot({ path: join(tmpdir(), `cg-google-missing-campaign-facts-${width}.png`), fullPage: true })
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: actual Overview/Facebook/held managed Website, cutoff/observed zero, no later highlight/duplicate site upsell/overflow/runtime errors; localhost GET only`)
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
