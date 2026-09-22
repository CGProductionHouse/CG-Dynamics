-- Issue #476: code-only correction for the unapplied standalone Instagram
-- Login foundation. Apply only after the foundation migration and explicit CA
-- approval. This migration deliberately aborts rather than discarding any
-- plaintext credential that may have appeared unexpectedly.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.meta_instagram_connection_tokens') is null then
    raise exception 'Standalone Instagram token foundation must exist first' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.meta_instagram_connection_tokens
    where access_token is not null
  ) then
    raise exception 'Plaintext standalone Instagram token rows exist; aborting encrypted-storage correction' using errcode = '55000';
  end if;
end;
$$;

-- Remove the only RPC contract that accepted a provider token in plaintext.
revoke all on function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, timestamptz
) from public, anon, authenticated, service_role;
drop function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, timestamptz
);

alter table public.meta_instagram_connection_tokens
  add column ciphertext_base64 text,
  add column iv_base64 text,
  add column encryption_version text,
  add column key_version text;

alter table public.meta_instagram_connection_tokens
  drop column access_token,
  alter column ciphertext_base64 set not null,
  alter column iv_base64 set not null,
  alter column encryption_version set not null,
  alter column key_version set not null,
  add constraint meta_instagram_token_ciphertext_base64_check
    check (
      pg_catalog.char_length(ciphertext_base64) >= 24
      and ciphertext_base64 ~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
    ),
  add constraint meta_instagram_token_iv_base64_check
    check (iv_base64 ~ '^[A-Za-z0-9+/]{16}$'),
  add constraint meta_instagram_token_encryption_version_check
    check (encryption_version = 'instagram-token-aes-256-gcm-v1'),
  add constraint meta_instagram_token_key_version_check
    check (key_version ~ '^v[1-9][0-9]{0,8}$');

comment on table public.meta_instagram_connection_tokens is
  'Service-role-only standalone Instagram credentials. AES-256-GCM ciphertext and 96-bit IV only; no plaintext token column.';
comment on column public.meta_instagram_connection_tokens.ciphertext_base64 is
  'Canonical base64 AES-256-GCM ciphertext with the 128-bit authentication tag appended by Web Crypto.';
comment on column public.meta_instagram_connection_tokens.iv_base64 is
  'Canonical base64 fresh 96-bit AES-GCM IV.';
comment on column public.meta_instagram_connection_tokens.encryption_version is
  'Versioned encryption/AAD contract. Current value: instagram-token-aes-256-gcm-v1.';
comment on column public.meta_instagram_connection_tokens.key_version is
  'Non-secret key version used by future reviewed decryption/key-rotation logic.';

create function public.complete_instagram_login_connection(
  p_client_id uuid,
  p_connected_by uuid,
  p_app_scoped_user_id text,
  p_instagram_account_id text,
  p_instagram_username text,
  p_account_type text,
  p_scopes text[],
  p_token_ciphertext_base64 text,
  p_token_iv_base64 text,
  p_encryption_version text,
  p_key_version text,
  p_token_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_account_type not in ('business', 'creator') then
    raise exception 'Professional Instagram account required';
  end if;
  if p_instagram_account_id !~ '^\d+$' or p_app_scoped_user_id !~ '^\d+$' then
    raise exception 'Invalid Instagram provider identity';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and active = true) then
    raise exception 'Active client required';
  end if;
  if not exists (
    select 1
    from auth.users auth_user
    join public.profiles profile on profile.id = auth_user.id
    where auth_user.id = p_connected_by
      and profile.is_active = true
      and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active admin or manager connecting user required';
  end if;
  if p_instagram_username !~ '^[A-Za-z0-9._]{1,30}$' then
    raise exception 'Invalid Instagram username';
  end if;
  if not (p_scopes @> array['instagram_business_basic', 'instagram_business_manage_insights']::text[]) then
    raise exception 'Required Instagram reporting scopes missing';
  end if;
  if p_encryption_version <> 'instagram-token-aes-256-gcm-v1' then
    raise exception 'Unsupported Instagram token encryption version';
  end if;
  if p_key_version !~ '^v[1-9][0-9]{0,8}$' then
    raise exception 'Invalid Instagram token key version';
  end if;
  if p_token_iv_base64 !~ '^[A-Za-z0-9+/]{16}$' then
    raise exception 'Invalid Instagram token IV';
  end if;
  if pg_catalog.char_length(p_token_ciphertext_base64) < 24
    or p_token_ciphertext_base64 !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
  then
    raise exception 'Invalid Instagram token ciphertext';
  end if;
  if exists (
    select 1 from public.meta_client_assets
    where client_id = p_client_id
      and is_active = true
      and instagram_account_id is not null
  ) then
    raise exception 'Client already has a canonical Instagram mapping';
  end if;
  if exists (
    select 1 from public.meta_instagram_connections
    where instagram_account_id = p_instagram_account_id and client_id <> p_client_id
  ) then
    raise exception 'Instagram account is already assigned to another client';
  end if;

  insert into public.meta_instagram_connections (
    client_id, connected_by, app_scoped_user_id, instagram_account_id,
    instagram_username, account_type, scopes, status, last_connected_at
  ) values (
    p_client_id, p_connected_by, p_app_scoped_user_id, p_instagram_account_id,
    p_instagram_username, p_account_type, p_scopes, 'pending_review', pg_catalog.now()
  )
  on conflict (client_id) do update set
    connected_by = excluded.connected_by,
    app_scoped_user_id = excluded.app_scoped_user_id,
    instagram_account_id = excluded.instagram_account_id,
    instagram_username = excluded.instagram_username,
    account_type = excluded.account_type,
    scopes = excluded.scopes,
    status = 'pending_review',
    confirmed_asset_id = null,
    last_connected_at = pg_catalog.now()
  returning id into v_connection_id;

  insert into public.meta_instagram_connection_tokens (
    connection_id, ciphertext_base64, iv_base64, encryption_version,
    key_version, token_expires_at
  ) values (
    v_connection_id, p_token_ciphertext_base64, p_token_iv_base64,
    p_encryption_version, p_key_version, p_token_expires_at
  )
  on conflict (connection_id) do update set
    ciphertext_base64 = excluded.ciphertext_base64,
    iv_base64 = excluded.iv_base64,
    encryption_version = excluded.encryption_version,
    key_version = excluded.key_version,
    token_expires_at = excluded.token_expires_at,
    updated_at = pg_catalog.now();

  return v_connection_id;
end;
$$;

revoke all on function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_instagram_login_connection(
  uuid, uuid, text, text, text, text, text[], text, text, text, text, timestamptz
) to service_role;

commit;
