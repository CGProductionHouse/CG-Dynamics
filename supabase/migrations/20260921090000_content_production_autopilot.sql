-- Content Production Autopilot (#450).
-- PREPARED ONLY. Do not apply to production without explicit CA approval.
--
-- Additive. Nothing here creates, rewrites or deletes monthly_deliverables,
-- content_runs, content_guidelines or content_guide_ideas rows, and nothing here
-- can rename, move or delete a OneDrive item.
--
-- Three additions:
--   1. durable per-video production folder identity (the missing step between the
--      run month folder and the raw footage);
--   2. an exact link from a guideline video to its published client-portal final
--      asset, reusing the existing Client Portal Library authority;
--   3. one truthful record of each autopilot pass so the daily operating cycle
--      knows whether content preparation actually ran.

begin;

-- 1. Per-video canonical production folder ───────────────────────────────────
-- Identity is the durable Graph drive/item id. folder_name is stored as observed,
-- so a mapped legacy folder keeps its real name and is never renamed to look canonical.

create table if not exists public.content_guide_video_onedrive_folders (
  id uuid primary key default gen_random_uuid(),
  content_guide_idea_id uuid not null references public.content_guide_ideas(id) on delete cascade,
  content_run_id uuid not null references public.content_runs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  folder_item_id text not null check (char_length(folder_item_id) between 1 and 255),
  folder_name text not null check (char_length(folder_name) between 1 and 255),
  -- 'canonical' when this folder was created from the canonical name builder;
  -- 'legacy_mapped' when an existing folder was mapped by durable id instead.
  mapping_origin text not null default 'canonical'
    check (mapping_origin in ('canonical', 'legacy_mapped')),
  -- Raw evidence reuses the existing closeout vocabulary (#313). It is never
  -- defaulted to 'missing': unchecked evidence stays 'unverified'.
  upload_status text not null default 'unverified'
    check (upload_status in ('verified', 'missing', 'partial', 'unverified')),
  upload_verified_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  unique (content_guide_idea_id),
  unique (drive_id, folder_item_id)
);

comment on table public.content_guide_video_onedrive_folders is
  'Durable canonical production folder per Content Guideline video (#450). Identity is drive_id + folder_item_id; names are never used for runtime lookup and are never rewritten.';
comment on column public.content_guide_video_onedrive_folders.mapping_origin is
  'canonical = created from the canonical name builder; legacy_mapped = an existing folder mapped by durable id and deliberately left under its original name.';
comment on column public.content_guide_video_onedrive_folders.upload_status is
  'Raw footage evidence for this exact video folder. unverified means nobody has checked, never "no files".';

create index if not exists content_guide_video_folders_run_idx
  on public.content_guide_video_onedrive_folders (content_run_id);
create index if not exists content_guide_video_folders_client_idx
  on public.content_guide_video_onedrive_folders (client_id);

alter table public.content_guide_video_onedrive_folders enable row level security;
revoke all on public.content_guide_video_onedrive_folders from anon, authenticated;

-- 2. Video → published client-portal final asset ─────────────────────────────
-- Additive nullable link on the EXISTING portal asset table. The portal remains the
-- single client-facing authority; no second portal or second asset store is created.

alter table public.client_portal_assets
  add column if not exists content_guide_idea_id uuid
    references public.content_guide_ideas(id) on delete set null;

comment on column public.client_portal_assets.content_guide_idea_id is
  'Optional exact link to the Content Guideline video this client-safe final output belongs to (#450). Internal production folders are never exposed through this table.';

create index if not exists client_portal_assets_guide_video_idx
  on public.client_portal_assets (content_guide_idea_id)
  where content_guide_idea_id is not null;

-- 3. Autopilot pass record ───────────────────────────────────────────────────

create table if not exists public.content_autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  clients_considered integer not null default 0,
  runs_prepared integer not null default 0,
  videos_planned integer not null default 0,
  ready_to_edit integer not null default 0,
  blockers jsonb not null default '{}'::jsonb,
  error text
);

comment on table public.content_autopilot_runs is
  'One row per Content Production Autopilot pass (#450). The daily operating cycle reads the latest succeeded row to know whether content preparation actually ran.';

create index if not exists content_autopilot_runs_recent_idx
  on public.content_autopilot_runs (started_at desc);

alter table public.content_autopilot_runs enable row level security;
revoke all on public.content_autopilot_runs from anon;
grant select on public.content_autopilot_runs to authenticated;

drop policy if exists "content_autopilot_runs: staff read" on public.content_autopilot_runs;
create policy "content_autopilot_runs: staff read"
  on public.content_autopilot_runs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active is true));

-- 4. Service-role helpers ────────────────────────────────────────────────────

create or replace function public.get_content_run_video_folders(p_content_run_id uuid)
returns table (
  content_guide_idea_id uuid,
  client_id uuid,
  drive_id text,
  folder_item_id text,
  folder_name text,
  mapping_origin text,
  upload_status text,
  upload_verified_at timestamptz,
  last_verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select f.content_guide_idea_id, f.client_id, f.drive_id, f.folder_item_id, f.folder_name,
         f.mapping_origin, f.upload_status, f.upload_verified_at, f.last_verified_at
  from public.content_guide_video_onedrive_folders f
  where f.content_run_id = p_content_run_id;
end;
$$;

revoke all on function public.get_content_run_video_folders(uuid) from public, anon, authenticated;
grant execute on function public.get_content_run_video_folders(uuid) to service_role;

-- Admin-only mapping write, matching the existing #225 upsert_* contract exactly.
-- The video must belong to the given run and client: a cross-client mapping is refused.
create or replace function public.upsert_content_guide_video_folder(
  p_content_guide_idea_id uuid,
  p_content_run_id uuid,
  p_client_id uuid,
  p_drive_id text,
  p_folder_item_id text,
  p_folder_name text,
  p_mapping_origin text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if p_mapping_origin is null or p_mapping_origin not in ('canonical', 'legacy_mapped') then
    raise exception 'Mapping origin must be canonical or legacy_mapped.' using errcode = '22023';
  end if;

  -- Exact provenance: the video must really be this run's, and this client's.
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
    p_folder_name, p_mapping_origin, p_actor_id
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

revoke all on function public.upsert_content_guide_video_folder(uuid, uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.upsert_content_guide_video_folder(uuid, uuid, uuid, text, text, text, text, uuid) to service_role;

-- Raw evidence write. Only a real verification result may be recorded, and
-- upload_verified_at is set only for a determinate answer.
create or replace function public.set_content_guide_video_upload_status(
  p_content_guide_idea_id uuid,
  p_upload_status text,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.is_active is true
      and p.role in ('admin', 'manager', 'staff')
  ) then
    raise exception 'Active staff access required.' using errcode = '42501';
  end if;

  if p_upload_status is null or p_upload_status not in ('verified', 'missing', 'partial', 'unverified') then
    raise exception 'Unknown upload status.' using errcode = '22023';
  end if;

  update public.content_guide_video_onedrive_folders
  set upload_status = p_upload_status,
      upload_verified_at = case when p_upload_status = 'unverified' then null else now() end,
      last_verified_at = now()
  where content_guide_idea_id = p_content_guide_idea_id;

  if not found then
    raise exception 'That video has no mapped production folder yet.' using errcode = '22023';
  end if;

  return p_upload_status;
end;
$$;

revoke all on function public.set_content_guide_video_upload_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_content_guide_video_upload_status(uuid, text, uuid) to service_role;

commit;
