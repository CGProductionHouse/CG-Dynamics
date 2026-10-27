import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import {createClient} from '@supabase/supabase-js'
import {fetchAllPages} from '../src/lib/paginatedQuery.ts'

const source=readFileSync('src/lib/microsoftImportData.ts','utf8')
const fragment=source.slice(source.indexOf('export async function loadMicrosoftSyncRunItems'),source.indexOf('export async function loadMicrosoftSyncState'))
const js=ts.transpileModule(fragment,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.replace('export async function','async function')
const row=n=>({id:'row-'+n,run_id:'run',item_key:'key-'+n,source_type:'planner_task',source_container_id:'plan',source_item_id:'task-'+n,source_name:'To Do',destination:'planner',destination_id:null,action:'conflict',result_status:'skipped',source_complete:true,details:{},safe_error:null})
async function read({count=1707,mutate=p=>p,headCount,throwRead=false}={}){
  const requests=[];let heads=0
  const supabase=createClient('https://synthetic.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
    const u=new URL(url);requests.push({method:init.method,url:u})
    assert.ok(['HEAD','GET'].includes(init.method));assert.equal(u.pathname,'/rest/v1/microsoft_sync_run_items');assert.equal(u.searchParams.get('run_id'),'eq.run')
    if(throwRead)throw Error('transport sentinel')
    if(init.method==='HEAD'){heads++;const n=headCount?headCount(heads):count;return new Response(null,{status:200,headers:n===null?{}:{'content-range':`*/${n}`}})}
    assert.equal(u.searchParams.get('order'),'created_at.asc,id.asc')
    const a=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??1000)
    const data=mutate(Array.from({length:Math.max(0,Math.min(limit,count-a))},(_,n)=>row(a+n)),a)
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})
  }}})
  const subject=new Function('supabase','fetchAllPages','microsoftSafeApplyError',`${js};return loadMicrosoftSyncRunItems`)(supabase,fetchAllPages,()=>null)
  return {result:await subject('run'),requests}
}
test('actual loader + real PostgREST SDK traverse1707 exact-run rows, verify exact counts and never write',async()=>{
  const {result,requests}=await read()
  assert.equal(result.error,null);assert.equal(result.data.length,1707)
  assert.equal(requests.filter(r=>r.method==='HEAD').length,2)
  assert.equal(requests.filter(r=>r.method==='GET').length,2)
})
test('null, missing counts, truncated, repeated, foreign, malformed and changed reads fail closed',async()=>{
  for(const options of [
    {headCount:()=>null},{mutate:()=>null},{mutate:p=>p.slice(0,10)},
    {mutate:(p,a)=>a?p.map((r,n)=>n? r : {...r,id:'row-0'}):p},
    {mutate:p=>p.map(r=>({...r,run_id:'foreign'}))},
    {mutate:p=>p.map(r=>({...r,details:null}))},
    {mutate:p=>p.map(r=>({...r,item_key:'same'}))},
    {headCount:n=>n===1?1707:1708},{throwRead:true},
  ]){const {result}=await read(options);assert.ok(result.error);assert.deepEqual(result.data,[]);assert.ok(!result.error.includes('sentinel'))}
})
test('explicit counted zero is a valid empty journal, unlike a failed read',async()=>{
  const {result}=await read({count:0});assert.equal(result.error,null);assert.deepEqual(result.data,[])
})
