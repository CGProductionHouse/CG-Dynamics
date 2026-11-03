import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
let server, finish
before(async()=>{
 server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}})
 ;({finishSharedScheduleDateRefresh:finish}=await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/shared-schedule-dates.ts'))
})
after(async()=>{await server?.close()})
const mirror=(status='completed')=>({status,runId:'exact-run',applied:3,skipped:2,failed:0,conflicts:0,clientScheduleExcluded:6205,error:null})
function fixture(data={checked:8,changed:1,held:0},error=null,saved={data:{id:'exact-run'},error:null}){
 const calls=[]
 return {calls,db:{
  rpc:async(name,args)=>{calls.push({name,args});return{data,error}},
  from:(table)=>({update:(patch)=>{const call={table,patch,filters:[]};calls.push(call);return{eq:(key,value)=>{call.filters.push([key,value]);return{eq:(key,value)=>{call.filters.push([key,value]);return{in:(key,value)=>{call.filters.push([key,value]);return{select:()=>({maybeSingle:async()=>saved})}}}}}}}}})
 }}
}
test('one exact completed automatic run invokes only the date-only transaction',async()=>{
 const f=fixture(),input=mirror(),before=structuredClone(input),out=await finish(f.db,input)
 assert.deepEqual(f.calls,[{name:'refresh_shared_client_schedule_source_dates',args:{p_run_id:'exact-run'}}])
 assert.equal(out.sharedScheduleDates.changed,1);assert.equal(out.applied,3);assert.equal(out.clientScheduleExcluded,6205)
 assert.deepEqual(input,before)
})
test('failed, in-flight or unidentified mirror work never starts date writes',async()=>{
 for(const status of ['failed','applying']){const f=fixture();assert.deepEqual(await finish(f.db,mirror(status)),mirror(status));assert.equal(f.calls.length,0)}
 const f=fixture();await finish(f.db,{...mirror(),runId:null});assert.equal(f.calls.length,0)
})
test('partial operational mirrors can refresh independently safe dates without hiding their prior error',async()=>{
 const f=fixture(),input={...mirror('partial'),error:'Existing exact-source conflict'},out=await finish(f.db,input)
 assert.equal(out.status,'partial');assert.equal(out.error,input.error);assert.equal(out.sharedScheduleDates.changed,1);assert.equal(f.calls.length,1)
})
test('missing migration, malformed results, held staff edits and bounded work remain honestly partial',async()=>{
 for(const [data,error] of [[null,{message:'not installed'}],[{checked:8,changed:9,held:0},null],[{checked:8,changed:0,held:1},null],[{checked:0,changed:0,held:0,blocked:'stale'},null],[{checked:1000,changed:0,held:0,bounded:true},null]]){
 const f=fixture(data,error),out=await finish(f.db,mirror())
 assert.equal(out.status,'partial');assert.ok(out.error)
 assert.equal(f.calls[1].table,'microsoft_sync_runs');assert.deepEqual(f.calls[1].filters,[['id','exact-run'],['trigger_type','agent'],['status',['completed','partial']]])
 assert.deepEqual(Object.keys(f.calls[1].patch).sort(),['safe_error','status'])
 }
})
test('a concurrently changed or unreadable run never receives a false recorded-partial receipt',async()=>{
 for(const saved of [{data:null,error:null},{data:null,error:{message:'database unavailable'}}]){
 const f=fixture({checked:8,changed:0,held:1},null,saved),out=await finish(f.db,mirror())
 assert.equal(out.status,'failed');assert.match(out.error,/Could not record/)
 }
})
