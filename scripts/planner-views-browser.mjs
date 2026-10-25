// Actual staff PlannerPage with synthetic data/auth adapters only. No API or production writes.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to a local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const adapter = `
 import React from 'react';
 export { PLANNER_TASK_STATUSES, PLANNER_TASK_STATUS_LABELS, PRIORITIES, plannerActivityStatusTransition } from '/src/lib/planner';
 export const useAuth = () => ({profile:new URLSearchParams(location.search).has('staff')?{id:'synthetic-person',role:'staff'}:{id:'staff',role:'admin'}});
 export const ClientPicker = () => null;
 export const isRecurringTemplate = () => false;
 export const materializeRecurringTasks = async () => { if(window.__recurrencePending) await new Promise(resolve=>{window.__finishRecurrence=resolve}); return {created:0,error:window.__recurrencePending?'Synthetic recurrence unavailable':null} };
 const boards = [{id:'ops',slug:'operations-todo',name:'Operations',sort_order:0},{id:'social',slug:'cg-socials',name:'CG Socials',sort_order:1}];
 export const listPlannerBoards = async () => ({data:boards,error:null});
 export const listPlannerBuckets = async id => ({data:[{id:id+'-bucket',board_id:id,name:'Studio work',sort_order:0}],error:null});
 export const listPlannerAssignmentDirectory = async () => ({data:[{id:'synthetic-person',full_name:'Synthetic Producer',role:'staff',is_active:true}],error:null});
 export const listPlannerCompletionEvidence = async () => ({data:{done:'2026-10-17T22:30:00Z'},error:null});
 export const listPlannerActivity = async () => ({data:[],error:null});
 const task = (id,title,start,due,status='to_do',board='ops') => ({id,title,source:'manual',board_id:board,bucket_id:board+'-bucket',status,priority:'normal',start_date:start,due_date:due,assignees:[],unresolved_assignee_names:[],assigned_to_name:null,client_name:'Synthetic Studio',client_id:null,checklist:[],notes:null,archived_at:null,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'});
 const tasks = [task('shoot','Studio shoot','2026-10-18','2026-10-20'),task('undated','Brief without date',null,null),task('invalid','Date needs correction','2026-02-30',null),task('done','Completed proof',null,'2026-10-17','done'),task('social-task','Other board production',null,'2026-10-19','to_do','social')];
 if(new URLSearchParams(location.search).has('graphChecklist')) tasks[0].checklist=[{title:'Source checked item',isChecked:true,orderHint:' !',lastModifiedDateTime:'2026-10-18T12:00:00Z'},{title:'Conflicting source flags',done:false,isChecked:true}];
 if(new URLSearchParams(location.search).has('imported'))Object.assign(tasks[0],{source:'microsoft_import',microsoft_plan_id:'synthetic-plan',microsoft_task_id:'synthetic-task'});
 if(new URLSearchParams(location.search).has('staff')) tasks[0].assignees=[{profile_id:'synthetic-person',full_name:'Synthetic Producer',role:'staff',is_active:true}];
 export const listPlannerTasks = async id => { window.__reads=(window.__reads??0)+1; if(window.__slow) await new Promise(resolve=>setTimeout(resolve,400)); return window.__readError ? {data:null,error:{message:'Synthetic read unavailable'}} : {data:tasks.filter(task=>task.board_id===id),error:null} };
 export const getPlannerTaskBoardId = async id => ({boardId:tasks.find(task=>task.id===id)?.board_id??null,error:null});
 const refuse = async () => { throw new Error('No production writes allowed in browser acceptance') };
 export const createPlannerTask=refuse;
 export const updatePlannerTaskStatus=async(id,status)=>{
   if(!window.__editFixture) return refuse();
   window.__writes=(window.__writes??0)+1;
   const task=tasks.find(task=>task.id===id); task.status=status;
   return {data:{...task},error:null};
 };
 export const archivePlannerTask=async id => {
   if(!window.__editFixture) return refuse();
   window.__archives=(window.__archives??0)+1;
   if(window.__pendingArchive) await new Promise(resolve=>{window.__finishArchive=resolve});
   if(window.__nullArchive) return {data:null,error:null};
   const task=tasks.find(task=>task.id===id);
   task.archived_at='2026-10-20T10:00:00Z';
   return {data:{...task},error:null};
 };
 export const updatePlannerTaskWithAssignees = async (id,input,expectedUpdatedAt) => {
   if(!window.__editFixture) return refuse();
   window.__writes=(window.__writes??0)+1;
   window.__expectedUpdatedAt=expectedUpdatedAt;
   if(window.__staleEdit)return {data:null,error:{message:'Task changed. Reload before saving; staff edits were preserved'}};
   window.__savedChecklist=structuredClone(input.checklist);
   if(window.__pendingSave) await new Promise(resolve=>{window.__finishSave=resolve});
   if(window.__nullSave) return {data:null,error:null};
   const task=tasks.find(task=>task.id===id);
   Object.assign(task,input,{updated_at:'2026-10-20T10:00:00Z',assignees:input.assignee_profile_ids.map(profile_id=>({profile_id,full_name:'Synthetic Producer',role:'staff',is_active:true}))});
   if(window.__failReadback) window.__readError=true;
   return {data:{...task},error:null};
 };
 export const isMissingPlannerAssignmentRpcError = () => false;
`
const fixture = {
  name: 'staff-planner-views-fixture', enforce: 'pre',
  resolveId(id) { if (id.startsWith('virtual:staff-planner-')) return `\0${id}` },
  transform(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/pages/admin/PlannerPage.tsx')) return
    return code.replace(/from '(\.\.\/\.\.\/(?:lib\/(?:planner|recurrence)|contexts\/AuthContext|components\/ClientPicker))'/g, "from 'virtual:staff-planner-adapter'")
  },
  load(id) {
    if (id === '\0virtual:staff-planner-adapter') return adapter
    if (id === '\0virtual:staff-planner-entry') return `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
      import PlannerPage from '/src/pages/admin/PlannerPage.tsx'; import '/src/index.css';
      const params=new URLSearchParams(location.search); window.__readError=params.has('readError'); window.__slow=params.has('slow'); window.__recurrencePending=params.has('recurrencePending'); window.__editFixture=params.has('editFixture');
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(PlannerPage)));
    `
  },
  configureServer(server) { server.middlewares.use((req,res,next) => {
    if (!req.url?.startsWith('/__staff-planner')) return next()
    res.setHeader('Content-Type','text/html')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#080e0d"><div id="root"></div><script type="module" src="/@id/virtual:staff-planner-entry"></script></body></html>')
  }) },
}
const server = await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-staff-planner-views-20261018'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:54041,strictPort:true,hmr:false}})
let browser
try {
  await server.listen()
  browser=await chromium.launch({headless:true})
  for (const width of [1440,375]) {
    const page=await browser.newPage({viewport:{width,height:900},timezoneId:'America/Los_Angeles'})
    await page.clock.install({time:new Date('2026-10-20T22:30:00Z')})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&plannerMonth=2026-10&scope=all')
    await page.getByRole('region',{name:'Planner grid'}).waitFor()
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Open task Completed proof',exact:true}).count(),0)
    const reads=await page.evaluate(()=>window.__reads)
    await page.getByRole('button',{name:'calendar',exact:true}).click()
    await page.getByRole('region',{name:'Planner calendar'}).waitFor()
    assert.equal(await page.getByRole('button',{name:/Open task Studio shoot on/}).count(),3)
    assert.equal(await page.getByRole('button',{name:/Open task Other board/}).count(),0)
    await page.getByRole('button',{name:'Open task Studio shoot on 2026-10-19',exact:true}).click()
    await page.locator('aside[aria-label="Task details"]').waitFor()
    assert.ok(page.url().includes('id=shoot'))
    await page.getByRole('button',{name:'Close task details',exact:true}).click()
    await page.getByRole('button',{name:'Next Planner month'}).click()
    await page.waitForURL(url=>url.searchParams.get('plannerMonth')==='2026-11')
    await page.waitForFunction(()=>document.querySelector('#planner-calendar-month')?.value==='2026-11')
    assert.equal(await page.getByLabel('Planner month',{exact:true}).inputValue(),'2026-11')
    assert.ok(page.url().includes('plannerMonth=2026-11'))
    await page.getByRole('button',{name:'charts',exact:true}).click()
    await page.getByRole('region',{name:'Planner charts'}).getByRole('heading',{name:'3 tasks',exact:true}).waitFor()
    await page.getByPlaceholder('Search tasks or people').fill('Studio shoot')
    await page.getByRole('region',{name:'Planner charts'}).getByRole('heading',{name:'1 task',exact:true}).waitFor()
    await page.getByRole('button',{name:'grid',exact:true}).click()
    await page.getByRole('region',{name:'Planner grid'}).waitFor()
    assert.equal(await page.getByRole('region',{name:'Planner grid'}).getByRole('row').count(),2)
    await page.getByPlaceholder('Search tasks or people').fill('')
    await page.getByRole('button',{name:'CG Socials',exact:true}).click()
    await page.getByRole('button',{name:'Open task Other board production',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).count(),0)
    await page.getByRole('button',{name:'Operations',exact:true}).click()
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__reads),reads+2,'view/filter/drawer switches do not re-fetch the board')
    await page.getByRole('button',{name:'calendar',exact:true}).click()
    await page.getByRole('region',{name:'Planner calendar'}).waitFor()
    assert.equal(await page.getByLabel('Planner month',{exact:true}).inputValue(),'2026-11')
    await page.getByRole('button',{name:'Previous Planner month'}).click()
    await page.waitForFunction(()=>document.querySelector('#planner-calendar-month')?.value==='2026-10')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px calendar root overflow`)
    await page.screenshot({path:join(tmpdir(),`cg-staff-planner-calendar-${width}.png`),fullPage:true})
    await page.getByRole('button',{name:'grid',exact:true}).click()
    await page.getByRole('region',{name:'Planner grid'}).waitFor()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px grid root overflow`)
    await page.screenshot({path:join(tmpdir(),`cg-staff-planner-grid-${width}.png`),fullPage:true})
    assert.equal(await page.evaluate(()=>window.__writes??0),0)
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&recurrencePending=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).waitFor()
    assert.ok(await page.evaluate(()=>typeof window.__finishRecurrence==='function'),'existing work appears while materialisation is still pending')
    await page.evaluate(()=>window.__finishRecurrence())
    await page.getByRole('alert').filter({hasText:'Synthetic recurrence unavailable'}).waitFor()
    assert.ok(await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).isVisible(),'recurrence error cannot hide saved work')
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=charts&readError=1')
    await page.getByRole('alert').getByText('Synthetic read unavailable').waitFor()
    assert.equal(await page.getByRole('region',{name:'Planner charts'}).count(),0,'read failure must not become zero tasks')
    assert.deepEqual(errors,[])
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&scope=overdue')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Open task Brief without date',exact:true}).count(),0)
    await page.goto('http://127.0.0.1:54041/__staff-planner')
    await page.getByRole('button',{name:'History 1',exact:true}).click()
    await page.getByText('Completed 18 Oct 2026',{exact:true}).waitFor({timeout:5000}).catch(async error=>{console.error(await page.locator('body').innerText(),errors);throw error})
    // Exercise real drawer controls, handlers and readback. Only the synthetic
    // data adapter is writable; all external requests remain blocked.
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=board&imported=1&editFixture=1')
    await page.getByText('Source checklist unverified',{exact:true}).waitFor()
    await page.getByRole('button').filter({hasText:'Studio shoot'}).click()
    let importedDrawer=page.locator('aside[aria-label="Task details"]')
    await importedDrawer.getByText(/an empty list does not mean there are no source items/).waitFor()
    await importedDrawer.getByPlaceholder('Add checklist item').fill('Preserved local staff item')
    await importedDrawer.getByRole('button',{name:'Add',exact:true}).click()
    await importedDrawer.getByRole('button',{name:'Save',exact:true}).click()
    await importedDrawer.waitFor({state:'detached'})
    assert.equal(await page.evaluate(()=>window.__expectedUpdatedAt),'2026-10-01T00:00:00Z')
    assert.deepEqual(await page.evaluate(()=>window.__savedChecklist),[{text:'Preserved local staff item',done:false}])
    await page.getByRole('button').filter({hasText:'Studio shoot'}).click()
    importedDrawer=page.locator('aside[aria-label="Task details"]')
    await importedDrawer.getByText('Preserved local staff item',{exact:true}).waitFor()
    await importedDrawer.getByLabel('Notes',{exact:true}).fill('Stale local notes')
    await page.evaluate(()=>{window.__staleEdit=true})
    await importedDrawer.getByRole('button',{name:'Save',exact:true}).click()
    await importedDrawer.getByText(/Task changed. Reload before saving; staff edits were preserved/).waitFor()
    assert.equal(await importedDrawer.getByLabel('Notes',{exact:true}).inputValue(),'Stale local notes')
    assert.equal(await page.evaluate(()=>window.__writes),2,'stale refusal must not trigger another save')
    await page.screenshot({path:join(tmpdir(),`cg-staff-source-checklist-unverified-${width}.png`),fullPage:true})
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&editFixture=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    let drawer=page.locator('aside[aria-label="Task details"]')
    await drawer.getByPlaceholder('Add checklist item').fill('Do not lose this unsaved item')
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.getByText('Add or clear the pending checklist item before saving.',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__writes??0),0,'pending checklist text must not be silently discarded')
    await drawer.getByRole('button',{name:'Add',exact:true}).click()
    await page.evaluate(()=>{window.__pendingSave=true;window.__failReadback=true})
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await page.waitForFunction(()=>typeof window.__finishSave==='function')
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('alertdialog').count(),0,'an in-flight save cannot be discarded')
    assert.ok(await drawer.isVisible())
    await page.evaluate(()=>window.__finishSave())
    await drawer.getByRole('button',{name:'Retry readback',exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__writes),1)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px recovery root overflow`)
    await page.screenshot({path:join(tmpdir(),`cg-staff-planner-readback-recovery-${width}.png`),fullPage:true})
    await page.evaluate(()=>{window.__readError=false;window.__failReadback=false})
    await drawer.getByRole('button',{name:'Retry readback',exact:true}).click()
    await drawer.waitFor({state:'detached'})
    assert.equal(await page.evaluate(()=>window.__writes),1,'readback retry must never repeat the mutation')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    await drawer.getByText('Do not lose this unsaved item',{exact:true}).waitFor()
    await drawer.getByRole('button',{name:'Close task details',exact:true}).click()
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&editFixture=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    await page.evaluate(()=>{window.__nullSave=true})
    await page.locator('aside').getByRole('button',{name:'Save',exact:true}).click()
    await page.locator('aside').getByText('The save response was not confirmed. Reload this task before trying another change.',{exact:true}).waitFor()
    assert.ok(await page.locator('aside').isVisible(),'null save must not close as success')
    assert.equal(await page.locator('aside').getByRole('button',{name:'Save',exact:true}).count(),0)
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&editFixture=1&graphChecklist=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    assert.ok(await drawer.getByRole('checkbox').isChecked(),'Graph isChecked must show complete')
    await drawer.getByText('Conflicting source flags (completion needs review)',{exact:true}).waitFor()
    await page.screenshot({path:join(tmpdir(),`cg-staff-planner-checklist-source-review-${width}.png`),fullPage:true})
    await drawer.getByLabel('Notes',{exact:true}).fill('Preserve source checklist metadata')
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.waitFor({state:'detached'})
    assert.deepEqual(await page.evaluate(()=>window.__savedChecklist),[{title:'Source checked item',isChecked:true,orderHint:' !',lastModifiedDateTime:'2026-10-18T12:00:00Z'},{title:'Conflicting source flags',done:false,isChecked:true}])
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    await drawer.getByRole('checkbox').uncheck()
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.waitFor({state:'detached'})
    assert.deepEqual(await page.evaluate(()=>window.__savedChecklist),[{title:'Source checked item',isChecked:false,orderHint:' !',lastModifiedDateTime:'2026-10-18T12:00:00Z'},{title:'Conflicting source flags',done:false,isChecked:true}])
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&staff=1&editFixture=1&graphChecklist=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    for(const label of ['Title','Notes','Start date','Due date']) assert.ok(await drawer.getByLabel(label,{exact:true}).isDisabled(),label+' must stay manager-only')
    assert.ok(await drawer.getByText('Priority',{exact:true}).locator('..').getByRole('combobox').isDisabled(),'staff priority control must stay disabled')
    assert.ok(await drawer.getByText('Bucket',{exact:true}).locator('..').getByRole('combobox').isDisabled(),'staff bucket control must stay disabled')
    assert.ok(await drawer.getByRole('checkbox').isDisabled(),'staff must not rewrite imported checklist metadata')
    assert.equal(await drawer.getByRole('button',{name:'Remove from active',exact:true}).count(),0)
    await drawer.getByLabel('Status',{exact:true}).selectOption('in_progress')
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.waitFor({state:'detached'})
    assert.equal(await page.evaluate(()=>window.__writes),1)
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    assert.equal(await drawer.getByLabel('Status',{exact:true}).inputValue(),'in_progress')
    assert.equal(await drawer.getByLabel('Due date',{exact:true}).inputValue(),'2026-10-20')
    assert.ok(await drawer.getByRole('checkbox').isChecked())
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&plannerMonth=2026-10&editFixture=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    await drawer.getByLabel('Title',{exact:true}).fill('Reviewed production task')
    await drawer.getByLabel('Start date',{exact:true}).fill('2026-10-22')
    await drawer.getByLabel('Due date',{exact:true}).fill('2026-10-21')
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.getByText('Start date cannot be after the due date.',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__writes??0),0)
    await drawer.getByLabel('Due date',{exact:true}).fill('2026-10-23')
    await drawer.getByLabel('Notes',{exact:true}).fill('Exact staff production instructions')
    await drawer.getByPlaceholder('Add checklist item').fill('Verify the final cut')
    await drawer.getByRole('button',{name:'Add',exact:true}).click()
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('combobox',{name:'Assignees',exact:true}).fill('Synthetic Producer')
    await drawer.getByRole('option').filter({hasText:'Synthetic Producer'}).click()
    await drawer.getByLabel('Status',{exact:true}).selectOption('in_progress')
    await drawer.getByRole('button',{name:'Save',exact:true}).click()
    await drawer.waitFor({state:'detached'})
    assert.equal(await page.evaluate(()=>window.__writes),1)
    await page.getByRole('button',{name:'Open task Reviewed production task',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    assert.equal(await drawer.getByLabel('Notes',{exact:true}).inputValue(),'Exact staff production instructions')
    assert.equal(await drawer.getByLabel('Start date',{exact:true}).inputValue(),'2026-10-22')
    assert.equal(await drawer.getByLabel('Due date',{exact:true}).inputValue(),'2026-10-23')
    assert.equal(await drawer.getByLabel('Status',{exact:true}).inputValue(),'in_progress')
    assert.ok(await drawer.getByRole('checkbox').isChecked())
    await drawer.getByRole('button',{name:'Remove Synthetic Producer',exact:true}).waitFor()
    await drawer.getByRole('button',{name:'Close task details',exact:true}).click()
    await page.getByRole('button',{name:'calendar',exact:true}).click()
    await page.getByRole('button',{name:'Open task Reviewed production task on 2026-10-22',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:/Open task Reviewed production task on/}).count(),2)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px recovered drawer/calendar root overflow`)
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&editFixture=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    await page.evaluate(()=>{window.__pendingArchive=true})
    await drawer.getByRole('button',{name:'Remove from active',exact:true}).click()
    const confirm=drawer.getByRole('button',{name:'Confirm remove',exact:true})
    await confirm.dispatchEvent('click')
    await confirm.dispatchEvent('click')
    await page.waitForFunction(()=>typeof window.__finishArchive==='function')
    assert.equal(await page.evaluate(()=>window.__archives),1,'rapid remove clicks must issue one mutation')
    await page.evaluate(()=>window.__finishArchive())
    await drawer.waitFor({state:'detached'})
    await page.goto('http://127.0.0.1:54041/__staff-planner?plannerView=grid&editFixture=1')
    await page.getByRole('button',{name:'Open task Studio shoot',exact:true}).click()
    drawer=page.locator('aside[aria-label="Task details"]')
    await page.evaluate(()=>{window.__nullArchive=true})
    await drawer.getByRole('button',{name:'Remove from active',exact:true}).click()
    await drawer.getByRole('button',{name:'Confirm remove',exact:true}).click()
    await drawer.getByText('Removal was not confirmed. Reload this task before trying another change.',{exact:true}).waitFor()
    await drawer.getByRole('button',{name:'Retry readback',exact:true}).waitFor()
    assert.deepEqual(errors,[])
    await page.close()
    console.log(`PASS ${width}px: actual PlannerPage views/filters/board isolation, assignment/date/status/notes/checklist save+readback, date refusal, pending-text retention, null-save refusal, write-once/readback-only recovery, in-flight close guard, no overflow; synthetic local mutations only`)
  }
} finally { if(browser) await browser.close(); await server.close() }
