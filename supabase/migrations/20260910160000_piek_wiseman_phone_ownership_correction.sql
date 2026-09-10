-- Reverses the Piek Group correction in 20260910140000, which had the ownership BACKWARDS.
--
-- EVIDENCE (2026-09-10):
--   * Wiseman Group's own live site (wisemangroup.co.za/contact-us) lists HQ as 051 430 3971 at
--     80 Nelson Mandela Avenue. 051 444 3178 does NOT appear anywhere on it. Their site does list
--     051 101 0944 and 051 430 3437, which match what is stored for Supa Quick BFN - so those are
--     correct and only the group number was wrong.
--   * Piek Group's own CG-built site (piek-group-website.vercel.app, production commit 4ae1c5e,
--     "Apply final client feedback before go-live") publishes +27 (0)51 444 3178 as the group
--     number, and Piek's client guide lists it too.
--
-- CONCLUSION: 051 444 3178 belongs to PIEK GROUP. The contamination ran the other way -
-- WISEMAN GROUP's published captions carry Piek's number. The earlier migration withdrew the
-- number from the wrong client.
--
-- ACTIONS
--   1. Piek Group: phone restored to caption use; group template restored to '{phone}\n{website}'.
--   2. Wiseman Group: Piek's number retired (not deleted - audit history preserved), and Wiseman's
--      real HQ number inserted from their own website. The website is used rather than published
--      captions because this client's captions are the contaminated source.
--
-- STILL OUTSTANDING (outside this migration):
--   * Wiseman Group's PUBLISHED captions still show Piek's number and need correcting at source.
--   * Piek's live site has a malformed tel: link - "+27 (0)51 444 3178/9" renders as
--     tel:+2705144431789, which cannot dial. Fix in PiekGroup-Website (src/data/site.ts is fine;
--     the href builder strips the "/9" incorrectly).
--
-- Applied to production 2026-09-10 with CA approval.

begin;

do $$
declare v_client uuid;
begin
  select id into v_client from public.clients where name = 'Piek Group' and active;
  if v_client is null then raise exception 'Piek Group not resolved'; end if;

  update public.client_contacts
     set approved_for_caption = true,
         freshness_state = 'current_verified',
         provenance_summary = 'Piek Group group number. Confirmed 2026-09-10 against Piek''s own '
           || 'CG-built website (piek-group-website.vercel.app, "+27 (0)51 444 3178") and against '
           || 'wisemangroup.co.za, which does NOT list this number. An earlier withdrawal on '
           || '2026-09-10 had the ownership backwards and is reversed.',
         last_verified_at = '2026-09-10', updated_at = now()
   where client_id = v_client and contact_type = 'phone'
     and regexp_replace(value, '\D', '', 'g') like '%514443178%';

  update public.client_contact_footer_policies
     set format_template = '{phone}\n{website}',
         provenance_summary = 'Group standing block; caption email held pending conflict resolution.',
         last_verified_at = '2026-09-10', updated_at = now()
   where client_id = v_client and content_mode = 'caption' and platform is null and scope_key is null;
end $$;

do $$
declare v_client uuid;
begin
  select id into v_client from public.clients where name = 'Wiseman Group' and active;
  if v_client is null then raise exception 'Wiseman Group not resolved'; end if;

  update public.client_contacts
     set approved_for_caption = false,
         freshness_state = 'rejected',
         provenance_summary = 'WITHDRAWN 2026-09-10: this is PIEK GROUP''s number, not Wiseman''s. '
           || 'It was picked up from Wiseman''s published captions, which carry another client''s '
           || 'contact in error. wisemangroup.co.za lists HQ as 051 430 3971 and never this number. '
           || 'Original provenance: ' || provenance_summary,
         last_verified_at = '2026-09-10', updated_at = now()
   where client_id = v_client and contact_type = 'phone'
     and regexp_replace(value, '\D', '', 'g') like '%514443178%';

  insert into public.client_contacts
    (client_id, scope_key, scope_label, contact_type, display_label, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes,
     provenance_summary, source_reference, observed_at, last_verified_at,
     freshness_state, lifecycle_state, platforms, content_modes, footer_order)
  select v_client, null, null, 'phone', 'Caption footer phone (HQ)', '051 430 3971',
         true, false, 'public_marketing', array['caption_footer'],
         'Wiseman Group HQ number published on the client''s own site '
           || '(wisemangroup.co.za/contact-us, "80 Nelson Mandela Avenue, Bloemfontein"). Taken from '
           || 'the website rather than published captions because Wiseman''s captions carry Piek '
           || 'Group''s number in error.',
         'wisemangroup.co.za/contact-us, reviewed 2026-09-10',
         '2026-09-10', '2026-09-10', 'current_verified', 'active', '{}', array['caption'], 10
  where not exists (
    select 1 from public.client_contacts e
    where e.client_id = v_client and e.contact_type = 'phone' and e.value = '051 430 3971'
  );

  update public.client_contact_footer_policies
     set format_template = '{phone}' || chr(10) || '{website}',
         provenance_summary = 'Phone and website close 4 of 5 reviewed captions, BUT the phone that '
           || 'appears in those captions is Piek Group''s and has been withdrawn. The stored phone is '
           || 'Wiseman''s real HQ number from wisemangroup.co.za. Wiseman''s published captions still '
           || 'need correcting at source.',
         last_verified_at = '2026-09-10', updated_at = now()
   where client_id = v_client and content_mode = 'caption' and platform is null and scope_key is null;
end $$;

commit;
