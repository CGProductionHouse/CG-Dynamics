-- All rows/identities are synthetic, local and ephemeral.
insert into public.clients values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.profiles values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','client',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'manager',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','client',false),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',null,'unsupported',true);
insert into public.monthly_deliverables values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','2026-10-01','2026-10-12','Same title','dp',null,now(),null,null),
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','2026-10-01',null,'Same title','dp',null,null,null,null),
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','2026-10-01','2026-10-12','Same title','dp',null,now(),null,null);
insert into public.client_portal_libraries(id,client_id,drive_id,root_folder_item_id,root_folder_name,enabled,mapped_by,last_verified_at) values
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','private-drive','private-root','A_ClientPortal_Synthetic',true,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());
insert into public.client_portal_library_categories(id,library_id,client_id,category,drive_id,folder_item_id,folder_name,mapped_by,last_verified_at) values
 ('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','graphic_design','private-drive','private-folder','Graphic Design','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());
insert into public.client_portal_assets(id,library_id,category_id,client_id,drive_id,parent_folder_item_id,item_id,display_name,file_name,mime_type,size_bytes,library_year,library_month,deliverable_id,published_by,published_at) values
 ('88888888-8888-4888-8888-888888888888','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','private-drive','private-folder','private-item','Final poster','private-file.pdf','application/pdf',null,2026,10,'33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());

create function public.assert_assets(expected_count integer) returns void language plpgsql as $$
declare result jsonb;
begin
 result := public.client_portal_post_assets('11111111-1111-4111-8111-111111111111','2026-10-01','post-'||substr(md5('33333333-3333-4333-8333-333333333333'),1,16));
 if jsonb_array_length(result) <> expected_count then raise exception 'Wrong asset count: %',result; end if;
 if result::text like '%private-%' then raise exception 'Private field leak'; end if;
 if expected_count=1 and result->0->>'id' <> '88888888-8888-4888-8888-888888888888' then raise exception 'Wrong exact asset'; end if;
end; $$;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select public.assert_assets(1);
do $$ begin
 if public.client_portal_post_assets('11111111-1111-4111-8111-111111111111','2026-10-01','post-'||substr(md5('44444444-4444-4444-8444-444444444444'),1,16)) <> '[]'::jsonb then raise exception 'Draft title match'; end if;
 if public.client_portal_post_assets('11111111-1111-4111-8111-111111111111','2026-09-01','post-'||substr(md5('33333333-3333-4333-8333-333333333333'),1,16)) <> '[]'::jsonb then raise exception 'Wrong month'; end if;
 if public.client_portal_post_assets('11111111-1111-4111-8111-111111111111','2026-10-01',null) <> '[]'::jsonb then raise exception 'Null key'; end if;
 begin perform public.client_portal_post_assets('22222222-2222-4222-8222-222222222222','2026-10-01',null); raise exception 'Cross-client accepted'; exception when insufficient_privilege then null; end;
 begin perform * from public.client_portal_assets; raise exception 'Base-table access'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
update public.client_portal_assets set active=false;
set role authenticated; select public.assert_assets(0); reset role;
update public.client_portal_assets set active=true,published_at=now()+interval '1 day';
set role authenticated; select public.assert_assets(0); reset role;
update public.client_portal_assets set published_at=now();
update public.client_portal_libraries set enabled=false;
set role authenticated; select public.assert_assets(0); reset role;
update public.client_portal_libraries set enabled=true;
update public.client_portal_library_categories set last_verified_at=null;
set role authenticated; select public.assert_assets(0); reset role;
update public.client_portal_library_categories set last_verified_at=now();
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select public.assert_assets(1);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $$ begin begin perform public.assert_assets(1); raise exception 'Inactive accepted'; exception when insufficient_privilege then null; end; end; $$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
do $$ begin begin perform public.assert_assets(1); raise exception 'Unsupported role accepted'; exception when insufficient_privilege then null; end; end; $$;
reset role; set role anon;
do $$ begin begin perform public.client_portal_post_assets(null,null,null); raise exception 'Anonymous accepted'; exception when insufficient_privilege then null; end; end; $$;
reset role;
select 'POST ASSET ACCEPTANCE PASS';
