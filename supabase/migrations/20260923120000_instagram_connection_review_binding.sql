-- Issue #491: explicit staff review binds a pending standalone Instagram
-- identity into the existing canonical Meta client-asset authority. This file
-- is code-only until the protected deployment/configuration gates are approved.

begin;

alter table public.meta_client_assets
  add column if not exists instagram_connection_id uuid
    references public.meta_instagram_connections(id) on delete set null;

create unique index if not exists meta_client_assets_instagram_connection_uidx
  on public.meta_client_assets (instagram_connection_id)
  where instagram_connection_id is not null;

comment on column public.meta_client_assets.instagram_connection_id is
  'Exact reviewed standalone Instagram credential route. NULL keeps the preferred Facebook Page-linked route.';

create or replace function public.confirm_instagram_login_connection(
  p_connection_id uuid,
  p_client_id uuid,
  p_instagram_account_id text,
  p_instagram_username text,
  p_reviewed_by uuid
) returns table (asset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.meta_instagram_connections%rowtype;
  v_asset_id uuid;
  v_active_asset_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if not exists (
    select 1
    from auth.users auth_user
    join public.profiles profile on profile.id = auth_user.id
    where auth_user.id = p_reviewed_by
      and profile.is_active = true
      and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active admin or manager reviewer required';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and active = true) then
    raise exception 'Active client required';
  end if;

  select * into v_connection
  from public.meta_instagram_connections
  where id = p_connection_id
    and client_id = p_client_id
  for update;

  if not found or v_connection.status <> 'pending_review' then
    raise exception 'Exact pending Instagram connection no longer exists';
  end if;
  if v_connection.instagram_account_id <> p_instagram_account_id
    or pg_catalog.lower(v_connection.instagram_username) <> pg_catalog.lower(p_instagram_username)
  then
    raise exception 'Pending Instagram identity changed; review it again';
  end if;
  if v_connection.account_type not in ('business', 'creator')
    or not (v_connection.scopes @> array['instagram_business_basic', 'instagram_business_manage_insights']::text[])
  then
    raise exception 'Pending Instagram connection is not reporting-ready';
  end if;
  if not exists (
    select 1 from public.meta_instagram_connection_tokens token
    where token.connection_id = v_connection.id
      and pg_catalog.coalesce(pg_catalog.btrim(token.ciphertext_base64), '') <> ''
      and token.encryption_version = 'instagram-token-aes-256-gcm-v1'
  ) then
    raise exception 'Encrypted Instagram credential is missing';
  end if;
  if exists (
    select 1 from public.meta_instagram_connections connection
    where connection.instagram_account_id = p_instagram_account_id
      and connection.client_id <> p_client_id
  ) or exists (
    select 1 from public.meta_client_assets asset
    where asset.instagram_account_id = p_instagram_account_id
      and asset.client_id <> p_client_id
  ) then
    raise exception 'Instagram account is already assigned to another client';
  end if;
  if exists (
    select 1 from public.meta_client_assets asset
    where asset.client_id = p_client_id
      and asset.is_active = true
      and asset.instagram_account_id is not null
  ) then
    raise exception 'Client already has a canonical Instagram mapping';
  end if;

  select pg_catalog.count(*)::integer into v_active_asset_count
  from public.meta_client_assets asset
  where asset.client_id = p_client_id and asset.is_active = true;

  if v_active_asset_count > 1 then
    raise exception 'Multiple active Meta asset rows require review before standalone Instagram can be bound';
  elsif v_active_asset_count = 1 then
    update public.meta_client_assets asset set
      instagram_account_id = v_connection.instagram_account_id,
      instagram_username = v_connection.instagram_username,
      instagram_connection_id = v_connection.id,
      instagram_not_applicable = false,
      instagram_not_applicable_reason = null,
      instagram_not_applicable_updated_at = pg_catalog.now()
    where asset.client_id = p_client_id and asset.is_active = true
    returning asset.id into v_asset_id;
  else
    insert into public.meta_client_assets (
      client_id, connection_id, instagram_account_id, instagram_username,
      instagram_connection_id, instagram_not_applicable, is_active
    ) values (
      p_client_id, null, v_connection.instagram_account_id,
      v_connection.instagram_username, v_connection.id, false, true
    ) returning id into v_asset_id;
  end if;

  update public.meta_instagram_connections set
    status = 'connected',
    confirmed_asset_id = v_asset_id,
    updated_at = pg_catalog.now()
  where id = v_connection.id;

  return query select v_asset_id;
end;
$$;

revoke all on function public.confirm_instagram_login_connection(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_instagram_login_connection(uuid, uuid, text, text, uuid)
  to service_role;

commit;
