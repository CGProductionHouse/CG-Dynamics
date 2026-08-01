-- Canonical AI usage, budget, routing, and provider-health backend.
-- Default monthly guardrails are deliberately conservative: ZAR 500 soft and
-- ZAR 750 hard. Pricing is an estimate snapshot, never a provider billing claim.
-- Review this migration in the Supabase SQL editor before production use.

create table if not exists public.ai_provider_routes (
  id uuid primary key default gen_random_uuid(),
  capability text not null check (capability in ('text', 'transcription')),
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  model text not null check (length(btrim(model)) between 1 and 160),
  tier text not null check (tier in ('cheap', 'strong')),
  priority integer not null check (priority between 1 and 1000),
  enabled boolean not null default true,
  pricing_currency text not null check (pricing_currency in ('USD', 'ZAR')),
  input_per_million_micros bigint check (input_per_million_micros >= 0),
  output_per_million_micros bigint check (output_per_million_micros >= 0),
  audio_per_minute_micros bigint check (audio_per_minute_micros >= 0),
  request_cost_micros bigint check (request_cost_micros >= 0),
  fx_zar_micros bigint not null check (fx_zar_micros > 0),
  pricing_source text not null check (length(btrim(pricing_source)) between 1 and 300),
  pricing_as_of date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capability, provider, model)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ai_provider_routes_priority_unique' and conrelid = 'public.ai_provider_routes'::regclass) then
    alter table public.ai_provider_routes add constraint ai_provider_routes_priority_unique
      unique (capability, tier, priority) deferrable initially deferred;
  end if;
end $$;

create table if not exists public.ai_monthly_budgets (
  month date primary key check (month = date_trunc('month', month)::date),
  soft_limit_zar_micros bigint not null check (soft_limit_zar_micros >= 0),
  hard_limit_zar_micros bigint not null check (hard_limit_zar_micros >= soft_limit_zar_micros),
  committed_zar_micros bigint not null default 0 check (committed_zar_micros >= 0),
  reserved_zar_micros bigint not null default 0 check (reserved_zar_micros >= 0),
  warning_threshold_percent integer not null default 80 check (warning_threshold_percent between 1 and 100),
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_requests (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.ai_monthly_budgets(month),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 200),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  feature text not null check (length(btrim(feature)) between 1 and 80),
  action text not null check (length(btrim(action)) between 1 and 100),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  capability text not null check (capability in ('text', 'transcription')),
  complexity text not null check (complexity in ('simple', 'complex')),
  status text not null check (status in ('reserved', 'succeeded', 'failed', 'denied', 'deduplicated')),
  budget_state text not null check (budget_state in ('ok', 'warning', 'soft_exceeded', 'hard_denied')),
  warning_version integer not null,
  reservation_zar_micros bigint not null default 0 check (reservation_zar_micros >= 0),
  actual_zar_micros bigint check (actual_zar_micros >= 0),
  cost_source text not null default 'estimated' check (cost_source in ('estimated', 'reserved_upper_bound')),
  max_input_tokens integer check (max_input_tokens >= 0),
  max_output_tokens integer check (max_output_tokens >= 0),
  max_audio_seconds integer check (max_audio_seconds >= 0),
  latency_ms integer check (latency_ms >= 0),
  safe_error_code text check (safe_error_code ~ '^[A-Z0-9_]{2,80}$'),
  created_at timestamptz not null default now(),
  reservation_expires_at timestamptz,
  finalized_at timestamptz,
  unique (actor_id, idempotency_key)
);

alter table public.ai_usage_requests add column if not exists reservation_expires_at timestamptz;
alter table public.ai_usage_requests drop constraint if exists ai_usage_requests_cost_source_check;
alter table public.ai_usage_requests add constraint ai_usage_requests_cost_source_check
  check (cost_source in ('estimated', 'reserved_upper_bound'));
create index if not exists ai_usage_requests_month_created_idx on public.ai_usage_requests (month, created_at desc);
create index if not exists ai_usage_requests_reservation_expiry_idx
  on public.ai_usage_requests (reservation_expires_at) where status = 'reserved';
create index if not exists ai_usage_requests_dedupe_idx
  on public.ai_usage_requests (actor_id, feature, action, fingerprint, created_at desc);

create table if not exists public.ai_usage_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ai_usage_requests(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  requested_model text not null check (length(btrim(requested_model)) between 1 and 160),
  actual_model text check (length(btrim(actual_model)) between 1 and 200),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  audio_seconds numeric(12,3) check (audio_seconds >= 0),
  estimated_provider_cost_micros bigint check (estimated_provider_cost_micros >= 0),
  estimated_zar_cost_micros bigint check (estimated_zar_cost_micros >= 0),
  cost_currency text check (cost_currency in ('USD', 'ZAR')),
  cost_source text not null default 'estimated' check (cost_source = 'estimated'),
  status text not null check (status in ('skipped', 'succeeded', 'failed')),
  outcome text not null check (outcome in ('success', 'missing_secret', 'degraded', 'http_error', 'timeout', 'invalid_response', 'network_error', 'provider_error')),
  retry_number integer not null default 0 check (retry_number >= 0),
  fallback boolean not null default false,
  latency_ms integer check (latency_ms >= 0),
  http_status integer check (http_status between 100 and 599),
  safe_error_code text check (safe_error_code ~ '^[A-Z0-9_]{2,80}$'),
  created_at timestamptz not null default now(),
  unique (request_id, attempt_number)
);

create index if not exists ai_usage_attempts_request_idx on public.ai_usage_attempts (request_id, attempt_number);
create index if not exists ai_usage_attempts_provider_idx on public.ai_usage_attempts (provider, created_at desc);

create table if not exists public.ai_provider_health_observations (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.ai_provider_routes(id) on delete set null,
  request_id uuid references public.ai_usage_requests(id) on delete set null,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  model text not null check (length(btrim(model)) between 1 and 200),
  observation text not null check (observation in ('configured', 'missing_secret', 'success', 'failure', 'degraded_skip')),
  safe_error_code text check (safe_error_code ~ '^[A-Z0-9_]{2,80}$'),
  http_status integer check (http_status between 100 and 599),
  latency_ms integer check (latency_ms >= 0),
  observed_at timestamptz not null default now()
);

create index if not exists ai_provider_health_recent_idx
  on public.ai_provider_health_observations (provider, model, observed_at desc);

-- Short-lived idempotency payloads are server infrastructure, not an admin
-- reporting surface. They never contain prompts, provider keys, or raw audio.
create table if not exists public.ai_usage_replays (
  request_id uuid not null references public.ai_usage_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('text_response', 'suggestion_response', 'debrief_transcript', 'meeting_debrief_draft', 'content_run_debrief_draft')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 262144
    and not (payload ?| array['prompt','prompts','messages','systemPrompt','userMessage','apiKey','secret','authorization','password','credential'])
  ),
  expires_at timestamptz not null check (expires_at <= created_at + interval '15 minutes'),
  created_at timestamptz not null default now(),
  primary key (request_id, kind)
);
alter table public.ai_usage_replays drop constraint if exists ai_usage_replays_kind_check;
alter table public.ai_usage_replays add constraint ai_usage_replays_kind_check
  check (kind in ('text_response', 'suggestion_response', 'debrief_transcript', 'meeting_debrief_draft', 'content_run_debrief_draft'));
alter table public.ai_usage_replays drop constraint if exists ai_usage_replays_payload_check;
alter table public.ai_usage_replays add constraint ai_usage_replays_payload_check check (
  jsonb_typeof(payload) = 'object'
  and octet_length(payload::text) <= 262144
  and not (payload ?| array['prompt','prompts','messages','systemPrompt','userMessage','apiKey','secret','authorization','password','credential'])
);
create index if not exists ai_usage_replays_expiry_idx on public.ai_usage_replays (expires_at);

alter table public.ai_provider_routes enable row level security;
alter table public.ai_provider_routes force row level security;
alter table public.ai_monthly_budgets enable row level security;
alter table public.ai_monthly_budgets force row level security;
alter table public.ai_usage_requests enable row level security;
alter table public.ai_usage_requests force row level security;
alter table public.ai_usage_attempts enable row level security;
alter table public.ai_usage_attempts force row level security;
alter table public.ai_provider_health_observations enable row level security;
alter table public.ai_provider_health_observations force row level security;
alter table public.ai_usage_replays enable row level security;
alter table public.ai_usage_replays force row level security;

drop policy if exists "ai routes: active admin read" on public.ai_provider_routes;
create policy "ai routes: active admin read" on public.ai_provider_routes
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ));
drop policy if exists "ai budgets: active admin read" on public.ai_monthly_budgets;
create policy "ai budgets: active admin read" on public.ai_monthly_budgets
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ));
drop policy if exists "ai requests: active admin read" on public.ai_usage_requests;
create policy "ai requests: active admin read" on public.ai_usage_requests
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ));
drop policy if exists "ai attempts: active admin read" on public.ai_usage_attempts;
create policy "ai attempts: active admin read" on public.ai_usage_attempts
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ));
drop policy if exists "ai health: active admin read" on public.ai_provider_health_observations;
create policy "ai health: active admin read" on public.ai_provider_health_observations
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ));

revoke all on table public.ai_provider_routes from public, anon, authenticated;
revoke all on table public.ai_monthly_budgets from public, anon, authenticated;
revoke all on table public.ai_usage_requests from public, anon, authenticated;
revoke all on table public.ai_usage_attempts from public, anon, authenticated;
revoke all on table public.ai_provider_health_observations from public, anon, authenticated;
revoke all on table public.ai_usage_replays from public, anon, authenticated;
grant select on table public.ai_provider_routes, public.ai_monthly_budgets,
  public.ai_usage_requests, public.ai_usage_attempts,
  public.ai_provider_health_observations to authenticated;
grant all on table public.ai_provider_routes, public.ai_monthly_budgets,
  public.ai_usage_requests, public.ai_usage_attempts,
  public.ai_provider_health_observations to service_role;
grant all on table public.ai_usage_replays to service_role;

-- Internal integer-micros estimate. NULL means the snapshot cannot safely price
-- the supplied modality; zero is reserved for an explicitly free snapshot.
create or replace function public.ai_estimated_route_cost(
  p_route public.ai_provider_routes,
  p_input_tokens integer,
  p_output_tokens integer,
  p_audio_seconds numeric
) returns table(provider_cost_micros bigint, zar_cost_micros bigint)
language sql immutable set search_path = public
as $$
  select
    case
      when p_route.request_cost_micros is null
        or (p_input_tokens is not null and p_route.input_per_million_micros is null)
        or (p_output_tokens is not null and p_route.output_per_million_micros is null)
        or (p_audio_seconds is not null and p_route.audio_per_minute_micros is null)
      then null
      else p_route.request_cost_micros
        + coalesce(ceil(p_input_tokens::numeric * p_route.input_per_million_micros / 1000000)::bigint, 0)
        + coalesce(ceil(p_output_tokens::numeric * p_route.output_per_million_micros / 1000000)::bigint, 0)
        + coalesce(ceil(p_audio_seconds * p_route.audio_per_minute_micros / 60)::bigint, 0)
    end,
    case
      when p_route.request_cost_micros is null
        or (p_input_tokens is not null and p_route.input_per_million_micros is null)
        or (p_output_tokens is not null and p_route.output_per_million_micros is null)
        or (p_audio_seconds is not null and p_route.audio_per_minute_micros is null)
      then null
      else ceil((p_route.request_cost_micros
        + coalesce(ceil(p_input_tokens::numeric * p_route.input_per_million_micros / 1000000), 0)
        + coalesce(ceil(p_output_tokens::numeric * p_route.output_per_million_micros / 1000000), 0)
        + coalesce(ceil(p_audio_seconds * p_route.audio_per_minute_micros / 60), 0))
        * p_route.fx_zar_micros / 1000000)::bigint
    end;
$$;
revoke all on function public.ai_estimated_route_cost(public.ai_provider_routes, integer, integer, numeric) from public, anon, authenticated;

create or replace function public.ai_reconcile_stale_usage()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_request public.ai_usage_requests;
  v_reconciled integer := 0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  for v_request in
    select * from public.ai_usage_requests
    where status = 'reserved' and reservation_expires_at <= now()
    order by reservation_expires_at
    for update skip locked
  loop
    perform 1 from public.ai_monthly_budgets where month = v_request.month for update;
    update public.ai_monthly_budgets set
      reserved_zar_micros = greatest(0, reserved_zar_micros - v_request.reservation_zar_micros),
      committed_zar_micros = committed_zar_micros + v_request.reservation_zar_micros,
      updated_at = now()
    where month = v_request.month;
    update public.ai_usage_requests set
      status = 'failed',
      actual_zar_micros = null,
      cost_source = 'reserved_upper_bound',
      safe_error_code = 'AI_STALE_RESERVATION_RECONCILED',
      finalized_at = now()
    where id = v_request.id and status = 'reserved';
    if found then v_reconciled := v_reconciled + 1; end if;
  end loop;
  delete from public.ai_usage_replays where expires_at <= now();
  return v_reconciled;
end;
$$;

create or replace function public.ai_replay_payload_is_safe(p_payload jsonb)
returns boolean
language plpgsql immutable set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if p_payload is null then return false; end if;
  if jsonb_typeof(p_payload) = 'object' then
    for v_key, v_value in select key, value from jsonb_each(p_payload) loop
      if v_key ~* '(prompt|messages|system.?prompt|user.?message|api.?key|secret|authorization|password|credential|access.?token|refresh.?token)' then
        return false;
      end if;
      if not public.ai_replay_payload_is_safe(v_value) then return false; end if;
    end loop;
  elsif jsonb_typeof(p_payload) = 'array' then
    for v_value in select value from jsonb_array_elements(p_payload) loop
      if not public.ai_replay_payload_is_safe(v_value) then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_replays_payload_safe'
      and conrelid = 'public.ai_usage_replays'::regclass
  ) then
    alter table public.ai_usage_replays add constraint ai_usage_replays_payload_safe
      check (public.ai_replay_payload_is_safe(payload));
  end if;
end $$;

create or replace function public.ai_store_usage_replay(
  p_request_id uuid, p_fingerprint text, p_kind text, p_actor_id uuid, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_kind not in ('text_response', 'suggestion_response', 'debrief_transcript', 'meeting_debrief_draft', 'content_run_debrief_draft')
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 262144
    or not public.ai_replay_payload_is_safe(p_payload) then
    raise exception 'Invalid AI replay';
  end if;
  if not exists (
    select 1 from public.ai_usage_requests r
    where r.id = p_request_id and r.actor_id = p_actor_id and r.fingerprint = p_fingerprint
  ) then raise exception 'AI replay request mismatch'; end if;
  delete from public.ai_usage_replays where expires_at <= now();
  insert into public.ai_usage_replays(request_id, actor_id, fingerprint, kind, payload, expires_at)
  values (p_request_id, p_actor_id, p_fingerprint, p_kind, p_payload, now() + interval '15 minutes')
  on conflict (request_id, kind) do update set
    payload = excluded.payload, expires_at = excluded.expires_at, created_at = now();
end;
$$;

create or replace function public.ai_fetch_usage_replay(
  p_request_id uuid, p_fingerprint text, p_kind text, p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_payload jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  delete from public.ai_usage_replays where expires_at <= now();
  select replay.payload into v_payload
  from public.ai_usage_replays replay
  where replay.request_id = p_request_id and replay.actor_id = p_actor_id
    and replay.fingerprint = p_fingerprint and replay.kind = p_kind
    and replay.expires_at > now();
  return v_payload;
end;
$$;

create or replace function public.ai_delete_usage_replay(
  p_fingerprint text, p_kind text, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  delete from public.ai_usage_replays replay
  where replay.actor_id = p_actor_id and replay.fingerprint = p_fingerprint and replay.kind = p_kind;
  delete from public.ai_usage_replays where expires_at <= now();
end;
$$;

revoke all on function public.ai_reconcile_stale_usage() from public, anon, authenticated;
revoke all on function public.ai_replay_payload_is_safe(jsonb) from public, anon, authenticated;
revoke all on function public.ai_store_usage_replay(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ai_fetch_usage_replay(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_delete_usage_replay(text, text, uuid) from public, anon, authenticated;
grant execute on function public.ai_reconcile_stale_usage() to service_role;
grant execute on function public.ai_store_usage_replay(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.ai_fetch_usage_replay(uuid, text, text, uuid) to service_role;
grant execute on function public.ai_delete_usage_replay(text, text, uuid) to service_role;

create or replace function public.ai_reserve_usage(
  p_idempotency_key text,
  p_fingerprint text,
  p_feature text,
  p_action text,
  p_actor_id uuid,
  p_capability text,
  p_complexity text,
  p_max_input_tokens integer default null,
  p_max_output_tokens integer default null,
  p_max_audio_seconds integer default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_budget public.ai_monthly_budgets;
  v_existing public.ai_usage_requests;
  v_duplicate public.ai_usage_requests;
  v_reservation bigint;
  v_eligible_routes integer;
  v_priced_routes integer;
  v_projected bigint;
  v_state text := 'ok';
  v_request_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  perform public.ai_reconcile_stale_usage();
  if nullif(btrim(p_idempotency_key), '') is null or p_idempotency_key !~ '^.{8,200}$' then raise exception 'Invalid idempotency key'; end if;
  if p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint'; end if;
  if p_capability not in ('text', 'transcription') or p_complexity not in ('simple', 'complex') then raise exception 'Invalid AI request class'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor_id and p.is_active and p.role in ('admin','manager','staff','team')) then
    raise exception 'Active workforce actor required';
  end if;

  -- The budget row is the monthly serialization point. Competing reservations
  -- cannot both observe the same remaining hard-limit capacity.
  select * into v_budget from public.ai_monthly_budgets where month = v_month for update;
  if v_budget.month is null then raise exception 'AI budget is not configured for current month'; end if;

  select * into v_existing from public.ai_usage_requests
  where actor_id = p_actor_id and idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.fingerprint <> p_fingerprint then raise exception 'AI_IDEMPOTENCY_FINGERPRINT_CONFLICT'; end if;
    return jsonb_build_object('allowed', false, 'duplicate', true, 'request_id', v_existing.id,
      'status', v_existing.status, 'budget_state', v_existing.budget_state);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':' || p_feature || ':' || p_action || ':' || p_fingerprint, 0));
  select * into v_duplicate from public.ai_usage_requests
  where actor_id = p_actor_id and feature = p_feature and action = p_action
    and fingerprint = p_fingerprint and created_at >= now() - interval '30 seconds'
  order by created_at desc limit 1;
  if v_duplicate.id is not null then
    return jsonb_build_object('allowed', false, 'duplicate', true, 'request_id', v_duplicate.id,
      'status', v_duplicate.status, 'budget_state', v_duplicate.budget_state);
  end if;

  -- The routers make at most four provider calls. Missing secrets and degraded
  -- routes can be skipped, so reserve the four highest eligible route costs,
  -- not merely the first four priorities or the largest single attempt.
  select sum(candidate.zar_cost_micros), count(*), count(candidate.zar_cost_micros)
    into v_reservation, v_eligible_routes, v_priced_routes
  from (
    select cost.zar_cost_micros
    from public.ai_provider_routes route
    cross join lateral public.ai_estimated_route_cost(
      route,
      case when p_capability = 'text' then p_max_input_tokens else null end,
      case when p_capability = 'text' then p_max_output_tokens else null end,
      case when p_capability = 'transcription' then p_max_audio_seconds::numeric else null end
    ) cost
    where route.enabled and route.capability = p_capability
      and (p_complexity = 'complex' or route.tier = 'cheap')
    order by cost.zar_cost_micros desc nulls first
    limit 4
  ) candidate;
  if v_eligible_routes = 0 or v_priced_routes <> v_eligible_routes then
    raise exception 'No safely priced AI route is enabled';
  end if;

  v_projected := v_budget.committed_zar_micros + v_budget.reserved_zar_micros + v_reservation;
  if v_projected > v_budget.hard_limit_zar_micros then
    insert into public.ai_usage_requests (
      month, idempotency_key, fingerprint, feature, action, actor_id, capability,
      complexity, status, budget_state, warning_version, reservation_zar_micros,
      max_input_tokens, max_output_tokens, max_audio_seconds, finalized_at, safe_error_code
    ) values (
      v_month, p_idempotency_key, p_fingerprint, p_feature, p_action, p_actor_id, p_capability,
      p_complexity, 'denied', 'hard_denied', v_budget.version, 0,
      p_max_input_tokens, p_max_output_tokens, p_max_audio_seconds, now(), 'AI_HARD_BUDGET'
    ) returning id into v_request_id;
    return jsonb_build_object('allowed', false, 'duplicate', false, 'request_id', v_request_id,
      'status', 'denied', 'budget_state', 'hard_denied', 'reservation_zar_micros', 0);
  end if;

  if v_projected > v_budget.soft_limit_zar_micros then v_state := 'soft_exceeded';
  elsif v_projected * 100 >= v_budget.soft_limit_zar_micros * v_budget.warning_threshold_percent then v_state := 'warning';
  end if;

  update public.ai_monthly_budgets
  set reserved_zar_micros = reserved_zar_micros + v_reservation, updated_at = now()
  where month = v_month;
  insert into public.ai_usage_requests (
    month, idempotency_key, fingerprint, feature, action, actor_id, capability,
    complexity, status, budget_state, warning_version, reservation_zar_micros,
    max_input_tokens, max_output_tokens, max_audio_seconds, reservation_expires_at
  ) values (
    v_month, p_idempotency_key, p_fingerprint, p_feature, p_action, p_actor_id, p_capability,
    p_complexity, 'reserved', v_state, v_budget.version, v_reservation,
    p_max_input_tokens, p_max_output_tokens, p_max_audio_seconds, now() + interval '10 minutes'
  ) returning id into v_request_id;
  return jsonb_build_object('allowed', true, 'duplicate', false, 'request_id', v_request_id,
    'status', 'reserved', 'budget_state', v_state, 'reservation_zar_micros', v_reservation);
end;
$$;

create or replace function public.ai_finalize_usage(
  p_request_id uuid,
  p_status text,
  p_latency_ms integer default null,
  p_safe_error_code text default null,
  p_billing_uncertain boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_request public.ai_usage_requests;
  v_actual bigint;
  v_attempted integer;
  v_unknown integer;
  v_commit bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_status not in ('succeeded', 'failed') then raise exception 'Invalid final AI status'; end if;
  select * into v_request from public.ai_usage_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'AI usage request not found'; end if;
  select sum(estimated_zar_cost_micros) filter (where status <> 'skipped'),
    count(*) filter (where status <> 'skipped'),
    count(*) filter (where status <> 'skipped' and estimated_zar_cost_micros is null)
    into v_actual, v_attempted, v_unknown
  from public.ai_usage_attempts where request_id = p_request_id;
  if v_request.status <> 'reserved' then
    return jsonb_build_object('request_id', v_request.id, 'status', v_request.status, 'already_finalized', true);
  end if;
  perform 1 from public.ai_monthly_budgets where month = v_request.month for update;
  v_commit := case
    when p_billing_uncertain then v_request.reservation_zar_micros
    when v_attempted = 0 then 0
    when v_unknown > 0 then v_request.reservation_zar_micros
    else coalesce(v_actual, 0)
  end;
  update public.ai_monthly_budgets set
    reserved_zar_micros = greatest(0, reserved_zar_micros - v_request.reservation_zar_micros),
    committed_zar_micros = committed_zar_micros + v_commit,
    updated_at = now()
  where month = v_request.month;
  update public.ai_usage_requests set
    status = p_status,
    -- Partial known estimates are not presented as a complete actual. Unknown
    -- or ambiguously billed attempts instead commit the reserved upper bound.
    actual_zar_micros = case when not p_billing_uncertain and v_attempted > 0 and v_unknown = 0 then v_actual else null end,
    cost_source = case when p_billing_uncertain or (v_attempted > 0 and v_unknown > 0) then 'reserved_upper_bound' else 'estimated' end,
    latency_ms = p_latency_ms,
    safe_error_code = p_safe_error_code,
    reservation_expires_at = null,
    finalized_at = now()
  where id = p_request_id;
  return jsonb_build_object('request_id', p_request_id, 'status', p_status,
    'actual_zar_micros', case when not p_billing_uncertain and v_attempted > 0 and v_unknown = 0 then v_actual else null end,
    'committed_zar_micros', v_commit, 'already_finalized', false);
end;
$$;

-- Replay persistence and budget finalization are one PostgreSQL transaction.
-- Retrying this RPC after a lost response is safe: replay upsert is idempotent
-- and ai_finalize_usage returns already_finalized without charging twice.
create or replace function public.ai_finalize_usage_with_replay(
  p_request_id uuid,
  p_status text,
  p_latency_ms integer default null,
  p_safe_error_code text default null,
  p_billing_uncertain boolean default false,
  p_replay_fingerprint text default null,
  p_replay_kind text default null,
  p_replay_actor_id uuid default null,
  p_replay_payload jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_has_replay boolean := p_replay_kind is not null or p_replay_payload is not null
    or p_replay_fingerprint is not null or p_replay_actor_id is not null;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if v_has_replay then
    if p_status <> 'succeeded'
      or p_replay_fingerprint is null or p_replay_actor_id is null or p_replay_payload is null
      or p_replay_kind not in ('text_response', 'suggestion_response', 'debrief_transcript', 'meeting_debrief_draft', 'content_run_debrief_draft')
      or p_replay_fingerprint !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(p_replay_payload) <> 'object'
      or octet_length(p_replay_payload::text) > 262144
      or not public.ai_replay_payload_is_safe(p_replay_payload) then
      raise exception 'Invalid AI replay';
    end if;
    if not exists (
      select 1 from public.ai_usage_requests request
      where request.id = p_request_id and request.actor_id = p_replay_actor_id
        and request.fingerprint = p_replay_fingerprint
        and request.status in ('reserved', 'succeeded')
    ) then
      raise exception 'AI replay request mismatch';
    end if;
    delete from public.ai_usage_replays where expires_at <= now();
    insert into public.ai_usage_replays(request_id, actor_id, fingerprint, kind, payload, expires_at)
    values (p_request_id, p_replay_actor_id, p_replay_fingerprint, p_replay_kind,
      p_replay_payload, now() + interval '15 minutes')
    on conflict (request_id, kind) do update set
      payload = excluded.payload, expires_at = excluded.expires_at, created_at = now();
  end if;
  v_result := public.ai_finalize_usage(
    p_request_id, p_status, p_latency_ms, p_safe_error_code, p_billing_uncertain
  );
  return v_result;
end;
$$;

revoke all on function public.ai_reserve_usage(text, text, text, text, uuid, text, text, integer, integer, integer) from public, anon, authenticated;
drop function if exists public.ai_finalize_usage(uuid, text, integer, text);
revoke all on function public.ai_finalize_usage(uuid, text, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.ai_finalize_usage_with_replay(uuid, text, integer, text, boolean, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ai_reserve_usage(text, text, text, text, uuid, text, text, integer, integer, integer) to service_role;
grant execute on function public.ai_finalize_usage(uuid, text, integer, text, boolean) to service_role;
grant execute on function public.ai_finalize_usage_with_replay(uuid, text, integer, text, boolean, text, text, uuid, jsonb) to service_role;

create or replace function public.ai_admin_dashboard_summary(p_month date default date_trunc('month', now())::date)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin') then raise exception 'Active admin access required'; end if;
  select jsonb_build_object(
    'month', b.month, 'soft_limit_zar_micros', b.soft_limit_zar_micros,
    'hard_limit_zar_micros', b.hard_limit_zar_micros, 'committed_zar_micros', b.committed_zar_micros,
    'reserved_zar_micros', b.reserved_zar_micros, 'warning_threshold_percent', b.warning_threshold_percent,
    'version', b.version, 'requests', count(r.id),
    'succeeded', count(r.id) filter (where r.status = 'succeeded'),
    'failed', count(r.id) filter (where r.status = 'failed'),
    'denied', count(r.id) filter (where r.status = 'denied'),
    'provider_health', (
      select coalesce(jsonb_agg(to_jsonb(health) order by health.provider, health.model), '[]'::jsonb)
      from (
        select observation.provider, observation.model,
          (array_agg(observation.observation order by observation.observed_at desc))[1] as latest_observation,
          max(observation.observed_at) as last_observed_at,
          count(*) filter (where observation.observation = 'success') as successes_24h,
          count(*) filter (where observation.observation in ('failure','missing_secret')) as failures_24h
        from public.ai_provider_health_observations observation
        where observation.observed_at >= now() - interval '24 hours'
          and observation.observation <> 'configured'
        group by observation.provider, observation.model
      ) health
    )
  ) into v_result from public.ai_monthly_budgets b left join public.ai_usage_requests r on r.month = b.month
  where b.month = date_trunc('month', p_month)::date group by b.month;
  return coalesce(v_result, jsonb_build_object('month', date_trunc('month', p_month)::date, 'missing', true));
end;
$$;

create or replace function public.ai_admin_usage_detail(
  p_month date default date_trunc('month', now())::date,
  p_limit integer default 100,
  p_offset integer default 0
) returns table(
  request_id uuid, created_at timestamptz, feature text, action text, actor_id uuid,
  capability text, complexity text, request_status text, budget_state text,
  reservation_zar_micros bigint, actual_zar_micros bigint, latency_ms integer,
  attempt_number integer, provider text, requested_model text, actual_model text,
  input_tokens integer, output_tokens integer, audio_seconds numeric,
  estimated_zar_cost_micros bigint, attempt_status text, outcome text,
  fallback boolean, http_status integer, safe_error_code text
) language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin') then raise exception 'Active admin access required'; end if;
  return query select r.id, r.created_at, r.feature, r.action, r.actor_id, r.capability,
    r.complexity, r.status, r.budget_state, r.reservation_zar_micros, r.actual_zar_micros,
    r.latency_ms, a.attempt_number, a.provider, a.requested_model, a.actual_model,
    a.input_tokens, a.output_tokens, a.audio_seconds, a.estimated_zar_cost_micros,
    a.status, a.outcome, a.fallback, a.http_status, a.safe_error_code
  from public.ai_usage_requests r left join public.ai_usage_attempts a on a.request_id = r.id
  where r.month = date_trunc('month', p_month)::date order by r.created_at desc, a.attempt_number
  limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end;
$$;

-- Dashboard totals are calculated over the complete data set in PostgreSQL.
-- The browser never derives totals from the intentionally paginated detail RPC.
create or replace function public.ai_admin_usage_aggregates(
  p_month date default date_trunc('month', now())::date
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  ) then
    raise exception 'Active admin access required';
  end if;

  with request_attempts as (
    select r.id as request_id,
      sum(a.input_tokens)::bigint as input_tokens,
      sum(a.output_tokens)::bigint as output_tokens,
      sum(a.audio_seconds) as audio_seconds,
      sum(a.estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
      count(*) filter (where a.id is not null and a.status <> 'skipped') as attempts,
      count(*) filter (where a.id is not null and a.status = 'skipped') as skipped,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and exists (
        select 1 from public.ai_usage_attempts prior where prior.request_id = a.request_id
          and prior.attempt_number < a.attempt_number and prior.status <> 'skipped'
      )) as retries,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and a.fallback) as fallbacks,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and a.estimated_zar_cost_micros is not null) as known_cost_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and a.estimated_zar_cost_micros is null) as unknown_cost_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and (a.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null)) as token_eligible_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and (a.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.input_tokens is null) as unknown_input_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and (a.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.output_tokens is null) as unknown_output_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and a.capability = 'transcription') as audio_eligible_attempts,
      count(*) filter (where a.id is not null and a.status <> 'skipped' and a.capability = 'transcription' and a.audio_seconds is null) as unknown_audio_attempts
    from public.ai_usage_requests r
    left join (
      select attempts.*, requests.capability
      from public.ai_usage_attempts attempts
      join public.ai_usage_requests requests on requests.id = attempts.request_id
    ) a on a.request_id = r.id
    group by r.id
  ), month_requests as (
    select r.*, p.full_name, ra.input_tokens, ra.output_tokens, ra.audio_seconds,
      ra.estimated_zar_cost_micros, ra.token_eligible_attempts,
      ra.unknown_input_attempts, ra.unknown_output_attempts,
      ra.audio_eligible_attempts, ra.unknown_audio_attempts,
      ra.attempts, ra.skipped, ra.retries, ra.fallbacks,
      ra.known_cost_attempts, ra.unknown_cost_attempts
    from public.ai_usage_requests r
    join public.profiles p on p.id = r.actor_id
    left join request_attempts ra on ra.request_id = r.id
    where r.month = v_month
  ), latest_health as (
    select distinct on (route.id) route.id as route_id,
      observation.observation, observation.observed_at, observation.latency_ms,
      observation.safe_error_code
    from public.ai_provider_routes route
    left join public.ai_provider_health_observations observation
      on observation.route_id = route.id and observation.observation <> 'configured'
    order by route.id, observation.observed_at desc nulls last
  )
  select jsonb_build_object(
    'month', v_month,
    'summary', (
      select jsonb_build_object(
        'requests', count(*),
        'succeeded', count(*) filter (where status = 'succeeded'),
        'failed', count(*) filter (where status = 'failed'),
        'denied', count(*) filter (where status = 'denied'),
        'attempts', coalesce(sum(attempts), 0),
        'skipped', coalesce(sum(skipped), 0),
        'retries', coalesce((select count(*) from public.ai_usage_attempts a join public.ai_usage_requests r on r.id = a.request_id where r.month = v_month and a.status <> 'skipped' and exists (select 1 from public.ai_usage_attempts prior where prior.request_id = a.request_id and prior.attempt_number < a.attempt_number and prior.status <> 'skipped')), 0),
        'fallbacks', coalesce((select count(*) from public.ai_usage_attempts a join public.ai_usage_requests r on r.id = a.request_id where r.month = v_month and a.status <> 'skipped' and a.fallback), 0),
        'avg_latency_ms', avg(latency_ms)::numeric(12,2),
        'input_tokens', sum(input_tokens),
        'output_tokens', sum(output_tokens),
        'audio_seconds', sum(audio_seconds),
        'token_eligible_attempts', coalesce(sum(token_eligible_attempts), 0),
        'unknown_input_attempts', coalesce(sum(unknown_input_attempts), 0),
        'unknown_output_attempts', coalesce(sum(unknown_output_attempts), 0),
        'audio_eligible_attempts', coalesce(sum(audio_eligible_attempts), 0),
        'unknown_audio_attempts', coalesce(sum(unknown_audio_attempts), 0),
        'estimated_zar_cost_micros', sum(estimated_zar_cost_micros),
        'known_cost_attempts', coalesce(sum(known_cost_attempts), 0),
        'unknown_cost_attempts', coalesce((select count(*) from public.ai_usage_attempts a join public.ai_usage_requests r on r.id = a.request_id where r.month = v_month and a.status <> 'skipped' and a.estimated_zar_cost_micros is null), 0)
      ) from month_requests
    ),
    'budget', (
      select to_jsonb(b) - 'updated_by'
      from public.ai_monthly_budgets b where b.month = v_month
    ),
    'daily', (
      select coalesce(jsonb_agg(to_jsonb(day_row) order by day_row.day), '[]'::jsonb)
      from (
        select created_at::date as day, count(*) as requests,
          count(*) filter (where status = 'succeeded') as succeeded,
          count(*) filter (where status = 'failed') as failed,
          count(*) filter (where status = 'denied') as denied,
          coalesce(sum(attempts), 0) as attempts,
          coalesce(sum(skipped), 0) as skipped,
          coalesce(sum(retries), 0) as retries,
          coalesce(sum(fallbacks), 0) as fallbacks,
          coalesce(sum(known_cost_attempts), 0) as known_cost_attempts,
          coalesce(sum(unknown_cost_attempts), 0) as unknown_cost_attempts,
          coalesce(sum(token_eligible_attempts), 0) as token_eligible_attempts,
          coalesce(sum(unknown_input_attempts), 0) as unknown_input_attempts,
          coalesce(sum(unknown_output_attempts), 0) as unknown_output_attempts,
          coalesce(sum(audio_eligible_attempts), 0) as audio_eligible_attempts,
          coalesce(sum(unknown_audio_attempts), 0) as unknown_audio_attempts,
          sum(input_tokens)::bigint as input_tokens,
          sum(output_tokens)::bigint as output_tokens,
          sum(audio_seconds) as audio_seconds,
          sum(estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
          avg(latency_ms)::numeric(12,2) as avg_latency_ms
        from month_requests group by created_at::date
      ) day_row
    ),
    'monthly', (
      select coalesce(jsonb_agg(to_jsonb(month_row) order by month_row.month), '[]'::jsonb)
      from (
        select r.month, count(*) as requests,
          count(*) filter (where r.status = 'succeeded') as succeeded,
          count(*) filter (where r.status = 'failed') as failed,
          count(*) filter (where r.status = 'denied') as denied,
          coalesce(sum(ra.attempts), 0) as attempts,
          coalesce(sum(ra.skipped), 0) as skipped,
          coalesce(sum(ra.retries), 0) as retries,
          coalesce(sum(ra.fallbacks), 0) as fallbacks,
          coalesce(sum(ra.known_cost_attempts), 0) as known_cost_attempts,
          coalesce(sum(ra.unknown_cost_attempts), 0) as unknown_cost_attempts,
          coalesce(sum(ra.token_eligible_attempts), 0) as token_eligible_attempts,
          coalesce(sum(ra.unknown_input_attempts), 0) as unknown_input_attempts,
          coalesce(sum(ra.unknown_output_attempts), 0) as unknown_output_attempts,
          coalesce(sum(ra.audio_eligible_attempts), 0) as audio_eligible_attempts,
          coalesce(sum(ra.unknown_audio_attempts), 0) as unknown_audio_attempts,
          sum(ra.input_tokens)::bigint as input_tokens,
          sum(ra.output_tokens)::bigint as output_tokens,
          sum(ra.audio_seconds) as audio_seconds,
          sum(ra.estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
          avg(r.latency_ms)::numeric(12,2) as avg_latency_ms
        from public.ai_usage_requests r
        left join request_attempts ra on ra.request_id = r.id
        group by r.month
      ) month_row
    ),
    'users', (
      select coalesce(jsonb_agg(to_jsonb(user_row) order by user_row.requests desc, user_row.full_name nulls last), '[]'::jsonb)
      from (
        select actor_id, full_name, count(*) as requests,
          count(*) filter (where status = 'succeeded') as succeeded,
          count(*) filter (where status = 'failed') as failed,
          count(*) filter (where status = 'denied') as denied,
          coalesce(sum(attempts), 0) as attempts,
          coalesce(sum(skipped), 0) as skipped,
          coalesce(sum(retries), 0) as retries,
          coalesce(sum(fallbacks), 0) as fallbacks,
          coalesce(sum(known_cost_attempts), 0) as known_cost_attempts,
          coalesce(sum(unknown_cost_attempts), 0) as unknown_cost_attempts,
          coalesce(sum(token_eligible_attempts), 0) as token_eligible_attempts,
          coalesce(sum(unknown_input_attempts), 0) as unknown_input_attempts,
          coalesce(sum(unknown_output_attempts), 0) as unknown_output_attempts,
          coalesce(sum(audio_eligible_attempts), 0) as audio_eligible_attempts,
          coalesce(sum(unknown_audio_attempts), 0) as unknown_audio_attempts,
          sum(input_tokens)::bigint as input_tokens,
          sum(output_tokens)::bigint as output_tokens,
          sum(audio_seconds) as audio_seconds,
          sum(estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
          avg(latency_ms)::numeric(12,2) as avg_latency_ms
        from month_requests group by actor_id, full_name
      ) user_row
    ),
    'features', (
      select coalesce(jsonb_agg(to_jsonb(feature_row) order by feature_row.requests desc, feature_row.feature, feature_row.action), '[]'::jsonb)
      from (
        select feature, action, count(*) as requests,
          count(*) filter (where status = 'succeeded') as succeeded,
          count(*) filter (where status = 'failed') as failed,
          count(*) filter (where status = 'denied') as denied,
          coalesce(sum(attempts), 0) as attempts,
          coalesce(sum(skipped), 0) as skipped,
          coalesce(sum(retries), 0) as retries,
          coalesce(sum(fallbacks), 0) as fallbacks,
          coalesce(sum(known_cost_attempts), 0) as known_cost_attempts,
          coalesce(sum(unknown_cost_attempts), 0) as unknown_cost_attempts,
          coalesce(sum(token_eligible_attempts), 0) as token_eligible_attempts,
          coalesce(sum(unknown_input_attempts), 0) as unknown_input_attempts,
          coalesce(sum(unknown_output_attempts), 0) as unknown_output_attempts,
          coalesce(sum(audio_eligible_attempts), 0) as audio_eligible_attempts,
          coalesce(sum(unknown_audio_attempts), 0) as unknown_audio_attempts,
          sum(input_tokens)::bigint as input_tokens,
          sum(output_tokens)::bigint as output_tokens,
          sum(audio_seconds) as audio_seconds,
          sum(estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
          avg(latency_ms)::numeric(12,2) as avg_latency_ms
        from month_requests group by feature, action
      ) feature_row
    ),
    'providers', (
      select coalesce(jsonb_agg(to_jsonb(provider_row) order by provider_row.attempts desc, provider_row.provider, provider_row.model), '[]'::jsonb)
      from (
        select a.provider, coalesce(a.actual_model, a.requested_model) as model,
          count(*) filter (where a.status <> 'skipped') as attempts,
          count(*) filter (where a.status = 'succeeded') as succeeded,
          count(*) filter (where a.status = 'failed') as failed,
           count(*) filter (where a.status = 'skipped') as skipped,
          0::bigint as denied,
          count(*) filter (where a.status <> 'skipped' and exists (select 1 from public.ai_usage_attempts prior where prior.request_id = a.request_id and prior.attempt_number < a.attempt_number and prior.status <> 'skipped')) as retries,
          count(*) filter (where a.status <> 'skipped' and a.fallback) as fallbacks,
          count(*) filter (where a.status <> 'skipped' and a.estimated_zar_cost_micros is not null) as known_cost_attempts,
          count(*) filter (where a.status <> 'skipped' and a.estimated_zar_cost_micros is null) as unknown_cost_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null)) as token_eligible_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.input_tokens is null) as unknown_input_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.output_tokens is null) as unknown_output_attempts,
          count(*) filter (where a.status <> 'skipped' and r.capability = 'transcription') as audio_eligible_attempts,
          count(*) filter (where a.status <> 'skipped' and r.capability = 'transcription' and a.audio_seconds is null) as unknown_audio_attempts,
          sum(a.input_tokens)::bigint as input_tokens,
          sum(a.output_tokens)::bigint as output_tokens,
          sum(a.audio_seconds) as audio_seconds,
          sum(a.estimated_zar_cost_micros)::bigint as estimated_zar_cost_micros,
          avg(a.latency_ms)::numeric(12,2) as avg_latency_ms
        from public.ai_usage_attempts a
        join public.ai_usage_requests r on r.id = a.request_id
        where r.month = v_month
        group by a.provider, coalesce(a.actual_model, a.requested_model)
      ) provider_row
    ),
    'currency_costs', (
      select coalesce(jsonb_agg(to_jsonb(currency_row) order by currency_row.currency), '[]'::jsonb)
      from (
        select a.cost_currency as currency,
          sum(a.estimated_provider_cost_micros)::bigint as provider_cost_micros,
          sum(a.estimated_zar_cost_micros)::bigint as zar_cost_micros,
          count(*) filter (where a.status <> 'skipped') as attempts,
          count(*) filter (where a.status = 'succeeded') as succeeded,
          count(*) filter (where a.status = 'failed') as failed,
          count(*) filter (where a.status = 'skipped') as skipped,
          0::bigint as denied,
          count(*) filter (where a.status <> 'skipped' and exists (select 1 from public.ai_usage_attempts prior where prior.request_id = a.request_id and prior.attempt_number < a.attempt_number and prior.status <> 'skipped')) as retries,
          count(*) filter (where a.status <> 'skipped' and a.fallback) as fallbacks,
          count(*) filter (where a.status <> 'skipped' and a.estimated_provider_cost_micros is not null) as priced_attempts,
          count(*) filter (where a.status <> 'skipped' and a.estimated_provider_cost_micros is not null) as known_cost_attempts,
          count(*) filter (where a.status <> 'skipped' and a.estimated_provider_cost_micros is null) as unknown_cost_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null)) as token_eligible_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.input_tokens is null) as unknown_input_attempts,
          count(*) filter (where a.status <> 'skipped' and (r.capability = 'text' or a.input_tokens is not null or a.output_tokens is not null) and a.output_tokens is null) as unknown_output_attempts,
          count(*) filter (where a.status <> 'skipped' and r.capability = 'transcription') as audio_eligible_attempts,
          count(*) filter (where a.status <> 'skipped' and r.capability = 'transcription' and a.audio_seconds is null) as unknown_audio_attempts,
          sum(a.input_tokens)::bigint as input_tokens,
          sum(a.output_tokens)::bigint as output_tokens,
          sum(a.audio_seconds) as audio_seconds,
          avg(a.latency_ms) filter (where a.status <> 'skipped')::numeric(12,2) as avg_latency_ms
        from public.ai_usage_attempts a
        join public.ai_usage_requests r on r.id = a.request_id
        where r.month = v_month and a.cost_currency is not null
        group by a.cost_currency
      ) currency_row
    ),
    'routes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', route.id, 'capability', route.capability, 'provider', route.provider,
        'model', route.model, 'tier', route.tier, 'priority', route.priority,
        'enabled', route.enabled, 'pricing_currency', route.pricing_currency,
        'pricing_as_of', route.pricing_as_of,
        'input_per_million_micros', route.input_per_million_micros,
        'output_per_million_micros', route.output_per_million_micros,
        'audio_per_minute_micros', route.audio_per_minute_micros,
        'request_cost_micros', route.request_cost_micros,
        'runtime_status', case
          when health.observation = 'success' then 'healthy'
          when health.observation = 'degraded_skip' then 'degraded'
          when health.observation in ('failure', 'missing_secret') then 'unavailable'
          else 'unknown'
        end,
        'last_observed_at', health.observed_at,
        'last_latency_ms', health.latency_ms,
        'safe_error_code', health.safe_error_code
      ) order by route.capability, route.tier, route.priority), '[]'::jsonb)
      from public.ai_provider_routes route
      left join latest_health health on health.route_id = route.id
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.ai_admin_set_budget(
  p_month date, p_soft_limit_zar_micros bigint, p_hard_limit_zar_micros bigint,
  p_warning_threshold_percent integer default 80, p_expected_version integer default null
) returns public.ai_monthly_budgets
language plpgsql security definer set search_path = public
as $$
declare
  v_result public.ai_monthly_budgets;
  v_existing public.ai_monthly_budgets;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin') then raise exception 'Active admin access required'; end if;
  if p_month <> date_trunc('month', p_month)::date or p_soft_limit_zar_micros < 0 or p_hard_limit_zar_micros < p_soft_limit_zar_micros or p_warning_threshold_percent not between 1 and 100 then raise exception 'Invalid AI budget'; end if;
  select * into v_existing from public.ai_monthly_budgets where month = p_month for update;
  if v_existing.month is not null and p_hard_limit_zar_micros < v_existing.committed_zar_micros + v_existing.reserved_zar_micros then
    raise exception 'AI hard budget cannot be below committed plus reserved usage';
  end if;
  insert into public.ai_monthly_budgets(month, soft_limit_zar_micros, hard_limit_zar_micros, warning_threshold_percent, updated_by)
  values (p_month, p_soft_limit_zar_micros, p_hard_limit_zar_micros, p_warning_threshold_percent, auth.uid())
  on conflict (month) do update set soft_limit_zar_micros = excluded.soft_limit_zar_micros,
    hard_limit_zar_micros = excluded.hard_limit_zar_micros,
    warning_threshold_percent = excluded.warning_threshold_percent, version = public.ai_monthly_budgets.version + 1,
    updated_by = auth.uid(), updated_at = now()
  where p_expected_version is null or public.ai_monthly_budgets.version = p_expected_version
  returning * into v_result;
  if v_result.month is null then raise exception 'AI budget version conflict'; end if;
  return v_result;
end;
$$;

create or replace function public.ai_admin_update_provider_routes(p_routes jsonb)
returns setof public.ai_provider_routes
language plpgsql security definer set search_path = public
as $$
declare v_item jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'admin') then raise exception 'Active admin access required'; end if;
  if jsonb_typeof(p_routes) <> 'array' or jsonb_array_length(p_routes) = 0 then raise exception 'Provider route updates required'; end if;
  for v_item in select value from jsonb_array_elements(p_routes) loop
    if not (v_item ? 'id') or not (v_item ? 'priority') or not (v_item ? 'enabled') then raise exception 'Route id, priority, and enabled are required'; end if;
    update public.ai_provider_routes set priority = (v_item ->> 'priority')::integer,
      enabled = (v_item ->> 'enabled')::boolean, updated_at = now()
    where id = (v_item ->> 'id')::uuid;
    if not found then raise exception 'AI provider route not found'; end if;
  end loop;
  return query select * from public.ai_provider_routes order by capability, tier, priority;
end;
$$;

revoke all on function public.ai_admin_dashboard_summary(date) from public, anon, authenticated;
revoke all on function public.ai_admin_usage_detail(date, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_admin_usage_aggregates(date) from public, anon, authenticated;
revoke all on function public.ai_admin_set_budget(date, bigint, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_admin_update_provider_routes(jsonb) from public, anon, authenticated;
grant execute on function public.ai_admin_dashboard_summary(date) to authenticated;
grant execute on function public.ai_admin_usage_detail(date, integer, integer) to authenticated;
grant execute on function public.ai_admin_usage_aggregates(date) to authenticated;
grant execute on function public.ai_admin_set_budget(date, bigint, bigint, integer, integer) to authenticated;
grant execute on function public.ai_admin_update_provider_routes(jsonb) to authenticated;

-- Snapshot sources are public provider pricing pages as reviewed on 2026-08-01.
-- OpenRouter's free router is explicitly zero-cost and therefore uses ZAR with
-- a neutral FX rate; every paid snapshot is USD converted at a conservative 18.
insert into public.ai_provider_routes (
  capability, provider, model, tier, priority, enabled, pricing_currency,
  input_per_million_micros, output_per_million_micros, audio_per_minute_micros,
  request_cost_micros, fx_zar_micros, pricing_source, pricing_as_of
) values
  ('text','openrouter','openrouter/free','cheap',10,true,'ZAR',0,0,null,0,1000000,'https://openrouter.ai/openrouter/free','2026-08-01'),
  ('text','gemini','gemini-2.5-flash-lite','cheap',20,true,'USD',100000,400000,null,0,18000000,'https://ai.google.dev/gemini-api/docs/pricing','2026-08-01'),
  ('text','groq','llama-3.1-8b-instant','cheap',30,true,'USD',50000,80000,null,0,18000000,'https://groq.com/pricing','2026-08-01'),
  ('text','openai','gpt-4o-mini','cheap',40,true,'USD',150000,600000,null,0,18000000,'https://openai.com/api/pricing','2026-08-01'),
  ('text','gemini','gemini-2.5-pro','strong',10,true,'USD',1250000,10000000,null,0,18000000,'https://ai.google.dev/gemini-api/docs/pricing','2026-08-01'),
  ('text','openai','gpt-4.1','strong',20,true,'USD',2000000,8000000,null,0,18000000,'https://openai.com/api/pricing','2026-08-01'),
  ('transcription','groq','whisper-large-v3-turbo','cheap',10,true,'USD',0,0,667,0,18000000,'Groq pricing: whisper-large-v3-turbo estimated at USD 0.04 per audio hour','2026-08-01'),
  ('transcription','gemini','gemini-2.5-flash-lite','cheap',20,true,'USD',0,0,192,0,18000000,'Google Gemini pricing: audio estimate at 32 tokens/second and USD 0.10 per million input tokens','2026-08-01'),
  ('transcription','openai','gpt-4o-mini-transcribe','cheap',30,true,'USD',0,0,3000,0,18000000,'OpenAI pricing: gpt-4o-mini-transcribe estimated at USD 0.003 per audio minute','2026-08-01')
on conflict (capability, provider, model) do nothing;

insert into public.ai_monthly_budgets (month, soft_limit_zar_micros, hard_limit_zar_micros, warning_threshold_percent)
select (date_trunc('month', current_date) + make_interval(months => n))::date,
  500000000, 750000000, 80
from generate_series(0, 12) as months(n)
on conflict (month) do nothing;
