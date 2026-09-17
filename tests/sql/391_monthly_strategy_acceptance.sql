-- Apply after 20260917173138_canonical_monthly_client_strategy.sql in an isolated database.
-- This script rolls back all fixtures.
begin;

insert into public.clients (id, name, active) values
  ('10000000-0000-4000-8000-000000000001', 'Strategy Client A', true),
  ('10000000-0000-4000-8000-000000000002', 'Strategy Client B', true);

insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('20000000-0000-4000-8000-000000000001', 'Strategy Manager', 'manager', null, true),
  ('20000000-0000-4000-8000-000000000002', 'Client A User', 'client', '10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000003', 'Client B User', 'client', '10000000-0000-4000-8000-000000000002', true);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  v_first jsonb;
  v_repeat jsonb;
  v_amend jsonb;
  v_publish jsonb;
  v_message text;
begin
  v_first := public.seed_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01',
    '{"version":1,"strategyGoingForward":"September baseline","internal":"never publish"}',
    '{"calendar_events":[{"title":"Heritage Day","selected":true}]}', null,
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'
  );
  assert (v_first->>'created')::boolean, 'first seed creates';

  v_repeat := public.seed_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01',
    '{"version":1,"strategyGoingForward":"must not overwrite"}', '{}', null,
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'
  );
  assert (v_repeat->>'replayed')::boolean and not (v_repeat->>'created')::boolean, 'repeat seed reuses existing row';
  assert (select strategy_data->>'strategyGoingForward' from public.monthly_client_strategies
          where client_id = '10000000-0000-4000-8000-000000000001' and strategy_month = '2026-09-01') = 'September baseline',
    'repeat seed never overwrites';

  perform public.seed_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-10-01', '{"version":1,"strategyGoingForward":"October"}', '{}', null,
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003');
  perform public.seed_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000002', '2026-09-01', '{"version":1,"strategyGoingForward":"Other client"}', '{}', null,
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004');
  assert (select count(*) from public.monthly_client_strategies) = 3, 'two months and two clients remain distinct';

  v_amend := public.amend_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01', 1,
    '{"version":1,"strategyGoingForward":"Staff amendment","internal":"still private"}', 'internal rationale',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005');
  assert (v_amend->>'version')::integer = 2, 'amendment advances version';
  assert (public.amend_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01', 1,
    '{"version":1,"strategyGoingForward":"Staff amendment","internal":"still private"}', 'internal rationale',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005')->>'replayed')::boolean,
    'same request safely replays';
  begin
    perform public.amend_monthly_client_strategy(
      '10000000-0000-4000-8000-000000000001', '2026-09-01', 1,
      '{"version":1,"strategyGoingForward":"Different payload"}', null,
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005');
    raise exception 'changed payload reused an idempotency key';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Idempotency key reused with a different request', v_message;
  end;

  perform public.transition_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01', 2, 'approved',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000006');
  v_publish := public.transition_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01', 2, 'published',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000007');
  assert v_publish->>'workflow_status' = 'published', 'approved strategy publishes';
  assert (select not (published_strategy_data ? 'internal') from public.monthly_client_strategies
          where client_id = '10000000-0000-4000-8000-000000000001' and strategy_month = '2026-09-01'),
    'published snapshot is client-safe';

  perform public.amend_monthly_client_strategy(
    '10000000-0000-4000-8000-000000000001', '2026-09-01', 2,
    '{"version":1,"strategyGoingForward":"Next staff draft"}', 'new internal draft',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000008');
  assert (select published_strategy_data->>'strategyGoingForward' from public.monthly_client_strategies
          where client_id = '10000000-0000-4000-8000-000000000001' and strategy_month = '2026-09-01') = 'Staff amendment',
    'staff amendment preserves the last published snapshot';
  begin
    delete from public.monthly_client_strategy_revisions
    where strategy_id = (v_first->>'strategy_id')::uuid;
    raise exception 'revision history was deleted';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'monthly_client_strategy_revisions is append-only', v_message;
  end;
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}', true);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare
  v_message text;
begin
  assert (select count(*) from public.client_monthly_strategy('2026-09-01')) = 1, 'client A sees its published September strategy';
  assert (select not (strategy_data ? 'internal') from public.client_monthly_strategy('2026-09-01')), 'client projection excludes internal data';
  assert (select count(*) from public.monthly_client_strategies) = 0, 'client has no direct canonical-table visibility';
  begin
    update public.monthly_client_strategies set internal_notes = 'forbidden';
    raise exception 'client updated canonical strategy directly';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000003"}', true);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.client_monthly_strategy('2026-09-01')) = 0, 'client B cannot see client A publication';
end $$;
reset role;

rollback;
