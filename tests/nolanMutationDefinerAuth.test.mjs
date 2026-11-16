import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startNolanIsolatedAcceptance} from '../scripts/helpers/nolanIsolatedAcceptance.mjs'

test('bounded video and Microsoft mutation routes with retained genuine GoTrue JWTs', {skip:process.env.RUN_NOLAN_SOURCE_POLICY_TESTS!=='1',timeout:180000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nolan-mutation-policy-'))
 const app=await startNolanIsolatedAcceptance('http://127.0.0.1:1',join(dir,'replay.json')),tokens={}
 try{
  app.policyAcceptance.applyDraft();app.policyAcceptance.applyContentDraft();app.policyAcceptance.applyIdentityDraft()
  const content=app.policyAcceptance.seedContentRoutes(),runId=app.policyAcceptance.seedMutationRun()
  const call=async(role,name,body)=>{
   const r=await app.exchange(3000,'/rpc/'+name,{method:'POST',headers:{authorization:'Bearer '+tokens[role]},body})
   return {status:r.status,data:r.body.length?JSON.parse(r.body):null}
  }
  const video=(note,action='shot')=>({p_run_id:content.runId,p_video_number:1,p_action:action,p_note:note})
  const sync=(key,destination='planner',title='Synthetic mutation '+key)=>({p_run_id:runId,p_item_key:key,p_destination:destination,p_destination_id:destination==='planner'?app.plannerTaskId:app.sources.deliverableId,p_expected_updated_at:null,p_action:'update',p_should_apply:true,p_patch:{title},p_source_type:'planner',p_source_container_id:'synthetic-container',p_source_item_id:'synthetic-'+destination,p_source_name:'Synthetic local source',p_source_complete:true,p_details:{synthetic:true}})
  for(const role of ['admin','manager','staff','client']){
   const a=app.accounts[role],r=await app.exchange(9999,'/token?grant_type=password',{method:'POST',body:{email:a.email,password:a.password}})
   assert.equal(r.status,200);tokens[role]=JSON.parse(r.body).access_token
  }
  await t.test('inactive workforce video mutations persist status, notes and actor audit despite source RLS',async()=>{
   for(const role of ['admin','manager','staff']){
    app.policyAcceptance.setAccount(role,{active:false})
    const before=app.policyAcceptance.mutationState(),r=await call(role,'assistant_update_video',video('Synthetic inactive '+role))
    assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.id,app.sources.videoId)
    const after=app.policyAcceptance.mutationState();assert.equal(after.video.production_status,'shot');assert.match(after.video.production_note,new RegExp('Synthetic inactive '+role));assert.equal(after.video_audits,before.video_audits+1)
    app.policyAcceptance.setAccount(role)
   }
  })
  await t.test('inactive admin sync mutates exact Planner and schedule rows and appends ledger',async()=>{
   app.policyAcceptance.setAccount('admin',{active:false})
   for(const destination of ['planner','client_schedule']){
    const body=sync('baseline-'+destination,destination),before=app.policyAcceptance.mutationState(),r=await call('admin','apply_microsoft_sync_item',body)
    assert.equal(r.status,200,JSON.stringify(r))
    const after=app.policyAcceptance.mutationState();assert.equal(after[destination==='planner'?'planner':'monthly'].title,body.p_patch.title);assert.equal(after.sync_items.length,before.sync_items.length+1)
    t.diagnostic(destination+' existing update return value '+JSON.stringify(r.data))
   }
   app.policyAcceptance.setAccount('admin')
  })
  await t.test('active unauthorized roles cannot mutate either route',async()=>{
   const before=app.policyAcceptance.mutationState()
   assert((await call('client','assistant_update_video',video('Unauthorized'))).status>=400)
   for(const role of ['manager','staff','client'])assert((await call(role,'apply_microsoft_sync_item',sync('unauthorized-'+role))).status>=400)
   assert.deepEqual(app.policyAcceptance.mutationState(),before)
  })
  if(process.env.RUN_NOLAN_MUTATION_DRAFT!=='1')return
  const before=app.policyAcceptance.audit()
  await t.test('apply idempotently without changing grants or any other definer body',()=>{
   app.policyAcceptance.applyMutationDraft();app.policyAcceptance.applyMutationDraft()
   const after=app.policyAcceptance.audit()
   for(const f of before.source_definer_routes){
    const next=after.source_definer_routes.find(n=>n.proname===f.proname&&n.arguments===f.arguments)
    assert(next);assert.deepEqual(next.proacl,f.proacl);assert.equal(next.service_execute,f.service_execute);assert.equal(next.anon_execute,f.anon_execute)
    if(!['assistant_update_video','apply_microsoft_sync_item'].includes(f.proname))assert.equal(next.definition,f.definition)
    else {assert.equal(next.service_execute,false);assert.equal(next.anon_execute,false)}
   }
  })
  for(const role of ['admin','manager','staff','client'])await t.test(role+' old JWT denied while inactive with zero source/audit/ledger changes',async()=>{
   app.policyAcceptance.setAccount(role,{active:false});const before=app.policyAcceptance.mutationState()
   assert.equal((await call(role,'assistant_update_video',video('Must not persist'))).status,403)
   assert.equal((await call(role,'apply_microsoft_sync_item',sync('blocked-'+role))).status,403)
   assert.deepEqual(app.policyAcceptance.mutationState(),before)
   app.policyAcceptance.setAccount(role)
  })
  await t.test('active video behavior and validation survive reactivation',async()=>{
   for(const role of ['admin','manager','staff']){
    const before=app.policyAcceptance.mutationState(),r=await call(role,'assistant_update_video',video('Synthetic active '+role))
    assert.equal(r.status,200);assert.equal(r.data.id,app.sources.videoId);assert.equal(app.policyAcceptance.mutationState().video_audits,before.video_audits+1)
   }
   const before=app.policyAcceptance.mutationState()
   for(const body of [video('Invalid','invalid'),{...video('Wrong run'),p_run_id:content.newRunId}])assert((await call('staff','assistant_update_video',body)).status>=400)
   assert.deepEqual(app.policyAcceptance.mutationState(),before)
   const moved=await call('staff','assistant_update_video',video('Synthetic move','move_next_month'))
   assert.equal(moved.status,200);assert.equal(moved.data.month,'2026-12-01');assert.equal(moved.data.deliverable_id,null);assert.equal(moved.data.production_status,'not_shot')
  })
  await t.test('active sync keeps both destinations, retry idempotency, CAS and pause checks',async()=>{
   for(const destination of ['planner','client_schedule']){
    const body=sync('active-'+destination,destination),r=await call('admin','apply_microsoft_sync_item',body)
    assert.equal(r.status,200);const after=app.policyAcceptance.mutationState()
    assert.equal(after[destination==='planner'?'planner':'monthly'].title,body.p_patch.title)
    const again=await call('admin','apply_microsoft_sync_item',body);assert.equal(again.status,200);assert.deepEqual(again.data,r.data);assert.deepEqual(app.policyAcceptance.mutationState(),after)
    const stale=await call('admin','apply_microsoft_sync_item',{...sync('stale-'+destination,destination),p_expected_updated_at:'2000-01-01T00:00:00Z'})
    assert(stale.status>=400);assert.match(stale.data.message,/changed after preview/);assert.deepEqual(app.policyAcceptance.mutationState(),after)
   }
   app.policyAcceptance.setMutationRunPaused(true);const before=app.policyAcceptance.mutationState()
   assert((await call('admin','apply_microsoft_sync_item',sync('paused'))).status>=400);assert.deepEqual(app.policyAcceptance.mutationState(),before)
   app.policyAcceptance.setMutationRunPaused(false)
   app.policyAcceptance.setAccount('admin',{effectiveRole:'manager'})
   assert((await call('admin','apply_microsoft_sync_item',sync('demoted'))).status>=400)
   app.policyAcceptance.setAccount('admin')
   assert((await call('client','assistant_update_video',video('Still unauthorized'))).status>=400)
   for(const role of ['manager','staff','client'])assert((await call(role,'apply_microsoft_sync_item',sync('still-unauthorized-'+role))).status>=400)
  })
 }finally{app.stop();await rm(dir,{recursive:true,force:true})}
})
