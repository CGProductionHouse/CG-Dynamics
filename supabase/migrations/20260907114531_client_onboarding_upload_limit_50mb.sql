-- Keep the database upload ceiling aligned with the client and Edge Function.

alter table public.client_onboarding_uploads
  drop constraint if exists client_onboarding_uploads_size_bytes_check;

alter table public.client_onboarding_uploads
  add constraint client_onboarding_uploads_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 52428800);
