// Isolated actual PostgreSQL acceptance. Uses an ALREADY CACHED image only,
// --pull=never, --network=none, no port, no production configuration or secrets.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const name=`cg-picasso-qa-${randomUUID().slice(0,8)}`
const docker=(args,input)=>{
  const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:60_000})
  if(r.status!==0)throw new Error(`Isolated Docker step failed: ${r.stderr || r.stdout || r.error}`)
  return r.stdout
}
const setup=`
create role authenticated nologin; create role anon nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('fixture.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table public.clients(id uuid primary key);
create table public.profiles(id uuid primary key);
create function public.is_manager() returns boolean language sql stable as $$ select current_setting('fixture.role',true) in ('admin','manager') $$;
create function public.is_active_content_staff() returns boolean language sql stable as $$ select current_setting('fixture.role',true) in ('admin','manager','staff','team') $$;
insert into clients values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into profiles values ('33333333-3333-4333-8333-333333333333');
`
const acceptance=`
select set_config('fixture.uid','33333333-3333-4333-8333-333333333333',false);
select set_config('fixture.role','manager',false); set role authenticated;
insert into client_brand_profiles(client_id) values ('11111111-1111-4111-8111-111111111111');
update client_brand_profiles set design_pack='{"schemaVersion":1,"clientId":"11111111-1111-4111-8111-111111111111","status":"draft","scopes":[]}'::jsonb;
do $$ begin
 if (select count(*) from client_brand_profiles where design_pack is not null)<>1 then raise exception 'Manager write failed'; end if;
 begin
  update client_brand_profiles set design_pack=jsonb_set(design_pack,'{clientId}','"22222222-2222-4222-8222-222222222222"');
  raise exception 'Foreign client pack accepted';
 exception when check_violation then null; end;
 begin
  update client_brand_profiles set design_pack=design_pack-'status';
  raise exception 'Missing pack status accepted';
 exception when check_violation then null; end;
end $$;
select set_config('fixture.role','staff',false);
do $$ declare n int; begin
 if (select count(*) from client_brand_profiles)<>1 then raise exception 'Staff read failed'; end if;
 update client_brand_profiles set design_pack=null; get diagnostics n=row_count;
 if n<>0 then raise exception 'Staff changed pack'; end if;
 begin
  insert into client_brand_profiles(client_id) values ('22222222-2222-4222-8222-222222222222');
  raise exception 'Staff inserted pack';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('fixture.role','client',false);
do $$ declare n int; begin
 if (select count(*) from client_brand_profiles)<>0 then raise exception 'Client read leaked staff pack'; end if;
 update client_brand_profiles set design_pack=null; get diagnostics n=row_count;
 if n<>0 then raise exception 'Client changed pack'; end if;
end $$;
reset role; set role anon;
do $$ begin
 begin perform * from client_brand_profiles; raise exception 'Anon read leaked';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.client_brand_profiles'::regclass) then raise exception 'RLS disabled'; end if;
 if (select design_pack->>'clientId' from client_brand_profiles)<>'11111111-1111-4111-8111-111111111111' then raise exception 'Original pack corrupted'; end if;
end $$;
select 'PASS manager-write, staff-read/no-write, client-no-read/no-write, anon-denied, exact-client and missing-field constraints; existing RLS retained' as acceptance;
`
let started=false
try {
  docker(['image','inspect','postgres:17-alpine'])
  docker(['run','--detach','--pull=never','--network=none','--name',name,'--env','POSTGRES_HOST_AUTH_METHOD=trust','--tmpfs','/var/lib/postgresql/data','postgres:17-alpine']);started=true
  let ready=false
  for(let i=0;i<45;i++) {
    const r=spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{encoding:'utf8',windowsHide:true,timeout:5000})
    if(r.status===0){ready=true;break}
    await new Promise(r=>setTimeout(r,1000))
  }
  assert.ok(ready,'Owned isolated PostgreSQL started')
  const sql=setup+readFileSync('supabase/migrations/20261111064719_client_brand_profiles_and_rules.sql','utf8')+readFileSync('supabase/migrations/20261125073157_picasso_design_pack.sql','utf8')+acceptance
  console.log(docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],sql))
} finally {if(started)docker(['rm','--force',name])}
