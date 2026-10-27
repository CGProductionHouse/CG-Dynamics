import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

const migration=readFileSync('supabase/migrations/20261018155046_planner_native_lifecycle_guards.sql','utf8')
test('canonical lifecycle guards retain actor/assignment authority and execute under the row lock',()=>{
  for(const name of ['update_assistant_task','update_planner_task_status']){
    const start=migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
    const body=migration.slice(start,migration.indexOf('$function$;',start))
    assert.ok(start>=0)
    const lock=body.toLowerCase().indexOf('for update;'), guard=body.indexOf("raise exception 'Historical Planner tasks cannot be updated'")
    assert.ok(lock>0&&guard>lock)
    assert.match(body,/v_task\.archived_at is not null or v_task\.superseded_by_task_id is not null\s+or v_task\.microsoft_source_removed_at is not null/)
    assert.match(body,/auth\.uid\(\) is null and auth\.role\(\) = 'service_role' then p_actor_profile_id else auth\.uid\(\)/)
    assert.match(body,/planner_task_assignees/)
    assert.match(body,/board\.archived_at is null/)
    assert.match(migration,new RegExp(`revoke all on function public\\.${name}\\([^;]+from public, anon;`))
  }
  assert.doesNotMatch(migration,/create table|alter table|delete from|truncate|insert into public\.clients/i)
})

test('actual lifecycle RPC SQL executes against isolated embedded PostgreSQL', {skip:!process.env.CG_LOCAL_PGLITE_MODULE},async t=>{
  const {PGlite}=await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db=await PGlite.create()
  const admin='10000000-0000-4000-8000-000000000001',staff='10000000-0000-4000-8000-000000000002',foreign='10000000-0000-4000-8000-000000000003',inactive='10000000-0000-4000-8000-000000000004',client='10000000-0000-4000-8000-000000000005',board='20000000-0000-4000-8000-000000000001',task='30000000-0000-4000-8000-000000000001'
  const status=(value,actor=admin)=>db.query('select (public.update_planner_task_status($1,$2,$3)).*',[task,value,actor])
  const action=(value,actor=admin)=>db.query('select (public.update_assistant_task($1,$2,null,null,$3,$4)).*',[task,value,'Synthetic note',actor])
  const claims=async(role='service_role',sub='')=>{await db.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)",[role,sub])}
  try{
    await db.exec(readFileSync('tests/sql/planner_native_lifecycle_fixture.sql','utf8'))
    await db.exec(migration)
    for(const[id,name,role,active]of[[admin,'Synthetic Admin','admin',true],[staff,'Synthetic Staff','staff',true],[foreign,'Other Staff','staff',true],[inactive,'Inactive','staff',false],[client,'Client','client',true]])await db.query('insert into profiles values($1,$2,$3,$4)',[id,name,role,active])
    await db.query("insert into planner_boards values($1,'staff',null)",[board])
    await db.query("insert into planner_tasks(id,board_id,title,status,helper_names) values($1,$2,'Synthetic task','to_do','{}')",[task,board])
    await db.query('insert into planner_task_assignees values($1,$2)',[task,staff])
    await claims()
    await t.test('admin starts native work; same status is an audited no-op',async()=>{
      assert.equal((await status('in_progress')).rows[0].status,'in_progress')
      const count=(await db.query('select count(*)::int as count from planner_activity_log')).rows[0].count
      await status('in_progress')
      assert.equal((await db.query('select count(*)::int as count from planner_activity_log')).rows[0].count,count)
    })
    await t.test('canonical assignee can complete/reopen; foreign staff cannot borrow admin actor',async()=>{
      assert.equal((await status('done',staff)).rows[0].status,'done')
      assert.equal((await status('to_do',staff)).rows[0].status,'to_do')
      await assert.rejects(status('done',foreign),/not assigned/)
      await claims('authenticated',foreign)
      await assert.rejects(status('done',admin),/not assigned/)
      await claims()
    })
    await t.test('inactive/client/anonymous/invalid status remain refused',async()=>{
      await assert.rejects(status('done',inactive),/Active staff/)
      await assert.rejects(status('done',client),/Staff access/)
      await assert.rejects(status('not-a-status'),/Unsupported/)
      await assert.rejects(status(null),/Unsupported/)
      assert.equal((await db.query("select has_function_privilege('anon','public.update_planner_task_status(uuid,text,uuid)','execute') as allowed")).rows[0].allowed,false)
    })
    for(const field of ['archived_at','superseded_by_task_id','microsoft_source_removed_at'])await t.test(`${field}: both actual RPCs refuse every attempted history mutation`,async()=>{
      const value=field==='superseded_by_task_id'?foreign:'2026-10-18T10:00:00Z'
      await db.query(`update planner_tasks set ${field}=$1 where id=$2`,[value,task])
      const before=(await db.query('select count(*)::int as count from planner_activity_log')).rows[0].count
      await assert.rejects(status('done'),/Historical/)
      for(const operation of ['complete','block','comment','due','assign'])await assert.rejects(action(operation),/Archived|Historical/)
      assert.equal((await db.query('select count(*)::int as count from planner_activity_log')).rows[0].count,before)
      assert.equal((await db.query('select status from planner_tasks where id=$1',[task])).rows[0].status,'to_do')
      await db.query(`update planner_tasks set ${field}=null where id=$1`,[task])
    })
    await t.test('an archived board is not an editable task destination',async()=>{
      await db.query('update planner_boards set archived_at=now() where id=$1',[board])
      await assert.rejects(status('done'),/board not visible/)
      await assert.rejects(action('comment'),/board not visible/)
    })
    t.diagnostic('Actual migration + both RPC bodies executed in ephemeral PostgreSQL; not hosted Supabase/RLS or multi-session concurrency acceptance. Assignment-write helper deliberately unavailable.')
  }finally{await db.close()}
})
