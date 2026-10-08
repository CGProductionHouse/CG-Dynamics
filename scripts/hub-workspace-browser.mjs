import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Exercise the real Hub component against bounded synthetic data. No session,
// provider, production request or quick-add mutation is used in this test.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const mockedImports = [
  '../../contexts/AuthContext', '../../contexts/MyDayContextStore',
  '../../lib/commandCentre', '../../lib/planner', '../../lib/companyCalendar',
  '../../lib/workforceMyDay', '../../lib/businessTime', '../../lib/hubCalendar',
  '../../lib/contentWorkflow', '../../lib/contentWorkflowRules', '../../lib/roles',
  '../../lib/taskLifecycle',
]
const fixture = {
  name: 'hub-workspace-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:hub-workspace' || id === 'virtual:hub-data') return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/CgHubPage.tsx')) return
    for (const path of mockedImports) code = code.replaceAll(`'${path}'`, "'virtual:hub-data'")
    return code
  },
  load(id) {
    if (id === '\0virtual:hub-data') return `
      export const useAuth = () => ({ profile: { id: 'staff-1', full_name: 'Fixture Staff', role: 'admin' } });
      export const useMyDayShareActions = () => ({ beginLoad(){}, publish(){}, fail(){} });
      const tasks = [
        { id:'task-1', title:'First urgent client task', priority:'urgent', status:'to_do', due_date:'2026-10-08', assigned_to_user_id:'staff-1', data_origin:'planner_tasks', client_id:'client-1', client_name:'Exact Client' },
        { id:'task-2', title:'Review video for Exact Client', priority:'normal', status:'blocked', due_date:'2026-10-09', assigned_to_user_id:'staff-1', data_origin:'planner_tasks', client_id:'client-1', client_name:'Exact Client' },
        { id:'task-3', title:'Client request for artwork', priority:'client_request', status:'to_do', due_date:'2026-10-08', assigned_to_user_id:'staff-1', data_origin:'planner_tasks', client_id:'client-1', client_name:'Exact Client' },
      ];
      export const listTasks = async () => ({ data:tasks, error:null });
      export const listActiveClients = async () => ({ data:[{id:'client-1',name:'Exact Client'}], error:null });
      export const createTask = async () => { throw Error('Quick add is not part of read-only fixture') };
      export const taskStatusDisplayLabel = task => task.status === 'blocked' ? 'Blocked' : 'To do';
      export const listMonthlyDeliverablesByMonth = async () => ({ data:[], error:null });
      export const simplifyProductionStatus = value => value;
      export const listCompanyEvents = async () => ({ data:[{id:'event-1',title:'Confirmed meeting',event_type:'meeting',start_at:'2026-10-08T08:00:00Z',all_day:false}], error:null, tableMissing:false });
      export const EVENT_TYPE_LABELS = { meeting:'Meeting' };
      export const getMyDayContext = async () => ({ today:'2026-10-08', overdue:[], dueToday:[tasks[0]], events:[{date:'2026-10-08'}], deliverables:[], summary:{currentTask:{title:'First urgent client task',source:'planner_tasks',clientName:'Exact Client'},nextTask:{title:'Review video for Exact Client',source:'planner_tasks',clientName:'Exact Client'},plannedMinutes:240,workloadWarning:null} });
      export const sourceLabel = () => 'Planner';
      export const businessDateKey = () => '2026-10-08';
      export const businessDayBoundaryIso = () => '2026-10-08T00:00:00Z';
      export const businessMonthKey = () => '2026-10';
      export const formatBusinessDate = () => 'Thu, 8 Oct 2026';
      export const formatBusinessTime = () => '10:00';
      export const buildHubSevenDayCalendar = events => Array.from({length:7},(_,i)=>({date:'2026-10-'+String(8+i).padStart(2,'0'),isToday:i===0,events:i===0?events:[]}));
      export const formatHubCalendarDay = day => day;
      export const listRuns = async () => ({ data:[], error:null, migrationNeeded:false });
      export const listPipelineVideos = async () => ({ data:[], error:null, migrationNeeded:false });
      export const isRunUpcoming = () => false;
      export const isManagerRole = () => true;
      export const isActiveForToday = task => task.status !== 'done';
      export const isActuallyInProgressTask = task => task.status === 'in_progress';
      export const isVerifiedWorkTask = () => true;
    `
    if (id === '\0virtual:hub-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { MemoryRouter } from 'react-router-dom';
      import CgHubPage from '/src/pages/admin/CgHubPage.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(CgHubPage)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__hub-workspace') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:hub-workspace"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile:false, plugins:[fixture,react()], cacheDir:join(tmpdir(),'cg-hub-workspace-cache'), optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']}, server:{host:'127.0.0.1',port:53993,strictPort:true,hmr:false} })
let browser
try {
  await server.listen()
  browser = await chromium.launch({headless:true})
  for (const width of [1440, 375]) {
    const page = await browser.newPage({viewport:{width,height:850}})
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53993/__hub-workspace')
    await page.getByRole('heading', {name:'Focus'}).waitFor()
    assert.equal(await page.getByText('First urgent client task', {exact:true}).count(), 2, 'one My Day focus and one queue row')
    assert.equal(await page.getByText('No events').count(), 0, 'six empty calendar day cards are hidden')
    assert.equal(await page.getByRole('button',{name:'Priority 2'}).getAttribute('aria-pressed'), 'true')
    await page.screenshot({path:join(tmpdir(), `cg-hub-workspace-${width}.png`), fullPage:true})
    await page.getByRole('button',{name:'Waiting review 1'}).click()
    assert.equal(await page.getByText('Review video for Exact Client', {exact:true}).count(), 2, 'one My Day next and one selected queue row')
    assert.equal(await page.getByRole('button',{name:'Waiting review 1'}).getAttribute('aria-pressed'), 'true')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: selectable single work queue, compact calendar, no overflow or runtime error`)
  }
} finally { if (browser) await browser.close(); await server.close() }
