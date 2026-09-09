-- Proposal-only additive migration for Issue #225: delegated OneDrive OAuth token store.
--
-- The CG Dynamics OneDrive is a PERSONAL Microsoft account, so app-only/client-credentials
-- is impossible. Delegated OAuth mints a refresh token (one-time interactive consent); this
-- table holds it ENCRYPTED at rest (AES-256-GCM via the Edge Function's ONEDRIVE_TOKEN_ENC_KEY).
--
-- NOT APPLIED to production. Review in the Supabase SQL editor; apply only with CA approval.
--
-- Boundaries: service-role only (RLS on, revoked from anon/authenticated). No plaintext tokens.
-- Raw tokens never leave the server and are never exposed to any client.

begin;

create table if not exists public.microsoft_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  -- Logical account slot; 'onedrive_personal' for the CG Production House personal OneDrive.
  account_key text not null unique
    check (char_length(account_key) between 1 and 64),
  -- Encrypted secrets (base64 of iv||ciphertext). Never plaintext.
  refresh_token_enc text,
  access_token_enc text,
  access_token_expires_at timestamptz,
  scope text,
  -- One-time consent (PKCE) handshake state; cleared after use.
  pending_state text,
  pending_verifier_enc text,
  pending_expires_at timestamptz,
  -- Lifecycle.
  obtained_at timestamptz not null default now(),
  rotated_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.microsoft_oauth_tokens is
  'Encrypted delegated OneDrive OAuth tokens for the personal Microsoft account (#225). '
  'Service-role only. AES-256-GCM encrypted at rest; refresh tokens rotate on each use. '
  'Raw tokens never exposed to clients.';
comment on column public.microsoft_oauth_tokens.refresh_token_enc is
  'AES-256-GCM encrypted delegated refresh token (base64 iv||ciphertext). Rotates on refresh.';
comment on column public.microsoft_oauth_tokens.pending_verifier_enc is
  'AES-256-GCM encrypted PKCE code_verifier for the one-time consent; cleared after callback.';

alter table public.microsoft_oauth_tokens enable row level security;

-- Service-role/Edge Function only. No browser access at all.
revoke all on public.microsoft_oauth_tokens from anon, authenticated;

commit;
