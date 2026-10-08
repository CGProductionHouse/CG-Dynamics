import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name: 'planning-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:planning-workspace' || id === 'virtual:planning-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/ClientSchedulePage.tsx')) return
    code = code.replaceAll(/from '\.\.\/\.\.\/(?:lib|components|contexts)\/[^']+'/g, "from 'virtual:planning-data'")
    return `${code}\nexport { ScheduleReviewSection };`
  },
  load(id) {
    if (id === '\0virtual:planning-data') return `
      import React from 'react';
      export const ContentProductionPanel = () => null;
      export const VIDEO_STATUS_LABELS = {};
      export const ActionButton = () => null;
      export const EmptyState = () => null;
      export const ClientPicker = () => null;
      export const listGuideIdeasForDeliverables = async () => ({data:[]});
      export const listActiveClients = async () => ({data:[]});
      export const useVisualViewportBottomInset = () => 0;
      export const useAuth = () => ({profile:{role:'admin'}});
      export const isManagerRole = () => true;
      export const CALENDAR_HEADERS = [];
      export const monthGridCells = () => [];
      export const todayIso = () => '2026-10-08';
      export const listPendingScheduleChanges = async () => ({data:window.__planningRequests ?? [],error:window.__planningError ? {message:'Read unavailable'} : null});
      export const listMyScheduleChangeRequests = async () => ({data:[],error:null});
      export const approveScheduleChange = async () => ({error:null});
      export const rejectScheduleChange = async () => ({error:null});
      export const saveScheduleDeliverable = async () => ({error:null});
      export const updateAssignedScheduleStatus = async () => ({error:null});
      export const PACKAGE_DELIVERABLE_TYPES = [];
      export const SIMPLIFIED_STATUS_LABELS = {};
      export const SIMPLIFIED_STATUS_OPTIONS = [];
      export const SIMPLIFIED_TO_BACKEND_STATUS = {};
      export const isNeedsActionStatus = () => false;
      export const isPostedOrHistoryStatus = () => false;
      export const listMonthlyDeliverablesByMonth = async () => ({data:[]});
      export const listMonthlyDeliverablesByYear = async () => ({data:[]});
      export const matchesScheduleStatusFilter = () => false;
      export const monthKey = () => '2026-10';
      export const normalizeScheduleStatus = value => value;
    `
    if (id === '\0virtual:planning-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { ScheduleReviewSection } from '/src/pages/admin/ClientSchedulePage.tsx'; import '/src/index.css';
      const request = new URLSearchParams(location.search).get('state');
      window.__planningError = request === 'error';
      window.__planningRequests = request === 'pending' ? [{id:'request-1',requested_by_name:'Staff member',reason:'Client requested a date change',change:{scheduled_date:'2026-10-14'},deliverable:{code:'DP',instance_number:1,title:'Exact client post',scheduled_date:'2026-10-12'}}] : [];
      createRoot(document.getElementById('root')).render(React.createElement(ScheduleReviewSection,{canReview:true,onApplied:async()=>{}}));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__planning-workspace')) return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:planning-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()], cacheDir: join(tmpdir(), 'cg-planning-workspace-cache'), optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 53996, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53996/__planning-workspace?state=empty')
    await page.getByText('No pending or personal requests.').waitFor()
    assert.ok(await page.getByRole('button', { name: 'Refresh requests' }).isVisible())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px empty overflow`)
    await page.screenshot({ path: join(tmpdir(), `cg-planning-empty-${width}.png`), fullPage: true })
    await page.goto('http://127.0.0.1:53996/__planning-workspace?state=pending')
    await page.getByText('Exact client post').waitFor()
    assert.ok(await page.getByRole('button', { name: 'Approve' }).isVisible())
    assert.ok(await page.getByRole('button', { name: 'Reject' }).isVisible())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px pending overflow`)
    await page.goto('http://127.0.0.1:53996/__planning-workspace?state=error')
    await page.getByRole('alert').getByText('Read unavailable').waitFor()
    assert.equal(await page.getByText('No pending or personal requests.').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: compact empty, pending controls, read error and no overflow`)
  }
} finally { if (browser) await browser.close(); await server.close() }
