import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { makeReceipt,compareReceipts,verifyReceipt,databaseQuery,windowOptions,capture,FUNCTIONS,hash,MAX_ROWS } from '../scripts/lib/freshnessObserver.mjs'

const from='2026-10-02T17:20:00Z',to='2026-10-02T17:30:00Z',sourceSha='a'.repeat(40)
const functions=FUNCTIONS.map(f=>({...f,version:1,ezbr_sha256:'b'.repeat(64)}))
function fixture() {
  const sourceNames=['Calendar','To Do','MASTER CLIENT TO DO','CG Socials','Client Socials - July 2026','2025 CLIENTS SCHEDULE']
  const counts=[150,800,200,500,350,5500]
  return {observed_at:to,window:{from,to},unfiltered:true,microsoft_lifecycle:{transition_status:'active'},
    jobs:[{id:'job',status:'complete',created_at:from,exported_at:to}],
    sources:sourceNames.map((source_name,i)=>({id:`s${i}`,job_id:'job',source_id:`plan${i}`,source_type:i===0?'outlook_calendar':'planner_plan',source_name,required:true,stage:'complete',record_count:counts[i],records_count:counts[i],pending_details:0,has_error:false,complete:true,has_cursor:false})),
    runs:[],mirror_observations:[],planner_plan_guards:[{plan_id:'plan5',count:1,hash:'d'.repeat(64)}],
    protected:['monthly_deliverables','native_planner','native_calendar','july_manual_apply'].map(scope=>({scope,count:1,hash:'c'.repeat(64)})),
    assets:[],checkpoints:[],facts:[],items:[],batches:[],platform_runs:[],
    ticks:Array.from({length:10},(_,i)=>({minute:`2026-10-02T17:${20+i}:00Z`,dispatches:1,succeeded_dispatches:1,fleet_batches:0})),
    scheduler:[{jobid:1,schedule:'* * * * *',active:true,targets_worker:true,timeout_30000:true}] }
}
const receipt=(db=fixture(),phase='pre')=>makeReceipt({db,logs:[],functions,from,to,sourceSha,phase})
function applied(db,status='completed') {
  db.runs=[{id:'run',preview_job_id:'job',trigger_type:'agent',status,created_at:from,applied_at:to,source_completeness:db.sources.map(s=>({sourceId:s.source_id,sourceName:s.source_name,recordCount:s.record_count,complete:s.complete,has_error:false})),applied:18,skipped:0,failed:0}]
  return db
}
function post(db) {
  const shifted=structuredClone(db)
  shifted.observed_at='2026-10-02T18:00:00Z'; shifted.window={from:'2026-10-02T17:50:00Z',to:'2026-10-02T18:00:00Z'}
  return makeReceipt({db:shifted,logs:[],functions,sourceSha,phase:'post',...shifted.window})
}
const asset={id:'asset',client_id:'client',facebook_page_id:'page',instagram_account_id:null,updated_at:'2026-09-01T00:00:00Z',last_connected_at:null}
const failure={id:'item',batch_id:'batch',asset_id:'asset',client_id:'client',month:'2026-10',status:'failed',via:'fleet_freshness',error:'Mapped Page access failed (code: 10)',facebook_sync_state:'pending',instagram_sync_state:'pending',finished_at:'2026-10-02T17:29:00Z',cooldown_until:null}
test('one supplied bounded minute-aligned UTC window; reject malformed, future order and injection',()=>{
  assert.equal(windowOptions(from,to).minutes,10)
  for (const bad of ['2026-02-30T17:20:00Z',"2026-10-02';DELETE",from.replace(':00Z',':01Z')]) assert.throws(()=>databaseQuery(bad,to))
  assert.throws(()=>windowOptions(to,from)); assert.throws(()=>windowOptions(from,'2026-10-02T19:00:00Z'))
})
test('production-sized six-source counts are preserved; fetch-only completion NEVER PASS',()=>{
  const r=receipt(); assert.equal(r.db.sources.reduce((n,s)=>n+s.record_count,0),7500)
  assert.equal(r.db.sources[5].record_count,5500); assert.equal(r.projection.microsoft.verdict,'STALE')
  assert.equal(r.projection.microsoft.applyRunId,null)
})
test('only exact job-linked terminal agent APPLY can certify latest completed apply',()=>{
  assert.equal(receipt(applied(fixture())).projection.microsoft.verdict,'PASS')
  for (const status of ['applying','partial','failed']) assert.notEqual(receipt(applied(fixture(),status)).projection.microsoft.verdict,'PASS')
  for (const field of ['preview_job_id','trigger_type']) {
    const db=applied(fixture()); db.runs[0][field]='other'; assert.notEqual(receipt(db).projection.microsoft.verdict,'PASS')
  }
})
test('fresh older terminal apply does not make newer fetch-only job green',()=>{
  const db=applied(fixture()); db.runs[0].preview_job_id='old-job'; assert.notEqual(receipt(db).projection.microsoft.verdict,'PASS')
})
test('source count, cursor, incomplete details and error contradictions remain non-green',()=>{
  for (const patch of [{records_count:1},{has_cursor:true},{pending_details:1},{has_error:true},{complete:false}]) {
    const db=applied(fixture()); Object.assign(db.sources[5],patch); assert.notEqual(receipt(db).projection.microsoft.verdict,'PASS')
  }
})
test('July manual applying run is identified, fingerprinted and never adopted',()=>{
  const db=fixture(); db.runs.push({id:'july',status:'applying',trigger_type:'manual',preview_job_id:null,created_at:'2026-07-20T00:00:00Z'})
  const r=receipt(db); assert.equal(r.projection.microsoft.applyRunId,null); assert.ok(r.db.protected.some(g=>g.scope==='july_manual_apply'))
})
test('completed and cancelled cached identities expose mismatches without writing or title matching',()=>{
  const db=fixture(); db.mirror_observations=[{source_type:'planner_task',source_name:'To Do',task_id:'exact-task',plan_id:'exact-plan',planner_status:'active'},
    {source_type:'outlook_event',event_id:'exact-event',calendar_id:'exact-calendar',calendar_status:'confirmed'},
    {source_type:'planner_task',source_name:'2025 CLIENTS SCHEDULE',task_id:'protected',planner_status:'active'}]
  const r=receipt(db); assert.equal(r.projection.mirrors.mismatches.length,2); assert.match(r.projection.mirrors.basis,/NOT a new/)
})
test('dynamic mapped fleet exceeds old 100-row limits; missing checkpoints not green',()=>{
  const db=fixture(); db.assets=Array.from({length:151},(_,i)=>({...asset,id:`a${i}`,client_id:`c${i}`}))
  const r=receipt(db); assert.equal(r.projection.meta.mappedAssets,151); assert.equal(r.projection.meta.stale,151)
})
test('exact terminal cooldown, independent healthy asset and old fact age retained',()=>{
  const db=fixture(); db.assets=[asset,{...asset,id:'healthy',client_id:'other'}]; db.items=[failure]
  db.checkpoints=[{asset_id:'healthy',client_id:'other',platform:'facebook',last_status:'complete',last_attempted_at:from,last_successful_at:from,next_due_at:'2026-10-02T23:20:00Z',high_watermark_at:from}]
  const r=receipt(db); assert.equal(r.projection.meta.blocked.length,1); assert.equal(r.projection.meta.blocked[0].retryAt,'2026-10-02T18:29:00.000Z')
  assert.equal(r.projection.meta.platforms.find(p=>p.assetId==='healthy').verdict,'PASS'); assert.equal(r.db.checkpoints[0].last_successful_at,from)
})
test('new successful exact checkpoint supersedes blocked history; unrelated checkpoints do not',()=>{
  const db=fixture(); db.assets=[asset]; db.items=[failure]
  db.checkpoints=[{asset_id:'asset',client_id:'client',platform:'facebook',last_status:'complete',last_successful_at:to,last_attempted_at:to,next_due_at:'2026-10-02T23:30:00Z'}]
  assert.equal(receipt(db).projection.meta.blocked.length,0)
  db.checkpoints[0].client_id='foreign'; assert.equal(receipt(db).projection.meta.blocked.length,1)
})
test('transient abort keeps recovery truth, no terminal access suppression',()=>{
  const db=fixture(); db.assets=[asset]; db.items=[{...failure,error:'AbortError: The signal has been aborted'}]
  assert.equal(receipt(db).projection.meta.blocked.length,0)
})
test('empty fleet batches and missing consecutive dispatches are explicit, never transport PASS',()=>{
  const db=fixture(); db.batches=[{id:'empty',via:'fleet_freshness',actual_items:0}]; db.ticks[4].dispatches=0
  const r=receipt(db); assert.deepEqual(r.projection.meta.emptyFleetBatches,['empty']); assert.equal(r.projection.meta.consecutiveDispatchMinutes,false)
})
test('missing schema/access/arrays, RLS filtering, overflow and omitted fingerprints fail closed',()=>{
  for (const key of ['jobs','protected','facts','platform_runs']) { const db=fixture(); delete db[key]; assert.throws(()=>receipt(db)) }
  const db=fixture(); db.unfiltered=false; assert.throws(()=>receipt(db))
  db.unfiltered=true; db.items=Array(MAX_ROWS+1).fill({}); assert.throws(()=>receipt(db))
})
test('raw credential-like fields/values rejected; null and explicit zero facts remain distinct',()=>{
  const db=fixture(); db.facts=[{id:'missing',value:null},{id:'zero',value:0}]
  const r=receipt(db); assert.equal(r.db.facts[0].value,null); assert.equal(r.db.facts[1].value,0)
  for (const item of [{access_token:'forbidden'},{error:'Bearer forbidden'}]) { db.items=[item]; assert.throws(()=>receipt(db)) }
})
test('stable canonical hash; tampering and incompatible windows/roles rejected',()=>{
  const r=receipt(); assert.equal(receipt().receiptHash,r.receiptHash); assert.equal(verifyReceipt(r),r)
  assert.throws(()=>verifyReceipt({...r,sourceSha:'b'.repeat(40)})); assert.throws(()=>compareReceipts(r,r))
  const f=structuredClone(functions); f[0].verify_jwt=false
  assert.throws(()=>makeReceipt({db:fixture(),logs:[],functions:f,from,to,sourceSha,phase:'pre'}))
})
test('pre/post hashes prove named protected/native scopes; changed rows never silently repaired',()=>{
  const db=fixture(),before=receipt(db); assert.equal(compareReceipts(before,post(db)).protectedUnchanged,true)
  db.protected[0].hash=hash('staff edit'); db.planner_plan_guards[0].count=2
  const comparison=compareReceipts(before,post(db)); assert.equal(comparison.protectedUnchanged,false); assert.equal(comparison.guards.filter(g=>!g.unchanged).length,2)
})
test('failed refresh preserves complete/zero evidence, original verified age and watermark',()=>{
  const db=fixture(); db.facts=[{id:'fact',client_id:'client',asset_id:'asset',platform:'facebook',period_month:'2026-10',metric_key:'followers',comparable_group:'snapshot',availability:'valid_zero',value:0,verified_at:from,source_metric:'followers_count'}]
  db.checkpoints=[{asset_id:'asset',client_id:'client',platform:'facebook',high_watermark_at:from}]
  const before=receipt(db); assert.deepEqual(compareReceipts(before,post(db)).factRegressions,[])
  db.facts[0].value=null; db.facts[0].availability='unavailable'; db.checkpoints[0].high_watermark_at=null
  const c=compareReceipts(before,post(db)); assert.deepEqual(c.factRegressions,['fact']); assert.equal(c.watermarkRegressions.length,1)
})
test('capture calls only dedicated read-only SQL, logs and inventory APIs with fixed queries; no retries',async()=>{
  const calls=[]; const db=fixture()
  const r=await capture({from,to,sourceSha,phase:'pre',accessToken:'private-test-only',fetchImpl:async(url,options)=>{
    calls.push({url,options}); return {ok:true,json:async()=>calls.length===1 ? [{evidence:db}] : calls.length===2 ? {result:[{source:'function_edge_logs',function_id:FUNCTIONS[0].id,events:1,http_546:1,cpu_exceeded:0,http_5xx:1}]} : functions}
  }})
  assert.equal(calls.length,3); assert.match(calls[0].url,/database\/query\/read-only$/); assert.equal(calls[0].options.redirect,'error')
  assert.deepEqual(JSON.parse(calls[0].options.body),{query:databaseQuery(from,to)}); assert.equal(calls[1].options.method,'GET'); assert.match(calls[2].url,/\/functions$/)
  assert.equal(r.logs[0].http_546,1); assert.ok(!JSON.stringify(r).includes('private-test-only'))
  let count=0; await assert.rejects(capture({from,to,sourceSha,phase:'pre',accessToken:'private-test-only',fetchImpl:async()=>{count++; return {ok:false}}})); assert.equal(count,1)
  await assert.rejects(capture({from,to,sourceSha,phase:'pre',accessToken:null,fetchImpl:()=>assert.fail('must not call')}))
})
test('SQL is one fixed SELECT, bounded arrays, no secret tables/RPCs/raw errors/cron commands returned',()=>{
  const sql=databaseQuery(from,to)
  const statements=sql.replace(/--[^\n]*/g,'').replace(/'(?:[^']|'')*'/g,"''")
  assert.ok(!/\b(insert|update|delete|alter|grant|revoke|create|set_config|net\.|http_post|apply_microsoft|claim_)\b/i.test(statements))
  assert.ok(!/connection_tokens|oauth_states|vault\.|auth\.users/.test(sql)); assert.match(sql,/row_security_active/); assert.match(sql,/LIMIT 20001/)
  assert.match(sql,/s\.job_id=\(SELECT id FROM jobs/); assert.equal((statements.match(/;/g)??[]).length,1)
})
test('log null/empty counts and foreign function identity fail closed, numeric zero stays observed',()=>{
  const log={source:'function_edge_logs',function_id:FUNCTIONS[0].id,events:0,http_546:0,cpu_exceeded:0,http_5xx:0}
  const make=logs=>makeReceipt({db:fixture(),logs,functions,from,to,sourceSha,phase:'pre'})
  assert.equal(make([log]).logs[0].events,0)
  for (const invalid of [null,'',undefined,-1]) assert.throws(()=>make([{...log,http_546:invalid}]))
  assert.throws(()=>make([{...log,function_id:'foreign'}]))
})
test('paused lifecycle and failed/missing terminal apply counts cannot certify PASS',()=>{
  const db=applied(fixture()); db.microsoft_lifecycle.transition_status='paused'
  assert.notEqual(receipt(db).projection.microsoft.verdict,'PASS')
  db.microsoft_lifecycle.transition_status='active'
  for (const failed of [1,null,undefined]) { db.runs[0].failed=failed; assert.notEqual(receipt(db).projection.microsoft.verdict,'PASS') }
  delete db.microsoft_lifecycle; assert.throws(()=>receipt(db))
})
test('advanced fact age needs exact-client/platform/month terminal stored run evidence',()=>{
  const db=fixture(); db.facts=[{id:'f',client_id:'c',asset_id:'a',platform:'facebook',period_month:'2026-10-01',metric_key:'followers',comparable_group:'snapshot',availability:'complete',value:1,verified_at:from,sync_run_id:'sync'}]
  const before=receipt(db); db.facts[0].verified_at=to
  assert.equal(compareReceipts(before,post(db)).unverifiedFactAgeChanges.length,1)
  db.platform_runs=[{id:'sync',client_id:'c',asset_id:'a',platform:'facebook',period_month:'2026-10-01',status:'success',finished_at:to}]
  assert.equal(compareReceipts(before,post(db)).unverifiedFactAgeChanges.length,0)
  for (const change of [{client_id:'other'},{period_month:'2026-09-01'},{status:'failed'},{finished_at:null}]) {
    const other=structuredClone(db); Object.assign(other.platform_runs[0],change)
    assert.equal(compareReceipts(before,post(other)).unverifiedFactAgeChanges.length,1)
  }
})
test('terminal cooldown expiration permits evidence-based retry without forcing green',()=>{
  const db=fixture(); db.assets=[asset]; db.items=[failure]
  db.observed_at='2026-10-02T19:30:00Z'
  const r=receipt(db); assert.equal(r.projection.meta.blocked.length,0); assert.notEqual(r.projection.meta.verdict,'PASS')
})
test('CLI defaults offline; rejects deploy/apply/custom URL and does not expose ambient credentials',()=>{
  const cli=new URL('../scripts/observe-freshness-rollout.mjs',import.meta.url)
  for (const args of [['deploy'],['capture','--url','https://wrong'],['plan','--from',from,'--to',to]]) {
    const run=spawnSync(process.execPath,[cli.pathname.replace(/^\/(\w:)/,'$1'),...args],{encoding:'utf8',env:{...process.env,SUPABASE_ACCESS_TOKEN:'never-show-test-value'}})
    assert.equal(run.status,args[0]==='plan'?0:1); assert.ok(!(run.stdout+run.stderr).includes('never-show-test-value'))
  }
  assert.ok(!readFileSync(cli,'utf8').includes('functions.invoke'))
})
