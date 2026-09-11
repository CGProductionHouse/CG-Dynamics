-- #341 — Client Project operational writes: client requests, assigned follow-ups and durable
-- client-direction updates for an exact client ChatGPT Project.
--
-- Prepared only. Do not apply to production without explicit CA approval.
--
-- Authority model (#319 / #325 / #341), enforced inside these functions as well as in the MCP:
--   * the caller is the communal connection principal (p_actor_profile_id), never the assignee;
--   * the client is the Project's resolved exact client (p_client_id), never free text;
--   * an assignee is the TARGET of a task and gains no permissions from it;
--   * assigning requires the connection principal to hold manager authority, exactly as
--     create_assistant_task already requires.
--
-- Canonical reuse, no second task or knowledge system:
--   * requests and follow-ups are planner_tasks rows on the Operations board, placed exactly as
--     create_assistant_task places client-linked work (CLIENT REQUESTS bucket); a request carries
--     priority 'client_request';
--   * assignment goes through set_planner_task_assignees_internal (the canonical projection);
--   * a Client Schedule change is only ever a PENDING client_schedule_change_requests proposal —
--     monthly_deliverables is never written here;
--   * a meeting outcome is a meeting_debriefs row;
--   * durable client direction is the one new, append-only, exact-client source table below,
--     returned by get_client_context until it is reviewed into the derived client guide.

-- ── Append-only exact-client source for durable client direction ────────────

create table if not exists public.client_context_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  update_kind text not null
    check (update_kind in ('content_direction', 'meeting_outcome', 'client_preference', 'client_fact')),
  title text not null check (length(btrim(title)) between 1 and 240),
  body text not null check (length(btrim(body)) between 1 and 8000),
  decisions jsonb not null default '[]'::jsonb check (jsonb_typeof(decisions) = 'array'),
  unresolved jsonb not null default '[]'::jsonb check (jsonb_typeof(unresolved) = 'array'),
  linked_task_ids uuid[] not null default '{}'::uuid[],
  meeting_debrief_id uuid references public.meeting_debriefs(id) on delete set null,
  source_kind text not null default 'chatgpt_client_project'
    check (source_kind in ('chatgpt_client_project')),
  source_meeting_title text,
  source_meeting_date date,
  source_calendar_event_id uuid references public.company_calendar_events(id) on delete set null,
  recorded_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  connection_principal_user_id uuid not null,
  effective_context_kind text not null default 'client' check (effective_context_kind = 'client'),
  idempotency_key uuid not null,
  review_state text not null default 'unreviewed'
    check (review_state in ('unreviewed', 'incorporated', 'superseded', 'rejected')),
  created_at timestamptz not null default now()
);

comment on table public.client_context_updates is
  'Append-only exact-client intelligence recorded from a client ChatGPT Project (#341). A source record with provenance, never a rewrite of client_guides. Only review_state may change after insert.';

create unique index if not exists client_context_updates_client_key_idx
  on public.client_context_updates (client_id, idempotency_key);
create index if not exists client_context_updates_client_created_idx
  on public.client_context_updates (client_id, created_at desc);

create or replace function public.client_context_updates_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'client_context_updates is append-only';
  end if;
  if (new.id, new.client_id, new.update_kind, new.title, new.body, new.decisions, new.unresolved,
      new.linked_task_ids, new.meeting_debrief_id, new.source_kind, new.source_meeting_title,
      new.source_meeting_date, new.source_calendar_event_id, new.recorded_by_profile_id,
      new.connection_principal_user_id, new.effective_context_kind, new.idempotency_key, new.created_at)
     is distinct from
     (old.id, old.client_id, old.update_kind, old.title, old.body, old.decisions, old.unresolved,
      old.linked_task_ids, old.meeting_debrief_id, old.source_kind, old.source_meeting_title,
      old.source_meeting_date, old.source_calendar_event_id, old.recorded_by_profile_id,
      old.connection_principal_user_id, old.effective_context_kind, old.idempotency_key, old.created_at) then
    raise exception 'client_context_updates is append-only; only review_state may change';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_context_updates_append_only on public.client_context_updates;
create trigger trg_client_context_updates_append_only
  before update or delete on public.client_context_updates
  for each row execute function public.client_context_updates_append_only();

alter table public.client_context_updates enable row level security;

drop policy if exists "client_context_updates: active staff read" on public.client_context_updates;
create policy "client_context_updates: active staff read"
  on public.client_context_updates for select to authenticated
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

revoke insert, update, delete on public.client_context_updates from anon, authenticated;
grant select on public.client_context_updates to authenticated;

-- ── Requests and follow-up tasks ─────────────────────────────────────────────

create or replace function public.record_client_workspace_task(
  p_actor_profile_id uuid,
  p_connection_principal_user_id uuid,
  p_client_id uuid,
  p_kind text,
  p_title text,
  p_notes text default null,
  p_due_date date default null,
  p_assignee_profile_id uuid default null,
  p_idempotency_key uuid default null,
  p_microsoft_task_id text default null,
  p_microsoft_plan_id text default null,
  p_microsoft_bucket_id text default null,
  p_schedule_change jsonb default null,
  p_source_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_client public.clients;
  v_assignee public.profiles;
  v_existing public.planner_tasks;
  v_task public.planner_tasks;
  v_board uuid;
  v_bucket uuid;
  v_hash text;
  v_change_id uuid;
  v_deliverable_client uuid;
  v_previous_audit_guard text;
  v_previous_projection_guard text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = p_actor_profile_id
    and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  if p_connection_principal_user_id is null then raise exception 'Connection principal required for audit'; end if;
  if p_kind is null or p_kind not in ('client_request', 'follow_up') then raise exception 'Unknown client workspace task kind'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key required'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'Task title required'; end if;
  if length(btrim(p_title)) > 240 then raise exception 'Task title too long'; end if;

  select * into v_client from public.clients client where client.id = p_client_id;
  if v_client.id is null then raise exception 'Client not found'; end if;
  if not coalesce(v_client.active, false) then raise exception 'Client is not active'; end if;

  if (p_microsoft_task_id is null) <> (p_microsoft_plan_id is null) then
    raise exception 'A Microsoft-linked task needs both microsoft_task_id and microsoft_plan_id';
  end if;
  if p_kind = 'client_request' and p_microsoft_task_id is not null then
    raise exception 'A client request is recorded in Dynamics only';
  end if;
  if p_kind = 'follow_up' and p_assignee_profile_id is null then
    raise exception 'A follow-up task needs an exact assignee';
  end if;
  if p_schedule_change is not null and p_kind <> 'client_request' then
    raise exception 'A Client Schedule change can only be proposed from a client request';
  end if;

  -- Idempotent replay, serialised per (client, key): a retry returns the original record.
  v_hash := 'cgw-' || p_client_id::text || '-' || p_idempotency_key::text;
  perform pg_advisory_xact_lock(hashtextextended(v_hash, 0));
  select * into v_existing from public.planner_tasks task where task.import_hash = v_hash limit 1;
  if v_existing.id is not null then
    select (log.metadata->>'schedule_change_request_id')::uuid into v_change_id
    from public.planner_activity_log log
    where log.entity_type = 'planner_task'
      and log.entity_id = v_existing.id
      and log.action = 'client_workspace_created'
    limit 1;
    select * into v_assignee from public.profiles profile
    where profile.id = (select (log.metadata->>'assignee_profile_id')::uuid
                        from public.planner_activity_log log
                        where log.entity_type = 'planner_task'
                          and log.entity_id = v_existing.id
                          and log.action = 'client_workspace_created'
                        limit 1);
    return jsonb_build_object(
      'replayed', true,
      'task', to_jsonb(v_existing),
      'assignee', case when v_assignee.id is null then null
                       else jsonb_build_object('profile_id', v_assignee.id, 'full_name', v_assignee.full_name) end,
      'schedule_change_request_id', v_change_id
    );
  end if;

  if p_microsoft_task_id is not null then
    -- One real Planner task is linked once, to one client. Never write a protected plan.
    select * into v_existing from public.planner_tasks task where task.microsoft_task_id = p_microsoft_task_id limit 1;
    if v_existing.id is not null then
      if v_existing.client_id is distinct from p_client_id then
        raise exception 'That Microsoft task is already linked to a different client';
      end if;
      return jsonb_build_object('replayed', true, 'already_linked', true, 'task', to_jsonb(v_existing),
        'assignee', null, 'schedule_change_request_id', null);
    end if;
    if exists (
      select 1 from public.planner_tasks task
      where task.microsoft_plan_id = p_microsoft_plan_id
        and upper(coalesce(task.original_plan_name, '')) ~ '(MASTER CLIENT TO DO|CLIENT SOCIALS)'
    ) then
      raise exception 'Protected Microsoft plan: MASTER CLIENT TO DO and Client Socials are never written from a client Project';
    end if;
  end if;

  if p_assignee_profile_id is not null then
    if v_actor.role not in ('admin', 'manager') then
      raise exception 'Only a manager can assign Planner tasks';
    end if;
    select * into v_assignee from public.profiles profile where profile.id = p_assignee_profile_id;
    if v_assignee.id is null then raise exception 'Assignee not found'; end if;
    if not v_assignee.is_active or v_assignee.role not in ('admin', 'manager', 'staff', 'team') then
      raise exception 'Assignee must be an active CG staff member';
    end if;
  end if;

  select board.id into v_board
  from public.planner_boards board
  where board.slug = 'operations-todo'
    and board.archived_at is null
    and (
      board.visibility in ('public_internal', 'staff')
      or (board.visibility = 'admin_only' and v_actor.role = 'admin')
    )
  limit 1;
  if v_board is null then raise exception 'Planner board not found or not visible'; end if;

  select bucket.id into v_bucket
  from public.planner_buckets bucket
  where bucket.board_id = v_board
    and bucket.archived_at is null
    and upper(bucket.name) = 'CLIENT REQUESTS'
  limit 1;
  if v_bucket is null then
    select bucket.id into v_bucket from public.planner_buckets bucket
    where bucket.board_id = v_board and bucket.archived_at is null
    order by bucket.sort_order, bucket.id limit 1;
  end if;
  if v_bucket is null then raise exception 'Planner board has no active bucket'; end if;

  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  v_previous_projection_guard := current_setting('app.planner_assignment_projection_write', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  insert into public.planner_tasks(
    board_id, bucket_id, title, client_id, client_name, assigned_to_name,
    helper_names, unresolved_assignee_names, due_date, notes, status, priority,
    source, import_hash, checklist, microsoft_task_id, microsoft_plan_id, microsoft_bucket_id
  ) values (
    v_board, v_bucket, btrim(p_title), v_client.id, v_client.name, null,
    '{}'::text[], '{}'::text[], p_due_date, nullif(btrim(coalesce(p_notes, '')), ''), 'to_do',
    case when p_kind = 'client_request' then 'client_request' else 'normal' end,
    'cg_client_workspace', v_hash, '[]'::jsonb, p_microsoft_task_id, p_microsoft_plan_id, p_microsoft_bucket_id
  ) returning * into v_task;
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
  perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_projection_guard, ''), true);

  if v_assignee.id is not null then
    perform public.set_planner_task_assignees_internal(
      v_task.id, array[v_assignee.id], v_actor.id, true, 'client_workspace_create'
    );
  end if;

  if p_schedule_change is not null then
    select deliverable.client_id into v_deliverable_client
    from public.monthly_deliverables deliverable
    where deliverable.id = (p_schedule_change->>'deliverable_id')::uuid;
    if v_deliverable_client is null then raise exception 'Client Schedule deliverable not found'; end if;
    if v_deliverable_client <> p_client_id then
      raise exception 'Cross-client schedule change refused';
    end if;
    if jsonb_typeof(p_schedule_change->'change') is distinct from 'object' then
      raise exception 'schedule_change.change must be an object';
    end if;
    insert into public.client_schedule_change_requests(
      deliverable_id, requested_by, requested_by_name, change, reason, status
    ) values (
      (p_schedule_change->>'deliverable_id')::uuid, v_actor.id, v_actor.full_name,
      p_schedule_change->'change',
      left(concat_ws(' ', nullif(btrim(coalesce(p_schedule_change->>'reason', '')), ''),
        '[client request ' || v_task.id::text || ' recorded from the client Project]'), 2000),
      'pending'
    ) returning id into v_change_id;
  end if;

  select * into v_task from public.planner_tasks task where task.id = v_task.id;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', v_task.id, 'client_workspace_created', v_actor.id, v_actor.full_name,
    jsonb_build_object(
      'kind', p_kind,
      'client_id', v_client.id,
      'assignee_profile_id', v_assignee.id,
      'due_date', p_due_date,
      'idempotency_key', p_idempotency_key,
      'connection_principal_user_id', p_connection_principal_user_id,
      'effective_context_kind', 'client',
      'effective_client_id', v_client.id,
      'microsoft_task_id', p_microsoft_task_id,
      'schedule_change_request_id', v_change_id,
      'source_context', coalesce(p_source_context, '{}'::jsonb)
    ));

  if v_assignee.id is not null and v_assignee.id <> v_actor.id then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
    values (v_assignee.id, 'task_assigned', 'New task assigned',
      coalesce(v_actor.full_name, 'CG Dynamics') || ' assigned you (' || v_client.name || '): ' || v_task.title,
      'planner_task', v_task.id);
  end if;

  return jsonb_build_object(
    'replayed', false,
    'task', to_jsonb(v_task),
    'assignee', case when v_assignee.id is null then null
                     else jsonb_build_object('profile_id', v_assignee.id, 'full_name', v_assignee.full_name) end,
    'schedule_change_request_id', v_change_id
  );
end;
$$;

revoke all on function public.record_client_workspace_task(
  uuid, uuid, uuid, text, text, text, date, uuid, uuid, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.record_client_workspace_task(
  uuid, uuid, uuid, text, text, text, date, uuid, uuid, text, text, text, jsonb, jsonb
) to service_role;

-- ── Durable client direction and meeting outcomes ────────────────────────────

create or replace function public.record_client_workspace_update(
  p_actor_profile_id uuid,
  p_connection_principal_user_id uuid,
  p_client_id uuid,
  p_update_kind text,
  p_title text,
  p_body text,
  p_decisions jsonb default '[]'::jsonb,
  p_unresolved jsonb default '[]'::jsonb,
  p_linked_task_ids uuid[] default '{}'::uuid[],
  p_meeting_title text default null,
  p_meeting_date date default null,
  p_calendar_event_id uuid default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_client public.clients;
  v_update public.client_context_updates;
  v_debrief_id uuid;
  v_event_client uuid;
  v_foreign_tasks integer;
  v_linked uuid[] := coalesce(p_linked_task_ids, '{}'::uuid[]);
begin
  select * into v_actor from public.profiles profile
  where profile.id = p_actor_profile_id
    and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  if p_connection_principal_user_id is null then raise exception 'Connection principal required for audit'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key required'; end if;
  if p_update_kind is null or p_update_kind not in ('content_direction', 'meeting_outcome', 'client_preference', 'client_fact') then
    raise exception 'Unknown client update kind';
  end if;
  if jsonb_typeof(coalesce(p_decisions, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_unresolved, '[]'::jsonb)) <> 'array' then
    raise exception 'decisions and unresolved must be lists';
  end if;

  select * into v_client from public.clients client where client.id = p_client_id;
  if v_client.id is null then raise exception 'Client not found'; end if;
  if not coalesce(v_client.active, false) then raise exception 'Client is not active'; end if;

  perform pg_advisory_xact_lock(hashtextextended('cgu-' || p_client_id::text || '-' || p_idempotency_key::text, 0));
  select * into v_update from public.client_context_updates existing
  where existing.client_id = p_client_id and existing.idempotency_key = p_idempotency_key;
  if v_update.id is not null then
    return jsonb_build_object('replayed', true, 'update', to_jsonb(v_update), 'meeting_debrief_id', v_update.meeting_debrief_id);
  end if;

  select count(*) into v_foreign_tasks
  from unnest(v_linked) linked(task_id)
  left join public.planner_tasks task on task.id = linked.task_id
  where task.id is null or task.client_id is distinct from p_client_id;
  if v_foreign_tasks > 0 then
    raise exception 'Linked tasks must be existing tasks for this same client';
  end if;

  if p_calendar_event_id is not null then
    select event.client_id into v_event_client from public.company_calendar_events event where event.id = p_calendar_event_id;
    if not found then raise exception 'Calendar event not found'; end if;
    if v_event_client is distinct from p_client_id then
      raise exception 'Cross-client calendar event refused';
    end if;
  end if;

  if p_update_kind = 'meeting_outcome' then
    insert into public.meeting_debriefs(
      calendar_event_id, client_id, client_name, meeting_title, created_by, transcript,
      summary, decisions, unresolved, tasks, status, applied_actions, applied_at
    ) values (
      p_calendar_event_id, v_client.id, v_client.name, coalesce(p_meeting_title, btrim(p_title)), v_actor.id,
      btrim(p_body), btrim(p_title), coalesce(p_decisions, '[]'::jsonb), coalesce(p_unresolved, '[]'::jsonb),
      coalesce((select jsonb_agg(jsonb_build_object('task_id', linked.task_id)) from unnest(v_linked) linked(task_id)), '[]'::jsonb),
      'applied',
      jsonb_build_object('source', 'chatgpt_client_project', 'linked_task_ids', to_jsonb(v_linked)),
      now()
    ) returning id into v_debrief_id;
  end if;

  insert into public.client_context_updates(
    client_id, update_kind, title, body, decisions, unresolved, linked_task_ids, meeting_debrief_id,
    source_kind, source_meeting_title, source_meeting_date, source_calendar_event_id,
    recorded_by_profile_id, connection_principal_user_id, effective_context_kind, idempotency_key
  ) values (
    v_client.id, p_update_kind, btrim(p_title), btrim(p_body), coalesce(p_decisions, '[]'::jsonb),
    coalesce(p_unresolved, '[]'::jsonb), v_linked, v_debrief_id,
    'chatgpt_client_project', p_meeting_title, p_meeting_date, p_calendar_event_id,
    v_actor.id, p_connection_principal_user_id, 'client', p_idempotency_key
  ) returning * into v_update;

  return jsonb_build_object('replayed', false, 'update', to_jsonb(v_update), 'meeting_debrief_id', v_debrief_id);
end;
$$;

revoke all on function public.record_client_workspace_update(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid[], text, date, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.record_client_workspace_update(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid[], text, date, uuid, uuid
) to service_role;

-- ── Client Schedule proposals made through the service-role connector ────────
-- tg_cscr_capture_baseline identifies the requester from auth.uid() and overwrites requested_by,
-- so a signed-in user can never propose a change on someone else's behalf. The CG Dynamics MCP
-- connects with the service role, where auth.uid() is null, so every proposal it attempted
-- failed with "Active requester profile not found" (found by the #341 local acceptance run).
--
-- The signed-in path is unchanged. Only for the service role — which is already fully
-- privileged — is the explicit requested_by trusted, after checking it is an active profile.
-- record_client_workspace_task sets it to the verified connection principal. The field whitelist,
-- baseline capture and forced 'pending' status are exactly as before.
create or replace function public.tg_cscr_capture_baseline()
returns trigger language plpgsql security definer set search_path = public as $$
declare target public.monthly_deliverables; requester_name text; requester_id uuid;
begin
  if jsonb_typeof(new.change) <> 'object'
    or new.change = '{}'::jsonb
    or new.change - array['scheduled_date','due_date','production_status','assigned_to_name','notes'] <> '{}'::jsonb
  then
    raise exception 'Client Schedule change contains unsupported fields';
  end if;

  select * into target from public.monthly_deliverables where id = new.deliverable_id;
  if target.id is null then raise exception 'Schedule item not found'; end if;
  requester_id := case when auth.uid() is null and auth.role() = 'service_role' then new.requested_by else auth.uid() end;
  select full_name into requester_name from public.profiles where id = requester_id and is_active is distinct from false;
  if requester_name is null then raise exception 'Active requester profile not found'; end if;

  new.requested_by := requester_id;
  new.requested_by_name := requester_name;
  new.status := 'pending';
  new.target_updated_at := target.updated_at;
  new.baseline := jsonb_build_object(
    'scheduled_date', target.scheduled_date,
    'due_date', target.due_date,
    'production_status', target.production_status,
    'assigned_to_name', target.assigned_to_name,
    'notes', target.notes
  );
  return new;
end $$;
