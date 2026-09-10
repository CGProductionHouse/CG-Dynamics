-- Follow-up to 20260910140000. Three CA corrections, 2026-09-10.
--
-- 1. WEBSITES. The first pass captured only phone/email, so 16 clients whose published footer
--    includes a website line were stored incomplete. (My first-pass "site" data was unusable:
--    the regex had no @-boundary, so it was matching the DOMAIN PART OF EMAILS - e.g. AV Event
--    Life looked like it had a website when that was just info@aveventlife.co.za. Re-scanned
--    with (?<![@\w.]).) Only websites that RECUR in the footer are added; one-off campaign links
--    (bestofbloem.co.za) and event deep links (thestaffy.co.za/events) are excluded, as are
--    sites appearing once or twice (Ehrlich 2 of 15, Madison Wear 1 of 16).
--
-- 2. CENTRAL CANVAS is published as "051 435 4955/6" - a number plus its second line. The first
--    pass truncated it to "051 435 4955". CA: copy what is in the latest posts. Corrected.
--
-- 3. RED OAK. CA: numbers go only on booking/event posts, and Lisha and Niki may both feature.
--    Lisha is added as a second booking contact; the policy stays 'optional' and its wording now
--    says so explicitly. Red Oak's existing CA-approved contacts are untouched.
--
-- NOTE ON wisemangroup.co.za appearing for three clients (Wiseman Group, Supa Quick BFN, Supa
-- Quick Centurion): this is NOT cross-client contamination. Supa Quick BFN and Centurion are
-- Wiseman-owned and each publishes that domain in its own captions on its own page.
--
-- Additive + idempotent (NOT EXISTS / guarded UPDATEs). client_guides untouched.

begin;

create temporary table _cg_web_seed (
  client_name text, value text, footer_order int, hits int, total int
) on commit drop;

insert into _cg_web_seed (client_name, value, footer_order, hits, total) values
  ('Bloem Marble & Granite',           'bloemmg.co.za',             30,  1,  9),
  ('Braize',                           'www.braize.co.za',          20, 12, 16),
  ('Central Canvas',                   'www.centralcanvas.co.za',   30, 10, 14),
  ('CG Production House',              'cgproductionhouse.com',     30,  6, 16),
  ('Delta Gas',                        'deltagasbloem.co.za',       30, 15, 17),
  ('Dulux Paint & Paper Bloemfontein', 'www.dulux.co.za',           20, 14, 18),
  ('First Technology Central',         'www.firsttech.co.za',       50,  7, 16),
  ('Germoparts',                       'germoparts.co.za',          30,  9, 16),
  ('HMHI',                             'www.hillmchardy.co.za',     30,  4, 27),
  ('PSG Bloemfontein',                 'www.psgdonaldmurray.co.za', 20,  7, 15),
  ('Supa Quick BFN',                   'wisemangroup.co.za',        30,  3,  6),
  ('Supa Quick Centurion',             'wisemangroup.co.za',        30, 12, 28),
  ('TBS Brokers',                      'www.tbsbrokers.co.za',      30, 14, 16),
  ('Tobich Optics',                    'tobich-optics.com',         30, 13, 14),
  ('Watch Addict',                     'watchaddict.co.za',         30, 12, 16),
  ('Wiseman Group',                    'wisemangroup.co.za',        20,  4,  5);

do $$
declare v_bad text;
begin
  select string_agg(s.client_name, ', ') into v_bad from _cg_web_seed s
  where (select count(*) from public.clients c where c.name = s.client_name and c.active) <> 1;
  if v_bad is not null then raise exception 'Unresolved clients: %', v_bad; end if;
end $$;

insert into public.client_contacts
  (client_id, scope_key, scope_label, contact_type, display_label, value,
   approved_for_caption, blocks_caption, visibility, allowed_purposes,
   provenance_summary, source_reference, observed_at, last_verified_at,
   freshness_state, lifecycle_state, platforms, content_modes, footer_order)
select c.id, null, null, 'website', 'Caption footer website', s.value,
       true, false, 'public_marketing', array['caption_footer'],
       'Published by the client on its own Meta page; recurs in ' || s.hits || ' of ' || s.total
         || ' reviewed published captions.',
       'Meta Business Suite published posts, reviewed 2026-09-10',
       '2026-09-10', '2026-09-10',
       'current_verified', 'active', '{}', array['caption'], s.footer_order
from _cg_web_seed s
join public.clients c on c.name = s.client_name and c.active
where not exists (
  select 1 from public.client_contacts e
  where e.client_id = c.id and e.contact_type = 'website'
    and e.value = s.value and e.scope_key is null
);

-- Append {website} to the client-wide caption template where one was just added and the
-- template does not already mention it. Germoparts is skipped: its policies are branch-scoped
-- while the website is client-wide, so the branch templates stay '{phone}'.
update public.client_contact_footer_policies p
   set format_template = p.format_template || chr(10) || '{website}',
       updated_at = now()
from public.clients c, _cg_web_seed s
where p.client_id = c.id and c.name = s.client_name and c.active
  and c.name <> 'Germoparts'
  and p.content_mode = 'caption' and p.platform is null and p.scope_key is null
  and p.format_template is not null
  and p.format_template not like '%{website}%';

-- 2. Central Canvas: store the number exactly as published.
-- A contact's value is IMMUTABLE - trigger preserve_client_contact_history() rejects any update
-- to client_id/scope_key/contact_type/value and requires a successor plus supersession. So the
-- corrected number is inserted as a new row and the truncated one is superseded, not edited.
do $$
declare v_client uuid; v_old uuid; v_new uuid;
begin
  select id into v_client from public.clients where name = 'Central Canvas' and active;
  if v_client is null then raise exception 'Central Canvas not resolved'; end if;

  select id into v_old from public.client_contacts
   where client_id = v_client and contact_type = 'phone' and value = '051 435 4955'
     and lifecycle_state = 'active';

  if v_old is not null then
    insert into public.client_contacts
      (client_id, scope_key, scope_label, contact_type, display_label, value,
       approved_for_caption, blocks_caption, visibility, allowed_purposes,
       provenance_summary, source_reference, observed_at, last_verified_at,
       freshness_state, lifecycle_state, platforms, content_modes, footer_order)
    values
      (v_client, null, null, 'phone', 'Caption footer phone', '051 435 4955/6',
       true, false, 'public_marketing', array['caption_footer'],
       'Published by the client on its own Meta page as "051 435 4955/6" (main number plus its '
         || 'second line); recurs in 10 of 14 reviewed published captions.',
       'Meta Business Suite published posts, reviewed 2026-09-10',
       '2026-09-10', '2026-09-10', 'current_verified', 'active', '{}', array['caption'], 10)
    returning id into v_new;

    update public.client_contacts
       set lifecycle_state = 'superseded', superseded_by_contact_id = v_new,
           approved_for_caption = false, freshness_state = 'historical',
           provenance_summary = 'Superseded 2026-09-10: this was a truncated capture of the '
             || 'published number. The client publishes "051 435 4955/6". Original provenance: '
             || provenance_summary,
           last_verified_at = '2026-09-10', updated_at = now()
     where id = v_old;
  end if;
end $$;

update public.client_contact_footer_policies p
   set provenance_summary = 'Phone, email and website close 10 of 14 reviewed captions. The phone '
         || 'is published as "051 435 4955/6" and is stored that way.',
       last_verified_at = '2026-09-10', updated_at = now()
from public.clients c
where p.client_id = c.id and c.name = 'Central Canvas'
  and p.content_mode = 'caption' and p.platform is null and p.scope_key is null;

-- 3. Red Oak: Lisha joins Niki as a bookings contact. Contacts stay OPTIONAL and belong only on
-- booking/event posts - Red Oak's existing rows and its 'optional' requirement are unchanged.
do $$
declare v_client uuid;
begin
  select id into v_client from public.clients where name = 'Red Oak' and active;
  if v_client is null then raise exception 'Red Oak not resolved'; end if;

  insert into public.client_contacts
    (client_id, scope_key, scope_label, contact_type, display_label, person_name, person_role, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes,
     provenance_summary, source_reference, observed_at, last_verified_at,
     freshness_state, lifecycle_state, platforms, content_modes, footer_order)
  select v_client, null, null, 'booking', 'Bookings', 'Lisha', 'Bookings/functions', '079 236 9927',
         true, false, 'public_marketing', array['caption_footer','bookings'],
         'Published by Red Oak on its own Meta page alongside Niki on booking/event posts; '
           || 'CA confirmed 2026-09-10 that Lisha and Niki may both feature.',
         'Meta Business Suite published posts, reviewed 2026-09-10',
         '2026-09-10', '2026-09-10',
         'current_verified', 'active', '{}', array['caption'], 25
  where not exists (
    select 1 from public.client_contacts e
    where e.client_id = v_client and e.contact_type = 'booking' and e.value = '079 236 9927'
  );

  update public.client_contact_footer_policies
     set provenance_summary = 'Red Oak routine captions omit contacts. Numbers are added ONLY to '
           || 'booking or event posts (enquiry, booking, function or event route). Niki and Lisha '
           || 'may both feature. CA confirmed 2026-09-10.',
         last_verified_at = '2026-09-10', updated_at = now()
   where client_id = v_client and content_mode = 'caption' and platform is null and scope_key is null;
end $$;

commit;
