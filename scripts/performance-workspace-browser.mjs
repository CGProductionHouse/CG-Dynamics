import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'performance-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:performance-workspace' || id === 'virtual:performance-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/ClientPerformancePage.tsx')) return
    return code.replaceAll(/from '\.\.\/\.\.\/(?:lib|components|contexts|features)\/[^']+'/g, "from 'virtual:performance-data'")
  },
  load(id) {
    if (id === '\0virtual:performance-data') return `
      import React from 'react';
      export const PremiumCard = ({children,className=''}) => React.createElement('div',{className},children);
      export const PremiumCardHeader = ({title}) => React.createElement('h2',null,title);
      export const StatusBadge = ({label}) => React.createElement('span',null,label);
      export const EmptyState = ({title,message}) => React.createElement('p',null,title+' '+message);
      export const useAuth = () => ({profile:{role:'admin'}});
      export const isManagerRole = role => role === 'admin';
      export const WebsitePerformancePanel = () => React.createElement('section',null,'Website performance fixture');
      export const listClients = async () => ({data:Array.from({length:7},(_,i)=>({id:'client-'+i,name:'Exact Client '+i,active:true})),error:null});
      export const listReports = async () => ({data:Array.from({length:7},(_,i)=>({id:'report-'+i,client_id:'client-'+i,status:'draft',period_start:'2026-09-02',period_end:'2026-09-30',updated_at:'2026-10-01T00:00:00Z',created_at:'2026-09-01T00:00:00Z'})),error:null});
      export const supabase = {from:()=>({select:()=>({eq:async()=>({data:[],error:null})})})};
      export const getReportMonthFromPeriod = () => '2026-09';
      export const isFullCalendarMonth = () => false;
      export const isMonthComplete = () => true;
      export const monthDisplayLabel = () => 'September 2026';
      export const readStrategyData = () => ({});
      export const strategyRequiredComplete = () => false;
      export const listStaffOnboarding = async () => ({data:[],error:null});
    `
    if (id === '\0virtual:performance-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom';
      import ClientPerformancePage from '/src/pages/admin/ClientPerformancePage.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(ClientPerformancePage)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__performance-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:performance-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-performance-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 53999, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53999/__performance-workspace')
    await page.getByText('7 reports need review').waitFor()
    assert.equal(await page.getByText('Needs repair').count(), 5)
    await page.getByRole('button', { name: 'Show all 7 reports' }).click()
    assert.equal(await page.getByText('Needs repair').count(), 7)
    await page.getByRole('button', { name: 'Show fewer reports' }).click()
    assert.equal(await page.getByText('Needs repair').count(), 5)
    assert.equal(await page.getByText('Client onboarding status').count(), 1)
    await page.locator('summary').filter({ hasText: 'More performance tools' }).click()
    assert.ok(await page.getByRole('link', { name: /Content Calendar/ }).isVisible())
    assert.ok(await page.getByRole('link', { name: /Import & Data/ }).isVisible())
    await page.locator('summary').filter({ hasText: 'Client onboarding status' }).click()
    await page.getByText('View onboarding workspace').waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `cg-performance-workspace-${width}.png`), fullPage: true })
    await page.close()
    console.log(`PASS ${width}px: full repair queue, secondary tools/onboarding, no overflow or runtime error`)
  }
} finally { if (browser) await browser.close(); await server.close() }
