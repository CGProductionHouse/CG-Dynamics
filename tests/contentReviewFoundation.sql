-- Local-only fixtures; the enclosing transaction always rolls back.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','manager@example.test'),
 ('00000000-0000-4000-8000-000000000002','client-a@example.test'),
 ('00000000-0000-4000-8000-000000000003','client-b@example.test'),
 ('00000000-0000-4000-8000-000000000004','staff@example.test');
insert into public.clients(id,name) values
 ('00000000-0000-4000-8000-000000000011','Local review fixture A'),
 ('00000000-0000-4000-8000-000000000012','Local review fixture B');
insert into public.profiles(id,full_name,role,client_id) values
 ('00000000-0000-4000-8000-000000000001','Review manager','manager',null),
 ('00000000-0000-4000-8000-000000000002','Client A','client','00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000003','Client B','client','00000000-0000-4000-8000-000000000012'),
 ('00000000-0000-4000-8000-000000000004','Assigned staff','staff',null)
on conflict(id) do update set role=excluded.role,client_id=excluded.client_id,full_name=excluded.full_name;
insert into public.monthly_deliverables(id,client_id,month,code,instance_number,title,deliverable_type,scheduled_date,assigned_to_user_id)
 values('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','2027-01-01','DP',1,'Local review fixture','dp','2027-01-10','00000000-0000-4000-8000-000000000004');
insert into storage.objects(bucket_id,name,metadata) values('content-review-snapshots','00000000-0000-4000-8000-000000000021/fixture.png','{"mimetype":"image/png"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.save_content_creative_source('00000000-0000-4000-8000-000000000021','LOCALDESIGN','PAGE1',true);
select public.submit_content_review('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021/fixture.png','Local test caption',array['facebook'],'2027-01-10T09:00:00+02',true) as version_id \gset
select set_config('test.review_version',:'version_id',true);
select public.decide_content_review(:'version_id',true,null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin
 perform public.decide_content_review(current_setting('test.review_version')::uuid,true,null);
 raise exception 'Cross-client decision succeeded';
 exception when raise_exception then if sqlerrm <> 'This review is not awaiting your approval' then raise; end if; end;
 if public.client_content_review_queue() <> '[]'::jsonb then raise exception 'Cross-client queue leak'; end if;
 if public.can_read_content_snapshot('00000000-0000-4000-8000-000000000021/fixture.png') then raise exception 'Cross-client asset leak'; end if;
 if (select count(*) from public.content_review_versions) <> 0 then raise exception 'Client base-table leak'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if jsonb_array_length(public.client_content_review_queue()) <> 1 then raise exception 'Client approval missing'; end if;
 if public.client_content_review_queue()::text like '%submitted_by%' then raise exception 'Internal field leaked'; end if;
end $$;
select public.decide_content_review(:'version_id',true,null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin
 perform public.submit_content_review('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021/fixture.png','test',array['facebook'],'2027-01-10T09:00:00+02',false);
 raise exception 'Staff skipped client approval';
 exception when raise_exception then if sqlerrm <> 'A manager must choose internal approval only' then raise; end if; end;
 if public.can_upload_content_snapshot('invalid/path.png') then raise exception 'Invalid upload path accepted'; end if;
end $$;
do $$ declare affected integer; begin
 update storage.objects set metadata='{}' where bucket_id='content-review-snapshots';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Reviewed object can be overwritten'; end if;
 begin
 delete from storage.objects where bucket_id='content-review-snapshots';
 get diagnostics affected=row_count;
 if affected <> 0 then raise exception 'Reviewed object can be deleted'; end if;
 exception when insufficient_privilege then if sqlerrm <> 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select state from public.content_review_versions limit 1) <> 'approved' then raise exception 'Final approval missing'; end if;
 begin
 update public.content_review_versions set caption='tampered';
 raise exception 'Immutable snapshot was changed';
 exception when raise_exception then if sqlerrm <> 'Submit a new review version to change approved content' then raise; end if; end;
end $$;
update public.monthly_deliverables set scheduled_date='2027-01-11' where id='00000000-0000-4000-8000-000000000021';
do $$ begin
 if (select state from public.content_review_versions limit 1) <> 'superseded' then raise exception 'Stale approval survived schedule change'; end if;
end $$;
select 'PASS: manager/client flow, exact-client isolation, client projection, immutable content, stale invalidation, staff approval guard' as verification;
