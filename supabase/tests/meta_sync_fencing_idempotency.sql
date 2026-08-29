-- Run only against an isolated/local database after all migrations.
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/meta_sync_fencing_idempotency.sql
begin;

create or replace function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then raise exception 'assertion failed: %', p_message; end if;
end
$$;

insert into public.clients (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Meta fencing fixture');
insert into public.meta_sync_batches
  (id, mode, status, sync_range_months, total_items)
values
  ('10000000-0000-0000-0000-000000000002', 'selected', 'queued', 1, 1);
insert into public.meta_sync_batch_items
  (id, batch_id, client_id, client_name, month, status)
values
  ('10000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001', 'Meta fencing fixture', '2026-07', 'queued');

do $$
declare
  v_a record;
  v_b record;
  v_report record;
  v_post record;
  v_fact_run record;
  v_lane_a bigint;
  v_lane_b bigint;
  v_failed boolean;
begin
  v_lane_a := public.meta_sync_acquire_lane(
    '10000000-0000-0000-0000-000000000002', 0, 4, null);
  perform pg_temp.assert_true(v_lane_a = 1, 'initial lane lease acquired');
  perform pg_temp.assert_true(
    public.meta_sync_acquire_lane('10000000-0000-0000-0000-000000000002', 0, 4, null) is null,
    'duplicate live lane rejected');
  perform public.meta_sync_prepare_lane_handoff(
    '10000000-0000-0000-0000-000000000002', 0, v_lane_a);
  v_lane_b := public.meta_sync_acquire_lane(
    '10000000-0000-0000-0000-000000000002', 0, 4, v_lane_a);
  perform pg_temp.assert_true(v_lane_b = 2, 'handoff increments lane generation');
  v_failed := false;
  begin
    perform public.meta_sync_touch_lane(
      '10000000-0000-0000-0000-000000000002', 0, v_lane_a);
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale lane heartbeat rejected');
  v_failed := false;
  begin
    perform public.meta_sync_begin_lane_cooldown(
      '10000000-0000-0000-0000-000000000002', 0, v_lane_a, 900, 'stale');
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale lane cooldown rejected');
  perform public.meta_sync_touch_lane(
    '10000000-0000-0000-0000-000000000002', 0, v_lane_b);

  select * into v_a from public.claim_sync_batch_items(1, '10000000-0000-0000-0000-000000000002');
  perform pg_temp.assert_true(v_a.lease_generation = 1, 'first claim generation');
  perform public.meta_sync_checkpoint_item(v_a.id, v_a.lease_generation, 'facebook', 'pending', 'cursor-a', 1, null, null);

  update public.meta_sync_batch_items set started_at = now() - interval '6 minutes' where id = v_a.id;
  select * into v_b from public.claim_sync_batch_items(1, '10000000-0000-0000-0000-000000000002');
  perform pg_temp.assert_true(v_b.lease_generation = 2, 'reclaim increments generation');

  v_failed := false;
  begin
    perform public.meta_sync_checkpoint_item(v_a.id, v_a.lease_generation, 'facebook', 'pending', 'stale-cursor', 10, null, null);
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale checkpoint rejected');

  perform public.meta_sync_checkpoint_item(v_b.id, v_b.lease_generation, 'facebook', 'facts_pending', null, 1, null, null);
  perform pg_temp.assert_true(
    (select posts_synced = 2 and facebook_sync_state = 'facts_pending'
     from public.meta_sync_batch_items where id = v_b.id),
    'replacement checkpoint succeeds without stale overwrite');

  v_failed := false;
  begin
    perform public.meta_sync_get_or_create_report(v_a.id, v_a.lease_generation, null, null, 'stale', null);
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale report write rejected');

  select * into v_report from public.meta_sync_get_or_create_report(
    v_b.id, v_b.lease_generation, null, null, 'Fixture July Report', null);
  perform pg_temp.assert_true(v_report.report_id is not null, 'replacement acquires report');

  select * into v_post from public.meta_sync_upsert_report_post(
    v_b.id, v_b.lease_generation, null, 'meta-object-1', 'Photo',
    jsonb_build_object(
      'report_id', v_report.report_id, 'platform', 'facebook',
      'meta_post_id', 'meta-object-1', 'publish_time', '2026-07-10T10:00:00Z',
      'caption', 'Atomic fixture', 'permalink', 'https://facebook.example/meta-object-1',
      'views', null, 'reach', null, 'reactions', 2, 'comments', 1, 'shares', 0,
      'raw', jsonb_build_object('source', 'meta_sync')));
  perform public.meta_sync_upsert_report_post(
    v_b.id, v_b.lease_generation, null, 'meta-object-1', 'Photo',
    jsonb_build_object(
      'report_id', v_report.report_id, 'platform', 'facebook',
      'meta_post_id', 'meta-object-1', 'publish_time', '2026-07-10T10:00:00Z',
      'caption', 'Atomic fixture updated', 'permalink', 'https://facebook.example/meta-object-1',
      'views', null, 'reach', null, 'reactions', 3, 'comments', 1, 'shares', 0,
      'raw', jsonb_build_object('source', 'meta_sync')));

  perform pg_temp.assert_true(
    (select count(*) = 1 from public.reports where id = v_report.report_id),
    'one canonical report');
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.posts where report_id = v_report.report_id
      and platform = 'facebook' and meta_post_id = 'meta-object-1'),
    'one canonical post');
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.meta_content_mappings where client_id = v_b.client_id
      and platform = 'facebook' and meta_object_id = 'meta-object-1'),
    'one canonical mapping');
  perform pg_temp.assert_true(
    not exists (
      select 1 from public.posts p left join public.meta_content_mappings m on m.post_id = p.id
      where p.report_id = v_report.report_id and p.raw ->> 'source' = 'meta_sync' and m.id is null),
    'no orphan Meta sync post');

  v_failed := false;
  begin
    perform public.meta_sync_upsert_report_post(
      v_a.id, v_a.lease_generation, null, 'stale-object', 'Photo',
      jsonb_build_object('report_id', v_report.report_id, 'platform', 'facebook',
        'meta_post_id', 'stale-object', 'raw', jsonb_build_object('source', 'meta_sync')));
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale post/mapping write rejected');

  v_failed := false;
  begin
    perform public.meta_sync_begin_account_fact_run(
      v_a.id, v_a.lease_generation, 'facebook', null, null, 'v25.0',
      'fixture', 'page', '2026-07-01', '2026-07-31', '{}'::jsonb);
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale fact-run creation rejected');

  select * into v_fact_run from public.meta_sync_begin_account_fact_run(
    v_b.id, v_b.lease_generation, 'facebook', null, null, 'v25.0',
    'fixture', 'page', '2026-07-01', '2026-07-31', '{}'::jsonb);
  perform public.meta_sync_persist_account_metric(
    v_b.id, v_b.lease_generation, v_fact_run.sync_run_id, 'brand_views', true,
    jsonb_build_object('source_endpoint', '/page/insights', 'source_metric', 'page_media_view',
      'metric_type', 'total_value', 'response_shape', 'total_value', 'value', 1,
      'availability', 'complete', 'retrieved_at', now()),
    jsonb_build_object('source_metric', 'page_media_view', 'value', 1,
      'availability', 'complete', 'includes_paid', 'both', 'aggregation', 'sum',
      'comparable_group', 'fixture', 'source_timezone', 'UTC', 'provenance', '{}'::jsonb));

  v_failed := false;
  begin
    perform public.meta_sync_persist_account_metric(
      v_a.id, v_a.lease_generation, v_fact_run.sync_run_id, 'stale_metric', true,
      jsonb_build_object('source_endpoint', '/page/insights', 'source_metric', 'stale',
        'metric_type', 'total_value', 'response_shape', 'total_value', 'value', 2,
        'availability', 'complete', 'retrieved_at', now()),
      jsonb_build_object('source_metric', 'stale', 'value', 2, 'availability', 'complete',
        'includes_paid', 'both', 'aggregation', 'sum', 'comparable_group', 'fixture',
        'source_timezone', 'UTC', 'provenance', '{}'::jsonb));
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale snapshot/fact write rejected');
  perform pg_temp.assert_true(
    public.meta_sync_release_claims(jsonb_build_array(jsonb_build_object(
      'item_id', v_a.id, 'lease_generation', v_a.lease_generation))) = 0,
    'stale release cannot release replacement claim');

  perform public.meta_sync_record_run(
    v_b.id, v_b.lease_generation, null, 'success', '{"attempt":1}'::jsonb);
  perform public.meta_sync_record_run(
    v_b.id, v_b.lease_generation, null, 'success', '{"attempt":2}'::jsonb);
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.meta_sync_runs where batch_item_id = v_b.id),
    'audit run is idempotent per batch item');

  perform public.meta_sync_settle_item(v_b.id, v_b.lease_generation, 'completed', 1, 0, '[]'::jsonb, null, false, null);
  v_failed := false;
  begin
    perform public.meta_sync_settle_item(v_a.id, v_a.lease_generation, 'failed', 0, 0, '[]'::jsonb, 'stale', false, null);
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'stale terminal write rejected');
end
$$;

insert into public.meta_sync_batches
  (id, mode, status, sync_range_months, total_items)
values ('10000000-0000-0000-0000-000000000012', 'selected', 'queued', 2, 2);
insert into public.meta_sync_batch_items
  (id, batch_id, client_id, client_name, month, status)
values
  ('10000000-0000-0000-0000-000000000013',
   '10000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000001', 'Meta fencing fixture', '2026-06', 'queued'),
  ('10000000-0000-0000-0000-000000000014',
   '10000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000001', 'Meta fencing fixture', '2026-05', 'queued');

do $$
declare v_limited record; v_other record;
begin
  select * into v_limited from public.claim_sync_batch_items(1, '10000000-0000-0000-0000-000000000012');
  select * into v_other from public.claim_sync_batch_items(1, '10000000-0000-0000-0000-000000000012');
  perform public.meta_sync_settle_item(
    v_limited.id, v_limited.lease_generation, 'queued', 0, 0, '[]'::jsonb,
    'Page rate limit code: 32', true, 900, 'item');
  perform pg_temp.assert_true(
    (select cooldown_until is null from public.meta_sync_batches
     where id = '10000000-0000-0000-0000-000000000012'),
    'item throttle does not cool the whole batch');
  perform pg_temp.assert_true(
    (select cooldown_until > now() from public.meta_sync_batch_items where id = v_limited.id),
    'affected item receives cooldown');
  perform public.meta_sync_checkpoint_item(
    v_other.id, v_other.lease_generation, 'facebook', 'facts_pending', null, 1, null, null);
  perform pg_temp.assert_true(
    (select posts_synced = 1 from public.meta_sync_batch_items where id = v_other.id),
    'unrelated lane continues safely');
  perform public.meta_sync_settle_item(
    v_other.id, v_other.lease_generation, 'completed', 0, 0, '[]'::jsonb, null, false, null, null);
end
$$;

rollback;
