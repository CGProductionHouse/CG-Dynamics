-- ============================================================================
-- phase-23a-ai-workforce-source-rights.sql
--
-- Rights-aware source model for the AI Workforce Marketing Library. Adds a
-- proper copyright/rights model to marketing_library_sources, a document + chunk
-- foundation for lawful full-text retrieval, and a historical-ad study table.
--
-- Scope: Marketing Library / AI Workforce only. Does NOT touch Operations Hub,
-- command-centre, client reporting, or unrelated RLS. Additive + idempotent.
--
-- Rights are never inferred from age alone: every record carries an explicit
-- rights_status, rights_basis, access_mode and canonical_url, and text is only
-- ever ingested for sources whose access_mode permits it. Admins manage rights;
-- staff read approved material through the server retrieval layer; clients get
-- no Marketing Library table access.
-- ============================================================================

-- 1. Rights fields on the existing source table (additive) --------------------
alter table public.marketing_library_sources
  add column if not exists canonical_url        text,
  add column if not exists edition               text,
  add column if not exists language              text,
  add column if not exists country               text,
  add column if not exists source_identifier      text,  -- LCCN / archive ID / ISBN
  add column if not exists rights_status          text,
  add column if not exists rights_basis           text,
  add column if not exists licence_name           text,
  add column if not exists commercial_use         text,  -- allowed | restricted | unknown
  add column if not exists full_text_storage       boolean not null default false,
  add column if not exists access_mode            text,
  add column if not exists rights_checked_at        timestamptz,
  add column if not exists rights_review_notes      text,
  add column if not exists ingestion_status        text not null default 'catalogued',
  add column if not exists content_hash            text,
  add column if not exists acquisition_status       text;  -- to_purchase | owned | available_for_review | reviewed | not_approved

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mls_rights_status_check') then
    alter table public.marketing_library_sources add constraint mls_rights_status_check
      check (rights_status is null or rights_status in
        ('public_domain','open_license','official_reference','user_owned','research_only','bibliographic_only','rights_unknown','prohibited'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mls_access_mode_check') then
    alter table public.marketing_library_sources add constraint mls_access_mode_check
      check (access_mode is null or access_mode in
        ('full_text_allowed','excerpt_only','metadata_and_link_only','internal_notes_only','do_not_ingest'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mls_ingestion_status_check') then
    alter table public.marketing_library_sources add constraint mls_ingestion_status_check
      check (ingestion_status in ('catalogued','queued','extracting','extracted','verified','excluded'));
  end if;
end $$;

comment on column public.marketing_library_sources.access_mode is
  'Governs what may be stored/retrieved. Only full_text_allowed / excerpt_only permit chunk text; everything else is metadata + link (or internal notes) only.';

-- Extend the source_type allowlist additively for archive/collection sources
-- (keeps every existing value; only adds new permitted ones).
alter table public.marketing_library_sources drop constraint if exists marketing_library_sources_source_type_check;
alter table public.marketing_library_sources add constraint marketing_library_sources_source_type_check
  check (source_type = any (array[
    'book','research_paper','official_documentation','market_report','internal_campaign_data',
    'client_interview','staff_observation','professional_source','other','ai_generated','unsourced_blog',
    'newspaper_archive','image_collection','ad_archive','poster_collection']));

-- 2. Documents (one per lawfully stored source edition) -----------------------
create table if not exists public.marketing_library_documents (
  id                 uuid primary key default gen_random_uuid(),
  source_id          uuid not null references public.marketing_library_sources(id) on delete cascade,
  title              text not null,
  edition            text,
  document_type      text,
  language           text,
  canonical_url      text,
  storage_path       text,            -- private Supabase Storage path when rights permit
  ingestion_status   text not null default 'catalogued'
                       check (ingestion_status in ('catalogued','queued','extracting','extracted','verified','excluded')),
  extraction_method  text,            -- 'human_verified' | 'ocr' | 'publisher_text' | null
  content_hash       text,
  page_count         integer,
  text_human_verified boolean not null default false,
  rights_status      text,            -- copied from source at creation
  access_mode        text,
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid
);
create index if not exists idx_mls_documents_source on public.marketing_library_documents (source_id);

-- 3. Chunks (searchable sections of permitted documents) ----------------------
create table if not exists public.marketing_library_chunks (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references public.marketing_library_documents(id) on delete cascade,
  section            text,
  page_start         integer,
  page_end           integer,
  body               text not null,
  search_vector      tsvector,
  content_hash       text,
  extraction_confidence numeric,
  verification_state text not null default 'needs_review'
                       check (verification_state in ('needs_review','verified','rejected')),
  created_at         timestamptz not null default now()
);
create index if not exists idx_mls_chunks_document on public.marketing_library_chunks (document_id);
create index if not exists idx_mls_chunks_fts on public.marketing_library_chunks using gin (search_vector);

create or replace function public.mls_chunks_tsv_update() returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english', coalesce(new.body, ''));
  return new;
end $$;
drop trigger if exists trg_mls_chunks_tsv on public.marketing_library_chunks;
create trigger trg_mls_chunks_tsv before insert or update of body on public.marketing_library_chunks
  for each row execute function public.mls_chunks_tsv_update();

-- 4. Historical advertisement study records -----------------------------------
create table if not exists public.marketing_library_historical_ads (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid references public.marketing_library_sources(id) on delete set null,
  headline         text,
  product_or_offer text,
  medium           text,
  period           text,
  publication_title text,
  publication_date  text,
  page             text,
  location         text,
  canonical_url    text not null,
  visual_hierarchy text,
  dominant_appeal  text,
  proof_device     text,
  cta              text,
  audience         text,
  rights_status    text,
  access_mode      text,
  ocr_confidence   numeric,
  candidate_principles jsonb not null default '[]'::jsonb,
  interpretation_notes text,   -- separates timeless / obsolete / unethical / non-compliant
  review_status    text not null default 'needs_review'
                     check (review_status in ('needs_review','verified','rejected')),
  created_at       timestamptz not null default now()
);
create index if not exists idx_mls_hist_ads_source on public.marketing_library_historical_ads (source_id);

-- 5. RLS — admins manage; staff read; no client access ------------------------
alter table public.marketing_library_documents        enable row level security;
alter table public.marketing_library_chunks           enable row level security;
alter table public.marketing_library_historical_ads   enable row level security;

do $$
begin
  drop policy if exists "mls_documents: staff read" on public.marketing_library_documents;
  create policy "mls_documents: staff read" on public.marketing_library_documents for select using (public.is_staff());
  drop policy if exists "mls_documents: admin manage" on public.marketing_library_documents;
  create policy "mls_documents: admin manage" on public.marketing_library_documents for all using (public.is_admin()) with check (public.is_admin());

  drop policy if exists "mls_chunks: staff read" on public.marketing_library_chunks;
  create policy "mls_chunks: staff read" on public.marketing_library_chunks for select using (public.is_staff());
  drop policy if exists "mls_chunks: admin manage" on public.marketing_library_chunks;
  create policy "mls_chunks: admin manage" on public.marketing_library_chunks for all using (public.is_admin()) with check (public.is_admin());

  drop policy if exists "mls_hist_ads: staff read" on public.marketing_library_historical_ads;
  create policy "mls_hist_ads: staff read" on public.marketing_library_historical_ads for select using (public.is_staff());
  drop policy if exists "mls_hist_ads: admin manage" on public.marketing_library_historical_ads;
  create policy "mls_hist_ads: admin manage" on public.marketing_library_historical_ads for all using (public.is_admin()) with check (public.is_admin());
end $$;

-- 6. Seed the factual approved source catalog (idempotent by title+year) -------
-- All records are real, with explicit rights + canonical URLs. No text is
-- ingested here; ingestion is a separate reviewed step gated by access_mode.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, canonical_url,
   rights_status, rights_basis, access_mode, commercial_use, trust_tier, ingestion_status, rights_checked_at)
select v.source_type, v.source_name, v.author, v.title, v.year, v.url,
       v.rights, v.basis, v.access, v.commercial, 'tier_1_primary', 'catalogued', now()
from (values
  ('book','Scientific Advertising','Claude C. Hopkins','Scientific Advertising',1923,'https://www.loc.gov/item/23009362/','public_domain','US work published 1923; public domain','full_text_allowed','allowed'),
  ('book','My Life in Advertising','Claude C. Hopkins','My Life in Advertising',1927,'https://www.loc.gov/item/27024090/','public_domain','US work published 1927; public domain','full_text_allowed','allowed'),
  ('book','The Theory of Advertising','Walter Dill Scott','The Theory of Advertising',1903,'https://archive.org/details/theoryofadvertis00scotrich','public_domain','US work published 1903; public domain (item-level verify before full ingest)','full_text_allowed','allowed'),
  ('book','The Psychology of Advertising','Walter Dill Scott','The Psychology of Advertising',1913,'https://commons.wikimedia.org/wiki/File:The_psychology_of_advertising_(IA_psychologyadvert00scotrich).pdf','public_domain','US work published 1913; public domain (item-level verify)','full_text_allowed','allowed'),
  ('book','Advertising and Its Mental Laws','Henry Foster Adams','Advertising and Its Mental Laws',1916,'https://openlibrary.org/books/OL7177286M/Advertising_and_its_mental_laws','public_domain','US work published 1916; public domain (item-level verify)','full_text_allowed','allowed'),
  ('book','Advertising, Its Principles and Practice','Tipper, Hollingworth, Hotchkiss, Parsons','Advertising, Its Principles and Practice',1915,'https://openlibrary.org/books/OL14588708M/Advertising_its_principles_and_practice','public_domain','US work published 1915; public domain (item-level verify)','full_text_allowed','allowed'),
  ('book','How to Write Advertisements That Sell','A.W. Shaw Company','How to Write Advertisements That Sell',1912,'https://openlibrary.org/books/OL6548765M/How_to_write_advertisements_that_sell','public_domain','US work published 1912; public domain (item-level verify)','full_text_allowed','allowed'),
  ('book','Commercial Advertising','Thomas Russell','Commercial Advertising',1919,'https://commons.wikimedia.org/wiki/File:Commercial_advertising;_six_lectures_at_the_London_school_of_economics_(IA_commercialadvert00russrich).pdf','public_domain','Published 1919; public domain (item-level verify)','full_text_allowed','allowed'),
  ('newspaper_archive','Chronicling America','Library of Congress / NEH','Chronicling America Historic Newspapers',NULL,'https://www.loc.gov/collections/chronicling-america/','public_domain','Pages published through 1930 public domain; later pages need item-level review','metadata_and_link_only','allowed'),
  ('image_collection','LOC Free to Use — Advertising Food','Library of Congress','Free to Use and Reuse: Advertising Food',NULL,'https://www.loc.gov/free-to-use/advertising-food/','public_domain','LOC free-to-use/reuse set','full_text_allowed','allowed'),
  ('image_collection','LOC Free to Use — Poster Parade','Library of Congress','Free to Use and Reuse: Poster Parade',NULL,'https://www.loc.gov/free-to-use/poster-parade/','public_domain','LOC free-to-use/reuse set','full_text_allowed','allowed'),
  ('image_collection','LOC Free to Use — WPA Posters','Library of Congress','Free to Use and Reuse: WPA Posters',NULL,'https://www.loc.gov/free-to-use/wpa-posters/','public_domain','LOC free-to-use/reuse set','full_text_allowed','allowed'),
  ('ad_archive','Emergence of Advertising in America 1850-1920','Duke University','Emergence of Advertising in America',NULL,'https://blogs.library.duke.edu/digital-collections/eaa/about','research_only','Duke research collection; do not mirror','metadata_and_link_only','restricted'),
  ('ad_archive','Ad*Access','Duke University','Ad*Access (1911-1955)',NULL,'https://blogs.library.duke.edu/digital-collections/adaccess/about/','research_only','Duke research collection; do not mirror','metadata_and_link_only','restricted'),
  ('poster_collection','LOC Advertising Poster Collection','Library of Congress','Advertising Poster Collection (1845-1947)',NULL,'https://www.loc.gov/pictures/item/2005682804/','rights_unknown','Collection-level rights unknown; clear each item before reuse','metadata_and_link_only','unknown')
) as v(source_type, source_name, author, title, year, url, rights, basis, access, commercial)
where not exists (
  select 1 from public.marketing_library_sources s
  where lower(s.title) = lower(v.title) and coalesce(s.publication_year, -1) = coalesce(v.year, -1)
);
