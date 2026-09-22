-- D02: preserve Meta post direct-field observation truth end to end.
-- This migration is intentionally additive and is not applied by this PR.

create or replace function public.meta_sync_upsert_report_post(
  p_item_id uuid default null,
  p_lease_generation bigint default null,
  p_client_id uuid default null,
  p_meta_object_id text default null,
  p_meta_object_type text default null,
  p_payload jsonb default '{}'::jsonb
)
returns table(post_id uuid, inserted boolean, reused_imported boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_client uuid;
declare v_report public.reports;
declare v_mapping public.meta_content_mappings;
declare v_existing public.posts;
declare v_imported public.posts;
declare v_imported_count integer;
declare v_duplicate uuid;
declare v_post_id uuid;
declare v_platform text := p_payload ->> 'platform';
declare v_report_id uuid := (p_payload ->> 'report_id')::uuid;
declare v_object text := btrim(p_meta_object_id);
declare v_now timestamptz := now();
declare v_evidence jsonb := p_payload #> '{raw,engagement_evidence}';
declare v_expected_definition text;
declare v_expected_label text;
declare v_required text[];
declare v_component text;
declare v_observed integer := 0;
declare v_known_subtotal bigint := 0;
declare v_component_state text;
declare v_component_value numeric;
declare v_complete boolean := false;
declare v_invalid boolean := false;
declare v_expected_completeness text;
declare v_existing_complete boolean := false;
declare v_effective_raw jsonb;
declare v_reactions integer;
declare v_comments integer;
declare v_shares integer;
begin
  if (p_item_id is null) <> (p_lease_generation is null) then
    raise exception 'Item and lease generation must be supplied together' using errcode = '22023';
  end if;
  if p_item_id is not null then
    v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
    v_client := v_item.client_id;
  else
    v_client := p_client_id;
  end if;
  if v_client is null or v_platform not in ('facebook', 'instagram')
     or v_report_id is null or nullif(v_object, '') is null then
    raise exception 'Invalid Meta post identity' using errcode = '22023';
  end if;

  v_expected_definition := case v_platform
    when 'facebook' then 'facebook_direct_reactions_comments_shares_v1'
    else 'instagram_direct_likes_comments_v1' end;
  v_expected_label := case v_platform
    when 'facebook' then 'Facebook direct reactions + comments + shares'
    else 'Instagram direct likes + comments' end;
  v_required := case v_platform
    when 'facebook' then array['reactions', 'comments', 'shares']
    else array['likes', 'comments'] end;

  if jsonb_typeof(v_evidence) <> 'object'
     or v_evidence ->> 'definition_id' <> v_expected_definition
     or v_evidence ->> 'definition_label' <> v_expected_label
     or v_evidence ->> 'source' <> 'meta_graph_api_direct_fields'
     or coalesce(v_evidence ->> 'observed_at', '') = ''
     or jsonb_typeof(v_evidence -> 'components') <> 'object' then
    raise exception 'Invalid Meta post engagement evidence' using errcode = '22023';
  end if;
  begin
    perform (v_evidence ->> 'observed_at')::timestamptz;
  exception when others then
    raise exception 'Invalid Meta post engagement observation timestamp' using errcode = '22023';
  end;
  if v_evidence -> 'required_components' is distinct from to_jsonb(v_required) then
    raise exception 'Invalid Meta post required component definition' using errcode = '22023';
  end if;

  foreach v_component in array v_required loop
    v_component_state := v_evidence #>> array['components', v_component, 'state'];
    if v_component_state not in ('observed', 'missing', 'invalid') then
      raise exception 'Invalid Meta post component state' using errcode = '22023';
    end if;
    if v_component_state = 'observed' then
      if jsonb_typeof(v_evidence #> array['components', v_component, 'value']) <> 'number' then
        raise exception 'Observed Meta post component must be numeric' using errcode = '22023';
      end if;
      v_component_value := (v_evidence #>> array['components', v_component, 'value'])::numeric;
      if v_component_value <> trunc(v_component_value) or v_component_value < 0 or v_component_value > 2147483647 then
        raise exception 'Observed Meta post component is outside the integer count range' using errcode = '22023';
      end if;
      v_observed := v_observed + 1;
      v_known_subtotal := v_known_subtotal + v_component_value::bigint;
      if v_component = 'reactions' or v_component = 'likes' then v_reactions := v_component_value::integer; end if;
      if v_component = 'comments' then v_comments := v_component_value::integer; end if;
      if v_component = 'shares' then v_shares := v_component_value::integer; end if;
    elsif (v_evidence #> array['components', v_component, 'value']) is distinct from 'null'::jsonb then
      raise exception 'Unobserved Meta post component must have a null value' using errcode = '22023';
    end if;
    if v_component_state = 'invalid' then v_invalid := true; end if;
  end loop;
  v_complete := v_observed = cardinality(v_required);
  v_expected_completeness := case when v_complete then 'complete' when v_invalid then 'invalid'
    when v_observed > 0 then 'partial' else 'unavailable' end;
  if v_evidence ->> 'completeness' <> v_expected_completeness
     or coalesce((v_evidence #>> '{coverage,observed}')::integer, -1) <> v_observed
     or coalesce((v_evidence #>> '{coverage,required}')::integer, -1) <> cardinality(v_required)
     or (v_complete and (jsonb_typeof(v_evidence -> 'complete_total') is distinct from 'number'
       or (v_evidence ->> 'complete_total')::numeric <> v_known_subtotal))
     or (not v_complete and (v_evidence -> 'complete_total') is distinct from 'null'::jsonb)
     or (v_observed > 0 and (jsonb_typeof(v_evidence -> 'known_subtotal') is distinct from 'number'
       or (v_evidence ->> 'known_subtotal')::numeric <> v_known_subtotal))
     or (v_observed = 0 and (v_evidence -> 'known_subtotal') is distinct from 'null'::jsonb) then
    raise exception 'Inconsistent Meta post engagement evidence' using errcode = '22023';
  end if;

  select r.* into v_report from public.reports r where r.id = v_report_id for update;
  if not found or v_report.client_id <> v_client or v_report.platform is not null then
    raise exception 'Report/client mismatch' using errcode = '23514';
  end if;
  if p_item_id is not null and not (
    v_report.period_end >= (v_item.month || '-01')::date
    and v_report.period_end < ((v_item.month || '-01')::date + interval '1 month')
  ) then raise exception 'Report/item month mismatch' using errcode = '23514'; end if;

  insert into public.meta_content_mappings as mapping
    (client_id, report_id, platform, meta_object_id, meta_object_type, permalink, last_synced_at)
  values (v_client, v_report_id, v_platform, v_object, p_meta_object_type, p_payload ->> 'permalink', v_now)
  on conflict (client_id, platform, meta_object_id) do update set updated_at = mapping.updated_at
  returning mapping.* into v_mapping;

  if v_mapping.post_id is not null then
    select p.* into v_existing from public.posts p where p.id = v_mapping.post_id for update;
    if v_existing.id is not null and v_existing.report_id <> v_report_id then
      raise exception 'Meta mapping/report mismatch requires review' using errcode = '23514';
    end if;
  end if;

  select count(*), (array_agg(p.id order by p.created_at, p.id))[1] into v_imported_count, v_duplicate
  from public.posts p left join public.meta_content_mappings m on m.post_id = p.id
  where p.report_id = v_report_id and p.platform = v_platform and m.id is null
    and coalesce(p.raw ->> 'source', '') <> 'meta_sync'
    and ((public.meta_normalize_permalink(p_payload ->> 'permalink') <> ''
          and public.meta_normalize_permalink(p.permalink) = public.meta_normalize_permalink(p_payload ->> 'permalink'))
      or (public.meta_normalize_caption(p_payload ->> 'caption') <> ''
          and public.meta_normalize_caption(p.caption) = public.meta_normalize_caption(p_payload ->> 'caption')
          and p.publish_time is not null and p_payload ->> 'publish_time' is not null
          and abs(extract(epoch from (p.publish_time - (p_payload ->> 'publish_time')::timestamptz))) <= 64800));
  if v_imported_count = 1 then select p.* into v_imported from public.posts p where p.id = v_duplicate for update; end if;
  if v_imported.id is not null then v_existing := v_imported; end if;

  inserted := false;
  reused_imported := v_existing.id is not null and coalesce(v_existing.raw ->> 'source', '') <> 'meta_sync';
  v_existing_complete := v_existing.raw #>> '{engagement_evidence,completeness}' = 'complete';
  v_effective_raw := coalesce(p_payload -> 'raw', '{}'::jsonb);
  if v_existing_complete and not v_complete then
    v_effective_raw := jsonb_set(
      v_effective_raw,
      '{engagement_evidence}',
      v_existing.raw -> 'engagement_evidence',
      true
    ) || jsonb_build_object('engagement_refresh_attempt', v_evidence);
    v_reactions := v_existing.reactions;
    v_comments := v_existing.comments;
    v_shares := v_existing.shares;
  end if;

  if v_existing.id is not null then
    if reused_imported then
      update public.posts set
        permalink = coalesce(nullif(permalink, ''), p_payload ->> 'permalink'),
        raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('meta_sync', v_effective_raw)
      where id = v_existing.id returning id into v_post_id;
    else
      update public.posts set
        meta_post_id = v_object, publish_time = (p_payload ->> 'publish_time')::timestamptz,
        meta_post_type = p_payload ->> 'meta_post_type', caption = p_payload ->> 'caption',
        permalink = p_payload ->> 'permalink', views = (p_payload ->> 'views')::integer,
        reach = (p_payload ->> 'reach')::integer, reactions = v_reactions,
        comments = v_comments, shares = v_shares, total_clicks = null, raw = v_effective_raw
      where id = v_existing.id returning id into v_post_id;
    end if;
  else
    insert into public.posts
      (report_id, platform, meta_post_id, publish_time, meta_post_type, caption,
       permalink, views, reach, reactions, comments, shares, total_clicks, raw)
    values
      (v_report_id, v_platform, v_object, (p_payload ->> 'publish_time')::timestamptz,
       p_payload ->> 'meta_post_type', p_payload ->> 'caption', p_payload ->> 'permalink',
       (p_payload ->> 'views')::integer, (p_payload ->> 'reach')::integer,
       v_reactions, v_comments, v_shares, null, v_effective_raw)
    on conflict (report_id, platform, meta_post_id)
      where platform in ('facebook', 'instagram') and nullif(btrim(meta_post_id), '') is not null
    do update set
      publish_time = excluded.publish_time, meta_post_type = excluded.meta_post_type,
      caption = excluded.caption, permalink = excluded.permalink, views = excluded.views,
      reach = excluded.reach,
      reactions = case when public.posts.raw #>> '{engagement_evidence,completeness}' = 'complete'
        and excluded.raw #>> '{engagement_evidence,completeness}' <> 'complete' then public.posts.reactions else excluded.reactions end,
      comments = case when public.posts.raw #>> '{engagement_evidence,completeness}' = 'complete'
        and excluded.raw #>> '{engagement_evidence,completeness}' <> 'complete' then public.posts.comments else excluded.comments end,
      shares = case when public.posts.raw #>> '{engagement_evidence,completeness}' = 'complete'
        and excluded.raw #>> '{engagement_evidence,completeness}' <> 'complete' then public.posts.shares else excluded.shares end,
      total_clicks = null,
      raw = case when public.posts.raw #>> '{engagement_evidence,completeness}' = 'complete'
        and excluded.raw #>> '{engagement_evidence,completeness}' <> 'complete'
        then jsonb_set(excluded.raw, '{engagement_evidence}', public.posts.raw -> 'engagement_evidence', true)
          || jsonb_build_object('engagement_refresh_attempt', excluded.raw -> 'engagement_evidence')
        else excluded.raw end
    returning id, (xmax = 0) into v_post_id, inserted;
  end if;

  if v_mapping.post_id is not null and v_mapping.post_id <> v_post_id then v_duplicate := v_mapping.post_id; else v_duplicate := null; end if;
  update public.meta_content_mappings set report_id = v_report_id, post_id = v_post_id,
    meta_object_type = p_meta_object_type, permalink = p_payload ->> 'permalink', last_synced_at = v_now
  where id = v_mapping.id;
  if v_duplicate is not null then
    raise exception 'Conflicting imported and provider posts require reviewed reconciliation' using errcode = '23514';
  end if;
  post_id := v_post_id;
  return next;
end;
$$;

revoke all on function public.meta_sync_upsert_report_post(uuid, bigint, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.meta_sync_upsert_report_post(uuid, bigint, uuid, text, text, jsonb) to service_role;

drop function if exists public.client_published_report_posts(uuid);
create function public.client_published_report_posts(p_report_id uuid)
returns table (
  platform text, publish_time timestamptz, post_type text, caption text, permalink text,
  impressions integer, reach integer, engagements bigint, engagement_known_subtotal bigint,
  engagement_definition_id text, engagement_definition_label text, engagement_source text,
  engagement_observed_at timestamptz, engagement_coverage jsonb, engagement_completeness text,
  excluded boolean
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
      and e.post_id = p.id and e.client_id = v_client_id and e.excluded)
  from public.posts p where p.report_id = p_report_id
  order by p.publish_time nulls last, p.created_at;
end;
$$;

revoke all on function public.client_published_report_posts(uuid) from public, anon;
grant execute on function public.client_published_report_posts(uuid) to authenticated;
