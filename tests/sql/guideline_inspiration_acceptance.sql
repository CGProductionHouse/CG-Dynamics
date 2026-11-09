insert into clients values('20000000-0000-4000-8000-000000000003','Example Inspiration Client',true);
-- Legacy snapshots lack the newly optional fields; null defaults must preserve
-- exact-match truth rather than falsely marking unchanged videos as modified.
select qa_assert((select bool_and((r->>'matches_current_video')::boolean) from jsonb_array_elements(get_guideline_client_reviews_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001')->'responses') r where r->>'position'='2'),'legacy unchanged videos still match after optional-field migration');
insert into content_runs values('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','Example reference shoot','2026-11-12');
insert into content_guidelines(id,client_id,content_run_id,title,month,status) values('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','Reference example','2026-11-01','draft');
insert into content_guide_ideas(id,client_id,content_guideline_id,position,title,script,status,inspiration_url,inspiration_note,internal_notes) values
('50000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',1,'Reference idea','KEEP THE COMPLETE SCRIPT','idea','https://vt.tiktok.com/ZSample/','Use the rhythm; tell our own story.','PRIVATE NEVER PROJECT'),
('50000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',2,'Original idea','ORIGINAL SCRIPT','idea',null,null,'PRIVATE NEVER PROJECT');
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','publish');
select public_slug as slug,share_token as token,published_at as version from content_guideline_public_shares where content_guideline_id='40000000-0000-4000-8000-000000000003' \gset
select set_config('qa.slug',:'slug',false),set_config('qa.token',:'token',false),set_config('qa.version',:'version',false);
set role anon;
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->0->>'inspiration_url'='https://vt.tiktok.com/ZSample/','public snapshot includes exact example link');
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->0->>'inspiration_note'='Use the rhythm; tell our own story.','public snapshot includes vision');
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->0->>'script'='KEEP THE COMPLETE SCRIPT','script preserved separately');
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->1->>'inspiration_url' is null,'original scripts need no reference');
select qa_assert(position('PRIVATE NEVER PROJECT' in read_public_content_guideline_share(:'slug',:'token')::text)=0,'no internal fields in shared helper');
select respond_public_guideline_video(:'slug',:'token',:'version',1,'approved','Local fixture reviewer','','60000000-0000-4000-8000-000000000010',null);
reset role;
select qa_assert((get_guideline_client_reviews_as_actor('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001')->'responses'->0->>'matches_current_video')::boolean,'reference and vision included in exact approval snapshot');
update content_guide_ideas set inspiration_note='Changed vision after review' where id='50000000-0000-4000-8000-000000000004';
select qa_assert(not (get_guideline_client_reviews_as_actor('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001')->'responses'->0->>'matches_current_video')::boolean,'changed vision cannot inherit approval');
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->0->>'inspiration_note'='Use the rhythm; tell our own story.','unpublished inspiration edit does not leak into public snapshot');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select set_config('qa.client','20000000-0000-4000-8000-000000000003',false);
select qa_assert((select videos->0->>'inspiration_url' from client_portal_published_content_guidelines('20000000-0000-4000-8000-000000000001','2026-11-01'))='https://vt.tiktok.com/ZSample/','signed-in projection uses own client, not caller override');
select qa_assert((select count(*) from client_portal_published_content_guidelines('20000000-0000-4000-8000-000000000001','2026-12-01'))=0,'month scope unchanged');
do $$begin begin perform guideline_video_client_snapshot(null::public.content_guide_ideas);raise exception 'PRIVATE HELPER EXPOSED';exception when insufficient_privilege then null;end;end$$;
reset role;
do $$declare u text;begin
  foreach u in array array['javascript:alert(1)','https://evil.example/video','https://www.youtube.com.evil.example/watch','https://user:pass@www.youtube.com/watch','https://www.youtube.com:8080/watch','https://www.youtube.com/redirect?url=evil','https://www.facebook.com/l.php?u=evil','https://www.youtube.com/','https://www.youtube.com/watch?spaces here',E'https://www.youtube.com\\@evil.example/watch'] loop
    if valid_guideline_inspiration_url(u) then raise exception 'INVALID URL ACCEPTED: %',u;end if;
    begin update content_guide_ideas set inspiration_url=u where id='50000000-0000-4000-8000-000000000004';raise exception 'INVALID URL SAVED';exception when check_violation then null;end;
  end loop;
  foreach u in array array['https://vt.tiktok.com/ZSample/','https://vm.tiktok.com/ZSample/','https://www.tiktok.com/@example/video/123','https://www.instagram.com/reel/Example/','https://www.facebook.com/share/r/Example/','https://fb.watch/Example/','https://www.youtube.com/watch?v=example','https://youtu.be/example','https://www.youtube.com/shorts/example'] loop
    if not valid_guideline_inspiration_url(u) then raise exception 'VALID URL REFUSED: %',u;end if;
  end loop;
  begin update content_guide_ideas set inspiration_note=repeat('x',1001) where id='50000000-0000-4000-8000-000000000004';raise exception 'OVERSIZED VISION SAVED';exception when check_violation then null;end;
end$$;
update content_guide_ideas set inspiration_url=null,inspiration_note=null where id='50000000-0000-4000-8000-000000000004';
select pg_sleep(0.01);
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','publish');
select qa_assert(read_public_content_guideline_share(:'slug',:'token')->'guide'->'videos'->0->>'inspiration_url' is null,'explicit clear and republish removes reference');
select qa_assert(read_public_guideline_video_reviews(:'slug',:'token')->'videos'->0->>'decision'='pending','inspiration revision requires fresh review');
select 'GUIDELINE INSPIRATION ACCEPTANCE PASSED';
