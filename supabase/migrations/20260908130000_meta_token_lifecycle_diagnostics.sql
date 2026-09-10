-- Issue #236: server-only Meta token lifecycle evidence.
-- Metadata is deliberately stored beside the credential in the RLS-closed
-- table. Staff receive only a sanitized status through the Edge Function.

alter table public.meta_connection_tokens
  add column if not exists token_type text,
  add column if not exists data_access_expires_at timestamptz,
  add column if not exists last_validated_at timestamptz,
  add column if not exists validation_state text not null default 'unverified',
  add column if not exists validation_error_code text,
  add column if not exists validation_error_reason text;

alter table public.meta_connection_tokens
  drop constraint if exists meta_connection_tokens_validation_state_check;

alter table public.meta_connection_tokens
  add constraint meta_connection_tokens_validation_state_check
  check (validation_state in ('valid', 'invalid', 'unverified'));

comment on column public.meta_connection_tokens.validation_state is
  'Sanitized result of Meta /debug_token validation. Never a substitute for the server-only token value.';
comment on column public.meta_connection_tokens.last_validated_at is
  'When CG Dynamics last asked Meta to validate this token.';
comment on column public.meta_connection_tokens.data_access_expires_at is
  'Meta data-access expiry returned by /debug_token; distinct from token expiry.';

