-- Canonical caption contact/footer backfill for SecuriForce. #294 / #325.
-- CA-approved 2026-09-10 from published-caption evidence.
--
-- Evidence: the same footer pair appears verbatim at the end of multiple SecuriForce posts
-- published by the client's own marketing group over several weeks (positive-arrest post,
-- community post, office-prank post). Two independent values, consistently paired:
--     phone  051 101 1601
--     email  sarita@securiforce.co.za
-- These are the client's PUBLIC marketing contacts, already published by the client on its
-- own channels. No private, internal-only or unpublished value is introduced here.
--
-- Footer requirement is `mandatory`: every reviewed published caption carries this block,
-- so a caption produced without it would not match the client's established output.
--
-- Idempotent (`on conflict do nothing`), additive, exact-id resolved with a count=1 guard.
-- No other client is touched. Prepared only - do not apply without explicit CA approval.

begin;

do $$
declare
  v_client_id uuid;
  v_count integer;
begin
  select count(*), (array_agg(id))[1] into v_count, v_client_id
    from public.clients where name = 'SecuriForce';
  if v_count <> 1 then
    raise exception 'Expected exactly one SecuriForce client, found %', v_count;
  end if;

  insert into public.client_contacts
    (client_id, scope_key, contact_type, display_label, value,
     approved_for_caption, blocks_caption, visibility, allowed_purposes,
     provenance_summary, source_reference, observed_at, last_verified_at,
     freshness_state, lifecycle_state, platforms, content_modes, footer_order)
  values
    (v_client_id, null, 'phone', 'Caption footer phone', '051 101 1601',
     true, false, 'public_marketing', array['caption_footer'],
     'Published by the client in its own marketing channel; identical value repeated across multiple reviewed SecuriForce posts.',
     'client-published caption footer (multiple posts, Aug-Sep 2026)',
     '2026-09-10', '2026-09-10',
     'current_verified', 'active', '{}', array['caption'], 10),

    (v_client_id, null, 'email', 'Caption footer email', 'sarita@securiforce.co.za',
     true, false, 'public_marketing', array['caption_footer'],
     'Published by the client in its own marketing channel; identical value repeated across multiple reviewed SecuriForce posts.',
     'client-published caption footer (multiple posts, Aug-Sep 2026)',
     '2026-09-10', '2026-09-10',
     'current_verified', 'active', '{}', array['caption'], 20)
  on conflict do nothing;

  insert into public.client_contact_footer_policies
    (client_id, scope_key, content_mode, platform, requirement,
     format_template, review_state, provenance_summary, last_verified_at)
  values
    (v_client_id, null, 'caption', null, 'mandatory',
     '{phone}' || chr(10) || '{email}', 'current_verified',
     'Every reviewed published SecuriForce caption ends with the phone and email on consecutive lines, in that order.',
     '2026-09-10')
  on conflict do nothing;
end $$;

commit;
