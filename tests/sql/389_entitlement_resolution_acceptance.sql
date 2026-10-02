-- Real new RPC over disposable canonical dependencies; no production reads/writes.
insert into public.tiktok_connections(client_id,tiktok_open_id,status) values('20000000-0000-0000-0000-000000000002','local-provider-id-never-exposed','connected');
insert into public.profiles(id,full_name,role,is_active) values('10000000-0000-0000-0000-000000000007','Local admin','admin',true);
create function public.queue_denied389() returns void language plpgsql as $$ begin
  begin perform public.get_admin_entitlement_resolution_queue(); exception when insufficient_privilege then return; end;
  raise exception 'Queue unexpectedly accepted actor';
end $$;
grant execute on function public.queue_denied389() to authenticated,anon;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select check389(jsonb_array_length(get_admin_entitlement_resolution_queue())=2,'active queue only');
select check389(jsonb_array_length(get_admin_entitlement_resolution_queue(null,1))=1,'bounded page');
select check389((get_admin_entitlement_resolution_queue('20000000-0000-0000-0000-000000000001',1)->0->>'client_id')='20000000-0000-0000-0000-000000000002','exact next cursor');
select check389(jsonb_array_length(get_admin_entitlement_resolution_queue()->0->'connections')=7,'seven allowlisted connection states');
select check389(jsonb_array_length(get_admin_entitlement_resolution_queue()->0->'entitlements')=2,'exact-client evidence only');
select check389((get_admin_entitlement_resolution_queue()->0->'connections'->0) ? 'connection','connection not entitlement');
select check389((select x->>'connection'='needs_connection' from jsonb_array_elements(get_admin_entitlement_resolution_queue()->0->'connections') x where x->>'service_key'='tiktok'),'other-client connection cannot leak into A');
select check389((select x->>'connection'='connected' from jsonb_array_elements(get_admin_entitlement_resolution_queue()->1->'connections') x where x->>'service_key'='tiktok'),'B exact configured connection');
select check389(get_admin_entitlement_resolution_queue()::text not like '%local-provider-id-never-exposed%','provider ID never returned');
select denied389('select get_admin_entitlement_resolution_queue(null,0)','invalid page size');
select denied389('select get_admin_entitlement_resolution_queue(null,101)','unbounded page denied');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000007';
select check389(jsonb_array_length(get_admin_entitlement_resolution_queue())=2,'active admin queue read');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select queue_denied389();
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
select queue_denied389();
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000006';
select queue_denied389();
set role anon;
select queue_denied389();
reset role;
insert into clients(id,name,active) select ('60000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Local paging fixture '||n,true from generate_series(1,1001) n;
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
do $$ declare page jsonb; cursor uuid; total int=0; begin
  loop
    page=public.get_admin_entitlement_resolution_queue(cursor,100);
    total=total+jsonb_array_length(page);
    exit when jsonb_array_length(page)<100;
    cursor=(page->99->>'client_id')::uuid;
  end loop;
  perform public.check389(total=1003,'RPC truly pages beyond 1000');
end $$;
reset role;
select check389((select count(*)=3 from client_service_entitlements),'queue never seeds or verifies');
select check389((select count(*)=1 from planner_tasks),'queue never creates requests');
select check389((select provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_admin_entitlement_resolution_queue(uuid,integer)'::regprocedure),'stable fixed search path');
