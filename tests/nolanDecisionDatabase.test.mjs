import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import test from 'node:test'
// Opt-in disposable DB only; never reads .env, publishes ports, or pulls images.
test('decision persistence and role isolation on disposable PostgreSQL', {skip:process.env.RUN_NOLAN_DECISION_DB_TESTS!=='1',timeout:90000},async()=>{
 const name='cg-nolan-decisions-'+randomUUID()
 const docker=args=>execFileSync('docker',args,{encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']})
 const sql=input=>execFileSync('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input,encoding:'utf8',timeout:10000,stdio:['pipe','pipe','pipe']}).trim()
 let created=false
 const admin='10000000-0000-4000-8000-000000000001', recipient='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',staff='10000000-0000-4000-8000-000000000004'
 const task='20000000-0000-4000-8000-000000000001', key='30000000-0000-4000-8000-000000000001'
 const as=(id,query)=>sql("set role authenticated;set request.jwt.claim.sub='"+id+"';"+query)
 try{
  docker(['run','--detach','--pull=never','--network','none','--tmpfs','/var/lib/postgresql/data','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);created=true
  let ready=false;for(let i=0;i<40;i++){try{docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break}catch{}await new Promise(r=>setTimeout(r,250))}
  assert.ok(ready)
  // Minimal synthetic canonical dependencies; not the full production schema.
  sql(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.profiles(id uuid primary key,full_name text,role text,is_active boolean);
   create table public.command_centre_tasks(id uuid primary key,title text,status text);
   insert into profiles values ('${admin}','Admin','admin',true),('${recipient}','Recipient','manager',true),('${other}','Other','manager',true),('${staff}','Staff','staff',true);
   insert into command_centre_tasks values ('${task}','Synthetic task','in_progress');`)
  sql(readFileSync('docs/ops/sql/nolan_explicit_decision_requests.draft.sql','utf8'))
  const preview=JSON.parse(as(admin,`select preview_nolan_decision_task('${task}');`))
  const create=(revision=preview.revision,question='Choose next step',who=recipient,k=key)=>`select create_nolan_decision_request('${task}','${revision}','${who}','${question}','${k}');`
  const id=as(admin,create());assert.equal(as(admin,create()),id)
  assert.throws(()=>as(admin,create(preview.revision,'Different question')),/Idempotency/)
  assert.throws(()=>as(recipient,create()),/administrator/)
  assert.throws(()=>as(admin,create(preview.revision,'Choose',staff,randomUUID())),/recipient/)
  assert.throws(()=>as(admin,create('stale','Choose',recipient,randomUUID())),/revision/)
  assert.equal(JSON.parse(as(other,'select list_my_nolan_decision_requests();')).rows.length,0)
  assert.equal(JSON.parse(as(recipient,'select list_my_nolan_decision_requests();')).rows[0].id,id)
  assert.throws(()=>as(staff,'select list_my_nolan_decision_requests();'),/manager access/)
  assert.throws(()=>sql('set role anon;select list_my_nolan_decision_requests();'),/permission denied/)
  assert.throws(()=>as(recipient,'select * from nolan_decision_requests;'),/permission denied/)
  assert.throws(()=>as(admin,`select close_nolan_decision_request('${id}',1,'resolve','Yes');`),/named recipient/)
  assert.throws(()=>as(other,`select close_nolan_decision_request('${id}',1,'withdraw',null);`),/unavailable/)
  sql("update command_centre_tasks set title='Changed' where id='"+task+"'")
  assert.throws(()=>as(recipient,`select close_nolan_decision_request('${id}',1,'resolve','Yes');`),/revision/)
  as(admin,`select close_nolan_decision_request('${id}',1,'withdraw',null);`)
  assert.throws(()=>as(admin,`select close_nolan_decision_request('${id}',1,'withdraw',null);`),/changed/)
  const latest=JSON.parse(as(admin,`select preview_nolan_decision_task('${task}');`))
  const next=as(admin,create(latest.revision,'Current question',recipient,randomUUID()))
  as(recipient,`select close_nolan_decision_request('${next}',1,'resolve','Recorded answer');`)
  assert.equal(sql("select status from command_centre_tasks where id='"+task+"'"),'in_progress')
  assert.equal(sql("select response from nolan_decision_requests where id='"+next+"'"),'Recorded answer')
  sql("update profiles set is_active=false where id='"+recipient+"'")
  assert.throws(()=>as(recipient,'select list_my_nolan_decision_requests();'),/manager access/)
 }finally{if(created)docker(['rm','--force',name])}
})
