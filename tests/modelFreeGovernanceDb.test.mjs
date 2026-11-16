import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const modulePath=process.env.CG_LOCAL_PGLITE_MODULE
const read=p=>readFileSync(p,'utf8')
test('canonical authenticated source/activation adapter preserves human review, rights, scope and active-admin gates', {skip:!modulePath}, async()=>{
 const {PGlite}=await import(modulePath);const db=new PGlite()
 const admin='10000000-0000-4000-8000-000000000001',staff='10000000-0000-4000-8000-000000000002'
 const card='40000000-0000-4000-8000-000000000001',source='30000000-0000-4000-8000-000000000001',doc='50000000-0000-4000-8000-000000000001'
 const client='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002'
 try {
  await db.exec(read('tests/sql/433_review_revision_setup.sql'))
  await db.exec(read('supabase/phase-18a-marketing-library-foundation.sql'))
  await db.exec(read('supabase/phase-26a-skill-card-governance-fields.sql'))
  await db.exec('alter table skill_cards add column source_reference text,add column reference_state text')
  const old=read('supabase/migrations/20260803090000_skill_card_review_workflow.sql')
  await db.exec(old.slice(0,old.indexOf('-- ── Review queue'))+'create function public.skill_card_review_queue() returns void language sql as $$select null::void$$;'+old.slice(old.indexOf('-- ── Record a review decision')))
  await db.exec(read('supabase/migrations/20260803140000_skill_card_routing_review.sql'))
  await db.exec(read('tests/sql/433_review_revision_legacy.sql'))
  // Use schema only, not the bundled real-source seed catalogue.
  await db.exec(read('supabase/phase-23a-ai-workforce-source-rights.sql').split('-- 6.')[0])
  await db.exec('alter table skill_cards add column client_scope_key text') // exact column from 20260909100000_client_contacts; no unrelated contacts schema
  await db.exec(read('supabase/migrations/20261007102349_skill_card_review_revision_binding.sql'))
  await db.exec(read('supabase/migrations/20261116180000_governed_marketing_source_activation.sql'))
  // Prove the new wrapper independently guards inactivity even with legacy role-only helpers.
  await db.exec(`create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
    insert into profiles values('10000000-0000-4000-8000-000000000005','Manager','manager',true)`)

  await db.exec(`set request.jwt.claim.sub='${admin}';set role authenticated`)
  const call=async({activate=false,hash=null,confirm=false,document=null,clientId=null,scope=null}={})=>(await db.query('select mcp_marketing_source_review($1,$2,$3,$4,0,$5,$6,$7) result',[card,clientId,scope,document,activate,hash,confirm])).rows[0].result
  let snapshot=await call();assert.ok(snapshot.blockers.length);assert.equal(snapshot.activated,false)
  await assert.rejects(call({activate:true,hash:snapshot.card.content_hash,confirm:true}),/Canonical activation|revision changed/)
  await db.query('select skill_card_record_review($1,$2,$3,$4,$5)',[card,'approved','Human inspected exact revision',null,snapshot.card.content_hash])
  snapshot=await call();assert.deepEqual(snapshot.blockers,[])
  await assert.rejects(call({activate:true,hash:snapshot.card.content_hash}),/Explicit human/)
  await assert.rejects(call({activate:true,hash:'a'.repeat(64),confirm:true}),/revision changed/)
  assert.equal((await call({activate:true,hash:snapshot.card.content_hash,confirm:true})).card.status,'active')
  const inspect=async(sql)=>{await db.exec('reset role');const r=await db.query(sql);await db.exec('set role authenticated');return r}
  const count=async()=>(await inspect('select count(*)::int n from skill_card_reviews')).rows[0].n
  const n=await count();await call({activate:true,hash:snapshot.card.content_hash,confirm:true});assert.equal(await count(),n)
  // Canonical human reviewer identity remains the authenticated admin.
  assert.equal((await inspect("select reviewer_profile_id from skill_card_reviews where review_kind='content_review' order by reviewed_at desc limit 1")).rows[0].reviewer_profile_id,admin)
  await assert.rejects(call({clientId:client}),/Exact card client/)
  await db.exec(`reset role;insert into clients(id,name,active) values('${other}','Other fixture',true) on conflict do nothing;
    update skill_cards set client_specific=true,active_client_id='${client}',client_scope_key='branch' where id='${card}';set role authenticated`)
  await assert.rejects(call({clientId:other,scope:'branch'}),/Exact card client/)
  await assert.rejects(call({clientId:client,scope:'other'}),/Exact card client/)
  assert.equal((await call({clientId:client,scope:'branch'})).card.client_id,client)
  await db.exec(`reset role;update skill_cards set client_specific=false,active_client_id=null,client_scope_key=null where id='${card}';
    update marketing_library_sources set rights_status='public_domain',access_mode='full_text_allowed',full_text_storage=true,commercial_use='allowed',rights_checked_at=now(),ingestion_status='verified' where id='${source}';
    insert into marketing_library_documents(id,source_id,title,rights_status,access_mode,ingestion_status,text_human_verified,storage_path) values('${doc}','${source}','Permitted document','public_domain','full_text_allowed','verified',true,'private/never-return');
    insert into marketing_library_chunks(document_id,body,verification_state) values('${doc}','Verified public domain passage','verified'),('${doc}','Unverified passage','needs_review');set role authenticated`)
  const text=await call({document:doc});assert.equal(text.chunks.length,1);assert.equal(text.chunks[0].body,'Verified public domain passage')
  assert.ok(!JSON.stringify(text).includes('private/never-return'));assert.ok(!JSON.stringify(text).includes('Unverified passage'))
  await assert.rejects(call({document:other}),/Document unavailable/)
  await db.exec(`reset role;update marketing_library_sources set access_mode='excerpt_only' where id='${source}';set role authenticated`)
  await assert.rejects(call({document:doc}),/rights or verification/)
  await db.exec(`reset role;update marketing_library_sources set trust_tier='tier_4_low_trust' where id='${source}';set role authenticated`)
  snapshot=await call()
  await db.query('select skill_card_record_review($1,$2,$3,$4,$5)',[card,'approved','Review does not override source trust',null,snapshot.card.content_hash])
  snapshot=await call();assert.ok(snapshot.blockers.length)
  await assert.rejects(call({activate:true,hash:snapshot.card.content_hash,confirm:true}),/Canonical activation/)
  for(const identity of [staff,'10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005']){
    await db.exec(`set request.jwt.claim.sub='${identity}'`);await assert.rejects(call(),/Active authenticated admin/)
  }
  await db.exec(`reset role;update profiles set is_active=false where id='${admin}';set request.jwt.claim.sub='${admin}';set role authenticated`)
  await assert.rejects(call(),/Active authenticated admin/)
  await db.exec('reset role;set role service_role');await assert.rejects(call(),/permission denied/)
  await db.exec('reset role;set role anon');await assert.rejects(call(),/permission denied/)
 } finally {await db.close()}
})
