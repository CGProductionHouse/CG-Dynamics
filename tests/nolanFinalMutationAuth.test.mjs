import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startNolanIsolatedAcceptance} from '../scripts/helpers/nolanIsolatedAcceptance.mjs'

test('debrief, sync creation/calendar and deterministic in-flight revocation', {skip:process.env.RUN_NOLAN_SOURCE_POLICY_TESTS!=='1',timeout:240000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nolan-final-mutation-'))
 const app=await startNolanIsolatedAcceptance('http://127.0.0.1:1',join(dir,'replay.json')),tokens={}
 try{
  app.policyAcceptance.applyDraft();app.policyAcceptance.applyContentDraft();app.policyAcceptance.applyIdentityDraft();app.policyAcceptance.applyMutationDraft()
  const content=app.policyAcceptance.seedContentRoutes(),runId=app.policyAcceptance.seedMutationRun()
  const call=async(role,name,body)=>{
   const r=await app.exchange(3000,'/rpc/'+name,{method:'POST',headers:{authorization:'Bearer '+tokens[role]},body})
   return {status:r.status,data:r.body.length?JSON.parse(r.body):null}
  }
  const read=async(table,id)=>{const r=await app.exchange(3000,'/'+table+'?id=eq.'+id,{headers:{authorization:'Bearer '+tokens.admin}});assert.equal(r.status,200);return JSON.parse(r.body)[0]}
  const state=()=>({core:app.policyAcceptance.mutationState(),...app.policyAcceptance.finalMutationState()})
  const actions=note=>[{videoId:app.sources.videoId,action:'changed',note}]
  const sync=(key,destination,patch,id=null,action='create')=>({p_run_id:runId,p_item_key:key,p_destination:destination,p_destination_id:id,p_expected_updated_at:null,p_action:action,p_should_apply:true,p_patch:patch,p_source_type:destination==='cg_calendar'?'outlook':'planner',p_source_container_id:'synthetic-container',p_source_item_id:'synthetic-'+key,p_source_name:'Synthetic isolated source',p_source_complete:true,p_details:{synthetic:true}})
  for(const role of ['admin','manager','staff','client']){
   const a=app.accounts[role],r=await app.exchange(9999,'/token?grant_type=password',{method:'POST',body:{email:a.email,password:a.password}})
   assert.equal(r.status,200);tokens[role]=JSON.parse(r.body).access_token
  }
  await t.test('inactive admin, manager and author staff can finalize debriefs before draft',async()=>{
   for(const role of ['admin','manager','staff']){
    const id=app.policyAcceptance.seedDebrief('staff')
    app.policyAcceptance.setAccount(role,{active:false})
    const r=await call(role,'apply_content_run_debrief',{p_debrief_id:id,p_actions:actions('Synthetic inactive '+role)})
    assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.applied,1)
    const after=state();assert.equal(after.debriefs.find(d=>d.id===id).status,'applied');assert.match(after.core.video.production_note,new RegExp('Synthetic inactive '+role))
    app.policyAcceptance.setAccount(role)
   }
  })
  const created={}
  await t.test('active admin creates exact Planner, Client Schedule and Calendar records with idempotent ledgers',async()=>{
   const board=state().board_id
   const fixtures={
    planner:{board_id:board,client_id:app.sources.clientId,title:'Synthetic created Planner task',source:'manual',import_hash:'synthetic-created-'+app.plannerTaskId,status:'to_do',microsoft_source_type:'planner',microsoft_plan_id:'synthetic-plan',microsoft_task_id:'synthetic-created-task'},
    client_schedule:{client_id:app.sources.clientId,title:'Synthetic created schedule row',month:'2026-11-01',code:'V',instance_number:2,deliverable_type:'video',production_status:'to_do',microsoft_source_type:'planner',microsoft_plan_id:'synthetic-plan',microsoft_task_id:'synthetic-created-schedule'},
    cg_calendar:{client_id:app.sources.clientId,title:'Synthetic created internal event',event_type:'internal',start_at:'2026-11-16T10:00:00Z',end_at:'2026-11-16T11:00:00Z',all_day:false,status:'planned',microsoft_source_type:'outlook',microsoft_calendar_id:'synthetic-calendar',microsoft_event_id:'synthetic-event'},
   }
   for(const [destination,patch] of Object.entries(fixtures)){
    const body=sync('create-'+destination,destination,patch),before=state(),r=await call('admin','apply_microsoft_sync_item',body)
    assert.equal(r.status,200,JSON.stringify(r));assert.match(r.data,/^[0-9a-f-]{36}$/)
    created[destination]={id:r.data,body}
    const table={planner:'planner_tasks',client_schedule:'monthly_deliverables',cg_calendar:'company_calendar_events'}[destination]
    const row=await read(table,r.data);assert.equal(row.client_id,app.sources.clientId);assert.equal(row.title,patch.title);assert.equal(row.microsoft_sync_run_id,runId)
    if(destination==='planner')assert.equal(row.board_id,board)
    if(destination==='client_schedule'){assert.equal(row.month,'2026-11-01');assert.equal(row.instance_number,2)}
    if(destination==='cg_calendar'){assert.equal(row.event_type,'internal');assert.equal(row.client_visible,false)}
    const after=state();assert.equal(after.created.length,before.created.length+1);assert.equal(after.core.sync_items.length,before.core.sync_items.length+1);assert.equal(after.core.sync_items.find(i=>i.item_key===body.p_item_key).destination_id,r.data)
    assert.equal((await call('admin','apply_microsoft_sync_item',body)).data,r.data);assert.deepEqual(state(),after)
   }
  })
  await t.test('create/calendar denial has no effects for inactive or active unauthorized callers',async()=>{
   for(const role of ['admin','manager','staff','client']){
    app.policyAcceptance.setAccount(role,{active:false});const before=state()
    for(const {body} of Object.values(created))assert.equal((await call(role,'apply_microsoft_sync_item',{...body,p_item_key:'inactive-'+role+'-'+body.p_destination})).status,403)
    const calendar=created.cg_calendar
    assert.equal((await call(role,'apply_microsoft_sync_item',sync('inactive-calendar-update-'+role,'cg_calendar',{title:'Must not persist'},calendar.id,'update'))).status,403)
    assert.deepEqual(state(),before);app.policyAcceptance.setAccount(role)
    if(role!=='admin'){
     for(const {body} of Object.values(created))assert((await call(role,'apply_microsoft_sync_item',{...body,p_item_key:'unauthorized-'+role+'-'+body.p_destination})).status>=400)
     assert((await call(role,'apply_microsoft_sync_item',sync('unauthorized-calendar-update-'+role,'cg_calendar',{title:'Must not persist'},calendar.id,'update'))).status>=400)
     assert.deepEqual(state(),before)
    }
   }
  })
  await t.test('active Calendar update retains exact identity, CAS, retry and pause semantics',async()=>{
   const id=created.cg_calendar.id,row=await read('company_calendar_events',id)
   const body={...sync('calendar-update','cg_calendar',{title:'Synthetic updated internal event'},id,'update'),p_expected_updated_at:row.updated_at}
   const r=await call('admin','apply_microsoft_sync_item',body);assert.equal(r.status,200);assert.equal(r.data,null,'Existing update return behavior remains separate')
   const after=state();assert.equal((await read('company_calendar_events',id)).title,body.p_patch.title)
   assert.equal((await call('admin','apply_microsoft_sync_item',body)).status,200);assert.deepEqual(state(),after)
   const stale=await call('admin','apply_microsoft_sync_item',{...body,p_item_key:'calendar-stale',p_expected_updated_at:'2000-01-01T00:00:00Z'})
   assert(stale.status>=400);assert.match(stale.data.message,/changed after preview/);assert.deepEqual(state(),after)
   app.policyAcceptance.setMutationRunPaused(true)
   assert((await call('admin','apply_microsoft_sync_item',{...body,p_item_key:'calendar-paused'})).status>=400);assert.deepEqual(state(),after)
   app.policyAcceptance.setMutationRunPaused(false)
  })
  if(process.env.RUN_NOLAN_FINAL_DRAFT!=='1')return
  await t.test('debrief guard is idempotent and preserves every other definer and ACL',()=>{
   const before=app.policyAcceptance.audit();app.policyAcceptance.applyDebriefDraft();app.policyAcceptance.applyDebriefDraft();const after=app.policyAcceptance.audit()
   for(const f of before.source_definer_routes){const next=after.source_definer_routes.find(n=>n.proname===f.proname&&n.arguments===f.arguments);assert(next);assert.deepEqual(next.proacl,f.proacl);if(f.proname!=='apply_content_run_debrief')assert.equal(next.definition,f.definition);else {assert.equal(next.anon_execute,false);assert.equal(next.service_execute,false)}}
  })
  await t.test('inactive debrief calls deny with no effects; active roles/author checks and retry remain',async()=>{
   for(const role of ['admin','manager','staff','client']){
    const id=app.policyAcceptance.seedDebrief('staff'),body={p_debrief_id:id,p_actions:actions('Synthetic active '+role)}
    app.policyAcceptance.setAccount(role,{active:false});const before=state()
    assert.equal((await call(role,'apply_content_run_debrief',body)).status,403);assert.deepEqual(state(),before)
    app.policyAcceptance.setAccount(role)
    const r=await call(role,'apply_content_run_debrief',body)
    if(role==='client'){assert(r.status>=400);assert.deepEqual(state(),before)}else{
     assert.equal(r.status,200);assert.equal(r.data.applied,1);const after=state()
     assert((await call(role,'apply_content_run_debrief',body)).status>=400);assert.deepEqual(state(),after)
    }
   }
   const id=app.policyAcceptance.seedDebrief('admin'),before=state()
   assert((await call('staff','apply_content_run_debrief',{p_debrief_id:id,p_actions:actions('Wrong author')})).status>=400);assert.deepEqual(state(),before)
  })
  await t.test('mid-list foreign-video failure rolls back prior video change and debrief finalization',async()=>{
   const id=app.policyAcceptance.seedDebrief('staff'),before=state()
   const r=await call('staff','apply_content_run_debrief',{p_debrief_id:id,p_actions:[...actions('Must roll back'),{videoId:app.sources.foreignVideoId,action:'changed',note:'Wrong guideline'}]})
   assert(r.status>=400);assert.match(r.data.message,/no longer belongs/);assert.deepEqual(state(),before)
   assert.equal((await call('staff','apply_content_run_debrief',{p_debrief_id:id,p_actions:actions('Valid recovery')})).status,200)
  })
  for(const route of ['video','sync','debrief'])await t.test(route+' observed lock barrier distinguishes in-flight authorization from fresh requests after revocation commit',async()=>{
   const role=route==='sync'?'admin':'staff'
   const id=route==='debrief'?app.policyAcceptance.seedDebrief('staff'):null
   const name={video:'assistant_update_video',sync:'apply_microsoft_sync_item',debrief:'apply_content_run_debrief'}[route]
   const body=route==='video'?{p_run_id:content.runId,p_video_number:1,p_action:'changed',p_note:'Synthetic in-flight video'}:route==='sync'?sync('in-flight-sync','planner',{title:'Synthetic in-flight Planner update'},app.plannerTaskId,'update'):{p_debrief_id:id,p_actions:actions('Synthetic in-flight debrief')}
   const before=state(),r=await app.policyAcceptance.revocationBarrier(route,role,()=>call(role,name,body))
   assert(r.observedBlockingPid>0);assert.equal(r.result.status,200,JSON.stringify(r.result))
   const after=state()
   if(route==='video'){assert.equal(after.core.video_audits,before.core.video_audits+1);assert.match(after.core.video.production_note,/Synthetic in-flight video/)}
   if(route==='sync'){assert.equal(after.core.planner.title,'Synthetic in-flight Planner update');assert.equal(after.core.sync_items.length,before.core.sync_items.length+1)}
   if(route==='debrief')assert.equal(after.debriefs.find(d=>d.id===id).status,'applied')
   assert.equal((await call(role,name,body)).status,403);assert.deepEqual(state(),after)
   app.policyAcceptance.setAccount(role)
  })
  await t.test('profile-table barrier characterizes authorization snapshot timing',async()=>{
   const body=sync('authorization-barrier','planner',{title:'Synthetic authorization snapshot probe'},app.plannerTaskId,'update')
   const r=await app.policyAcceptance.revocationBarrier('authorization','admin',()=>call('admin','apply_microsoft_sync_item',body))
   t.diagnostic('Profile-table barrier RPC status: '+r.result.status)
   assert.equal(r.result.status,200,'Already-started statement retains its pre-revocation authorization snapshot')
   assert.equal(state().core.planner.title,body.p_patch.title)
   const after=state();assert.equal((await call('admin','apply_microsoft_sync_item',body)).status,403);assert.deepEqual(state(),after)
   app.policyAcceptance.setAccount('admin')
  })
  const final=state()
  assert.equal(final.debriefs.length,10);assert.equal(final.debriefs.filter(d=>d.status==='applied').length,8)
  assert.equal(final.core.sync_items.length,6);assert.equal(final.core.video_audits,1)
  t.diagnostic('Final synthetic effects: 3 sync-created records; '+final.core.sync_items.length+' ledger items; 8 applied/2 draft debriefs; 1 video audit. Rejected and repeated requests add none.')
 }finally{app.stop();await rm(dir,{recursive:true,force:true})}
})
