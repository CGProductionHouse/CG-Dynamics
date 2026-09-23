-- Issue #513: atomic guarded amendment of both strategy payload and provenance context.
-- Prepared only. Do not apply to production without explicit CA approval.
-- Existing amend_monthly_client_strategy remains unchanged for ordinary UI edits.

create or replace function public.amend_monthly_client_strategy_with_context(
  p_client_id uuid,
  p_strategy_month date,
  p_expected_version integer,
  p_strategy_data jsonb,
  p_seed_context jsonb,
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
  v_before_strategy jsonb;
  v_before_seed_context jsonb;
  v_before_status text;
  v_receipt jsonb;
  v_fingerprint text;
begin
  v_actor_id := public.resolve_monthly_strategy_actor(p_actor_profile_id);
  perform public.assert_monthly_strategy_input(p_client_id, p_strategy_month, p_strategy_data);

  if jsonb_typeof(p_seed_context) is distinct from 'object' then
    raise exception 'seed_context must be an object';
  end if;
  if p_seed_context ->> 'client_id' is distinct from p_client_id::text then
    raise exception 'Strategy provenance does not belong to the exact client';
  end if;
  if p_seed_context ->> 'strategy_month' is distinct from p_strategy_month::text then
    raise exception 'Strategy provenance month does not match strategy_month';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency_key required';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'client_id', p_client_id,
    'strategy_month', p_strategy_month,
    'expected_version', p_expected_version,
    'strategy_data', p_strategy_data,
    'seed_context', p_seed_context,
    'internal_notes', nullif(btrim(coalesce(p_internal_notes, '')), '')
  )::text);

  select * into v_strategy
  from public.monthly_client_strategies strategy
  where strategy.client_id = p_client_id
    and strategy.strategy_month = p_strategy_month
  for update;

  if v_strategy.id is null then
    raise exception 'Monthly strategy not found';
  end if;

  select * into v_existing
  from public.monthly_client_strategy_revisions revision
  where revision.strategy_id = v_strategy.id
    and revision.idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_existing.receipt || jsonb_build_object('replayed', true);
  end if;

  if p_expected_version is null or p_expected_version <> v_strategy.version then
    raise exception 'Strategy version conflict';
  end if;

  v_before_strategy := v_strategy.strategy_data;
  v_before_seed_context := v_strategy.seed_context;
  v_before_status := v_strategy.workflow_status;

  update public.monthly_client_strategies
  set strategy_data = p_strategy_data,
      seed_context = p_seed_context,
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
    'replayed', false,
    'strategy_id', v_strategy.id,
    'client_id', p_client_id,
    'strategy_month', p_strategy_month,
    'version', v_strategy.version,
    'workflow_status', v_strategy.workflow_status,
    'idempotency_key', p_idempotency_key,
    'before_seed_context', v_before_seed_context,
    'after_seed_context', v_strategy.seed_context
  );

  insert into public.monthly_client_strategy_revisions (
    strategy_id, client_id, strategy_month, event_kind, record_version,
    before_strategy_data, after_strategy_data, before_status, after_status,
    actor_profile_id, idempotency_key, request_fingerprint, receipt
  ) values (
    v_strategy.id, p_client_id, p_strategy_month, 'amended', v_strategy.version,
    v_before_strategy, v_strategy.strategy_data, v_before_status, 'draft',
    v_actor_id, p_idempotency_key, v_fingerprint, v_receipt
  );

  return v_receipt;
end;
$$;

revoke all on function public.amend_monthly_client_strategy_with_context(uuid, date, integer, jsonb, jsonb, text, uuid, uuid)
  from public, anon;
grant execute on function public.amend_monthly_client_strategy_with_context(uuid, date, integer, jsonb, jsonb, text, uuid, uuid)
  to authenticated, service_role;

comment on function public.amend_monthly_client_strategy_with_context(uuid, date, integer, jsonb, jsonb, text, uuid, uuid) is
  'Issue #513: optimistic, idempotent exact-client strategy amendment that atomically updates strategy_data and seed_context while preserving append-only revision evidence.';
