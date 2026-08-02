-- ============================================================================
-- phase-24b — ingestion support (AI Workforce V2)
--
-- 1. Unique (document_id, content_hash) on chunks so re-ingestion is idempotent
--    and the ingestion function's upsert-ignore-duplicates works.
-- 2. Private Supabase Storage bucket for original source files (books/PDFs are
--    NEVER committed to GitHub — they live here, referenced by
--    marketing_library_documents.storage_path).
-- 3. Storage RLS: staff read, admin write, no client/public access.
-- Additive and idempotent.
-- ============================================================================

-- 1. Idempotent chunk dedup guard.
create unique index if not exists marketing_library_chunks_doc_hash_uidx
  on public.marketing_library_chunks (document_id, content_hash);

-- 2. Private storage bucket for original source documents.
insert into storage.buckets (id, name, public)
values ('marketing-library-sources', 'marketing-library-sources', false)
on conflict (id) do nothing;

-- 3. Storage policies: staff read, admin manage, no public/client access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mls_sources_staff_read'
  ) then
    create policy mls_sources_staff_read on storage.objects
      for select to authenticated
      using (bucket_id = 'marketing-library-sources' and public.is_staff());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mls_sources_admin_manage'
  ) then
    create policy mls_sources_admin_manage on storage.objects
      for all to authenticated
      using (bucket_id = 'marketing-library-sources' and public.is_admin())
      with check (bucket_id = 'marketing-library-sources' and public.is_admin());
  end if;
end $$;
