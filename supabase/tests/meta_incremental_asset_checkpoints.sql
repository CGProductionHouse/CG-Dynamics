-- Run only against an isolated/local database after all migrations.
begin;

create or replace function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then raise exception 'assertion failed: %', p_message; end if;
end
$$;

insert into public.clients (id, name)
values ('30000000-0000-4000-8000-000000000001', 'Meta checkpoint fixture');
insert into public.meta_connections (id, status)
values ('30000000-0000-4000-8000-000000000002', 'connected');
insert into public.meta_client_assets (
  id, client_id, connection_id, facebook_page_id, facebook_page_name, is_active
) values (
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'fixture-page', 'Fixture Page', true
);
insert into public.meta_sync_batches (id, mode, status, sync_range_months, total_items)
values ('30000000-0000-4000-8000-000000000004', 'selected', 'queued', 1, 1);
insert into public.meta_sync_batch_items (
  id, batch_id, client_id, client_name, asset_id, sync_kind, month, status
) values (
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000001', 'Meta checkpoint fixture',
  '30000000-0000-4000-8000-000000000003', 'incremental', '2026-08', 'queued'
);

do $$
declare
  v_first record;
  v_second record;
  v_failed boolean := false;
begin
  select * into v_first from public.claim_sync_batch_items(
    1, '30000000-0000-4000-8000-000000000004');
  perform public.meta_sync_checkpoint_platform_terminal(
    v_first.id, v_first.lease_generation, 'facebook', 'complete', 3,
    '2026-09-01T07:00:00Z', 'v25.0', 'meta-connector-v3',
    'verified_partial', null
  );
  perform pg_temp.assert_true(
    (select last_status = 'complete'
       and last_health_state = 'verified_partial'
       and last_sync_kind = 'incremental'
       and last_successful_month = '2026-08'
       and high_watermark_at = '2026-09-01T07:00:00Z'::timestamptz
     from public.meta_asset_sync_checkpoints
     where asset_id = '30000000-0000-4000-8000-000000000003' and platform = 'facebook'),
    'successful terminal stage advances the exact asset checkpoint');

  update public.meta_sync_batch_items
     set started_at = now() - interval '6 minutes'
   where id = v_first.id;
  select * into v_second from public.claim_sync_batch_items(
    1, '30000000-0000-4000-8000-000000000004');
  begin
    perform public.meta_sync_checkpoint_platform_terminal(
      v_first.id, v_first.lease_generation, 'facebook', 'failed', 0,
      now(), 'v25.0', 'meta-connector-v3', 'sync_error', 'provider_error');
  exception when sqlstate '55000' then v_failed := true;
  end;
  perform pg_temp.assert_true(v_second.lease_generation > v_first.lease_generation, 'replacement lease advances');
  perform pg_temp.assert_true(v_failed, 'stale worker cannot overwrite asset checkpoint');
  perform pg_temp.assert_true(
    (select last_status = 'complete' and last_successful_month = '2026-08'
     from public.meta_asset_sync_checkpoints
     where asset_id = '30000000-0000-4000-8000-000000000003' and platform = 'facebook'),
    'stale failure leaves successful high-water evidence intact');
end
$$;

rollback;
