-- Disposable synthetic database ONLY. No production credentials or calls.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,full_name text,role text,is_active boolean);
create table public.clients(id uuid primary key,name text,active boolean);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as
$$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','staff') and is_active) $$;
grant usage on schema auth,public to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
insert into public.profiles values
 ('10000000-0000-4000-8000-000000000001','Actual Admin','admin',true),
 ('10000000-0000-4000-8000-000000000002','Staff','staff',true),
 ('10000000-0000-4000-8000-000000000003','Client','client',true),
 ('10000000-0000-4000-8000-000000000004','Inactive Admin','admin',false);
insert into public.clients values ('20000000-0000-4000-8000-000000000001','Exact A',true),
 ('20000000-0000-4000-8000-000000000002','Exact B',true);
