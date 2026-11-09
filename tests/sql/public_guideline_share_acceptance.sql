-- Execute after fixture + actual migration, inside a disposable database.
create function public.qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
select qa_assert((select state from jsonb_to_record(manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','get')) as x(state text))='not_shared','draft has no public link');
set role service_role;
select public.manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish') as first_share \gset
reset role;
select share_token as original_token,public_slug as original_slug from content_guideline_public_shares \gset
select qa_assert((:'first_share'::jsonb)->>'state'='published_for_review','staff publishes without administrator gate');
select qa_assert((:'first_share'::jsonb)->>'public_slug'='germoparts-content-guideline','client name in link');
select qa_assert((select status from content_guidelines where id='40000000-0000-4000-8000-000000000001')='published','canonical portal publication matches');
select qa_assert((select status from content_guide_ideas limit 1)='idea','publication does not approve content');
set role anon;
select public.qa_assert(public.read_public_content_guideline_share(:'original_slug',:'original_token')->'guide'->'videos'->0->>'script'='KEEP exact full script — Scene 1 and Scene 2.','anonymous exact script read');
select public.qa_assert(public.read_public_content_guideline_share('other-client-content-guideline',:'original_token') is null,'client slug isolation');
select public.qa_assert(public.read_public_content_guideline_share(:'original_slug',repeat('b',64)) is null,'wrong token denied');
select public.qa_assert(public.read_public_content_guideline_share(:'original_slug','invalid') is null,'malformed token denied');
select public.qa_assert(position('INTERNAL PRIVATE' in public.read_public_content_guideline_share(:'original_slug',:'original_token')::text)=0,'staff notes excluded');
select public.qa_assert(position('PRIVATE EDITOR' in public.read_public_content_guideline_share(:'original_slug',:'original_token')::text)=0,'editor excluded');
do $$begin begin perform 1 from public.content_guideline_public_shares; raise exception 'anonymous table leak'; exception when insufficient_privilege then null;end;
begin perform public.manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish');raise exception 'anonymous publish allowed';exception when insufficient_privilege then null;end;end$$;
reset role;
update content_guide_ideas set script='A new draft — not yet published.';
select qa_assert(read_public_content_guideline_share(:'original_slug',:'original_token')->'guide'->'videos'->0->>'script'='KEEP exact full script — Scene 1 and Scene 2.','draft edit cannot leak into published snapshot');
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish') as updated_share \gset
select qa_assert((:'updated_share'::jsonb)->>'share_token'=:'original_token','normal republish preserves link');
select qa_assert(read_public_content_guideline_share(:'original_slug',:'original_token')->'guide'->'videos'->0->>'script'='A new draft — not yet published.','explicit republish updates snapshot');
update content_guide_ideas set script='Script pending.';
do $$begin begin perform manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish');raise exception 'placeholder published'; exception when raise_exception then if sqlerrm='placeholder published' then raise;end if;end;end$$;
select qa_assert(read_public_content_guideline_share(:'original_slug',:'original_token')->'guide'->'videos'->0->>'script'='A new draft — not yet published.','failed publish preserves last snapshot');
update content_guide_ideas set script='KEEP exact full script — Scene 1 and Scene 2.';
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','revoke');
select qa_assert(read_public_content_guideline_share(:'original_slug',:'original_token') is null,'revocation immediate');
select manage_content_guideline_share_as_actor('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','publish') as restored_share \gset
select qa_assert((:'restored_share'::jsonb)->>'share_token'<>:'original_token','republish after revocation rotates key');
select qa_assert(read_public_content_guideline_share(:'original_slug',:'original_token') is null,'old revoked link stays invalid');
update content_guidelines set status='ready',client_published_at=null where id='40000000-0000-4000-8000-000000000001';
select qa_assert(read_public_content_guideline_share(:'original_slug',(:'restored_share'::jsonb)->>'share_token') is null,'normal unpublish also denies public access');
set role authenticated;
do $$begin begin perform manage_content_guideline_share('30000000-0000-4000-8000-000000000001','publish');raise exception 'no session publication';exception when raise_exception then if sqlerrm='no session publication' then raise;end if;end;end$$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$begin begin perform manage_content_guideline_share('30000000-0000-4000-8000-000000000001','publish');raise exception 'client role publication';exception when raise_exception then if sqlerrm='client role publication' then raise;end if;end;end$$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
do $$begin begin perform manage_content_guideline_share('30000000-0000-4000-8000-000000000001','publish');raise exception 'inactive publication';exception when raise_exception then if sqlerrm='inactive publication' then raise;end if;end;end$$;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.qa_assert(public.manage_content_guideline_share('30000000-0000-4000-8000-000000000001','publish')->>'state'='published_for_review','active staff UI publication');
reset role;
update content_guidelines set client_id='20000000-0000-4000-8000-000000000002' where id='40000000-0000-4000-8000-000000000001';
select qa_assert(read_public_content_guideline_share(:'original_slug',(:'restored_share'::jsonb)->>'share_token') is null,'corrupt ownership fails closed');
select 'PUBLIC GUIDELINE SHARE ACCEPTANCE PASSED';
