-- Isolated/local database fixture for meta_sync_atomic_concurrency.pgbench.sql.
insert into public.clients (id, name)
values ('20000000-0000-0000-0000-000000000001', 'Meta concurrency fixture');
insert into public.meta_sync_batches (id, mode, status, sync_range_months, total_items)
values ('20000000-0000-0000-0000-000000000002', 'selected', 'queued', 1, 1);
insert into public.meta_sync_batch_items
  (id, batch_id, client_id, client_name, month, status)
values
  ('20000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', 'Meta concurrency fixture', '2026-07', 'queued');
select * from public.claim_sync_batch_items(1, '20000000-0000-0000-0000-000000000002');
