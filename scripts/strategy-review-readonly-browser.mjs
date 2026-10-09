import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual review page/CSS; synthetic reads only. No production auth, approval,
// publication, provider calls or network credentials. Every mutation throws.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const clientId = '11111111-1111-4111-8111-111111111111'
const fixture = {
  name: 'strategy-review-readonly', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:strategy-review') return '\0virtual:strategy-review' },
  transform(_code, id) {
    const path = id.replaceAll('\\', '/')
    if (path.endsWith('/contexts/AuthContext.tsx')) return `export function useAuth(){return {profile:{id:'fixture-admin',role:'admin'}}}`
    if (path.endsWith('/lib/monthlyStrategy.ts')) return `
      import{emptyStrategyData,GOLD_STANDARD_FIELDS}from'/src/lib/strategyEngine.ts';
      export async function getMonthlyStrategy(id,month){
        const data=emptyStrategyData();
        for(const field of GOLD_STANDARD_FIELDS)data.goldStandard[field.key]='Explain the delivery process and ordering questions using real service footage: '+field.label;
        data.strategyGoingForward='Show the real delivery process and test a clearer ordering prompt.';
        if(window.fixtureKind==='bad')data.goldStandard.objective='Use the verified client evidence to drive the practical direction for this month.';
        const generation=window.fixtureKind==='generated'?{sourceDigest:'fixture-digest',baseVersion:2,proposedSourceIds:['fixture-guide'],proposedGoldStandard:{...data.goldStandard,objective:'Test a different local buyer question in a clear service demonstration.'},proposedActionPlan:{},filledFields:['goldStandard.audienceAndIntent'],conflicts:['goldStandard.objective'],status:'review_conflicts',provider:'fixture'}:undefined;
        return {error:null,data:{id:'fixture-strategy',client_id:id,strategy_month:month+'-01',workflow_status:window.fixtureKind==='dirty'?'approved':'draft',version:3,strategy_data:data,internal_notes:'Fixture saved review note',seed_context:{client_id:id,strategy_month:month+'-01',source_coverage:{client_guide:'available'},source_windows:{previous_report_period_end:'2026-09-30',previous_strategy_month:null,incorporated_context_updates:[]},intelligence_evidence:[{authority:'client_guide',source_id:'fixture-guide',excerpt:'Delivery service process'}],sources:{deliverable_ids:[],client_calendar_event_ids:[],approved_client_context_update_ids:[],previous_report_id:null,previous_monthly_strategy_id:null},generation}}};
      }
      const forbidden=async()=>{window.fixtureWrites++;throw new Error('Mutation forbidden')};
      export const amendMonthlyStrategy=forbidden,seedMonthlyStrategy=forbidden,transitionMonthlyStrategy=forbidden;`
  },
  load(id) {
    if (id !== '\0virtual:strategy-review') return
    return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from'/src/pages/admin/MonthlyStrategyPage.tsx';import'/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));`
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/admin/monthly-strategy')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:strategy-review"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-strategy-review-browser-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  server: { host: '127.0.0.1', port: 53994, strictPort: true, hmr: false },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [375, 390, 430, 1440]) {
    for (const kind of process.argv[2] ? [process.argv[2]] : ['dirty', 'bad', 'clock', 'generated']) {
      assert.ok(['dirty', 'bad', 'clock', 'generated'].includes(kind))
      const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId: 'America/Los_Angeles' })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(kind => { window.fixtureKind = kind; window.fixtureWrites = 0 }, kind)
      await page.clock.setFixedTime(new Date('2026-09-30T22:30:00Z'))
      await page.route('**/*', async route => {
        const request = route.request(); const url = new URL(request.url())
        if (url.origin === 'http://127.0.0.1:53994') return route.continue()
        assert.equal(url.origin, 'http://127.0.0.1:1', 'No external network')
        assert.equal(request.method(), 'GET', 'No RPC or table writes')
        if (url.pathname.endsWith('/strategy_options')) return route.fulfill({ json: [] })
        if (url.pathname.endsWith('/client_aliases')) return route.fulfill({ json: [] })
        assert.ok(url.pathname.endsWith('/clients'), `Only fixture client read permitted: ${url.pathname}`)
        const settings = {
          professional_videos_per_month: 1, reels_per_month: 0, photo_posts_per_month: 0, design_posters_per_month: 0,
          animated_posters_per_month: 0, campaign_management_included: false, monthly_campaign_budget: 0,
          shoot_days_per_month: 0, website_updates_per_month: 0, other_agreed_deliverables: '', package_notes: '', package_exclusions: '',
          verification: { status: 'confirmed', version: 1, confirmed_at: '2026-09-23T08:00:00Z', confirmed_by_profile_id: 'fixture-admin', evidence_note: 'Synthetic package confirmation only', source_references: ['fixture-contract'] },
        }
        const client = { id: clientId, name: 'Synthetic delivery client', active: true, package_settings: settings }
        return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? client : [client] })
      })
      await page.goto(`http://127.0.0.1:53994/admin/monthly-strategy?client=${clientId}${kind === 'clock' ? '' : '&month=2026-10'}`)
      await page.getByText('Gold-standard exact-client authority', { exact: true }).waitFor()
      if (kind === 'dirty') {
        const publish = page.getByRole('button', { name: 'Publish to client', exact: true })
        assert.equal(await publish.isEnabled(), true, 'Unchanged structurally valid approved fixture keeps explicit publish control')
        await page.getByPlaceholder('Internal only. Never included in the client projection.').fill('Unsaved producer correction must remain intact.')
        assert.equal(await publish.isDisabled(), true, 'Never publish a saved revision while showing unsaved edits')
        assert.equal(await page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), true)
        assert.equal(await page.getByPlaceholder('Internal only. Never included in the client projection.').inputValue(), 'Unsaved producer correction must remain intact.')
      } else if (kind === 'bad') {
        assert.equal(await page.getByRole('button', { name: 'Approve strategy', exact: true }).isDisabled(), true)
        await page.getByText('Internal evidence-template instructions are not client strategy.', { exact: true }).waitFor()
      } else if (kind === 'generated') {
        const receipt = page.getByText(/Auto-prepared draft · 1 fields added or refreshed · 1 staff choices kept/)
        await receipt.waitFor()
        await receipt.click()
        await page.getByText('Test a different local buyer question in a clear service demonstration.', { exact: false }).waitFor()
        await page.getByText('Exact monthly objective · staff wording retained', { exact: true }).waitFor()
      } else {
        assert.equal(await page.locator('input[type="month"]').inputValue(), '2026-10', 'Johannesburg October, not Los Angeles September')
        await page.getByText('Automated checks passed. Review the actual strategy before approval.', { exact: true }).waitFor()
      }
      assert.equal(await page.evaluate(() => window.fixtureWrites), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: join(tmpdir(), `cg-strategy-review-${kind}-${width}.png`), fullPage: true })
      console.log(`PASS actual strategy review ${width}px ${kind}: exact month, structural truth, preserved edits, no writes/errors/overflow`)
      await page.close()
    }
  }
} finally { await browser?.close(); await server.close() }
