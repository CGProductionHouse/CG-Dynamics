import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'reports-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:reports-workspace' || id === 'virtual:reports-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/ReportsManagement.tsx')) return
    return code.replaceAll(/from '\.\.\/\.\.\/(?:lib|components|contexts)\/[^']+'/g, "from 'virtual:reports-data'")
  },
  load(id) {
    if (id === '\0virtual:reports-data') return `
      import React from 'react';
      window.fixtureWrites=0;
      export const useAuth = () => ({profile:{role:'admin'}});
      export const listClients = async () => ({data:Array.from({length:35},(_,i)=>({id:'client-'+i,name:'Exact Client '+i,active:true})),error:null});
      export const listReports = async () => ({data:Array.from({length:35},(_,i)=>({id:'report-'+i,client_id:'client-'+i,status:i<30?'draft':'published',period_start:i<30?'2026-09-01':'2026-08-01',period_end:i<30?'2026-09-30':'2026-08-31',updated_at:'2026-10-01T00:00:00Z',created_at:'2026-09-01T00:00:00Z',strategy_data:null,report_title:'Monthly report'})),error:null});
      const forbidden=()=>{window.fixtureWrites++;throw new Error('No writes in browser fixture')};
      export const deleteReport=forbidden,updateReportPeriod=forbidden,updateReportStatus=forbidden;
      export const isFullCalendarMonth=()=>true;
      export const isMonthComplete=()=>true;
      export const monthDisplayLabel=month=>month==='2026-09'?'September 2026':'August 2026';
      export const getReportMonthFromPeriod=report=>report.period_end.slice(0,7);
      export const normalizeReportToCalendarMonth=()=>({month:'2026-09',start:'2026-09-01',end:'2026-09-30'});
      export const readStrategyData=()=>({});
      export const strategyRequiredComplete=()=>false;
      export const ClientLogo=()=>null;
      export const ActionButton=({children,onClick,disabled})=>React.createElement('button',{type:'button',onClick,disabled},children);
      export const StatusBadge=({label})=>React.createElement('span',null,label);
      export const SourceBadge=({source})=>React.createElement('span',null,source);
      export const PremiumCard=({children})=>React.createElement('article',{className:'rounded-xl border border-white/10 p-3'},children);
      export const EmptyState=({title,message})=>React.createElement('p',null,title+' '+message);
      export const supabase={from:()=>({select:async()=>({data:[],error:null})})};
    `
    if (id === '\0virtual:reports-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom';
      import ReportsManagement from '/src/pages/admin/ReportsManagement.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(ReportsManagement)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__reports-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:reports-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-reports-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 54001, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:54001/__reports-workspace')
    await page.getByText('Showing 25 of 35 matching reports (35 total)').waitFor()
    assert.equal(await page.locator('article').count(), 26) // filter panel + 25 reports
    assert.ok(await page.locator('article').nth(1).getByText('September 2026').isVisible())
    assert.equal(await page.getByRole('button', { name: 'Delete' }).filter({ visible: true }).count(), 0)
    await page.locator('summary').filter({ hasText: 'More actions' }).first().click()
    assert.equal(await page.getByRole('button', { name: 'Delete' }).filter({ visible: true }).count(), 1)
    await page.getByRole('button', { name: 'Show next 10 reports' }).click()
    await page.getByText('Showing 35 of 35 matching reports (35 total)').waitFor()
    assert.equal(await page.locator('article').count(), 36)
    await page.getByText('Month', { exact: true }).locator('..').getByRole('combobox').selectOption('2026-08')
    await page.getByText('Showing 5 of 5 matching reports (35 total)').waitFor()
    assert.equal(await page.locator('article').count(), 6)
    assert.equal(await page.getByRole('button', { name: /Show next/ }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.equal(await page.evaluate(() => window.fixtureWrites), 0)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-reports-workspace-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS ${width}px: newest month, bounded reveal, protected actions, historical filter, no overflow/errors/writes`)
  }
} finally { if (browser) await browser.close(); await server.close() }
