import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Real My Day component; synthetic read-only context only.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const fixture = {
  name:'my-day-workspace-fixture', enforce:'pre',
  resolveId(id) { if (id === 'virtual:my-day-workspace' || id === 'virtual:my-day-data') return `\0${id}` },
  transform(code,id) {
    if (!id.replaceAll('\\','/').endsWith('/pages/admin/MyDayPage.tsx')) return
    for (const path of ['../../contexts/AuthContext','../../lib/commandCentre','../../lib/planner','../../lib/workforceMyDay']) code=code.replaceAll(`'${path}'`,"'virtual:my-day-data'")
    return code
  },
  load(id) {
    if (id === '\0virtual:my-day-data') return `
      export const useAuth = () => ({ profile:{id:'staff-1',full_name:'Fixture Staff',email:'fixture@example.test'} });
      export const updateTaskStatus = async () => { throw Error('No mutation in fixture') };
      export const updatePlannerTaskStatus = async () => { throw Error('No mutation in fixture') };
      export const updateMonthlyDeliverableStatus = async () => { throw Error('No mutation in fixture') };
      const first = {id:'item-1',source:'planner_task',title:'Prepare client campaign',date:'2026-10-08',priority:'normal',statusLabel:'To do',clientName:'Exact Client',assignedTo:'Fixture Staff',href:'/admin/work?tab=board'};
      const second = {id:'item-2',source:'planner_task',title:'Review draft video',date:'2026-10-09',priority:'normal',statusLabel:'In progress',clientName:'Exact Client',assignedTo:'Fixture Staff',href:'/admin/work?tab=board'};
      export const getMyDayContext = async () => ({today:'2026-10-08',todayLabel:'Thursday 8 October',userName:'Fixture Staff',diagnostics:{errors:[]},overdue:[],dueToday:[first],upcoming:[second],tasks:[first,second],events:[],deliverables:[],timelineBlocks:[],summary:{currentTask:first,nextTask:second,plannedMinutes:240,availableMinutes:540,workloadWarning:null}});
      export const myDayDateLabel = item => item.date;
      export const sourceAccent = () => 'border-white/10 text-brand-primary';
      export const sourceLabel = () => 'Planner';
    `
    if (id === '\0virtual:my-day-workspace') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { MemoryRouter } from 'react-router-dom';
      import MyDayPage from '/src/pages/admin/MyDayPage.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(MyDayPage)));
    `
  },
  configureServer(server) {
    server.middlewares.use((req,res,next)=>{
      if(req.url!=='/__my-day-workspace') return next()
      res.setHeader('Content-Type','text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:my-day-workspace"></script></body></html>')
    })
  },
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-my-day-workspace-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:53994,strictPort:true,hmr:false}})
let browser
try {
  await server.listen()
  browser=await chromium.launch({headless:true})
  for(const width of [1440,375]) {
    const page=await browser.newPage({viewport:{width,height:850}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto('http://127.0.0.1:53994/__my-day-workspace')
    await page.getByRole('heading',{name:'Assigned work'}).waitFor()
    assert.equal(await page.getByText('Prepare client campaign',{exact:true}).count(),2,'one current focus and one assigned item')
    assert.equal(await page.getByRole('heading',{name:/Start: Prepare client campaign/}).count(),0,'no duplicate headline')
    assert.equal(await page.getByText('Nothing overdue').count(),1)
    if (width === 375) {
      const assignedTop = await page.getByRole('heading',{name:'Assigned work'}).evaluate(element => element.getBoundingClientRect().top)
      const planTop = await page.getByText('Workday plan').evaluate(element => element.getBoundingClientRect().top)
      assert.ok(assignedTop < planTop, 'assigned work must precede secondary timeline on mobile')
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px body overflow`)
    assert.deepEqual(errors,[])
    await page.screenshot({path:join(tmpdir(),`cg-my-day-workspace-${width}.png`),fullPage:true})
    await page.close()
    console.log(`PASS ${width}px: hierarchy, truthful empty state, no overflow or runtime error`)
  }
} finally { if(browser) await browser.close(); await server.close() }
