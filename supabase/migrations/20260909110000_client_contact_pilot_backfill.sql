-- Deterministic public/contact-policy backfill for the three #241 pilot clients.
-- Sources are public repo intelligence already reviewed on 2026-09-08.
-- No private-only values are embedded here. Production application remains approval-gated.
begin;

do $$
declare
  v_cape_id uuid;
  v_action_id uuid;
  v_dulux_id uuid;
  v_count integer;
  v_cape_email_id uuid;
begin
  select count(*), (array_agg(id))[1] into v_count, v_cape_id from public.clients where name = 'Cape Lumber';
  if v_count <> 1 then raise exception 'Expected exactly one Cape Lumber client, found %', v_count; end if;

  select count(*), (array_agg(id))[1] into v_count, v_action_id from public.clients where name = 'Action Sport';
  if v_count <> 1 then raise exception 'Expected exactly one Action Sport client, found %', v_count; end if;

  select count(*), (array_agg(id))[1] into v_count, v_dulux_id from public.clients where name = 'Dulux Bloemfontein';
  if v_count <> 1 then raise exception 'Expected exactly one Dulux Bloemfontein client, found %', v_count; end if;

  insert into public.client_contacts
    (client_id,contact_type,display_label,value,approved_for_caption,blocks_caption,visibility,
     allowed_purposes,provenance_summary,source_reference,observed_at,last_verified_at,
     freshness_state,lifecycle_state,platforms,content_modes,footer_order)
  values
    (v_cape_id,'email','Marketing email','info@capelumbermarketing.co.za',true,false,'public_marketing',
     array['caption_footer','quote'],'Client-confirmed + CG-confirmed + public verified',
     'repo:CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md#current-contact-and-location-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],10),
    (v_cape_id,'phone','Marketing phone','+27 71 353 4261',true,false,'public_marketing',
     array['caption_footer','quote'],'Client-confirmed + CG-confirmed + public verified',
     'repo:CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md#current-contact-and-location-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],20),
    (v_cape_id,'phone','Office landline','+27 (0) 21 879 5042',false,false,'public_marketing',
     array['office_contact'],'Official website',
     'repo:CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md#website-office-landline',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['factual_lookup'],100),
    (v_cape_id,'address','Office only','8 Richard Road, Sunnydale, Noordhoek, Western Cape, 7975',false,false,'public_marketing',
     array['office_contact'],'Official website; office-only wording retained',
     'repo:CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md#address',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['factual_lookup'],110),

    (v_action_id,'website','Website','https://www.bloemactionsports.co.za/',true,false,'public_marketing',
     array['caption_footer','booking'],'Public verified + client confirmed',
     'repo:BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md#current-contact-and-location-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],10),
    (v_action_id,'email','Bookings email','stella@actionsports.co.za',true,false,'public_marketing',
     array['caption_footer','booking'],'Client-confirmed + CG-confirmed',
     'repo:BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md#stella-vs-public-venue-contact',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],20),
    (v_action_id,'phone','Bookings phone','+27 82 307 6257',true,false,'public_marketing',
     array['caption_footer','booking'],'Client-confirmed + CG-confirmed',
     'repo:BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md#stella-vs-public-venue-contact',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],30),
    (v_action_id,'phone','Venue / event-day phone','+27 82 499 0072',true,false,'public_marketing',
     array['event_day','venue_assistance'],'Public verified + client confirmed',
     'repo:BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md#standing-cg-contact-footer',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['event_caption'],40),
    (v_action_id,'address','Formal street address','Bloemfontein Show Grounds, 32 Curie Avenue, Hospitaalpark, Bloemfontein, 9301',false,false,'public_marketing',
     array['location'],'Public verified',
     'repo:BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md#current-contact-and-location-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['factual_lookup'],100),

    (v_dulux_id,'address','Store address','20 2nd Ave, Westdene, Bloemfontein, 9301',true,false,'public_marketing',
     array['caption_footer','store_visit'],'Client-confirmed + public corroboration',
     'repo:DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md#current-contact-and-operational-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],10),
    (v_dulux_id,'phone','Store phone','051 430 3699',true,false,'public_marketing',
     array['caption_footer','store_enquiry'],'Client-confirmed + public corroboration',
     'repo:DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md#current-contact-and-operational-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],20),
    (v_dulux_id,'website','National Dulux website','https://www.dulux.co.za/en',true,false,'public_marketing',
     array['caption_footer','product_information'],'Client-confirmed + official national website',
     'repo:DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md#current-contact-and-operational-truth',
     '2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],30),
    (v_dulux_id,'whatsapp','Historical WhatsApp awaiting confirmation','+27 82 305 7371',false,false,'unverified_hold',
     array['historical_audit'],'Historical CG content only; current confirmation not recovered',
     'repo:DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md#current-contact-and-operational-truth',
     '2026-09-08',null,'stale_unverified','active','{}',array['internal_audit'],100)
  on conflict do nothing;

  select id into v_cape_email_id from public.client_contacts
   where client_id = v_cape_id and scope_key is null and contact_type = 'email'
     and value = 'info@capelumbermarketing.co.za';
  insert into public.client_contacts
    (client_id,contact_type,display_label,value,approved_for_caption,blocks_caption,visibility,
     allowed_purposes,provenance_summary,source_reference,observed_at,last_verified_at,
     freshness_state,lifecycle_state,superseded_by_contact_id,platforms,content_modes,footer_order)
  values
    (v_cape_id,'email','Historical marketing email','info@capelumber.co.za',false,false,'unverified_hold',
     array['historical_audit'],'Older Project Instruction; rejected for current use by later CG/client/public evidence',
     'repo:CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md#primary-cg-marketing-email-resolved-by-later-cg-history',
     '2026-09-08',null,'historical','superseded',v_cape_email_id,'{}',array['internal_audit'],100)
  on conflict do nothing;

  insert into public.client_contact_footer_policies
    (client_id,content_mode,platform,requirement,format_template,review_state,provenance_summary,last_verified_at)
  values
    (v_cape_id,'caption',null,'mandatory','{email}\n{phone}\n\n{hashtags}','current_verified',
     'Recent CG-approved contact block: email, mobile, blank line, hashtags','2026-09-08'),
    (v_action_id,'caption',null,'mandatory','🌐 {website}\n📧 {email}\n📞 {phone}','current_verified',
     'Standing CG footer from reviewed Project history','2026-09-08'),
    (v_action_id,'event_caption',null,'mandatory','🌐 {website}\n📧 {email}\n📞 {phone}\n📞 {event_phone}','current_verified',
     'Event-day posts add the venue/general line','2026-09-08'),
    (v_dulux_id,'caption',null,'mandatory','{address}\n{phone}\n{website}','current_verified',
     'Stable default contact block; email and WhatsApp intentionally omitted pending confirmation','2026-09-08')
  on conflict do nothing;
end $$;

commit;
