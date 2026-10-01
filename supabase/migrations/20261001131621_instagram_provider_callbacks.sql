-- #593. Code-only: do not apply without separate CA migration approval.
begin;

-- Never infer a historical connection's app namespace. Existing rows remain
-- NULL and are held until exact provenance is established separately.
alter table public.meta_instagram_connections add column instagram_app_id text
  check (instagram_app_id ~ '^[0-9]{1,40}$');
create unique index meta_instagram_connections_app_user_uidx
  on public.meta_instagram_connections (instagram_app_id, app_scoped_user_id)
  where instagram_app_id is not null;

create table public.meta_instagram_callback_receipts (
  request_key text primary key check (request_key ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('deauthorize', 'data_deletion')),
  confirmation_hash text not null unique check (confirmation_hash ~ '^[a-f0-9]{64}$'),
  completed_at timestamptz not null default now()
);
comment on table public.meta_instagram_callback_receipts is
  'Minimal completed callback receipts: opaque keyed request digest and confirmation hash only. No provider/client identity, raw signed request, token or username. Append-only via service-only RPC.';
alter table public.meta_instagram_callback_receipts enable row level security;
revoke all on public.meta_instagram_callback_receipts from public, anon, authenticated, service_role;

-- Keep the reviewed persistence implementation but require a namespaced wrapper.
alter function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz
) rename to complete_instagram_login_connection_unscoped;
revoke all on function public.complete_instagram_login_connection_unscoped(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;

create function public.complete_instagram_login_connection(
  p_client_id uuid, p_connected_by uuid, p_app_scoped_user_id text,
  p_instagram_account_id text, p_instagram_username text, p_account_type text,
  p_scopes text[], p_token_ciphertext_base64 text, p_token_iv_base64 text,
  p_encryption_version text, p_key_version text, p_token_expires_at timestamptz,
  p_instagram_app_id text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_instagram_app_id is null or p_instagram_app_id !~ '^[0-9]{1,40}$'
    or p_app_scoped_user_id is null or p_app_scoped_user_id !~ '^[0-9]{1,40}$'
  then raise exception 'Exact Instagram app identity required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_instagram_app_id || ':' || p_app_scoped_user_id, 593));
  v_id := public.complete_instagram_login_connection_unscoped(
    p_client_id, p_connected_by, p_app_scoped_user_id, p_instagram_account_id,
    p_instagram_username, p_account_type, p_scopes, p_token_ciphertext_base64,
    p_token_iv_base64, p_encryption_version, p_key_version, p_token_expires_at
  );
  update public.meta_instagram_connections set instagram_app_id = p_instagram_app_id where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz, text
) to service_role;

create function public.apply_instagram_provider_callback(
  p_kind text, p_app_id text, p_app_scoped_user_id text, p_issued_at bigint,
  p_request_key text, p_confirmation_hash text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.meta_instagram_connections%rowtype;
  v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_kind is null or p_kind not in ('deauthorize', 'data_deletion')
    or p_app_id is null or p_app_id !~ '^[0-9]{1,40}$'
    or p_app_scoped_user_id is null or p_app_scoped_user_id !~ '^[0-9]{1,40}$'
    or p_issued_at is null or p_issued_at <= 0 or p_issued_at > pg_catalog.date_part('epoch', pg_catalog.now()) + 60
    or p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$'
    or p_confirmation_hash is null or p_confirmation_hash !~ '^[a-f0-9]{64}$'
  then raise exception 'Invalid callback contract'; end if;

  -- Shared with OAuth persistence: serialize callback/reconnect for this exact
  -- app-scoped identity. Row locks also serialize review and client reassignment.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_app_id || ':' || p_app_scoped_user_id, 593));
  if exists (select 1 from public.meta_instagram_callback_receipts where request_key = p_request_key) then
    if not exists (select 1 from public.meta_instagram_callback_receipts
      where request_key = p_request_key and kind = p_kind and confirmation_hash = p_confirmation_hash)
    then raise exception 'Callback receipt conflict'; end if;
    return;
  end if;

  -- A known, unnamespaced historical identity is not safe to classify as absent.
  if exists (select 1 from public.meta_instagram_connections
    where app_scoped_user_id = p_app_scoped_user_id and instagram_app_id is null)
  then raise exception 'Historical Instagram app provenance requires review'; end if;

  select count(*) into v_count from public.meta_instagram_connections
    where instagram_app_id = p_app_id and app_scoped_user_id = p_app_scoped_user_id;
  if v_count > 1 then raise exception 'Ambiguous Instagram identity'; end if;
  select * into v_connection from public.meta_instagram_connections
    where instagram_app_id = p_app_id and app_scoped_user_id = p_app_scoped_user_id for update;
  if found then
    -- Meta timestamps have second precision. Reject a callback preceding this
    -- connection, including ambiguous same-second ordering, rather than revoke
    -- a newly consented generation. Return no false completion on this conflict.
    if v_connection.last_connected_at > pg_catalog.to_timestamp(p_issued_at::double precision) then
      raise exception 'Callback predates current connection; requires review';
    end if;
    perform 1 from public.meta_client_assets
      where instagram_connection_id = v_connection.id or id = v_connection.confirmed_asset_id for update;
    if exists (select 1 from public.meta_client_assets
      where (instagram_connection_id = v_connection.id or id = v_connection.confirmed_asset_id)
        and (client_id <> v_connection.client_id
          or instagram_connection_id is distinct from v_connection.id
          or instagram_account_id is distinct from v_connection.instagram_account_id
          or facebook_page_id is not null))
    then raise exception 'Exact standalone binding requires review'; end if;

    delete from public.meta_instagram_connection_tokens where connection_id = v_connection.id;
    if p_kind = 'deauthorize' then
      -- Keep the canonical credential route bound. Clearing it here could enable
      -- the legacy Meta-token fallback; revoked status instead fails closed.
      update public.meta_instagram_connections set status = 'revoked', scopes = '{}'
        where id = v_connection.id;
    else
      -- Clear only these exact standalone Instagram fields BEFORE FK unlink.
      -- Preserve Facebook, client activity, reports/posts/snapshots and OAuth
      -- intent rows (staff-owned intentions, not provider-derived identity).
      update public.meta_client_assets set instagram_account_id = null,
        instagram_username = null, instagram_connection_id = null
        where instagram_connection_id = v_connection.id
          and client_id = v_connection.client_id
          and instagram_account_id = v_connection.instagram_account_id
          and facebook_page_id is null;
      delete from public.meta_instagram_connections where id = v_connection.id;
    end if;
  end if;
  -- Insert only after successful deletion/revocation, in the same transaction.
  -- A retry after deletion finds the receipt; it never targets a later connection.
  insert into public.meta_instagram_callback_receipts(request_key, kind, confirmation_hash)
    values (p_request_key, p_kind, p_confirmation_hash);
end;
$$;
revoke all on function public.apply_instagram_provider_callback(text, text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_instagram_provider_callback(text, text, text, bigint, text, text)
  to service_role;

create function public.instagram_data_deletion_status(p_confirmation_hash text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_confirmation_hash is null or p_confirmation_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  if exists (select 1 from public.meta_instagram_callback_receipts
    where confirmation_hash = p_confirmation_hash and kind = 'data_deletion') then return 'completed'; end if;
  return null;
end;
$$;
revoke all on function public.instagram_data_deletion_status(text) from public, anon, authenticated;
grant execute on function public.instagram_data_deletion_status(text) to service_role;

commit;
