import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const migration = readFileSync('supabase/migrations/20261025091300_planner_guarded_staff_edits.sql','utf8')
const original = readFileSync('supabase/migrations/20260728180000_planner_multi_assignment.sql','utf8')
const planner = readFileSync('src/lib/planner.ts','utf8')
const functionSql = name => {const start=original.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0);return original.slice(start,original.indexOf('$$;',start)+3)}

test('guarded client transport fails closed on missing migration and never falls back to legacy',async()=>{
  const part=planner.slice(planner.indexOf('export async function updatePlannerTaskWithAssignees('),planner.indexOf('export async function updatePlannerTaskStatus('))
  const code=ts.transpileModule(part.replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const calls=[],update=new Function('supabase',`${code};return updatePlannerTaskWithAssignees`)({rpc:async(name,args)=>{calls.push({name,args});return {data:null,error:{code:'PGRST202',message:'PRIVATE'}}}})
  const input={title:'Synthetic',assignee_profile_ids:[],checklist:[]}
  const result=await update('synthetic',input,'2026-10-25T13:00:00.123456Z')
  assert.match(result.error.message,/Safe Planner edit setup/)
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'update_planner_task_with_assignees_guarded')
  assert.equal(calls[0].args.p_expected_updated_at,'2026-10-25T13:00:00.123456Z')
  await update('synthetic',input,'invalid');assert.equal(calls.length,1)
  await update('synthetic',input);assert.equal(calls[1].name,'update_planner_task_with_assignees')
})

test('actual guarded wrapper + existing core SQL preserve staff edits atomically', {skip:!process.env.CG_LOCAL_PGLITE_MODULE},async t=>{
  const {PGlite}=await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href),db=await PGlite.create()
  const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,admin=id(1),manager=id(2),staff=id(3),client=id(4),inactive=id(5),board=id(10),task=id(11)
  const source=[{title:'Staff-amended source item',isChecked:true,orderHint:' !',extra:{preserve:'exact'}}]
  const revision=async()=>(await db.query('select updated_at::text as v from planner_tasks where id=$1',[task])).rows[0].v
  const call=(expected,checklist=source,assignees=[staff])=>db.query('select * from public.update_planner_task_with_assignees_guarded($1,$2,null,null,null,$3,$4,null,null,$5,$6::jsonb,$7::uuid[],$8)',[task,'Synthetic task','to_do','normal','Reviewed note',JSON.stringify(checklist),assignees,expected])
  try{
    await db.exec(readFileSync('tests/sql/planner_guarded_staff_edits_fixture.sql','utf8'))
    const baseline=readFileSync('supabase/phase-6-cg-planner-core.sql','utf8')
    const revisionStart=baseline.indexOf('create or replace function public.update_planner_updated_at()')
    assert.ok(revisionStart>=0)
    await db.exec(baseline.slice(revisionStart,baseline.indexOf('$$;',revisionStart)+3))
    const importSql=readFileSync('supabase/phase-6e-teams-planner-import.sql','utf8')
    const triggerStart=importSql.indexOf('create trigger trg_planner_tasks_updated_at')
    assert.ok(triggerStart>=0)
    await db.exec(importSql.slice(triggerStart,importSql.indexOf(';',triggerStart)+1))
    await db.exec(functionSql('is_active_planner_manager'))
    await db.exec(functionSql('set_planner_task_assignees_internal'))
    await db.exec(functionSql('update_planner_task_with_assignees'))
    const coreSignature='public.update_planner_task_with_assignees(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[])'
    const guardSignature='public.update_planner_task_with_assignees_guarded(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamptz)'
    const definition=async signature=>(await db.query('select pg_get_functiondef(to_regprocedure($1)) v',[signature])).rows[0].v
    const originalDefinition=await definition(coreSignature)
    const readback=readFileSync('scripts/sql/planner-guarded-edits-readback.sql','utf8')
    const beforeReadback=await db.exec(readback)
    assert.equal(beforeReadback[0].rows.find(row=>row.signature.includes('_guarded(')).present,false)
    await db.exec(migration)
    await t.test('migration reapplication and catalog-only readback preserve the original contract',async()=>{
      const first=await definition(guardSignature)
      await db.exec(migration)
      assert.equal(await definition(guardSignature),first)
      assert.equal(await definition(coreSignature),originalDefinition)
      await db.exec('begin read only')
      try{
        const receipt=await db.exec(readback)
        const guard=receipt[0].rows.find(row=>row.signature.includes('_guarded('))
        assert.equal(guard.present,true)
        assert.equal(guard.security_definer,true)
        assert.deepEqual([guard.anon_execute,guard.authenticated_execute,guard.service_execute],[false,true,false])
        assert.ok(receipt[2].rows.some(row=>row.table_name==='planner_tasks'))
      }finally{await db.exec('rollback')}
    })
    for(const[user,role,active]of[[admin,'admin',true],[manager,'manager',true],[staff,'staff',true],[client,'client',true],[inactive,'manager',false]])await db.query('insert into profiles values($1,$2,$3,$4)',[user,'Synthetic',role,active])
    await db.query("insert into planner_boards values($1,'staff',null)",[board])
    await db.query("insert into planner_tasks(id,board_id,title,status,priority,checklist,updated_at) values($1,$2,'Synthetic task','to_do','normal',$3,'2026-10-25T13:00:00.123456Z')",[task,board,JSON.stringify(source)])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
    await t.test('stale open drawer cannot replace a newer checklist; exact current revision retains all source fields',async()=>{
      const old=await revision()
      await db.query("update planner_tasks set notes='Another staff edit' where id=$1",[task])
      await assert.rejects(call(old,[]),/Task changed/)
      assert.deepEqual((await db.query('select checklist,notes from planner_tasks')).rows[0],{checklist:source,notes:'Another staff edit'})
      assert.equal((await db.query('select count(*)::int n from planner_activity_log')).rows[0].n,0)
      const expected=await revision(),saved=await call(expected)
      assert.deepEqual(saved.rows[0].checklist,source)
      assert.equal(saved.rows[0].notes,'Reviewed note')
      await assert.rejects(call(expected,[]),/Task changed/)
    })
    await t.test('failed delegated assignment rolls back core/checklist/audit edits',async()=>{
      const before=(await db.query('select to_jsonb(t) v from planner_tasks t')).rows[0].v
      const count=(await db.query('select count(*)::int n from planner_activity_log')).rows[0].n
      await assert.rejects(call(await revision(),[],[client]),/Assignees must be active named workforce profiles/)
      assert.deepEqual((await db.query('select to_jsonb(t) v from planner_tasks t')).rows[0].v,before)
      assert.equal((await db.query('select count(*)::int n from planner_activity_log')).rows[0].n,count)
    })
    await t.test('actual assignment-only helper advances actual baseline revision and refuses an old drawer',async()=>{
      const old=await revision()
      const before=(await db.query('select notes,checklist from planner_tasks')).rows[0]
      await db.query('select public.set_planner_task_assignees_internal($1,$2::uuid[],$3,true,$4)',[task,[manager,staff],admin,'local_acceptance'])
      assert.notEqual(await revision(),old)
      assert.deepEqual((await db.query('select notes,checklist from planner_tasks')).rows[0],before)
      assert.deepEqual((await db.query('select profile_id from planner_task_assignees order by position')).rows.map(row=>row.profile_id),[manager,staff])
      await assert.rejects(call(old,[]),/Task changed/)
      const current=await revision()
      await db.query('select public.set_planner_task_assignees_internal($1,$2::uuid[],$3,true,$4)',[task,[manager,staff],admin,'local_acceptance'])
      assert.equal(await revision(),current,'identical assignment replay does not touch the row')
    })
    await t.test('roles, missing revision, hidden board and historical rows fail before mutation',async()=>{
      for(const user of [staff,client,inactive,'']){
        await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user])
        await assert.rejects(call(await revision()),/Active manager/)
      }
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[manager])
      await assert.rejects(call(null),/Reload the task/)
      await db.query("update planner_boards set visibility='admin_only'")
      await assert.rejects(call(await revision()),/unavailable/)
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
      for(const field of ['archived_at','superseded_by_task_id','microsoft_source_removed_at']){
        await db.query(`update planner_tasks set ${field}=$1`,[field==='superseded_by_task_id'?id(99):'2026-10-25T13:00:00Z'])
        await assert.rejects(call(await revision()),/Historical/)
        await db.query(`update planner_tasks set ${field}=null`)
      }
      await db.query("update planner_boards set archived_at=now()")
      await assert.rejects(call(await revision()),/unavailable/)
      for(const role of ['anon','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.update_planner_task_with_assignees_guarded(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamptz)','execute') v",[role])).rows[0].v,false)
    })
    await t.test('real database roles cannot bypass execution ACL or active-manager guard',async()=>{
      const expected=await revision()
      for(const role of ['anon','service_role','authenticated']){
        await db.query("select set_config('request.jwt.claim.sub',$1,false)",[role==='authenticated'?staff:admin])
        await db.exec(`set role ${role}`)
        try{await assert.rejects(call(expected),role==='authenticated'?/Active manager/:/permission denied/)}
        finally{await db.exec('reset role')}
      }
      await db.query('update planner_boards set archived_at=null')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
      const current=await revision()
      await db.exec('set role authenticated')
      try{assert.equal((await call(current)).rows[0].id,task)}
      finally{await db.exec('reset role')}
    })
    await t.test('exact wrapper rollback leaves core, staff checklist, assignments and audit byte-stable',async()=>{
      const snapshot=async()=> (await db.query('select (select jsonb_agg(to_jsonb(t)) from planner_tasks t) tasks,(select jsonb_agg(to_jsonb(a)) from planner_task_assignees a) assignees,(select jsonb_agg(to_jsonb(l)) from planner_activity_log l) audit')).rows[0]
      const before=await snapshot()
      await db.exec(`drop function ${guardSignature} restrict`)
      assert.equal(await definition(coreSignature),originalDefinition)
      assert.deepEqual(await snapshot(),before)
      assert.equal((await db.exec(readback))[0].rows.find(row=>row.signature.includes('_guarded(')).present,false)
      await db.exec(migration)
      assert.deepEqual(await snapshot(),before)
    })
  }finally{await db.close()}
})
