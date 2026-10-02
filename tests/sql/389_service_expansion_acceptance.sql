-- Disposable fixture identities, never production clients.
insert into clients values('20000000-0000-0000-0000-000000000001','Client A',true),('20000000-0000-0000-0000-000000000002','Client B',true),('20000000-0000-0000-0000-000000000003','Inactive',false);
insert into profiles values
('10000000-0000-0000-0000-000000000001','Client A actor','client','20000000-0000-0000-0000-000000000001',true),
('10000000-0000-0000-0000-000000000002','Client B actor','client','20000000-0000-0000-0000-000000000002',true),
('10000000-0000-0000-0000-000000000003','Manager','manager',null,true),
('10000000-0000-0000-0000-000000000004','Staff','staff',null,true),
('10000000-0000-0000-0000-000000000005','Inactive actor','client','20000000-0000-0000-0000-000000000003',true),
('10000000-0000-0000-0000-000000000006','Disabled manager','manager',null,false);
insert into planner_boards(id,name,slug) values('40000000-0000-0000-0000-000000000001','Operations','operations-todo');
insert into planner_buckets(id,board_id,name) values('40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','CLIENT REQUESTS');
create function public.check389(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function public.denied389(query text,label text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then return; end; raise exception 'Unexpected acceptance: %',label;
end $$;
grant execute on function public.check389(boolean,text),public.denied389(text,text) to authenticated,anon;

set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','linkedin','not_included','Signed scope','["approved agreement A"]',0);
select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','instagram','included','Signed scope','["approved agreement A"]',0);
select verify_client_service_entitlement('20000000-0000-0000-0000-000000000002','linkedin','included','Signed scope','["approved agreement B"]',0);
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','google_ads','not_included','Guess','[]',0)$q$,'provenance');
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','linkedin','included','stale','["source"]',0)$q$,'stale revision');
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','made_up','included','x','["source"]',0)$q$,'allowlist');
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000003','linkedin','included','x','["source"]',0)$q$,'inactive client');
select check389((select count(*)=3 from client_service_entitlements),'manager evidence read');
select denied389('select get_my_client_service_entitlements()','staff cannot become client');

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select check389((select count(*)=0 from client_service_entitlements),'client cannot read internal evidence');
select check389(jsonb_array_length(get_my_client_service_entitlements())=7,'seven service projection');
select check389((select value->>'state'='unknown' from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='google_ads'),'missing remains unknown');
select check389((select value->>'state'='not_included' from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='linkedin'),'exact A entitlement');
select check389((select value->>'connection'='needs_connection' from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='instagram'),'included disconnected');
select denied389('select * from planner_tasks','no client task reads');
select denied389($q$update client_service_entitlements set state='not_included'$q$,'no direct client writes');
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000002','linkedin','not_included','attack','["fake"]',1)$q$,'no client verification');
select denied389($q$select submit_client_service_expansion_request('instagram','','30000000-0000-0000-0000-000000000001','performance')$q$,'included never upsell');
select denied389($q$select submit_client_service_expansion_request('google_ads','','30000000-0000-0000-0000-000000000001','performance')$q$,'unknown never upsell');
select denied389($q$select submit_client_service_expansion_request('made_up','','30000000-0000-0000-0000-000000000001','performance')$q$,'invalid service');
select denied389($q$select submit_client_service_expansion_request('linkedin',repeat('x',2001),'30000000-0000-0000-0000-000000000001','performance')$q$,'bounded message');
select check389((submit_client_service_expansion_request('linkedin','Please discuss','30000000-0000-0000-0000-000000000001','performance')->>'replayed')='false','first request');
select check389((submit_client_service_expansion_request('linkedin','Please discuss','30000000-0000-0000-0000-000000000001','performance')->>'replayed')='true','same receipt');
select denied389($q$select submit_client_service_expansion_request('linkedin','changed','30000000-0000-0000-0000-000000000001','performance')$q$,'changed payload conflicts');
select record_client_service_surface('overview','30000000-0000-0000-0000-000000000002');
select record_client_service_surface('overview','30000000-0000-0000-0000-000000000002');
select check389((select value->>'requested_at' is not null from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='linkedin'),'durable client receipt');

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select check389((select value->>'state'='included' and value->>'requested_at' is null from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='linkedin'),'B never sees A request');
select denied389($q$select submit_client_service_expansion_request('linkedin','','30000000-0000-0000-0000-000000000001','performance')$q$,'B cannot request A service');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000005';
select denied389('select get_my_client_service_entitlements()','inactive projection');
select denied389($q$select submit_client_service_expansion_request('linkedin','','30000000-0000-0000-0000-000000000001','performance')$q$,'inactive request');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000006';
select denied389($q$select verify_client_service_entitlement('20000000-0000-0000-0000-000000000001','linkedin','included','x','["source"]',1)$q$,'disabled manager');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
select check389((select count(*)=0 from client_service_entitlements),'staff cannot read verification evidence');
set role anon;
select denied389('select get_my_client_service_entitlements()','anonymous denied');
reset role;
select check389((select count(*)=1 from planner_tasks),'single canonical task');
select check389((select client_id='20000000-0000-0000-0000-000000000001' and priority='client_request' and source='client_portal_service_expansion' and assigned_to_name is null and bucket_id='40000000-0000-0000-0000-000000000002' from planner_tasks),'exact Operations placement');
select check389((select count(*)=1 from planner_activity_log where action='client_service_expansion_requested'),'no duplicate canonical audit');
select check389((select count(*)=1 from planner_activity_log where action='client_service_surface_shown'),'dedup surface measurement');

-- Inject audit crash AFTER the real Planner insert. Both must roll back.
create function public.fail389() returns trigger language plpgsql as $$ begin if new.action='client_service_expansion_requested' then raise exception 'fixture audit crash'; end if; return new; end $$;
create trigger fail389 before insert on planner_activity_log for each row execute function public.fail389();
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select denied389($q$select submit_client_service_expansion_request('linkedin','crash','30000000-0000-0000-0000-000000000003','performance')$q$,'atomic audit rollback');
reset role; drop trigger fail389 on planner_activity_log;
select check389((select count(*)=1 from planner_tasks),'no partial acknowledged task');
update planner_buckets set archived_at=now();
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select denied389($q$select submit_client_service_expansion_request('linkedin','missing bucket','30000000-0000-0000-0000-000000000004','performance')$q$,'no bucket fallback');
reset role; update planner_buckets set archived_at=null;
select check389((select count(*)=1 from planner_tasks),'no fallback partial write');

-- Real read adapters must not borrow another client's configured source.
insert into meta_connections(id,status) values('50000000-0000-0000-0000-000000000001','connected');
insert into meta_client_assets(id,client_id,connection_id,instagram_account_id,ad_account_id)
values('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','fixture-ig-b','fixture-ad-b');
insert into tiktok_connections(client_id,status,tiktok_open_id) values('20000000-0000-0000-0000-000000000002','connected','fixture-tt-b');
insert into google_ads_accounts(id,customer_id,account_name,currency_code,time_zone,account_mode) values('50000000-0000-0000-0000-000000000003','123','Fixture','ZAR','Africa/Johannesburg','shared');
insert into google_ads_campaign_links(google_ads_account_id,customer_id,campaign_id,campaign_name,client_id) values('50000000-0000-0000-0000-000000000003','123','1','Fixture campaign','20000000-0000-0000-0000-000000000002');
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select check389((select bool_and(value->>'connection'='needs_connection') from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key' in ('instagram','tiktok','google_ads','meta_ads')),'no cross-client connection borrowing');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select check389((select bool_and(value->>'connection'='connected') from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key' in ('instagram','tiktok','google_ads','meta_ads')),'exact configured B sources');
select denied389($q$select get_client_service_expansion_review('20000000-0000-0000-0000-000000000001')$q$,'client cannot read admin analytics');
reset role;
-- A standalone connection cannot bind a B asset to A, even if a bad fixture
-- exists; pending review is also never promoted into connected.
insert into meta_instagram_connections(client_id,app_scoped_user_id,instagram_account_id,instagram_username,account_type,status,confirmed_asset_id)
values('20000000-0000-0000-0000-000000000001','fixture','fixture-ig-b','fixture','business','connected','50000000-0000-0000-0000-000000000002');
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select check389((select value->>'connection'='needs_connection' from jsonb_array_elements(get_my_client_service_entitlements()) where value->>'service_key'='instagram'),'standalone exact asset client guard');
select record_client_service_surface('performance','30000000-0000-0000-0000-000000000005');
reset role;
select check389((select count(*)=7 from planner_activity_log where action='client_service_surface_shown' and metadata->>'view_key'='30000000-0000-0000-0000-000000000005'),'seven measured states including unknown');
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select check389((select value->>'requests'='1' and value->>'surface_views'='2' from jsonb_array_elements(get_client_service_expansion_review('20000000-0000-0000-0000-000000000001')) where value->>'service_key'='linkedin'),'manager exact request/view measurements');
select check389((select value->>'requests'='0' from jsonb_array_elements(get_client_service_expansion_review('20000000-0000-0000-0000-000000000002')) where value->>'service_key'='linkedin'),'measurement exact-client isolation');
reset role;
