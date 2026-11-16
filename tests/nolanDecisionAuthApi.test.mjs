import assert from 'node:assert/strict'
import {execFileSync, spawnSync} from 'node:child_process'
import {randomBytes, randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {replayNolanCanonicalSchema} from './helpers/nolanCanonicalSchema.mjs'

// Official images selected from Supabase's docker-compose, then pinned by digest.
// Never reads .env, pulls an image, publishes a port, or signs a user JWT itself.
const images={
 db:'postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7',
 auth:'supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
 rest:'postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf',
}

test('genuine GoTrue password sign-in and JWT-backed Nolan RPC isolation', {skip:process.env.RUN_NOLAN_AUTH_API_TESTS!=='1',timeout:180000},async t=>{
 const prefix='cg-nolan-auth-'+randomUUID(),db=prefix+'-db',auth=prefix+'-auth',rest=prefix+'-rest'
 const created=[]
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']})
 const sql=input=>docker(['exec','-i',db,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input).trim()
 const start=(name,args)=>{docker(['run','--detach','--pull=never','--name',name,...args]);created.push(name)}
 const env=values=>Object.entries(values).flatMap(([k,v])=>['-e',`${k}=${v}`])
 // HTTP stays on the shared isolated loopback. Capture tokens in memory only;
 // never include a token, password, or response body in an assertion message.
 const http=(port,path,{token,body}={})=>{
  // Disable wget's inherited HTTP proxy only for this fixed loopback URL;
  // the container has no external network and no host port binding.
  const args=['exec',db,'wget','-Y','off','-S','-O','-','-T','10','--header=Content-Type: application/json']
  if(token)args.push('--header=Authorization: Bearer '+token)
  if(body!==undefined)args.push('--post-data='+JSON.stringify(body))
  args.push(`http://127.0.0.1:${port}${path}`)
  const r=spawnSync('docker',args,{encoding:'utf8',timeout:15000})
  const matches=[...String(r.stderr).matchAll(/HTTP\/\S+ (\d{3})/g)]
  const status=Number(matches.at(-1)?.[1]||0)
  let data;try{data=JSON.parse(r.stdout)}catch{data=null}
  return {status,data}
 }
 const ready=async check=>{for(let i=0;i<100;i++){try{if(check())return}catch{}await new Promise(r=>setTimeout(r,200))}assert.fail('Isolated service failed readiness')}
 const jwtSecret=randomBytes(48).toString('hex'),dbPassword=randomBytes(24).toString('hex')
 try{
  start(db,['--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',images.db])
  await ready(()=>docker(['exec',db,'cat','/proc/1/comm']).trim()==='postgres'&&sql('select 1')==='1')
  sql(`create role anon;create role authenticated;create role service_role bypassrls;
   create role supabase_auth_admin login noinherit password '${dbPassword}';
   create role authenticator login noinherit password '${dbPassword}';
   grant anon,authenticated to authenticator;
   create schema auth authorization supabase_auth_admin;create schema extensions;
   create extension pgcrypto with schema extensions;
   alter role supabase_auth_admin set search_path=auth;
   grant usage on schema public,extensions to supabase_auth_admin;
   grant usage on schema public,auth to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`)
  start(auth,['--network','container:'+db,...env({
   GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:9999',
   GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${dbPassword}@127.0.0.1:5432/postgres`,
   GOTRUE_SITE_URL:'http://127.0.0.1:9999',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_AUD:'authenticated',
   GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'3600',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',
   GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',
  }),images.auth])
  await ready(()=>http(9999,'/health').status===200)
  const report=replayNolanCanonicalSchema(sql,'/tmp/nolan-auth-canonical-replay.json',{bootstrap:false})
  t.diagnostic(`Real Auth schema; repository replay ${report.filter(r=>r.result==='applied').length}/${report.length} files fully applied; known gaps retained`)
  sql(readFileSync('docs/ops/sql/nolan_explicit_decision_requests.draft.sql','utf8'))
  start(rest,['--network','container:'+db,...env({PGRST_DB_URI:`postgres://authenticator:${dbPassword}@127.0.0.1:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_JWT_AUD:'authenticated',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'3000'}),images.rest])
  await ready(()=>http(3000,'/').status===200)

  assert.equal(docker(['inspect','--format','{{.HostConfig.NetworkMode}}',db]).trim(),'none')
  for(const name of created){
   assert.ok(['null','{}'].includes(docker(['inspect','--format','{{json .HostConfig.PortBindings}}',name]).trim()),'No host port bindings')
  }
  for(const name of [auth,rest])assert.match(docker(['inspect','--format','{{.HostConfig.NetworkMode}}',name]).trim(),/^container:/)
  assert.equal(sql("select rolsuper or rolbypassrls from pg_roles where rolname='authenticator'"),'f')
  const accounts={}
  await t.test('signup trigger creates unprivileged profiles; password grant returns genuine sessions',()=>{
   for(const role of ['admin','recipient','other','staff','client']){
    const email=`${role}-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('hex')
    const signup=http(9999,'/signup',{body:{email,password,data:{full_name:'Synthetic '+role,role:'admin'}}})
    assert.equal(signup.status,200,`signup ${role}`)
    const id=signup.data?.user?.id;assert.match(id||'',/^[0-9a-f-]{36}$/)
    assert.equal(sql(`select role from profiles where id='${id}'`),'client','User metadata cannot promote a profile')
    const login=http(9999,'/token?grant_type=password',{body:{email,password}})
    assert.equal(login.status,200,`password sign-in ${role}`)
    assert.ok(login.data?.access_token&&login.data?.refresh_token,'GoTrue must issue both tokens')
    accounts[role]={id,email,password,token:login.data.access_token,refresh:login.data.refresh_token}
    // Explicit isolated fixture bootstrap; never modify auth users/password hashes.
    sql(`update profiles set role='${role==='recipient'||role==='other'?'manager':role}' where id='${id}'`)
   }
  })
  const rpc=(actor,fn,body={})=>http(3000,'/rpc/'+fn,{token:accounts[actor]?.token,body})
  const task=randomUUID();sql(`insert into command_centre_tasks(id,title,status) values ('${task}','Synthetic API task','in_progress')`)
  let request,revision
  await t.test('valid JWT reaches canonical profile RLS and admin-only decision producer',()=>{
   const own=http(3000,'/profiles?select=id,role',{token:accounts.recipient.token})
   assert.equal(own.status,200);assert.deepEqual(own.data,[{id:accounts.recipient.id,role:'manager'}])
   const preview=rpc('admin','preview_nolan_decision_task',{p_task_id:task})
   assert.equal(preview.status,200);revision=preview.data.revision
   assert.equal(rpc('recipient','preview_nolan_decision_task',{p_task_id:task}).status,403)
   const payload={p_task_id:task,p_expected_revision:revision,p_recipient_id:accounts.recipient.id,p_question:'Explicit API question',p_idempotency_key:randomUUID()}
   const first=rpc('admin','create_nolan_decision_request',payload)
   assert.equal(first.status,200);request=first.data;assert.match(request,/^[0-9a-f-]{36}$/)
   assert.equal(rpc('admin','create_nolan_decision_request',payload).data,request)
   assert.equal(sql(`select requested_by from nolan_decision_requests where id='${request}'`),accounts.admin.id)
  })
  await t.test('JWT-backed recipient isolation and direct-table denial',()=>{
   assert.equal(rpc('recipient','list_my_nolan_decision_requests').data.rows[0].id,request)
   assert.equal(rpc('other','list_my_nolan_decision_requests').data.rows.length,0)
   for(const role of ['staff','client'])assert.equal(rpc(role,'list_my_nolan_decision_requests').status,403)
   for(const role of ['admin','recipient','other','staff','client'])assert.equal(http(3000,'/nolan_decision_requests?select=id',{token:accounts[role].token}).status,403)
   assert.equal(rpc('other','close_nolan_decision_request',{p_request_id:request,p_expected_version:1,p_action:'resolve',p_response:'Not mine'}).status,403)
  })
  await t.test('missing/tampered bearer and wrong password fail genuine authentication',()=>{
   assert.equal(rpc(null,'list_my_nolan_decision_requests').status,401)
   const token=accounts.admin.token,parts=token.split('.')
   parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1)
   assert.equal(http(3000,'/rpc/list_my_nolan_decision_requests',{token:parts.join('.'),body:{}}).status,401)
   assert.equal(http(9999,'/token?grant_type=password',{body:{email:accounts.admin.email,password:'deliberately-wrong'}}).status,400)
  })
  await t.test('existing signed token cannot bypass profile deactivation or role revocation',()=>{
   sql(`update profiles set is_active=false where id='${accounts.recipient.id}'`)
   assert.equal(rpc('recipient','list_my_nolan_decision_requests').status,403)
   assert.equal(rpc('recipient','close_nolan_decision_request',{p_request_id:request,p_expected_version:1,p_action:'resolve',p_response:'Inactive'}).status,403)
   sql(`update profiles set is_active=true,role='staff' where id='${accounts.recipient.id}'`)
   assert.equal(rpc('recipient','list_my_nolan_decision_requests').status,403)
   sql(`update profiles set role='manager' where id='${accounts.recipient.id}'`)
   assert.equal(rpc('recipient','list_my_nolan_decision_requests').status,200)
  })

  await t.test('signed requester loses create permission immediately after profile revocation',()=>{
   sql(`update profiles set is_active=false where id='${accounts.admin.id}'`)
   assert.equal(rpc('admin','create_nolan_decision_request',{p_task_id:task,p_expected_revision:revision,p_recipient_id:accounts.recipient.id,p_question:'Must not create',p_idempotency_key:randomUUID()}).status,403)
   assert.equal(rpc('admin','preview_nolan_decision_task',{p_task_id:task}).status,403)
   sql(`update profiles set is_active=true where id='${accounts.admin.id}'`)
  })
  await t.test('JWT-backed create and response reject a changed canonical source revision',()=>{
   const source=randomUUID();sql(`insert into command_centre_tasks(id,title) values ('${source}','Synthetic stale API task')`)
   const preview=rpc('admin','preview_nolan_decision_task',{p_task_id:source})
   assert.equal(preview.status,200)
   const payload={p_task_id:source,p_expected_revision:preview.data.revision,p_recipient_id:accounts.recipient.id,p_question:'Revision-bound question',p_idempotency_key:randomUUID()}
   const createdRequest=rpc('admin','create_nolan_decision_request',payload)
   assert.equal(createdRequest.status,200)
   sql(`update command_centre_tasks set notes='Changed canonical source' where id='${source}'`)
   assert.equal(rpc('admin','create_nolan_decision_request',{...payload,p_idempotency_key:randomUUID()}).status,400)
   assert.equal(rpc('recipient','close_nolan_decision_request',{p_request_id:createdRequest.data,p_expected_version:1,p_action:'resolve',p_response:'Stale'}).status,400)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${createdRequest.data}'`),'pending:1')
  })
  await t.test('real API response records decision only and enforces stale closure CAS',()=>{
   const close={p_request_id:request,p_expected_version:1,p_action:'resolve',p_response:'Recorded through genuine API'}
   assert.equal(rpc('recipient','close_nolan_decision_request',close).status,204)
   assert.equal(rpc('recipient','close_nolan_decision_request',close).status,400)
   assert.equal(sql(`select state||':'||version from nolan_decision_requests where id='${request}'`),'resolved:2')
   assert.equal(sql(`select status from command_centre_tasks where id='${task}'`),'in_progress')
  })
  await t.test('GoTrue logout revokes refresh session without pretending access JWT disappears',()=>{
   const account=accounts.other
   assert.equal(http(9999,'/logout',{token:account.token,body:{}}).status,204)
   assert.equal(http(9999,'/token?grant_type=refresh_token',{body:{refresh_token:account.refresh}}).status,400)
   // Stateless access JWT may remain valid until expiry. Profile/RPC checks above
   // are the immediate authorization boundary, not an invented logout guarantee.
   assert.equal(rpc('other','list_my_nolan_decision_requests').status,200)
  })
 }finally{for(const name of created.reverse())docker(['rm','--force',name])}
})
