-- #668: exact published files for a client-visible calendar post. Read only.
-- Uses the existing visibility/ownership authority; no new store or base-table grants.
begin;

create function public.client_portal_post_assets(p_client_id uuid, p_month date, p_post_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_keys text[];
  v_assets jsonb;
begin
  -- Execute existing ownership checks BEFORE touching the internal file catalogue,
  -- even for malformed/nonexistent keys. No client override or title matching.
  select array_agg(post.row_key) into v_keys
  from public.client_portal_month_ahead_posts_v2(p_client_id, p_month) post;
  if not coalesce(p_post_key = any(v_keys), false) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(candidate.asset order by candidate.published_at, candidate.id), '[]'::jsonb)
  into v_assets
  from (
    select a.id, a.published_at, jsonb_build_object(
      'id', a.id, 'category', c.category, 'displayName', a.display_name,
      'mimeType', a.mime_type, 'sizeBytes', a.size_bytes, 'publishedAt', a.published_at,
      'deliverableTitle', d.title, 'planMonth', to_char(d.month, 'YYYY-MM')
    ) as asset
    from public.monthly_deliverables d
    join public.client_portal_assets a on a.deliverable_id = d.id and a.client_id = d.client_id
    join public.client_portal_libraries l on l.id = a.library_id and l.client_id = a.client_id and l.drive_id = a.drive_id
    join public.client_portal_library_categories c on c.id = a.category_id and c.library_id = l.id
      and c.client_id = a.client_id and c.drive_id = a.drive_id and c.folder_item_id = a.parent_folder_item_id
    where d.client_id = p_client_id and d.month = date_trunc('month', p_month)::date
      and 'post-' || substr(md5(d.id::text), 1, 16) = p_post_key
      and d.archived_at is null
      and a.active and a.published_at <= now()
      and l.enabled and l.last_verified_at is not null
      and l.root_folder_name ~ '^A_ClientPortal_[A-Za-z0-9][A-Za-z0-9_-]{0,95}$'
      and c.last_verified_at is not null
      and ((c.category = 'graphic_design' and c.folder_name = 'Graphic Design')
        or (c.category = 'video' and c.folder_name = 'Video'))
      and a.library_year between 2000 and 2100 and a.library_month between 1 and 12
    order by a.published_at, a.id
    limit 24
  ) candidate;
  return v_assets;
end;
$$;

revoke all on function public.client_portal_post_assets(uuid, date, text) from public, anon;
grant execute on function public.client_portal_post_assets(uuid, date, text) to authenticated;
comment on function public.client_portal_post_assets(uuid, date, text) is
  'Read-only: up to 24 exact published final assets for one visible post. No Graph IDs, URLs, private notes or title-based association.';
commit;
