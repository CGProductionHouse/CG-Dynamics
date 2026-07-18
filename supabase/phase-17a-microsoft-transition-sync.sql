-- ============================================================
-- Phase 17a: Microsoft transition sync audit and reconciliation
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
-- Additive only. Phase 15a source IDs remain the canonical identities.
-- This migration does not fetch Microsoft data or change existing records.
-- ============================================================

create table if not exists public.microsoft_sync_settings (
  id boolean primary key default true check (id),
  transition_status text not null default 'active'
    check (transition_status in ('active', 'paused', 'complete')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.microsoft_sync_settings (id, transition_status)
values (true, 'active')
on conflict (id) do nothing;

create table if not exists public.microsoft_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('admin', 'agent')),
  status text not null default 'previewed'
    check (status in ('previewed', 'applying', 'completed', 'partial', 'failed')),
  snapshot_exported_at timestamptz not null,
  snapshot_exported_by text not null,
  range_start timestamptz,
  range_end timestamptz,
  source_completeness jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  safe_error text,
  requested_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  applied_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.microsoft_sync_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.microsoft_sync_runs(id) on delete cascade,
  item_key text not null,
  source_type text not null,
  source_container_id text not null,
  source_item_id text not null,
  source_name text not null,
  destination text not null check (destination in ('planner', 'client_schedule', 'cg_calendar', 'review')),
  destination_id uuid,
  action text not null check (action in (
    'create', 'update', 'unchanged', 'complete', 'reopen', 'move',
    'cancel', 'archive', 'conflict', 'skipped', 'failed'
  )),
  result_status text not null check (result_status in ('previewed', 'applied', 'skipped', 'failed')),
  source_complete boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  safe_error text,
  created_at timestamptz not null default now(),
  unique (run_id, item_key)
);

create index if not exists microsoft_sync_runs_created_at_idx
  on public.microsoft_sync_runs (created_at desc);
create index if not exists microsoft_sync_run_items_run_id_idx
  on public.microsoft_sync_run_items (run_id, created_at);

alter table public.planner_tasks
  add column if not exists microsoft_last_seen_at timestamptz,
  add column if not exists microsoft_source_removed_at timestamptz,
  add column if not exists microsoft_source_modified_at timestamptz,
  add column if not exists microsoft_source_hash text,
  add column if not exists microsoft_source_description text,
  add column if not exists microsoft_sync_run_id uuid references public.microsoft_sync_runs(id) on delete set null;

alter table public.monthly_deliverables
  add column if not exists microsoft_last_seen_at timestamptz,
  add column if not exists microsoft_source_removed_at timestamptz,
  add column if not exists microsoft_source_modified_at timestamptz,
  add column if not exists microsoft_source_hash text,
  add column if not exists microsoft_source_description text,
  add column if not exists microsoft_sync_run_id uuid references public.microsoft_sync_runs(id) on delete set null;

alter table public.company_calendar_events
  add column if not exists microsoft_last_seen_at timestamptz,
  add column if not exists microsoft_source_removed_at timestamptz,
  add column if not exists microsoft_source_modified_at timestamptz,
  add column if not exists microsoft_source_hash text,
  add column if not exists microsoft_source_description text,
  add column if not exists microsoft_sync_run_id uuid references public.microsoft_sync_runs(id) on delete set null;

create or replace function public.protect_microsoft_sync_metadata()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  field_name text;
  protected_fields text[] := array[
    'microsoft_source_type', 'microsoft_plan_id', 'microsoft_bucket_id',
    'microsoft_task_id', 'microsoft_calendar_id', 'microsoft_event_id',
    'microsoft_last_synced_at', 'microsoft_last_seen_at',
    'microsoft_source_removed_at', 'microsoft_source_modified_at',
    'microsoft_source_hash', 'microsoft_source_description',
    'microsoft_sync_run_id'
  ];
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  foreach field_name in array protected_fields loop
    if tg_op = 'INSERT' then
      if to_jsonb(new) ? field_name and to_jsonb(new) -> field_name <> 'null'::jsonb then
        raise exception 'Microsoft sync metadata is admin-only';
      end if;
    elsif to_jsonb(new) ? field_name
      and (to_jsonb(new) -> field_name) is distinct from (to_jsonb(old) -> field_name) then
      raise exception 'Microsoft sync metadata is admin-only';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.protect_microsoft_sync_metadata() from public;
revoke all on function public.protect_microsoft_sync_metadata() from anon;
revoke all on function public.protect_microsoft_sync_metadata() from authenticated;

drop trigger if exists planner_tasks_protect_microsoft_sync on public.planner_tasks;
create trigger planner_tasks_protect_microsoft_sync before insert or update on public.planner_tasks
for each row execute function public.protect_microsoft_sync_metadata();
drop trigger if exists monthly_deliverables_protect_microsoft_sync on public.monthly_deliverables;
create trigger monthly_deliverables_protect_microsoft_sync before insert or update on public.monthly_deliverables
for each row execute function public.protect_microsoft_sync_metadata();
drop trigger if exists company_calendar_events_protect_microsoft_sync on public.company_calendar_events;
create trigger company_calendar_events_protect_microsoft_sync before insert or update on public.company_calendar_events
for each row execute function public.protect_microsoft_sync_metadata();

alter table public.microsoft_sync_settings enable row level security;
alter table public.microsoft_sync_runs enable row level security;
alter table public.microsoft_sync_run_items enable row level security;

drop policy if exists "microsoft_sync_settings: admin read" on public.microsoft_sync_settings;
drop policy if exists "microsoft_sync_settings: admin update" on public.microsoft_sync_settings;
drop policy if exists "microsoft_sync_runs: admin read" on public.microsoft_sync_runs;
drop policy if exists "microsoft_sync_runs: admin insert" on public.microsoft_sync_runs;
drop policy if exists "microsoft_sync_runs: admin update" on public.microsoft_sync_runs;
drop policy if exists "microsoft_sync_run_items: admin read" on public.microsoft_sync_run_items;
drop policy if exists "microsoft_sync_run_items: admin insert" on public.microsoft_sync_run_items;

create policy "microsoft_sync_settings: admin read"
on public.microsoft_sync_settings for select using (public.is_admin());
create policy "microsoft_sync_settings: admin update"
on public.microsoft_sync_settings for update using (public.is_admin()) with check (public.is_admin());

create policy "microsoft_sync_runs: admin read"
on public.microsoft_sync_runs for select using (public.is_admin());
create policy "microsoft_sync_runs: admin insert"
on public.microsoft_sync_runs for insert with check (public.is_admin());
create policy "microsoft_sync_runs: admin update"
on public.microsoft_sync_runs for update using (public.is_admin()) with check (public.is_admin());

create policy "microsoft_sync_run_items: admin read"
on public.microsoft_sync_run_items for select using (public.is_admin());
create policy "microsoft_sync_run_items: admin insert"
on public.microsoft_sync_run_items for insert with check (public.is_admin());

create or replace function public.apply_microsoft_sync_item(
  p_run_id uuid,
  p_item_key text,
  p_destination text,
  p_destination_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_should_apply boolean,
  p_patch jsonb,
  p_source_type text,
  p_source_container_id text,
  p_source_item_id text,
  p_source_name text,
  p_source_complete boolean,
  p_details jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  result_id uuid := p_destination_id;
  affected integer := 0;
  current_transition_status text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select transition_status into current_transition_status
  from public.microsoft_sync_settings where id = true for update;
  if current_transition_status is distinct from 'active' then
    raise exception 'Microsoft transition sync is not active';
  end if;
  if not exists (select 1 from public.microsoft_sync_runs where id = p_run_id and status = 'applying') then
    raise exception 'Microsoft sync run is not applying';
  end if;
  select destination_id into result_id
  from public.microsoft_sync_run_items where run_id = p_run_id and item_key = p_item_key;
  if found then return result_id; end if;

  if p_should_apply and p_action not in ('unchanged', 'conflict', 'skipped', 'failed') then
    if p_destination = 'planner' and p_action = 'create' then
      insert into public.planner_tasks (
        board_id, bucket_id, title, client_id, client_name, status, priority,
        start_date, due_date, source, original_plan_name, original_bucket_name,
        original_task_id, import_hash, microsoft_source_type, microsoft_plan_id,
        microsoft_bucket_id, microsoft_task_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        nullif(p_patch->>'board_id','')::uuid, nullif(p_patch->>'bucket_id','')::uuid,
        p_patch->>'title', nullif(p_patch->>'client_id','')::uuid, p_patch->>'client_name',
        p_patch->>'status', coalesce(p_patch->>'priority','normal'),
        nullif(p_patch->>'start_date','')::date, nullif(p_patch->>'due_date','')::date,
        p_patch->>'source', p_patch->>'original_plan_name', p_patch->>'original_bucket_name',
        p_patch->>'original_task_id', p_patch->>'import_hash', p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_plan_id', p_patch->>'microsoft_bucket_id', p_patch->>'microsoft_task_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'client_schedule' and p_action = 'create' then
      insert into public.monthly_deliverables (
        client_id, package_id, template_id, board_id, bucket_id, month, code,
        instance_number, title, deliverable_type, production_status, priority,
        scheduled_date, microsoft_source_type, microsoft_plan_id,
        microsoft_bucket_id, microsoft_task_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        nullif(p_patch->>'client_id','')::uuid, nullif(p_patch->>'package_id','')::uuid,
        nullif(p_patch->>'template_id','')::uuid, nullif(p_patch->>'board_id','')::uuid,
        nullif(p_patch->>'bucket_id','')::uuid, (p_patch->>'month')::date,
        p_patch->>'code', (p_patch->>'instance_number')::integer, p_patch->>'title',
        p_patch->>'deliverable_type', p_patch->>'production_status', coalesce(p_patch->>'priority','normal'),
        nullif(p_patch->>'scheduled_date','')::date, p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_plan_id', p_patch->>'microsoft_bucket_id', p_patch->>'microsoft_task_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'cg_calendar' and p_action = 'create' then
      insert into public.company_calendar_events (
        title, event_type, client_id, client_name, start_at, end_at, all_day,
        location, status, microsoft_source_type, microsoft_calendar_id,
        microsoft_event_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        p_patch->>'title', p_patch->>'event_type', nullif(p_patch->>'client_id','')::uuid,
        p_patch->>'client_name', (p_patch->>'start_at')::timestamptz,
        nullif(p_patch->>'end_at','')::timestamptz, (p_patch->>'all_day')::boolean,
        p_patch->>'location', p_patch->>'status', p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_calendar_id', p_patch->>'microsoft_event_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'planner' then
      update public.planner_tasks set
        board_id = case when p_patch ? 'board_id' then nullif(p_patch->>'board_id','')::uuid else board_id end,
        bucket_id = case when p_patch ? 'bucket_id' then nullif(p_patch->>'bucket_id','')::uuid else bucket_id end,
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        status = case when p_patch ? 'status' then p_patch->>'status' else status end,
        start_date = case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else start_date end,
        due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date','')::date else due_date end,
        original_plan_name = case when p_patch ? 'original_plan_name' then p_patch->>'original_plan_name' else original_plan_name end,
        original_bucket_name = case when p_patch ? 'original_bucket_name' then p_patch->>'original_bucket_name' else original_bucket_name end,
        microsoft_bucket_id = case when p_patch ? 'microsoft_bucket_id' then p_patch->>'microsoft_bucket_id' else microsoft_bucket_id end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        archived_at = case when p_patch ? 'archived_at' then nullif(p_patch->>'archived_at','')::timestamptz else archived_at end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    elsif p_destination = 'client_schedule' then
      update public.monthly_deliverables set
        client_id = case when p_patch ? 'client_id' then nullif(p_patch->>'client_id','')::uuid else client_id end,
        package_id = case when p_patch ? 'package_id' then nullif(p_patch->>'package_id','')::uuid else package_id end,
        template_id = case when p_patch ? 'template_id' then nullif(p_patch->>'template_id','')::uuid else template_id end,
        month = case when p_patch ? 'month' then (p_patch->>'month')::date else month end,
        code = case when p_patch ? 'code' then p_patch->>'code' else code end,
        instance_number = case when p_patch ? 'instance_number' then (p_patch->>'instance_number')::integer else instance_number end,
        deliverable_type = case when p_patch ? 'deliverable_type' then p_patch->>'deliverable_type' else deliverable_type end,
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        production_status = case when p_patch ? 'production_status' then p_patch->>'production_status' else production_status end,
        scheduled_date = case when p_patch ? 'scheduled_date' then nullif(p_patch->>'scheduled_date','')::date else scheduled_date end,
        microsoft_bucket_id = case when p_patch ? 'microsoft_bucket_id' then p_patch->>'microsoft_bucket_id' else microsoft_bucket_id end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        archived_at = case when p_patch ? 'archived_at' then nullif(p_patch->>'archived_at','')::timestamptz else archived_at end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    elsif p_destination = 'cg_calendar' then
      update public.company_calendar_events set
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        event_type = case when p_patch ? 'event_type' then p_patch->>'event_type' else event_type end,
        start_at = case when p_patch ? 'start_at' then (p_patch->>'start_at')::timestamptz else start_at end,
        end_at = case when p_patch ? 'end_at' then nullif(p_patch->>'end_at','')::timestamptz else end_at end,
        all_day = case when p_patch ? 'all_day' then (p_patch->>'all_day')::boolean else all_day end,
        location = case when p_patch ? 'location' then p_patch->>'location' else location end,
        status = case when p_patch ? 'status' then p_patch->>'status' else status end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    else
      raise exception 'Unsupported Microsoft sync destination/action';
    end if;

    if p_action <> 'create' and affected = 0 then
      raise exception 'Destination changed after preview';
    end if;
  end if;

  insert into public.microsoft_sync_run_items (
    run_id, item_key, source_type, source_container_id, source_item_id, source_name,
    destination, destination_id, action, result_status, source_complete, details
  ) values (
    p_run_id, p_item_key, p_source_type, p_source_container_id, p_source_item_id, p_source_name,
    p_destination, result_id, p_action,
    case when p_should_apply and p_action not in ('unchanged','conflict','skipped','failed') then 'applied' else 'skipped' end,
    p_source_complete, coalesce(p_details, '{}'::jsonb)
  );
  return result_id;
end;
$$;

revoke all on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) from public;
revoke all on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) from anon;
grant execute on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) to authenticated;

comment on table public.microsoft_sync_runs is
  'One-way Microsoft transition sync audit. Never stores credentials or raw Graph responses.';
comment on column public.planner_tasks.microsoft_source_hash is
  'Baseline hash of Microsoft-owned mapped fields at the last successful apply.';
comment on column public.monthly_deliverables.microsoft_source_hash is
  'Baseline hash of Microsoft-owned mapped fields at the last successful apply.';
comment on column public.company_calendar_events.microsoft_source_hash is
  'Baseline hash of Microsoft-owned mapped fields at the last successful apply.';

-- Rollback guidance: drop policies/tables after removing microsoft_sync_run_id
-- foreign keys, then drop only the Phase 17a columns. Never delete imported rows.
