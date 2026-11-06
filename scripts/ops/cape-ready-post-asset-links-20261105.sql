-- REVIEW ONLY: exact Cape Lumber six-asset linkage. Not a migration.
-- Requires CA production-SQL approval before execution.
-- Files were individually reviewed/published using the existing Brand Hub UI.
-- No schedule/date/status/approval, permission, strategy or other-client change.
begin;
do $$
declare
  target_client constant uuid := '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa';
  expected_library constant uuid := 'e95fba7f-6812-40a8-ba22-6b3ab8e4484b';
  r record;
  asset public.client_portal_assets%rowtype;
  post public.monthly_deliverables%rowtype;
  matched integer := 0;
begin
  for r in select * from jsonb_to_recordset($map$[{"item_id":"A2AC9FE4B255F52F!s7feef91fe7174ab0b9549c26c9d17dec","deliverable_id":"a2e3616e-0114-430c-be97-45b48abf338e","scheduled_date":"2026-11-02"},{"item_id":"A2AC9FE4B255F52F!sa7cb3d1cf6d14ca6a6a695cd8d541cb3","deliverable_id":"33eef546-c869-440d-811b-59a51442a584","scheduled_date":"2026-11-04"},{"item_id":"A2AC9FE4B255F52F!sc39b532134b84f6ba27413d238b90582","deliverable_id":"ce31b89c-aa98-43eb-950e-843e0e99fa2c","scheduled_date":"2026-11-09"},{"item_id":"A2AC9FE4B255F52F!sf4437a490db9464b9778a87c2a6edbc4","deliverable_id":"45905c81-703e-420e-b89b-01333eb302d0","scheduled_date":"2026-11-11"},{"item_id":"A2AC9FE4B255F52F!s74f2508380b94e07b8f2bafd21fed42f","deliverable_id":"cc0d4c5f-9b67-402e-b00c-85bf3fea172f","scheduled_date":"2026-11-16"},{"item_id":"A2AC9FE4B255F52F!sec08506afa7f44c8951efef943932faf","deliverable_id":"a9c5e00f-b53a-4510-a319-aa5db0b3f5e9","scheduled_date":"2026-11-18"}]$map$::jsonb)
    as m(item_id text, deliverable_id uuid, scheduled_date date)
  loop
    select * into strict asset from public.client_portal_assets
      where client_id=target_client and library_id=expected_library
        and drive_id='A2AC9FE4B255F52F' and item_id=r.item_id for update;
    select * into strict post from public.monthly_deliverables
      where id=r.deliverable_id and client_id=target_client for update;
    if not asset.active or asset.library_year is distinct from 2026 or asset.library_month is distinct from 11
      or asset.file_name is distinct from replace(r.scheduled_date::text,'-','_') || '.jpeg'
      or asset.mime_type is distinct from 'image/jpeg' or coalesce(asset.size_bytes,0) <= 0
      or asset.published_at > now()
      or asset.deliverable_id is not null and asset.deliverable_id <> post.id
      or post.month is distinct from date '2026-11-01' or post.scheduled_date is distinct from r.scheduled_date
      or post.client_plan_shared_date is distinct from r.scheduled_date or post.archived_at is not null
    then raise exception 'Cape asset/post evidence changed; no links saved'; end if;
    if not exists (
      select 1 from public.client_portal_libraries l
      join public.client_portal_library_categories c on c.library_id=l.id and c.client_id=l.client_id
      where l.id=asset.library_id and l.client_id=target_client and l.enabled
        and l.drive_id=asset.drive_id and l.last_verified_at is not null and l.root_folder_name='A_ClientPortal_Cape_Lumber'
        and c.id=asset.category_id and c.category='graphic_design' and c.folder_name='Graphic Design'
        and c.drive_id=asset.drive_id and c.folder_item_id=asset.parent_folder_item_id
        and c.folder_item_id='A2AC9FE4B255F52F!s19117fe14d5b4f6a9f4993a145c19dcc'
        and c.last_verified_at is not null
    ) then raise exception 'Cape recipient boundary changed; no links saved'; end if;
    if asset.deliverable_id is null then
      update public.client_portal_assets set deliverable_id=post.id
      where id=asset.id and client_id=target_client and deliverable_id is null;
      if not found then raise exception 'Cape linkage conflict'; end if;
    end if;
    matched := matched+1;
  end loop;
  if matched<>6 then raise exception 'Expected exactly six Cape links'; end if;
end;
$$;
commit;
