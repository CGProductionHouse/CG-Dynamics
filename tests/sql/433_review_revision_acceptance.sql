grant select,insert,update,delete on public.skill_cards,public.skill_card_reviews,public.marketing_library_sources to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare c public.skill_cards; q record; h text; n integer; begin
 select * into c from public.skill_cards limit 1;
 if c.content_hash is not null or c.reviewed_content_hash is not null then raise exception 'Legacy rows bulk rewritten'; end if;
 if cardinality(public.skill_card_activation_blockers(c.id))=0 then raise exception 'Historical approval admitted'; end if;
 select * into q from public.skill_card_review_queue() where id=c.id;
 if q.content_hash !~ '^[a-f0-9]{64}$' or q.ready_to_activate then raise exception 'Snapshot revision/readiness incorrect'; end if;
 -- Stale review rejected atomically; neither edits nor receipts survive.
 select count(*) into n from public.skill_card_reviews;
 begin perform public.skill_card_record_review(c.id,'approved','Stale','{"summary":"wrong"}',repeat('a',64)); raise exception 'stale accepted';
 exception when serialization_failure then null; end;
 if (select count(*) from public.skill_card_reviews)<>n or (select summary from public.skill_cards where id=c.id)<>'Summary' then raise exception 'Stale partial write'; end if;
 c := public.skill_card_record_review(c.id,'approved','Human reviewed','{"summary":"Reviewed","how_to_apply":["One fact"]}',q.content_hash);
 if c.reviewed_content_hash is distinct from c.content_hash or c.status='active' then raise exception 'Review binding/activation wrong'; end if;
 if not exists(select 1 from public.skill_card_reviews where review_kind='content_review' and reviewed_by='Actual Admin' and reviewer_profile_id=auth.uid() and reviewed_content_hash=c.content_hash) then raise exception 'Actor/hash missing'; end if;
 c := public.skill_card_activate(c.id); h:=c.content_hash;
 -- Metadata does not destroy human approval; material wording does.
 update public.skill_cards set owner='Changed owner label' where id=c.id;
 if (select content_hash from public.skill_cards where id=c.id)<>h then raise exception 'Metadata changed material revision'; end if;
 update public.skill_cards set principle='Changed' where id=c.id;
 select * into c from public.skill_cards where id=c.id;
 if c.status<>'needs_review' or c.reviewed_content_hash is not null then raise exception 'Edit kept approval'; end if;
  -- Returning to identical historical wording still cannot restore a binding by direct UPDATE.
  update public.skill_cards set principle='Original' where id=c.id;
  select * into c from public.skill_cards where id=c.id;
  if c.content_hash<>h then raise exception 'Material fingerprint not deterministic'; end if;
  begin update public.skill_cards set reviewed_content_hash=h where id=c.id;
  raise exception 'Historical binding restored directly'; exception when check_violation then null; end;
 -- Activation audit approved rows cannot certify edits.
 if cardinality(public.skill_card_activation_blockers(c.id))=0 then raise exception 'Audit counted as content review'; end if;
 c:=public.skill_card_record_review(c.id,'approved','Review changed',null,c.content_hash);
 c:=public.skill_card_activate(c.id);
 perform public.skill_card_set_routing(c.id,array['content_planner'],'Routing');
 select * into c from public.skill_cards where id=c.id;
 if c.status<>'needs_review' or c.reviewed_content_hash is not null then raise exception 'Routing kept approval'; end if;
 c:=public.skill_card_record_review(c.id,'approved','Reviewed route',null,c.content_hash);
 c:=public.skill_card_activate(c.id);
 update public.marketing_library_sources set source_name='Changed source' where id=c.source_id;
 select * into c from public.skill_cards where id=c.id;
 if c.status<>'needs_review' or c.reviewed_content_hash is not null then raise exception 'Source edit kept approval'; end if;
  c:=public.skill_card_record_review(c.id,'approved','Reviewed source',null,c.content_hash);
  c:=public.skill_card_activate(c.id);
  update public.skill_cards set client_specific=true,active_client_id='20000000-0000-4000-8000-000000000001' where id=c.id;
  select * into c from public.skill_cards where id=c.id;
  if c.status<>'needs_review' or c.reviewed_content_hash is not null then raise exception 'Client scope change kept approval'; end if;
 c:=public.skill_card_record_review(c.id,'approved','Reviewed source',null,c.content_hash);
 c:=public.skill_card_record_review(c.id,'changes_requested','Not accepted',null,c.content_hash);
 if c.status<>'needs_review' or c.reviewed_content_hash is not null then raise exception 'Negative decision did not withdraw approval'; end if;
 begin update public.skill_cards set reviewed_content_hash=c.content_hash,status='active' where id=c.id;
 raise exception 'Old human approval resurrected'; exception when check_violation then null; end;
 begin insert into public.skill_card_reviews(skill_card_id,review_status,review_kind,reviewer_profile_id,reviewed_content_hash)
 values(c.id,'approved','content_review',auth.uid(),c.content_hash); raise exception 'Direct forged review admitted';
 exception when raise_exception then if sqlerrm='Direct forged review admitted' then raise; end if; end;
 if not exists(select 1 from public.skill_card_reviews where review_notes='Old approval' and review_kind='audit' and reviewed_content_hash is null) then raise exception 'Historical receipt lost'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$ begin
 begin perform public.skill_card_record_review('40000000-0000-4000-8000-000000000001','approved'); raise exception 'Staff approved';
 exception when raise_exception then if sqlerrm='Staff approved' then raise; end if; end;
 if exists(select 1 from public.skill_card_reviews) then raise exception 'Staff review leakage'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ begin if exists(select 1 from public.skill_cards) then raise exception 'Client card leakage'; end if;
 begin perform public.skill_card_review_cards(); raise exception 'Client admin snapshot';
 exception when raise_exception then if sqlerrm='Client admin snapshot' then raise; end if; end; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ begin
 begin perform public.skill_card_record_review('40000000-0000-4000-8000-000000000001','approved'); raise exception 'Inactive admin approved';
 exception when raise_exception then if sqlerrm='Inactive admin approved' then raise; end if; end; end $$;
reset role;
set role service_role;
do $$ begin
 begin perform public.skill_card_record_review('40000000-0000-4000-8000-000000000001','approved');
 raise exception 'Service role reviewed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'REVISION REVIEW ACCEPTANCE PASS';
