-- Route-scoped reservations keep explicit provider health probes truthful near
-- the hard limit without weakening the existing worst-case fallback reservation.
drop function if exists public.ai_reserve_usage(text, text, text, text, uuid, text, text, integer, integer, integer);

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
  p_max_audio_seconds integer default null,
  p_route_ids uuid[] default null
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
  if p_route_ids is not null and cardinality(p_route_ids) = 0 then raise exception 'No AI routes selected'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor_id and p.is_active and p.role in ('admin','manager','staff','team')) then
    raise exception 'Active workforce actor required';
  end if;

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
      and (p_route_ids is null or route.id = any(p_route_ids))
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

revoke all on function public.ai_reserve_usage(text, text, text, text, uuid, text, text, integer, integer, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.ai_reserve_usage(text, text, text, text, uuid, text, text, integer, integer, integer, uuid[]) to service_role;
