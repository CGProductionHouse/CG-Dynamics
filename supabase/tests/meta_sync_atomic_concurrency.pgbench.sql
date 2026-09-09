select * from public.meta_sync_get_or_create_report(
  '20000000-0000-0000-0000-000000000003', 1, null, null,
  'Meta concurrency fixture July Report', null);

select * from public.meta_sync_upsert_report_post(
  '20000000-0000-0000-0000-000000000003', 1, null,
  'concurrent-meta-object', 'Photo',
  jsonb_build_object(
    'report_id', (
      select id from public.reports
      where client_id = '20000000-0000-0000-0000-000000000001'
        and platform is null and period_start = '2026-07-01'
    ),
    'platform', 'facebook', 'meta_post_id', 'concurrent-meta-object',
    'publish_time', '2026-07-10T10:00:00Z', 'caption', 'Concurrent fixture',
    'permalink', 'https://facebook.example/concurrent-meta-object',
    'views', null, 'reach', null, 'reactions', 2, 'comments', 1, 'shares', 0,
    'raw', jsonb_build_object('source', 'meta_sync')));
