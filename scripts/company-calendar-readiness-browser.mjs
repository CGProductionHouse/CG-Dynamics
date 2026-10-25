// Actual CG Calendar; synthetic data/auth only. No external requests or live writes.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Local Playwright module required')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const adapter = `
 import React from 'react';
 import {businessDateKey} from '/src/lib/businessTime';
 export {EVENT_TYPES,EVENT_TYPE_LABELS,EVENT_STATUS_LABELS} from '/src/lib/companyCalendar';
 export {PLANNER_TASK_STATUS_LABELS} from '/src/lib/planner';
 export const useAuth=()=>({profile:{id:'synthetic-person',role:new URLSearchParams(location.search).has('staff')?'staff':'admin'}});
 export const ClientPicker=()=>null;
 export const listCompanyEvents=async from=>{const month=businessDateKey(from).slice(0,7);const editing=new URLSearchParams(location.search).has('edit');const event={id:'event',title:'Verified studio meeting '+month,event_type:'meeting',start_at:month+'-20T08:00:45.123Z',end_at:editing?null:month+'-20T09:00:00Z',all_day:false,status:'confirmed',client_id:null,client_name:null,location:'',notes:null,assigned_to_name:'  Existing staff  ',linked_task_id:null,updated_at:'2026-10-20T11:00:00Z',...(editing?{microsoft_source_type:'outlook_event',microsoft_event_id:'synthetic-source-event',microsoft_calendar_id:'synthetic-calendar'}:{})};window.__event=window.__savedEvent??event;return {data:[window.__event,...(window.__createdEvent?[window.__createdEvent]:[])],error:null}};
 export const materializeRecurringTasks=async()=>{window.__recurrenceCalls=(window.__recurrenceCalls??0)+1;await new Promise(resolve=>{window.__finishRecurrence=resolve});return {created:0,error:'Synthetic recurrence unavailable',migrationNeeded:false}};
 export const listPlannerTasksDueBetween=async start=>{
   window.__taskReads=(window.__taskReads??0)+1;
   if(window.__holdTaskRead) await new Promise(resolve=>{window.__finishTaskRead=resolve});
   if(window.__taskReadError)return {data:null,error:{message:'Synthetic read unavailable'}};
   const month=start.slice(0,7);
   return {data:['approved','scheduled','to_do','done'].map(status=>({id:status+'-'+month,title:'Exact '+status+' task '+month,due_date:month+'-20',status,client_id:null,assigned_to_name:null})),error:null};
 };
 const refuse=async()=>{window.__writes=(window.__writes??0)+1;throw Error('No live writes allowed')};
 export const updateCompanyEvent=async(id,patch,expectedUpdatedAt)=>{
   if(!new URLSearchParams(location.search).has('edit'))return refuse();
   window.__patch=patch;window.__expectedUpdatedAt=expectedUpdatedAt;window.__writes=(window.__writes??0)+1;
   if(window.__holdSave)await new Promise(resolve=>{window.__finishSave=resolve});
   if(window.__staleEvent)return {data:null,error:{message:'Event changed or is no longer available. Reload before saving.'}};
   if(window.__nullSave)return {data:null,error:null};
   if(patch.status==='cancelled'){
     window.__cancelCalls=(window.__cancelCalls??0)+1;
     if(window.__foreignCancel)return {data:{id:'different-event',status:'cancelled'},error:null};
     if(window.__unconfirmedCancel)return {data:{id,status:'confirmed'},error:null};
     if(window.__throwCancel)throw Error('Synthetic cancellation transport failure');
     if(window.__holdCancel)await new Promise(resolve=>{window.__finishCancel=resolve});
   }
   window.__savedEvent={...window.__event,...patch};return {data:window.__savedEvent,error:null};
 };
 export const createCompanyEvent=async(input,id)=>{
   if(!new URLSearchParams(location.search).has('create'))return refuse();
   window.__createCalls=(window.__createCalls??0)+1;window.__creationId=id;
   window.__createdEvent={...input,id,updated_at:'2026-10-25T12:00:00.123456Z'};
   const mode=new URLSearchParams(location.search).get('mode');
   if(mode==='throw')throw Error('Synthetic lost create response');
   if(mode==='error')return {data:null,error:{message:'Synthetic creation response unavailable'}};
   if(mode==='success')return {data:window.__createdEvent,error:null};
   return {data:null,error:null};
 };
 export const getCompanyEvent=async id=>{
   window.__readIds=[...(window.__readIds??[]),id];
   const row=window.__createdEvent;
   if(window.__readMode==='throw')throw Error('Synthetic read unavailable');
   if(window.__readMode==='missing')return {data:null,error:null};
   if(window.__readMode==='denied')return {data:null,error:{message:'Synthetic denied'}};
   if(window.__readMode==='foreign')return {data:{...row,id:'foreign-event'},error:null};
   if(window.__readMode==='client')return {data:{...row,client_id:'foreign-client'},error:null};
   return {data:row??null,error:null};
 };
 export const deleteCompanyEvent=refuse,supersedeNativeCompanyEvent=refuse,setCompanyEventClientVisibility=refuse;
`
const fixture={
 name:'company-calendar-readiness',enforce:'pre',
 resolveId(id){if(id.startsWith('virtual:company-calendar-'))return '\0'+id},
 transform(code,id){if(!id.replaceAll('\\','/').endsWith('/pages/admin/CompanyCalendarPage.tsx'))return;if(process.env.CG_CALENDAR_BASELINE==='1')code=execFileSync('git',['show','HEAD:src/pages/admin/CompanyCalendarPage.tsx'],{encoding:'utf8'});return code.replace(/from '(\.\.\/\.\.\/(?:lib\/(?:companyCalendar|planner|recurrence)|contexts\/AuthContext|components\/ClientPicker))'/g,"from 'virtual:company-calendar-data'")},
 load(id){if(id==='\0virtual:company-calendar-data')return adapter;if(id==='\0virtual:company-calendar-entry')return `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from '/src/pages/admin/CompanyCalendarPage.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page)));`},
 configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__company-calendar'))return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#080e0d"><div id="root"></div><script type="module" src="/@id/virtual:company-calendar-entry"></script></body></html>')})},
}
const server=await createServer({configFile:false,plugins:[fixture,react()],cacheDir:join(tmpdir(),'cg-company-calendar-readiness-20261020'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom']},server:{host:'127.0.0.1',port:54043,strictPort:true,hmr:false}})
let browser
try{
 await server.listen();browser=await chromium.launch({headless:true})
 for(const width of [1440,375]){
  const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Pacific/Kiritimati'}),errors=[]
  page.on('pageerror',e=>{errors.push(e.message);console.error('Local calendar page error:',e.message)})
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort())
  await page.goto('http://127.0.0.1:54043/__company-calendar')
  await page.getByRole('heading',{name:'CG Calendar',exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.__taskReads??0),0,'task layer stays opt-in')
  await page.locator('input[type=month]').fill('2026-10')
  await page.getByRole('button',{name:'Next',exact:true}).click()
  assert.equal(await page.locator('input[type=month]').inputValue(),'2026-11','Next month cannot depend on the browser timezone')
  await page.getByRole('button',{name:'Prev',exact:true}).click()
  assert.equal(await page.locator('input[type=month]').inputValue(),'2026-10')
  await page.getByRole('checkbox',{name:/Planner tasks/}).check()
  await page.getByRole('button',{name:'agenda',exact:true}).click()
  const approved=page.getByRole('link').filter({hasText:'Exact approved task 2026-10'})
  await approved.waitFor({timeout:5000})
  assert.ok(await page.evaluate(()=>typeof window.__finishRecurrence==='function'),'saved work is visible before recurrence settles')
  assert.equal(new URL(await approved.getAttribute('href'),'http://local').searchParams.get('id'),'approved-2026-10')
  assert.equal(await page.getByText('Exact done task 2026-10',{exact:true}).count(),0)
  await page.getByRole('link').filter({hasText:'Exact scheduled task 2026-10'}).waitFor()
  await page.evaluate(()=>window.__finishRecurrence())
  await page.getByText('Recurring tasks could not be refreshed.',{exact:true}).waitFor()
  assert.ok(await approved.isVisible(),'recurrence failure cannot hide active work')
  await page.evaluate(()=>{window.__holdTaskRead=true})
  await page.locator('input[type=month]').fill('2026-11')
  await page.waitForFunction(()=>typeof window.__finishTaskRead==='function')
  assert.equal(await page.getByText('Exact approved task 2026-10',{exact:true}).count(),0,'old month rows cannot appear in a new month')
  await page.evaluate(()=>window.__finishTaskRead())
  await page.getByRole('link').filter({hasText:'Exact approved task 2026-11'}).waitFor()
  await page.evaluate(()=>{window.__holdTaskRead=false;window.__taskReadError=true})
  await page.locator('input[type=month]').fill('2026-12')
  await page.getByText('Dated tasks could not be loaded.',{exact:true}).waitFor()
  assert.equal(await page.getByRole('checkbox',{name:'Planner tasks (0)',exact:true}).count(),0,'unavailable tasks must not be a verified zero')
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-12'}).waitFor()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px root overflow')
  await page.screenshot({path:join(tmpdir(),`cg-company-calendar-independent-errors-${width}.png`),fullPage:true})
  assert.equal(await page.evaluate(()=>window.__writes??0),0)
  await page.goto('http://127.0.0.1:54043/__company-calendar?staff=1')
  await page.getByRole('heading',{name:'CG Calendar',exact:true}).waitFor()
  await page.locator('input[type=month]').fill('2026-10')
  await page.getByRole('checkbox',{name:/Planner tasks/}).check()
  await page.getByRole('button',{name:'agenda',exact:true}).click()
  await page.getByRole('link').filter({hasText:'Exact approved task 2026-10'}).waitFor()
  assert.equal(await page.evaluate(()=>window.__recurrenceCalls??0),0,'ordinary staff reads cannot materialise instances')
  assert.equal(await page.getByRole('button',{name:'+ Add Event',exact:true}).count(),0)
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).click()
  await page.getByRole('heading',{name:'Event details',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Cancel this event',exact:true}).count(),0,'ordinary staff cannot cancel meetings')
  await page.goto('http://127.0.0.1:54043/__company-calendar?edit=1')
  await page.getByRole('heading',{name:'CG Calendar',exact:true}).waitFor()
  await page.locator('input[type=month]').fill('2026-10')
  await page.getByRole('button',{name:'agenda',exact:true}).click()
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).click()
  const drawer=page.locator('fieldset').locator('..')
  await drawer.locator('textarea').fill('Unsaved calendar wording')
  await page.keyboard.press('Escape')
  const discardDialog=page.getByRole('alertdialog',{name:'Discard unsaved calendar changes?',exact:true})
  await discardDialog.waitFor({timeout:5000})
  assert.ok(await discardDialog.getByRole('button',{name:'Stay',exact:true}).evaluate(element=>element===document.activeElement),'discard defaults to keeping edits')
  await page.keyboard.press('Shift+Tab')
  assert.ok(await discardDialog.getByRole('button',{name:'Discard changes',exact:true}).evaluate(element=>element===document.activeElement))
  await page.keyboard.press('Tab')
  assert.ok(await discardDialog.getByRole('button',{name:'Stay',exact:true}).evaluate(element=>element===document.activeElement),'keyboard focus stays inside the discard decision')
  await discardDialog.getByRole('button',{name:'Stay',exact:true}).click()
  assert.equal(await drawer.locator('textarea').inputValue(),'Unsaved calendar wording','Escape cannot discard staff wording')
  assert.equal(await page.evaluate(()=>window.__writes??0),0)
  await page.getByTestId('company-event-backdrop').dispatchEvent('click')
  await discardDialog.waitFor()
  await page.screenshot({path:join(tmpdir(),`cg-calendar-unsaved-discard-${width}.png`),fullPage:true})
  await discardDialog.getByRole('button',{name:'Stay',exact:true}).click()
  await page.getByRole('button',{name:'Close event details',exact:true}).click()
  await discardDialog.waitFor()
  await discardDialog.getByRole('button',{name:'Discard changes',exact:true}).click()
  await page.getByRole('heading',{name:'Edit Event',exact:true}).waitFor({state:'hidden'})
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).click()
  await drawer.locator('textarea').fill('Local reviewed note')
  await page.evaluate(()=>{window.__holdSave=true})
  await drawer.getByRole('button',{name:'Save',exact:true}).click()
  await page.waitForFunction(()=>typeof window.__finishSave==='function')
  await page.keyboard.press('Escape')
  await page.getByTestId('company-event-backdrop').dispatchEvent('click')
  assert.equal(await page.getByRole('heading',{name:'Edit Event',exact:true}).count(),1,'Escape/backdrop cannot close an in-flight save')
  assert.ok(await page.getByRole('button',{name:'Close event details',exact:true}).isDisabled())
  assert.ok(await drawer.getByRole('button',{name:'Close',exact:true}).isDisabled())
  assert.ok(await drawer.locator('textarea').isDisabled(),'staff text cannot change while an in-flight save may close the drawer')
  assert.equal(await discardDialog.count(),0,'pending write is not presented as a discard decision')
  assert.equal(await page.evaluate(()=>window.__writes),1,'close attempts never retry the write')
  await page.evaluate(()=>{window.__holdSave=false;window.__finishSave()})
  await page.getByRole('heading',{name:'Edit Event',exact:true}).waitFor({state:'hidden'})
  assert.deepEqual(await page.evaluate(()=>window.__patch),{notes:'Local reviewed note'},'notes-only save must not resubmit source timestamps or untouched staff fields')
  assert.equal(await page.evaluate(()=>window.__savedEvent.start_at),'2026-10-20T08:00:45.123Z')
  assert.equal(await page.evaluate(()=>window.__savedEvent.end_at),null)
  assert.equal(await page.evaluate(()=>window.__savedEvent.assigned_to_name),'  Existing staff  ')
  assert.equal(await page.evaluate(()=>window.__expectedUpdatedAt),'2026-10-20T11:00:00Z')
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).click()
  await drawer.getByText(/Saving here does not send invitations/).waitFor()
  await drawer.getByText(/Outlook remains the source/).waitFor()
  await drawer.locator('textarea').fill('Local unverified save')
  await page.evaluate(()=>{window.__nullSave=true})
  await drawer.getByRole('button',{name:'Save',exact:true}).click()
  await drawer.getByText('Save could not be verified. Check the calendar before trying again.',{exact:true}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'Edit Event',exact:true}).count(),1,'null saved row is not success')
  await page.evaluate(()=>{window.__nullSave=false;window.__staleEvent=true})
  await drawer.getByRole('button',{name:'Save',exact:true}).click()
  await drawer.getByText('Event changed or is no longer available. Reload before saving.',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.__savedEvent.notes),'Local reviewed note','stale drawer cannot overwrite the saved staff edit')
  await drawer.locator('fieldset').evaluate(e=>{e.scrollTop=0})
  await page.screenshot({path:join(tmpdir(),`cg-company-calendar-metadata-meeting-${width}.png`),fullPage:true})
  assert.equal(await drawer.getByRole('button',{name:'Delete',exact:true}).count(),0,'normal drawer must not hard-delete audit/source-linked history')
  await drawer.getByRole('button',{name:'Cancel this event',exact:true}).click()
  await drawer.getByText('Keep this record in Cancelled. No invitations or Outlook cancellation will be sent.',{exact:true}).waitFor()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px cancellation confirmation overflow')
  await page.screenshot({path:join(tmpdir(),`cg-company-calendar-cancellation-confirm-${width}.png`),fullPage:true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await drawer.getByText('Save your changes or close and reopen before cancelling this event.',{exact:true}).waitFor()
  assert.equal(await drawer.locator('textarea').inputValue(),'Local unverified save','cancellation must not discard unsaved staff wording')
  await drawer.locator('textarea').fill('Local reviewed note')
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await drawer.getByText('Event changed or is no longer available. Reload before saving.',{exact:true}).waitFor()
  assert.deepEqual(await page.evaluate(()=>window.__patch),{status:'cancelled'},'cancellation cannot resubmit unsaved staff notes or source fields')
  assert.equal(await drawer.locator('textarea').inputValue(),'Local reviewed note')
  await page.evaluate(()=>{window.__staleEvent=false;window.__nullSave=true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  const cancelUnverified=drawer.getByText('Cancellation could not be verified. Check the calendar before trying again.',{exact:true})
  await cancelUnverified.waitFor()
  await page.evaluate(()=>{window.__nullSave=false;window.__foreignCancel=true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await cancelUnverified.waitFor()
  await page.evaluate(()=>{window.__foreignCancel=false;window.__unconfirmedCancel=true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await cancelUnverified.waitFor()
  await page.evaluate(()=>{window.__unconfirmedCancel=false;window.__throwCancel=true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await drawer.getByText('Could not cancel event. Check the calendar before trying again.',{exact:true}).waitFor()
  await page.evaluate(()=>{window.__throwCancel=false;window.__holdCancel=true})
  await drawer.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await page.waitForFunction(()=>typeof window.__finishCancel==='function')
  assert.ok(await drawer.getByRole('button',{name:'Save',exact:true}).isDisabled(),'pending cancellation cannot race a notes save')
  assert.ok(await drawer.getByRole('button',{name:'Cancelling...',exact:true}).isDisabled())
  assert.ok(await drawer.getByRole('button',{name:'Keep event',exact:true}).isDisabled())
  assert.ok(await drawer.locator('textarea').isDisabled(),'cancellation cannot discard edits typed after its request started')
  await page.keyboard.press('Escape')
  await page.getByTestId('company-event-backdrop').dispatchEvent('click')
  assert.equal(await page.getByRole('heading',{name:'Edit Event',exact:true}).count(),1,'in-flight cancellation cannot be hidden by close paths')
  await page.evaluate(()=>window.__finishCancel())
  await page.getByRole('heading',{name:'Edit Event',exact:true}).waitFor({state:'hidden'})
  await page.locator('label').filter({hasText:'Event type'}).locator('select').selectOption('cancelled')
  await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).click()
  await page.getByRole('heading',{name:'Edit Event',exact:true}).waitFor()
  assert.equal(await drawer.getByRole('button',{name:'Cancel this event',exact:true}).count(),0,'already cancelled record cannot produce another cancellation')
  assert.equal(await drawer.locator('textarea').inputValue(),'Local reviewed note','cancelling preserves saved notes, not unsaved drawer text')
  assert.equal(await page.evaluate(()=>window.__savedEvent.microsoft_event_id),'synthetic-source-event')
  assert.equal(await page.evaluate(()=>window.__savedEvent.start_at),'2026-10-20T08:00:45.123Z')
  assert.equal(await page.evaluate(()=>window.__savedEvent.end_at),null)
  assert.equal(await page.evaluate(()=>window.__savedEvent.assigned_to_name),'  Existing staff  ')
  assert.equal(await page.evaluate(()=>window.__expectedUpdatedAt),'2026-10-20T11:00:00Z')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px cancellation overflow')
  await page.screenshot({path:join(tmpdir(),`cg-company-calendar-cancelled-history-${width}.png`),fullPage:true})
  await drawer.locator('select').filter({has:page.locator('option[value="confirmed"]')}).selectOption('confirmed')
  await drawer.getByRole('button',{name:'Save',exact:true}).click()
  await page.getByRole('heading',{name:'Edit Event',exact:true}).waitFor({state:'hidden'})
  assert.deepEqual(await page.evaluate(()=>window.__patch),{status:'confirmed'},'restoring is a revision-fenced update of the SAME row')
  assert.equal(await page.evaluate(()=>window.__savedEvent.id),'event')
  assert.equal(await page.evaluate(()=>window.__savedEvent.notes),'Local reviewed note')
  await page.locator('label').filter({hasText:'Event type'}).locator('select').selectOption('all')
  assert.equal(await page.getByRole('button').filter({hasText:'Verified studio meeting 2026-10'}).count(),1,'cancel/restore never creates another calendar card')
  for(const response of ['null','error','throw','success']){
    await page.goto('http://127.0.0.1:54043/__company-calendar?create=1&mode='+response)
    await page.getByRole('heading',{name:'CG Calendar',exact:true}).waitFor()
    await page.locator('input[type=month]').fill('2026-10')
    await page.getByRole('button',{name:'agenda',exact:true}).click()
    await page.getByRole('button',{name:'+ Add Event',exact:true}).click()
    await drawer.locator('input').first().fill('One local creation attempt')
    await drawer.locator('textarea').fill('Original unsent wording')
    await drawer.getByRole('button',{name:'Create Event',exact:true}).click()
    if(response==='success'){
      await page.getByRole('heading',{name:'Add Event',exact:true}).waitFor({state:'hidden'})
      assert.equal(await page.evaluate(()=>window.__createCalls),1)
      assert.equal(await page.getByRole('button').filter({hasText:'One local creation attempt'}).count(),1)
      continue
    }
    await drawer.getByRole('button',{name:'Retry readback',exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__createCalls),1)
    assert.match(await page.evaluate(()=>window.__creationId),/^[0-9a-f-]{36}$/)
    assert.equal(await drawer.getByRole('button',{name:'Create Event',exact:true}).count(),0)
    assert.ok(await drawer.locator('textarea').isDisabled())
    await page.keyboard.press('Escape')
    const unknownSave=page.getByRole('alertdialog',{name:'Leave unverified calendar save?',exact:true})
    await unknownSave.waitFor()
    await unknownSave.getByText(/The event may already exist/).waitFor()
    await unknownSave.getByRole('button',{name:'Stay',exact:true}).click()
    for(const mode of ['missing','denied','foreign','client','throw']){
      await page.evaluate(mode=>{window.__readMode=mode},mode)
      await drawer.getByRole('button',{name:'Retry readback',exact:true}).click()
      await drawer.getByText(mode==='throw'?'Readback is unavailable. No additional event was submitted.':'The exact event is still unverified. Retry readback or check the calendar; no additional event was submitted.',{exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>window.__createCalls),1,'readback cannot repeat creation')
    }
    await page.evaluate(()=>{window.__readMode=null;window.__createdEvent.notes='Newer staff wording'})
    await page.screenshot({path:join(tmpdir(),`cg-calendar-creation-readback-${response}-${width}.png`),fullPage:true})
    await drawer.getByRole('button',{name:'Retry readback',exact:true}).click()
    await page.getByRole('heading',{name:'Add Event',exact:true}).waitFor({state:'hidden'})
    assert.equal(await page.getByRole('button').filter({hasText:'One local creation attempt'}).count(),1)
    assert.equal(await page.evaluate(()=>window.__createCalls),1)
    assert.ok(await page.evaluate(()=>window.__readIds.every(id=>id===window.__creationId)))
    assert.equal(await page.evaluate(()=>window.__createdEvent.notes),'Newer staff wording')
  }
  assert.deepEqual(errors,[])
  await page.close();console.log('PASS '+width+'px: actual Calendar layers/month/save/cancel/history/dirty-close guards; creation success and null/error/lost-response recovery use one insert with exact-ID read-only retries, cross-client refusal and newer staff preservation. Local adapter only; zero live writes.')
 }
}finally{await browser?.close();await server.close()}
