do $$
declare v_report_id uuid;
begin
  select id into v_report_id from public.reports
  where client_id = '20000000-0000-0000-0000-000000000001'
    and platform is null and period_start = '2026-07-01';
  if (select count(*) <> 1 from public.reports
      where client_id = '20000000-0000-0000-0000-000000000001'
        and platform is null and period_start = '2026-07-01') then
    raise exception 'expected exactly one canonical report';
  end if;
  if (select count(*) <> 1 from public.posts where report_id = v_report_id
      and platform = 'facebook' and meta_post_id = 'concurrent-meta-object') then
    raise exception 'expected exactly one canonical post';
  end if;
  if (select count(*) <> 1 from public.meta_content_mappings
      where client_id = '20000000-0000-0000-0000-000000000001'
        and platform = 'facebook' and meta_object_id = 'concurrent-meta-object') then
    raise exception 'expected exactly one canonical mapping';
  end if;
  if exists (
    select 1 from public.posts p left join public.meta_content_mappings m on m.post_id = p.id
    where p.report_id = v_report_id and p.raw ->> 'source' = 'meta_sync' and m.id is null
  ) then raise exception 'orphan Meta sync post detected'; end if;
end
$$;

delete from public.meta_content_mappings where client_id = '20000000-0000-0000-0000-000000000001';
delete from public.posts where report_id in (
  select id from public.reports where client_id = '20000000-0000-0000-0000-000000000001');
delete from public.reports where client_id = '20000000-0000-0000-0000-000000000001';
delete from public.meta_sync_batch_items where batch_id = '20000000-0000-0000-0000-000000000002';
delete from public.meta_sync_batches where id = '20000000-0000-0000-0000-000000000002';
delete from public.clients where id = '20000000-0000-0000-0000-000000000001';
