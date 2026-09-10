-- Deterministic public contact/footer backfill for WiseRide as its OWN canonical client.
-- #248/#294. Source: repo intelligence WISERIDE-CLIENT-INTELLIGENCE-2026-09.md (Issue #258),
-- which records the read-only-verified live Dynamics row on 2026-09-08.
-- No private-only values embedded. Production application remains approval-gated.
--
-- IDENTITY SAFETY: WiseRide is a separate marketing identity from the Wiseman Group billing
-- umbrella. The live DB has a distinct Wiseman Group row. This migration resolves ONLY the
-- proven WiseRide UUID + exact name with a count=1 guard and NEVER fuzzy-maps to Wiseman Group,
-- Wiseman Midas, Supa Quick BFN/Centurion or any other Wiseman-owned automotive business.
--
-- GENUINE UNRESOLVED CONFLICT preserved for CA (not guessed): the default physical address,
-- phone and email are materially conflicted between the client Project/recent-CG footer set
-- and the current official Wiseman Group contact page. Every conflicted value is stored
-- `possible_change` and NOT approved for caption, so the runtime holds them and reverifies
-- rather than silently choosing one set. Only the website is current_verified and mandatory.

begin;

do $$
declare
  v_wiseride_id constant uuid := '504113ee-fba9-4993-807e-a86066615212';
  v_count integer;
begin
  select count(*) into v_count
    from public.clients
    where id = v_wiseride_id and name = 'WiseRide';
  if v_count <> 1 then
    raise exception 'Expected exact WiseRide client 504113ee-fba9-4993-807e-a86066615212, found % matching rows', v_count;
  end if;

  insert into public.client_contacts
    (client_id,scope_key,contact_type,display_label,value,approved_for_caption,blocks_caption,visibility,
     allowed_purposes,provenance_summary,source_reference,observed_at,last_verified_at,
     freshness_state,lifecycle_state,platforms,content_modes,footer_order)
  values
    -- ── Only current_verified, caption-safe contact: mandatory general-post website ──────
    (v_wiseride_id,null,'website','General-post website (mandatory)','wisemangroup.co.za',true,false,'public_marketing',
     array['caption_footer'],'Durable Project rule + recent CG captions + current official page all agree; never swap for the Auto Armor national site',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#website',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],10),

    -- ── Conflicted default contacts — Project / recent-CG footer set (held possible_change) ──
    (v_wiseride_id,null,'address','Project/recent-CG address (conflicted)','80 Nelson Mandela Street, Bloemfontein',false,false,'public_marketing',
     array['caption_footer'],'Project business-info + recent CG captions; conflicts with official Wiseman page (88 Nelson Mandela Dr)',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-project-recent-cg-social-footer-set',
     '2026-09-08',null,'possible_change','active','{}',array['caption'],101),
    (v_wiseride_id,null,'phone','Project/recent-CG phone (conflicted)','073 340 5302',false,false,'public_marketing',
     array['caption_footer'],'Project business-info + recent CG captions (corroborated as a Bloemfontein fitment-centre route); conflicts with official 051 1011 600',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-project-recent-cg-social-footer-set',
     '2026-09-08',null,'possible_change','active','{}',array['caption'],102),
    (v_wiseride_id,null,'email','Project marketing email (conflicted)','sonja@wisemangroup.co.za',false,false,'public_marketing',
     array['caption_footer'],'Project business-info + recent CG captions; conflicts with official info@wisemangroup.co.za',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-project-recent-cg-social-footer-set',
     '2026-09-08',null,'possible_change','active','{}',array['caption'],103),
    (v_wiseride_id,null,'email','Project general-enquiries email (conflicted)','wiseride@wisemangroup.co.za',false,false,'public_marketing',
     array['caption_footer'],'General-enquiries address in Project business-information source; not independently reverified',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-project-recent-cg-social-footer-set',
     '2026-09-08',null,'possible_change','active','{}',array['caption'],104),

    -- ── Conflicted default contacts — current official Wiseman Group contact page (held possible_change) ──
    (v_wiseride_id,null,'address','Official Wiseman page address (conflicted)','88 Nelson Mandela Dr, Bloemfontein Central, Bloemfontein, 9323',false,false,'public_marketing',
     array['caption_footer'],'Current official Wiseman Group contact page observed 2026-09-08; conflicts with Project 80 Nelson Mandela Street',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-official-wiseman-website-set-conflict',
     '2026-09-08','2026-09-08','possible_change','active','{}',array['caption'],111),
    (v_wiseride_id,null,'phone','Official Wiseman page phone (conflicted)','051 1011 600',false,false,'public_marketing',
     array['caption_footer'],'Current official Wiseman Group contact page observed 2026-09-08; conflicts with Project 073 340 5302',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-official-wiseman-website-set-conflict',
     '2026-09-08','2026-09-08','possible_change','active','{}',array['caption'],112),
    (v_wiseride_id,null,'email','Official Wiseman page email (conflicted)','info@wisemangroup.co.za',false,false,'public_marketing',
     array['caption_footer'],'Current official Wiseman Group contact page observed 2026-09-08; conflicts with Project sonja@/wiseride@',
     'repo:WISERIDE-CLIENT-INTELLIGENCE-2026-09.md#current-official-wiseman-website-set-conflict',
     '2026-09-08','2026-09-08','possible_change','active','{}',array['caption'],113)
  on conflict do nothing;

  -- ── Footer policy: website mandatory for general posts; every other contact held ─────
  -- The address/phone/email lines are intentionally kept OUT of the current template until
  -- the Nelson Mandela contact conflict is resolved. Branch-mode question (Nelson Mandela vs
  -- Langenhoven Park as one or two footer patterns) is also unresolved — no branch scope is
  -- fabricated here.
  insert into public.client_contact_footer_policies
    (client_id,scope_key,content_mode,platform,requirement,format_template,review_state,provenance_summary,last_verified_at)
  values
    (v_wiseride_id,null,'caption',null,'mandatory','{website}','current_verified',
     'Website (wisemangroup.co.za) mandatory for general WiseRide posts; address/phone/email held pending conflict resolution and per-task reverification','2026-09-08')
  on conflict do nothing;
end $$;

commit;
