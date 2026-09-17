-- Issue #391: one canonical, audited strategy per exact client + target month.
--
-- Prepared only. Do not apply to production without explicit CA approval.
-- Existing reports.strategy_data remains readable historical/report evidence. It may seed this
-- table, but it is not re-keyed or treated as canonical monthly ownership.

create table public.monthly_client_strategies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  strategy_month date not null,
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'approved', 'published')),
  strategy_data jsonb not null
    check (jsonb_typeof(strategy_data) = 'object'),
  internal_notes text,
  seed_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(seed_context) = 'object'),
  seeded_from_report_id uuid references public.reports(id) on delete set null,
  seeded_at timestamptz not null default now(),
  staff_amended_at timestamptz,
  version integer not null default 1 check (version > 0),
  published_strategy_data jsonb
    check (published_strategy_data is null or jsonb_typeof(published_strategy_data) = 'object'),
  published_version integer check (published_version is null or published_version > 0),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  updated_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  approved_by_profile_id uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  published_by_profile_id uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_client_strategies_exact_month
    check (strategy_month = date_trunc('month', strategy_month)::date),
  constraint monthly_client_strategies_approval_pair
    check ((approved_at is null) = (approved_by_profile_id is null)),
  constraint monthly_client_strategies_publication_set
    check (
      (published_strategy_data is null and published_version is null and published_at is null and published_by_profile_id is null)
      or
      (published_strategy_data is not null and published_version is not null and published_at is not null and published_by_profile_id is not null)
    ),
  unique (client_id, strategy_month)
);

comment on table public.monthly_client_strategies is
  'Canonical strategy for one exact client and target calendar month (#391). reports.strategy_data remains historical report evidence; this row owns monthly strategy.';
comment on column public.monthly_client_strategies.published_strategy_data is
  'Immutable-at-publication client-safe snapshot. Staff amendments update strategy_data and return workflow_status to draft without silently changing this published snapshot.';
comment on column public.monthly_client_strategies.seed_context is
  'Auditable source manifest for deterministic seed inputs, including considered/selected content-calendar moments and exact source record IDs.';

create index monthly_client_strategies_client_month_idx
  on public.monthly_client_strategies (client_id, strategy_month desc);

create table public.monthly_client_strategy_revisions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.monthly_client_strategies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  strategy_month date not null,
  event_kind text not null check (event_kind in ('seeded', 'amended', 'approved', 'published')),
  record_version integer not null check (record_version > 0),
  before_strategy_data jsonb,
  after_strategy_data jsonb not null check (jsonb_typeof(after_strategy_data) = 'object'),
  before_status text check (before_status is null or before_status in ('draft', 'approved', 'published')),
  after_status text not null check (after_status in ('draft', 'approved', 'published')),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  receipt jsonb not null default '{}'::jsonb check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default now(),
  constraint monthly_client_strategy_revisions_exact_month
    check (strategy_month = date_trunc('month', strategy_month)::date),
  unique (strategy_id, idempotency_key)
);

comment on table public.monthly_client_strategy_revisions is
  'Append-only before/after evidence and retry receipt for every canonical monthly strategy transition.';

create index monthly_client_strategy_revisions_strategy_created_idx
  on public.monthly_client_strategy_revisions (strategy_id, created_at desc);

create or replace function public.prevent_monthly_strategy_revision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'monthly_client_strategy_revisions is append-only';
end;
$$;

create trigger trg_monthly_strategy_revisions_append_only
  before update or delete on public.monthly_client_strategy_revisions
  for each row execute function public.prevent_monthly_strategy_revision_mutation();

create or replace function public.touch_monthly_client_strategy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_monthly_client_strategies_updated_at
  before update on public.monthly_client_strategies
  for each row execute function public.touch_monthly_client_strategy();

alter table public.monthly_client_strategies enable row level security;
alter table public.monthly_client_strategy_revisions enable row level security;

create policy "monthly strategies: active staff read"
  on public.monthly_client_strategies for select to authenticated
  using (exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

create policy "monthly strategy revisions: active staff read"
  on public.monthly_client_strategy_revisions for select to authenticated
  using (exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

revoke all on public.monthly_client_strategies from anon, authenticated;
revoke all on public.monthly_client_strategy_revisions from anon, authenticated;
grant select on public.monthly_client_strategies to authenticated;
grant select on public.monthly_client_strategy_revisions to authenticated;

create or replace function public.resolve_monthly_strategy_actor(p_actor_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    v_actor_id := p_actor_profile_id;
  else
    v_actor_id := auth.uid();
    if p_actor_profile_id is not null and p_actor_profile_id is distinct from v_actor_id then
      raise exception 'Actor must match the authenticated user' using errcode = '42501';
    end if;
  end if;

  if v_actor_id is null or not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then
    raise exception 'Active staff access required' using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

create or replace function public.assert_monthly_strategy_input(
  p_client_id uuid,
  p_strategy_month date,
  p_strategy_data jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_strategy_month is null or p_strategy_month <> date_trunc('month', p_strategy_month)::date then
    raise exception 'strategy_month must be the first day of an exact calendar month';
  end if;
  if jsonb_typeof(p_strategy_data) is distinct from 'object' then
    raise exception 'strategy_data must be an object';
  end if;
  if coalesce(p_strategy_data->>'version', '') <> '1' then
    raise exception 'strategy_data must use the existing strategy engine version 1 contract';
  end if;
  if not exists (
    select 1 from public.clients client
    where client.id = p_client_id and client.active
  ) then
    raise exception 'Active client not found';
  end if;
end;
$$;

create or replace function public.seed_monthly_client_strategy(
  p_client_id uuid,
  p_strategy_month date,
  p_strategy_data jsonb,
  p_seed_context jsonb,
  p_seeded_from_report_id uuid,
  p_actor_profile_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_strategy public.monthly_client_strategies;
  v_receipt jsonb;
  v_fingerprint text;
begin
  v_actor_id := public.resolve_monthly_strategy_actor(p_actor_profile_id);
  perform public.assert_monthly_strategy_input(p_client_id, p_strategy_month, p_strategy_data);
  if p_idempotency_key is null then raise exception 'idempotency_key required'; end if;
  if jsonb_typeof(coalesce(p_seed_context, '{}'::jsonb)) <> 'object' then
    raise exception 'seed_context must be an object';
  end if;
  v_fingerprint := md5(jsonb_build_object(
    'client_id', p_client_id, 'strategy_month', p_strategy_month,
    'strategy_data', p_strategy_data, 'seed_context', coalesce(p_seed_context, '{}'::jsonb),
    'seeded_from_report_id', p_seeded_from_report_id
  )::text);
  if p_seeded_from_report_id is not null and not exists (
    select 1 from public.reports report
    where report.id = p_seeded_from_report_id
      and report.client_id = p_client_id
      and report.period_end < p_strategy_month
  ) then
    raise exception 'Seed report must belong to the exact client and end before strategy_month';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('monthly-strategy:' || p_client_id::text || ':' || p_strategy_month::text, 0));
  select * into v_strategy from public.monthly_client_strategies strategy
  where strategy.client_id = p_client_id and strategy.strategy_month = p_strategy_month;
  if v_strategy.id is not null then
    return jsonb_build_object(
      'replayed', true, 'created', false, 'strategy_id', v_strategy.id,
      'client_id', v_strategy.client_id, 'strategy_month', v_strategy.strategy_month,
      'version', v_strategy.version, 'workflow_status', v_strategy.workflow_status
    );
  end if;

  insert into public.monthly_client_strategies (
    client_id, strategy_month, strategy_data, seed_context, seeded_from_report_id,
    created_by_profile_id, updated_by_profile_id
  ) values (
    p_client_id, p_strategy_month, p_strategy_data, coalesce(p_seed_context, '{}'::jsonb),
    p_seeded_from_report_id, v_actor_id, v_actor_id
  ) returning * into v_strategy;

  v_receipt := jsonb_build_object(
    'replayed', false, 'created', true, 'strategy_id', v_strategy.id,
    'client_id', v_strategy.client_id, 'strategy_month', v_strategy.strategy_month,
    'version', v_strategy.version, 'workflow_status', v_strategy.workflow_status,
    'idempotency_key', p_idempotency_key
  );
  insert into public.monthly_client_strategy_revisions (
    strategy_id, client_id, strategy_month, event_kind, record_version,
    before_strategy_data, after_strategy_data, before_status, after_status,
    actor_profile_id, idempotency_key, request_fingerprint, receipt
  ) values (
    v_strategy.id, p_client_id, p_strategy_month, 'seeded', 1,
    null, p_strategy_data, null, 'draft', v_actor_id, p_idempotency_key, v_fingerprint, v_receipt
  );
  return v_receipt;
end;
$$;

create or replace function public.amend_monthly_client_strategy(
  p_client_id uuid,
  p_strategy_month date,
  p_expected_version integer,
  p_strategy_data jsonb,
  p_internal_notes text,
  p_actor_profile_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_strategy public.monthly_client_strategies;
  v_existing public.monthly_client_strategy_revisions;
  v_before jsonb;
  v_before_status text;
  v_receipt jsonb;
  v_fingerprint text;
begin
  v_actor_id := public.resolve_monthly_strategy_actor(p_actor_profile_id);
  perform public.assert_monthly_strategy_input(p_client_id, p_strategy_month, p_strategy_data);
  if p_idempotency_key is null then raise exception 'idempotency_key required'; end if;
  v_fingerprint := md5(jsonb_build_object(
    'client_id', p_client_id, 'strategy_month', p_strategy_month,
    'expected_version', p_expected_version, 'strategy_data', p_strategy_data,
    'internal_notes', nullif(btrim(coalesce(p_internal_notes, '')), '')
  )::text);

  select * into v_strategy from public.monthly_client_strategies strategy
  where strategy.client_id = p_client_id and strategy.strategy_month = p_strategy_month
  for update;
  if v_strategy.id is null then raise exception 'Monthly strategy not found'; end if;

  select * into v_existing from public.monthly_client_strategy_revisions revision
  where revision.strategy_id = v_strategy.id and revision.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_existing.receipt || jsonb_build_object('replayed', true);
  end if;
  if p_expected_version is null or p_expected_version <> v_strategy.version then
    raise exception 'Strategy version conflict';
  end if;

  v_before := v_strategy.strategy_data;
  v_before_status := v_strategy.workflow_status;
  update public.monthly_client_strategies
  set strategy_data = p_strategy_data,
      internal_notes = nullif(btrim(coalesce(p_internal_notes, '')), ''),
      workflow_status = 'draft',
      approved_by_profile_id = null,
      approved_at = null,
      staff_amended_at = now(),
      updated_by_profile_id = v_actor_id,
      version = version + 1
  where id = v_strategy.id
  returning * into v_strategy;

  v_receipt := jsonb_build_object(
    'replayed', false, 'strategy_id', v_strategy.id, 'client_id', p_client_id,
    'strategy_month', p_strategy_month, 'version', v_strategy.version,
    'workflow_status', v_strategy.workflow_status, 'idempotency_key', p_idempotency_key
  );
  insert into public.monthly_client_strategy_revisions (
    strategy_id, client_id, strategy_month, event_kind, record_version,
    before_strategy_data, after_strategy_data, before_status, after_status,
    actor_profile_id, idempotency_key, request_fingerprint, receipt
  ) values (
    v_strategy.id, p_client_id, p_strategy_month, 'amended', v_strategy.version,
    v_before, v_strategy.strategy_data, v_before_status, 'draft',
    v_actor_id, p_idempotency_key, v_fingerprint, v_receipt
  );
  return v_receipt;
end;
$$;

create or replace function public.transition_monthly_client_strategy(
  p_client_id uuid,
  p_strategy_month date,
  p_expected_version integer,
  p_target_status text,
  p_actor_profile_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_strategy public.monthly_client_strategies;
  v_existing public.monthly_client_strategy_revisions;
  v_before_status text;
  v_event_kind text;
  v_receipt jsonb;
  v_fingerprint text;
begin
  v_actor_id := public.resolve_monthly_strategy_actor(p_actor_profile_id);
  if p_strategy_month is null or p_strategy_month <> date_trunc('month', p_strategy_month)::date then
    raise exception 'strategy_month must be the first day of an exact calendar month';
  end if;
  if p_target_status not in ('approved', 'published') then raise exception 'Unsupported strategy transition'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key required'; end if;
  v_fingerprint := md5(jsonb_build_object(
    'client_id', p_client_id, 'strategy_month', p_strategy_month,
    'expected_version', p_expected_version, 'target_status', p_target_status
  )::text);

  select * into v_strategy from public.monthly_client_strategies strategy
  where strategy.client_id = p_client_id and strategy.strategy_month = p_strategy_month
  for update;
  if v_strategy.id is null then raise exception 'Monthly strategy not found'; end if;

  select * into v_existing from public.monthly_client_strategy_revisions revision
  where revision.strategy_id = v_strategy.id and revision.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_existing.receipt || jsonb_build_object('replayed', true);
  end if;
  if p_expected_version is null or p_expected_version <> v_strategy.version then
    raise exception 'Strategy version conflict';
  end if;
  if p_target_status = 'approved' and v_strategy.workflow_status <> 'draft' then
    raise exception 'Only a draft strategy can be approved';
  end if;
  if p_target_status = 'published' and v_strategy.workflow_status <> 'approved' then
    raise exception 'Only an approved strategy can be published';
  end if;

  v_before_status := v_strategy.workflow_status;
  v_event_kind := case when p_target_status = 'approved' then 'approved' else 'published' end;
  if p_target_status = 'approved' then
    update public.monthly_client_strategies
    set workflow_status = 'approved', approved_by_profile_id = v_actor_id,
        approved_at = now(), updated_by_profile_id = v_actor_id
    where id = v_strategy.id returning * into v_strategy;
  else
    update public.monthly_client_strategies
    set workflow_status = 'published',
        published_strategy_data = public.client_safe_strategy_data(strategy_data),
        published_version = version, published_by_profile_id = v_actor_id,
        published_at = now(), updated_by_profile_id = v_actor_id
    where id = v_strategy.id returning * into v_strategy;
  end if;

  v_receipt := jsonb_build_object(
    'replayed', false, 'strategy_id', v_strategy.id, 'client_id', p_client_id,
    'strategy_month', p_strategy_month, 'version', v_strategy.version,
    'workflow_status', v_strategy.workflow_status, 'idempotency_key', p_idempotency_key
  );
  insert into public.monthly_client_strategy_revisions (
    strategy_id, client_id, strategy_month, event_kind, record_version,
    before_strategy_data, after_strategy_data, before_status, after_status,
    actor_profile_id, idempotency_key, request_fingerprint, receipt
  ) values (
    v_strategy.id, p_client_id, p_strategy_month, v_event_kind, v_strategy.version,
    v_strategy.strategy_data, v_strategy.strategy_data, v_before_status, p_target_status,
    v_actor_id, p_idempotency_key, v_fingerprint, v_receipt
  );
  return v_receipt;
end;
$$;

create or replace function public.client_monthly_strategy(p_strategy_month date)
returns table (
  strategy_month date,
  strategy_data jsonb,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  if p_strategy_month is null or p_strategy_month <> date_trunc('month', p_strategy_month)::date then
    raise exception 'strategy_month must be the first day of an exact calendar month';
  end if;
  select profile.client_id into v_client_id
  from public.profiles profile
  where profile.id = auth.uid() and profile.is_active and profile.role = 'client';
  if v_client_id is null then raise exception 'Active client access required' using errcode = '42501'; end if;

  return query
  select strategy.strategy_month, strategy.published_strategy_data, strategy.published_at
  from public.monthly_client_strategies strategy
  where strategy.client_id = v_client_id
    and strategy.strategy_month = p_strategy_month
    and strategy.published_strategy_data is not null;
end;
$$;

revoke all on function public.prevent_monthly_strategy_revision_mutation() from public, anon, authenticated;
revoke all on function public.touch_monthly_client_strategy() from public, anon, authenticated;
revoke all on function public.resolve_monthly_strategy_actor(uuid) from public, anon, authenticated;
revoke all on function public.assert_monthly_strategy_input(uuid, date, jsonb) from public, anon, authenticated;
revoke all on function public.seed_monthly_client_strategy(uuid, date, jsonb, jsonb, uuid, uuid, uuid) from public, anon;
revoke all on function public.amend_monthly_client_strategy(uuid, date, integer, jsonb, text, uuid, uuid) from public, anon;
revoke all on function public.transition_monthly_client_strategy(uuid, date, integer, text, uuid, uuid) from public, anon;
revoke all on function public.client_monthly_strategy(date) from public, anon;

grant execute on function public.seed_monthly_client_strategy(uuid, date, jsonb, jsonb, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.amend_monthly_client_strategy(uuid, date, integer, jsonb, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.transition_monthly_client_strategy(uuid, date, integer, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.client_monthly_strategy(date) to authenticated;
