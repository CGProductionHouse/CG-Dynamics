create function public.qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end$$;
-- Preserve an independent client/video to prove capability isolation.
insert into content_guide_ideas(id,content_guideline_id,client_id,position,title,script,status) values
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',1,'Other private video','OTHER CLIENT PRIVATE SCRIPT','idea'),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2,'Second exact video','SECOND VERBATIM SCRIPT','idea');
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish');
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','publish');
select share_token as token,public_slug as slug,published_at as version from content_guideline_public_shares where client_id='20000000-0000-4000-8000-000000000001' \gset
set role anon;
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->0->>'decision'='pending','starts awaiting review');
select qa_assert(read_public_guideline_video_reviews('other-client-content-guideline',:'token') is null,'foreign client fails closed');
select qa_assert(read_public_guideline_video_reviews(:'slug',repeat('a',64)) is null,'wrong token fails closed');
select respond_public_guideline_video(:'slug',:'token',:'version',1,'approved','Client Reviewer','', '60000000-0000-4000-8000-000000000001',null);
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->0->>'decision'='approved','approval saved for first video');
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->1->>'decision'='pending','other video untouched');
select respond_public_guideline_video(:'slug',:'token',:'version',1,'approved','Client Reviewer','', '60000000-0000-4000-8000-000000000001',null);
reset role;
select qa_assert((select count(*) from content_guideline_client_responses)=1,'lost-response retry inserts once');
select qa_assert((select status from content_guide_ideas where position=1 and client_id='20000000-0000-4000-8000-000000000001')='idea','no editorial/production status mutation');
select qa_assert((select script from content_guide_ideas where id='50000000-0000-4000-8000-000000000001')='KEEP exact full script — Scene 1 and Scene 2.','script unchanged');
-- Errors execute as anonymous with parameterized fixture variables via set_config.
select set_config('qa.slug',:'slug',false),set_config('qa.token',:'token',false),set_config('qa.version',:'version',false);
set role anon;
do $$declare slug text:=current_setting('qa.slug'); token text:=current_setting('qa.token'); ver timestamptz:=current_setting('qa.version');begin
  begin perform respond_public_guideline_video(slug,token,ver,1,'declined','Reviewer','Explain','60000000-0000-4000-8000-000000000002',null);raise exception 'STALE ACCEPTED'; exception when raise_exception then if sqlerrm<>'Another response was added. Refresh the reviews before responding.' then raise;end if;end;
  begin perform respond_public_guideline_video(slug,token,ver,1,'approved','Changed payload','','60000000-0000-4000-8000-000000000001',null);raise exception 'RETRY CONFLICT ACCEPTED'; exception when raise_exception then if sqlerrm<>'This response could not be verified. Please refresh.' then raise;end if;end;
  begin perform respond_public_guideline_video(slug,token,ver,2,'changes_requested','Reviewer',' ','60000000-0000-4000-8000-000000000003',null);raise exception 'EMPTY COMMENT ACCEPTED'; exception when raise_exception then if sqlerrm not like 'Please add your name%' then raise;end if;end;
  begin perform respond_public_guideline_video(slug,token,ver,2,'declined','','Comment','60000000-0000-4000-8000-000000000003',null);raise exception 'EMPTY NAME ACCEPTED'; exception when raise_exception then if sqlerrm not like 'Please add your name%' then raise;end if;end;
  begin perform respond_public_guideline_video(slug,token,ver,999,'approved','Reviewer','','60000000-0000-4000-8000-000000000003',null);raise exception 'FOREIGN VIDEO ACCEPTED'; exception when raise_exception then if sqlerrm<>'This video is unavailable.' then raise;end if;end;
  begin perform respond_public_guideline_video('other-client-content-guideline',token,ver,1,'approved','Reviewer','','60000000-0000-4000-8000-000000000003',null);raise exception 'FOREIGN CLIENT ACCEPTED'; exception when raise_exception then if sqlerrm<>'This review link is unavailable.' then raise;end if;end;
  begin perform 1 from content_guideline_client_responses;raise exception 'TABLE LEAK';exception when insufficient_privilege then null;end;
  begin perform project_guideline_client_responses('40000000-0000-4000-8000-000000000001',ver);raise exception 'PROJECTION LEAK';exception when insufficient_privilege then null;end;
  begin perform get_guideline_client_reviews('30000000-0000-4000-8000-000000000001');raise exception 'STAFF LEAK';exception when insufficient_privilege then null;end;
end$$;
select respond_public_guideline_video(:'slug',:'token',:'version',1,'comment','Client Reviewer','Keep this exact wording <script>alert(1)</script>','60000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000001');
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->0->>'decision'='approved','comment preserves decision');
select respond_public_guideline_video(:'slug',:'token',:'version',2,'changes_requested','Client Reviewer','Please change the opening.','60000000-0000-4000-8000-000000000005',null);
select respond_public_guideline_video(:'slug',:'token',:'version',2,'declined','Client Reviewer','We prefer another idea.','60000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000005');
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->1->>'decision'='declined','decline tracked separately');
select qa_assert(position('OTHER CLIENT' in read_public_guideline_video_reviews(:'slug',:'token')::text)=0,'no foreign script/response exposure');
reset role;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$begin begin perform get_guideline_client_reviews('30000000-0000-4000-8000-000000000001');raise exception 'CLIENT STAFF ACCESS';exception when raise_exception then if sqlerrm<>'Active staff access required' then raise;end if;end;end$$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
do $$begin begin perform get_guideline_client_reviews('30000000-0000-4000-8000-000000000001');raise exception 'INACTIVE STAFF ACCESS';exception when raise_exception then if sqlerrm<>'Active staff access required' then raise;end if;end;end$$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select qa_assert(jsonb_array_length(get_guideline_client_reviews('30000000-0000-4000-8000-000000000001')->'responses')=4,'active staff sees all four exact-run responses');
select qa_assert(jsonb_array_length(get_guideline_client_reviews('30000000-0000-4000-8000-000000000002')->'responses')=0,'staff history scoped to exact run');
reset role;
update content_guide_ideas set script='NEW DRAFT NOT YET PUBLISHED' where id='50000000-0000-4000-8000-000000000001';
select qa_assert((get_guideline_client_reviews_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001')->'responses'->2->>'matches_current_video')::boolean=false,'edited source cannot inherit approval');
select pg_sleep(0.01);
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish');
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->0->>'decision'='pending','republished version needs new review');
select qa_assert(jsonb_array_length(get_guideline_client_reviews_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001')->'responses')=4,'republish preserves audit history');
set role anon;
do $$begin begin perform respond_public_guideline_video(current_setting('qa.slug'),current_setting('qa.token'),current_setting('qa.version')::timestamptz,1,'approved','Reviewer','','60000000-0000-4000-8000-000000000007',null);raise exception 'OLD VERSION ACCEPTED';exception when raise_exception then if sqlerrm<>'This guideline has been updated. Refresh before responding.' then raise;end if;end;end$$;
reset role;
-- Exercise rate limiting without sending artificial client reviews in production.
insert into content_guideline_client_responses(id,content_guideline_id,client_id,published_at,video_position,video_snapshot,action,reviewer_name,message)
select gen_random_uuid(),'40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()-interval '1 day',1,'{}','approved','Local fixture','' from generate_series(1,8);
select set_config('qa.version',(select published_at::text from content_guideline_public_shares where public_slug=:'slug'),false);
set role anon;
do $$begin begin perform respond_public_guideline_video(current_setting('qa.slug'),current_setting('qa.token'),current_setting('qa.version')::timestamptz,1,'approved','Reviewer','','60000000-0000-4000-8000-000000000007',null);raise exception 'RATE LIMIT MISSING';exception when raise_exception then if sqlerrm<>'Several responses were just received. Please try again in a few minutes.' then raise;end if;end;end$$;
reset role;
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','revoke');
set role anon;
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token') is null,'revoked link has no review history');
do $$begin begin perform respond_public_guideline_video(current_setting('qa.slug'),current_setting('qa.token'),current_setting('qa.version')::timestamptz,1,'approved','Reviewer','','60000000-0000-4000-8000-000000000007',null);raise exception 'REVOKED RESPONSE ACCEPTED';exception when raise_exception then if sqlerrm<>'This review link is unavailable.' then raise;end if;end;end$$;
reset role;
select qa_assert((select count(*) from content_guideline_client_responses where client_id='20000000-0000-4000-8000-000000000002')=0,'foreign client untouched');
select qa_assert((select relrowsecurity from pg_class where oid='public.content_guideline_client_responses'::regclass),'RLS enabled');
select 'GUIDELINE VIDEO REVIEW ACCEPTANCE PASSED';
