-- 20260908105000_marketing_library_source_identifier_unique.sql
-- Production compatibility prerequisite for client intelligence registration.
-- The registration migration uses ON CONFLICT (source_identifier) with this exact
-- partial predicate, so PostgreSQL must be able to infer a matching unique index.

create unique index if not exists uniq_marketing_library_sources_source_identifier
  on public.marketing_library_sources (source_identifier)
  where source_identifier is not null;
