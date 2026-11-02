import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('planned-date sharing executes role, revision, disclosure and history boundaries in PostgreSQL', { skip: process.env.CG_RUN_LOCAL_DB !== '1' }, () => {
  const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
  const created = docker(['run', '--pull=never', '--detach', '--name', `cg-plan-sharing-${randomUUID()}`, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'])
  assert.equal(created.status, 0, created.stderr)
  const id = created.stdout.trim(); assert.match(id, /^[a-f0-9]{64}$/)
  try {
    let ready = false
    for (let i = 0; i < 60; i++) {
      if (docker(['exec', id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) { ready = true; break }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
    assert.ok(ready)
    const migration = readFileSync(new URL('../supabase/migrations/20261102120810_client_plan_date_sharing.sql', import.meta.url), 'utf8')
    const original = readFileSync(new URL('../supabase/migrations/20260809130000_client_portal_visibility_contract.sql', import.meta.url), 'utf8')
    const projection = original.slice(original.indexOf('create function public.client_portal_month_ahead_posts_v2'), original.indexOf('-- Migration-first compatibility'))
    const setup = `
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      create table profiles(id uuid primary key, client_id uuid, role text, is_active boolean);
      create table clients(id uuid primary key, active boolean);
      create table monthly_deliverables(id uuid primary key,client_id uuid,month date,archived_at timestamptz,deliverable_type text,instance_number int,title text,
        scheduled_date date,due_date date,production_status text default 'scheduled',source_task_id text default 'preserve-teams-id',
        sent_to_client_at timestamptz,client_approved_at timestamptz,posted_at timestamptz,updated_at timestamptz not null default clock_timestamp());
      create function fixture_touch() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
      create trigger fixture_touch before update on monthly_deliverables for each row execute function fixture_touch();
      alter table monthly_deliverables enable row level security;
      create policy fixture_staff on monthly_deliverables to authenticated using (auth.uid()='11111111-1111-4111-8111-111111111111') with check (auth.uid()='11111111-1111-4111-8111-111111111111');
      grant select,insert,update on monthly_deliverables to authenticated,service_role;
      grant all on monthly_deliverables to service_role;
      insert into profiles values
        ('11111111-1111-4111-8111-111111111111',null,'manager',true),
        ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','client',true),
        ('33333333-3333-4333-8333-333333333333',null,'staff',true),
        ('44444444-4444-4444-8444-444444444444',null,'admin',false);
      insert into clients values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
      insert into monthly_deliverables(id,client_id,month,deliverable_type,instance_number,title,scheduled_date,due_date)
        select ('aaaaaaaa-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=3 then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid end,
          '2026-11-01','dp',n,'PRIVATE STAFF TITLE',case when n=4 then null when n=5 then '2026-12-01'::date else '2026-11-02'::date end,'2026-11-25'
        from generate_series(1,5) n;
      -- Fixture-only revision builder; no fixture helper is part of the migration.
      create function fixture_expected(variadic numbers int[]) returns jsonb language sql security definer set search_path='' as $$
        select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id) from public.monthly_deliverables where instance_number=any(numbers)$$;
      ${projection}
      grant execute on function client_portal_month_ahead_posts_v2(uuid,date) to authenticated;
      set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      do $$begin if exists(select 1 from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01')) then raise exception 'Unshared planned date leaked before migration';end if;end$$;
      reset role;
    `
    const acceptance = `
      set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      do $$declare r jsonb;begin
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1,3));raise exception 'Foreign batch accepted';exception when insufficient_privilege then null;end;
        if exists(select 1 from monthly_deliverables where client_plan_shared_at is not null) then raise exception 'Partial batch write escaped';end if;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1,4));raise exception 'Undated accepted';exception when invalid_parameter_value then null;end;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(5));raise exception 'Out of month accepted';exception when invalid_parameter_value then null;end;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1)||fixture_expected(1));raise exception 'Duplicate accepted';exception when invalid_parameter_value then null;end;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,'[]');raise exception 'Empty accepted';exception when invalid_parameter_value then null;end;
        begin update monthly_deliverables set client_plan_shared_date='2026-11-02',client_plan_shared_at=now(),client_plan_shared_by_profile_id=auth.uid();raise exception 'Direct publication accepted';exception when insufficient_privilege then null;end;
        r=fixture_expected(1);update monthly_deliverables set title='EDIT PRESERVED' where instance_number=1;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,r);raise exception 'Stale accepted';exception when serialization_failure then null;end;
        r=set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1,2));
        if r->>'changed'<>'2' then raise exception 'Exact batch not shared';end if;
        r=set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1,2));
        if r->>'changed'<>'0' then raise exception 'Idempotence lost';end if;
        if exists(select 1 from monthly_deliverables where sent_to_client_at is not null or client_approved_at is not null or posted_at is not null or source_task_id<>'preserve-teams-id' or production_status<>'scheduled') then raise exception 'Source or approval changed';end if;
        begin update monthly_deliverables set client_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where instance_number=1;raise exception 'Client transfer accepted';exception when insufficient_privilege then null;end;
        begin update monthly_deliverables set month='2026-12-01' where instance_number=1;raise exception 'Month transfer accepted';exception when insufficient_privilege then null;end;
      end$$;
      select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      do $$declare r jsonb;begin
        select jsonb_agg(to_jsonb(p)) into r from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01') p;
        if jsonb_array_length(r)<>2 or exists(select 1 from jsonb_array_elements(r) x where x->>'client_safe_status'<>'planned' or x->>'title' not in ('Poster 1','Poster 2')) then raise exception 'Unsafe planned projection';end if;
        if r::text like '%PRIVATE%' or r::text like '%EDIT PRESERVED%' or r::text like '%source_task%' or r::text like '%updated_at%' then raise exception 'Private fields leaked';end if;
        begin perform * from client_portal_month_ahead_posts_v2('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-11-01');raise exception 'Other client allowed';exception when insufficient_privilege then null;end;
        begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',false,fixture_expected(1));raise exception 'Client write allowed';exception when insufficient_privilege then null;end;
        if exists(select 1 from monthly_deliverables) then raise exception 'Client base rows allowed';end if;
      end$$;
      select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
      do $$begin begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',false,fixture_expected(1));raise exception 'Staff write allowed';exception when insufficient_privilege then null;end;end$$;
      select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
      do $$begin begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',false,fixture_expected(1));raise exception 'Inactive write allowed';exception when insufficient_privilege then null;end;end$$;
      reset role;
      update monthly_deliverables set scheduled_date='2026-11-09' where instance_number=1;
      set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      do $$begin if (select count(*) from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01'))<>1 then raise exception 'Changed date automatically shared';end if;end$$;
      select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      select set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,fixture_expected(1));
      select set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',false,fixture_expected(1));
      do $$begin
        if not exists(select 1 from monthly_deliverables where instance_number=1 and client_plan_shared_date is null and client_plan_shared_at is not null and client_plan_shared_by_profile_id=auth.uid()) then raise exception 'Hidden audit lost';end if;
        begin update monthly_deliverables set client_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where instance_number=1;raise exception 'Hidden history transferred';exception when insufficient_privilege then null;end;
      end$$;
      reset role;update monthly_deliverables set sent_to_client_at=now(),client_approved_at=now() where instance_number=2;
      set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      do $$begin if not exists(select 1 from client_portal_month_ahead_posts_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01') where client_safe_status='scheduled' and title='PRIVATE STAFF TITLE') then raise exception 'Existing approval precedence changed';end if;end$$;
      reset role;set role service_role;
      do $$begin begin update monthly_deliverables set client_plan_shared_at=now();raise exception 'Direct service publication allowed';exception when insufficient_privilege then null;end;end$$;
      reset role;set role anon;
      do $$begin begin perform set_client_schedule_plan_visibility('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-01',true,'[]');raise exception 'Anonymous allowed';exception when insufficient_privilege then null;end;end$$;
      reset role;select 'PLAN DATE SHARING PASS';
    `
    const result = docker(['exec', '-i', id, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], setup + migration + acceptance)
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr)
    assert.match(result.stdout, /PLAN DATE SHARING PASS/)
  } finally {
    const removed = docker(['rm', '--force', id]); assert.equal(removed.status, 0, removed.stderr)
  }
})
