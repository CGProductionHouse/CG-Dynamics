create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table profiles(id uuid primary key,full_name text,role text,is_active boolean);
create function public.is_admin() returns boolean language sql stable as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function public.is_manager() returns boolean language sql stable as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('admin','manager')) $$;
create table planner_boards(id uuid primary key,visibility text,archived_at timestamptz);
create table planner_buckets(id uuid primary key,board_id uuid,archived_at timestamptz);
create table clients(id uuid primary key);
create table planner_tasks(
  id uuid primary key,board_id uuid,bucket_id uuid,title text,client_id uuid,client_name text,status text,
  priority text,start_date date,due_date date,notes text,checklist jsonb,
  updated_at timestamptz,archived_at timestamptz,superseded_by_task_id uuid,microsoft_source_removed_at timestamptz,
  assigned_to_name text,helper_names text[],unresolved_assignee_names text[]
);
create table planner_activity_log(entity_type text,entity_id uuid,action text,actor_user_id uuid,actor_name text,metadata jsonb);
create table planner_task_assignees(task_id uuid,profile_id uuid,position integer,assigned_by uuid);
-- Actual assignment helper and baseline revision trigger are loaded by the test.
-- This is still a minimal schema, not full production RLS/trigger certification.
