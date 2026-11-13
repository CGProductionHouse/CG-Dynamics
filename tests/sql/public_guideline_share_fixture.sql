-- Local, synthetic PostgreSQL only. No production source or credentials.
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth,extensions to anon,authenticated,service_role;
grant execute on function auth.uid() to authenticated;
grant execute on function extensions.gen_random_bytes(integer) to service_role;
create table public.profiles(id uuid primary key,role text,is_active boolean);
create table public.clients(id uuid primary key,name text,active boolean);
create table public.content_runs(id uuid primary key,client_id uuid,name text,run_date date);
create table public.content_guidelines(id uuid primary key,client_id uuid,content_run_id uuid unique,title text,month date,status text,client_published_at timestamptz);
create table public.content_guide_ideas(id uuid primary key,content_guideline_id uuid,client_id uuid,position integer,title text,script text,objective text,hook text,shot_breakdown text,cta text,visual_notes text,platform text,format text,status text,created_at timestamptz default now(),internal_notes text,editor_name text);
grant select,insert,update on all tables in schema public to service_role;
insert into profiles values('10000000-0000-4000-8000-000000000001','team',true),('10000000-0000-4000-8000-000000000002','client',true),('10000000-0000-4000-8000-000000000003','admin',false);
insert into clients values('20000000-0000-4000-8000-000000000001','Germoparts',true),('20000000-0000-4000-8000-000000000002','Other Client',true);
insert into content_runs values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','November content','2026-11-10'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Other run','2026-11-11');
insert into content_guidelines values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Germoparts November','2026-11-01','draft',null),('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Other document','2026-11-01','draft',null);
insert into content_guide_ideas(id,content_guideline_id,client_id,position,title,script,status,internal_notes,editor_name) values('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'Exact saved video','KEEP exact full script — Scene 1 and Scene 2.','idea','INTERNAL PRIVATE NOTE','PRIVATE EDITOR');
