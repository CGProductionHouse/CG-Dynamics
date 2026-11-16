// Real GoTrue -> PostgREST -> native Deno MCP acceptance, synthetic data only.
// Canonical replay helper and optional workbook drafts must be supplied from a pinned reviewed checkout.
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {createServer,Agent,request} from 'node:http'
import {Duplex} from 'node:stream'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
const replayPath=process.env.CG_CANONICAL_REPLAY_MODULE, deno=process.env.CG_DENO_BINARY, config=process.env.CG_DENO_CHECK_CONFIG
assert.ok(replayPath&&deno&&config,'Explicit isolated replay helper, Deno binary and validation config required')
const workbookHead='49136f9c693f83565605d2fcdc7dc1b5807e697c'
assert.equal(readFileSync(replayPath,'utf8'),execFileSync('git',['show',workbookHead+':tests/helpers/nolanCanonicalSchema.mjs'],{encoding:'utf8'}),'Replay helper must match the reviewed workbook commit')
if(process.env.CG_WORKBOOK_DRAFT_DIR) for(const name of ['nolan_source_active_reads','nolan_identity_definer_active','nolan_content_definer_active','nolan_mutation_definer_active','nolan_debrief_active']) {
 assert.equal(readFileSync(join(process.env.CG_WORKBOOK_DRAFT_DIR,name+'.draft.sql'),'utf8'),execFileSync('git',['show',workbookHead+':docs/ops/sql/'+name+'.draft.sql'],{encoding:'utf8'}),'Workbook draft must remain unchanged')
}
const {replayNolanCanonicalSchema}=await import(pathToFileURL(replayPath).href)
const images={db:'postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7',auth:'supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',rest:'postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf'}
const prefix='cg-marketing-'+randomUUID(),names={db:prefix+'-db',auth:prefix+'-auth',rest:prefix+'-rest'},created=[]
const temporary=mkdtempSync(join(tmpdir(),'cg-marketing-auth-')),report=process.env.CG_MARKETING_AUTH_REPORT??'/tmp/cg-marketing-auth-report.json'
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']})
const sql=input=>docker(['exec','-i',names.db,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input).trim()
const env=values=>Object.entries(values).flatMap(([k,v])=>['-e',`${k}=${v}`])
const start=(name,args)=>{docker(['run','--detach','--pull=never','--name',name,...args]);created.push(name)}
const agents=new Map(),checks=[];let gateway,edge,stage='setup'
const ready=async check=>{for(let i=0;i<100;i++){try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,200))}throw new Error('readiness timeout')}
const agentFor=port=>{
 if(agents.has(port))return agents.get(port)
 const agent=new Agent({keepAlive:false})
 agent.createConnection=()=>{const child=spawn('docker',['exec','-i',names.db,'nc','127.0.0.1',String(port)],{stdio:['pipe','pipe','pipe']});const stream=Duplex.from({readable:child.stdout,writable:child.stdin});stream.setNoDelay=()=>stream;stream.setKeepAlive=()=>stream;stream.setTimeout=()=>stream;child.stderr.resume();child.on('error',e=>stream.destroy(e));stream.on('close',()=>child.kill());return stream}
 agents.set(port,agent);return agent
}
const exchange=(port,path,{method='GET',headers={},body}={})=>new Promise((ok,fail)=>{
 const payload=body===undefined?null:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body))
 const req=request({host:'127.0.0.1',port,path,method,agent:agentFor(port),headers:{...headers,connection:'close',...(payload?{'content-type':'application/json','content-length':payload.length}:{})}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',fail)})
 const timer=setTimeout(()=>req.destroy(new Error('isolated HTTP timeout')),20000);req.on('close',()=>clearTimeout(timer));req.on('error',fail);req.end(payload)
})
const secret=randomBytes(48).toString('hex'),password=randomBytes(24).toString('hex')
const signService=role=>{const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const data=b({alg:'HS256',typ:'JWT'})+'.'+b({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});return data+'.'+createHmac('sha256',secret).update(data).digest('base64url')}
try {
 for(const image of Object.values(images))docker(['image','inspect',image])
 start(names.db,['--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',images.db])
 await ready(()=>docker(['exec',names.db,'cat','/proc/1/comm']).trim()==='postgres'&&sql('select 1')==='1')
 sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create role supabase_auth_admin login noinherit password '${password}';create role authenticator login noinherit password '${password}';grant anon,authenticated,service_role to authenticator;
 create schema auth authorization supabase_auth_admin;create schema extensions;create extension pgcrypto with schema extensions;
 alter role supabase_auth_admin set search_path=auth;grant usage on schema public,extensions to supabase_auth_admin;
 grant usage on schema public,auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`)
 stage='real Auth startup'
 start(names.auth,['--network','container:'+names.db,...env({GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@127.0.0.1:5432/postgres`,GOTRUE_SITE_URL:'http://127.0.0.1',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'3600',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_EXTERNAL_PHONE_ENABLED:'false'}),images.auth])
 await ready(async()=>(await exchange(9999,'/health')).status===200)
 stage='canonical schema replay'
 const replay=replayNolanCanonicalSchema(sql,join(temporary,'schema-replay.json'),{bootstrap:false})
 assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname in ('uid','role')"),'2')
 stage='real password sign-in'
 const accounts={}
 for(const role of ['admin','manager','staff','client']){
  const email=role+'-'+randomUUID()+'@example.invalid'
  const signup=await exchange(9999,'/signup',{method:'POST',body:{email,password,data:{role:'admin'}}});assert.ok([200,201].includes(signup.status))
  const login=await exchange(9999,'/token?grant_type=password',{method:'POST',body:{email,password}});assert.equal(login.status,200)
  const session=JSON.parse(login.body);accounts[role]={id:session.user.id,token:session.access_token,email}
  assert.equal(sql(`select role from profiles where id='${session.user.id}'`),'client')
  sql(`update profiles set role='${role}',is_active=true where id='${session.user.id}'`)
 }
 checks.push('GoTrue signup/password JWTs; metadata cannot promote profile role')
 stage='real REST startup'
 start(names.rest,['--network','container:'+names.db,...env({PGRST_DB_URI:`postgres://authenticator:${password}@127.0.0.1:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_JWT_AUD:'authenticated',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'3000'}),images.rest])
 await ready(async()=>(await exchange(3000,'/')).status===200)
 assert.equal(sql("select rolsuper::text||':'||rolbypassrls::text from pg_roles where rolname='authenticator'"),'false:false')
 for(const name of created){const info=JSON.parse(docker(['inspect',name]))[0];assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);assert.ok(!info.HostConfig.Binds?.length)}
 assert.equal(JSON.parse(docker(['inspect',names.db]))[0].HostConfig.NetworkMode,'none')
 stage='synthetic source seed'
 const client=randomUUID(),other=randomUUID(),source=randomUUID(),card=randomUUID(),document=randomUUID()
 sql(`insert into clients(id,name,active) values('${client}','Synthetic marketing client',true),('${other}','Synthetic foreign client',true);
 insert into marketing_library_sources(id,source_type,source_name,title,trust_tier,rights_status,access_mode,full_text_storage,commercial_use,rights_checked_at,ingestion_status) values('${source}','book','Synthetic public domain source','Fixture','tier_1_primary','public_domain','full_text_allowed',true,'allowed',now(),'verified');
 insert into skill_cards(id,slug,title,category,knowledge_layer,source_id,source_type,principle,summary,relevant_agents) values('${card}','auth-${card}','Synthetic reviewed skill','Marketing Library','universal_principle','${source}','book','Use real evidence','Synthetic summary','["copywriting_agent"]');
 insert into marketing_library_documents(id,source_id,title,rights_status,access_mode,ingestion_status,text_human_verified,storage_path) values('${document}','${source}','Synthetic document','public_domain','full_text_allowed','verified',true,'private/never-return');
 insert into marketing_library_chunks(document_id,body,verification_state) values('${document}','Verified public-domain fixture text','verified');`)
 stage='REST canonical source calls'
 const rest=(who,fn,body)=>exchange(3000,'/rpc/'+fn,{method:'POST',headers:who?{authorization:'Bearer '+accounts[who].token}:{},body})
 const snapshot=await rest('admin','mcp_marketing_source_review',{p_card:card});assert.equal(snapshot.status,200)
 const hash=JSON.parse(snapshot.body).card.content_hash
 assert.ok((await rest('admin','mcp_marketing_source_review',{p_card:card,p_activate:true,p_confirm:true,p_expected_hash:hash})).status>=400)
 assert.equal((await rest('admin','skill_card_record_review',{p_card_id:card,p_decision:'approved',p_note:'Explicit synthetic human review',p_edits:null,p_expected_content_hash:hash})).status,200)
 const activation={p_card:card,p_activate:true,p_confirm:true,p_expected_hash:hash}
 assert.equal((await rest('admin','mcp_marketing_source_review',activation)).status,200)
 for(const role of ['manager','staff','client',null])assert.ok((await rest(role,'mcp_marketing_source_review',{p_card:card})).status>=400)
 assert.ok((await rest('admin','mcp_marketing_source_review',{p_card:card,p_client:other})).status>=400)
 const raw=await rest('admin','mcp_marketing_source_review',{p_card:card,p_document:document});assert.equal(raw.status,200);assert.equal(JSON.parse(raw.body).chunks.length,1);assert.ok(!raw.body.toString().includes('private/never-return'))
 checks.push('real JWT canonical review/activation; role/client/source isolation; private storage projection')
 stage='native MCP loopback gateway'
 gateway=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const auth=req.url.startsWith('/auth/v1/'),restPath=req.url.startsWith('/rest/v1/');if(!auth&&!restPath){res.writeHead(404);res.end();return}const r=await exchange(auth?9999:3000,req.url.slice(auth?8:8),{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});res.writeHead(r.status,r.headers);res.end(r.body)}catch{res.writeHead(502);res.end('Isolated gateway unavailable')}})
 await new Promise(ok=>gateway.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+gateway.address().port
 const listener=createServer();await new Promise(ok=>listener.listen(0,'127.0.0.1',ok));const edgePort=listener.address().port;await new Promise(ok=>listener.close(ok))
 const wrapper=join(temporary,'edge.ts');writeFileSync(wrapper,`const original=Deno.serve; const handlers: any[]=[]; Deno.serve=((handler: any)=>{handlers.push(handler);return {};}) as typeof Deno.serve;
 await import(${JSON.stringify(pathToFileURL(resolve('supabase/functions/cg-dynamics-mcp/index.ts')).href)});
 await import(${JSON.stringify(pathToFileURL(resolve('supabase/functions/cg-assistant-chat/index.ts')).href)});
 await import(${JSON.stringify(pathToFileURL(resolve('supabase/functions/marketing-workflow/index.ts')).href)});
 original({hostname:'127.0.0.1',port:${edgePort}},req=>handlers[new URL(req.url).pathname==='/retired-chat'?1:new URL(req.url).pathname==='/retired-marketing'?2:0](req));`)
 edge=spawn(deno,['run','--no-check','--no-lock','--node-modules-dir=none','--sloppy-imports','--config='+config,'--allow-env','--allow-net=127.0.0.1',wrapper],{env:{PATH:process.env.PATH,DENO_DIR:process.env.DENO_DIR??'/tmp/cg-retire-deno-cache',SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:signService('service_role'),SUPABASE_ANON_KEY:signService('anon')},stdio:['ignore','ignore','pipe']});edge.stderr.resume()
 await ready(async()=>{const r=await fetch('http://127.0.0.1:'+edgePort,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});return r.status===401})
 const mcp=async(role,name,args)=>{const r=await fetch('http://127.0.0.1:'+edgePort,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accounts[role].token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return {status:r.status,data:await r.json()}}
 const context={context_kind:'company_admin'}
 const read=await mcp('admin','read_marketing_source',{context,card_id:card,document_id:document});assert.equal(read.status,200);assert.equal(read.data.result?.isError,false)
 const knowledge=await mcp('admin','get_marketing_knowledge',{context,client_id:client})
 assert.equal(knowledge.data.result?.isError,false)
 assert.ok(JSON.parse(knowledge.data.result.content[0].text).cards.some(c=>c.id===card))
 const activated=await mcp('admin','activate_marketing_knowledge',{context,card_id:card,expected_content_hash:hash,confirm_human_activation:true,idempotency_key:randomUUID()})
 assert.equal(activated.data.result?.isError,false)
 const scope={context_kind:'client',client_id:client},key=randomUUID()
 const draft={context:scope,client_id:client,action:'draft',specialist:'copywriting_agent',request:'Synthetic external draft',content:{drafts:['Specific fixture copy']},expected_version:0,evidence_card_ids:[card],idempotency_key:key}
 const save=await mcp('admin','write_marketing_artifact',draft);assert.equal(save.status,200);assert.equal(save.data.result?.isError,false)
 const saved=JSON.parse(save.data.result.content[0].text);assert.equal(saved.client_id,client)
 const history=await mcp('admin','read_marketing_artifacts',{context:scope,client_id:client,artifact_id:saved.artifact_id});assert.equal(history.data.result?.isError,false);assert.equal(JSON.parse(history.data.result.content[0].text).versions.length,1)
 const retry=await mcp('admin','write_marketing_artifact',draft);assert.equal(JSON.parse(retry.data.result.content[0].text).artifact_id,saved.artifact_id)
 const foreign=await mcp('admin','write_marketing_artifact',{...draft,client_id:other});assert.ok(foreign.data.error||foreign.data.result?.isError)
 const rejected=await mcp('staff','activate_marketing_knowledge',{context,card_id:card,expected_content_hash:hash,confirm_human_activation:true,idempotency_key:randomUUID()});assert.ok(rejected.data.error||rejected.data.result?.isError)
 assert.ok((await rest('admin','mcp_write_marketing_artifact',{p_actor:accounts.admin.id,p_connection:accounts.admin.id,p_context:'staff',p_key:randomUUID(),p_input:{}})).status>=400)
 for(const role of ['admin','manager','staff','client'])assert.ok((await exchange(3000,'/mcp_marketing_write_receipts?select=*',{headers:{authorization:'Bearer '+accounts[role].token}})).status>=400)
 const tampered=accounts.admin.token.split('.');tampered[2]=(tampered[2][0]==='a'?'b':'a')+tampered[2].slice(1)
 assert.equal((await exchange(3000,'/rpc/mcp_marketing_source_review',{method:'POST',headers:{authorization:'Bearer '+tampered.join('.')},body:{p_card:card}})).status,401)
 assert.ok((await exchange(9999,'/token?grant_type=password',{method:'POST',body:{email:accounts.admin.email,password:randomBytes(24).toString('hex')}})).status>=400)
 checks.push('tampered JWT, wrong password and direct private receipt reads denied by actual Auth/REST')
 checks.push('all five native Deno MCP additions: real Auth getUser, source/knowledge/activation/history/draft, replay, foreign-client/role/direct-RPC denial')
 stage='real authenticated retired HTTP handlers'
 const modelState=()=>sql('select json_build_array((select count(*) from ai_usage_requests),(select count(*) from ai_usage_attempts),(select count(*) from ai_marketing_artifacts),(select count(*) from ai_marketing_artifact_versions))')
 const modelBefore=modelState()
 const retired=async(role,path,action)=>fetch('http://127.0.0.1:'+edgePort+path,{method:'POST',headers:{'content-type':'application/json',...(role?{authorization:'Bearer '+accounts[role].token}:{})},body:JSON.stringify({action,message:'Synthetic retirement check'})})
 for(const role of ['admin','manager','staff']){
  assert.equal((await retired(role,'/retired-chat','chat')).status,410)
  assert.equal((await retired(role,'/retired-chat','unknown')).status,410)
  assert.equal((await retired(role,'/retired-marketing','run')).status,410)
 }
 for(const path of ['/retired-chat','/retired-marketing']){
  assert.equal((await retired('client',path,'run')).status,403)
  assert.equal((await retired(null,path,'run')).status,401)
 }
 sql(`update profiles set is_active=false where id='${accounts.staff.id}'`)
 assert.equal((await retired('staff','/retired-chat','chat')).status,403)
 assert.equal((await retired('staff','/retired-marketing','run')).status,403)
 assert.equal(modelState(),modelBefore)
 checks.push('actual retired handlers: active staff/manager/admin 410; client/inactive 403; missing bearer 401; outbound provider network unavailable')
 stage='live profile revocation and workbook compatibility'
 assert.equal((await rest('manager','assistant_ownership_review_summary',{})).status,200)
 sql(`update profiles set is_active=false where id='${accounts.manager.id}'`)
 assert.equal((await rest('manager','assistant_ownership_review_summary',{})).status,403)
 sql(`update profiles set is_active=true where id='${accounts.manager.id}'`)
 checks.push('ownership-summary RPC: active manager succeeds and same real JWT is denied after account deactivation')
 sql(`update profiles set is_active=false where id='${accounts.admin.id}'`)
 assert.ok((await rest('admin','mcp_marketing_source_review',{p_card:card})).status>=400)
 assert.ok((await mcp('admin','read_marketing_source',{context,card_id:card})).status>=400)
 sql(`update profiles set is_active=true where id='${accounts.admin.id}'`)
 if(process.env.CG_WORKBOOK_DRAFT_DIR){for(const name of ['nolan_source_active_reads','nolan_identity_definer_active','nolan_content_definer_active','nolan_mutation_definer_active','nolan_debrief_active'])sql(readFileSync(join(process.env.CG_WORKBOOK_DRAFT_DIR,name+'.draft.sql'),'utf8'))
  stage='all five tools and retirement after latest workbook guards'
  const again=await mcp('admin','read_marketing_source',{context,card_id:card,document_id:document});assert.equal(again.data.result?.isError,false)
  const skills=await mcp('admin','get_marketing_knowledge',{context,client_id:client});assert.equal(skills.data.result?.isError,false);assert.ok(JSON.parse(skills.data.result.content[0].text).cards.some(c=>c.id===card))
  const active=await mcp('admin','activate_marketing_knowledge',{context,card_id:card,expected_content_hash:hash,confirm_human_activation:true,idempotency_key:randomUUID()});assert.equal(active.data.result?.isError,false)
  const nextDraft={...draft,idempotency_key:randomUUID()}
  const after=await mcp('admin','write_marketing_artifact',nextDraft);assert.equal(after.data.result?.isError,false)
  const nextId=JSON.parse(after.data.result.content[0].text).artifact_id
  const reread=await mcp('admin','read_marketing_artifacts',{context:scope,client_id:client,artifact_id:nextId});assert.equal(reread.data.result?.isError,false);assert.equal(JSON.parse(reread.data.result.content[0].text).versions.length,1)
  const replayed=await mcp('admin','write_marketing_artifact',nextDraft);assert.equal(JSON.parse(replayed.data.result.content[0].text).artifact_id,nextId)
  const wrong=await mcp('admin','write_marketing_artifact',{...nextDraft,client_id:other});assert.ok(wrong.data.error||wrong.data.result?.isError)
  const foreignRead=await mcp('admin','read_marketing_artifacts',{context:scope,client_id:other,artifact_id:nextId});assert.ok(foreignRead.data.error||foreignRead.data.result?.isError)
  assert.ok((await rest('manager','mcp_marketing_source_review',{p_card:card})).status>=400)
  const beforeRetirement=modelState()
  for(const role of ['admin','manager'])for(const [path,action] of [['/retired-chat','chat'],['/retired-chat','unknown'],['/retired-marketing','run']])assert.equal((await retired(role,path,action)).status,410)
  for(const path of ['/retired-chat','/retired-marketing']){
   assert.equal((await retired('client',path,'run')).status,403)
   assert.equal((await retired('staff',path,'run')).status,403) // still inactive
   assert.equal((await retired(null,path,'run')).status,401)
  }
  assert.equal(modelState(),beforeRetirement)
  // Exercise the new guard with a real existing JWT, without duplicating the owner's mutation suite.
  const debriefProbe={p_debrief_id:randomUUID(),p_actions:[]}
  const missing=await rest('admin','apply_content_run_debrief',debriefProbe)
  assert.equal(missing.status,400);assert.match(missing.body.toString(),/Debrief not found/)
  sql(`update profiles set is_active=false where id='${accounts.admin.id}'`)
  assert.equal((await rest('admin','apply_content_run_debrief',debriefProbe)).status,403)
  assert.ok((await rest('admin','mcp_marketing_source_review',{p_card:card})).status>=400)
  assert.ok((await mcp('admin','get_marketing_knowledge',{context,client_id:client})).status>=400)
  sql(`update profiles set is_active=true where id='${accounts.admin.id}'`)
  checks.push('latest five workbook guards unchanged: all five MCP tools, retries, foreign-client/role/inactive denial and retired handlers pass together')
  checks.push('new debrief guard: active admin reaches canonical missing-record validation; same JWT after deactivation is denied before record access')
 }
 checks.push('already-issued real JWT denied after profile deactivation; restored only in synthetic fixture')
 writeFileSync(report,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),images,workbookHead,checks,replay:{applied:replay.filter(x=>x.result==='applied').length,knownFailures:replay.filter(x=>x.result!=='applied').map(x=>({file:x.file,error:x.error}))},limits:['local synthetic accounts only','no hosted/installed connector/browser acceptance','Deno npm import map and explicit frontend type compatibility config','no email delivery'],completed:true},null,2)+'\n')
 console.log(JSON.stringify({completed:true,checks,report}))
} catch(error){const diagnostic=String(error.stderr??error.message).replaceAll(password,'[fixture-password]').replaceAll(secret,'[fixture-secret]').split('\n').filter(x=>/ERROR:|DETAIL:|timeout|Assertion/.test(x)).slice(0,6).join('\n');console.error(JSON.stringify({completed:false,stage,errorName:error.name,message:error instanceof assert.AssertionError?error.message:diagnostic||'See isolated stage; service secrets deliberately omitted'}));process.exitCode=1}
finally {edge?.kill();if(gateway)await new Promise(ok=>gateway.close(ok));for(const agent of agents.values())agent.destroy();for(const name of created.reverse())try{docker(['rm','--force',name])}catch{}rmSync(temporary,{recursive:true,force:true})}
