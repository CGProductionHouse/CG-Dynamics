-- MCP staff-Project writes under the service-role connection — LOCAL-ONLY database acceptance.
--
-- NEVER run this against production. It inserts synthetic auth users, profiles and tasks. Run it
-- only on a throwaway database built from this repo:
--
--   scripts/local-db-acceptance.sh tests/sql/mcp_staff_write_actor_acceptance.sql
--
-- which starts a disposable Supabase Postgres container, applies schema.sql -> phase-*.sql ->
-- supabase/migrations/*.sql, then runs this file. Every check raises on failure; the run ends
-- with "ALL MCP STAFF-WRITE ACCEPTANCE CHECKS PASSED". Ids are synthetic.
--
-- The CG Dynamics MCP calls these RPCs with the service role and no end-user JWT subject, so
-- auth.uid() is NULL there. Sections 1-7 call them exactly that way; section 8 proves the
-- signed-in app path is unchanged and cannot borrow another person's identity.

\set ON_ERROR_STOP on
set search_path = public, extensions;
set client_min_messages = notice;

-- ── Synthetic fixtures ──────────────────────────────────────────────────────
-- 1b2c… CG Company Admin (admin)          2c3d… Sydney Oosthuizen (active staff)
-- 3d4e… Sydney Nel (inactive staff)        4e5f… Franco Lessing (active staff, not a manager)
insert into auth.users (id) values
  ('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63'),
  ('2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74'),
  ('3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85'),
  ('4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, is_active) values
  ('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', 'CG Company Admin', 'admin', true),
  ('2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'Sydney Oosthuizen', 'staff', true),
  ('3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85', 'Sydney Nel', 'staff', false),
  ('4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96', 'Franco Lessing', 'staff', true)
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role, is_active = excluded.is_active;

create temp table acc (name text primary key, id uuid not null);

-- ── Helpers ─────────────────────────────────────────────────────────────────
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
end $$;

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  perform set_config('request.jwt.claim.sub', p_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;

-- Runs p_sql and requires it to fail with a message LIKE p_like. The failed call is rolled back.
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then
      raise exception 'expected an error like "%" but got "%" from: %', p_like, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'expected an error like "%" but the call succeeded: %', p_like, p_sql;
end $$;

create function pg_temp.acc(p_name text) returns uuid language sql as $$
  select id from acc where name = p_name
$$;

-- ── 0. Signatures and grants ────────────────────────────────────────────────
do $$
declare
  r record;
  v_new text;
begin
  for r in select * from (values
    ('create_assistant_task', 'text,text,date,uuid,text,text'),
    ('update_assistant_task', 'uuid,text,text,date,text'),
    ('update_planner_task_status', 'uuid,text'),
    ('create_assistant_recurring_task', 'text,text,date,text,uuid,text,text'),
    ('save_my_staff_assistant_profile', 'text[],text[],text[],text[],text[],text[],text[],text,text,text,boolean')
  ) as t(fn, args) loop
    v_new := format('public.%s(%s,uuid)', r.fn, r.args);
    if to_regprocedure(format('public.%s(%s)', r.fn, r.args)) is not null then
      raise exception 'CHECK 0: the old signature of % still exists', r.fn;
    end if;
    if to_regprocedure(v_new) is null then raise exception 'CHECK 0: % is missing', v_new; end if;
    if not has_function_privilege('authenticated', v_new, 'execute') then
      raise exception 'CHECK 0: the app (authenticated) lost access to %', r.fn;
    end if;
    if not has_function_privilege('service_role', v_new, 'execute') then
      raise exception 'CHECK 0: the MCP (service_role) cannot call %', r.fn;
    end if;
    if has_function_privilege('anon', v_new, 'execute') then
      raise exception 'CHECK 0: anon can call %', r.fn;
    end if;
  end loop;
  raise notice 'PASS 0: five RPCs re-signed with p_actor_profile_id; app and MCP can call them, anon cannot';
end $$;

-- ── 1. MCP path: a staff member creates a task for themselves ───────────────
select pg_temp.as_service();

do $$
declare
  v_franco constant uuid := '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96';
  v_task public.planner_tasks;
begin
  select * into v_task from public.create_assistant_task(
    p_title => 'Edit the Garage Talks cut', p_assignee_name => 'Franco Lessing',
    p_due_date => date '2026-09-15', p_actor_profile_id => v_franco);
  if v_task.id is null then raise exception 'CHECK 1: no task returned'; end if;
  if v_task.status <> 'to_do' or v_task.source <> 'cg_assistant' then
    raise exception 'CHECK 1: unexpected status/source % / %', v_task.status, v_task.source;
  end if;
  if not exists (select 1 from public.planner_boards b where b.id = v_task.board_id and b.slug = 'operations-todo') then
    raise exception 'CHECK 1: task is not on the Operations board';
  end if;
  if (select array_agg(a.profile_id order by a.position) from public.planner_task_assignees a where a.task_id = v_task.id)
     is distinct from array[v_franco] then
    raise exception 'CHECK 1: canonical assignee is not exactly Franco';
  end if;
  if not exists (select 1 from public.planner_activity_log l
                 where l.entity_id = v_task.id and l.action = 'assistant_created' and l.actor_user_id = v_franco) then
    raise exception 'CHECK 1: activity log does not name Franco as the actor';
  end if;
  insert into acc values ('franco_task', v_task.id);
  raise notice 'PASS 1: MCP create_task for Franco created task % on Operations, assigned to Franco, audited as Franco', v_task.id;
end $$;

-- ── 2. MCP path refusals leave nothing behind ───────────────────────────────
do $$
declare
  v_before bigint := (select count(*) from public.planner_tasks);
begin
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'No actor')$q$,
    '%Active staff access required%');
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'Inactive actor',
    p_actor_profile_id => '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85')$q$, '%Active staff access required%');
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'Staff assigning someone else',
    p_assignee_name => 'Sydney Oosthuizen', p_actor_profile_id => '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96')$q$,
    '%Only a manager can assign Planner tasks to someone else%');
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'Inactive assignee',
    p_assignee_name => 'Sydney Nel', p_actor_profile_id => '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63')$q$,
    '%Assignee must match one active workforce profile%');
  if (select count(*) from public.planner_tasks) <> v_before then
    raise exception 'CHECK 2: a refused call left a task behind';
  end if;
  raise notice 'PASS 2: no actor, inactive actor, staff assigning someone else and inactive assignee all refused; nothing left behind';
end $$;

-- ── 3. MCP path: a manager assigns work to someone else ─────────────────────
do $$
declare
  v_admin constant uuid := '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63';
  v_sydney constant uuid := '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74';
  v_task public.planner_tasks;
begin
  select * into v_task from public.create_assistant_task(
    p_title => 'Send We Ar Fuels the October reel options', p_assignee_name => 'Sydney Oosthuizen',
    p_actor_profile_id => v_admin);
  if (select array_agg(a.profile_id) from public.planner_task_assignees a where a.task_id = v_task.id)
     is distinct from array[v_sydney] then
    raise exception 'CHECK 3: canonical assignee is not exactly Sydney Oosthuizen';
  end if;
  if not exists (select 1 from public.notifications n
                 where n.user_id = v_sydney and n.entity_id = v_task.id and n.type = 'task_assigned') then
    raise exception 'CHECK 3: Sydney was not notified';
  end if;
  insert into acc values ('sydney_task', v_task.id);
  raise notice 'PASS 3: MCP create_task by the admin assigned task % to Sydney Oosthuizen and notified her', v_task.id;
end $$;

-- ── 4. MCP path: update_task (comment / complete / block) as the exact actor ─
do $$
declare
  v_admin constant uuid := '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63';
  v_sydney constant uuid := '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74';
  v_franco constant uuid := '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96';
  v_franco_task uuid := pg_temp.acc('franco_task');
  v_sydney_task uuid := pg_temp.acc('sydney_task');
  v_task public.planner_tasks;
begin
  select * into v_task from public.update_assistant_task(
    p_task_id => v_franco_task, p_action => 'comment', p_comment => 'First cut uploaded', p_actor_profile_id => v_franco);
  if v_task.notes not like '%Franco Lessing: First cut uploaded%' then
    raise exception 'CHECK 4: comment was not attributed to Franco';
  end if;

  select * into v_task from public.update_assistant_task(
    p_task_id => v_franco_task, p_action => 'complete', p_actor_profile_id => v_franco);
  if v_task.status <> 'done' then raise exception 'CHECK 4: complete left status %', v_task.status; end if;
  if not exists (select 1 from public.planner_activity_log l
                 where l.entity_id = v_franco_task and l.action = 'status_changed' and l.actor_user_id = v_franco) then
    raise exception 'CHECK 4: the status change was not audited as Franco';
  end if;

  perform pg_temp.expect_error(format($q$select public.update_assistant_task(p_task_id => %L, p_action => 'complete',
    p_actor_profile_id => %L)$q$, v_sydney_task, v_franco), '%Only a manager or canonical assignee can update this task%');
  perform pg_temp.expect_error(format($q$select public.update_assistant_task(p_task_id => %L, p_action => 'due',
    p_due_date => date '2026-09-30', p_actor_profile_id => %L)$q$, v_franco_task, v_franco),
    '%Only a manager can assign or reschedule Planner tasks%');
  perform pg_temp.expect_error(format($q$select public.update_assistant_task(p_task_id => %L, p_action => 'comment',
    p_comment => 'no actor')$q$, v_franco_task), '%Active staff access required%');

  -- A manager may block someone else's task; the status helper sees the manager, not NULL.
  select * into v_task from public.update_assistant_task(
    p_task_id => v_sydney_task, p_action => 'block', p_comment => 'Waiting on client footage', p_actor_profile_id => v_admin);
  if v_task.status <> 'blocked' or v_task.notes not like '%[BLOCKED] Waiting on client footage%' then
    raise exception 'CHECK 4: manager block did not apply (status %)', v_task.status;
  end if;

  -- The canonical assignee completes her own task.
  select * into v_task from public.update_assistant_task(
    p_task_id => v_sydney_task, p_action => 'complete', p_actor_profile_id => v_sydney);
  if v_task.status <> 'done' then raise exception 'CHECK 4: Sydney could not complete her task'; end if;
  raise notice 'PASS 4: MCP update_task comment/complete/block act as the exact actor; non-assignee, staff reschedule and no-actor refused';
end $$;

-- ── 5. MCP path: the status helper keeps its assignee rule ──────────────────
do $$
begin
  perform pg_temp.expect_error(format($q$select public.update_planner_task_status(%L, 'in_progress', %L)$q$,
    pg_temp.acc('sydney_task'), '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96'), '%Planner task is not assigned to this user%');
  perform pg_temp.expect_error(format($q$select public.update_planner_task_status(%L, 'in_progress')$q$,
    pg_temp.acc('sydney_task')), '%Staff access required%');
  raise notice 'PASS 5: update_planner_task_status refuses a non-assignee actor and a missing actor';
end $$;

-- ── 6. MCP path: recurring templates are valid and materialise with their assignee ─
do $$
declare
  v_admin constant uuid := '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63';
  v_sydney constant uuid := '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74';
  v_franco constant uuid := '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96';
  v_template public.planner_tasks;
  v_instance uuid;
begin
  select * into v_template from public.create_assistant_recurring_task(
    p_title => 'Weekly footage backup', p_recurrence_rule => 'FREQ=WEEKLY;BYDAY=FR', p_actor_profile_id => v_franco);
  if v_template.import_hash not like 'rec-template-%' or v_template.status <> 'to_do'
     or v_template.source <> 'recurring' or v_template.recurrence_rule <> 'FREQ=WEEKLY;BYDAY=FR' then
    raise exception 'CHECK 6: invalid template (hash %, status %, source %)', v_template.import_hash, v_template.status, v_template.source;
  end if;
  if v_template.bucket_id is null
     or not exists (select 1 from public.planner_boards b where b.id = v_template.board_id and b.slug = 'operations-todo') then
    raise exception 'CHECK 6: template is not placed on the Operations board';
  end if;
  if (select array_agg(a.profile_id) from public.planner_task_assignees a where a.task_id = v_template.id)
     is distinct from array[v_franco] then
    raise exception 'CHECK 6: template is not assigned to its creator by default';
  end if;

  perform pg_temp.expect_error($q$select public.create_assistant_recurring_task(p_title => 'Staff assigning someone else',
    p_recurrence_rule => 'FREQ=WEEKLY', p_assignee_name => 'Sydney Oosthuizen',
    p_actor_profile_id => '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96')$q$, '%Only a manager can assign Planner tasks to someone else%');
  perform pg_temp.expect_error($q$select public.create_assistant_recurring_task(p_title => 'No actor',
    p_recurrence_rule => 'FREQ=WEEKLY')$q$, '%Active staff profile required%');

  select * into v_template from public.create_assistant_recurring_task(
    p_title => 'Monthly We Ar Fuels report', p_recurrence_rule => 'FREQ=MONTHLY;BYMONTHDAY=1',
    p_assignee_name => 'Sydney Oosthuizen', p_actor_profile_id => v_admin);

  -- The app's materialiser (src/lib/recurrence.ts) copies the template's board, bucket and
  -- assignee name onto each instance and keys it rec-<template>-<date>. It runs in the
  -- signed-in session, and inherit_recurring_planner_task_assignments only lets an active
  -- planner manager's session create instances, so it runs here as the signed-in admin.
  perform pg_temp.as_user(v_admin);
  insert into public.planner_tasks (
    board_id, bucket_id, title, client_id, client_name, assigned_to_name, priority, notes, due_date,
    status, source, import_hash, recurrence_parent_id
  ) values (
    v_template.board_id, v_template.bucket_id, v_template.title, v_template.client_id, v_template.client_name,
    v_template.assigned_to_name, v_template.priority, v_template.notes, date '2026-10-01',
    'to_do', 'recurring', 'rec-' || v_template.id || '-2026-10-01', v_template.id
  ) returning id into v_instance;
  perform pg_temp.as_service();
  if (select array_agg(a.profile_id) from public.planner_task_assignees a where a.task_id = v_instance)
     is distinct from array[v_sydney] then
    raise exception 'CHECK 6: the materialised instance did not inherit Sydney as its assignee';
  end if;
  raise notice 'PASS 6: MCP create_recurring_task makes a valid Operations template; instance % inherits its exact assignee', v_instance;
end $$;

-- ── 7. MCP path: update_my_preferences writes the actor's own profile ───────
do $$
declare
  v_franco constant uuid := '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96';
  v_row public.staff_assistant_profiles;
begin
  select * into v_row from public.save_my_staff_assistant_profile(
    p_responsibilities => array['Edit client reels'], p_actor_profile_id => v_franco);
  if v_row.profile_id is distinct from v_franco or v_row.responsibilities <> array['Edit client reels'] then
    raise exception 'CHECK 7: preferences were not saved to Franco''s profile';
  end if;
  perform pg_temp.expect_error($q$select public.save_my_staff_assistant_profile(p_responsibilities => array['x'])$q$,
    '%Active staff profile required%');
  raise notice 'PASS 7: MCP update_my_preferences saved Franco''s own profile; no actor refused';
end $$;

-- ── 8. Signed-in app path: unchanged, and p_actor_profile_id is ignored ─────
do $$
declare
  v_admin constant uuid := '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63';
  v_sydney constant uuid := '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74';
  v_franco constant uuid := '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96';
  v_task public.planner_tasks;
  v_row public.staff_assistant_profiles;
begin
  perform pg_temp.as_user(v_franco);

  -- Naming the admin as the actor does not make Franco a manager.
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'Spoofed manager',
    p_assignee_name => 'Sydney Oosthuizen', p_actor_profile_id => '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63')$q$,
    '%Only a manager can assign Planner tasks to someone else%');

  select * into v_task from public.create_assistant_task(p_title => 'Signed-in own task', p_actor_profile_id => v_admin);
  if not exists (select 1 from public.planner_activity_log l
                 where l.entity_id = v_task.id and l.action = 'assistant_created' and l.actor_user_id = v_franco) then
    raise exception 'CHECK 8: a signed-in create was audited as someone other than the signed-in user';
  end if;

  select * into v_row from public.save_my_staff_assistant_profile(
    p_responsibilities => array['spoof attempt'], p_actor_profile_id => v_sydney);
  if v_row.profile_id is distinct from v_franco then
    raise exception 'CHECK 8: a signed-in user wrote another person''s preferences';
  end if;
  if exists (select 1 from public.staff_assistant_profiles p where p.profile_id = v_sydney) then
    raise exception 'CHECK 8: Sydney''s preferences were created by someone else';
  end if;

  perform pg_temp.expect_error(format($q$select public.update_planner_task_status(%L, 'in_progress', %L)$q$,
    pg_temp.acc('sydney_task'), v_admin), '%Planner task is not assigned to this user%');
  perform pg_temp.expect_error(format($q$select public.update_assistant_task(p_task_id => %L, p_action => 'comment',
    p_comment => 'spoof', p_actor_profile_id => %L)$q$, pg_temp.acc('sydney_task'), v_admin),
    '%Only a manager or canonical assignee can update this task%');

  -- An inactive signed-in user stays refused whoever they name.
  perform pg_temp.as_user('3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85');
  perform pg_temp.expect_error($q$select public.create_assistant_task(p_title => 'Inactive user',
    p_actor_profile_id => '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63')$q$, '%Active staff access required%');

  -- The app's existing two-argument status call still resolves and works for the assignee.
  perform pg_temp.as_user(v_sydney);
  select * into v_task from public.update_planner_task_status(pg_temp.acc('sydney_task'), 'in_progress');
  if v_task.status <> 'in_progress' then raise exception 'CHECK 8: the signed-in assignee could not change status'; end if;

  -- Recurring templates now work from the app too (they failed on the NOT NULL import_hash).
  select * into v_task from public.create_assistant_recurring_task(p_title => 'Signed-in recurring', p_recurrence_rule => 'FREQ=DAILY');
  if (select array_agg(a.profile_id) from public.planner_task_assignees a where a.task_id = v_task.id)
     is distinct from array[v_sydney] then
    raise exception 'CHECK 8: signed-in recurring template not assigned to its creator';
  end if;

  perform pg_temp.as_service();
  raise notice 'PASS 8: signed-in path unchanged; a supplied p_actor_profile_id is ignored for users (no manager, preference or status spoofing)';
end $$;

do $$ begin raise notice 'ALL MCP STAFF-WRITE ACCEPTANCE CHECKS PASSED'; end $$;
