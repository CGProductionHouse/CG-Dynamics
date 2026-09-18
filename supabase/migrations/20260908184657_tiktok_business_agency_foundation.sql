-- TikTok API for Business / Organic Accounts API agency foundation.
--
-- This is deliberately separate from the accepted TikTok for Developers
-- read-only token path, while reusing tiktok_connections as the single
-- client-to-TikTok identity mapping. monthly_deliverables remains the only
-- publishing schedule authority.

create table public.tiktok_business_authorizations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.tiktok_connections(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  business_open_id text not null,
  account_handle text,
  display_name text,
  status text not null default 'connected'
    check (status in ('connected','needs_reauth','revoked','pending_review','error')),
  granted_permissions text[] not null default '{}',
  publishing_eligibility text not null default 'not_approved'
    check (publishing_eligibility in ('not_approved','video_only','photo_only','video_and_photo','suspended')),
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_token_refresh_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tiktok_business_authorizations is
  'Frontend-safe TikTok API for Business account authorization metadata. Reuses tiktok_connections for exact CG client identity mapping.';

create unique index tiktok_business_authorizations_one_active_per_client
  on public.tiktok_business_authorizations(client_id)
  where status in ('connected','needs_reauth','pending_review');

create table public.tiktok_business_authorization_tokens (
  authorization_id uuid primary key references public.tiktok_business_authorizations(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tiktok_business_authorization_tokens is
  'SERVER-ONLY TikTok API for Business account tokens. No browser/client policies.';

create table public.tiktok_business_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  connection_id uuid not null references public.tiktok_connections(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.tiktok_business_oauth_states is
  'SERVER-ONLY one-time state for an exact client and shared TikTok identity connection.';

create index tiktok_business_oauth_states_unused_idx
  on public.tiktok_business_oauth_states(expires_at)
  where used_at is null;

create table public.tiktok_business_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  authorization_id uuid not null references public.tiktok_business_authorizations(id) on delete restrict,
  monthly_deliverable_id uuid not null references public.monthly_deliverables(id) on delete restrict,
  content_review_version_id uuid not null references public.content_review_versions(id) on delete restrict,
  media_kind text not null check (media_kind in ('video','photo')),
  due_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued','claimed','submitted','processing','published','retry_wait','failed','cancelled','needs_attention')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  claimed_by text,
  last_attempt_at timestamptz,
  provider_request_id text,
  provider_publish_id text,
  provider_post_id text,
  provider_status text,
  provider_error_code text,
  provider_error_message text,
  submitted_at timestamptz,
  published_at timestamptz,
  last_reconciled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (authorization_id, monthly_deliverable_id, content_review_version_id)
);

comment on table public.tiktok_business_publish_jobs is
  'Durable Accounts API publish intent and receipt linked to the canonical Client Schedule item and immutable approved review snapshot.';

create index tiktok_business_publish_jobs_due_idx
  on public.tiktok_business_publish_jobs(coalesce(next_attempt_at, due_at), id)
  where status in ('queued','retry_wait');

create index tiktok_business_publish_jobs_deliverable_idx
  on public.tiktok_business_publish_jobs(monthly_deliverable_id, created_at desc);

create or replace function public.set_tiktok_business_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tiktok_business_authorizations_updated_at
  before update on public.tiktok_business_authorizations
  for each row execute function public.set_tiktok_business_updated_at();
create trigger tiktok_business_authorization_tokens_updated_at
  before update on public.tiktok_business_authorization_tokens
  for each row execute function public.set_tiktok_business_updated_at();
create trigger tiktok_business_publish_jobs_updated_at
  before update on public.tiktok_business_publish_jobs
  for each row execute function public.set_tiktok_business_updated_at();

create or replace function public.guard_tiktok_business_client_mapping()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'tiktok_business_authorizations' then
    if not exists (
      select 1 from public.tiktok_connections connection
      where connection.id = new.connection_id
        and connection.client_id = new.client_id
    ) then
      raise exception 'TikTok Business authorization does not match the connection client';
    end if;
  elsif tg_table_name = 'tiktok_business_publish_jobs' then
    if not exists (
      select 1 from public.tiktok_business_authorizations authorization
      where authorization.id = new.authorization_id
        and authorization.client_id = new.client_id
    ) or not exists (
      select 1 from public.monthly_deliverables deliverable
      where deliverable.id = new.monthly_deliverable_id
        and deliverable.client_id = new.client_id
    ) or not exists (
      select 1 from public.content_review_versions review
      where review.id = new.content_review_version_id
        and review.deliverable_id = new.monthly_deliverable_id
        and review.client_id = new.client_id
    ) then
      raise exception 'TikTok Business publish job crosses a client or schedule boundary';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_tiktok_business_authorization_client
  before insert or update of connection_id, client_id
  on public.tiktok_business_authorizations
  for each row execute function public.guard_tiktok_business_client_mapping();
create trigger guard_tiktok_business_publish_job_client
  before insert or update of client_id, authorization_id, monthly_deliverable_id, content_review_version_id
  on public.tiktok_business_publish_jobs
  for each row execute function public.guard_tiktok_business_client_mapping();

alter table public.tiktok_business_authorizations enable row level security;
alter table public.tiktok_business_authorization_tokens enable row level security;
alter table public.tiktok_business_oauth_states enable row level security;
alter table public.tiktok_business_publish_jobs enable row level security;

revoke all on public.tiktok_business_authorizations,
  public.tiktok_business_authorization_tokens,
  public.tiktok_business_oauth_states,
  public.tiktok_business_publish_jobs
  from anon, authenticated;

grant select on public.tiktok_business_authorizations,
  public.tiktok_business_publish_jobs
  to authenticated;

grant all on public.tiktok_business_authorizations,
  public.tiktok_business_authorization_tokens,
  public.tiktok_business_oauth_states,
  public.tiktok_business_publish_jobs
  to service_role;

create policy "tiktok business authorization manager read"
  on public.tiktok_business_authorizations for select to authenticated
  using (public.is_manager());

create policy "tiktok business publish job manager read"
  on public.tiktok_business_publish_jobs for select to authenticated
  using (public.is_manager());

-- Tokens and OAuth states intentionally have no authenticated policies.

create or replace function public.queue_tiktok_business_publish(
  p_monthly_deliverable_id uuid,
  p_requested_by uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.monthly_deliverables;
  v_review public.content_review_versions;
  v_authorization public.tiktok_business_authorizations;
  v_job_id uuid;
  v_media_kind text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_requested_by
      and profile.is_active
      and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active admin or manager required';
  end if;

  select * into v_deliverable
  from public.monthly_deliverables
  where id = p_monthly_deliverable_id
  for update;

  if v_deliverable.id is null or v_deliverable.client_id is null then
    raise exception 'Choose an exact client schedule item';
  end if;
  if v_deliverable.archived_at is not null
    or v_deliverable.posted_at is not null
    or v_deliverable.production_status in ('posted','blocked','moved') then
    raise exception 'This schedule item is not eligible for TikTok publishing';
  end if;

  select * into v_review
  from public.content_review_versions
  where deliverable_id = v_deliverable.id and state = 'approved'
  order by submitted_at desc
  limit 1
  for update;

  if v_review.id is null
    or v_review.client_id is distinct from v_deliverable.client_id
    or v_review.scheduled_date is distinct from v_deliverable.scheduled_date
    or not ('tiktok' = any(v_review.channels))
    or v_review.internal_approved_at is null
    or (v_review.client_approval_required and v_review.client_approved_at is null) then
    raise exception 'The current TikTok review is not fully approved for this schedule item';
  end if;

  select authorization.* into v_authorization
  from public.tiktok_business_authorizations authorization
  join public.tiktok_connections connection
    on connection.id = authorization.connection_id
   and connection.client_id = authorization.client_id
   and connection.status = 'connected'
  where authorization.client_id = v_deliverable.client_id
    and authorization.status = 'connected'
  limit 1;

  if v_authorization.id is null then
    raise exception 'No healthy TikTok Business authorization exists for this client';
  end if;

  v_media_kind := case
    when v_review.media_type = 'video/mp4' then 'video'
    when v_review.media_type in ('image/jpeg','image/png','image/webp') then 'photo'
    else null
  end;

  if v_media_kind is null
    or (v_media_kind = 'video' and v_authorization.publishing_eligibility not in ('video_only','video_and_photo'))
    or (v_media_kind = 'photo' and v_authorization.publishing_eligibility not in ('photo_only','video_and_photo')) then
    raise exception 'The connected TikTok account is not approved for this media type';
  end if;

  insert into public.tiktok_business_publish_jobs (
    client_id,
    authorization_id,
    monthly_deliverable_id,
    content_review_version_id,
    media_kind,
    due_at,
    created_by
  ) values (
    v_deliverable.client_id,
    v_authorization.id,
    v_deliverable.id,
    v_review.id,
    v_media_kind,
    v_review.scheduled_at,
    p_requested_by
  )
  on conflict (authorization_id, monthly_deliverable_id, content_review_version_id)
  do update set due_at = excluded.due_at
  where public.tiktok_business_publish_jobs.status = 'queued'
  returning id into v_job_id;

  if v_job_id is null then
    raise exception 'This approved TikTok version already has a publish receipt';
  end if;

  update public.monthly_deliverables
  set production_status = 'scheduled'
  where id = v_deliverable.id;

  return v_job_id;
end;
$$;

create or replace function public.claim_due_tiktok_business_publish_jobs(
  p_worker_id text,
  p_limit integer default 10
) returns setof public.tiktok_business_publish_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;

  return query
  with candidates as (
    select job.id
    from public.tiktok_business_publish_jobs job
    join public.tiktok_business_authorizations authorization
      on authorization.id = job.authorization_id
     and authorization.client_id = job.client_id
     and authorization.status = 'connected'
    join public.tiktok_connections connection
      on connection.id = authorization.connection_id
     and connection.client_id = job.client_id
     and connection.status = 'connected'
    join public.monthly_deliverables deliverable
      on deliverable.id = job.monthly_deliverable_id
     and deliverable.client_id = job.client_id
     and deliverable.archived_at is null
     and deliverable.posted_at is null
     and deliverable.production_status = 'scheduled'
    join public.content_review_versions review
      on review.id = job.content_review_version_id
     and review.deliverable_id = deliverable.id
     and review.client_id = job.client_id
     and review.state = 'approved'
     and review.internal_approved_at is not null
     and (not review.client_approval_required or review.client_approved_at is not null)
     and 'tiktok' = any(review.channels)
     and review.scheduled_at = job.due_at
     and review.scheduled_date = deliverable.scheduled_date
    where job.status in ('queued','retry_wait')
      and coalesce(job.next_attempt_at, job.due_at) <= now()
    order by coalesce(job.next_attempt_at, job.due_at), job.id
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  )
  update public.tiktok_business_publish_jobs job
  set status = 'claimed',
      claimed_at = now(),
      claimed_by = left(trim(p_worker_id), 200),
      last_attempt_at = now(),
      attempt_count = job.attempt_count + 1
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

create or replace function public.complete_tiktok_business_publish_job(
  p_job_id uuid,
  p_provider_request_id text,
  p_provider_publish_id text,
  p_provider_post_id text,
  p_provider_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.tiktok_business_publish_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into v_job
  from public.tiktok_business_publish_jobs
  where id = p_job_id
  for update;

  if v_job.id is null or v_job.status not in ('claimed','submitted','processing') then
    raise exception 'Publish job is not awaiting provider completion';
  end if;
  if nullif(trim(p_provider_post_id), '') is null then
    raise exception 'TikTok public post id is required';
  end if;

  update public.tiktok_business_publish_jobs
  set status = 'published',
      provider_request_id = nullif(trim(p_provider_request_id), ''),
      provider_publish_id = nullif(trim(p_provider_publish_id), ''),
      provider_post_id = trim(p_provider_post_id),
      provider_status = nullif(trim(p_provider_status), ''),
      provider_error_code = null,
      provider_error_message = null,
      published_at = now(),
      last_reconciled_at = now()
  where id = v_job.id;

  update public.monthly_deliverables
  set production_status = 'posted', posted_at = now()
  where id = v_job.monthly_deliverable_id
    and client_id = v_job.client_id
    and production_status = 'scheduled'
    and posted_at is null;

  if not found then
    raise exception 'Canonical schedule item changed before TikTok confirmation';
  end if;
end;
$$;

revoke all on function public.queue_tiktok_business_publish(uuid, uuid),
  public.claim_due_tiktok_business_publish_jobs(text, integer),
  public.complete_tiktok_business_publish_job(uuid, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.queue_tiktok_business_publish(uuid, uuid),
  public.claim_due_tiktok_business_publish_jobs(text, integer),
  public.complete_tiktok_business_publish_job(uuid, text, text, text, text)
  to service_role;

revoke all on function public.set_tiktok_business_updated_at(),
  public.guard_tiktok_business_client_mapping()
  from public, anon, authenticated;
