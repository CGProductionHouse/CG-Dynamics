import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('public thumbnail projection executes exact client, role, publication and media isolation in PostgreSQL', {skip:process.env.CG_RUN_LOCAL_DB!=='1'}, () => {
  const docker=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024})
  const created=docker(['run','--pull=never','--detach','--name',`cg-post-media-${randomUUID()}`,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
  assert.equal(created.status,0,created.stderr)
  const id=created.stdout.trim();assert.match(id,/^[a-f0-9]{64}$/)
  try {
    let ready=false
    for(let i=0;i<60;i++) {
      if(docker(['exec',id,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)
    }
    assert.ok(ready)
    const migration=readFileSync(new URL('../supabase/migrations/20261102113000_client_report_public_post_images.sql',import.meta.url),'utf8')
    const setup=`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      create table profiles(id uuid,client_id uuid,role text,is_active boolean);
      create table reports(id uuid,client_id uuid,status text,period_start date,period_end date);
      create table posts(id integer,report_id uuid,platform text,publish_time timestamptz,meta_post_type text,caption text,permalink text,raw jsonb,views integer,reach integer,created_at timestamptz default now());
      create table report_content_exclusions(report_id uuid,post_id integer,client_id uuid,excluded boolean);
      alter table profiles enable row level security;alter table reports enable row level security;alter table posts enable row level security;alter table report_content_exclusions enable row level security;
      create function my_client_id() returns uuid language sql stable security definer set search_path=public as $$select client_id from profiles where id=auth.uid()$$;
      create function client_published_report_posts(uuid) returns void language sql as $$select null::void$$;
      insert into profiles values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','client',true);
      insert into profiles values('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','client',false);
      insert into profiles values('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','staff',true);
      insert into reports values('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','published','2026-10-01','2026-10-26'),
      ('aaaaaaaa-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','published','2026-10-01','2026-10-31'),
      ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','draft','2026-10-01','2026-10-31');
      insert into posts(id,report_id,platform,publish_time,caption,raw) select n,'aaaaaaaa-0000-4000-8000-000000000001','facebook','2026-10-26T12:00:00Z','Post '||n,
        jsonb_build_object('source','meta_sync','full_picture',url,'engagement_evidence',jsonb_build_object('completeness','complete','complete_total',95,'known_subtotal',95,'definition_id','facebook_direct','definition_label','Facebook direct reactions + comments + shares','source','direct','observed_at','2026-11-01T00:00:00Z','coverage',jsonb_build_object('observed',3,'required',3)))
        from (values(1,'https://scontent.fbcdn.net/public.jpg'),(2,'https://internal.sharepoint.com/private.jpg'),(3,'https://fbcdn.net.evil.test/tracker'),(4,'https://scontent.fbcdn.net/public.jpg?access_token=PRIVATE'),(5,'https://scontent.fbcdn.net/excluded.jpg'),(6,'https://scontent.fbcdn.net/after-cutoff.jpg'),(7,'https://scontent.fbcdn.net/pacific-boundary.jpg')) media(n,url);
      insert into report_content_exclusions values('aaaaaaaa-0000-4000-8000-000000000001',5,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
      update posts set publish_time='2026-10-27T07:00:00Z' where id=6;
      update posts set publish_time='2026-10-27T06:59:59Z' where id=7;`
    const acceptance=`
      set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      do $$declare rows jsonb;begin
        select jsonb_agg(to_jsonb(p)) into rows from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000001') p;
        if jsonb_array_length(rows)<>7 then raise exception 'Existing metric rows changed';end if;
        if (select count(*) from jsonb_array_elements(rows) p where p->>'image_url' is not null)<>2 then raise exception 'Unsafe/excluded/cutoff image escaped';end if;
        if not exists(select 1 from jsonb_array_elements(rows) p where p->>'image_url'='https://scontent.fbcdn.net/pacific-boundary.jpg') then raise exception 'Pacific final second lost';end if;
        if exists(select 1 from jsonb_array_elements(rows) p where (p->>'engagements')::int<>95 or p->>'impressions' is not null) then raise exception 'Metric truth changed';end if;
        if rows::text like '%PRIVATE%' or rows::text like '%report_id%' then raise exception 'Private source leaked';end if;
        begin perform * from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000002');raise exception 'Cross-client accepted';exception when insufficient_privilege then null;end;
        begin perform * from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000003');raise exception 'Draft accepted';exception when insufficient_privilege then null;end;
        begin perform * from public.posts;raise exception 'Base table accepted';exception when insufficient_privilege then null;end;
      end$$;
      select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      do $$begin begin perform * from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000001');raise exception 'Inactive accepted';exception when insufficient_privilege then null;end;end$$;
      select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
      do $$begin begin perform * from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000001');raise exception 'Staff accepted';exception when insufficient_privilege then null;end;end$$;
      reset role;set role anon;
      do $$begin begin perform * from client_published_report_posts('aaaaaaaa-0000-4000-8000-000000000001');raise exception 'Anonymous accepted';exception when insufficient_privilege then null;end;end$$;
      reset role;select 'POST MEDIA ACCEPTANCE PASS';`
    const result=docker(['exec','-i',id,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1'],setup+migration+acceptance)
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr)
    assert.match(result.stdout,/POST MEDIA ACCEPTANCE PASS/)
  } finally {
    const removed=docker(['rm','--force',id]);assert.equal(removed.status,0,removed.stderr)
  }
})
