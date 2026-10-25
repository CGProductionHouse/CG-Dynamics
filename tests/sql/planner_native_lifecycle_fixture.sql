-- DISPOSABLE LOCAL POSTGRES ONLY. Not a production schema or migration.
-- Minimal tables for executing the actual existing status/assistant RPC bodies.
-- Assignment mutation is deliberately outside this fixture, never simulated as passed.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role',true)
$$;
create table public.profiles(id uuid primary key, full_name text, role text, is_active boolean);
create table public.planner_boards(id uuid primary key, visibility text, archived_at timestamptz);
create table public.planner_tasks(
  id uuid primary key, board_id uuid references public.planner_boards(id), title text,
  status text not null, archived_at timestamptz, superseded_by_task_id uuid,
  microsoft_source_removed_at timestamptz, assigned_to_name text, helper_names text[],
  due_date date, notes text
);
create table public.planner_task_assignees(task_id uuid references public.planner_tasks(id),profile_id uuid references public.profiles(id));
create table public.planner_activity_log(entity_type text,entity_id uuid,action text,actor_user_id uuid references public.profiles(id),actor_name text,metadata jsonb);
create table public.notifications(user_id uuid,type text,title text,body text,entity_type text,entity_id uuid);
create function public.set_planner_task_assignees_internal(uuid,uuid[],uuid,boolean,text)
returns boolean language plpgsql as $$ begin raise exception 'Assignment mutation outside fixture scope'; end $$;
