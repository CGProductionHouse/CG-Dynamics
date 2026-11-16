import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startNolanIsolatedAcceptance} from '../scripts/helpers/nolanIsolatedAcceptance.mjs'

test('Content Guideline definer routes enforce current activation with genuine JWTs', {skip:process.env.RUN_NOLAN_SOURCE_POLICY_TESTS!=='1',timeout:180000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nolan-content-policy-'))
 const app=await startNolanIsolatedAcceptance('http://127.0.0.1:1',join(dir,'replay.json')),tokens={}
 try{
  app.policyAcceptance.applyDraft()
  const ids=app.policyAcceptance.seedContentRoutes()
  const call=async(role,name,body)=>{
   const r=await app.exchange(3000,'/rpc/'+name,{method:'POST',headers:{authorization:'Bearer '+tokens[role]},body})
   return {status:r.status,data:r.body.length?JSON.parse(r.body):null}
  }
  const routes={
   get_or_create_content_guideline:{p_run_id:ids.runId},
   reorder_content_guideline_videos:{p_guideline_id:ids.guidelineId,p_video_ids:[app.sources.videoId]},
   set_content_guideline_publication:{p_guideline_id:ids.guidelineId,p_publish:true},
   client_portal_published_content_guidelines:{p_client_id:app.sources.clientId,p_month:'2026-11-01'},
  }
  for(const role of ['admin','manager','staff','client']){
   const a=app.accounts[role],r=await app.exchange(9999,'/token?grant_type=password',{method:'POST',body:{email:a.email,password:a.password}})
   assert.equal(r.status,200);tokens[role]=JSON.parse(r.body).access_token
   await t.test(role+' inactive baseline bypasses source-table guards',async()=>{
    app.policyAcceptance.setAccount(role,{active:false})
    for(const [name,body] of Object.entries(routes)){
     const r=await call(role,name,body)
     if(role==='client'&&name!=='client_portal_published_content_guidelines'){assert(r.status>=400);continue}
     assert(r.status===200||r.status===204,name+' '+JSON.stringify(r))
     if(name==='get_or_create_content_guideline')assert.equal(r.data.id,ids.guidelineId)
     if(name==='client_portal_published_content_guidelines'){assert.equal(r.data.length,1);assert.equal(r.data[0].videos[0].title,'Synthetic pipeline row')}
    }
    app.policyAcceptance.setAccount(role)
   })
  }
  const before=app.policyAcceptance.audit()
  const identityBefore={},serviceBefore=app.policyAcceptance.serviceIdentityCount()
  await t.test('identity helper exposure is caller-independent despite active target filters',async()=>{
   for(const role of ['admin','manager','staff','client']){
    identityBefore[role]=[]
    app.policyAcceptance.setAccount(role,{active:false})
    for(const name of ['cg_staff_identity_candidates','cg_derived_identity_forms']){
     const r=await call(role,name,name==='cg_derived_identity_forms'?{p_profile_id:app.accounts.admin.id}:{})
     assert.equal(r.status,200);assert(r.data.length>0,name+' '+role)
    }
    app.policyAcceptance.setAccount(role)
    for(const name of ['cg_staff_identity_candidates','cg_derived_identity_forms'])identityBefore[role].push((await call(role,name,name==='cg_derived_identity_forms'?{p_profile_id:app.accounts.admin.id}:{})).data)
   }
  })
  await t.test('idempotent guarded draft preserves route ACLs and unrelated functions',()=>{
   app.policyAcceptance.applyContentDraft();app.policyAcceptance.applyContentDraft()
   app.policyAcceptance.applyIdentityDraft();app.policyAcceptance.applyIdentityDraft()
   const after=app.policyAcceptance.audit()
   for(const original of before.source_definer_routes){
    const next=after.source_definer_routes.find(f=>f.proname===original.proname&&f.arguments===original.arguments)
    assert(next);assert.deepEqual(next.proacl,original.proacl);assert.equal(next.anon_execute,original.anon_execute);assert.equal(next.service_execute,original.service_execute)
    if(!Object.hasOwn(routes,original.proname)&&!['cg_staff_identity_candidates','cg_derived_identity_forms'].includes(original.proname))assert.equal(next.definition,original.definition)
   }
  })
  for(const role of ['admin','manager','staff','client'])await t.test(role+' activation, reactivation and current-role isolation',async()=>{
   app.policyAcceptance.setAccount(role,{active:false})
   for(const [name,body] of Object.entries(routes))assert.equal((await call(role,name,body)).status,403,name)
   app.policyAcceptance.setAccount(role)
   for(const [name,body] of Object.entries(routes)){
    const r=await call(role,name,body)
    if(role==='client'&&name!=='client_portal_published_content_guidelines')assert(r.status>=400)
    else assert(r.status===200||r.status===204,name+' '+JSON.stringify(r))
   }
   if(role==='client'){
    const r=await call(role,'client_portal_published_content_guidelines',{p_client_id:app.sources.foreignClientId,p_month:'2026-11-01'})
    assert.equal(r.data.length,1);assert.equal(r.data[0].title,'Synthetic own guideline')
   }
  })
  await t.test('valid creation, publication state, exact reorder identity and role demotion remain guarded',async()=>{
   const made=await call('staff','get_or_create_content_guideline',{p_run_id:ids.newRunId});assert.equal(made.status,200)
   assert.equal((await call('staff','get_or_create_content_guideline',{p_run_id:ids.newRunId})).data.id,made.data.id)
   assert((await call('staff','reorder_content_guideline_videos',{p_guideline_id:ids.guidelineId,p_video_ids:[app.sources.foreignVideoId]})).status>=400)
   assert.equal((await call('manager','set_content_guideline_publication',{p_guideline_id:ids.guidelineId,p_publish:false})).status,200)
   assert.equal((await call('client','client_portal_published_content_guidelines',routes.client_portal_published_content_guidelines)).data.length,0)
   assert.equal((await call('manager','set_content_guideline_publication',routes.set_content_guideline_publication)).status,200)
   app.policyAcceptance.setAccount('manager',{effectiveRole:'client'})
   assert((await call('manager','set_content_guideline_publication',routes.set_content_guideline_publication)).status>=400)
   assert.equal((await call('manager','client_portal_published_content_guidelines',routes.client_portal_published_content_guidelines)).data.length,0)
   app.policyAcceptance.setAccount('manager')
  })
  await t.test('nested active checks on adjacent helpers reject inactive manager',async()=>{
   app.policyAcceptance.setAccount('manager',{active:false})
   for(const [name,body] of [
    ['save_content_creative_source',{p_deliverable_id:app.sources.deliverableId,p_design_id:'synthetic',p_page_id:'synthetic'}],
    ['client_portal_post_assets',{p_client_id:app.sources.clientId,p_month:'2026-11-01',p_post_key:'synthetic'}],
   ])assert((await call('manager',name,body)).status>=400,name)
   app.policyAcceptance.setAccount('manager')
  })
  await t.test('identity guards preserve active results and actual database service-role lookup',async()=>{
   assert.equal(app.policyAcceptance.serviceIdentityCount(),serviceBefore)
   const unordered=rows=>rows.map(row=>JSON.stringify(row)).sort()
   for(const role of ['admin','manager','staff','client']){
    let i=0
    for(const name of ['cg_staff_identity_candidates','cg_derived_identity_forms']){
     const body=name==='cg_derived_identity_forms'?{p_profile_id:app.accounts.admin.id}:{}
     assert.deepEqual(unordered((await call(role,name,body)).data),unordered(identityBefore[role][i++]))
     app.policyAcceptance.setAccount(role,{active:false})
     const r=await call(role,name,body);assert.equal(r.status,200);assert.deepEqual(r.data,[])
     app.policyAcceptance.setAccount(role)
    }
   }
  })
  if(process.env.NOLAN_POLICY_AUDIT_PATH)await writeFile(process.env.NOLAN_POLICY_AUDIT_PATH,JSON.stringify(app.policyAcceptance.audit(),null,2))
 }finally{app.stop();await rm(dir,{recursive:true,force:true})}
})
