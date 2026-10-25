import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import ts from 'typescript'
import { commitOperationalWrite } from '../supabase/functions/cg-dynamics-mcp/operationalReceipts.ts'
import { parseRecurrenceRule } from '../src/lib/recurrenceRule.ts'
const path='supabase/functions/cg-dynamics-mcp/index.ts'
const source=process.env.CG_MCP_BASELINE==='1'?execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}):readFileSync(path,'utf8')
function extract(name,end,dependencies={}){const a=source.indexOf(`const ${name}:`),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);const js=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(dependencies),`${js};return ${name}`)(...Object.values(dependencies))}
const createDependencies={commitOperationalWrite,computeInputHash:async()=> 'synthetic-hash'}
const task=extract('handleUpdateTask','const handleUpdateLead:',{...createDependencies,handleGetTask:async staff=>staff.visible===false?{error:'denied'}:{id:'task'}})
const calendar=extract('handleUpsertCalendarEvent','// -- #325 coexistence actions',{...createDependencies,CALENDAR_EVENT_TYPES:['meeting','shoot','content_run','client_event','internal','deadline'],CALENDAR_STATUSES:['planned','confirmed','completed','cancelled'],assertRecordClientMatchesContext:()=>({allowed:true})})
const baseTask={id:'task',archived_at:null,microsoft_task_id:null,superseded_by_task_id:null,microsoft_source_removed_at:null}
test('native creation requires a durable canonical receipt and preserves the explicit staff actor',async()=>{
  const create=extract('handleCreateTask','const handleUpdateTask:',createDependencies)
  for(const data of[null,{}, {task:{id:'saved'},receipt:{contract:'mcp_operational_atomic_v1',entity_id:'saved',idempotency_key:'key',actor_profile_id:'actor',tool_name:'create_task'}}]){
    const calls=[]
    const result=await create({profileId:'actor',contextKind:'staff',connection:{userId:'principal'},fullName:'Synthetic Staff',supabase:{async rpc(name,args){calls.push({name,args});return{data,error:null}}}},{title:'Synthetic task',idempotency_key:'key'})
    assert.equal(Boolean(result.error),!data?.receipt)
    assert.equal(calls[0].name,'mcp_commit_operational_write')
    assert.equal(calls[0].args.p_actor_profile_id,'actor')
    assert.equal(calls[0].args.p_payload.assignee_name,'Synthetic Staff')
    assert.equal(calls[0].args.p_connection_principal_user_id,'principal')
  }
})

test('recurring creation validates the same supported rule contract before the atomic exact-actor RPC',async()=>{
  const recurring=extract('handleCreateRecurringTask','// ── Mail Draft Handler',{...createDependencies,parseRecurrenceRule})
  const calls=[]
  const staff={profileId:'actor',contextKind:'staff',connection:{userId:'principal'},fullName:'Synthetic Staff',supabase:{async rpc(name,args){calls.push({name,args});return{data:{template:{id:'template'},receipt:{contract:'mcp_operational_atomic_v1',entity_id:'template',idempotency_key:'key',actor_profile_id:'actor',tool_name:'create_recurring_task'}},error:null}}}}
  for(const rule of ['FREQ=DAILY;COUNT=3','FREQ=DAILY;INTERVAL=1.5','FREQ=WEEKLY;BYDAY=XX'])assert.ok((await recurring(staff,{recurrence_rule:rule,idempotency_key:'key'})).error)
  assert.equal(calls.length,0)
  const result=await recurring(staff,{title:'Synthetic recurring',recurrence_rule:'FREQ=WEEKLY;BYDAY=MO,WE',idempotency_key:'key'})
  assert.equal(result.template.id,'template')
  assert.equal(calls[0].args.p_actor_profile_id,'actor')
  assert.equal(calls[0].args.p_payload.assignee_name,'Synthetic Staff')
})
async function change(action,options={}){
  const calls=[],existing={...baseTask,...options.existing};const q={select(){return this},eq(){return this},maybeSingle:async()=>({data:options.missing?null:existing,error:options.readError?{message:'private'}:null})}
  const staff={profileId:'actor',contextKind:'staff',connection:{userId:'principal'},visible:options.visible,supabase:{from(){return q},async rpc(name,args){calls.push({name,args});return{data:options.nullResult?null:{task:{id:'task',status:args.p_payload.action==='start'?'in_progress':'to_do'},receipt:{contract:'mcp_operational_atomic_v1',entity_id:'task',idempotency_key:'key',actor_profile_id:'actor',tool_name:'update_task'}},error:options.rpcError?{message:'canonical permission denied'}:null}}}}
  return{result:await task(staff,{task_id:'task',action,idempotency_key:'key',...options.input}),calls}
}

test('actual recurring handler preserves explicit ordinal rules and rejects inferred or broadened selectors before any RPC',async()=>{
  const recurring=extract('handleCreateRecurringTask','// ── Mail Draft Handler',{...createDependencies,parseRecurrenceRule})
  const calls=[]
  const staff={profileId:'actor',contextKind:'staff',connection:{userId:'principal'},fullName:'Synthetic Staff',supabase:{async rpc(name,args){calls.push({name,args});return{data:{template:{id:'template'},receipt:{contract:'mcp_operational_atomic_v1',entity_id:'template',idempotency_key:args.p_idempotency_key,actor_profile_id:'actor',tool_name:'create_recurring_task'}},error:null}}}}
  for(const rule of ['FREQ=MONTHLY;BYDAY=1MO','FREQ=MONTHLY;BYDAY=2TH','FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR']){
    const result=await recurring(staff,{title:'Synthetic explicit recurring task',recurrence_rule:rule,idempotency_key:`exact-${calls.length}`})
    assert.equal(result.error,undefined)
    assert.equal(calls.at(-1).args.p_payload.recurrence_rule,rule)
    assert.equal(calls.at(-1).args.p_actor_profile_id,'actor')
    assert.equal(calls.at(-1).name,'mcp_commit_operational_write')
  }
  const before=calls.length
  for(const rule of ['FREQ=MONTHLY;BYDAY=MO','FREQ=MONTHLY;BYDAY=0MO','FREQ=MONTHLY;BYDAY=1MO,2TH','FREQ=WEEKLY;BYDAY=1MO','FREQ=MONTHLY;BYDAY=1MO;COUNT=2'])assert.ok((await recurring(staff,{title:'Synthetic',recurrence_rule:rule,idempotency_key:'never-used'})).error)
  assert.equal(calls.length,before)
})
test('actual native reopen/start call the existing audited explicit-actor status RPC',async()=>{
  for(const[action,status]of[['reopen','to_do'],['start','in_progress']]){const{result,calls}=await change(action);assert.equal(result.error,undefined);assert.equal(result.task.status,status);assert.equal(calls.length,1);assert.equal(calls[0].name,'mcp_commit_operational_write');assert.equal(calls[0].args.p_payload.action,action);assert.equal(calls[0].args.p_actor_profile_id,'actor')}
})
test('actual reassignment preserves exact assignee and canonical manager enforcement; no silent unassign',async()=>{
  const{result,calls}=await change('reassign',{input:{assignee_name:'Synthetic Staff'}});assert.equal(result.error,undefined);assert.equal(calls[0].name,'mcp_commit_operational_write');assert.equal(calls[0].args.p_payload.assignee_name,'Synthetic Staff');assert.equal(calls[0].args.p_actor_profile_id,'actor')
  assert.equal((await change('assign')).calls.length,0);assert.ok((await change('reassign',{input:{assignee_name:'Other'},rpcError:true})).result.error)
})
test('unreadable/foreign/archived/superseded/removed and Microsoft mirrors never enter a task mutation',async()=>{
  for(const options of[{readError:true},{missing:true},{visible:false},{existing:{archived_at:'now'}},{existing:{superseded_by_task_id:'new'}},{existing:{microsoft_source_removed_at:'now'}},{existing:{microsoft_task_id:'exact-source'}}]){const{result,calls}=await change('complete',options);assert.ok(result.error);assert.deepEqual(calls,[])}
  for(const action of['reopen','start','complete','comment','due','block','assign','reassign']){const{result,calls}=await change(action,{existing:{microsoft_task_id:'source'},input:{assignee_name:'Other'}});assert.match(result.error,/MICROSOFT_WRITE_REQUIRED/);assert.deepEqual(calls,[])}
})
test('null task save and canonical permission failure never claim success',async()=>{
  for(const action of['reopen','start','complete','comment','due','block']){assert.ok((await change(action,{nullResult:true})).result.error);assert.ok((await change(action,{rpcError:true})).result.error)}
})
const sourceInput={action:'create',title:'Synthetic meeting',start_at:'2026-10-20T09:00:00+02:00',end_at:'2026-10-20T10:00:00+02:00',microsoft_event_id:'outlook-event',microsoft_calendar_id:'calendar-a',outlook_write_succeeded:true}
async function save(input=sourceInput,options={}){
  const calls=[];let write=false;const existing=options.existing?{updated_at:'2026-10-18T12:00:00Z',...options.existing}:null
  const q={select(){return this},eq(k,v){calls.push(['eq',k,v]);return this},is(k,v){calls.push(['is',k,v]);return this},insert(v){write=true;calls.push(['insert',v]);return this},update(v){write=true;calls.push(['update',v]);return this},async maybeSingle(){if(!write)return{data:existing,error:options.readError?{message:'PRIVATE lookup'}:null};return{data:options.nullWrite?null:{id:existing?.id??'saved'},error:options.writeError?{message:'PRIVATE write'}:null}}}
  const rpc=async(name,args)=>{calls.push(['rpc',name,args]);const p=args.p_payload,partial=p.sync_intent!=='dynamics_only'&&p.outlook_write_succeeded===false,id=p.event_id??'saved';return{data:options.nullWrite?null:{verdict:partial?'PARTIAL_SYNC':'PASS',event:{id},sync_state:p.sync_intent==='dynamics_only'?'DYNAMICS_ONLY':partial?'PARTIAL SYNC':'BOTH_SIDES_REPORTED_OK',receipt:{contract:'mcp_operational_atomic_v1',entity_id:id,idempotency_key:'key',actor_profile_id:'actor',tool_name:'upsert_calendar_event'}},error:options.writeError?{message:'PRIVATE write'}:null}}
  return{result:await calendar({profileId:'actor',connection:{userId:'principal'},contextKind:'company_admin',effectiveClientId:null,supabase:{from(){return q},rpc}},{idempotency_key:'key',...input}),calls}
}
test('calendar source lookups are pinned to both IDs; failed lookup never becomes a new event',async()=>{
  const{result,calls}=await save(sourceInput,{readError:true});assert.ok(result.error);assert.ok(calls.some(c=>c[1]==='microsoft_calendar_id'&&c[2]==='calendar-a'));assert.ok(!calls.some(c=>c[0]==='insert'||c[0]==='update'))
  assert.ok((await save({...sourceInput,microsoft_calendar_id:undefined})).result.error)
})
test('calendar rejects naive/reversed dates, changed identities, superseded rows and unconfirmed save receipts',async()=>{
  for(const input of[{...sourceInput,start_at:'2026-10-20T09:00:00'},{...sourceInput,end_at:'2026-10-20T08:00:00+02:00'}]){const{result,calls}=await save(input);assert.ok(result.error);assert.ok(!calls.some(c=>c[0]==='insert'||c[0]==='update'))}
  for(const extra of[{superseded_by_event_id:'new'},{microsoft_source_removed_at:'now'},{microsoft_calendar_id:'other'}]){const{result,calls}=await save({...sourceInput,event_id:'existing'},{existing:{id:'existing',...extra}});assert.ok(result.error);assert.ok(!calls.some(c=>c[0]==='insert'||c[0]==='update'))}
  for(const options of[{nullWrite:true},{writeError:true}]){const{result}=await save(sourceInput,options);assert.equal(result.verdict,'FAIL');assert.doesNotMatch(JSON.stringify(result),/PRIVATE/)}
})
test('calendar confirmed receipt and partial-sync freshness remain honest',async()=>{
  assert.equal((await save()).result.verdict,'PASS')
  const{result,calls}=await save({...sourceInput,microsoft_event_id:undefined,microsoft_calendar_id:undefined,outlook_write_succeeded:false});assert.equal(result.verdict,'PARTIAL_SYNC');assert.ok(!('microsoft_last_synced_at'in calls.find(c=>c[0]==='rpc')[2].p_payload))
})

test('explicit Dynamics-only calendar work succeeds without claiming or performing an Outlook write',async()=>{
  const native={action:'create',sync_intent:'dynamics_only',title:'Synthetic native shoot',event_type:'shoot',start_at:'2026-10-20T09:00:00+02:00'}
  const {result,calls}=await save(native)
  assert.equal(result.verdict,'PASS')
  assert.equal(result.sync_state,'DYNAMICS_ONLY')
  const patch=calls.find(c=>c[0]==='rpc')[2].p_payload
  for(const key of ['microsoft_calendar_id','microsoft_event_id','microsoft_last_synced_at'])assert.ok(!(key in patch))
  for(const action of ['update','cancel']){
    const changed=await save({...native,action,event_id:'existing'}, {existing:{id:'existing',start_at:native.start_at}})
    assert.equal(changed.result.verdict,'PASS')
  }
  for(const patch of [{microsoft_event_id:'source',microsoft_calendar_id:'calendar'}, {outlook_write_succeeded:true}]){
    const refused=await save({...native,...patch});assert.ok(refused.result.error);assert.ok(!refused.calls.some(c=>['insert','update'].includes(c[0])))
  }
  const linked=await save({...native,action:'update',event_id:'existing'},{existing:{id:'existing',microsoft_event_id:'source',microsoft_calendar_id:'calendar'}})
  assert.ok(linked.result.error);assert.ok(!linked.calls.some(c=>['insert','update'].includes(c[0])))
  assert.ok((await save({...native,sync_intent:'guess'})).result.error)
  assert.ok((await save({...native,sync_intent:undefined})).result.error,'Legacy coexistence still requires explicit Outlook outcome')
})

test('calendar edits fence the exact revision and current lifecycle; unreadable revision never writes',async()=>{
  const input={action:'update',event_id:'existing',sync_intent:'dynamics_only',title:'Synthetic'}
  const saved=await save(input,{existing:{id:'existing'}})
  const payload=saved.calls.find(c=>c[0]==='rpc')[2].p_payload
  assert.equal(payload.expected_updated_at,'2026-10-18T12:00:00Z')
  assert.equal(payload.event_id,'existing')
  assert.ok(!saved.calls.some(c=>['update','insert'].includes(c[0])),'all writes go through the atomic RPC; SQL tests prove locked lifecycle checks')
  const missing=await save(input,{existing:{id:'existing',updated_at:undefined}})
  assert.match(missing.result.error,/revision/)
  assert.ok(!missing.calls.some(c=>['rpc','update','insert'].includes(c[0])))
  assert.equal((await save(input,{existing:{id:'existing'},nullWrite:true})).result.verdict,'FAIL')
})
