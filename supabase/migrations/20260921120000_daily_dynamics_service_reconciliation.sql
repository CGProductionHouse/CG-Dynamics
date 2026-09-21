-- #451 protected activation migration.
-- Allows the existing SECURITY DEFINER Microsoft apply contract to be used by
-- the scheduled Edge worker's service-role client. It does not grant any new
-- authenticated-user permission; service_role already owns trusted server-side
-- database access and remains unavailable to browsers.
--
-- DO NOT APPLY IN PRODUCTION WITHOUT CA APPROVAL AT THE #451 ACTIVATION GATE.

create or replace function public.is_admin()
returns boolean
language sql
security definer stable
set search_path = public, pg_temp
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function public.is_admin() is
  'Admin predicate for authenticated admins and trusted service-role jobs. #451 permits the scheduled Microsoft reconciliation to reuse the existing apply RPC.';
