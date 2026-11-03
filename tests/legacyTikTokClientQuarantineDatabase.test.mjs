import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20261103145536_quarantine_legacy_tiktok_client_mismatch.sql', import.meta.url), 'utf8')
const projection = "CREATE OR REPLACE FUNCTION public.get_report_metric_facts(p_report_id uuid)\n RETURNS TABLE(platform text, period_month text, period_start date, period_end date, metric_key text, source_metric text, value numeric, availability text, includes_paid text, aggregation text, comparable_group text)\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\ndeclare\n  v_client_id uuid;\n  v_status text;\n  v_report_month text;\nbegin\n  select r.client_id, r.status,\n         to_char(date_trunc('month', r.period_end), 'YYYY-MM')\n  into v_client_id, v_status, v_report_month\n  from public.reports r\n  where r.id = p_report_id;\n\n  if not found then\n    raise exception 'Report not found' using errcode = 'P0002';\n  end if;\n\n  if not (\n    public.is_staff()\n    or (\n      v_status = 'published'\n      and v_client_id = public.my_client_id()\n    )\n  ) then\n    raise exception 'Not authorized for this report' using errcode = '42501';\n  end if;\n\n  return query\n  select f.platform, f.period_month, f.period_start, f.period_end,\n         f.metric_key, f.source_metric, f.value,\n         f.availability, f.includes_paid, f.aggregation, f.comparable_group\n  from public.platform_metric_facts_monthly f\n  where f.client_id = v_client_id\n    and f.period_month in (\n      v_report_month,\n      to_char(to_date(v_report_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')\n    )\n    and exists (\n      select 1\n      from public.metric_registry mr\n      where mr.platform = f.platform\n        and mr.metric_key = f.metric_key\n        and mr.client_safe\n        and (\n          mr.status = 'active'\n          or (public.is_staff() and mr.status = 'experimental')\n        )\n    )\n  order by f.period_month desc, f.platform, f.metric_key;\nend\n$function$\n"
test('legacy TikTok quarantine preserves originals privately, exact client isolation and replay in real PostgreSQL',
  { skip: process.env.CG_RUN_LOCAL_DB !== '1' }, () => {
  const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 2*1024*1024 })
  const created = docker(['run','--pull=never','--detach','--name','cg-tiktok-hold-'+randomUUID(),'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
  assert.equal(created.status,0,created.stderr)
  const container=created.stdout.trim();assert.match(container,/^[a-f0-9]{64}$/)
  const run = input => docker(['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input)
  const pass = input => { const r=run(input);assert.equal(r.status,0,r.stderr+'\n'+r.stdout.slice(-1800));return r }
  try {
    let ready=false
    for(let i=0;i<60;i++){if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}
    assert.ok(ready)
    pass(`
      create role authenticated;create role anon;create role service_role bypassrls;
      create function public.is_staff() returns boolean language sql stable as $$select coalesce(current_setting('fixture.staff',true),'false')='true'$$;
      create function public.my_client_id() returns uuid language sql stable as $$select nullif(current_setting('fixture.client',true),'')::uuid$$;
      create table public.tiktok_connections(id uuid primary key,client_id uuid);
      create table public.platform_sync_runs(id uuid primary key,platform text,client_id uuid,connection_id uuid);
      create table public.platform_metric_facts_monthly(id uuid primary key default gen_random_uuid(),client_id uuid,platform text,period_month text,period_start date,period_end date,
        metric_key text,value numeric,availability text,connector_version text,sync_run_id uuid,provenance jsonb,source_metric text,includes_paid text,aggregation text,comparable_group text);
      alter table public.platform_metric_facts_monthly enable row level security;
      grant select on public.platform_metric_facts_monthly to authenticated;
      create policy staff_read on public.platform_metric_facts_monthly for select to authenticated using(public.is_staff());
      create table public.reports(id uuid,client_id uuid,status text,period_end date);
      create table public.metric_registry(platform text,metric_key text,client_safe boolean,status text);
      insert into tiktok_connections values('4bc29c96-dc18-43b0-ac17-f65f18a8279b','899c9988-8207-4e45-a8fc-a7446dfcf96b');
      insert into platform_sync_runs values('644ccb60-c294-4512-8e4c-c7d1b577a04b','tiktok','fd16ebae-a50b-4920-afe0-94c2631f8f06','4bc29c96-dc18-43b0-ac17-f65f18a8279b');
      insert into platform_metric_facts_monthly(client_id,platform,period_month,period_start,period_end,metric_key,value,availability,connector_version,sync_run_id,provenance,source_metric,includes_paid,aggregation,comparable_group)
       select 'fd16ebae-a50b-4920-afe0-94c2631f8f06','tiktok','2026-09','2026-09-01','2026-09-30',key,value::numeric,'partial','tiktok-v1','644ccb60-c294-4512-8e4c-c7d1b577a04b','{"source":"tiktok_display_api","notes":"original"}',key,'unknown','snapshot','tiktok'
       from jsonb_each_text('{"comments":0,"current_followers":284,"following_count":76,"likes":0,"shares":0,"total_likes":764,"video_count":37,"views":0}');
      insert into platform_metric_facts_monthly select gen_random_uuid(),'899c9988-8207-4e45-a8fc-a7446dfcf96b',platform,period_month,period_start,period_end,metric_key,value,availability,connector_version,sync_run_id,provenance,source_metric,includes_paid,aggregation,comparable_group from platform_metric_facts_monthly;
      insert into platform_metric_facts_monthly select gen_random_uuid(),client_id,'facebook',period_month,period_start,period_end,metric_key,value,availability,connector_version,sync_run_id,provenance,source_metric,includes_paid,aggregation,comparable_group from platform_metric_facts_monthly where client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06';
      create table fixture_preserved as select id,to_jsonb(f)payload from platform_metric_facts_monthly f;
      insert into reports values('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','fd16ebae-a50b-4920-afe0-94c2631f8f06','published','2026-09-30');
      insert into metric_registry select distinct platform,metric_key,true,'active'from platform_metric_facts_monthly;
      `+projection+`;\n
      grant execute on function public.get_report_metric_facts(uuid)to authenticated;
    `)
    // Every failed precondition must abort atomically, including the caller's edits.
    for(const [change,error]of[
      ["update platform_metric_facts_monthly set value=285 where client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06' and platform='tiktok' and metric_key='current_followers';",/Historical fact values changed/],
      ["update tiktok_connections set client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06';",/identity mismatch has changed/],
      ["delete from platform_metric_facts_monthly where client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06' and platform='tiktok' and metric_key='views';",/exact eight/],
    ]){
      const failed=run('begin;'+change+sql+'commit;');assert.notEqual(failed.status,0);assert.match(failed.stderr,error)
      pass("do $$begin if exists(select1from platform_metric_facts_monthly f join fixture_preserved p using(id)where to_jsonb(f)<>p.payload)or(select count(*)from platform_metric_facts_monthly)<>24 then raise exception 'Failed guard changed data';end if;end$$;".replace('select1from','select 1 from'))
    }
    pass(sql)
    pass(`do $$begin
      if(select count(*)from platform_metric_facts_monthly where client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06'and platform='tiktok'and value is null and availability='unavailable')<>8 then raise exception 'Hold missing';end if;
      if exists(select 1 from platform_metric_facts_monthly f join fixture_preserved p using(id)where
        case when f.client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06'and f.platform='tiktok'
        then f.provenance->'client_identity_quarantine'->'original_value' is distinct from p.payload->'value'
          or f.provenance->>'source'<>'tiktok_display_api' or f.provenance->>'notes'<>'original'
          or to_jsonb(f)-'value'-'availability'-'provenance'<>p.payload-'value'-'availability'-'provenance'
        else to_jsonb(f)<>p.payload end)then raise exception 'Original or unrelated fact changed';end if;
      end$$;
      create table fixture_after as select id,to_jsonb(f)payload from platform_metric_facts_monthly f;
    `)
    pass(sql)
    pass(`do $$begin if exists(select1from platform_metric_facts_monthly f join fixture_after p using(id)where to_jsonb(f)<>p.payload)then raise exception 'Replay changed history';end if;end$$;`.replace('select1from','select 1 from'))
    pass(`set role authenticated;select set_config('fixture.client','fd16ebae-a50b-4920-afe0-94c2631f8f06',false);
      do $$begin
       if exists(select 1 from platform_metric_facts_monthly)then raise exception 'Client read private original/provenance';end if;
       if exists(select 1 from get_report_metric_facts('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')where platform='tiktok'and value is not null)then raise exception 'Wrong-client public number leaked';end if;
       if(select count(*)from get_report_metric_facts('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')where platform='facebook'and value is not null)<>8 then raise exception 'Valid provider removed';end if;
      end$$;reset role;
    `)
    // No historical target rows on a fresh database is a deliberate harmless no-op.
    pass("begin;delete from platform_metric_facts_monthly where client_id='fd16ebae-a50b-4920-afe0-94c2631f8f06'and platform='tiktok';"+sql+"rollback;")
  }finally{const removed=docker(['rm','-f',container]);assert.equal(removed.status,0,removed.stderr)}
})
