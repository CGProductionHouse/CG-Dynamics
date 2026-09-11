-- #341 client-Project operational writes — LOCAL-ONLY database acceptance.
--
-- NEVER run this against production. It inserts synthetic auth users, profiles, clients,
-- deliverables and tasks. Run it only on a throwaway database built from this repo:
--
--   scripts/local-db-acceptance.sh
--
-- which starts a disposable Supabase Postgres container, applies schema.sql -> phase-*.sql ->
-- supabase/migrations/*.sql, then runs this file. Every check raises on failure; the run ends
-- with "ALL #341 ACCEPTANCE CHECKS PASSED".
--
-- The We Ar Fuels / Sydney meeting from #341 is the scenario. Ids are synthetic.

\set ON_ERROR_STOP on
set search_path = public, extensions;
set client_min_messages = notice;

-- ── Synthetic fixtures ──────────────────────────────────────────────────────
-- 1b2c… connection principal (the communal admin account)
-- 2c3d… Sydney Oosthuizen (active staff)   3d4e… Sydney Nel (inactive)
-- 4e5f… Franco Lessing (active staff, not a manager)
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

insert into public.clients (id, name, active) values
  ('6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'We Ar Fuels (synthetic)', true),
  ('7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52', 'Red Oak (synthetic)', true),
  ('8b3c4d5e-6f70-4a81-9c9d-0e1f2a3b4c63', 'Dormant Client (synthetic)', false)
on conflict (id) do update set name = excluded.name, active = excluded.active;

insert into public.monthly_deliverables (id, client_id, month, code, instance_number, title) values
  ('9c4d5e6f-7081-4b92-8d0e-1f2a3b4c5d74', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', '2026-10-01', 'REEL', 1, 'We Ar Fuels October reel'),
  ('0d5e6f70-8192-4ca3-9e1f-2a3b4c5d6e85', '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52', '2026-10-01', 'REEL', 1, 'Red Oak October reel')
on conflict (id) do nothing;

insert into public.company_calendar_events (id, title, start_at, client_id) values
  ('1e6f7081-92a3-4db4-8f2a-3b4c5d6e7f96', 'We Ar Fuels content meeting', '2026-09-11T08:00:00Z', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41')
on conflict (id) do nothing;

-- Every call below is made the way the CG Dynamics MCP makes it: with the service role and no
-- end-user JWT subject. (Section 7 switches to signed-in users on purpose.)
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
select set_config('request.jwt.claim.role', 'service_role', false);

create temp table acceptance_snapshot as
select
  (select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.monthly_deliverables t) as deliverables_md5,
  (select count(*) from public.client_guides) as client_guides_count;

-- ── 1. The three Sydney follow-ups from the We Ar Fuels meeting ─────────────
do $$
declare
  v_titles text[] := array[
    'Garage Talks: reusable interview-question script and the first CG interview script',
    'Research the best use of the R6,000 boosting budget',
    'Script the large-client farm video around El Niño, drought and peace of mind'];
  v_ids uuid[] := '{}';
  v_result jsonb;
begin
  for i in 1..3 loop
    v_result := public.record_client_workspace_task(
      '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', v_titles[i], null, null,
      '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', ('00000000-0000-4000-8000-00000000000' || i)::uuid,
      null, null, null, null, jsonb_build_object('source', 'chatgpt_client_project', 'tool', 'create_client_followup_task'));
    assert (v_result->>'replayed')::boolean = false, 'a first write must create';
    assert v_result->'assignee'->>'profile_id' = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'assignee returned';
    v_ids := v_ids || (v_result->'task'->>'id')::uuid;
  end loop;

  assert (select count(*) from public.planner_tasks t
          join public.planner_buckets b on b.id = t.bucket_id
          where t.id = any(v_ids) and t.client_id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41'
            and t.source = 'cg_client_workspace' and t.priority = 'normal' and t.due_date is null
            and upper(b.name) = 'CLIENT REQUESTS') = 3, 'three same-client canonical tasks, no invented due date';
  assert (select count(*) from public.planner_task_assignees a
          where a.task_id = any(v_ids) and a.profile_id = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74') = 3, 'all assigned to the exact Sydney';
  assert (select count(*) from public.notifications n
          where n.user_id = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74' and n.entity_id = any(v_ids)) = 3, 'Sydney is notified of each';
  assert (select count(*) from public.planner_activity_log l
          where l.entity_id = any(v_ids) and l.action = 'client_workspace_created'
            and l.actor_user_id = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63'
            and l.metadata->>'connection_principal_user_id' = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63'
            and l.metadata->>'effective_context_kind' = 'client'
            and l.metadata->>'effective_client_id' = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41') = 3,
    'audit records the connection principal (not Sydney) and the effective client';
  raise notice 'PASS 1: three We Ar Fuels follow-ups created and assigned to Sydney %', v_ids;
end $$;

-- ── 2. A retry returns the original record and creates nothing ──────────────
do $$
declare
  v_before int := (select count(*) from public.planner_tasks where source = 'cg_client_workspace');
  v_first uuid := (select id from public.planner_tasks
                   where import_hash = 'cgw-6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41-00000000-0000-4000-8000-000000000001');
  v_result jsonb;
begin
  v_result := public.record_client_workspace_task(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
    '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up',
    'Garage Talks: reusable interview-question script and the first CG interview script', null, null,
    '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000001', null, null, null, null, '{}'::jsonb);
  assert (v_result->>'replayed')::boolean, 'a retry is a replay';
  assert (v_result->'task'->>'id')::uuid = v_first, 'the original task id is returned';
  assert v_result->'assignee'->>'profile_id' = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'the original assignee is returned';
  assert (select count(*) from public.planner_tasks where source = 'cg_client_workspace') = v_before, 'nothing new was created';
  raise notice 'PASS 2: retry returned task % without creating another', v_first;
end $$;

-- ── 3. A client request proposes a Client Schedule change; the schedule is untouched ──
do $$
declare
  v_result jsonb;
  v_change public.client_schedule_change_requests;
begin
  v_result := public.record_client_workspace_task(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
    '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'client_request', 'Move the October reel a week later', 'Client asked in the meeting', null,
    null, '00000000-0000-4000-8000-000000000010', null, null, null,
    jsonb_build_object('deliverable_id', '9c4d5e6f-7081-4b92-8d0e-1f2a3b4c5d74', 'change', jsonb_build_object('scheduled_date', '2026-10-09'), 'reason', 'Client asked'),
    '{}'::jsonb);
  assert (select priority from public.planner_tasks where id = (v_result->'task'->>'id')::uuid) = 'client_request', 'recorded as a client request';
  select * into v_change from public.client_schedule_change_requests where id = (v_result->>'schedule_change_request_id')::uuid;
  assert v_change.status = 'pending', 'a PENDING proposal, never an applied change';
  assert v_change.deliverable_id = '9c4d5e6f-7081-4b92-8d0e-1f2a3b4c5d74';
  assert v_change.requested_by = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63';
  assert (select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.monthly_deliverables t)
         = (select deliverables_md5 from acceptance_snapshot), 'monthly_deliverables is byte-for-byte unchanged';
  raise notice 'PASS 3: client request % proposed schedule change % (pending); Client Schedule untouched', v_result->'task'->>'id', v_change.id;
end $$;

-- ── 3b. A signed-in user still cannot propose on someone else's behalf ───────
-- The trigger fix only widens the service-role path; the user path must be unchanged.
do $$
declare
  v_requested_by uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.client_schedule_change_requests (deliverable_id, requested_by, change)
  values ('9c4d5e6f-7081-4b92-8d0e-1f2a3b4c5d74', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '{"notes": "spoof attempt"}'::jsonb)
  returning requested_by into v_requested_by;
  reset role;
  assert v_requested_by = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'a signed-in user is always recorded as themselves';
  raise notice 'PASS 3b: a signed-in user naming another requester is still recorded as themselves';
end $$;

-- ── 4. Cross-client and invalid writes fail closed and leave nothing behind ──
do $$
declare
  v_tasks int := (select count(*) from public.planner_tasks where source = 'cg_client_workspace');
  procedure_ok boolean;
  v_message text;
begin
  -- A We Ar Fuels request cannot propose a change to Red Oak's schedule.
  begin
    perform public.record_client_workspace_task(
      '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'client_request', 'Sneaky Red Oak change', null, null, null,
      '00000000-0000-4000-8000-000000000020', null, null, null,
      jsonb_build_object('deliverable_id', '0d5e6f70-8192-4ca3-9e1f-2a3b4c5d6e85', 'change', jsonb_build_object('scheduled_date', '2026-10-20')),
      '{}'::jsonb);
    raise exception 'cross-client schedule change was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Cross-client schedule change refused', v_message;
  end;

  -- An inactive, unknown or missing assignee, a non-manager assigner, or an inactive client all fail.
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'For the inactive Sydney', null, null,
      '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85', '00000000-0000-4000-8000-000000000021', null, null, null, null, '{}'::jsonb);
    raise exception 'inactive assignee was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Assignee must be an active CG staff member', v_message;
  end;
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'For nobody', null, null,
      '99999999-9999-4999-8999-999999999999', '00000000-0000-4000-8000-000000000022', null, null, null, null, '{}'::jsonb);
    raise exception 'unknown assignee was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Assignee not found', v_message;
  end;
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'Unassigned follow-up', null, null,
      null, '00000000-0000-4000-8000-000000000023', null, null, null, null, '{}'::jsonb);
    raise exception 'unassigned follow-up was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'A follow-up task needs an exact assignee', v_message;
  end;
  begin
    perform public.record_client_workspace_task('4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96', '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'Franco assigning Sydney', null, null,
      '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000024', null, null, null, null, '{}'::jsonb);
    raise exception 'a non-manager assignment was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Only a manager can assign Planner tasks', v_message;
  end;
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '8b3c4d5e-6f70-4a81-9c9d-0e1f2a3b4c63', 'client_request', 'Dormant client request', null, null,
      null, '00000000-0000-4000-8000-000000000025', null, null, null, null, '{}'::jsonb);
    raise exception 'an inactive client was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Client is not active', v_message;
  end;

  assert (select count(*) from public.planner_tasks where source = 'cg_client_workspace') = v_tasks, 'no failed call left a task behind';
  raise notice 'PASS 4: cross-client schedule change, inactive/unknown/missing assignee, non-manager assigner and inactive client all refused; nothing left behind';
end $$;

-- ── 5. Durable client direction: append-only, same-client links, meeting debrief ──
do $$
declare
  v_links uuid[] := array(select id from public.planner_tasks
                          where client_id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41' and source = 'cg_client_workspace' and priority = 'normal');
  v_red_oak_task uuid;
  v_first jsonb;
  v_replay jsonb;
  v_meeting jsonb;
  v_message text;
begin
  v_first := public.record_client_workspace_update(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41',
    'content_direction', 'Garage Talks interview series',
    'We Ar Fuels wants a recurring Garage Talks interview series, starting with a CG interview. Large-client farm content leans on El Niño and drought: peace of mind.',
    '["Build a reusable interview-question script", "Use the R6,000 boosting budget deliberately"]'::jsonb, '[]'::jsonb,
    v_links, null, '2026-09-11', null, '00000000-0000-4000-8000-000000000030');
  assert (v_first->>'replayed')::boolean = false;
  assert (v_first->'update'->>'review_state') = 'unreviewed';

  v_replay := public.record_client_workspace_update(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41',
    'content_direction', 'Garage Talks interview series', 'retry', '[]'::jsonb, '[]'::jsonb,
    '{}'::uuid[], null, null, null, '00000000-0000-4000-8000-000000000030');
  assert (v_replay->>'replayed')::boolean and v_replay->'update'->>'id' = v_first->'update'->>'id', 'a retry returns the original update';

  -- A Red Oak task can never be linked from a We Ar Fuels update.
  v_red_oak_task := (public.record_client_workspace_task(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52',
    'client_request', 'A Red Oak request', null, null, null, '00000000-0000-4000-8000-000000000031', null, null, null, null, '{}'::jsonb)->'task'->>'id')::uuid;
  begin
    perform public.record_client_workspace_update(
      '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41',
      'client_fact', 'Borrowed link', 'x', '[]'::jsonb, '[]'::jsonb, array[v_red_oak_task], null, null, null, '00000000-0000-4000-8000-000000000032');
    raise exception 'a cross-client task link was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Linked tasks must be existing tasks for this same client', v_message;
  end;

  v_meeting := public.record_client_workspace_update(
    '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41',
    'meeting_outcome', 'We Ar Fuels content meeting — 11 Sep', 'Agreed Garage Talks, boosting research and the farm video.',
    '["Garage Talks first"]'::jsonb, '["Boost budget split"]'::jsonb, v_links, 'We Ar Fuels content meeting', '2026-09-11',
    '1e6f7081-92a3-4db4-8f2a-3b4c5d6e7f96', '00000000-0000-4000-8000-000000000033');
  assert (select count(*) from public.meeting_debriefs d
          where d.id = (v_meeting->>'meeting_debrief_id')::uuid and d.client_id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41'
            and d.status = 'applied' and d.created_by = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63'
            and jsonb_array_length(d.tasks) = 3) = 1, 'a meeting outcome is a canonical same-client meeting debrief';

  -- Append-only: content can never change and rows can never be deleted; review can move.
  begin
    update public.client_context_updates set body = 'rewritten' where id = (v_first->'update'->>'id')::uuid;
    raise exception 'an update body was rewritten';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'client_context_updates is append-only; only review_state may change', v_message;
  end;
  begin
    delete from public.client_context_updates where id = (v_first->'update'->>'id')::uuid;
    raise exception 'an update was deleted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'client_context_updates is append-only', v_message;
  end;
  update public.client_context_updates set review_state = 'incorporated' where id = (v_meeting->'update'->>'id')::uuid;

  assert (select count(*) from public.client_guides) = (select client_guides_count from acceptance_snapshot), 'client_guides untouched';
  raise notice 'PASS 5: Garage Talks direction % recorded append-only, replay-safe, cross-client link refused, meeting debrief %',
    v_first->'update'->>'id', v_meeting->>'meeting_debrief_id';
end $$;

-- ── 6. Fresh retrieval: exactly what get_client_context selects ──────────────
do $$
begin
  assert (select count(*) from public.client_context_updates
          where client_id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41' and review_state <> 'rejected'
            and title = 'Garage Talks interview series') = 1, 'the Garage Talks direction is retrievable for We Ar Fuels';
  assert (select count(*) from public.client_context_updates
          where client_id = '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52') = 0, 'nothing leaks to Red Oak';
  raise notice 'PASS 6: fresh We Ar Fuels context query returns the Garage Talks direction; Red Oak sees none';
end $$;

-- ── 7. Grants and RLS: only the service role writes; only active staff read ──
do $$
declare
  v_message text;
  v_visible int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', true);
  set local role authenticated;
  select count(*) into v_visible from public.client_context_updates;
  assert v_visible >= 2, 'active staff can read recorded updates';
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'client_request', 'Direct call', null, null, null,
      '00000000-0000-4000-8000-000000000040', null, null, null, null, '{}'::jsonb);
    raise exception 'an authenticated user called the RPC directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.client_context_updates (client_id, update_kind, title, body, recorded_by_profile_id, connection_principal_user_id, idempotency_key)
    values ('6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'client_fact', 'x', 'y', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000041');
    raise exception 'an authenticated user inserted directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85', 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85', true);
  set local role authenticated;
  select count(*) into v_visible from public.client_context_updates;
  assert v_visible = 0, 'an inactive profile reads nothing';
  reset role;
  raise notice 'PASS 7: RPCs are service-role only, direct inserts are refused, and only active staff can read';
end $$;

-- ── 8. #325 Microsoft linkage: durable id, one row per Planner task, protected plans refused ──
do $$
declare
  v_linked jsonb;
  v_again jsonb;
  v_message text;
begin
  -- The MCP calls these RPCs with the service role. That is what lets the canonical
  -- protect_microsoft_sync_metadata trigger accept durable Planner ids, so simulate it exactly.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- A mirrored MASTER CLIENT TO DO task marks that Planner plan as protected.
  perform set_config('app.planner_task_audit_write', 'on', true);
  insert into public.planner_tasks (title, import_hash, microsoft_plan_id, microsoft_task_id, original_plan_name)
  values ('Mirrored protected task', 'acceptance-protected-1', 'plan-master-client-to-do', 'ms-task-protected-1', 'MASTER CLIENT TO DO');
  perform set_config('app.planner_task_audit_write', '', true);

  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'Into the protected plan', null, null,
      '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000050',
      'ms-task-new-50', 'plan-master-client-to-do', null, null, '{}'::jsonb);
    raise exception 'a protected plan was accepted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message like 'Protected Microsoft plan%', v_message;
  end;

  v_linked := public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
    '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'Operational follow-up created in Planner first', null, '2026-09-18',
    '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000051',
    'ms-task-51', 'plan-waf-ops', 'bucket-waf-1', null, '{}'::jsonb);
  assert (select microsoft_task_id from public.planner_tasks where id = (v_linked->'task'->>'id')::uuid) = 'ms-task-51', 'linked by durable Planner id';
  assert (select microsoft_last_synced_at from public.planner_tasks where id = (v_linked->'task'->>'id')::uuid) is null, 'Microsoft freshness is not stamped until reconciliation';
  assert (select due_date from public.planner_tasks where id = (v_linked->'task'->>'id')::uuid) = '2026-09-18', 'an explicitly given due date is kept';

  -- The same Planner task is linked once, even under a new idempotency key...
  v_again := public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
    '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41', 'follow_up', 'Operational follow-up created in Planner first', null, null,
    '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000052',
    'ms-task-51', 'plan-waf-ops', null, null, '{}'::jsonb);
  assert (v_again->>'already_linked')::boolean and v_again->'task'->>'id' = v_linked->'task'->>'id', 'no second row for the same Planner task';
  assert (select count(*) from public.planner_tasks where microsoft_task_id = 'ms-task-51') = 1;

  -- ...and never to a different client.
  begin
    perform public.record_client_workspace_task('1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63', '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63',
      '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52', 'follow_up', 'Borrowed Planner task', null, null,
      '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74', '00000000-0000-4000-8000-000000000053',
      'ms-task-51', 'plan-waf-ops', null, null, '{}'::jsonb);
    raise exception 'one Planner task was linked to two clients';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'That Microsoft task is already linked to a different client', v_message;
  end;
  raise notice 'PASS 8: Planner-first follow-up % linked by durable id; no duplicate on retry; protected plan and cross-client link refused', v_linked->'task'->>'id';
end $$;

\echo ALL #341 ACCEPTANCE CHECKS PASSED
