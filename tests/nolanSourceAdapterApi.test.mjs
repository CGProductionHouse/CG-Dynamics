import assert from 'node:assert/strict'
import test from 'node:test'
import {build} from 'esbuild'
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {startAcceptance} from '../scripts/nolan-same-origin-acceptance.mjs'

test('actual Nolan source modules execute through genuine same-origin SDK roles', {skip:process.env.RUN_NOLAN_SOURCE_API_TESTS!=='1',timeout:240000},async t=>{
 const sourcePolicyDraft=process.env.RUN_NOLAN_SOURCE_POLICY_TESTS==='1'
 const app=await startAcceptance({sourcePolicyDraft}),path=resolve('node_modules/.cache/nolan-source-'+randomUUID()+'.mjs')
 let api
 try{
  const result=await build({stdin:{contents:`export {supabase} from './src/lib/supabase';export {getProfile} from './src/lib/db/profiles';export {withNolanVerifiedViewer} from './src/lib/nolanVerifiedViewer';export {listTasks,listActiveClients} from './src/lib/commandCentre';export {listStaffProfiles,listPipelineVideos} from './src/lib/contentWorkflow';export {listMonthlyDeliverablesByMonth} from './src/lib/planner';export * from './src/lib/nolanDecisionApi';export * from './src/lib/nolanReadContinuity';export {nolanTaskOwnerLabel} from './src/lib/nolanOwnership';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',packages:'external',write:false,define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(app.origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"isolated-synthetic-publishable-key"'}})
  await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,result.outputFiles[0].text);api=await import(path)
  const login=async role=>{await api.supabase.auth.signOut();const a=app.manifest.accounts[role];const r=await api.supabase.auth.signInWithPassword({email:a.email,password:a.password});assert.equal(r.error,null,'Real sign-in '+role)}
  const scenario=async action=>{const r=await fetch(app.origin+'/__nolan_acceptance/scenario',{method:'POST',headers:{'content-type':'application/json','x-nolan-fixture-control':app.manifest.fixtureControl},body:JSON.stringify({action})});assert.equal(r.status,204)}
  const reads=()=>Promise.all([api.listTasks(),api.listStaffProfiles(),api.listActiveClients(),api.listPipelineVideos(),api.listMonthlyDeliverablesByMonth(app.manifest.sources.month)])
  await login('admin')
  const verifiedReads=role=>api.withNolanVerifiedViewer({userId:app.manifest.accounts[role].id,profileId:app.manifest.accounts[role].id,role},reads)
  const guardedReads=()=>verifiedReads('manager')
  const names=['tasks','staff','clients','pipeline','schedule'],admin=await reads()
  for(let i=0;i<admin.length;i++)t.diagnostic(names[i]+': '+JSON.stringify({count:admin[i].data?.length,error:admin[i].error,migrationNeeded:admin[i].migrationNeeded}))
  await t.test('admin actual readers return exact fixture identities and provenance',()=>{
   for(const result of admin)assert.equal(result.error,null)
   const task=admin[0].data.find(r=>r.native_id===app.manifest.plannerTaskId)
   assert(task);assert.equal(task.data_origin,'planner_tasks');assert(task.assignee_user_ids.includes(app.manifest.accounts.admin.id))
   assert(admin[0].data.some(r=>r.native_id===app.manifest.taskId&&r.data_origin==='command_centre'))
   const staff=new Map(admin[1].data.map(r=>[r.id,r.full_name]));assert.equal(api.nolanTaskOwnerLabel(task,staff),'Synthetic admin')
   for(const id of [app.manifest.sources.clientId,app.manifest.sources.foreignClientId])assert(admin[2].data.some(r=>r.id===id))
   const video=admin[3].data.find(r=>r.id===app.manifest.sources.videoId);assert.equal(video.client_id,app.manifest.sources.clientId);assert.equal(video.deliverable_id,app.manifest.sources.deliverableId)
   const monthly=admin[4].data.find(r=>r.id===app.manifest.sources.deliverableId);assert.equal(monthly.client_id,app.manifest.sources.clientId);assert.equal(monthly.month,'2026-11-01')
  })
  await t.test('REST failure is an error, retained tasks are stale, and recovery returns real source rows',async()=>{
   const good=api.retainNolanRows(admin[0].data,false,new Date().toISOString())
   await scenario('fail-tasks');const broken=(await verifiedReads('admin'))[0];assert(broken.error)
   const retained=api.retainNolanRows(broken.data??[],true,new Date().toISOString(),good);assert.equal(retained.stale,true);assert.deepEqual(retained.data,good.data)
   await scenario('restore-tasks');const recovered=(await verifiedReads('admin'))[0];assert.equal(recovered.error,null);assert.equal(api.retainNolanRows(recovered.data,false,new Date().toISOString(),retained).stale,false)
   await scenario('fail-rest');await assert.rejects(verifiedReads('admin'));await scenario('restore-rest');assert.equal((await verifiedReads('admin'))[0].error,null)
  })
  for(const role of ['manager','staff','client'])await t.test(role+' actual reader scope',async()=>{
   await login(role);const results=await reads()
   for(let i=0;i<results.length;i++)t.diagnostic(role+' '+names[i]+': '+JSON.stringify({count:results[i].data?.length,error:results[i].error}))
   for(const result of results)assert.equal(result.error,null)
   if(role==='manager'){assert(results[0].data.some(r=>r.native_id===app.manifest.plannerTaskId));assert(!results[1].data.some(r=>r.id===app.manifest.accounts.admin.id));assert.equal(api.nolanTaskOwnerLabel(results[0].data.find(r=>r.native_id===app.manifest.plannerTaskId),new Map(results[1].data.map(r=>[r.id,r.full_name]))),'Owner profile evidence unavailable');assert((await guardedReads())[0].data.length>0)}
   if(role==='client'){
    assert(!results[0].data?.some(r=>r.native_id===app.manifest.plannerTaskId||r.id===app.manifest.taskId))
    assert(!results[2].data?.some(r=>r.id===app.manifest.sources.foreignClientId))
    assert(!results[3].data?.some(r=>r.id===app.manifest.sources.foreignVideoId))
    assert(!results[4].data?.some(r=>r.id===app.manifest.sources.foreignDeliverableId))
   }
   const a=app.manifest.accounts[role];assert.equal(!!api.nolanReadScope(a.id,a.id,role,'2026-11'),role==='manager')
   if(role!=='manager')await assert.rejects(api.listMyNativeDecisions())
  })
  await t.test('actual decision modules enforce stale revision, same-key retry and revoked profile',async()=>{
   await login('admin');const p=await api.previewDecisionTask(app.manifest.taskId)
   const payload={taskId:p.taskId,revision:p.revision,recipientId:app.manifest.accounts.manager.id,question:'Synthetic module question',key:randomUUID()}
   const id=await api.createNativeDecision(payload);assert.equal(await api.createNativeDecision(payload),id)
   await scenario('advance-source');await assert.rejects(api.createNativeDecision({...payload,key:randomUUID()}))
   await login('manager');const rows=await api.listMyNativeDecisions();const row=rows.find(r=>r.id===id);assert(row);assert.notEqual(row.sourceRevision,row.currentRevision)
   await assert.rejects(api.closeNativeDecision(id,row.version,'resolve','Stale source'))
   await scenario('revoke-manager');await assert.rejects(api.listMyNativeDecisions())
   const current=await api.getProfile(app.manifest.accounts.manager.id);assert.equal(current.data.is_active,false)
   const revokedReads=await reads();t.diagnostic('Inactive existing-session actual readers: '+JSON.stringify(revokedReads.map((r,i)=>({source:names[i],count:r.data?.length,error:r.error}))))
   if(sourcePolicyDraft){
    for(const [i,result] of revokedReads.entries()){
     assert.equal(result.error,null)
     assert.equal(result.data.length,i===1?1:0,'Draft direct source policy '+names[i])
    }
   }
   await assert.rejects(guardedReads(),/Current account authorization/)
   await scenario('restore-manager');assert((await api.listMyNativeDecisions()).some(r=>r.id===id));assert((await guardedReads())[0].data.length>0)
  })
  await t.test('private fixture controls reject missing capabilities and unknown operations',async()=>{
   const denied=await fetch(app.origin+'/__nolan_acceptance/scenario',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'advance-source'})});assert.equal(denied.status,403)
   const unknown=await fetch(app.origin+'/__nolan_acceptance/scenario',{method:'POST',headers:{'content-type':'application/json','x-nolan-fixture-control':app.manifest.fixtureControl},body:JSON.stringify({action:'arbitrary-sql'})});assert.equal(unknown.status,502)
  })
  const replay=JSON.parse(await readFile(app.reportPath,'utf8'));t.diagnostic('Canonical replay '+replay.report.filter(r=>r.result==='applied').length+'/'+replay.report.length)
 }finally{try{await api?.supabase.auth.signOut();api?.supabase.auth.stopAutoRefresh()}finally{await app.stop();await rm(path,{force:true})}}
})
