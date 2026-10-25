import assert from 'node:assert/strict'
import {test} from 'node:test'
import {verifyNativePlannerExport,nativeBucketMatches} from '../scripts/lib/native-planner-export.mjs'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'

function fixture(){
  const binding={plan_id:'exact-master',source_name:'Exact Master',kind:'owner_confirmed_master',source_ref:'owner decision'}
  const tasks=Array.from({length:1051},(_,i)=>({'Task ID':`task-${i}`,'Task Name':`DP ${i+1}`,Bucket:'bucket',Status:i===0?'Not started':'Completed',
    'Start date':null,'Due date':null,'Completed Date':i===0?null:'2026-09-01',Notes:null}))
  const receipt={contract:'planner_native_export_v1',plan:{'Plan ID':binding.plan_id,'Plan name':binding.source_name,'Date of export':'2026-10-19'},
    file_sha256:'a'.repeat(64),consolidated_task_identity_and_source_fields_match:true,buckets:[{'Bucket ID':'bucket','Bucket Name':'Exact Studio'}],tasks,task_count:tasks.length,bucket_count:1,writes:0,apply_ready:false}
  const anchors=[{id:'bucket',name:'Exact Studio',plan_id:binding.plan_id,read_complete:false,tasks:tasks.slice(0,100).map(t=>({id:t['Task ID'],title:t['Task Name'],bucket_id:'bucket',plan_id:binding.plan_id,percent_complete:t.Status==='Completed'?100:0}))}]
  return {binding,receipt,anchors}
}
test('native export verifies 1051 identities without converting completed history or null dates into current capacity',()=>{
  const f=fixture(),result=verifyNativePlannerExport(f.receipt,f.binding,f.anchors)
  assert.equal(result.proof.task_count,1051);assert.equal(result.buckets[0].expected_count,1051)
  assert.equal(result.buckets[0].tasks.filter(t=>t.percent_complete===0).length,1)
  assert.equal(result.buckets[0].tasks[0].due_date,null);assert.equal(result.buckets[0].tasks[0].etag,null)
  assert.equal(nativeBucketMatches(result.buckets[0],result),true)
  const changed=structuredClone(result.buckets[0]);changed.tasks[0].title='Foreign client'
  assert.equal(nativeBucketMatches(changed,result),false)
  assert.equal(result.proof.apply_ready,false)
})
test('wrong plan/bucket, missing/duplicate IDs, malformed dates, source drift and fake export coverage fail closed',()=>{
  for(const mutate of [
    f=>f.receipt.plan['Plan ID']='foreign',f=>f.receipt.tasks[0].Bucket='foreign',
    f=>f.receipt.tasks[1]['Task ID']='task-0',f=>f.receipt.tasks.pop(),
    f=>f.receipt.tasks[0]['Due date']='2026-02-30',f=>f.receipt.tasks[0].Status='Maybe',
    f=>f.anchors[0].tasks[0].title='Changed locally',f=>f.anchors[0].tasks[0].plan_id='foreign',
    f=>f.receipt.consolidated_task_identity_and_source_fields_match=false,
    f=>f.receipt.buckets[0]['Bucket Name']='Different branch',f=>f.binding.source_ref='',
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyNativePlannerExport(f.receipt,f.binding,f.anchors),/keep held/)}
})

test('actual audit admits complete native coverage beyond 1000 but refuses edited rows or omitted master buckets',()=>{
  const f=fixture(),master=verifyNativePlannerExport(f.receipt,f.binding,f.anchors),dir=mkdtempSync(join(tmpdir(),'cg-native-audit-'))
  try{
    const input={cutoff:'2026-10-19',clients:[{id:'client',name:'Exact Studio',active:true,package_settings:{design_posters_per_month:1,verification:{status:'confirmed',field_states:{design_posters_per_month:'known'}}}}],aliases:[],schedule:[],
      master:{...master,authority:{kind:'owner_confirmed_master',source_ref:f.binding.source_ref}},native_master_export:f,
      months:[{month:'2026-10',period_authority:{kind:'owner_confirmed',plan_id:'oct',month:'2026-10',source_ref:'owner decision'},bucket_list_complete:true,expected_bucket_count:1,
        buckets:[{id:'oct-bucket',plan_id:'oct',name:'Exact Studio',read_complete:true,expected_count:1,tasks:[{id:'oct-1',title:'DP 1',plan_id:'oct',bucket_id:'oct-bucket',percent_complete:100}]}]}]}
    const path=join(dir,'input.json'),audit=()=>{writeFileSync(path,JSON.stringify(input));return JSON.parse(execFileSync(process.execPath,['scripts/teams-readiness-audit.mjs',path],{encoding:'utf8',stdio:'pipe'}))}
    const good=audit()
    assert.equal(good.native_master_export_proof.task_count,1051)
    assert.equal(good.months[0].slot_review[0].state,'ready_for_exact_review')
    assert.equal(good.months[0].slot_review[0].slots.length,1,'1050 completed source tasks are not monthly capacity')
    assert.equal(good.months[0].slot_review[0].slots[0].verdict,'same_slot_cross_check_only')
    assert.equal(good.apply_ready,false);assert.equal(good.writes,0)
    input.master.buckets[0].tasks[0].title='Foreign name'
    assert.throws(audit,/Native master source fields differ/)
    input.master.buckets=[];input.master.expected_bucket_count=0
    assert.throws(audit,/bucket coverage differs/)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('actual Python extractor preserves legacy projection and reads checklist fields only in explicit detail mode',()=>{
  const python=process.env.CG_NATIVE_EXPORT_TEST_PYTHON??(process.platform==='win32'?'C:/Users/chris/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe':'python3')
  const task={'Task ID':'task','Task Name':'F 1',Bucket:'bucket',Status:'Not started','Created Date':'2026-10-01','Due date':null,'Start date':null,'Is Recurring':null,'Completed Date':null,Notes:'Exact source notes','Completed Checklist Items':'One','Checklist Items':'One;Two',Labels:null}
  const tables={Plan:[{'Plan ID':'exact','Plan name':'Exact','Date of export':'2026-10-19'}],Buckets:[{'Bucket ID':'bucket','Bucket Name':'Exact Client'}],Tasks:[task],'Consolidated Data':[{...task,Bucket:'Exact Client'}]}
  const code="import importlib.util,json,sys; s=importlib.util.spec_from_file_location('reader','scripts/teams-native-export-extract.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); t=json.load(sys.stdin); a=m.normalize_tables(t,'exact','Exact','a'*64); b=m.normalize_tables(t,'exact','Exact','a'*64,True); print(json.dumps({'legacy':a,'details':b}))"
  const run=()=>JSON.parse(execFileSync(python,['-B','-c',code],{input:JSON.stringify(tables),encoding:'utf8',stdio:'pipe'}))
  const r=run()
  assert.equal(Object.hasOwn(r.legacy.tasks[0],'Checklist Items'),false)
  assert.equal(r.details.tasks[0]['Checklist Items'],'One;Two');assert.equal(r.details.tasks[0]['Completed Checklist Items'],'One')
  assert.equal(r.legacy.tasks[0].Notes,r.details.tasks[0].Notes);assert.equal(r.details.writes,0);assert.equal(r.details.apply_ready,false)
  tables['Consolidated Data'][0]['Checklist Items']='Different content'
  assert.throws(run,/Non-lookup source fields differ/)
})
