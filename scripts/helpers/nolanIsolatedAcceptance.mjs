import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {Agent, request} from 'node:http'
import {Duplex} from 'node:stream'
import {randomBytes,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {replayNolanCanonicalSchema} from '../../tests/helpers/nolanCanonicalSchema.mjs'

const images={db:'postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7',auth:'supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',rest:'postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf'}
export async function startNolanIsolatedAcceptance(origin, reportPath, {signal}={}){
 signal?.throwIfAborted()
 const url=new URL(origin)
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:')
 const prefix='cg-nolan-ui-'+randomUUID(),names={db:prefix+'-db',auth:prefix+'-auth',rest:prefix+'-rest'},created=[]
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']})
 const sql=input=>docker(['exec','-i',names.db,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input).trim()
 const stop=()=>{for(const name of created.splice(0).reverse())try{docker(['rm','--force',name])}catch{/* preserve cleanup of remaining owned containers */}}
 signal?.addEventListener('abort',stop,{once:true})
 const start=(name,args)=>{signal?.throwIfAborted();docker(['run','--detach','--pull=never','--name',name,...args]);created.push(name)}
 const env=values=>Object.entries(values).flatMap(([k,v])=>['-e',`${k}=${v}`])
 // Docker exec is a byte transport, not a public/host port. Node's HTTP parser
 // preserves real service statuses, headers and bodies (including error bodies).
 const agents=new Map()
 const agentFor=port=>{
  if(agents.has(port))return agents.get(port)
  const agent=new Agent({keepAlive:false})
  agent.createConnection=()=>{
   const child=spawn('docker',['exec','-i',names.db,'nc','127.0.0.1',String(port)],{stdio:['pipe','pipe','pipe']})
   const stream=Duplex.from({readable:child.stdout,writable:child.stdin})
   stream.setNoDelay=()=>stream;stream.setKeepAlive=()=>stream
   stream.setTimeout=()=>stream
   child.stderr.resume();child.on('error',error=>stream.destroy(error))
   stream.on('close',()=>child.kill())
   return stream
  }
  agents.set(port,agent);return agent
 }
 const exchange=(port,path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
  const payload=body===undefined?null:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body))
  const req=request({host:'127.0.0.1',port,path,method,agent:agentFor(port),headers:{...headers,'connection':'close',...(payload?{'content-type':headers['content-type']??'application/json','content-length':payload.length}:{})}},res=>{
   const chunks=[];let size=0
   res.on('data',chunk=>{size+=chunk.length;if(size>16*1024*1024)res.destroy(new Error('Isolated response limit exceeded'));else chunks.push(chunk)})
   res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}))
  })
  const timer=setTimeout(()=>req.destroy(new Error('Isolated service request timed out')),20000)
  req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(payload)
 })
 const ready=async check=>{for(let i=0;i<100;i++){signal?.throwIfAborted();try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,200))}throw new Error('Isolated service readiness failed')}
 const secret=randomBytes(48).toString('hex'),password=randomBytes(24).toString('hex')
 try{
  for(const image of Object.values(images))docker(['image','inspect',image]) // cached only, never pulls
  start(names.db,['--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',images.db])
  await ready(()=>docker(['exec',names.db,'cat','/proc/1/comm']).trim()==='postgres'&&sql('select 1')==='1')
  sql(`create role anon;create role authenticated;create role service_role bypassrls;
   create role supabase_auth_admin login noinherit password '${password}';create role authenticator login noinherit password '${password}';grant anon,authenticated to authenticator;
   create schema auth authorization supabase_auth_admin;create schema extensions;create extension pgcrypto with schema extensions;
   alter role supabase_auth_admin set search_path=auth;grant usage on schema public,extensions to supabase_auth_admin;
   grant usage on schema public,auth to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`)
  start(names.auth,['--network','container:'+names.db,...env({GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:origin+'/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@127.0.0.1:5432/postgres`,GOTRUE_SITE_URL:origin,GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'3600',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_EXTERNAL_PHONE_ENABLED:'false'}),images.auth])
  await ready(async()=>(await exchange(9999,'/health')).status===200)
  const report=replayNolanCanonicalSchema(sql,reportPath,{bootstrap:false})
  sql(readFileSync('docs/ops/sql/nolan_explicit_decision_requests.draft.sql','utf8'))
  start(names.rest,['--network','container:'+names.db,...env({PGRST_DB_URI:`postgres://authenticator:${password}@127.0.0.1:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_JWT_AUD:'authenticated',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'3000'}),images.rest])
  await ready(async()=>(await exchange(3000,'/')).status===200)
  assert.equal(docker(['inspect','--format','{{.HostConfig.NetworkMode}}',names.db]).trim(),'none')
  for(const name of created)assert.ok(['null','{}'].includes(docker(['inspect','--format','{{json .HostConfig.PortBindings}}',name]).trim()))
  const accounts={}
  for(const role of ['admin','manager','staff','client']){
   const email=`nolan-ui-${role}-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('hex')
   const signup=await exchange(9999,'/signup',{method:'POST',body:{email,password,data:{full_name:'Synthetic '+role}}})
   assert.equal(signup.status,200,'Synthetic signup failed')
   const id=JSON.parse(signup.body).user?.id;assert.match(id??'',/^[0-9a-f-]{36}$/)
   sql(`update profiles set role='${role}' where id='${id}'`)
   accounts[role]={id,email,password}
  }
  const taskId=randomUUID(),plannerTaskId=randomUUID(),boardId=randomUUID()
  sql(`insert into command_centre_tasks(id,title,status,notes) values ('${taskId}','Synthetic decision source','in_progress','Synthetic isolated acceptance only');
   insert into planner_boards(id,name,slug,visibility) values ('${boardId}','Synthetic acceptance board','${boardId}','staff');
   insert into planner_tasks(id,board_id,title,status,source,import_hash,notes) values ('${plannerTaskId}','${boardId}','Synthetic Master task','in_progress','manual','${plannerTaskId}','Synthetic source notes; not verified agent/device evidence');
   insert into planner_task_assignees(task_id,profile_id,position,assigned_by) values ('${plannerTaskId}','${accounts.admin.id}',0,'${accounts.admin.id}');
   insert into planner_activity_log(entity_type,entity_id,action,actor_user_id) values ('planner_task','${plannerTaskId}','synthetic_acceptance_seed','${accounts.admin.id}');`)
  const clientId=randomUUID(),foreignClientId=randomUUID(),deliverableId=randomUUID(),foreignDeliverableId=randomUUID(),videoId=randomUUID(),foreignVideoId=randomUUID()
  sql(`insert into clients(id,name) values ('${clientId}','Synthetic source client'),('${foreignClientId}','Synthetic foreign client');
   insert into client_aliases(client_id,alias) values ('${clientId}','Synthetic alias A'),('${foreignClientId}','Synthetic alias B');
   update profiles set client_id='${clientId}' where id='${accounts.client.id}';
   insert into monthly_deliverables(id,client_id,month,code,instance_number,title,deliverable_type) values
    ('${deliverableId}','${clientId}','2026-11-01','V',1,'Synthetic schedule row','video'),
    ('${foreignDeliverableId}','${foreignClientId}','2026-11-01','V',1,'Synthetic foreign schedule row','video');
   insert into content_guide_ideas(id,client_id,client_name,month,title,deliverable_id,owner_user_id) values
    ('${videoId}','${clientId}','Synthetic source client','2026-11-01','Synthetic pipeline row','${deliverableId}','${accounts.admin.id}'),
    ('${foreignVideoId}','${foreignClientId}','Synthetic foreign client','2026-11-01','Synthetic foreign pipeline row','${foreignDeliverableId}','${accounts.admin.id}');`)
  const sources={clientId,foreignClientId,deliverableId,foreignDeliverableId,videoId,foreignVideoId,month:'2026-11'}
  // Only fixed mutations of this run's generated rows; no arbitrary SQL/IDs.
  const scenario=action=>{
   if(action==='advance-source')sql(`update command_centre_tasks set notes=notes||' changed' where id='${taskId}'`)
   else if(action==='revoke-manager')sql(`update profiles set is_active=false where id='${accounts.manager.id}'`)
   else if(action==='restore-manager')sql(`update profiles set is_active=true where id='${accounts.manager.id}'`)
   else throw new Error('Unsupported isolated scenario')
  }
  // Node-only database acceptance controls. Never included in the browser
  // manifest or HTTP scenario dispatcher; targets are generated by this run.
  const probeTaskId=randomUUID()
  const policyAcceptance={
   probeTaskId,
   removeProbeTask(){sql(`delete from public.command_centre_tasks where id='${probeTaskId}'`)},
   setAccount(role,{active=true,effectiveRole=role}={}){
    assert(Object.hasOwn(accounts,role));assert(['admin','manager','staff','client'].includes(effectiveRole));assert.equal(typeof active,'boolean')
    sql(`update public.profiles set is_active=${active},role='${effectiveRole}' where id='${accounts[role].id}'`)
   },
   applyDraft(){sql(readFileSync('docs/ops/sql/nolan_source_active_reads.draft.sql','utf8'))},
   helperMissingIdentity(){return sql(`begin;set local role authenticated;
    select set_config('request.jwt.claim.sub','',true);
    select public.nolan_source_reader_active();
    select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
    select public.nolan_source_reader_active();rollback;`).split('\n').filter(v=>v==='f'||v==='t')},
   assignSyntheticStaffTask(){sql(`update public.command_centre_tasks set bucket='Video',assigned_to_user_id='${accounts.staff.id}',assigned_to_name='Synthetic staff' where id='${taskId}'`)},
   audit(){return JSON.parse(sql(`select json_build_object(
    'policies',(select json_agg(p) from pg_policies p where schemaname='public' and tablename in ('profiles','clients','client_aliases','command_centre_tasks','planner_tasks','planner_task_assignees','planner_activity_log','planner_boards','planner_buckets','monthly_deliverables','content_guide_ideas')),
    'views',(select json_agg(v) from (select c.relname,c.reloptions,pg_get_viewdef(c.oid) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v') v),
    'source_definer_routes',(select json_agg(f) from (select p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute') and p.prosrc ~ '(command_centre_tasks|planner_tasks|content_guide_ideas|monthly_deliverables|public.clients|public.profiles)') f),
    'functions',(select json_agg(f) from (select p.proname,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname in ('is_staff','is_manager','is_admin','my_client_id','nolan_source_reader_active','update_command_centre_task_status','admin_set_package_classification') or p.proname like 'list_planner_%')) f))`))},
  }
  return {accounts,taskId,plannerTaskId,sources,scenario,report,exchange,policyAcceptance,stop(){for(const a of agents.values())a.destroy();stop()}}
 }catch(error){for(const a of agents.values())a.destroy();stop();throw new Error('Isolated acceptance setup failed: '+(error?.name??'Error'))}
}
