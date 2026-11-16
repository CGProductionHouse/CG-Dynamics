import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const modulePath=process.env.CG_LOCAL_PGLITE_MODULE
// Disposable in-memory PostgreSQL; never connects to a production endpoint.
test('model-free Marketing SQL: atomic drafts, exact actor/client, review gates, immutable history and receipts', {skip:!modulePath},async()=>{
 const {PGlite}=await import(modulePath);const db=new PGlite()
 const admin='11111111-1111-4111-8111-111111111111', staff='22222222-2222-4222-8222-222222222222', client='33333333-3333-4333-8333-333333333333', other='44444444-4444-4444-8444-444444444444', card='55555555-5555-4555-8555-555555555555'
 let n=0;const key=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12,'0')}`
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select current_setting('fixture.role',true)$$;
 create function public.is_staff() returns boolean language sql as $$select true$$;
 create function public.is_manager() returns boolean language sql as $$select true$$;
 create table profiles(id uuid primary key,role text,is_active boolean);
 create table clients(id uuid primary key,active boolean);
 create table google_ads_campaign_daily_metrics(client_id uuid,campaign_id text,campaign_name text,metric_date date);
 create table skill_cards(id uuid primary key,status text,content_hash text,reviewed_content_hash text,review_expires_at date,source_type text,client_specific boolean,active_client_id uuid,client_scope_key text);
 insert into profiles values('${admin}','admin',true),('${staff}','staff',true);
 insert into clients values('${client}',true),('${other}',true);
 insert into skill_cards values('${card}','active',repeat('a',64),repeat('a',64),null,'book',false,null,null);
 set fixture.role='service_role';`)
 await db.exec(readFileSync('supabase/migrations/20260802130000_marketing_ai_department.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261116160000_model_free_marketing_connector.sql','utf8'))
 const call=async(input,k=key(),actor=staff,connection=admin,context='staff',project=null)=>(await db.query('select mcp_write_marketing_artifact($1,$2,$3,$4,$5,$6) as result',[actor,connection,context,k,input,project])).rows[0].result
 const draft={client_id:client,action:'draft',specialist:'copywriting_agent',request:'External authored copy',content:{drafts:['A real specific draft']},expected_version:0,evidence_card_ids:[card]}
 const receiptKey=key();const first=await call(draft,receiptKey)
 assert.equal(first.status,'draft');assert.equal(first.version,1);assert.equal(first.model_used,false)
 assert.deepEqual(await call(draft,receiptKey),first)
 await assert.rejects(call({...draft,request:'Different'},receiptKey),/conflict/)
 assert.equal((await db.query('select count(*)::int n from ai_marketing_artifacts')).rows[0].n,1)
 assert.equal((await db.query('select created_by,provider,model from ai_marketing_artifact_versions')).rows[0].created_by,staff)
 assert.equal((await db.query('select provider from ai_marketing_artifact_versions')).rows[0].provider,null)
 const append={...draft,artifact_id:first.artifact_id,expected_version:1}
 await assert.rejects(call({...append,client_id:other}),/exact client/)
 await assert.rejects(call({...append,expected_version:0}),/Stale/)
 await assert.rejects(call({...draft,evidence_card_ids:[other]}),/Evidence/)
 await db.exec(`update skill_cards set reviewed_content_hash=null`)
 await assert.rejects(call(append),/Evidence/)
 await db.exec(`update skill_cards set reviewed_content_hash=content_hash,client_specific=true,active_client_id='${other}'`)
 await assert.rejects(call(append),/Evidence/)
 await db.exec(`update skill_cards set active_client_id='${client}',client_scope_key='branch'`)
 await assert.rejects(call(append),/Evidence/)
 await db.exec(`update skill_cards set client_specific=false,active_client_id=null,client_scope_key=null,review_expires_at=current_date-1`)
 await assert.rejects(call(append),/Evidence/)
 await db.exec('update skill_cards set review_expires_at=current_date')
 const second=await call(append);assert.equal(second.version,2)
 const decision={client_id:client,artifact_id:first.artifact_id,version_id:second.version_id,action:'decision',decision:'approved',confirm_human_decision:true}
 await assert.rejects(call(decision),/Manager/)
 await assert.rejects(call({...decision,version_id:first.version_id},key(),admin),/current version/)
 await assert.rejects(call({...decision,confirm_human_decision:false},key(),admin),/Explicit human/)
 const approved=await call(decision,key(),admin);assert.equal(approved.status,'human_approved')
 await assert.rejects(call({...append,expected_version:2}),/Closed/)
 await assert.rejects(db.exec('update ai_marketing_artifact_versions set content=\'{}\''),/append-only/)
 await db.exec(`update profiles set is_active=false where id='${staff}'`)
 await assert.rejects(call(draft,receiptKey),/Active actor/)
 await db.exec(`update profiles set is_active=true where id='${staff}'`)
 await assert.rejects(call(draft,key(),admin,staff),/Active actor/)
 await assert.rejects(call(draft,key(),staff,admin,'client'),/Active actor/)
 await db.exec("set fixture.role='authenticated'")
 await assert.rejects(call(draft),/Service-only/)
 await db.exec("set role authenticated")
 await assert.rejects(db.query('select * from mcp_marketing_write_receipts'),/permission denied/)
 await assert.rejects(call(draft),/permission denied/)
 await db.exec('reset role')
 await db.exec('begin')
 const denied=async(p,pattern)=>{await assert.rejects(p,pattern);await db.exec('rollback to savepoint denied');await db.exec('release savepoint denied')}
 const attempt=async(...args)=>{await db.exec('savepoint denied');return call(...args)}
 await db.exec("set fixture.role='service_role'")
 await db.exec(`insert into google_ads_campaign_daily_metrics values('${client}','campaign-1','Canonical campaign','2026-11-16'),('${other}','foreign','Foreign','2026-11-16')`)
 await denied(attempt({...draft,campaign_id:'foreign'}),/Campaign unavailable/)
 const bound=await call({...draft,campaign_id:'campaign-1'},key(),staff,staff,'client',client)
 assert.equal((await db.query('select campaign_name from ai_marketing_artifacts where id=$1',[bound.artifact_id])).rows[0].campaign_name,'Canonical campaign')
 await denied(attempt({...draft,artifact_id:bound.artifact_id,expected_version:1,campaign_id:'campaign-1'}),/creation-only/)
 await denied(attempt({...decision,artifact_id:bound.artifact_id,campaign_id:null}),/creation-only/)
 await denied(attempt(draft,key(),staff,staff,'client',other),/Exact Project client/)
 await denied(attempt(draft,key(),staff,admin,'client',client),/Active actor/)
 await db.exec(`update profiles set is_active=false where id='${admin}'`)
 await denied(attempt(draft,key(),staff,admin,'staff'),/Active actor/)
 await db.exec(`update profiles set is_active=true where id='${admin}';update profiles set role='client' where id='${staff}'`)
 await denied(attempt(draft,key(),staff,staff,'client',client),/Active actor/)
 await db.exec(`update profiles set role='staff',is_active=false where id='${staff}'`)
 await denied(attempt(draft,key(),staff,staff,'client',client),/Active actor/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from ai_marketing_artifact_versions')).rows[0].n,2)
 assert.equal((await db.query('select count(*)::int n from ai_marketing_artifact_approvals')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int n from mcp_marketing_write_receipts')).rows[0].n,3)
 }finally{await db.close()}
})
