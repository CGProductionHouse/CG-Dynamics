-- Peyper Bonds: reconfirm Alissa marketing contact details from client WhatsApp evidence.
-- Production was corrected immediately on 2026-09-21; this migration keeps repository truth reproducible.

update public.client_contacts
set display_label = 'Alissa email',
    observed_at = '2026-09-21T14:39:00Z',
    last_verified_at = '2026-09-21T14:39:00Z',
    freshness_state = 'current_verified',
    lifecycle_state = 'active',
    approved_for_caption = true,
    visibility = 'public_marketing',
    allowed_purposes = array['caption_footer']::text[],
    content_modes = array['caption']::text[],
    provenance_summary = 'Client explicitly requested that Alissa be included in Peyper Bonds marketing information and supplied this email directly; reconfirmed from WhatsApp evidence on 2026-09-21.',
    source_reference = 'Client WhatsApp instruction dated 2026-09-09; screenshot reconfirmed 2026-09-21.'
where client_id = 'a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b'
  and lower(person_name) = 'alissa'
  and contact_type = 'email'
  and lower(value) = 'alissa@peyperbonds.co.za';

insert into public.client_contacts
  (client_id, scope_key, contact_type, display_label, person_name, person_role, value,
   approved_for_caption, blocks_caption, visibility, allowed_purposes,
   provenance_summary, source_reference, observed_at, last_verified_at,
   freshness_state, lifecycle_state, platforms, content_modes, footer_order)
select
  'a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b', null, 'phone', 'Alissa phone', 'Alissa', null, '+27 62 151 0926',
  true, false, 'public_marketing', array['caption_footer']::text[],
  'Client explicitly supplied Alissa''s mobile number for Peyper Bonds marketing information and requested that her details be included; reconfirmed from WhatsApp evidence on 2026-09-21.',
  'Client WhatsApp instruction dated 2026-09-09; screenshot reconfirmed 2026-09-21.',
  '2026-09-21T14:39:00Z', '2026-09-21T14:39:00Z',
  'current_verified', 'active', array[]::text[], array['caption']::text[], 65
where not exists (
  select 1
  from public.client_contacts
  where client_id = 'a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b'
    and lower(coalesce(person_name, '')) = 'alissa'
    and contact_type = 'phone'
    and regexp_replace(value, '[^0-9]', '', 'g') in ('27621510926', '0621510926')
    and lifecycle_state = 'active'
);

update public.client_contact_footer_policies
set last_verified_at = '2026-09-21T14:39:00Z',
    review_state = 'current_verified',
    provenance_summary = 'Peyper Bonds uses a multi-person consultant contact block. Client reconfirmed on 2026-09-21 that Alissa must be included, with alissa@peyperbonds.co.za and +27 62 151 0926. Keep all current approved contacts in footer_order; do not drop a consultant merely because another contact has the same contact type.'
where client_id = 'a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b'
  and scope_key is null
  and content_mode = 'caption'
  and platform is null;
