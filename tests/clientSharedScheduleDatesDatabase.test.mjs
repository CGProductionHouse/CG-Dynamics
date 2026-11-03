import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('date following executes exact-source, staff-edit, disclosure, replay and client-isolation boundaries in PostgreSQL', {skip:process.env.CG_RUN_LOCAL_DB!=='1'},()=>{
 const docker=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024})
 const created=docker(['run','--pull=never','--detach','--name','cg-source-dates-'+randomUUID(),'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
 assert.equal(created.status,0,created.stderr)
 const container=created.stdout.trim();assert.match(container,/^[a-f0-9]{64}$/)
 try{
  let ready=false
  for(let i=0;i<60;i++){if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}
  assert.ok(ready)
  const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
  const original=migration('20260809130000_client_portal_visibility_contract.sql')
  const projection=original.slice(original.indexOf('create function public.client_portal_month_ahead_posts_v2'),original.indexOf('-- Migration-first compatibility'))
  const setup=`
   set timezone='Africa/Johannesburg';
   create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   grant usage on schema auth to authenticated,service_role;
   create table public.profiles(id uuid primary key,client_id uuid,role text,is_active boolean);
   create table public.clients(id uuid primary key,active boolean);
   create table public.monthly_deliverables(id uuid primary key,client_id uuid,month date,archived_at timestamptz,
    deliverable_type text,instance_number integer,title text,scheduled_date date,due_date date,
    production_status text default 'in_progress',notes text default 'staff notes',assigned_to_name text default 'staff',
    microsoft_plan_id text,microsoft_task_id text,microsoft_bucket_id text,
    microsoft_source_hash text default 'full-source-hash',microsoft_last_synced_at timestamptz default clock_timestamp(),
    sent_to_client_at timestamptz,client_approved_at timestamptz,posted_at timestamptz,updated_at timestamptz default clock_timestamp());
   create function fixture_touch() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
   create trigger fixture_touch before update on monthly_deliverables for each row execute function fixture_touch();
   alter table monthly_deliverables enable row level security;
   create policy fixture_staff on monthly_deliverables to authenticated using(auth.uid()='11111111-1111-4111-8111-111111111111') with check(auth.uid()='11111111-1111-4111-8111-111111111111');
   grant select,insert,update on monthly_deliverables to authenticated,service_role;
   create table microsoft_sync_jobs(id uuid primary key,status text,created_by uuid,created_at timestamptz,exported_at timestamptz);
   create table microsoft_sync_job_sources(id uuid default gen_random_uuid(),job_id uuid,source_type text,source_id text,source_name text,
    required boolean,stage text,complete boolean,safe_error text,pagination_cursor text,record_count integer,records jsonb);
   create table microsoft_sync_runs(id uuid primary key,trigger_type text,status text,requested_by uuid,preview_job_id uuid,summary jsonb default '{}');
   create table planner_activity_log(id bigint generated always as identity,entity_type text,entity_id uuid,action text,actor_user_id uuid,actor_name text,metadata jsonb);
   insert into profiles values
    ('11111111-1111-4111-8111-111111111111',null,'manager',true),
    ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','client',true),
    ('33333333-3333-4333-8333-333333333333',null,'staff',true),
    ('44444444-4444-4444-8444-444444444444',null,'admin',false);
   insert into clients values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
   insert into monthly_deliverables(id,client_id,month,deliverable_type,instance_number,title,scheduled_date,due_date,microsoft_plan_id,microsoft_task_id,microsoft_bucket_id)
    select ('aaaaaaaa-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    case when n=9 then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid end,
    date_trunc('month',current_date)::date,case when n=8 then 'video' else 'dp' end,n,
    case when n=8 then 'REPOST VIDEO - PRIVATE TASK' else 'PRIVATE STAFF TITLE' end,
    date_trunc('month',current_date)::date+n,date_trunc('month',current_date)::date+n,'source-plan','task-'||n,'source-bucket'
    from generate_series(1,10)n;
   insert into microsoft_sync_jobs values('aaaaaaaa-1111-4111-8111-000000000001','complete','11111111-1111-4111-8111-111111111111',clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '5 minutes');
   insert into microsoft_sync_job_sources(job_id,source_type,source_id,source_name,required,stage,complete,record_count,records)
    select 'aaaaaaaa-1111-4111-8111-000000000001','planner_plan','source-plan','2025 CLIENTS SCHEDULE',true,'complete',true,8,
    jsonb_agg(jsonb_build_object('sourceType','planner_task','sourcePlanId','source-plan','sourceTaskId','task-'||n,'sourceBucketId','source-bucket',
      'dueDate',to_char(date_trunc('month',current_date)::date+n,'YYYY-MM-DD'),'percentComplete',100)) from generate_series(1,8)n;
   insert into microsoft_sync_runs values('aaaaaaaa-2222-4222-8222-000000000001','agent','partial','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-000000000001','{"kept":"operational"}');
   create function fixture_expected(variadic nums integer[]) returns jsonb language sql security definer set search_path='' as $$
    select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)order by id)from public.monthly_deliverables where instance_number=any(nums)$$;
   ${projection}
  `
  const cases=`
   do $$begin
    if has_function_privilege('authenticated','refresh_shared_client_schedule_source_dates(uuid)','execute')
      or has_function_privilege('anon','refresh_shared_client_schedule_source_dates(uuid)','execute')
      or has_function_privilege('service_role','client_schedule_verified_source_date(uuid,text,text)','execute') then raise exception 'RPC access widened';end if;
   end$$;
   set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
   do $$begin
    begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date_trunc('month',current_date)::date,true,fixture_expected(1));raise exception 'Staff grant accepted';exception when insufficient_privilege then null;end;
   end$$;
   select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
   select set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date_trunc('month',current_date)::date,true,fixture_expected(1,2,3,4,5,6,7,8));
   do $$begin
    if (select count(*)from monthly_deliverables where client_plan_follow_source)<>8 then raise exception 'Exact verified grants absent';end if;
    begin update monthly_deliverables set client_plan_follow_source=false where instance_number=1;raise exception 'Direct follow write accepted';exception when insufficient_privilege then null;end;
    begin update monthly_deliverables set microsoft_task_id='other' where instance_number=1;raise exception 'Source rebind accepted';exception when insufficient_privilege then null;end;
    begin update monthly_deliverables set client_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where instance_number=1;raise exception 'Shared reassignment accepted';exception when insufficient_privilege then null;end;
   end$$;
   update monthly_deliverables set scheduled_date=date_trunc('month',current_date)::date+18 where instance_number=2;
   select set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date_trunc('month',current_date)::date,false,fixture_expected(4));
   reset role;
   update monthly_deliverables set posted_at=clock_timestamp()where instance_number=3;
   update monthly_deliverables set title='Approved poster',client_approved_at=clock_timestamp()where instance_number=1;
   create temp table fixture_preserved as select id,to_jsonb(md)-'scheduled_date'-'client_plan_shared_date'-'updated_at' as payload from monthly_deliverables md;
   insert into microsoft_sync_jobs values('aaaaaaaa-1111-4111-8111-000000000002','complete','11111111-1111-4111-8111-111111111111',clock_timestamp()-interval '4 minutes',clock_timestamp()-interval '1 minute');
   insert into microsoft_sync_job_sources(job_id,source_type,source_id,source_name,required,stage,complete,record_count,records)
    select 'aaaaaaaa-1111-4111-8111-000000000002',source_type,source_id,source_name,required,stage,complete,record_count,
    (select jsonb_agg(case r->>'sourceTaskId'
      when 'task-1' then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '1 month 4 days','YYYY-MM-DD')))
      when 'task-2' then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '19 days','YYYY-MM-DD')))
      when 'task-3' then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '20 days','YYYY-MM-DD')))
      when 'task-4' then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '21 days','YYYY-MM-DD')))
      when 'task-5' then jsonb_set(r,'{sourceBucketId}','"foreign-bucket"')
      when 'task-6' then jsonb_set(r,'{dueDate}','"2026-99-99"')
      when 'task-7' then r-'dueDate'
      when 'task-8' then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '20 days','YYYY-MM-DD')))
      else r end)from jsonb_array_elements(records)r)
    from microsoft_sync_job_sources where job_id='aaaaaaaa-1111-4111-8111-000000000001';
   insert into microsoft_sync_runs values('aaaaaaaa-2222-4222-8222-000000000002','agent','completed','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-000000000002','{"kept":"operational"}');
   set role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',false);
   do $$declare r jsonb;begin
    r:=refresh_shared_client_schedule_source_dates('aaaaaaaa-2222-4222-8222-000000000002');
    if (r->>'changed')::int<>2 or (r->>'held')::int<>4 or (r->>'checked')::int<>6 then raise exception 'Unexpected exact refresh receipt %',r;end if;
    if refresh_shared_client_schedule_source_dates('aaaaaaaa-2222-4222-8222-000000000002')<>r then raise exception 'Replay changed receipt';end if;
    if not (refresh_shared_client_schedule_source_dates('aaaaaaaa-2222-4222-8222-000000000001')?'blocked') then raise exception 'Stale job accepted';end if;
   end$$;
   reset role;
   do $$begin
    if (select count(*)from planner_activity_log)<>2 then raise exception 'Replay duplicated audit';end if;
    if exists(select 1 from planner_activity_log where actor_user_id is not null or action<>'source_plan_date_refreshed' or not (metadata->>'automatic')::boolean)then raise exception 'Automatic action falsely attributed';end if;
    if exists(select 1 from monthly_deliverables md join fixture_preserved f using(id)where to_jsonb(md)-'scheduled_date'-'client_plan_shared_date'-'updated_at'<>f.payload)then raise exception 'Non-date field changed';end if;
    if (select scheduled_date from monthly_deliverables where instance_number=2)<>date_trunc('month',current_date)::date+18 then raise exception 'Staff override lost';end if;
    if (select scheduled_date from monthly_deliverables where instance_number=4)<>date_trunc('month',current_date)::date+4 then raise exception 'Unshared row moved';end if;
    if (select summary->>'kept' from microsoft_sync_runs where id='aaaaaaaa-2222-4222-8222-000000000002')<>'operational' then raise exception 'Mirror summary lost';end if;
   end$$;
   set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
   do $$begin
    if exists(select 1 from monthly_deliverables)then raise exception 'Client base table read';end if;
    if exists(select 1 from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date_trunc('month',current_date)::date)where title='Approved poster')then raise exception 'Cross-month date remained in old month';end if;
    if not exists(select 1 from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(date_trunc('month',current_date)+interval '1 month')::date)where title='Approved poster')then raise exception 'Cross-month date absent';end if;
    if not exists(select 1 from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date_trunc('month',current_date)::date)where title='Video repost')then raise exception 'Repost label lost';end if;
    begin perform client_portal_month_ahead_posts_v2('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',date_trunc('month',current_date)::date);raise exception 'Foreign client accepted';exception when insufficient_privilege then null;end;
   end$$;
   reset role;
   -- Explicit null is unscheduling, not a missing field. Re-dating the same
   -- delegated row later may restore its plan, without changing any approval.
   insert into microsoft_sync_jobs values('aaaaaaaa-1111-4111-8111-000000000003','complete','11111111-1111-4111-8111-111111111111',clock_timestamp(),clock_timestamp());
   insert into microsoft_sync_job_sources(job_id,source_type,source_id,source_name,required,stage,complete,record_count,records)
    select 'aaaaaaaa-1111-4111-8111-000000000003',source_type,source_id,source_name,required,stage,complete,record_count,
    (select jsonb_agg(case when r->>'sourceTaskId'='task-8'then jsonb_set(r,'{dueDate}','null')else r end)from jsonb_array_elements(records)r)
    from microsoft_sync_job_sources where job_id='aaaaaaaa-1111-4111-8111-000000000002';
   insert into microsoft_sync_runs values('aaaaaaaa-2222-4222-8222-000000000003','agent','completed','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-000000000003','{}');
   set role service_role;select refresh_shared_client_schedule_source_dates('aaaaaaaa-2222-4222-8222-000000000003');reset role;
   do $$begin
    if (select scheduled_date is not null or client_plan_shared_date is not null or not client_plan_follow_source from monthly_deliverables where instance_number=8)then raise exception 'Explicit unschedule failed';end if;
   end$$;
   insert into microsoft_sync_jobs values('aaaaaaaa-1111-4111-8111-000000000004','complete','11111111-1111-4111-8111-111111111111',clock_timestamp()+interval '1 second',clock_timestamp()+interval '1 second');
   insert into microsoft_sync_job_sources(job_id,source_type,source_id,source_name,required,stage,complete,record_count,records)
    select 'aaaaaaaa-1111-4111-8111-000000000004',source_type,source_id,source_name,required,stage,complete,record_count,
    (select jsonb_agg(case when r->>'sourceTaskId'='task-8'then jsonb_set(r,'{dueDate}',to_jsonb(to_char(date_trunc('month',current_date)+interval '10 days','YYYY-MM-DD')))else r end)from jsonb_array_elements(records)r)
    from microsoft_sync_job_sources where job_id='aaaaaaaa-1111-4111-8111-000000000003';
   insert into microsoft_sync_runs values('aaaaaaaa-2222-4222-8222-000000000004','agent','completed','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-000000000004','{}');
   set role service_role;select refresh_shared_client_schedule_source_dates('aaaaaaaa-2222-4222-8222-000000000004');reset role;
   do $$begin
    if (select scheduled_date from monthly_deliverables where instance_number=8)<>date_trunc('month',current_date)::date+10 then raise exception 'Re-date failed';end if;
    update microsoft_sync_job_sources set records=records||jsonb_build_array(records->0),record_count=record_count+1 where job_id='aaaaaaaa-1111-4111-8111-000000000004';
    if exists(select 1 from client_schedule_verified_source_date('aaaaaaaa-1111-4111-8111-000000000004','source-plan','task-1'))then raise exception 'Duplicate task accepted';end if;
    update microsoft_sync_job_sources set complete=false where job_id='aaaaaaaa-1111-4111-8111-000000000004';
    if exists(select 1 from client_schedule_verified_source_date('aaaaaaaa-1111-4111-8111-000000000004','source-plan','task-8'))then raise exception 'Incomplete source accepted';end if;
    update microsoft_sync_job_sources set complete=true,record_count=record_count+1 where job_id='aaaaaaaa-1111-4111-8111-000000000004';
    if exists(select 1 from client_schedule_verified_source_date('aaaaaaaa-1111-4111-8111-000000000004','source-plan','task-8'))then raise exception 'Coverage mismatch accepted';end if;
    update microsoft_sync_job_sources set record_count=jsonb_array_length(records) where job_id='aaaaaaaa-1111-4111-8111-000000000004';
    update microsoft_sync_jobs set exported_at=clock_timestamp()-interval '5 hours' where id='aaaaaaaa-1111-4111-8111-000000000004';
    if exists(select 1 from client_schedule_verified_source_date('aaaaaaaa-1111-4111-8111-000000000004','source-plan','task-8'))then raise exception 'Expired source accepted';end if;
    update microsoft_sync_jobs set exported_at=clock_timestamp() where id='aaaaaaaa-1111-4111-8111-000000000004';
    update profiles set is_active=false where id='11111111-1111-4111-8111-111111111111';
    if exists(select 1 from client_schedule_verified_source_date('aaaaaaaa-1111-4111-8111-000000000004','source-plan','task-8'))then raise exception 'Inactive source owner accepted';end if;
   end$$;
  `
  const sql=setup+migration('20261102120810_client_plan_date_sharing.sql')+migration('20261103051651_client_calendar_repost_label.sql')+migration('20261103102248_client_plan_source_date_following.sql')+cases
  const file=join(tmpdir(),'cg-shared-date-sql-'+randomUUID()+'.sql');writeFileSync(file,sql)
  const result=docker(['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],sql)
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout.slice(-2500)+'\nfixture: '+file)
 }finally{const removed=docker(['rm','-f',container]);assert.equal(removed.status,0,removed.stderr)}
})
