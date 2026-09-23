-- Issue #396: Remove Photography from client portal library categories.
--
-- Photography is explicitly excluded from the client portal. The Physical OneDrive
-- rollout confirmed 31/31 client portal roots with only Brand Identity, Graphic Design,
-- and Video. This migration tightens the DB constraints to match.

begin;

-- 1. Drop the existing asset boundary trigger (depends on the category check)
drop trigger if exists enforce_client_portal_asset_boundaries
  on public.client_portal_assets;

-- 2. Tighten the category check constraint on client_portal_library_categories
--    Remove photography from the allowed set.
alter table public.client_portal_library_categories
  drop constraint if exists client_portal_library_categories_category_check;

alter table public.client_portal_library_categories
  add constraint client_portal_library_categories_category_check
  check (category in ('brand_identity', 'graphic_design', 'video'));

-- 3. Tighten the folder_name check constraint
--    Remove the photography branch.
alter table public.client_portal_library_categories
  drop constraint if exists client_portal_library_categories_folder_name_check;

alter table public.client_portal_library_categories
  add constraint client_portal_library_categories_folder_name_check
  check (
    (category = 'brand_identity' and folder_name = 'Brand Identity')
    or (category = 'graphic_design' and folder_name = 'Graphic Design')
    or (category = 'video' and folder_name = 'Video')
  );

-- 4. Recreate the asset boundary trigger with the updated category set
create trigger enforce_client_portal_asset_boundaries
  before insert or update of library_id, category_id, client_id, drive_id, parent_folder_item_id, library_year, library_month, deliverable_id
  on public.client_portal_assets
  for each row execute function public.enforce_client_portal_asset_boundaries();

-- 5. Update the table comment
comment on table public.client_portal_library_categories is
  'Exact durable mappings for the locked client-safe Brand Identity, Graphic Design and Video folders. Photography is excluded from the client portal.';

commit;
