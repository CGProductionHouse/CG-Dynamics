-- Deterministic public contact/footer backfill for Piek Group as ONE canonical client
-- with exact entity scope separation (group / engen / sasol / get-together). #248/#294.
-- Source: repo intelligence PIEK-GROUP-CLIENT-OPERATIONAL-INTELLIGENCE-2026-09.md.
-- No private-only values embedded. Production application remains approval-gated.
--
-- Genuine unresolved conflict preserved for CA (not guessed): the group caption email.
-- `info@piekgroup.com` is the repeatedly client-confirmed CG caption convention but is
-- marked possible_change; the official website lists `admin@piekgroup.co.za`. Both are
-- stored possible_change so the runtime holds the email footer as unresolved rather than
-- guessing which is current. Website must never be changed to piekgroup.com.

begin;

do $$
declare
  v_piek_id uuid;
  v_count integer;
begin
  select count(*), (array_agg(id))[1] into v_count, v_piek_id from public.clients where name = 'Piek Group';
  if v_count <> 1 then raise exception 'Expected exactly one Piek Group client, found %', v_count; end if;

  -- ── Group-scope (umbrella) standing contact block ──────────────────────────
  insert into public.client_contacts
    (client_id,scope_key,contact_type,display_label,value,approved_for_caption,blocks_caption,visibility,
     allowed_purposes,provenance_summary,source_reference,observed_at,last_verified_at,
     freshness_state,lifecycle_state,platforms,content_modes,footer_order)
  values
    (v_piek_id,null,'phone','Group publishing phone','+27 51 444 3178',true,false,'public_marketing',
     array['caption_footer'],'Client-confirmed CG caption convention captured repeatedly in Project/PDFs',
     'repo:PIEK-GROUP-CLIENT-OPERATIONAL-INTELLIGENCE-2026-09.md#standing-publishing-contact-block',
     '2026-09-09','2026-09-09','current_verified','active','{}',array['caption'],20),
    (v_piek_id,null,'website','Group website','www.piekgroup.co.za',true,false,'public_marketing',
     array['caption_footer'],'Official Piek fuel/retail website; never change to piekgroup.com',
     'repo:PIEK-GROUP-CLIENT-OPERATIONAL-INTELLIGENCE-2026-09.md#standing-publishing-contact-block',
     '2026-09-09','2026-09-09','current_verified','active','{}',array['caption'],30),
    -- Conflicting caption email candidates — both held possible_change (fail closed on email).
    (v_piek_id,null,'email','Group caption email (client-confirmed convention)','info@piekgroup.com',true,false,'public_marketing',
     array['caption_footer'],'Repeatedly client-confirmed CG convention; public verification pending vs website email',
     'repo:PIEK-GROUP-CLIENT-OPERATIONAL-INTELLIGENCE-2026-09.md#public-verification-conflict',
     '2026-09-09',null,'possible_change','active','{}',array['caption'],10),
    (v_piek_id,null,'email','Group website email','admin@piekgroup.co.za',false,false,'public_marketing',
     array['caption_footer'],'Listed on official Piek website; conflicts with client-confirmed info@piekgroup.com',
     'repo:PIEK-GROUP-CLIENT-OPERATIONAL-INTELLIGENCE-2026-09.md#public-verification-conflict',
     '2026-09-09',null,'possible_change','active','{}',array['caption'],11)
  on conflict do nothing;

  -- ── Footer policies: group standing block + exact entity scopes ────────────
  -- The email line is intentionally held out of the current template until the
  -- caption-email conflict is resolved; phone + website are safe now.
  insert into public.client_contact_footer_policies
    (client_id,scope_key,content_mode,platform,requirement,format_template,review_state,provenance_summary,last_verified_at)
  values
    (v_piek_id,null,'caption',null,'optional','{phone}\n{website}','current_verified',
     'Group standing block; caption email held pending conflict resolution','2026-09-09'),
    (v_piek_id,'engen','caption',null,'optional',null,'current_verified',
     'Engen content uses the Piek Group standing block; no distinct Engen-only caption contact established','2026-09-09'),
    (v_piek_id,'sasol','caption',null,'optional',null,'current_verified',
     'Sasol content uses the Piek Group standing block; no distinct Sasol-only caption contact established','2026-09-09'),
    (v_piek_id,'get-together','caption',null,'optional',null,'current_verified',
     'Get Together content uses the Piek Group standing block; no distinct Get Together-only caption contact established','2026-09-09')
  on conflict do nothing;
end $$;

commit;
