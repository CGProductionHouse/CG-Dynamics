import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startNolanIsolatedAcceptance} from '../scripts/helpers/nolanIsolatedAcceptance.mjs'

test('draft source policies with real old GoTrue JWTs and canonical schema', {skip:process.env.RUN_NOLAN_SOURCE_POLICY_TESTS!=='1',timeout:240000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nolan-policy-'))
 const app=await startNolanIsolatedAcceptance('http://127.0.0.1:1',join(dir,'replay.json'))
 const tokens={},baseline={}
 const tables=['command_centre_tasks','planner_tasks','planner_tasks_canonical','planner_task_assignees','planner_activity_log','planner_boards','planner_buckets','clients','client_aliases','content_guide_ideas','monthly_deliverables','profiles']
 const call=async(role,path,body,method=body===undefined?'GET':'POST')=>{
  const r=await app.exchange(3000,'/'+path,{method,headers:tokens[role]?{authorization:'Bearer '+tokens[role]}:{},body})
  return {status:r.status,data:r.body.length?JSON.parse(r.body):null}
 }
 const read=async role=>Object.fromEntries(await Promise.all(tables.map(async table=>{
  const r=await call(role,table+'?select=*');assert.equal(r.status,200,table+' '+role);return [table,r.data]
 })))
 const counts=rows=>Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))
 try{
  await writeFile(join(dir,'before.json'),JSON.stringify(app.policyAcceptance.audit(),null,2))
  for(const role of ['admin','manager','staff','client']){
   const account=app.accounts[role]
   const login=await app.exchange(9999,'/token?grant_type=password',{method:'POST',body:{email:account.email,password:account.password}})
   assert.equal(login.status,200);tokens[role]=JSON.parse(login.body).access_token
   await t.test(role+' baseline inactive exposure using unchanged JWT',async()=>{
    baseline[role]=await read(role)
    app.policyAcceptance.setAccount(role,{active:false})
    const inactive=await read(role)
    t.diagnostic(role+' baseline active '+JSON.stringify(counts(baseline[role]))+' inactive '+JSON.stringify(counts(inactive)))
    assert(inactive.profiles.some(p=>p.id===account.id&&p.is_active===false))
    assert.equal(inactive.clients.length,baseline[role].clients.length)
    assert(inactive.clients.length>0)
    if(role==='manager')for(const rpc of ['update_command_centre_task_status','admin_set_package_classification']){
     const body=rpc==='update_command_centre_task_status'?{p_task_id:app.taskId,p_status:'in_progress'}:{p_task_id:app.taskId}
     const r=await call(role,'rpc/'+rpc,body);assert.equal(r.status,200);assert.equal(r.data.id,app.taskId)
    }
    if(role==='manager'){
     const r=await call(role,'command_centre_tasks',{id:app.policyAcceptance.probeTaskId,title:'Synthetic baseline write probe',bucket:'Video',status:'to_do'})
     assert.equal(r.status,201);app.policyAcceptance.removeProbeTask()
    }
    if(role==='admin'){
     assert.equal((await call(role,'profiles?id=eq.'+account.id,{is_active:true},'PATCH')).status,204)
     assert.equal((await call(role,'profiles?id=eq.'+account.id)).data[0].is_active,true)
    }
    app.policyAcceptance.setAccount(role)
   })
  }
  await t.test('apply twice; restrictive AND composition; unchanged permissive policies and helper privileges',async()=>{
   const before=app.policyAcceptance.audit()
   app.policyAcceptance.applyDraft();app.policyAcceptance.applyDraft()
   const after=app.policyAcceptance.audit()
   if(process.env.NOLAN_POLICY_AUDIT_PATH)await writeFile(process.env.NOLAN_POLICY_AUDIT_PATH,JSON.stringify(after,null,2))
   await writeFile(join(dir,'after.json'),JSON.stringify(after,null,2))
   const byName=rows=>[...rows].sort((a,b)=>(a.tablename+a.policyname).localeCompare(b.tablename+b.policyname))
   assert.deepEqual(byName(after.policies.filter(p=>!p.policyname.startsWith('nolan_active_'))),byName(before.policies))
   const guards=after.policies.filter(p=>p.policyname.startsWith('nolan_active_'))
   assert.equal(guards.length,14);assert(guards.every(p=>p.permissive==='RESTRICTIVE'&&p.roles.join()==='authenticated'))
   assert.equal(guards.filter(p=>p.cmd==='ALL').length,10)
   const helper=after.functions.find(f=>f.proname==='nolan_source_reader_active')
   assert.equal(helper.prosecdef,true);assert.deepEqual(helper.proconfig,['search_path=pg_catalog'])
   assert.deepEqual(helper.proacl.sort(),['postgres=X/postgres','authenticated=X/postgres'].sort())
   assert.deepEqual(app.policyAcceptance.helperMissingIdentity(),['f','f'])
   assert(after.views.find(v=>v.relname==='planner_tasks_canonical').reloptions.includes('security_invoker=true'))
   t.diagnostic('Views referencing scoped tables: '+JSON.stringify(after.views.filter(v=>/\b(planner_tasks|command_centre_tasks|content_guide_ideas|monthly_deliverables|clients|profiles)\b/.test(v.definition)).map(v=>({name:v.relname,options:v.reloptions}))))
  })
  for(const role of ['admin','manager','staff','client'])await t.test(role+' active visibility, deactivation, self-read and reactivation with same JWT',async()=>{
   assert.deepEqual(counts(await read(role)),counts(baseline[role]))
   app.policyAcceptance.setAccount(role,{active:false})
   const inactive=await read(role)
   for(const table of tables.filter(v=>v!=='profiles'))assert.equal(inactive[table].length,0,role+' '+table)
   assert.equal(inactive.profiles.length,1);assert.equal(inactive.profiles[0].id,app.accounts[role].id);assert.equal(inactive.profiles[0].is_active,false)
   for(const rpc of ['list_planner_assignment_directory','list_planner_board_assignments','list_planner_workload_summary','list_planner_workload_tasks']){
    const r=await call(role,'rpc/'+rpc,{})
    assert(r.status>=400||(Array.isArray(r.data)&&r.data.length===0),role+' inactive '+rpc)
   }
   for(const rpc of ['client_portal_month_ahead_posts_v2','client_portal_month_ahead_events']){
    const r=await call(role,'rpc/'+rpc,{p_client_id:app.sources.clientId,p_month:'2026-11-01'})
    assert(r.status>=400||(Array.isArray(r.data)&&r.data.length===0),role+' inactive '+rpc)
   }
   app.policyAcceptance.setAccount(role)
   assert.deepEqual(counts(await read(role)),counts(baseline[role]))
  })
  await t.test('current roles override old JWT; client scope and manager profile isolation survive',async()=>{
   for(const effectiveRole of ['manager','staff','client']){
    app.policyAcceptance.setAccount('admin',{effectiveRole})
    const rows=await read('admin')
    assert.equal(rows.profiles.length,1)
    if(effectiveRole==='client'){assert.equal(rows.clients.length,0);assert.equal(rows.planner_tasks.length,0)}
    if(effectiveRole==='staff')assert.equal((await call('admin','rpc/list_planner_workload_tasks',{})).status,400)
   }
   app.policyAcceptance.setAccount('admin')
   assert.equal((await read('manager')).profiles.length,1)
   const client=await read('client');assert.deepEqual(client.clients.map(c=>c.id),[app.sources.clientId]);assert(!client.clients.some(c=>c.id===app.sources.foreignClientId))
   for(const role of ['admin','manager']){
    const assignments=await call(role,'rpc/list_planner_board_assignments',{})
    assert.equal(assignments.status,200);assert(assignments.data.some(a=>a.task_id===app.plannerTaskId&&a.profile_id===app.accounts.admin.id))
    assert.equal((await call(role,'rpc/list_planner_workload_tasks',{})).status,200)
   }
  })
  await t.test('bounded mutation RPC guards deny inactive users and preserve active roles and same-client checks',async()=>{
   for(const role of ['admin','manager','staff','client']){
    app.policyAcceptance.setAccount(role,{active:false})
    for(const [rpc,body] of [
     ['update_planner_task_status',{p_task_id:app.plannerTaskId,p_status:'in_progress'}],
     ['update_command_centre_task_status',{p_task_id:app.taskId,p_status:'in_progress'}],
     ['admin_set_package_classification',{p_task_id:app.taskId}],
    ])assert((await call(role,'rpc/'+rpc,body)).status>=400,role+' '+rpc)
    app.policyAcceptance.setAccount(role)
    for(const [rpc,body] of [
     ['update_command_centre_task_status',{p_task_id:app.taskId,p_status:'in_progress'}],
     ['admin_set_package_classification',{p_task_id:app.taskId}],
    ]){
     const r=await call(role,'rpc/'+rpc,body)
     if(['admin','manager'].includes(role)){assert.equal(r.status,200);assert.equal(r.data.id,app.taskId)}else assert(r.status>=400)
    }
   }
   const mismatch=await call('admin','rpc/admin_set_package_classification',{p_task_id:app.taskId,p_deliverable_id:app.sources.foreignDeliverableId})
   assert(mismatch.status>=400);assert.match(mismatch.data.message,/same client/)
   app.policyAcceptance.assignSyntheticStaffTask()
   const own=await call('staff','rpc/update_command_centre_task_status',{p_task_id:app.taskId,p_status:'in_progress'})
   assert.equal(own.status,200);assert.equal(own.data.id,app.taskId)
   app.policyAcceptance.setAccount('staff',{active:false})
   assert.equal((await call('staff','rpc/update_command_centre_task_status',{p_task_id:app.taskId,p_status:'in_progress'})).status,403)
   app.policyAcceptance.setAccount('staff')
   assert.equal((await call('staff','rpc/update_command_centre_task_status',{p_task_id:app.taskId,p_status:'in_progress'})).status,200)
  })
  await t.test('bounded direct writes deny inactive callers, including admin self-reactivation',async()=>{
   for(const role of ['admin','manager','staff','client']){
    app.policyAcceptance.setAccount(role,{active:false})
    const r=await call(role,'command_centre_tasks',{title:'Synthetic write-policy probe',bucket:'Video',status:'to_do'})
    assert.equal(r.status,403)
    const patch=await call(role,'profiles?id=eq.'+app.accounts[role].id,{is_active:true},'PATCH')
    assert(patch.status===204||patch.status>=400)
    assert.equal((await call(role,'profiles?id=eq.'+app.accounts[role].id)).data[0].is_active,false)
    app.policyAcceptance.setAccount(role)
   }
   const r=await call('manager','command_centre_tasks',{title:'Synthetic active write-policy probe',bucket:'Video',status:'to_do'})
   assert.equal(r.status,201)
  })
  await t.test('record adjacent ownership-summary RPC boundary without changing the AI lane',async()=>{
   app.policyAcceptance.setAccount('manager',{active:false})
   const r=await call('manager','rpc/assistant_ownership_review_summary',{})
   assert.equal(r.status,200)
   assert.equal(typeof r.data.unassigned,'number')
   t.diagnostic('Remaining adjacent definer route: inactive manager can read assistant_ownership_review_summary; outside Nolan readers, not fixed by table RLS')
   app.policyAcceptance.setAccount('manager')
  })
  t.diagnostic('Canonical replay applied '+app.report.filter(r=>r.result==='applied').length+'/'+app.report.length)
 }finally{app.stop();await rm(dir,{recursive:true,force:true})}
})
