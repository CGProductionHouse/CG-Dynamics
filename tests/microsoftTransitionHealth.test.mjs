import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { describeMicrosoftTransition, withMicrosoftTransitionHealth } from '../src/lib/microsoftTransitionHealth.ts'
import { summarizeSyncHealth } from '../supabase/functions/cg-dynamics-mcp/microsoftSourceFields.ts'
import { buildStaffAssistantPolicy } from '../supabase/functions/cg-dynamics-mcp/coexistencePolicy.ts'
import { buildDailyUpdateContract } from '../supabase/functions/cg-dynamics-mcp/assistantPresentationPolicy.ts'

const index=readFileSync('supabase/functions/cg-dynamics-mcp/index.ts','utf8')
const a=index.indexOf('const handleGetMicrosoftSyncStatus:'),b=index.indexOf('const handleGetClientContext:',a)
assert.ok(a>=0&&b>a)
const handler=new Function('tableExists','summarizeSyncHealth','withMicrosoftTransitionHealth',
  `${ts.transpileModule(index.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return handleGetMicrosoftSyncStatus`)(async()=>true,summarizeSyncHealth,withMicrosoftTransitionHealth)
const dataSource=readFileSync('src/lib/microsoftImportData.ts','utf8')
const c=dataSource.indexOf('export async function loadMicrosoftSyncState('),d=dataSource.indexOf('export async function updateMicrosoftTransitionStatus(',c)
assert.ok(c>=0&&d>c)
const recoverySource=readFileSync('src/lib/microsoftRecovery.ts','utf8')
const safeStart=recoverySource.indexOf('export function microsoftSafeApplyError(')
assert.ok(safeStart>=0)
const safeError=new Function(`${ts.transpileModule(recoverySource.slice(safeStart).replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return microsoftSafeApplyError`)()
const loadStateFactory=db=>new Function('supabase','microsoftSafeApplyError',`${ts.transpileModule(dataSource.slice(c,d).replace('export async','async'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return loadMicrosoftSyncState`)(db,safeError)
function database(status='active',error=null,missing=false){
  const reads=[]
  const run={id:'existing-run',status:'completed',finished_at:new Date().toISOString(),created_at:new Date().toISOString(),summary:{applied:3},source_completeness:[{complete:true}]}
  const db={reads,from(table){
    reads.push(table)
    const response=()=>table==='microsoft_sync_settings'
      ? {data:missing?null:{transition_status:status,updated_at:'2026-11-13T06:49:06Z'},error}
      : {data:[run],error:null}
    return {select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle(){return this},then(resolve,reject){return Promise.resolve(response()).then(resolve,reject)}}
  }}
  return db
}

test('paused/ended collection cannot be called healthy merely because its last mirror is fresh',async()=>{
  for(const state of ['paused','complete']){
    const db=database(state),result=await handler({supabase:db},{})
    assert.equal(result.sync_health.state,state);assert.equal(result.sync_health.degraded,true)
    assert.equal(result.sync_health.freshness_state,'healthy')
    assert.equal(result.collection_status.state,state);assert.equal(result.latest_run.id,'existing-run')
    assert.ok(db.reads.includes('microsoft_sync_settings'))
    assert.match(result.operating_rule,/Prefer live Microsoft/)
  }
})

test('failed, absent or unknown lifecycle reads preserve facts but never imply active collection',async()=>{
  for(const db of [database('active',{message:'read denied'}),database('active',null,true),database('unknown-provider-state')]){
    const result=await handler({supabase:db},{})
    assert.equal(result.sync_health.state,'unverified');assert.equal(result.sync_health.degraded,true)
    assert.equal(result.sync_health.transition_status,'unverified')
    assert.equal(result.latest_run.id,'existing-run');assert.deepEqual(result.source_completeness,[{complete:true}])
    assert.match(result.sync_health.reason,/could not be verified/)
  }
})

test('active collection preserves the actual freshness verdict, including partial and stale',()=>{
  for(const run of [null,{status:'partial',finished_at:'2026-11-24T08:00:00Z'},{status:'completed',finished_at:'2026-11-13T08:00:00Z'}]){
    const original=summarizeSyncHealth(run,'2026-11-24T09:00:00Z')
    const health=withMicrosoftTransitionHealth(original,'active',true)
    assert.equal(health.state,original.state);assert.equal(health.degraded,original.degraded)
    assert.equal(health.reason,original.reason);assert.equal(health.transition_status,'active')
  }
})

test('actual UI data loader fails closed on missing schema, missing row and invalid lifecycle',async()=>{
  for(const db of [database('active',{code:'42P01',message:'missing table'}),database('active',null,true),database('invalid')]){
    const result=await loadStateFactory(db)()
    assert.equal(result.transitionStatus,'paused');assert.deepEqual(result.runs,[])
    assert.ok(result.error||result.migrationNeeded)
  }
  assert.equal((await loadStateFactory(database('active'))()).transitionStatus,'active')
})

test('page messages distinguish enabled, paused, ended and unverified without claiming mirror freshness',()=>{
  assert.equal(describeMicrosoftTransition('active',true).canCollect,true)
  assert.match(describeMicrosoftTransition('active',true).message,/Check the latest source coverage/)
  for(const [status,verified] of [['paused',true],['complete',true],['active',false],[null,true]]){
    const result=describeMicrosoftTransition(status,verified)
    assert.equal(result.canCollect,false);assert.doesNotMatch(result.message,/mirror are active/)
  }
  const page=readFileSync('src/pages/admin/MicrosoftImportPage.tsx','utf8')
  assert.match(page,/transitionHealth\.message/)
  assert.doesNotMatch(page,/Automatic Microsoft collection and the last verified Dynamics mirror are active/)
})

test('staff guidance uses automatic refresh and exact-task readback without asking staff to become company admin',()=>{
  const policy=JSON.stringify(buildStaffAssistantPolicy('staff'))
  const display=buildDailyUpdateContract('Franco').interaction_model.task_write_sequence.join(' ')
  for(const text of [policy,display]){
    assert.match(text,/Only a company_admin Project may call run_microsoft_sync/)
    assert.match(text,/get_microsoft_sync_status/)
    assert.match(text,/exact linked task/)
  }
  assert.match(policy,/must never switch identity/)
  assert.match(policy,/DYNAMICS SYNC PENDING/)
})

const opsSource=readFileSync('supabase/functions/cg-dynamics-mcp/opsActions.ts','utf8')
const gradeStart=opsSource.indexOf('const truthy'),gradeEnd=opsSource.indexOf('export interface OneDrive',gradeStart)
assert.ok(gradeStart>=0&&gradeEnd>gradeStart)
const grade=new Function(`${ts.transpileModule(opsSource.slice(gradeStart,gradeEnd).replaceAll('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return gradeSyncRun`)()
const runnerStart=index.indexOf('const MAX_SYNC_PROCESS_STEPS'),runnerEnd=index.indexOf('const PROVIDER_STATUS_FUNCTIONS',runnerStart)
assert.ok(runnerStart>=0&&runnerEnd>runnerStart)
const runnerFactory=invoke=>new Function('invokeSiblingFunction','gradeSyncRun',`${ts.transpileModule(index.slice(runnerStart,runnerEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return handleRunMicrosoftSync`)(invoke,grade)

test('actual runner returns resumable IN_PROGRESS for expected collection, capped at four units',async()=>{
  const calls=[],sources=[{required:true,sourceName:'Exact source',stage:'queued',complete:false,recordCount:0}]
  const invoke=async(_,name,input)=>{calls.push(input.action);assert.equal(name,'microsoft-transition-sync');return {ok:true,data:{jobId:'saved-job',status:'running',sources,finished:false}}}
  const result=await runnerFactory(invoke)({connection:{}},{job_id:'saved-job',max_steps:40})
  assert.equal(result.verdict,'IN_PROGRESS');assert.equal(result.finished,false)
  assert.equal(result.continuation.job_id,'saved-job');assert.equal(result.steps_processed,4)
  assert.equal(calls.filter(a=>a==='job_process').length,4)
  assert.match(result.reason,/freshness is unchanged/)
  assert.equal(calls.includes('job_start'),false)
})

test('real source or transport failure stays FAIL and a finished complete preview is not mirror success',async()=>{
  for(const transport of [false,true]){
    const invoke=async()=>transport?{ok:false,error:'Exact transport failed'}:{ok:true,data:{status:'running',sources:[{required:true,stage:'failed',safeError:'Source failed',complete:false}],finished:false}}
    const result=await runnerFactory(invoke)({connection:{}},{job_id:'saved-job',max_steps:1})
    assert.equal(result.verdict,'FAIL')
  }
  const invoke=async(_,__,input)=>({ok:true,data:input.action==='job_result'?{snapshot:{records:[{}]}}:{status:'complete',finished:true,sources:[{required:true,complete:true,stage:'complete',recordCount:1}]}})
  const result=await runnerFactory(invoke)({connection:{}},{job_id:'saved-job',max_steps:1})
  assert.equal(result.verdict,'PASS');assert.equal(result.preview_record_count,1)
  assert.match(result.apply_note,/Until an apply succeeds/)
})
