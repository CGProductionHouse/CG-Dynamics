-- Welcome to CG onboarding foundation.
-- Tokens are hash-only, all browser access is mediated by the client-onboarding
-- Edge Function, and OneDrive internals remain service-role/staff-only.

begin;

create table public.client_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'reopened')),
  token_hash text not null unique check (length(token_hash) = 64),
  token_expires_at timestamptz not null,
  revoked_at timestamptz,
  current_step smallint not null default 0 check (current_step between 0 and 5),
  vector_unavailable boolean not null default false,
  enabled_platforms text[] not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  unique (id, client_id),
  unique (client_id),
  check (revoked_at is null or revoked_at >= created_at),
  check (completed_at is null or started_at is not null)
);

create index client_onboarding_sessions_client_activity_idx
  on public.client_onboarding_sessions(client_id, last_activity_at desc);
create index client_onboarding_sessions_valid_token_idx
  on public.client_onboarding_sessions(token_hash, token_expires_at)
  where revoked_at is null;

create table public.client_onboarding_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  onboarding_session_id uuid not null,
  category text not null check (category in ('logo', 'services', 'optional')),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 262144000),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'received', 'failed')),
  storage_provider text check (storage_provider is null or storage_provider = 'onedrive'),
  storage_drive_id text,
  storage_item_id text,
  storage_web_url text,
  uploaded_at timestamptz,
  source text not null default 'welcome_link' check (source in ('welcome_link', 'client_portal', 'staff')),
  created_at timestamptz not null default now(),
  unique (onboarding_session_id, id),
  foreign key (onboarding_session_id, client_id)
    references public.client_onboarding_sessions(id, client_id) on delete cascade,
  check (
    upload_status <> 'received'
    or (
      storage_provider = 'onedrive'
      and storage_drive_id is not null
      and storage_item_id is not null
      and uploaded_at is not null
    )
  )
);

create index client_onboarding_uploads_session_category_idx
  on public.client_onboarding_uploads(onboarding_session_id, category, uploaded_at desc);

create table public.client_service_intake (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  onboarding_session_id uuid not null unique,
  typed_description text not null default '' check (char_length(typed_description) <= 10000),
  service_items text[] not null default '{}',
  source_type text check (source_type in ('typed', 'list', 'upload', 'mixed')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (onboarding_session_id, client_id)
    references public.client_onboarding_sessions(id, client_id) on delete cascade
);

create table public.client_platform_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  onboarding_session_id uuid not null,
  platform text not null check (platform in ('facebook', 'instagram', 'meta_business', 'linkedin', 'tiktok', 'website', 'google', 'outlook')),
  client_choice text check (client_choice in ('connect_now', 'do_later', 'not_needed')),
  connection_state text not null default 'not_started'
    check (connection_state in ('not_started', 'instructions_opened', 'submitted', 'awaiting_verification', 'verified', 'failed')),
  method text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete restrict,
  notes text check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now(),
  unique (onboarding_session_id, platform),
  foreign key (onboarding_session_id, client_id)
    references public.client_onboarding_sessions(id, client_id) on delete cascade,
  check ((verified_at is null and verified_by is null) or (verified_at is not null and verified_by is not null)),
  check ((connection_state = 'verified') = (verified_at is not null and verified_by is not null))
);

create table public.client_onboarding_optional_intake (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  onboarding_session_id uuid not null unique,
  additional_notes text not null default '' check (char_length(additional_notes) <= 10000),
  updated_at timestamptz not null default now(),
  foreign key (onboarding_session_id, client_id)
    references public.client_onboarding_sessions(id, client_id) on delete cascade
);

alter table public.client_onboarding_sessions enable row level security;
alter table public.client_onboarding_uploads enable row level security;
alter table public.client_service_intake enable row level security;
alter table public.client_platform_access enable row level security;
alter table public.client_onboarding_optional_intake enable row level security;

-- Deliberately no browser policies. The Edge Function validates either the
-- hash-only welcome token or the current active profile before every action.
revoke all on public.client_onboarding_sessions from anon, authenticated;
revoke all on public.client_onboarding_uploads from anon, authenticated;
revoke all on public.client_service_intake from anon, authenticated;
revoke all on public.client_platform_access from anon, authenticated;
revoke all on public.client_onboarding_optional_intake from anon, authenticated;

create or replace function public.reissue_client_onboarding_session(
  p_client_id uuid,
  p_token_hash text,
  p_token_expires_at timestamptz,
  p_enabled_platforms text[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_status text;
begin
  if length(p_token_hash) <> 64 or p_token_expires_at <= now() then
    raise exception 'Invalid onboarding token properties.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_actor_id
      and profile.role = 'admin'
      and profile.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clients client
    where client.id = p_client_id and client.active is true
  ) then
    raise exception 'Active client required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  select session.id, session.status
  into v_session_id, v_status
  from public.client_onboarding_sessions session
  where session.client_id = p_client_id
  for update;

  if v_session_id is null then
    insert into public.client_onboarding_sessions (
      client_id, token_hash, token_expires_at, enabled_platforms, created_by
    ) values (
      p_client_id, p_token_hash, p_token_expires_at, p_enabled_platforms, p_actor_id
    )
    returning id into v_session_id;
  else
    update public.client_onboarding_sessions
    set token_hash = p_token_hash,
        token_expires_at = p_token_expires_at,
        revoked_at = null,
        enabled_platforms = p_enabled_platforms,
        status = case when v_status = 'completed' then 'reopened' else v_status end,
        current_step = case when v_status = 'completed' then 1 else current_step end,
        completed_at = case when v_status = 'completed' then null else completed_at end,
        last_activity_at = now()
    where id = v_session_id;
  end if;

  delete from public.client_platform_access access
  where access.onboarding_session_id = v_session_id
    and not (access.platform = any(coalesce(p_enabled_platforms, '{}'::text[])));

  insert into public.client_platform_access (client_id, onboarding_session_id, platform)
  select p_client_id, v_session_id, platform
  from unnest(coalesce(p_enabled_platforms, '{}'::text[])) platform
  on conflict (onboarding_session_id, platform) do nothing;

  return v_session_id;
end;
$$;

revoke all on function public.reissue_client_onboarding_session(uuid, text, timestamptz, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.reissue_client_onboarding_session(uuid, text, timestamptz, text[], uuid)
  to service_role;

comment on table public.client_onboarding_sessions is
  'Hash-only, expiring, revocable Welcome to CG sessions scoped to one canonical client.';
comment on column public.client_onboarding_uploads.storage_web_url is
  'Internal OneDrive reference. Never include in client-facing API responses.';
comment on table public.client_platform_access is
  'Client choice and CG verification are deliberately separate states. No credentials belong here.';

commit;
