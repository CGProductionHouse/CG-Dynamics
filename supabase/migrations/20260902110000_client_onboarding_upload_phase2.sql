-- Phase 2: upload drive mapping table for exact-client folder resolution.
-- Staff populate this table when they first set up a client's OneDrive structure.
-- The Edge Function reads it to resolve the target folder for uploads.

begin;

create table public.client_onboarding_drive_mapping (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  folder_item_id text not null check (char_length(folder_item_id) between 1 and 255),
  folder_name text not null default 'Brand Identity',
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, drive_id, folder_item_id)
);

comment on table public.client_onboarding_drive_mapping is
  'Maps one canonical client to the exact OneDrive Brand Identity folder used for onboarding uploads.';

alter table public.client_onboarding_drive_mapping enable row level security;

revoke all on public.client_onboarding_drive_mapping from anon, authenticated;

-- Extend the upload record to track upload session state for resumable uploads.
alter table public.client_onboarding_uploads
  add column if not exists upload_session_id text,
  add column if not exists upload_session_expires_at timestamptz,
  add column if not exists storage_original_reference text;

comment on column public.client_onboarding_uploads.storage_original_reference is
  'Human-readable internal OneDrive path/reference. Never include in client-facing API responses.';

comment on column public.client_onboarding_uploads.upload_session_id is
  'Microsoft Graph upload session identifier for resumable uploads. Cleared after completion.';

commit;
