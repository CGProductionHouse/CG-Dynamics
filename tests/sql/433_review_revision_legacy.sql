insert into public.marketing_library_sources(id,source_type,source_name,trust_tier)
 values('30000000-0000-4000-8000-000000000001','book','Synthetic source','tier_1_primary');
insert into public.skill_cards(id,slug,title,category,knowledge_layer,source_id,source_type,principle,summary,relevant_agents)
 values('40000000-0000-4000-8000-000000000001','fixture','Fixture','Marketing Library','universal_principle',
 '30000000-0000-4000-8000-000000000001','book','Original','Summary','["creative_director"]');
insert into public.skill_card_reviews(skill_card_id,review_status,review_notes)
 values('40000000-0000-4000-8000-000000000001','approved','Old approval');
update public.skill_cards set status='active',last_reviewed=current_date;
