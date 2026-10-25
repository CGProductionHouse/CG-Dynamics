-- REVIEW PACKET ONLY: catalog reads; no task rows, RPC invocation or mutations.
-- Execute only in a separately authorised environment, before and after release.
-- Missing objects are evidence gaps, NEVER an implicit pass.
with expected(signature) as (values
  ('auth.uid()'),
  ('public.is_admin()'),
  ('public.is_manager()'),
  ('public.is_active_planner_manager()'),
  ('public.set_planner_task_assignees_internal(uuid,uuid[],uuid,boolean,text)'),
  ('public.update_planner_task_with_assignees(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[])'),
  ('public.update_planner_task_with_assignees_guarded(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamp with time zone)')
)
select e.signature, p.oid is not null as present, p.prosecdef as security_definer,
  p.proconfig as function_settings, pg_get_userbyid(p.proowner) as owner,
  case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end as definition_md5,
  p.proacl::text as explicit_acl,
  case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute,
  case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_execute,
  case when p.oid is not null then has_function_privilege('service_role',p.oid,'EXECUTE') end as service_execute
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
order by e.signature;

-- Compare exact types/nullability with the reviewed schema. No content returned.
select table_name,column_name,data_type,udt_name,is_nullable
from information_schema.columns
where table_schema='public' and table_name in (
  'planner_tasks','planner_boards','planner_buckets','planner_task_assignees',
  'planner_activity_log','profiles','clients'
)
order by table_name,ordinal_position;

-- Inspect enabled trigger + actual function, not a name-based assertion.
-- Task revision MUST advance on BOTH core and assignment-only updates.
select c.relname as table_name,t.tgname,t.tgenabled,
  pg_get_triggerdef(t.oid) as trigger_definition,
  pg_get_functiondef(t.tgfoid) as trigger_function_definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('planner_tasks','planner_task_assignees')
  and not t.tgisinternal
order by c.relname,t.tgname;

-- PL/pgSQL bodies need manual call-site review as catalog dependencies do not
-- track every runtime body reference. Never DROP CASCADE based on this output.
select d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid) as dependent
from pg_depend d
where d.refobjid=to_regprocedure('public.update_planner_task_with_assignees_guarded(uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamp with time zone)')
order by dependent;
