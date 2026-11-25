import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

// Real existing SQL, disposable database only. No credentials or hosted writes.
test('canonical guideline RPC and actual calendar mirror support undated preparation and one dated identity', {skip:!process.env.CG_LOCAL_PGLITE_MODULE}, async t=>{
  const {PGlite}=await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href),db=new PGlite()
  const actor='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222',run='33333333-3333-4333-8333-333333333333'
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
      create table public.profiles(id uuid primary key references auth.users(id),is_active boolean,role text);
      create table public.clients(id uuid primary key,name text,active boolean);
      create table public.company_calendar_events(id uuid primary key default gen_random_uuid(),client_id uuid references clients(id),client_name text,title text,event_type text,start_at timestamptz,location text,assigned_to_name text,status text);
      create table public.content_runs(id uuid primary key default gen_random_uuid(),calendar_event_id uuid references company_calendar_events(id),client_id uuid references clients(id),client_name text,name text,run_date date,start_time time,location text,lead_name text,status text);
      create unique index one_real_calendar_run on content_runs(calendar_event_id) where calendar_event_id is not null and status<>'cancelled';
      create table public.content_guidelines(id uuid primary key default gen_random_uuid(),content_run_id uuid not null unique references content_runs(id),client_id uuid references clients(id),title text,month date,status text default 'draft',created_by uuid references profiles(id),updated_at timestamptz default now());
      insert into auth.users values('${actor}');insert into profiles values('${actor}',true,'admin');insert into clients values('${client}','Exact practice client',true);
      insert into content_runs(id,client_id,name,status) values('${run}','${client}','Undated real preparation','planning');
      select set_config('request.jwt.claim.role','service_role',false);`)
    const actorSql=readFileSync('supabase/migrations/20260922120000_system_worker_profile.sql','utf8')
    const start=actorSql.indexOf('create or replace function public.get_or_create_content_guideline_as_actor(')
    const end=actorSql.indexOf('create or replace function public.persist_content_autopilot_ideas',start)
    await db.exec(actorSql.slice(start,end))
    const mirrorSql=readFileSync('supabase/migrations/20260726075342_content_run_client_propagation.sql','utf8')
    const mirrorStart=mirrorSql.indexOf('create or replace function public.sync_microsoft_content_run_event()')
    await db.exec(mirrorSql.slice(mirrorStart,mirrorSql.indexOf('$$;',mirrorStart)+3))
    await db.exec('create trigger exact_calendar_mirror after insert or update on company_calendar_events for each row execute function sync_microsoft_content_run_event()')
    const prepare=id=>db.query('select (public.get_or_create_content_guideline_as_actor($1,$2)).*',[id,actor])
    await t.test('undated run returns one draft without a shoot date or calendar event; retry keeps staff text',async()=>{
      const first=(await prepare(run)).rows[0];assert.equal(first.month,null)
      await db.query('update content_guidelines set title=$1 where id=$2',['Keep exact staff direction',first.id])
      const retry=(await prepare(run)).rows[0];assert.equal(retry.id,first.id);assert.equal(retry.title,'Keep exact staff direction')
      assert.equal((await db.query('select count(*)::int n from company_calendar_events')).rows[0].n,0)
      assert.equal((await db.query('select run_date from content_runs where id=$1',[run])).rows[0].run_date,null)
    })
    await t.test('exact month update refuses a stale revision or published document',async()=>{
      const g=(await prepare(run)).rows[0]
      await db.query("update content_guidelines set month='2026-12-01' where id=$1 and status='draft' and month is null and updated_at=$2",[g.id,g.updated_at])
      assert.equal((await db.query('select month::text from content_guidelines where id=$1',[g.id])).rows[0].month,'2026-12-01')
      await db.query("update content_guidelines set status='published' where id=$1",[g.id])
      const refused=await db.query("update content_guidelines set month='2027-01-01' where id=$1 and status='draft' and month is null returning id",[g.id])
      assert.equal(refused.rows.length,0)
    })
    await t.test('one dated calendar event already creates its run; date changes retain the same run and guideline',async()=>{
      const event=(await db.query("insert into company_calendar_events(client_id,client_name,title,event_type,start_at,status) values($1,'Exact practice client','Actual requested shoot','content_run','2026-12-08T08:00:00+02','planned') returning id",[client])).rows[0]
      const linked=(await db.query('select * from content_runs where calendar_event_id=$1',[event.id])).rows
      assert.equal(linked.length,1);const g=(await prepare(linked[0].id)).rows[0]
      await db.query("update company_calendar_events set start_at='2026-12-09T09:00:00+02' where id=$1",[event.id])
      const after=(await db.query('select id,run_date::text from content_runs where calendar_event_id=$1',[event.id])).rows
      assert.equal(after.length,1);assert.equal(after[0].id,linked[0].id);assert.equal(after[0].run_date,'2026-12-09');assert.equal((await prepare(linked[0].id)).rows[0].id,g.id)
    })
    await t.test('real service/active auth-backed profile checks reject an invented actor or public caller',async()=>{
      await assert.rejects(()=>db.query('select public.get_or_create_content_guideline_as_actor($1,$2)',[run,client]),/active system profile/)
      await db.exec("select set_config('request.jwt.claim.role','authenticated',false)")
      await assert.rejects(()=>prepare(run),/active system profile/)
    })
  }finally{await db.close()}
})
