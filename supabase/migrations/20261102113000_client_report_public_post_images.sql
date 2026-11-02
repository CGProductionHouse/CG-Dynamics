-- #668: additive public-thumbnail projection. Source-only until exact rollout approval.
-- Same caller, ownership, publication and metric authority; no table grants.
begin;
drop function public.client_published_report_posts(uuid);
create function public.client_published_report_posts(p_report_id uuid)
returns table (
  platform text, publish_time timestamptz, post_type text, caption text, permalink text,
  impressions integer, reach integer, engagements bigint, engagement_known_subtotal bigint,
  engagement_definition_id text, engagement_definition_label text, engagement_source text,
  engagement_observed_at timestamptz, engagement_coverage jsonb, engagement_completeness text,
  excluded boolean, image_url text
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare v_client_id uuid;
begin
  if not exists (select 1 from public.profiles profile where profile.id = auth.uid()
    and profile.is_active and profile.role = 'client' and profile.client_id is not null)
  then raise exception 'Active client access required' using errcode = '42501'; end if;
  select r.client_id into v_client_id from public.reports r
  where r.id = p_report_id and r.status = 'published';
  if not found or v_client_id is distinct from public.my_client_id() then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select p.platform, p.publish_time, coalesce(p.raw ->> 'content_type', p.meta_post_type),
    p.caption, p.permalink,
    case when p.raw ->> 'source' = 'meta_sync' or p.raw ? 'synced_at'
      then case when jsonb_typeof(p.raw -> 'views') = 'number' then (p.raw ->> 'views')::integer end
      when jsonb_typeof(p.raw -> 'views') = 'number' then (p.raw ->> 'views')::integer
      when jsonb_typeof(p.raw -> 'impressions') = 'number' then (p.raw ->> 'impressions')::integer else p.views end,
    case when p.raw ->> 'source' = 'meta_sync' or p.raw ? 'synced_at'
      then case when jsonb_typeof(p.raw -> 'reach') = 'number' then (p.raw ->> 'reach')::integer end else p.reach end,
    case
      when p.raw #>> '{engagement_evidence,completeness}' = 'complete'
        then (p.raw #>> '{engagement_evidence,complete_total}')::bigint
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then (p.raw ->> 'engagements')::bigint end end
      else null end,
    case
      when jsonb_typeof(p.raw #> '{engagement_evidence,known_subtotal}') = 'number'
        then (p.raw #>> '{engagement_evidence,known_subtotal}')::bigint
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then (p.raw ->> 'engagements')::bigint end end
      else null end,
    case when p.raw ? 'engagement_evidence' then p.raw #>> '{engagement_evidence,definition_id}'
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then p.platform || '_legacy_import_engagements_v1' end end end,
    case when p.raw ? 'engagement_evidence' then p.raw #>> '{engagement_evidence,definition_label}'
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then initcap(p.platform) || ' legacy imported engagements' end end end,
    case when p.raw ? 'engagement_evidence' then p.raw #>> '{engagement_evidence,source}'
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null
        then coalesce(nullif(p.raw ->> 'import_source', ''), 'meta_business_suite')
      else p.raw ->> 'source' end,
    case when p.raw ? 'engagement_evidence' then (p.raw #>> '{engagement_evidence,observed_at}')::timestamptz
      when p.raw ? 'synced_at' then (p.raw ->> 'synced_at')::timestamptz else p.created_at end,
    case when p.raw ? 'engagement_evidence' then p.raw #> '{engagement_evidence,coverage}'
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then '{"observed":1,"required":1}'::jsonb end end end,
    case when p.raw ? 'engagement_evidence' then p.raw #>> '{engagement_evidence,completeness}'
      when nullif(p.raw ->> 'imported_meta_post_id', '') is not null then
        case when jsonb_typeof(p.raw -> 'engagements') = 'number' then
          case when (p.raw ->> 'engagements')::numeric = trunc((p.raw ->> 'engagements')::numeric)
            and (p.raw ->> 'engagements')::numeric between 0 and 2147483647
            then 'complete' else 'invalid' end
          when p.raw ? 'engagements' then 'invalid' else 'unavailable' end
      else 'unavailable' end,
    exists (select 1 from public.report_content_exclusions e where e.report_id = p_report_id
      and e.post_id = p.id and e.client_id = v_client_id and e.excluded),
    -- Expose a single public provider thumbnail, never raw/provider identifiers.
    -- Excluded posts and content beyond a published cutoff get no image URL.
    case when p.platform in ('facebook', 'instagram')
      and (p.raw ->> 'source' = 'meta_sync' or p.raw ? 'synced_at')
      and (p.publish_time at time zone 'America/Los_Angeles')::date between r.period_start and r.period_end
      and not exists (select 1 from public.report_content_exclusions e where e.report_id = p_report_id
        and e.post_id = p.id and e.client_id = v_client_id and e.excluded)
    then (select candidate from unnest(array[p.raw ->> 'full_picture', p.raw ->> 'thumbnail_url', p.raw ->> 'media_url'])
      with ordinality as media(candidate, position)
      where candidate ~ '^https://([a-zA-Z0-9-]+\.)*(fbcdn\.net|cdninstagram\.com)/[^[:space:]]+$'
        and candidate !~* '(access_token|authorization|api_key|secret)|[?&][^=&]*%'
      order by position limit 1)
    end
  from public.posts p join public.reports r on r.id = p.report_id
  where p.report_id = p_report_id
  order by p.publish_time nulls last, p.created_at;
end;
$$;

revoke all on function public.client_published_report_posts(uuid) from public, anon;
grant execute on function public.client_published_report_posts(uuid) to authenticated;
commit;
