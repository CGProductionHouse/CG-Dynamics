-- Resolves the four clients held back from 20260910140000, using each client's OWN website as the
-- tiebreaker. That method comes from the Piek/Wiseman ownership error: a client's captions are not
-- a safe source for that client when the captions are themselves the suspected mistake.
--
--   PEYPER BONDS  peyperbonds.co.za publishes exactly one contact (Albert 083 317 1007 /
--                 albert@peyperbonds.co.za) while the captions publish a consultant mailbox block.
--                 Both are kept: the website-confirmed phone, then the recurring mailboxes in
--                 caption order with Albert first. The footer is a BLOCK, not one address.
--   RC-POLYPIPE   rcpolypipe.com publishes exactly the values that appeared in the single caption,
--                 so thin caption evidence is now corroborated. Footer stays optional (1 of 16)
--                 but the values are current_verified.
--   BOHEMIA       Only what is unambiguously Bohemia's is stored. 073 242 5753 is deliberately NOT
--                 stored - it is We Ar Fuels' rep Ryno Serfontein's number. Both are fuel
--                 businesses so it may be a genuine shared contact, but ownership cannot be
--                 confirmed and no client's footer may carry another client's contact.
--   FIRST TECH    firsttech.co.za is the national holding site (contact form only, no branch
--                 contacts), so branch captions are the only source. Canonical pair = the
--                 Bloemfontein/Central landline 051 430 4455 (051 = Bloemfontein) and
--                 tech@firsttechfs.co.za (most used, 10 of 16). Share-call and sales mailbox rank
--                 below rather than being discarded.
--
-- Applied to production 2026-09-10 with CA approval. Additive + idempotent (NOT EXISTS).
-- client_guides untouched.

begin;

do $$
declare v uuid;
begin
  select id into v from public.clients where name='Peyper Bonds' and active;
  if v is null then raise exception 'Peyper Bonds not resolved'; end if;

  insert into public.client_contacts
    (client_id, scope_key, contact_type, display_label, person_name, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes, provenance_summary,
     source_reference, observed_at, last_verified_at, freshness_state, lifecycle_state,
     platforms, content_modes, footer_order)
  select v, null, x.ctype, x.label, x.pname, x.val, true, false, 'public_marketing',
         array['caption_footer'], x.prov,
         'peyperbonds.co.za + Meta published captions, reviewed 2026-09-10',
         '2026-09-10','2026-09-10','current_verified','active','{}',array['caption'], x.ord
  from (values
    ('phone','Caption footer phone','Albert','083 317 1007', 10,
      'Published on peyperbonds.co.za as the firm''s contact number and in Peyper Bonds'' own captions.'),
    ('email','Consultant mailbox','Albert','albert@peyperbonds.co.za', 20,
      'Published on peyperbonds.co.za and recurs in 13 of 14 reviewed captions.'),
    ('email','Consultant mailbox','Hennie','hennie@peyperbonds.co.za', 30,
      'Recurs in 13 of 14 reviewed published captions.'),
    ('email','Consultant mailbox','Ria','ria@peyperbonds.co.za', 40,
      'Recurs in 13 of 14 reviewed published captions.'),
    ('email','Consultant mailbox','Magdel','magdel@peyperbonds.co.za', 50,
      'Recurs in 13 of 14 reviewed published captions.'),
    ('email','Consultant mailbox','Alissa','alissa@peyperbonds.co.za', 60,
      'Recurs in 9 of 14 reviewed published captions.'),
    ('email','Consultant mailbox','Elizna','elizna@peyperbonds.co.za', 70,
      'Recurs in 8 of 14 reviewed published captions.')
  ) as x(ctype,label,pname,val,ord,prov)
  where not exists (select 1 from public.client_contacts e
                    where e.client_id=v and e.contact_type=x.ctype and e.value=x.val);

  insert into public.client_contact_footer_policies
    (client_id, scope_key, content_mode, platform, requirement, format_template,
     review_state, provenance_summary, last_verified_at)
  select v, null, 'caption', null, 'mandatory', null, 'current_verified',
    'Peyper Bonds publishes a CONSULTANT MAILBOX BLOCK, not a single address - it closes 13 of 14 '
      || 'reviewed captions. Albert is the principal (the only contact on peyperbonds.co.za) and is '
      || 'ordered first. Use the block in footer_order; do not substitute one consultant for another.',
    '2026-09-10'
  where not exists (select 1 from public.client_contact_footer_policies e
                    where e.client_id=v and e.content_mode='caption' and e.platform is null and e.scope_key is null);
end $$;

do $$
declare v uuid;
begin
  select id into v from public.clients where name='RC-Polypipe' and active;
  if v is null then raise exception 'RC-Polypipe not resolved'; end if;

  insert into public.client_contacts
    (client_id, scope_key, contact_type, display_label, person_name, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes, provenance_summary,
     source_reference, observed_at, last_verified_at, freshness_state, lifecycle_state,
     platforms, content_modes, footer_order)
  select v, null, x.ctype, x.label, x.pname, x.val, true, false, 'public_marketing',
         array['caption_footer'], x.prov,
         'rcpolypipe.com + Meta published captions, reviewed 2026-09-10',
         '2026-09-10','2026-09-10','current_verified','active','{}',array['caption'], x.ord
  from (values
    ('phone','Caption footer phone',null,'+27 76 218 6307', 10,
      'Published on rcpolypipe.com as the tel contact and in RC-Polypipe''s own caption.'),
    ('whatsapp','Caption footer WhatsApp',null,'+27 71 677 4683', 20,
      'Published on rcpolypipe.com as the WhatsApp/primary contact and in RC-Polypipe''s own caption.'),
    ('email','Caption footer email','Rudolph','rudolph@rcpolypipe.com', 30,
      'Published on rcpolypipe.com and in RC-Polypipe''s own caption.')
  ) as x(ctype,label,pname,val,ord,prov)
  where not exists (select 1 from public.client_contacts e
                    where e.client_id=v and e.contact_type=x.ctype and e.value=x.val);

  insert into public.client_contact_footer_policies
    (client_id, scope_key, content_mode, platform, requirement, format_template,
     review_state, provenance_summary, last_verified_at)
  select v, null, 'caption', null, 'optional', null, 'current_verified',
    'Contacts appear in only 1 of 16 reviewed captions, so the footer is optional - but every value '
      || 'is confirmed on rcpolypipe.com, so when a footer is used these are the correct values.',
    '2026-09-10'
  where not exists (select 1 from public.client_contact_footer_policies e
                    where e.client_id=v and e.content_mode='caption' and e.platform is null and e.scope_key is null);
end $$;

do $$
declare v uuid;
begin
  select id into v from public.clients where name='Bohemia Quick Stop' and active;
  if v is null then raise exception 'Bohemia Quick Stop not resolved'; end if;

  insert into public.client_contacts
    (client_id, scope_key, contact_type, display_label, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes, provenance_summary,
     source_reference, observed_at, last_verified_at, freshness_state, lifecycle_state,
     platforms, content_modes, footer_order)
  select v, null, x.ctype, x.label, x.val, true, false, 'public_marketing',
         array['caption_footer'], x.prov,
         'Bohemia Quick Stop Meta page + published captions, reviewed 2026-09-10',
         '2026-09-10','2026-09-10','current_verified','active','{}',array['caption'], x.ord
  from (values
    ('phone','Caption footer phone','072 493 7007', 10,
      'Carried on Bohemia Quick Stop''s own Meta page and in its own published captions. Unique to '
        || 'this client.'),
    ('email','Caption footer email','bohemiaagri1@gmail.com', 20,
      'Carried on Bohemia Quick Stop''s own Meta page and in its own published captions.')
  ) as x(ctype,label,val,ord,prov)
  where not exists (select 1 from public.client_contacts e
                    where e.client_id=v and e.contact_type=x.ctype and e.value=x.val);

  insert into public.client_contact_footer_policies
    (client_id, scope_key, content_mode, platform, requirement, format_template,
     review_state, provenance_summary, last_verified_at)
  select v, null, 'caption', null, 'optional', '{phone}' || chr(10) || '{email}', 'current_verified',
    'Only 5 captions were available in the reviewed window, so the footer is optional. NOTE: a second '
      || 'number (073 242 5753) appears in Bohemia''s captions but belongs to We Ar Fuels'' rep Ryno '
      || 'Serfontein and is deliberately NOT stored for this client.',
    '2026-09-10'
  where not exists (select 1 from public.client_contact_footer_policies e
                    where e.client_id=v and e.content_mode='caption' and e.platform is null and e.scope_key is null);
end $$;

do $$
declare v uuid;
begin
  select id into v from public.clients where name='First Technology Central' and active;
  if v is null then raise exception 'First Technology Central not resolved'; end if;

  update public.client_contacts set footer_order=10, updated_at=now()
   where client_id=v and contact_type='phone' and value='051 430 4455';
  update public.client_contacts set footer_order=20, updated_at=now()
   where client_id=v and contact_type='email' and value='tech@firsttechfs.co.za';
  update public.client_contacts set footer_order=30, updated_at=now()
   where client_id=v and contact_type='email' and value='sales@firsttechfs.co.za';
  update public.client_contacts set footer_order=40, updated_at=now()
   where client_id=v and contact_type='phone' and value='087 095 3337';
  update public.client_contacts set footer_order=50, updated_at=now()
   where client_id=v and contact_type='website';

  update public.client_contact_footer_policies
     set requirement='mandatory',
         format_template='{phone}' || chr(10) || '{email}' || chr(10) || '{website}',
         provenance_summary='Canonical pair is the Bloemfontein (Central) landline 051 430 4455 and '
           || 'tech@firsttechfs.co.za, the most-used mailbox (10 of 16 captions), plus the website. '
           || 'The national share-call 087 095 3337 and sales@firsttechfs.co.za remain available at a '
           || 'lower footer_order. firsttech.co.za is the national holding site and carries no branch '
           || 'contacts, so the branch captions are the only source.',
         last_verified_at='2026-09-10', updated_at=now()
   where client_id=v and content_mode='caption' and platform is null and scope_key is null;
end $$;

commit;
