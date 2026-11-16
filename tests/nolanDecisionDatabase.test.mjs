import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import test from 'node:test'
import {replayNolanCanonicalSchema} from './helpers/nolanCanonicalSchema.mjs'
// Opt-in disposable DB only; never reads .env, publishes ports, or pulls images.
for(const canonical of [false,true])test(`decision persistence and role isolation on ${canonical?'repository replay':'minimal'} disposable PostgreSQL`, {skip:process.env.RUN_NOLAN_DECISION_DB_TESTS!=='1',timeout:180000},async(t)=>{
 const name='cg-nolan-decisions-'+randomUUID()
 const docker=args=>execFileSync('docker',args,{encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']})
 const sql=input=>execFileSync('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input,encoding:'utf8',timeout:10000,stdio:['pipe','pipe','pipe']}).trim()

 // Keep the first transaction open until PostgreSQL confirms the second is
 // waiting on a real lock. No timing-only assertion or in-memory race model.
 const race=async(first,second)=>{
  const application='nolan_wait_'+randomUUID().replaceAll('-','')
  const session=()=>{
   const child=spawn('docker',['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']})
   let output='',errors=''
   child.stdout.on('data',chunk=>{output+=chunk})
   child.stderr.on('data',chunk=>{errors+=chunk})
   const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve({code,output:output.trim(),errors}))})
   return {child,done,output:()=>output}
  }
  const waitFor=async(check)=>{
   for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,25))}
   assert.fail('Expected PostgreSQL transaction/lock was not observed')
  }
  const holder=session();let waiter
  try{
   holder.child.stdin.write("begin;set statement_timeout='8s';"+first+"\n\\echo HOLDER_READY\n")
   await waitFor(()=>holder.output().includes('HOLDER_READY'))
   waiter=session()
   waiter.child.stdin.end("set statement_timeout='8s';set application_name='"+application+"';"+second)
   await waitFor(()=>sql("select count(*) from pg_stat_activity where application_name='"+application+"' and wait_event_type='Lock'")==='1')
   holder.child.stdin.end('commit;\n')
   const [a,b]=await Promise.all([holder.done,waiter.done])
   assert.equal(a.code,0,a.errors)
   return {first:a.output.replace('HOLDER_READY','').trim(),...b}
  }finally{
   if(!holder.child.stdin.writableEnded)holder.child.stdin.end('rollback;\n')
   await holder.done
   if(waiter)await waiter.done
  }
 }
 let created=false
 const admin='10000000-0000-4000-8000-000000000001', recipient='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',staff='10000000-0000-4000-8000-000000000004'
 const task='20000000-0000-4000-8000-000000000001', key='30000000-0000-4000-8000-000000000001'
 const as=(id,query)=>sql("set role authenticated;set request.jwt.claim.sub='"+id+"';"+query)
 try{
  docker(['run','--detach','--pull=never','--network','none','--tmpfs','/var/lib/postgresql/data','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);created=true
  // pg_isready also accepts the temporary bootstrap server; wait for PID 1
  // to become postgres before connecting so entrypoint restart cannot race setup.
  let ready=false;for(let i=0;i<40;i++){try{if(docker(['exec',name,'cat','/proc/1/comm']).trim()!=='postgres')throw new Error('entrypoint still initializing');docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break}catch{}await new Promise(r=>setTimeout(r,250))}
  assert.ok(ready)
  // Compare minimal dependencies with unmodified repository public schema/policies.
  // Both modes use synthetic identities; neither proves real authentication.
  if(canonical){
   const report=replayNolanCanonicalSchema(sql,'/tmp/nolan-canonical-replay.json')
   t.diagnostic(`Repository replay: ${report.filter(r=>r.result==='applied').length}/${report.length} files fully applied; exact failures in /tmp/nolan-canonical-replay.json`)
   for(const [id,role] of [[admin,'admin'],[recipient,'manager'],[other,'manager'],[staff,'staff']]){
    sql(`insert into auth.users(id,email,raw_user_meta_data) values ('${id}','${id}@example.invalid','{"full_name":"Synthetic fixture"}');update profiles set role='${role}' where id='${id}';`)
   }
   sql(`insert into command_centre_tasks(id,title,status) values ('${task}','Synthetic task','in_progress')`)
  }else sql(`create role anon;create role authenticated;create schema auth;
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

  const actorQuery=(actor,query)=>`set role authenticated;set request.jwt.claim.sub='${actor}';${query}`
  const freshRevision=()=>JSON.parse(as(admin,`select preview_nolan_decision_task('${task}');`)).revision
  const newRequest=()=>as(admin,create(freshRevision(),'Concurrent question',recipient,randomUUID()))

  if(canonical){
   await t.test('canonical task RLS and profile policies retain role/source isolation',()=>{
    const operational=randomUUID(),client=randomUUID()
    sql(`insert into auth.users(id,email) values ('${client}','${client}@example.invalid');
     insert into command_centre_tasks(id,title,bucket) values ('${operational}','Synthetic operational','Graphic Design')`)
    for(const actor of [admin,recipient,other])assert.equal(as(actor,`select count(*) from command_centre_tasks where id in ('${task}','${operational}')`),'2')
    assert.equal(as(staff,`select count(*) from command_centre_tasks where id='${task}'`),'0')
    assert.equal(as(staff,`select count(*) from command_centre_tasks where id='${operational}'`),'1')
    assert.equal(as(client,`select count(*) from command_centre_tasks where id in ('${task}','${operational}')`),'0')
    assert.equal(as(recipient,'select count(*) from profiles'),'1')
    assert.equal(as(staff,'select count(*) from profiles'),'1')
    as(staff,`update profiles set role='admin' where id='${staff}'`)
    as(recipient,`update profiles set is_active=false where id='${admin}'`)
    assert.equal(sql(`select role from profiles where id='${staff}'`),'staff')
    assert.equal(sql(`select is_active from profiles where id='${admin}'`),'t')
    assert.throws(()=>as(client,`select preview_nolan_decision_task('${operational}')`),/manager access/)
    assert.throws(()=>as(staff,`select preview_nolan_decision_task('${operational}')`),/manager access/)
    assert.throws(()=>as(recipient,create(freshRevision(),'Visible source is not producer authority',other,randomUUID())),/administrator/)
   })
   await t.test('canonical timestamp trigger and full-row hash invalidate non-title source changes',()=>{
    const before=JSON.parse(as(admin,`select preview_nolan_decision_task('${task}')`))
    assert.equal(JSON.parse(as(admin,`set timezone='Pacific/Auckland';select preview_nolan_decision_task('${task}')`)).revision,before.revision)
    const timestamp=sql(`select updated_at from command_centre_tasks where id='${task}'`)
    as(admin,`update command_centre_tasks set notes='Material source change',helper_names=array['Synthetic helper'] where id='${task}'`)
    assert.notEqual(sql(`select updated_at from command_centre_tasks where id='${task}'`),timestamp)
    assert.notEqual(freshRevision(),before.revision)
    assert.throws(()=>as(admin,create(before.revision,'Stale notes',recipient,randomUUID())),/revision/)
   })
   await t.test('canonical requester profile revocation wins concurrent create',async()=>{
    const revision=freshRevision(),k=randomUUID()
    const result=await race(actorQuery(admin,`update profiles set is_active=false where id='${admin}';`),actorQuery(admin,create(revision,'Revoked requester',recipient,k)))
    assert.notEqual(result.code,0);assert.match(result.errors,/administrator/)
    assert.equal(sql(`select count(*) from nolan_decision_requests where idempotency_key='${k}'`),'0')
    sql(`update profiles set is_active=true where id='${admin}'`)
   })
   await t.test('canonical recipient role revocation wins concurrent create',async()=>{
    const revision=freshRevision(),k=randomUUID()
    const result=await race(actorQuery(admin,`update profiles set role='staff' where id='${recipient}';`),actorQuery(admin,create(revision,'Revoked recipient',recipient,k)))
    assert.notEqual(result.code,0);assert.match(result.errors,/recipient/)
    assert.equal(sql(`select count(*) from nolan_decision_requests where idempotency_key='${k}'`),'0')
    assert.throws(()=>as(recipient,'select list_my_nolan_decision_requests()'),/manager access/)
    as(admin,`update profiles set role='manager' where id='${recipient}'`)
   })
   await t.test('canonical authenticated source edit wins concurrent response',async()=>{
    const request=newRequest()
    const result=await race(actorQuery(admin,`update command_centre_tasks set notes='Concurrent canonical edit' where id='${task}';`),actorQuery(recipient,`select close_nolan_decision_request('${request}',1,'resolve','Stale canonical answer');`))
    assert.notEqual(result.code,0);assert.match(result.errors,/Source revision changed/)
    assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),'pending:1')
   })
   await t.test('canonical source/profile deletion cannot orphan retained decision history',()=>{
    assert.throws(()=>as(admin,`delete from command_centre_tasks where id='${task}'`),/foreign key/)
    assert.throws(()=>sql(`delete from auth.users where id='${recipient}'`),/foreign key/)
   })
  }
  await t.test('simultaneous identical retries return one persisted receipt',async()=>{
   const k=randomUUID(),query=actorQuery(admin,create(freshRevision(),'Concurrent retry',recipient,k))
   const result=await race(query,query)
   assert.equal(result.code,0,result.errors)
   assert.equal(result.output,result.first)
   assert.equal(sql(`select count(*) from nolan_decision_requests where idempotency_key='${k}'`),'1')
  })
  await t.test('simultaneous conflicting key reuse rejects the second payload',async()=>{
   const k=randomUUID(),revision=freshRevision()
   const result=await race(actorQuery(admin,create(revision,'First payload',recipient,k)),actorQuery(admin,create(revision,'Second payload',recipient,k)))
   assert.notEqual(result.code,0);assert.match(result.errors,/Idempotency/)
   assert.equal(sql(`select question from nolan_decision_requests where idempotency_key='${k}'`),'First payload')
  })
  for(const firstAction of ['resolve','withdraw'])await t.test(`${firstAction} wins overlapping response/withdrawal CAS`,async()=>{
   const request=newRequest(),secondAction=firstAction==='resolve'?'withdraw':'resolve'
   const close=action=>actorQuery(action==='resolve'?recipient:admin,`select close_nolan_decision_request('${request}',1,'${action}','Answer');`)
   const result=await race(close(firstAction),close(secondAction))
   assert.notEqual(result.code,0);assert.match(result.errors,/Request changed/)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),`${firstAction==='resolve'?'resolved':'withdrawn'}:2`)
  })
  await t.test('source edit committed while create waits invalidates the preview',async()=>{
   const k=randomUUID(),revision=freshRevision()
   const result=await race(`update command_centre_tasks set title='Concurrent source edit' where id='${task}';`,actorQuery(admin,create(revision,'Stale question',recipient,k)))
   assert.notEqual(result.code,0);assert.match(result.errors,/Source revision changed/)
   assert.equal(sql(`select count(*) from nolan_decision_requests where idempotency_key='${k}'`),'0')
  })
  await t.test('source edit committed while response waits leaves request pending',async()=>{
   const request=newRequest()
   const result=await race(`update command_centre_tasks set title='Concurrent response edit' where id='${task}';`,actorQuery(recipient,`select close_nolan_decision_request('${request}',1,'resolve','Stale answer');`))
   assert.notEqual(result.code,0);assert.match(result.errors,/Source revision changed/)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),'pending:1')
  })
  await t.test('recipient revocation committed while response waits denies closure',async()=>{
   const request=newRequest()
   const result=await race(`update profiles set is_active=false where id='${recipient}';`,actorQuery(recipient,`select close_nolan_decision_request('${request}',1,'resolve','Revoked answer');`))
   assert.notEqual(result.code,0);assert.match(result.errors,/Active manager access/)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),'pending:1')
   sql(`update profiles set is_active=true where id='${recipient}'`)
  })

  await t.test('all RPCs reject client/team/staff/inactive/unknown and anonymous callers',()=>{
   const request=newRequest()
   const queries=[`select preview_nolan_decision_task('${task}');`,create(freshRevision(),'Denied',recipient,randomUUID()),'select list_my_nolan_decision_requests();',`select close_nolan_decision_request('${request}',1,'resolve','Denied');`]
   for(const role of ['client','team','staff']){
    const actor=randomUUID();if(canonical)sql(`insert into auth.users(id,email) values ('${actor}','${actor}@example.invalid');update profiles set role='${role}' where id='${actor}'`);else sql(`insert into profiles values ('${actor}','Denied role','${role}',true)`)
    for(const query of queries)assert.throws(()=>as(actor,query),/access required|administrator/)
   }
   for(const query of queries){
    assert.throws(()=>as(randomUUID(),query),/access required|administrator/)
    assert.throws(()=>sql('set role anon;'+query),/permission denied/)
   }
   sql(`update profiles set is_active=false where id='${admin}'`)
   for(const query of queries)assert.throws(()=>as(admin,query),/access required|administrator/)
   sql(`update profiles set is_active=true where id='${admin}'`)
  })
  await t.test('direct table mutations and actor helper remain inaccessible',()=>{
   for(const actor of [admin,recipient,other,staff])for(const query of [
    'select nolan_decision_actor();','select * from nolan_decision_requests;',
    "update nolan_decision_requests set state='resolved';",'delete from nolan_decision_requests;',
    'insert into nolan_decision_requests default values;'
   ])assert.throws(()=>as(actor,query),/permission denied/)
  })
  await t.test('version overflow rolls back and retains pending receipt',()=>{
   const request=newRequest()
   sql(`update nolan_decision_requests set version=2147483647 where id='${request}'`)
   assert.throws(()=>as(recipient,`select close_nolan_decision_request('${request}',2147483647,'resolve','Answer');`),/out of range/)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),'pending:2147483647')
  })
  await t.test('coverage limit rejects instead of silently truncating',()=>{
   sql(`insert into nolan_decision_requests(task_id,source_revision,recipient_id,requested_by,question,idempotency_key)
    select '${task}','synthetic-coverage','${other}','${admin}','Coverage',gen_random_uuid() from generate_series(1,501)`)
   assert.throws(()=>as(other,'select list_my_nolan_decision_requests();'),/coverage exceeds 500/)
   sql("delete from nolan_decision_requests where source_revision='synthetic-coverage'")
  })
  sql("update profiles set is_active=false where id='"+recipient+"'")
  assert.throws(()=>as(recipient,'select list_my_nolan_decision_requests();'),/manager access/)
 }finally{if(created)docker(['rm','--force',name])}
})
