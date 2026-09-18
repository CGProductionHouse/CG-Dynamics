-- Issue #404: exact, idempotent CG Hours -> CG Dynamics client registry bridge.
--
-- This migration deliberately contains no backfill. CG Hours UUIDs are the only
-- external identity used by this bridge; client names are collision guards, not
-- identity, and short_code/package/onboarding/access data are never inferred.

create table if not exists public.cg_hours_client_mapping (
  dynamics_client_id uuid primary key references public.clients(id) on delete restrict,
  hours_client_id uuid not null unique,
  hours_name_at_mapping text not null check (length(btrim(hours_name_at_mapping)) between 1 and 200),
  source text not null default 'cg_hours_bridge' check (source = 'cg_hours_bridge'),
  created_at timestamptz not null default now()
);

create table if not exists public.cg_hours_client_requests (
  request_id uuid primary key,
  hours_client_id uuid not null,
  exact_name text not null check (length(btrim(exact_name)) between 1 and 200),
  outcome text not null check (outcome in ('created', 'mapped', 'reconciliation_required')),
  dynamics_client_id uuid references public.clients(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists cg_hours_client_requests_hours_client_id_idx
  on public.cg_hours_client_requests (hours_client_id, created_at desc);

alter table public.cg_hours_client_mapping enable row level security;
alter table public.cg_hours_client_mapping force row level security;
alter table public.cg_hours_client_requests enable row level security;
alter table public.cg_hours_client_requests force row level security;

revoke all on public.cg_hours_client_mapping from public, anon, authenticated;
revoke all on public.cg_hours_client_requests from public, anon, authenticated;
grant all on public.cg_hours_client_mapping to service_role;
grant all on public.cg_hours_client_requests to service_role;

comment on table public.cg_hours_client_mapping is
  'Exact UUID authority between a CG Hours client and its canonical CG Dynamics client. Service-role only.';
comment on table public.cg_hours_client_requests is
  'Immutable request receipts for the authenticated CG Hours client-registry bridge. No credentials are stored.';

create or replace function public.ensure_client_from_cg_hours(
  p_hours_client_id uuid,
  p_exact_name text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_exact_name);
  v_existing_request public.cg_hours_client_requests%rowtype;
  v_mapping public.cg_hours_client_mapping%rowtype;
  v_client public.clients%rowtype;
  v_collision public.clients%rowtype;
  v_result jsonb;
begin
  if p_hours_client_id is null or p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_identity');
  end if;
  if v_name = '' or length(v_name) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name');
  end if;

  -- Serialize all attempts for one exact Hours identity. This makes concurrent
  -- first delivery and retry converge on one mapping and one Dynamics client.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_hours_client_id::text, 0)
  );

  select * into v_existing_request
  from public.cg_hours_client_requests
  where request_id = p_request_id;

  if found then
    if v_existing_request.hours_client_id <> p_hours_client_id
       or v_existing_request.exact_name <> v_name then
      return jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    return v_existing_request.result;
  end if;

  select * into v_mapping
  from public.cg_hours_client_mapping
  where hours_client_id = p_hours_client_id;

  if found then
    select * into v_client
    from public.clients
    where id = v_mapping.dynamics_client_id;

    v_result := jsonb_build_object(
      'ok', true,
      'status', 'mapped',
      'hoursClientId', p_hours_client_id,
      'dynamicsClientId', v_mapping.dynamics_client_id,
      'canonicalName', v_client.name,
      'nameDrift', v_client.name <> v_name
    );
    insert into public.cg_hours_client_requests
      (request_id, hours_client_id, exact_name, outcome, dynamics_client_id, result)
    values
      (p_request_id, p_hours_client_id, v_name, 'mapped', v_mapping.dynamics_client_id, v_result);
    return v_result;
  end if;

  -- Deliberately exact-only. Case/outer whitespace normalization prevents a
  -- duplicate spelling variant, but no token, substring, alias or fuzzy match
  -- is ever attempted. A human must reconcile any collision.
  select * into v_collision
  from public.clients
  where lower(btrim(name)) = lower(v_name)
  order by id
  limit 1;

  if found then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'name_collision',
      'status', 'reconciliation_required',
      'hoursClientId', p_hours_client_id,
      'canonicalName', v_collision.name
    );
    insert into public.cg_hours_client_requests
      (request_id, hours_client_id, exact_name, outcome, result)
    values
      (p_request_id, p_hours_client_id, v_name, 'reconciliation_required', v_result);
    return v_result;
  end if;

  insert into public.clients (name, tier, active, package_settings, short_code)
  values (v_name, 'standard', true, '{}'::jsonb, null)
  returning * into v_client;

  insert into public.cg_hours_client_mapping
    (dynamics_client_id, hours_client_id, hours_name_at_mapping)
  values
    (v_client.id, p_hours_client_id, v_name);

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'created',
    'hoursClientId', p_hours_client_id,
    'dynamicsClientId', v_client.id,
    'canonicalName', v_client.name,
    'nameDrift', false
  );
  insert into public.cg_hours_client_requests
    (request_id, hours_client_id, exact_name, outcome, dynamics_client_id, result)
  values
    (p_request_id, p_hours_client_id, v_name, 'created', v_client.id, v_result);
  return v_result;
end;
$$;

revoke all on function public.ensure_client_from_cg_hours(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_client_from_cg_hours(uuid, text, uuid)
  to service_role;

comment on function public.ensure_client_from_cg_hours(uuid, text, uuid) is
  'Service-role-only atomic ensure action for issue #404. Exact Hours UUID identity; no fuzzy name attachment.';
