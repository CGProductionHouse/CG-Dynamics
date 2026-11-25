-- PREPARED ONLY. Requires separate production approval; do not replay the
-- already-applied 20261111064719 brand migration or seed client facts.
-- Extend the existing staff-only brand authority, not a parallel client store.
alter table public.client_brand_profiles
  add column design_pack jsonb,
  add constraint client_brand_design_pack_scope check (
    design_pack is null or (
      jsonb_typeof(design_pack) = 'object'
      and (design_pack ->> 'schemaVersion') is not distinct from '1'
      and (design_pack ->> 'clientId') is not distinct from client_id::text
      and jsonb_typeof(design_pack -> 'scopes') is not distinct from 'array'
      and coalesce((design_pack ->> 'status') in ('draft', 'reviewed'), false)
    )
  );
comment on column public.client_brand_profiles.design_pack is
  'PICASSO v1 exact-client versioned pack metadata, including distinct brand scopes. OneDrive holds actual files and version history. Existing staff-read/manager-write RLS remains unchanged. Application validation and review evidence are required.';
