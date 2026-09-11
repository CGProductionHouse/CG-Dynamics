-- Add pagination_cursor to microsoft_sync_job_sources for bounded Graph API pagination
-- Allows large sources (e.g. 2025 CLIENTS SCHEDULE > 5000 tasks) to be fetched in multiple
-- job_process steps without truncating at the 5000-record safety cap.

alter table if exists public.microsoft_sync_job_sources
  add column if not exists pagination_cursor text;

comment on column public.microsoft_sync_job_sources.pagination_cursor is
  'Microsoft Graph @odata.nextLink cursor for resuming paginated fetches. Null when the source is fully fetched.';