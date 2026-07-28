-- Durable Microsoft reconciliation and safe background apply.
-- Additive and idempotent. Microsoft remains read-only; this migration only
-- queues and applies deterministic changes inside CG Dynamics.

alter table public.microsoft_sync_jobs
  add column if not exists phase text not null default 'fetching',
  add column if not exists run_id uuid references public.microsoft_sync_runs(id) on delete set null,
  add column if not exists reconciled_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists safe_action_count integer not null default 0,
  add column if not exists applied_count integer not null default 0,
  add column if not exists conflict_count integer not null default 0,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists failed_count integer not null default 0;

alter table public.microsoft_sync_jobs
  drop constraint if exists microsoft_sync_jobs_phase_check;
alter table public.microsoft_sync_jobs
  add constraint microsoft_sync_jobs_phase_check
  check (phase in ('fetching', 'reconciling', 'applying', 'complete', 'failed'));

create table if not exists public.microsoft_sync_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.microsoft_sync_jobs(id) on delete cascade,
  run_id uuid not null references public.microsoft_sync_runs(id) on delete cascade,
  position integer not null,
  item_key text not null,
  source_type text not null,
  source_container_id text not null,
  source_item_id text not null,
  source_name text not null,
  source_client_label text,
  destination text not null check (destination in ('planner', 'client_schedule', 'cg_calendar', 'review')),
  destination_id uuid,
  expected_updated_at timestamptz,
  action text not null,
  proposed_patch jsonb not null default '{}'::jsonb,
  source_complete boolean not null default false,
  auto_apply boolean not null default false,
  safety_class text not null,
  conflict_code text,
  client_id uuid references public.clients(id) on delete set null,
  client_group_label text not null default 'Unmapped',
  details jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'applied', 'skipped', 'failed')),
  resolution_status text not null default 'open'
    check (resolution_status in ('open', 'resolved', 'ignored', 'superseded')),
  safe_error text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, item_key)
);

create index if not exists microsoft_sync_job_items_claim_idx
  on public.microsoft_sync_job_items(job_id, status, auto_apply, position);
create index if not exists microsoft_sync_job_items_conflict_idx
  on public.microsoft_sync_job_items(job_id, resolution_status, client_group_label, conflict_code);

create table if not exists public.microsoft_sync_client_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_type text not null check (mapping_type in ('planner_bucket_client', 'outlook_label_client')),
  source_container_id text not null,
  source_key text not null,
  source_label text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  active boolean not null default true,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapping_type, source_container_id, source_key)
);

alter table public.microsoft_sync_job_items enable row level security;
alter table public.microsoft_sync_client_mappings enable row level security;

drop policy if exists "microsoft_sync_job_items: admin read" on public.microsoft_sync_job_items;
create policy "microsoft_sync_job_items: admin read"
on public.microsoft_sync_job_items for select
using (public.is_admin());

drop policy if exists "microsoft_sync_client_mappings: admin all" on public.microsoft_sync_client_mappings;
create policy "microsoft_sync_client_mappings: admin all"
on public.microsoft_sync_client_mappings for all
using (public.is_admin()) with check (public.is_admin());

create or replace function public.claim_microsoft_sync_job_items(
  p_job_id uuid,
  p_limit integer default 25
)
returns setof public.microsoft_sync_job_items
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
  with claimed as (
    select item.id
    from public.microsoft_sync_job_items item
    where item.job_id = p_job_id
      and item.status = 'queued'
      and item.auto_apply
    order by item.position
    limit greatest(1, least(coalesce(p_limit, 25), 50))
    for update skip locked
  )
  update public.microsoft_sync_job_items item
  set status = 'running', attempts = item.attempts + 1,
      started_at = coalesce(item.started_at, now()), updated_at = now()
  from claimed
  where item.id = claimed.id
  returning item.*;
end;
$$;

revoke all on function public.claim_microsoft_sync_job_items(uuid, integer) from public;
revoke all on function public.claim_microsoft_sync_job_items(uuid, integer) from anon;
revoke all on function public.claim_microsoft_sync_job_items(uuid, integer) from authenticated;
grant execute on function public.claim_microsoft_sync_job_items(uuid, integer) to service_role;

create or replace function public.get_microsoft_sync_reconciliation_context()
returns jsonb
language sql
security definer set search_path = public
as $$
  select case
    when auth.role() <> 'service_role' and not public.is_admin() then
      jsonb_build_object('error', 'Admin access required')
    else jsonb_build_object(
      'clients', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name)) from public.clients where active), '[]'::jsonb),
      'boards', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug)) from public.planner_boards where archived_at is null), '[]'::jsonb),
      'buckets', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'board_id', board_id, 'name', name)) from public.planner_buckets where archived_at is null), '[]'::jsonb),
      'packages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'client_id', client_id, 'status', status)) from public.client_packages where archived_at is null), '[]'::jsonb),
      'templates', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'package_id', package_id, 'code', code, 'deliverable_type', deliverable_type, 'active', active)) from public.package_deliverable_templates), '[]'::jsonb),
      'client_mappings', coalesce((select jsonb_agg(jsonb_build_object('mapping_type', mapping_type, 'source_container_id', source_container_id, 'source_key', source_key, 'client_id', client_id)) from public.microsoft_sync_client_mappings where active), '[]'::jsonb),
      'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'email', email, 'full_name', full_name)) from public.profiles where role in ('admin','manager','staff','team')), '[]'::jsonb),
      'user_mappings', coalesce((select jsonb_agg(jsonb_build_object('microsoft_user_id', microsoft_user_id, 'cg_user_id', cg_user_id)) from public.microsoft_user_mappings where cg_user_id is not null), '[]'::jsonb),
      'planner_targets', coalesce((select jsonb_agg(to_jsonb(p)) from (
        select id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at,
          microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description,
          board_id, bucket_id, title, client_id, client_name, status, priority,
          start_date, due_date, notes, source, original_plan_name, original_bucket_name,
          assigned_to_name, helper_names
        from public.planner_tasks where microsoft_plan_id is not null and microsoft_task_id is not null
      ) p), '[]'::jsonb),
      'deliverable_targets', coalesce((select jsonb_agg(to_jsonb(d)) from (
        select id, updated_at, microsoft_plan_id, microsoft_task_id, microsoft_last_synced_at,
          microsoft_source_hash, microsoft_source_removed_at, microsoft_source_description,
          client_id, package_id, template_id, board_id, bucket_id, month, code,
          instance_number, title, deliverable_type, production_status, priority,
          scheduled_date, notes, assigned_to_user_id, assigned_to_name, helper_names
        from public.monthly_deliverables where microsoft_plan_id is not null and microsoft_task_id is not null
      ) d), '[]'::jsonb),
      'calendar_targets', coalesce((select jsonb_agg(to_jsonb(c)) from (
        select id, updated_at, microsoft_calendar_id, microsoft_event_id,
          microsoft_last_synced_at, microsoft_source_hash, microsoft_source_removed_at,
          microsoft_source_description, title, event_type, client_id, client_name,
          start_at, end_at, all_day, location, notes, status
        from public.company_calendar_events where microsoft_calendar_id is not null and microsoft_event_id is not null
      ) c), '[]'::jsonb),
      'slot_rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'updated_at', updated_at, 'package_id', package_id,
        'template_id', template_id, 'instance_number', instance_number,
        'month', month, 'microsoft_task_id', microsoft_task_id
      )) from public.monthly_deliverables), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_microsoft_sync_reconciliation_context() from public;
revoke all on function public.get_microsoft_sync_reconciliation_context() from anon;
revoke all on function public.get_microsoft_sync_reconciliation_context() from authenticated;
grant execute on function public.get_microsoft_sync_reconciliation_context() to service_role;

notify pgrst, 'reload schema';
