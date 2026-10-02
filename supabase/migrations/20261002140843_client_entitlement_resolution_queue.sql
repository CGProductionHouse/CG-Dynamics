-- #389 admin resolution read only. Prepared/unapplied. No entitlement seeding.
-- Depends on 20261002124434_client_service_entitlements.sql.
create function public.get_admin_entitlement_resolution_queue(p_after_client_id uuid default null, p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','manager')) then
    raise exception 'Active manager access required' using errcode='42501';
  end if;
  if p_page_size is null or p_page_size not between 1 and 100 then raise exception 'Page size must be 1..100'; end if;
  with page as (
    select id,name,package_settings from public.clients
    where active and (p_after_client_id is null or id > p_after_client_id) order by id limit p_page_size
  )
  select coalesce(jsonb_agg(jsonb_build_object('client_id',client.id,'client_name',client.name,
    'package_settings',client.package_settings,
    'entitlements',(select coalesce(jsonb_agg(jsonb_build_object('service_key',e.service_key,'state',e.state,
      'evidence_note',e.evidence_note,'source_references',e.source_references,'verified_at',e.verified_at,
      'revision',e.revision,'notes',e.notes) order by e.service_key),'[]'::jsonb)
      from public.client_service_entitlements e where e.client_id=client.id),
    'connections',(select jsonb_agg(jsonb_build_object('service_key',s.key,'connection',case
      when s.key='instagram' then case when exists (
        select 1 from public.meta_client_assets a join public.meta_connections c on c.id=a.connection_id
        where a.client_id=client.id and a.is_active and nullif(a.instagram_account_id,'') is not null and c.status='connected'
      ) or exists (
        select 1 from public.meta_instagram_connections c join public.meta_client_assets a on a.id=c.confirmed_asset_id
        where c.client_id=client.id and a.client_id=client.id and a.is_active and c.status='connected' and a.instagram_account_id=c.instagram_account_id
      ) then 'connected' else 'needs_connection' end
      when s.key='meta_ads' then case when exists (
        select 1 from public.meta_client_assets a join public.meta_connections c on c.id=a.connection_id
        where a.client_id=client.id and a.is_active and nullif(a.ad_account_id,'') is not null and c.status='connected'
      ) then 'connected' else 'needs_connection' end
      when s.key='tiktok' then case when exists(select 1 from public.tiktok_connections c where c.client_id=client.id and c.status='connected' and nullif(c.tiktok_open_id,'') is not null)
        then 'connected' else 'needs_connection' end
      when s.key='google_ads' then case when exists(
        select 1 from public.google_ads_account_links l join public.google_ads_accounts a on a.id=l.google_ads_account_id
        where l.client_id=client.id and l.is_active and a.is_active and a.account_mode='dedicated'
      ) or exists(
        select 1 from public.google_ads_campaign_links l join public.google_ads_accounts a on a.id=l.google_ads_account_id
        where l.client_id=client.id and l.is_active and a.is_active and a.account_mode='shared'
      ) then 'connected' else 'needs_connection' end
      else 'unavailable' end) order by s.key)
      from unnest(array['linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience']) s(key))
    ) order by client.id),'[]'::jsonb) into v_result from page client;
  return v_result;
end $$;
revoke all on function public.get_admin_entitlement_resolution_queue(uuid,integer) from public,anon;
grant execute on function public.get_admin_entitlement_resolution_queue(uuid,integer) to authenticated;
