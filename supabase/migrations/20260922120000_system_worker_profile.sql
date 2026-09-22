-- Content Production Autopilot (#450): system-worker identity for OneDrive upserts.
-- PREPARED ONLY. Do not apply to production without explicit CA approval.
--
-- The autopilot background worker calls OneDrive upsert RPCs via the service role,
-- so auth.uid() is NULL. The existing RPCs resolve actor from p_actor_id and check
-- public.profiles — a real profile row is required for both the admin check and the
-- FK constraints on mapped_by / created_by columns.
--
-- Fix (identical in every function): add an optional p_actor_profile_id that is
-- honoured ONLY when the caller is the service role and there is no signed-in user.
-- For a signed-in user nothing changes: auth.uid() is still the actor and a supplied
-- p_actor_profile_id is ignored, so no user can act as someone else.
--
-- Also seeds the system-worker profile row. The profile id is deterministic
-- (fixed UUID) so the worker can reference it via WORKER_SYSTEM_PROFILE_ID env var.
-- The profile is inactive by default; the migration activates it.
--
-- This follows the exact MCP bypass pattern from 20260911170000_mcp_staff_write_actor.sql.

begin;

-- 1. Seed system-worker profile ──────────────────────────────────────────────
-- Deterministic UUID so the worker env var WORKER_SYSTEM_PROFILE_ID is stable.
-- Role = 'admin' so it passes the admin check in all three upsert RPCs.
-- is_active = true so it passes the active check.
-- full_name identifies the row as the system worker, not a human staff member.

insert into public.profiles (id, full_name, email, role, is_active)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'CG System Worker',
  'system-worker@cg-dynamics.internal',
  'admin',
  true
)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active;

-- 2. upsert_client_onedrive_mapping — add p_actor_profile_id bypass ──────────

drop function if exists public.upsert_client_onedrive_mapping(uuid, text, text, text, text, text, uuid);

create or replace function public.upsert_client_onedrive_mapping(
  p_client_id uuid,
  p_drive_id text,
  p_client_folder_item_id text,
  p_videos_folder_item_id text,
  p_web_url text,
  p_folder_name text,
  p_actor_id uuid,
  p_actor_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then coalesce(p_actor_profile_id, p_actor_id) else p_actor_id end;
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clients c where c.id = p_client_id and c.active is true
  ) then
    raise exception 'Active client required.' using errcode = '22023';
  end if;

  insert into public.client_onedrive_mappings (
    client_id, drive_id, client_folder_item_id, videos_folder_item_id,
    web_url, folder_name, mapped_by
  ) values (
    p_client_id, p_drive_id, p_client_folder_item_id, p_videos_folder_item_id,
    p_web_url, p_folder_name, v_actor_id
  )
  on conflict (client_id) do update set
    drive_id = excluded.drive_id,
    client_folder_item_id = excluded.client_folder_item_id,
    videos_folder_item_id = excluded.videos_folder_item_id,
    web_url = excluded.web_url,
    folder_name = excluded.folder_name,
    mapped_by = excluded.mapped_by,
    mapped_at = now(),
    last_verified_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_client_onedrive_mapping(uuid, text, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.upsert_client_onedrive_mapping(uuid, text, text, text, text, text, uuid, uuid) to service_role;

-- 3. upsert_content_run_onedrive_folder — add p_actor_profile_id bypass ──────

drop function if exists public.upsert_content_run_onedrive_folder(uuid, uuid, text, text, text, text, uuid);

create or replace function public.upsert_content_run_onedrive_folder(
  p_content_run_id uuid,
  p_client_id uuid,
  p_drive_id text,
  p_month_folder_item_id text,
  p_web_url text,
  p_folder_name text,
  p_actor_id uuid,
  p_actor_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then coalesce(p_actor_profile_id, p_actor_id) else p_actor_id end;
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.content_runs r where r.id = p_content_run_id
  ) then
    raise exception 'Content run not found.' using errcode = '22023';
  end if;

  insert into public.content_run_onedrive_folders (
    content_run_id, client_id, drive_id, month_folder_item_id,
    web_url, folder_name, created_by
  ) values (
    p_content_run_id, p_client_id, p_drive_id, p_month_folder_item_id,
    p_web_url, p_folder_name, v_actor_id
  )
  on conflict (content_run_id) do update set
    client_id = excluded.client_id,
    drive_id = excluded.drive_id,
    month_folder_item_id = excluded.month_folder_item_id,
    web_url = excluded.web_url,
    folder_name = excluded.folder_name,
    created_by = excluded.created_by,
    created_at = now(),
    last_verified_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_content_run_onedrive_folder(uuid, uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.upsert_content_run_onedrive_folder(uuid, uuid, text, text, text, text, uuid, uuid) to service_role;

-- 4. upsert_content_guide_video_folder — add p_actor_profile_id bypass ───────

drop function if exists public.upsert_content_guide_video_folder(uuid, uuid, uuid, text, text, text, text, uuid);

create or replace function public.upsert_content_guide_video_folder(
  p_content_guide_idea_id uuid,
  p_content_run_id uuid,
  p_client_id uuid,
  p_drive_id text,
  p_folder_item_id text,
  p_folder_name text,
  p_mapping_origin text,
  p_actor_id uuid,
  p_actor_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then coalesce(p_actor_profile_id, p_actor_id) else p_actor_id end;
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if p_mapping_origin is null or p_mapping_origin not in ('canonical', 'legacy_mapped') then
    raise exception 'Mapping origin must be canonical or legacy_mapped.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.content_guide_ideas idea
    join public.content_guidelines guideline on guideline.id = idea.content_guideline_id
    where idea.id = p_content_guide_idea_id
      and guideline.content_run_id = p_content_run_id
      and guideline.client_id = p_client_id
      and idea.status <> 'archived'
  ) then
    raise exception 'Video does not belong to that exact content run and client.' using errcode = '22023';
  end if;

  insert into public.content_guide_video_onedrive_folders (
    content_guide_idea_id, content_run_id, client_id, drive_id, folder_item_id,
    folder_name, mapping_origin, created_by
  ) values (
    p_content_guide_idea_id, p_content_run_id, p_client_id, p_drive_id, p_folder_item_id,
    p_folder_name, p_mapping_origin, v_actor_id
  )
  on conflict (content_guide_idea_id) do update set
    drive_id = excluded.drive_id,
    folder_item_id = excluded.folder_item_id,
    folder_name = excluded.folder_name,
    mapping_origin = excluded.mapping_origin,
    last_verified_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_content_guide_video_folder(uuid, uuid, uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.upsert_content_guide_video_folder(uuid, uuid, uuid, text, text, text, text, uuid, uuid) to service_role;

-- 5. get_or_create_content_guideline — add service-role bypass ───────────────
-- The autopilot pass calls this RPC via service-role. auth.uid() is NULL, so the
-- existing function fails the is_staff() check and the auth.uid() insert.
-- Add optional p_actor_profile_id that is honoured only under service-role.

drop function if exists public.get_or_create_content_guideline(uuid);

create or replace function public.get_or_create_content_guideline(
  p_content_run_id uuid,
  p_actor_profile_id uuid default null
)
returns public.content_guidelines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_guideline public.content_guidelines;
  v_run public.content_runs;
begin
  -- Staff access required
  if v_actor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id and p.is_active is true
      and p.role in ('admin', 'manager', 'staff', 'team')
  ) then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  -- Find existing guideline for this run
  select * into v_guideline
  from public.content_guidelines cg
  where cg.content_run_id = p_content_run_id
  limit 1;

  if v_guideline.id is not null then
    return v_guideline;
  end if;

  -- Run must exist
  select * into v_run from public.content_runs r where r.id = p_content_run_id;
  if v_run.id is null then
    raise exception 'Content run not found.' using errcode = '22023';
  end if;

  -- Create new guideline
  insert into public.content_guidelines (
    content_run_id, client_id, title, status, coverage_start, coverage_end, created_by
  ) values (
    p_content_run_id,
    v_run.client_id,
    coalesce(v_run.client_name, 'Client') || ' content guideline',
    'draft',
    null,
    null,
    v_actor_id
  )
  returning * into v_guideline;

  return v_guideline;
end;
$$;

revoke all on function public.get_or_create_content_guideline(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_content_guideline(uuid, uuid) to service_role;

commit;
