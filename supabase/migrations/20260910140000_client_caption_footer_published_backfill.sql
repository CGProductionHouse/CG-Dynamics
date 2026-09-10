-- Caption contact/footer backfill from clients' own published Meta captions. #294 / #325.
-- Researched 2026-09-10 from Meta Business Suite published posts, per client, using the
-- canonical client -> facebook_page_id map in public.meta_client_assets (no name guessing).
--
-- EVIDENCE RULE
-- A value is included only when it RECURS across a client's own published captions. Recurrence
-- is what separates a real footer from an incidental contact, and it is recorded per row in
-- provenance_summary as "N of M reviewed captions".
--
-- SCOPE / SAFETY
--   * Additive only. Touches ONLY client_contacts and client_contact_footer_policies.
--   * Does NOT touch client_guides - the reviewed caption/tone research is left intact.
--   * Idempotent via NOT EXISTS (these tables have no unique constraint, so ON CONFLICT
--     would NOT deduplicate and re-running would create duplicate rows).
--   * Exact-name client resolution with a fail-closed assertion; no fuzzy matching.
--   * Prepared only - do not apply without explicit CA approval.
--
-- DELIBERATE EXCLUSIONS (evidence was not good enough to publish):
--   * Piek Group phone - CA confirmed 051 444 3178 is WISEMAN GROUP's number and Piek carrying
--     it is a mistake. It is wrong in three places (captions, the client guide, and the
--     PiekGroup-Website repo src/data/site.ts). Piek already has curated contacts, so nothing
--     is inserted for it; the correction block at the end retires the wrong number. The correct
--     Piek group phone still needs to come from CA.
--   * Bohemia Quick Stop - one published number (073 242 5753) actually belongs to We Ar Fuels'
--     rep Ryno Serfontein, and the email is a "bohemiaagri" gmail. Contaminated; needs CA.
--   * Peyper Bonds - the footer is a LIST of consultant mailboxes (albert/hennie/ria/magdel at
--     13 of 14, alissa 9, elizna 8). Which consultants belong in a caption is a CA decision.
--   * RC-Polypipe - contacts appear in only 1 of 16 captions. Too thin to call a footer.
--   * Case Bloemfontein - publishes no contacts at all in 13 captions. Absence of rows is the
--     honest state; the runtime then correctly reports no footer rather than inventing one.
--   * Red Oak / SecuriForce - already carry CA-approved contacts. Not re-seeded. (Red Oak's
--     published "Lisha 079 236 9927" is NEW and not added here; CA to confirm separately.)
--   * Dulux irene.dulux@paco.co.za and The Staffordshire info@thestaffy.co.za - each appears in
--     a single post (a named individual / a recruitment ad), not the caption footer.
--   * Braize phone numbers - four NAMED AUCTION CONTACTS in 3 posts. Event contacts, not a footer.

begin;

create temporary table _cg_contact_seed (
  client_name text, scope_key text, scope_label text, contact_type text,
  display_label text, person_name text, value text, footer_order int,
  hits int, total int
) on commit drop;

insert into _cg_contact_seed
  (client_name, scope_key, scope_label, contact_type, display_label, person_name, value, footer_order, hits, total) values
  -- ── Consistent client-wide footers ────────────────────────────────────────
  ('AV Event Life', null, null, 'phone', 'Caption footer phone', null, '+27 72 762 0715', 10, 15, 15),
  ('AV Event Life', null, null, 'email', 'Caption footer email', null, 'info@aveventlife.co.za', 20, 15, 15),

  ('Bouwer & Coetzee Attorneys', null, null, 'phone', 'Caption footer phone', null, '083 266 5507', 10, 14, 16),
  ('Bouwer & Coetzee Attorneys', null, null, 'email', 'Caption footer email', null, 'luane@bouwercoetzee.co.za', 20, 11, 16),

  ('Braize', null, null, 'email', 'Caption footer email', null, 'promotions@braize.co.za', 10, 12, 16),

  ('C&L Innovations', null, null, 'phone', 'Caption footer phone', 'Lize', '+27 79 497 1741', 10, 14, 16),
  ('C&L Innovations', null, null, 'phone', 'Caption footer phone', 'Chris', '+27 82 553 0356', 20, 14, 16),

  ('Cape Lumber', null, null, 'phone', 'Caption footer phone', null, '+27 71 353 4261', 10, 9, 14),
  ('Cape Lumber', null, null, 'email', 'Caption footer email', null, 'info@capelumbermarketing.co.za', 20, 8, 14),

  ('Central Canvas', null, null, 'phone', 'Caption footer phone', null, '051 435 4955', 10, 10, 14),
  ('Central Canvas', null, null, 'email', 'Caption footer email', null, 'sales@centralcanvas.co.za', 20, 10, 14),

  ('Daisy & Co', null, null, 'phone', 'Caption footer phone', null, '082 705 3762', 10, 8, 15),

  ('Delta Gas', null, null, 'phone', 'Caption footer phone', null, '079 559 3734', 10, 16, 17),
  ('Delta Gas', null, null, 'email', 'Caption footer email', null, 'deltagasbloem@gmail.com', 20, 16, 17),

  ('Dulux Paint & Paper Bloemfontein', null, null, 'phone', 'Caption footer phone', null, '051 430 3699', 10, 16, 18),

  ('Ehrlich Park Butchery', null, null, 'phone', 'Caption footer phone', null, '051 434 2761', 10, 14, 15),
  ('Ehrlich Park Butchery', null, null, 'phone', 'Caption footer second line', null, '051 434 2001', 20, 13, 15),
  ('Ehrlich Park Butchery', null, null, 'whatsapp', 'Caption footer WhatsApp', null, '+27 78 057 4485', 30, 14, 15),

  ('Local Deli', null, null, 'phone', 'Caption footer phone', null, '082 889 8975', 10, 11, 12),

  ('Loraclox', null, null, 'phone', 'Caption footer phone', null, '+27 74 119 0819', 10, 14, 25),
  ('Loraclox', null, null, 'email', 'Caption footer email', null, 'welda@loraclox.co.za', 20, 14, 25),

  ('Madison Wear', null, null, 'phone', 'Caption footer phone', null, '064 929 9324', 10, 15, 16),
  ('Madison Wear', null, null, 'email', 'Caption footer email', null, 'sales@madisonswear.co.za', 20, 16, 16),

  ('Novus Steel', null, null, 'phone', 'Caption footer phone', null, '082 413 6692', 10, 15, 16),
  ('Novus Steel', null, null, 'email', 'Caption footer email', null, 'info@novussteel.co.za', 20, 15, 16),

  -- Piek Group is NOT seeded here. It already carries curated contacts and a scoped policy set
  -- from earlier research; the only change it needs is the correction block at the end of this
  -- migration, which retires Wiseman Group's phone number from Piek's caption footer.

  ('Supa Quick BFN', null, null, 'phone', 'Caption footer phone', null, '+27 51 101 0944', 10, 10, 14),
  ('Supa Quick BFN', null, null, 'email', 'Caption footer email', null, 'sq@wisemangroup.co.za', 20, 10, 14),

  ('TBS Brokers', null, null, 'phone', 'Caption footer phone', 'Kevin Stevens', '082 087 1152', 10, 15, 16),
  ('TBS Brokers', null, null, 'email', 'Caption footer email', 'Kevin Stevens', 'kevin@tbsbrokers.co.za', 20, 15, 16),

  ('The Staffordshire', null, null, 'booking', 'Caption footer bookings', null, '087 897 0419', 10, 13, 16),

  ('Tobich Optics', null, null, 'phone', 'Caption footer phone (Namibia)', null, '+264 852 369 004', 10, 13, 14),
  ('Tobich Optics', null, null, 'email', 'Caption footer email', 'Bertus', 'bertus@tobich-optics.com', 20, 13, 14),

  ('Watch Addict', null, null, 'phone', 'Caption footer phone', null, '+27 64 902 5526', 10, 14, 16),
  ('Watch Addict', null, null, 'email', 'Caption footer email', null, 'info@watchaddict.co.za', 20, 14, 16),

  -- We Ar Fuels publishes a three-rep regional block as its standard footer.
  ('We Ar Fuels', null, null, 'phone', 'Sentraal Vrystaat', 'Ryno Serfontein', '073 242 5753', 10, 15, 16),
  ('We Ar Fuels', null, null, 'email', 'Sentraal Vrystaat', 'Ryno Serfontein', 'ryno@wearfuels.co.za', 20, 15, 16),
  ('We Ar Fuels', null, null, 'phone', 'Wes Vrystaat', 'Paul de Koker', '082 771 0907', 30, 15, 16),
  ('We Ar Fuels', null, null, 'email', 'Wes Vrystaat', 'Paul de Koker', 'sales2@wearfuels.co.za', 40, 15, 16),
  ('We Ar Fuels', null, null, 'phone', 'Regional', 'Werner Serfontein', '078 113 6799', 50, 15, 16),
  ('We Ar Fuels', null, null, 'email', 'Regional', 'Werner Serfontein', 'werner@wearfuels.co.za', 60, 15, 16),

  ('Wiseman Group', null, null, 'phone', 'Caption footer phone', null, '+27 51 444 3178', 10, 4, 5),

  ('Zooz Lifestyle WFF', null, null, 'phone', 'Caption footer phone', 'Esramé', '072 6988 666', 10, 8, 16),

  -- ── Occasional footers (used in a minority of captions) ───────────────────
  ('Bloem Marble & Granite', null, null, 'phone', 'Caption footer phone', null, '087 940 7711', 10, 2, 23),
  ('Bloem Marble & Granite', null, null, 'email', 'Caption footer email', null, 'info@bmgk.co.za', 20, 2, 23),

  ('CG Production House', null, null, 'phone', 'Caption footer phone', null, '+27 79 115 2339', 10, 6, 16),
  ('CG Production House', null, null, 'email', 'Caption footer email', null, 'info@cgproductionhouse.com', 20, 6, 16),

  ('Emmanuel Funerals', null, null, 'phone', 'Caption footer phone', null, '051 448 8566', 10, 4, 16),
  ('Emmanuel Funerals', null, null, 'email', 'Caption footer email', 'Jeanette', 'jeanette@emmanuelfuneralsbfn.co.za', 20, 4, 16),

  ('HMHI', null, null, 'phone', 'Caption footer phone', null, '051 447 2171', 10, 3, 27),
  ('HMHI', null, null, 'email', 'Caption footer email', null, 'ontvangs@hmhi.co.za', 20, 3, 27),

  ('PSG Bloemfontein', null, null, 'phone', 'Caption footer phone', null, '084 506 7640', 10, 6, 15),

  ('Supa Quick Centurion', null, null, 'phone', 'Caption footer phone', null, '012 003 0430', 10, 12, 28),
  ('Supa Quick Centurion', null, null, 'email', 'Caption footer email', 'Jurgens W', 'jurgensw@wisemangroup.co.za', 20, 12, 28),

  ('First Technology Central', null, null, 'email', 'Caption footer email (technical)', null, 'tech@firsttechfs.co.za', 10, 10, 16),
  ('First Technology Central', null, null, 'email', 'Caption footer email (sales)', null, 'sales@firsttechfs.co.za', 20, 7, 16),
  ('First Technology Central', null, null, 'phone', 'Caption footer phone (share-call)', null, '087 095 3337', 30, 5, 16),
  ('First Technology Central', null, null, 'phone', 'Caption footer phone (landline)', null, '051 430 4455', 40, 5, 16),

  -- ── Germoparts: branch-scoped, exactly as published ───────────────────────
  -- Branch labels cross-checked against the CG-built germoparts-website-wordpress branch table.
  ('Germoparts', 'brits',        'Brits',        'phone', 'Branch phone', null, '012 252 0426', 10, 3, 16),
  ('Germoparts', 'kimberley',    'Kimberley',    'phone', 'Branch phone', null, '053 050 1866', 10, 2, 16),
  ('Germoparts', 'bloemfontein', 'Bloemfontein', 'phone', 'Branch phone', null, '051 430 0401', 10, 1, 16),
  ('Germoparts', 'vereeniging',  'Vereeniging',  'phone', 'Branch phone', null, '011 262 0331', 10, 1, 16),
  ('Germoparts', 'sandton',      'Sandton',      'phone', 'Branch phone', null, '011 262 0188', 10, 1, 16);

create temporary table _cg_policy_seed (
  client_name text, scope_key text, scope_label text, requirement text, format_template text, note text
) on commit drop;

insert into _cg_policy_seed (client_name, scope_key, scope_label, requirement, format_template, note) values
  ('AV Event Life', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email close 15 of 15 reviewed captions.'),
  ('Bouwer & Coetzee Attorneys', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone in 14 of 16 captions, email in 11.'),
  ('Braize', null, null, 'mandatory', '{email}', 'Email in 12 of 16 captions. Published phone numbers are named auction contacts, not a footer.'),
  ('C&L Innovations', null, null, 'mandatory', null, 'Two-person block (Lize and Chris) in 14 of 16 captions. No email is published.'),
  ('Cape Lumber', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone in 9 of 14 captions, email in 8.'),
  ('Central Canvas', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Published as "051 435 4955/6" - confirm whether 051 435 4956 is a second line.'),
  ('Daisy & Co', null, null, 'mandatory', '{phone}', 'Phone in 8 of 15 captions. No email is published.'),
  ('Delta Gas', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 16 of 17 captions.'),
  ('Dulux Paint & Paper Bloemfontein', null, null, 'mandatory', '{phone}', 'Phone in 16 of 18 captions. No email belongs in the footer.'),
  ('Ehrlich Park Butchery', null, null, 'mandatory', null, 'Two landlines plus a WhatsApp number close 14 of 15 captions.'),
  ('Local Deli', null, null, 'mandatory', '{phone}', 'Phone in 11 of 12 captions; sometimes introduced as "Leon to order".'),
  ('Loraclox', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 14 of 25 captions.'),
  ('Madison Wear', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Email in 16 of 16 captions, phone in 15.'),
  ('Novus Steel', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 15 of 16 captions.'),
  ('Supa Quick BFN', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 10 of 14 captions. Wiseman Group mailbox is expected - Supa Quick BFN sits under Wiseman.'),
  ('TBS Brokers', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 15 of 16 captions.'),
  ('The Staffordshire', null, null, 'mandatory', '{booking}', 'Bookings number in 13 of 16 captions.'),
  ('Tobich Optics', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Namibian +264 number - never normalise to a South African format.'),
  ('Watch Addict', null, null, 'mandatory', '{phone}' || chr(10) || '{email}', 'Phone and email in 14 of 16 captions.'),
  ('We Ar Fuels', null, null, 'mandatory', null, 'Three-rep regional block in 15 of 16 captions.'),
  ('Wiseman Group', null, null, 'mandatory', '{phone}', 'Phone in 4 of 5 captions in the reviewed window.'),
  ('Zooz Lifestyle WFF', null, null, 'mandatory', '{phone}', 'Named contact (Esramé) in 8 of 16 captions.'),

  ('Bloem Marble & Granite', null, null, 'optional', '{phone}' || chr(10) || '{email}', 'Footer in only 2 of 23 captions.'),
  ('CG Production House', null, null, 'optional', '{phone}' || chr(10) || '{email}', 'Footer in 6 of 16 captions.'),
  ('Emmanuel Funerals', null, null, 'optional', '{phone}' || chr(10) || '{email}', 'Footer in 4 of 16 captions.'),
  ('HMHI', null, null, 'optional', '{phone}' || chr(10) || '{email}', 'Footer in 3 of 27 captions.'),
  ('PSG Bloemfontein', null, null, 'optional', '{phone}', 'Office number in 6 of 15 captions. Not a named-adviser contact.'),
  ('Supa Quick Centurion', null, null, 'optional', '{phone}' || chr(10) || '{email}', 'Footer in 12 of 28 captions.'),
  ('First Technology Central', null, null, 'optional', null, 'Two mailboxes and two numbers rotate; CA to pick the canonical pair.'),

  ('Germoparts', 'brits',        'Brits',        'optional', '{phone}', 'Use the branch number matching the branch the post is about.'),
  ('Germoparts', 'kimberley',    'Kimberley',    'optional', '{phone}', 'Use the branch number matching the branch the post is about.'),
  ('Germoparts', 'bloemfontein', 'Bloemfontein', 'optional', '{phone}', 'Use the branch number matching the branch the post is about.'),
  ('Germoparts', 'vereeniging',  'Vereeniging',  'optional', '{phone}', 'Use the branch number matching the branch the post is about.'),
  ('Germoparts', 'sandton',      'Sandton',      'optional', '{phone}', 'Use the branch number matching the branch the post is about.');

-- Fail closed: every seeded client name must resolve to exactly one ACTIVE client.
do $$
declare v_bad text;
begin
  select string_agg(x.client_name, ', ') into v_bad from (
    select s.client_name from _cg_contact_seed s
    union select p.client_name from _cg_policy_seed p
  ) x
  where (select count(*) from public.clients c where c.name = x.client_name and c.active) <> 1;
  if v_bad is not null then
    raise exception 'Seed client names that do not resolve to exactly one active client: %', v_bad;
  end if;
end $$;

-- NOT EXISTS, not ON CONFLICT: these tables have no unique constraint, so ON CONFLICT would
-- silently insert duplicates on a re-run.
insert into public.client_contacts
  (client_id, scope_key, scope_label, contact_type, display_label, person_name, value,
   approved_for_caption, blocks_caption, visibility, allowed_purposes,
   provenance_summary, source_reference, observed_at, last_verified_at,
   freshness_state, lifecycle_state, platforms, content_modes, footer_order)
select c.id, s.scope_key, s.scope_label, s.contact_type, s.display_label, s.person_name, s.value,
       true, false, 'public_marketing', array['caption_footer'],
       'Published by the client on its own Meta page; recurs in ' || s.hits || ' of ' || s.total
         || ' reviewed published captions.',
       'Meta Business Suite published posts, reviewed 2026-09-10',
       '2026-09-10', '2026-09-10',
       'current_verified', 'active', '{}', array['caption'], s.footer_order
from _cg_contact_seed s
join public.clients c on c.name = s.client_name and c.active
where not exists (
  select 1 from public.client_contacts e
  where e.client_id = c.id
    and e.contact_type = s.contact_type
    and e.value = s.value
    and e.scope_key is not distinct from s.scope_key
);

insert into public.client_contact_footer_policies
  (client_id, scope_key, scope_label, content_mode, platform, requirement,
   format_template, review_state, provenance_summary, last_verified_at)
select c.id, p.scope_key, p.scope_label, 'caption', null, p.requirement,
       p.format_template, 'current_verified', p.note, '2026-09-10'
from _cg_policy_seed p
join public.clients c on c.name = p.client_name and c.active
where not exists (
  select 1 from public.client_contact_footer_policies e
  where e.client_id = c.id
    and e.content_mode = 'caption'
    and e.platform is null
    and e.scope_key is not distinct from p.scope_key
);

-- ── CORRECTION: Piek Group must not publish Wiseman Group's phone number ────────────────────
-- CA confirmed 2026-09-10 that +27 51 444 3178 belongs to Wiseman Group and Piek Group carrying
-- it is a mistake. It was stored approved_for_caption=true / current_verified, so live Piek
-- captions would have published another client's number.
--
-- The row is RETIRED, not deleted: audit history is preserved (lifecycle 'superseded' is not
-- used because that requires a replacement contact id, and the correct Piek number is unknown).
-- The group caption template is switched from '{phone}\n{website}' to '{website}' so it no longer
-- references a contact that is deliberately unavailable. Piek's scoped policies and its other
-- contacts are untouched.
--
-- STILL OUTSTANDING: the correct Piek Group phone number. It is wrong in two other places that
-- this migration cannot reach - the Piek client guide (client_guides.guide_markdown, sections
-- "Get Together / Crossing" and "13. Caption/footer contact convention") and the CG-built site
-- repo PiekGroup-Website (src/data/site.ts contact.phone, and docs/content-migration.md).
do $$
declare v_client uuid; v_rows int;
begin
  select id into v_client from public.clients where name = 'Piek Group' and active;
  if v_client is null then raise exception 'Piek Group not resolved'; end if;

  update public.client_contacts
     set approved_for_caption = false,
         freshness_state = 'rejected',
         provenance_summary = 'WITHDRAWN 2026-09-10: this is Wiseman Group''s number, not Piek Group''s. '
           || 'CA confirmed Piek Group carrying it is a mistake. Retired from caption use; the correct '
           || 'Piek Group phone is still outstanding. Original provenance: ' || provenance_summary,
         last_verified_at = '2026-09-10',
         updated_at = now()
   where client_id = v_client
     and contact_type = 'phone'
     and regexp_replace(value, '\D', '', 'g') like '%514443178%'
     and approved_for_caption;
  get diagnostics v_rows = row_count;
  raise notice 'Piek Group: retired % incorrect caption phone row(s)', v_rows;

  update public.client_contact_footer_policies
     set format_template = '{website}',
         provenance_summary = 'Group standing block. Phone removed from the template 2026-09-10: the '
           || 'stored number was Wiseman Group''s and has been withdrawn. Website only until CA supplies '
           || 'the correct Piek Group phone.',
         last_verified_at = '2026-09-10',
         updated_at = now()
   where client_id = v_client
     and content_mode = 'caption'
     and platform is null
     and scope_key is null
     and format_template like '%{phone}%';
end $$;

commit;
