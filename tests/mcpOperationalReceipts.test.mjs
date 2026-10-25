import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'
import { parseIdempotencyRead, ownsOperationalReceipt, commitOperationalWrite } from '../supabase/functions/cg-dynamics-mcp/operationalReceipts.ts'

test('actual PostgREST table-array receipts are read; unknown/error/empty/repeated rows fail closed',()=>{
  assert.deepEqual(parseIdempotencyRead([{already_executed:false,existing_result:null}],null),{duplicate:false})
  const result={task:{id:'task'},receipt:{contract:'mcp_operational_atomic_v1',entity_id:'task',idempotency_key:'key'}}
  assert.deepEqual(parseIdempotencyRead([{already_executed:true,existing_result:result}],null),{duplicate:true,result})
  assert.equal(ownsOperationalReceipt('create_task',result),true)
  for(const data of [null,[],[{},{}],{},[{already_executed:'false'}],[{already_executed:true,existing_result:null}]]) assert.throws(()=>parseIdempotencyRead(data,null),/invalid/)
  assert.throws(()=>parseIdempotencyRead([{already_executed:false}],{message:'private'}),/lookup failed/)
  assert.equal(ownsOperationalReceipt('create_task',{...result,task:{id:'foreign'}}),false)
  assert.equal(ownsOperationalReceipt('update_task',result),true)
  assert.equal(ownsOperationalReceipt('update_lead',result),false)
  assert.equal(ownsOperationalReceipt('create_task',result,{actorId:'foreign',key:'other-key'}),false)
})

test('create adapter keeps both server identities and fails without durable receipt, never falls back',async()=>{
  for(const data of [null,{id:'unacknowledged'},{task:{id:'saved'},receipt:{contract:'mcp_operational_atomic_v1',idempotency_key:'key',entity_id:'saved',actor_profile_id:'actor',tool_name:'create_task'}}]){
    const calls=[]
    const staff={profileId:'actor',contextKind:'staff',connection:{userId:'principal'},supabase:{async rpc(name,args){calls.push({name,args});return {data,error:null}}}}
    const result=await commitOperationalWrite(staff,'create_task',{idempotency_key:'key'},{title:'Synthetic'},'hash')
    assert.equal(Boolean(result.error),!data?.receipt)
    assert.equal(calls.length,1)
    assert.equal(calls[0].name,'mcp_commit_operational_write')
    assert.equal(calls[0].args.p_actor_profile_id,'actor')
    assert.equal(calls[0].args.p_connection_principal_user_id,'principal')
    assert.equal(calls[0].args.p_input_hash,'hash')
  }
})

test('operational date inputs never rely on database-relative timezone parsing or invented calendar dates',async()=>{
  const staff={profileId:'actor',contextKind:'staff',connection:{userId:'principal'},supabase:{rpc(){throw Error('Invalid date must stop before RPC')}}}
  for(const date of ['tomorrow','2026-02-30','2026-10-01T00:00:00Z','',42]){
    assert.ok((await commitOperationalWrite(staff,'create_task',{idempotency_key:'key'},{due_date:date},'hash')).error)
    assert.ok((await commitOperationalWrite(staff,'create_recurring_task',{idempotency_key:'key'},{recurrence_until:date},'hash')).error)
  }
})

test('actual dispatcher preserves existing canonical replay and nullable-success semantics outside the operational lane',async()=>{
  let handlerCalls=0
  const rpcs=[]
  const subject={profileId:'10000000-0000-4000-8000-000000000002',connection:{userId:'10000000-0000-4000-8000-000000000001',profileId:'10000000-0000-4000-8000-000000000001',role:'admin'},supabase:{async rpc(name){rpcs.push(name);return{data:[{already_executed:true,existing_result:{status:'success'}}],error:null}}}}
  const dispatch=actualOperationalDispatcher(subject,{log_ordinary_hours:async()=>{handlerCalls++;return {entry_id:'original-canonical-record',error:null}}})
  const result=await dispatch({idempotency_key:'same-key'},'log_ordinary_hours')
  assert.equal(result.result.isError,false)
  assert.equal(JSON.parse(result.result.content[0].text).entry_id,'original-canonical-record')
  assert.equal(handlerCalls,1)
  assert.deepEqual(rpcs,['mcp_check_idempotency'],'the existing canonical backend owns replay; no extra generic status receipt')
  const denied=await dispatch({idempotency_key:'other',context:{context_kind:'client',client_id:'40000000-0000-4000-8000-000000000001'}},'log_ordinary_hours')
  assert.ok(denied.error)
  assert.equal(handlerCalls,1)
})

const read=p=>readFileSync(p,'utf8')
const migration=read('supabase/migrations/20261018164542_mcp_operational_atomic_receipts.sql')
function definition(file,name,end){const s=read(file),a=s.toLowerCase().indexOf(`create or replace function public.${name}(`),b=s.indexOf(end,a);assert.ok(a>=0&&b>a);return s.slice(a,b+end.length)}

test('actual atomic create SQL commits canonical entity/assignments and original receipt together', {skip:!process.env.CG_LOCAL_PGLITE_MODULE}, async t=>{
  const {PGlite}=await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db=await PGlite.create()
  const admin='10000000-0000-4000-8000-000000000001',staff='10000000-0000-4000-8000-000000000002',client='10000000-0000-4000-8000-000000000003',other='10000000-0000-4000-8000-000000000004',inactive='10000000-0000-4000-8000-000000000005',board='20000000-0000-4000-8000-000000000001',activeClient='40000000-0000-4000-8000-000000000001'
  let n=0
  const next=()=>`50000000-0000-4000-8000-${String(++n).padStart(12,'0')}`
  const call=(key,payload,tool='create_task',hash='hash',actor=staff,principal=admin,context='staff')=>db.query('select public.mcp_commit_operational_write($1,$2,$3,$4,$5,$6,$7) as result',[actor,principal,context,tool,key,hash,JSON.stringify(payload)]).then(r=>r.rows[0].result)
  const count=table=>db.query(`select count(*)::int as n from public.${table}`).then(r=>r.rows[0].n)
  const task={title:'Synthetic exact-client work',assignee_name:'Synthetic Staff',client_id:activeClient,client_name:'Synthetic Client'}
  const event={title:'Synthetic shoot',event_type:'shoot',start_at:'2026-10-22T09:00:00+02:00',end_at:'2026-10-22T10:00:00+02:00',sync_intent:'dynamics_only',client_id:activeClient,client_name:'Synthetic Client'}
  try{
    await db.exec(read('tests/sql/planner_native_lifecycle_fixture.sql'))
    await db.exec(read('tests/sql/mcp_operational_receipts_fixture.sql'))
    await db.exec(read('supabase/migrations/20260909133000_mcp_idempotency_log.sql'))
    await db.exec(read('supabase/migrations/20260909190000_mcp_dual_principal_audit.sql'))
    await db.exec(definition('supabase/migrations/20260728180000_planner_multi_assignment.sql','set_planner_task_assignees_internal','$$;'))
    await db.exec(definition('supabase/migrations/20260911170000_mcp_staff_write_actor.sql','create_assistant_task','$function$;'))
    await db.exec(definition('supabase/migrations/20260911170000_mcp_staff_write_actor.sql','create_assistant_recurring_task','$$;'))
    await db.exec(read('supabase/migrations/20261018155046_planner_native_lifecycle_guards.sql'))
    await db.exec(migration)
    await db.exec('grant select,insert on public.mcp_idempotency_log to service_role;')
    for(const [id,name,role,active] of [[admin,'Synthetic Admin','admin',true],[staff,'Synthetic Staff','staff',true],[other,'Other Staff','staff',true],[client,'Client user','client',true],[inactive,'Inactive','staff',false]]) await db.query('insert into profiles values($1,$2,$3,$4)',[id,name,role,active])
    await db.query("insert into planner_boards(id,slug,visibility) values($1,'operations-todo','staff')",[board])
    await db.query("insert into planner_buckets values(gen_random_uuid(),$1,'CLIENT REQUESTS',null,0)",[board])
    await db.query("insert into clients values($1,'Synthetic Client',true)",[activeClient])
    await db.exec("select set_config('request.jwt.claim.role','service_role',false),set_config('request.jwt.claim.sub','',false); set role service_role;")
    await t.test('real task creator, real multi-assignment helper, audit and receipt; lost response retry returns same ID',async()=>{
      const key=next(),result=await call(key,task)
      assert.equal(result.task.assigned_to_name,'Synthetic Staff')
      const before=await count('planner_tasks'),audit=await count('planner_activity_log')
      assert.deepEqual(await call(key,task),result)
      assert.equal(await count('planner_tasks'),before)
      const check=await db.query('select * from public.mcp_check_idempotency($1,$2,$3,$4)',[staff,'create_task',key,'hash'])
      assert.deepEqual(check.rows[0],{already_executed:true,existing_result:result})
      assert.equal(result.receipt.entity_id,result.task.id)
      assert.equal(ownsOperationalReceipt('create_task',result),true)
      assert.equal(await count('planner_activity_log'),audit)
    })
    await t.test('changed payload conflicts and staff principals cannot borrow another actor',async()=>{
      const key=next();await call(key,task)
      await assert.rejects(call(key,{...task,title:'Changed'},'create_task','changed'),/payload conflict/)
      await assert.rejects(call(next(),task,'create_task','hash',staff,other),/borrow another actor/)
      await assert.rejects(call(next(),task,'create_task','hash',staff,staff,'company_admin'),/Exact company admin/)
      for(const actor of [client,inactive]) await assert.rejects(call(next(),task,'create_task','hash',actor),/Active workforce/)
    })
    await t.test('actual comment/status/assignment RPCs replay once; staff cannot reassign or act on another owner',async()=>{
      const original=await call(next(),task),id=original.task.id,key=next()
      const update={task_id:id,action:'comment',note:'Synthetic unique comment'}
      const commented=await call(key,update,'update_task')
      assert.deepEqual(await call(key,update,'update_task'),commented)
      assert.equal(commented.task.notes.split('Synthetic unique comment').length-1,1)
      for(const [action,status] of [['start','in_progress'],['complete','done'],['reopen','to_do']]) assert.equal((await call(next(),{task_id:id,action},'update_task')).task.status,status)
      await assert.rejects(call(next(),{task_id:id,action:'reassign',assignee_name:'Other Staff'},'update_task'),/Only a manager/)
      const reassigned=await call(next(),{task_id:id,action:'reassign',assignee_name:'Other Staff'},'update_task','hash',admin,admin,'company_admin')
      assert.equal(reassigned.task.assigned_to_name,'Other Staff')
      await assert.rejects(call(next(),{task_id:id,action:'complete'},'update_task'),/canonical assignee/)
      assert.equal((await call(next(),{task_id:id,action:'complete'},'update_task','hash',other)).task.status,'done')
    })
    await t.test('real recurring creator returns the original template rather than a second instance-generating template',async()=>{
      const key=next(),payload={...task,recurrence_rule:'FREQ=WEEKLY;BYDAY=MO,WE',recurrence_until:null}
      const first=await call(key,payload,'create_recurring_task'),before=await count('planner_tasks')
      assert.deepEqual(await call(key,payload,'create_recurring_task'),first)
      assert.equal(await count('planner_tasks'),before)
      assert.equal(first.template.recurrence_rule,payload.recurrence_rule)
      assert.equal(first.template.assigned_to_name,'Synthetic Staff')
      assert.equal(ownsOperationalReceipt('create_recurring_task',first),true)
    })
    await t.test('explicit monthly ordinal rules persist and re-read verbatim through the same atomic creator',async()=>{
      for(const rule of ['FREQ=MONTHLY;BYDAY=1MO','FREQ=MONTHLY;BYDAY=2TH','FREQ=MONTHLY;INTERVAL=2;BYDAY=-1FR']){
        const key=next(),payload={...task,recurrence_rule:rule,recurrence_until:null}
        const first=await call(key,payload,'create_recurring_task')
        const saved=(await db.query('select recurrence_rule,assigned_to_name from planner_tasks where id=$1',[first.template.id])).rows[0]
        assert.equal(saved.recurrence_rule,rule)
        assert.equal(saved.assigned_to_name,'Synthetic Staff')
        const before=await count('planner_tasks')
        assert.deepEqual(await call(key,payload,'create_recurring_task'),first)
        assert.equal(await count('planner_tasks'),before)
        await assert.rejects(call(key,{...payload,recurrence_rule:'FREQ=MONTHLY;BYDAY=3TH'},'create_recurring_task','changed-rule'),/Idempotency payload conflict/)
      }
    })
    await t.test('SQL itself refuses historical and Microsoft-linked edits even if HTTP preflight was stale',async()=>{
      const original=await call(next(),task),id=original.task.id
      for(const [field,value] of [['archived_at','2026-10-18T10:00:00Z'],['superseded_by_task_id',other],['microsoft_source_removed_at','2026-10-18T10:00:00Z'],['microsoft_task_id','exact-upstream']]){
        await db.exec('reset role;')
        await db.query(`update planner_tasks set ${field}=$1 where id=$2`,[value,id])
        await db.exec('set role service_role;')
        await assert.rejects(call(next(),{task_id:id,action:'comment',note:'Must not land'},'update_task'),/Exact active|Microsoft-linked/)
        await db.exec('reset role;')
        assert.equal((await db.query('select notes from planner_tasks where id=$1',[id])).rows[0].notes,null)
        await db.query(`update planner_tasks set ${field}=null where id=$1`,[id])
        await db.exec('set role service_role;')
      }
    })
    await t.test('native calendar create repeats same ID without source identity or publication; bad client/time/fields refuse',async()=>{
      const key=next(),result=await call(key,event,'upsert_calendar_event')
      assert.deepEqual(await call(key,event,'upsert_calendar_event'),result)
      assert.equal(result.sync_state,'DYNAMICS_ONLY')
      assert.equal(result.event.microsoft_event_id,null)
      assert.equal(result.event.microsoft_last_synced_at,null)
      const row=(await db.query('select client_visible from company_calendar_events where id=$1',[result.event.id])).rows[0]
      assert.equal(row.client_visible,false)
      for(const patch of [{client_name:'Wrong Client'},{client_id:other},{start_at:'2026-10-22T09:00:00'},{end_at:'2026-10-22T08:00:00+02:00'},{client_visible:true},{microsoft_event_id:'source'}]) await assert.rejects(call(next(),{...event,...patch},'upsert_calendar_event'))
    })
    await t.test('calendar update/cancel receipts preserve notes and original state; drift/history/source identity are checked under lock',async()=>{
      const created=await call(next(),{...event,notes:'Staff note'},'upsert_calendar_event'),id=created.event.id
      const read=()=>db.query('select * from company_calendar_events where id=$1',[id]).then(r=>r.rows[0])
      const revision=(await read()).updated_at.toISOString(),key=next()
      const update={action:'update',event_id:id,expected_updated_at:revision,sync_intent:'dynamics_only',title:'Rescheduled title'}
      const changed=await call(key,update,'upsert_calendar_event')
      assert.equal(changed.event.title,'Rescheduled title')
      assert.equal((await read()).notes,'Staff note')
      assert.deepEqual(await call(key,update,'upsert_calendar_event'),changed)
      await assert.rejects(call(next(),update,'upsert_calendar_event'),/revision drift/)
      const cancel={action:'cancel',event_id:id,expected_updated_at:(await read()).updated_at.toISOString(),sync_intent:'dynamics_only'}
      assert.equal((await call(next(),cancel,'upsert_calendar_event')).event.status,'cancelled')
      await db.exec('reset role;')
      await db.query('update company_calendar_events set superseded_by_event_id=$1 where id=$2',[other,id])
      await db.exec('set role service_role;')
      await assert.rejects(call(next(),{...cancel,expected_updated_at:(await read()).updated_at.toISOString()},'upsert_calendar_event'),/current event/)
      await db.exec('reset role;')
      await db.query("update company_calendar_events set superseded_by_event_id=null,microsoft_event_id='provider-event',microsoft_calendar_id='provider-calendar' where id=$1",[id])
      await db.exec('set role service_role;')
      await assert.rejects(call(next(),{...cancel,expected_updated_at:(await read()).updated_at.toISOString()},'upsert_calendar_event'),/cannot detach/)
    })
    await t.test('linked calendar outcome, active client identity and visibility remain separate from receipt success',async()=>{
      const linked=await call(next(),{...event,sync_intent:'coexistence',outlook_write_succeeded:true,microsoft_event_id:'exact-provider',microsoft_calendar_id:'calendar-A'},'upsert_calendar_event')
      assert.equal(linked.sync_state,'BOTH_SIDES_REPORTED_OK')
      const id=linked.event.id,revision=(await db.query('select updated_at from company_calendar_events where id=$1',[id])).rows[0].updated_at.toISOString()
      await assert.rejects(call(next(),{action:'update',event_id:id,expected_updated_at:revision,sync_intent:'coexistence',outlook_write_succeeded:true,microsoft_event_id:'wrong-provider',microsoft_calendar_id:'calendar-A'},'upsert_calendar_event'),/identity mismatch/)
      const partial=await call(next(),{action:'update',event_id:id,expected_updated_at:revision,title:'Partial caller outcome',sync_intent:'coexistence',outlook_write_succeeded:false},'upsert_calendar_event')
      assert.equal(partial.sync_state,'PARTIAL SYNC')
      assert.equal(partial.event.microsoft_last_synced_at,linked.event.microsoft_last_synced_at)
      await db.exec('reset role;')
      await db.query('update company_calendar_events set client_visible=true where id=$1',[id])
      await db.query("insert into clients values($1,'Other Synthetic Client',true)",[other])
      await db.exec('set role service_role;')
      const current=(await db.query('select updated_at from company_calendar_events where id=$1',[id])).rows[0].updated_at.toISOString()
      await assert.rejects(call(next(),{action:'update',event_id:id,expected_updated_at:current,sync_intent:'coexistence',outlook_write_succeeded:false,client_id:other,client_name:'Other Synthetic Client'},'upsert_calendar_event'),/cannot be reassigned/)
    })
    await t.test('receipt insertion failure rolls back the actual task, assignment, notification and audit; same key then recovers',async()=>{
      await db.exec('reset role;')
      const before={tasks:await count('planner_tasks'),assignments:await count('planner_task_assignees'),audit:await count('planner_activity_log'),notifications:await count('notifications')}
      await db.exec("create function fixture_refuse_receipt() returns trigger language plpgsql as $$ begin raise exception 'Synthetic receipt unavailable'; end $$; create trigger fixture_fail_receipt before insert on mcp_idempotency_log for each row execute function fixture_refuse_receipt(); set role service_role;")
      const key=next()
      await assert.rejects(call(key,task,'create_task','hash',admin,admin,'company_admin'),/Synthetic receipt unavailable/)
      await db.exec('reset role;')
      assert.deepEqual({tasks:await count('planner_tasks'),assignments:await count('planner_task_assignees'),audit:await count('planner_activity_log'),notifications:await count('notifications')},before)
      await db.exec('drop trigger fixture_fail_receipt on mcp_idempotency_log; set role service_role;')
      assert.ok((await call(key,task,'create_task','hash',admin,admin,'company_admin')).task.id)
    })
    await t.test('receipt failure also rolls back calendar insert and comment append, not just task creation',async()=>{
      const created=await call(next(),task),id=created.task.id
      await db.exec('reset role;')
      const before=await count('company_calendar_events')
      await db.exec('create trigger fixture_fail_receipt before insert on mcp_idempotency_log for each row execute function fixture_refuse_receipt(); set role service_role;')
      await assert.rejects(call(next(),event,'upsert_calendar_event'),/Synthetic receipt unavailable/)
      await assert.rejects(call(next(),{task_id:id,action:'comment',note:'Must roll back'},'update_task'),/Synthetic receipt unavailable/)
      await db.exec('reset role;')
      assert.equal(await count('company_calendar_events'),before)
      assert.equal((await db.query('select notes from planner_tasks where id=$1',[id])).rows[0].notes,null)
      await db.exec('drop trigger fixture_fail_receipt on mcp_idempotency_log; set role service_role;')
    })
    await t.test('actual MCP dispatcher + creator + table-array RPC replay the original SQL record and never double-log',async()=>{
      const calls=[]
      const subject={profileId:staff,fullName:'Synthetic Staff',contextKind:'staff',connection:{userId:admin,profileId:admin,role:'admin'},supabase:{async rpc(name,args){
        calls.push(name)
        if(name==='mcp_check_idempotency')return {data:(await db.query('select * from public.mcp_check_idempotency($1,$2,$3,$4)',[args.p_caller_profile_id,args.p_tool_name,args.p_idempotency_key,args.p_input_hash])).rows,error:null}
        if(name==='mcp_commit_operational_write')return {data:await call(args.p_idempotency_key,args.p_payload,args.p_tool_name,args.p_input_hash,args.p_actor_profile_id,args.p_connection_principal_user_id,args.p_context_kind),error:null}
        throw Error(`Unexpected non-atomic write/log: ${name}`)
      }}}
      const dispatch=actualOperationalDispatcher(subject),input={title:'Dispatcher exact record',idempotency_key:'readable-retry-key'}
      const first=await dispatch(input),second=await dispatch(input)
      assert.deepEqual(second,first)
      assert.equal(calls.filter(name=>name==='mcp_commit_operational_write').length,1)
      assert.equal(first.result.isError,false)
      const conflict=await dispatch({...input,title:'Changed payload'})
      assert.equal(conflict.result.isError,true)
      assert.equal(JSON.parse(conflict.result.content[0].text).status,'conflict')
      const normalRpc=subject.supabase.rpc
      let loseAck=true
      subject.supabase.rpc=async(name,args)=>{
        const result=await normalRpc(name,args)
        if(name==='mcp_commit_operational_write'&&loseAck){loseAck=false;return {data:null,error:{message:'Synthetic lost HTTP response after commit'}}}
        return result
      }
      const lostInput={...input,idempotency_key:'lost-response-key'}
      assert.equal((await dispatch(lostInput)).result.isError,true)
      const recovered=await dispatch(lostInput)
      assert.equal(recovered.result.isError,false)
      assert.ok(JSON.parse(recovered.result.content[0].text).task.id)
      assert.equal(calls.filter(name=>name==='mcp_commit_operational_write').length,2,'one write for each distinct request, not a duplicate for recovery')
      subject.supabase.rpc=async()=>({data:null,error:{message:'Synthetic receipt read failure'}})
      const failed=await dispatch({...input,idempotency_key:'new-key'})
      assert.match(failed.error.message,/No action was attempted/)
    })
    await t.test('legacy receipt without original record refuses, and real grants deny anon/authenticated execution',async()=>{
      const key=next();await db.query("insert into mcp_idempotency_log(caller_profile_id,tool_name,idempotency_key,input_hash) values($1,'create_task',$2,'hash')",[staff,key])
      await assert.rejects(call(key,task),/Legacy receipt unverified/)
      await db.exec('reset role; set role authenticated;')
      await assert.rejects(call(next(),task),/permission denied/)
      await db.exec('reset role; set role anon;')
      await assert.rejects(call(next(),task),/permission denied/)
      await db.exec('reset role;')
    })
    t.diagnostic('Actual SQL/creator/assignment helper in ephemeral PostgreSQL, least-privilege service role. Not a hosted schema, production trigger or simultaneous multi-connection acceptance claim.')
  }finally{await db.close()}
})
