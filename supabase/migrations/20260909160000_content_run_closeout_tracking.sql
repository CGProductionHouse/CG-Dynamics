-- Content-run closeout tracking for #313.
-- Prepared only. Do not apply to production without explicit CA approval.

begin;

create table if not exists public.content_run_closeouts (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid not null references public.content_runs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  closeout_by uuid not null references public.profiles(id) on delete restrict,
  planned_items jsonb not null default '[]'::jsonb,
  completed_items jsonb not null default '[]'::jsonb,
  missed_items jsonb not null default '[]'::jsonb,
  missed_reasons jsonb not null default '[]'::jsonb,
  cancelled_items jsonb not null default '[]'::jsonb,
  field_notes text,
  reshoot_needed boolean not null default false,
  reshoot_notes text,
  upload_status text not null default 'unverified'
    check (upload_status in ('verified', 'missing', 'partial', 'unverified')),
  upload_evidence text,
  onedrive_folder_ref text,
  scope_changes text,
  idempotency_key uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_run_closeout_one_per_run unique (content_run_id)
);

comment on table public.content_run_closeouts is
  'Per-content-run closeout record. Tracks planned vs captured, missed items, field notes, upload verification and scope changes. Created by staff; verified by system/manager.';

comment on column public.content_run_closeouts.planned_items is
  'JSON array of planned content items/shot list from the content guideline. Structure: [{name, type, position}].';

comment on column public.content_run_closeouts.completed_items is
  'JSON array of items actually captured during the content run. Structure: [{name, type, position, notes}].';

comment on column public.content_run_closeouts.missed_items is
  'JSON array of planned items that were not captured. Structure: [{name, type, position}].';

comment on column public.content_run_closeouts.missed_reasons is
  'JSON array of reasons for missed items. Structure: [{item_name, reason}].';

comment on column public.content_run_closeouts.cancelled_items is
  'JSON array of items cancelled by client or no longer approved. Structure: [{name, reason}].';

comment on column public.content_run_closeouts.upload_status is
  'Upload verification state: verified = footage confirmed in OneDrive; missing = no footage found; partial = some footage present; unverified = not yet checked.';

comment on column public.content_run_closeouts.upload_evidence is
  'Evidence of upload: OneDrive file paths, timestamps, or staff confirmation reference.';

comment on column public.content_run_closeouts.onedrive_folder_ref is
  'Approved OneDrive folder reference for this client content run. From client_onboarding_drive_mapping or content_run mapping.';

comment on column public.content_run_closeouts.idempotency_key is
  'Caller-supplied UUID for safely retrying the latest closeout mutation.';

comment on column public.content_run_closeouts.closed_at is
  'Set only when upload_status is verified from authorised mapped-folder evidence; missing, partial and unverified remain unresolved.';

create unique index if not exists content_run_closeouts_idempotency_key_idx
  on public.content_run_closeouts (idempotency_key)
  where idempotency_key is not null;

alter table public.content_run_closeouts enable row level security;

drop policy if exists "content_run_closeouts: staff own or manage" on public.content_run_closeouts;
create policy "content_run_closeouts: staff own or manage"
  on public.content_run_closeouts for all to authenticated
  using (
    closeout_by = auth.uid()
    or (select public.is_active_planner_manager())
  )
  with check (
    closeout_by = auth.uid()
    or (select public.is_active_planner_manager())
  );

revoke all on table public.content_run_closeouts from anon;
grant select, insert, update on table public.content_run_closeouts to authenticated;

drop trigger if exists trg_content_run_closeouts_updated_at on public.content_run_closeouts;
create trigger trg_content_run_closeouts_updated_at
  before update on public.content_run_closeouts
  for each row execute function public.update_planner_updated_at();

create or replace function public.get_content_run_closeout(
  p_actor_profile_id uuid,
  p_content_run_id uuid
)
returns public.content_run_closeouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closeout public.content_run_closeouts;
  v_actor_role text;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and role in ('admin', 'manager', 'staff', 'team');

  if v_actor_role is null then
    raise exception 'Staff access required';
  end if;

  select * into v_closeout
  from public.content_run_closeouts
  where content_run_id = p_content_run_id;

  if v_closeout.id is null then
    raise exception 'No closeout record found for this Content Run';
  end if;
  if v_closeout.closeout_by is distinct from p_actor_profile_id
    and v_actor_role not in ('admin', 'manager') then
    raise exception 'Closeout access denied';
  end if;

  return v_closeout;
end;
$$;

revoke all on function public.get_content_run_closeout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_content_run_closeout(uuid, uuid) to service_role;

create or replace function public.close_content_run(
  p_actor_profile_id uuid,
  p_content_run_id uuid,
  p_planned_items jsonb default '[]'::jsonb,
  p_completed_items jsonb default '[]'::jsonb,
  p_missed_items jsonb default '[]'::jsonb,
  p_missed_reasons jsonb default '[]'::jsonb,
  p_cancelled_items jsonb default '[]'::jsonb,
  p_field_notes text default null,
  p_reshoot_needed boolean default false,
  p_reshoot_notes text default null,
  p_upload_status text default 'unverified',
  p_upload_evidence text default null,
  p_onedrive_folder_ref text default null,
  p_scope_changes text default null,
  p_idempotency_key uuid default null
)
returns public.content_run_closeouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.content_runs;
  v_closeout public.content_run_closeouts;
  v_actor_role text;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and role in ('admin', 'manager', 'staff', 'team');

  if v_actor_role is null then
    raise exception 'Staff access required';
  end if;

  select * into v_run
  from public.content_runs
  where id = p_content_run_id
  for key share;

  if v_run.id is null then
    raise exception 'Content Run not found';
  end if;

  if v_run.client_id is null then
    raise exception 'Content Run has no client assigned';
  end if;
  if p_upload_status not in ('verified', 'missing', 'partial', 'unverified') then
    raise exception 'Invalid upload_status';
  end if;

  select * into v_closeout
  from public.content_run_closeouts
  where content_run_id = p_content_run_id;

  if v_closeout.id is not null
    and v_closeout.closeout_by is distinct from p_actor_profile_id
    and v_actor_role not in ('admin', 'manager') then
    raise exception 'Closeout update denied';
  end if;

  -- Idempotency: return the existing closeout when the latest mutation key repeats.
  if p_idempotency_key is not null
    and v_closeout.id is not null
    and v_closeout.idempotency_key = p_idempotency_key then
    return v_closeout;
  end if;

  -- Upsert closeout record
  insert into public.content_run_closeouts (
    content_run_id,
    client_id,
    closeout_by,
    planned_items,
    completed_items,
    missed_items,
    missed_reasons,
    cancelled_items,
    field_notes,
    reshoot_needed,
    reshoot_notes,
    upload_status,
    upload_evidence,
    onedrive_folder_ref,
    scope_changes,
    closed_at,
    idempotency_key
  ) values (
    p_content_run_id,
    v_run.client_id,
    p_actor_profile_id,
    p_planned_items,
    p_completed_items,
    p_missed_items,
    p_missed_reasons,
    p_cancelled_items,
    p_field_notes,
    p_reshoot_needed,
    p_reshoot_notes,
    p_upload_status,
    p_upload_evidence,
    p_onedrive_folder_ref,
    p_scope_changes,
    case when p_upload_status = 'verified' then now() else null end,
    p_idempotency_key
  )
  on conflict (content_run_id) do update set
    planned_items = excluded.planned_items,
    completed_items = excluded.completed_items,
    missed_items = excluded.missed_items,
    missed_reasons = excluded.missed_reasons,
    cancelled_items = excluded.cancelled_items,
    field_notes = excluded.field_notes,
    reshoot_needed = excluded.reshoot_needed,
    reshoot_notes = excluded.reshoot_notes,
    upload_status = excluded.upload_status,
    upload_evidence = excluded.upload_evidence,
    onedrive_folder_ref = excluded.onedrive_folder_ref,
    scope_changes = excluded.scope_changes,
    idempotency_key = excluded.idempotency_key,
    closed_at = case when excluded.upload_status = 'verified' then now() else null end,
    updated_at = now()
  returning * into v_closeout;

  return v_closeout;
end;
$$;

revoke all on function public.close_content_run(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, boolean, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.close_content_run(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, boolean, text, text, text, text, text, uuid) to service_role;

create or replace function public.update_closeout_upload_status(
  p_actor_profile_id uuid,
  p_content_run_id uuid,
  p_upload_status text,
  p_upload_evidence text default null,
  p_idempotency_key uuid default null
)
returns public.content_run_closeouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closeout public.content_run_closeouts;
  v_actor_role text;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and role in ('admin', 'manager', 'staff', 'team');

  if v_actor_role is null then
    raise exception 'Staff access required';
  end if;

  if p_upload_status not in ('verified', 'missing', 'partial', 'unverified') then
    raise exception 'Invalid upload_status';
  end if;

  select * into v_closeout
  from public.content_run_closeouts
  where content_run_id = p_content_run_id;

  if v_closeout.id is null then
    raise exception 'No closeout record found for this Content Run';
  end if;
  if v_closeout.closeout_by is distinct from p_actor_profile_id
    and v_actor_role not in ('admin', 'manager') then
    raise exception 'Closeout upload update denied';
  end if;

  -- Idempotency check
  if p_idempotency_key is not null and v_closeout.idempotency_key = p_idempotency_key then
    return v_closeout;
  end if;

  update public.content_run_closeouts
  set
    upload_status = p_upload_status,
    upload_evidence = coalesce(p_upload_evidence, upload_evidence),
    idempotency_key = coalesce(p_idempotency_key, idempotency_key),
    closed_at = case when p_upload_status = 'verified' then now() else null end,
    updated_at = now()
  where content_run_id = p_content_run_id
  returning * into v_closeout;

  return v_closeout;
end;
$$;

revoke all on function public.update_closeout_upload_status(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_closeout_upload_status(uuid, uuid, text, text, uuid) to service_role;

commit;

notify pgrst, 'reload schema';
