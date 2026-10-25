import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'
import { CG_DYNAMICS_MCP_TOOLS } from '../supabase/functions/cg-dynamics-mcp/toolCatalog.ts'
import { assertToolAllowedInContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'

const read=p=>readFileSync(p,'utf8')
const uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const admin=uuid(1),job=uuid(2),run=uuid(3),client=uuid(4),source=uuid(5)
const name='2025 CLIENTS SCHEDULE',plan='synthetic-plan'
const record=n=>({sourceType:'planner_task',sourcePlanId:plan,sourcePlanName:name,sourceBucketId:'synthetic-bucket',sourceBucketName:'Synthetic Exact Client',sourceTaskId:`task-${n}`,title:`DP ${n+1} - Synthetic Exact Client`,description:null,startDate:null,dueDate:null,completedDate:null,percentComplete:100})
const migration=read('supabase/migrations/20261019082434_mcp_schedule_source_readonly_page.sql')

test('actual schedule source SQL and actual MCP projection: bounded, pinned, isolated and read-only', {skip:!process.env.CG_LOCAL_PGLITE_MODULE},async t=>{
  const {PGlite}=await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db=await PGlite.create()
  const vite=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false}})
  try{
    const {readMicrosoftScheduleSource:subject}=await vite.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/microsoftScheduleSource.ts')
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table profiles(id uuid primary key,role text,is_active boolean); create function public.is_admin() returns boolean language sql as $$select false$$;")
    // Actual durable-source DDL and actual run table, not a reproduction of SQL logic.
    await db.exec(read('supabase/phase-28a-microsoft-durable-preview-jobs.sql'))
    const runDDL=read('supabase/phase-17a-microsoft-transition-sync.sql').match(/create table if not exists public\.microsoft_sync_runs \([\s\S]*?\n\);/)[0]
    await db.exec(runDDL)
    await db.exec('alter table microsoft_sync_runs add column preview_job_id uuid references microsoft_sync_jobs(id); alter table microsoft_sync_job_sources add column pagination_cursor text; create table clients(id uuid primary key,name text,active boolean); create table client_aliases(id uuid primary key,client_id uuid,alias text);')
    await db.exec(migration)
    await db.exec('grant usage on schema public to service_role,authenticated,anon; grant select on all tables in schema public to service_role;')
    await db.query("insert into profiles values($1,'admin',true),($2,'staff',true),($3,'admin',false)",[admin,uuid(6),uuid(7)])
    await db.query("insert into microsoft_sync_jobs(id,status,exported_at,updated_at) values($1,'complete','2026-10-19T08:00Z','2026-10-19T08:00Z')",[job])
    const completeness=[{sourceType:'planner_plan',sourceId:plan,sourceName:name,complete:true,safeError:null,recordCount:1051}]
    await db.query("insert into microsoft_sync_runs(id,trigger_type,status,snapshot_exported_at,snapshot_exported_by,source_completeness,finished_at,preview_job_id) values($1,'agent','partial','2026-10-19T08:00Z','fixture',$2,'2026-10-19T08:01Z',$3)",[run,JSON.stringify(completeness),job])
    const records=Array.from({length:1051},(_,n)=>record(n))
    await db.query("insert into microsoft_sync_job_sources(id,job_id,source_type,source_id,source_name,stage,record_count,complete,records,updated_at) values($1,$2,'planner_plan',$3,$4,'complete',1051,true,$5,'2026-10-19T08:00Z')",[source,job,plan,name,JSON.stringify(records)])
    await db.query('insert into clients values($1,$2,true)',[client,'Synthetic Exact Client'])
    // More than1000 active directory rows and aliases must also be traversed.
    await db.exec("insert into clients select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Unrelated Client '||n,true from generate_series(1,1001) n; insert into client_aliases select id,id,'Alias '||name from clients;")
    const call=(offset=0,revision=null,actor=admin,sourceId=plan)=>db.query('select read_mcp_schedule_source_page($1,$2,$3,$4,$5) as result',[actor,run,sourceId,offset,revision]).then(r=>r.rows[0].result)
    const queries=[]
    const adapter={
      async rpc(method,args){assert.equal(method,'read_mcp_schedule_source_page');try{return {data:await call(args.p_offset,args.p_expected_revision,args.p_actor_profile_id,args.p_source_id),error:null}}catch{return {data:null,error:{message:'withheld'}}}},
      from(table){assert.ok(['clients','client_aliases'].includes(table));let active=false;return {select(){return this},eq(k,v){assert.equal(k,'active');assert.equal(v,true);active=true;return this},order(k){assert.equal(k,'id');return this},async range(a,b){queries.push([table,a,b]);return {data:(await db.query(`select * from ${table}${active?' where active=true':''} order by id offset $1 limit $2`,[a,b-a+1])).rows,error:null}}}},
    }
    const staff={contextKind:'company_admin',profileId:admin,role:'admin',connection:{userId:admin,role:'admin'},supabase:adapter}
    await db.exec('set role service_role; begin read only;')
    let first
    await t.test('1051 actual source records traverse22 bounded pages; both directory scans exceed1000, no writes',async()=>{
      const seen=new Set();let input={run_id:run,source_id:plan}
      do{
        const page=await subject(staff,input);assert.equal(page.error,undefined);first??=page
        assert.ok(page.records.length<=50);assert.equal(page.coverage,'page_only')
        for(const row of page.records){assert.equal(row.client_id,client);assert.equal(row.evidence_state,'numbered_source_reference_only');assert.equal(row.due_date,null);assert.equal(row.percent_complete,100);assert.ok(!seen.has(row.source_task_id));seen.add(row.source_task_id);assert.ok(!('title' in row));assert.ok(!('description' in row))}
        input={...input,offset:page.pagination.next_offset,source_revision:page.source_revision,directory_revision:page.directory_revision}
        if(!page.pagination.has_more)break
      }while(true)
      assert.equal(seen.size,1051)
      for(const table of ['clients','client_aliases'])assert.ok(queries.some(q=>q[0]===table&&q[1]===1000))
    })
    await db.exec('commit; reset role;')
    const withSQLChange=async(sql,args,check)=>{await db.exec('begin');try{await db.query(sql,args);await db.exec('set local role service_role');await check()}finally{await db.exec('rollback')}}
    await t.test('actual SQL refuses stale payload/count/cursor/error/run binding and unsafe page sizes',async()=>{
      const changes=[
        ['update microsoft_sync_job_sources set complete=false',[]],
        ["update microsoft_sync_job_sources set safe_error='provider failed'",[]],
        ["update microsoft_sync_job_sources set pagination_cursor='more'",[]],
        ['update microsoft_sync_job_sources set record_count=1050',[]],
        ["update microsoft_sync_jobs set updated_at='2026-10-19T08:02Z'",[]],
        ["update microsoft_sync_runs set source_completeness='[]'",[]],
        ["update microsoft_sync_job_sources set source_name='MASTER CLIENT TO DO'",[]],
        ["update microsoft_sync_job_sources set records=jsonb_set(records,'{0,description}',to_jsonb(repeat('x',32769)))",[]],
      ]
      for(const [sql,args]of changes)await withSQLChange(sql,args,()=>assert.rejects(call()))
      await withSQLChange("update microsoft_sync_job_sources set records=jsonb_set(records,'{0,title}','\"DP 99 changed\"')",[],()=>assert.rejects(call(50,first.source_revision),/drift/))
    })
    await t.test('service-only active admin identity; no client/staff/inactive/foreign source borrowing',async()=>{
      for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(call(),/permission denied/);await db.exec('reset role')}
      await db.exec('set role service_role')
      for(const actor of [uuid(6),uuid(7),uuid(999)])await assert.rejects(call(0,null,actor),/admin/)
      await assert.rejects(call(0,null,admin,'foreign-plan'),/Exact captured/)
      await assert.rejects(call(50),/Pinned/);await assert.rejects(call(-1),/Invalid/);await assert.rejects(call(1052,first.source_revision),/exceeds/)
      for(const patch of [{contextKind:'staff'},{role:'staff'},{connection:{role:'admin',userId:uuid(9)}}])assert.equal((await subject({...staff,...patch},{run_id:run,source_id:plan})).coverage,'unknown')
      await db.exec('reset role')
    })
    await t.test('directory drift, missing migration/read and malformed page fail closed, never invoke provider',async()=>{
      await withSQLChange("update clients set name='Changed exact identity' where id=$1",[client],async()=>assert.equal((await subject(staff,{run_id:run,source_id:plan,offset:50,source_revision:first.source_revision,directory_revision:first.directory_revision})).coverage,'unknown'))
      await db.exec('set role service_role');const valid=await call();await db.exec('reset role')
      for(const result of [{data:null,error:null},{data:null,error:{message:'missing RPC'}},{data:{},error:null},{data:{...valid,source_revision:123},error:null}])assert.equal((await subject({...staff,supabase:{...adapter,rpc:async()=>result}},{run_id:run,source_id:plan})).coverage,'unknown')
      await db.exec('set role service_role')
      assert.equal((await subject({...staff,supabase:{...adapter,from:()=>({select(){return this},eq(){return this},order(){return this},range:async()=>({data:null,error:null})})}},{run_id:run,source_id:plan})).coverage,'unknown')
      const dispatch=actualOperationalDispatcher(staff,{read_microsoft_schedule_source:subject},new Set())
      const response=await dispatch({context:{context_kind:'company_admin'},run_id:run,source_id:plan},'read_microsoft_schedule_source')
      assert.equal(response.result.isError,false)
      assert.equal(JSON.parse(response.result.content[0].text).records.length,50)
      await db.exec('reset role')
    })
    await t.test('private content, inactive and ambiguous bucket identity never leak raw copy or invent scope',async()=>{
      const changed=records.slice();changed[0]={...record(0),description:'Private payroll detail'};changed[1]={...record(1),sourceBucketName:'Unknown former client'};changed[2]={...record(2),title:'VIDEO - unnumbered'};changed[3]={...record(3),sourceBucketName:'Synthetic Exact Client plus unrelated work'};changed[4]={...record(4),title:'DP 5 - Unrelated Client 1'};changed[5]={...record(5),sourceBucketName:'Alias Synthetic Exact Client'}
      await withSQLChange('update microsoft_sync_job_sources set records=$1',[JSON.stringify(changed)],async()=>{
        const page=await subject(staff,{run_id:run,source_id:plan});assert.equal(page.error,undefined)
        assert.equal(page.records[0].evidence_state,'private_review_held');assert.equal(page.records[0].client_id,null)
        assert.equal(page.records[1].evidence_state,'identity_review_held');assert.equal(page.records[2].evidence_state,'slot_review_held')
        assert.equal(page.records[3].evidence_state,'identity_review_held');assert.equal(page.records[4].evidence_state,'identity_review_held');assert.equal(page.records[5].client_id,client)
        const encoded=JSON.stringify(page);for(const secret of ['payroll','Unknown former client','unnumbered'])assert.ok(!encoded.includes(secret))
      })
      await withSQLChange('update clients set active=false where id=$1',[client],async()=>assert.equal((await subject(staff,{run_id:run,source_id:plan})).records[0].client_id,null))
    })
    await t.test('explicit complete zero is empty, not an unavailable source',async()=>{
      await withSQLChange("update microsoft_sync_job_sources set records='[]',record_count=0",[],async()=>{
        // Matching canonical run completeness must change too; service role has no write privilege.
        await db.exec('reset role');await db.query('update microsoft_sync_runs set source_completeness=$1',[JSON.stringify([{...completeness[0],recordCount:0}])]);await db.exec('set local role service_role')
        const page=await subject(staff,{run_id:run,source_id:plan});assert.deepEqual(page.records,[]);assert.equal(page.source_record_count,0);assert.equal(page.pagination.has_more,false)
      })
    })
  }finally{await vite.close();await db.close()}
})

test('new source reader is a company-admin read tool, not a write or provider route',()=>{
  const index=read('supabase/functions/cg-dynamics-mcp/index.ts'),context=read('supabase/functions/cg-dynamics-mcp/projectContext.ts'),catalog=read('supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
  assert.match(index,/read_microsoft_schedule_source: readMicrosoftScheduleSource/)
  assert.match(context.slice(context.indexOf('const COMPANY_ADMIN_TOOLS')),/'read_microsoft_schedule_source'/)
  assert.match(catalog,/name: 'read_microsoft_schedule_source'/)
  const tool=CG_DYNAMICS_MCP_TOOLS.find(t=>t.name==='read_microsoft_schedule_source');assert.equal(tool.annotations.readOnlyHint,true)
  for(const kind of ['staff','client'])assert.equal(assertToolAllowedInContext(tool.name,kind).allowed,false)
  assert.equal(assertToolAllowedInContext(tool.name,'company_admin').allowed,true)
  assert.ok(!migration.toLowerCase().includes('security definer'))
})
