-- TikTok OAuth must never bind the same provider-owned account identity to
-- more than one CG client. This remains unapplied until CA approves it.
do $$
begin
  if exists (
    select 1 from public.tiktok_connections
    where tiktok_open_id is not null
    group by tiktok_open_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce TikTok account identity: duplicate provider mappings exist';
  end if;
end $$;

create unique index if not exists tiktok_connections_exact_provider_account_idx
  on public.tiktok_connections (tiktok_open_id)
  where tiktok_open_id is not null;
