-- ============================================================================
-- phase-25d — Social platform knowledge items (AI Workforce social master)
--
-- Source-backed platform knowledge. EVERY item is seeded knowledge_state =
-- 'experimental', so it is NOT visible to staff or skilled agents until an admin
-- verifies and promotes it (mirrors the Skill Card review gate). Nothing here is
-- an invented algorithm rule; metric definitions are the OFFICIAL definitions
-- restated with a citation, and creative items are official best-practice with
-- limitations. researched_at + last_verified_at = today; a change-log 'created'
-- row records provenance. Idempotent by (platform, title). Additive.
-- ============================================================================

insert into public.platform_knowledge_items
  (platform_expert_id, surface_id, source_id, title, principle, application, limitations,
   knowledge_state, confidence, territory, researched_at, last_verified_at,
   channel, evidence_strength, is_metric_definition, notes)
select p.id, s.id, src.id, v.title, v.principle, v.application, v.limitations,
   'experimental', v.confidence, v.territory, current_date, current_date,
   v.channel, v.evidence_strength, v.is_metric_def,
   'Seeded phase-25d from official source; experimental pending admin verification.'
from (values
  -- ── YouTube metric definitions (official) ──────────────────────────────────
  ('youtube','watch-long','https://support.google.com/youtube/answer/9314486',
   'Watch time (YouTube)', 'Watch time is the total amount of time viewers have watched your video, per YouTube Help.',
   'Use watch time (not just views) to judge long-form performance and retention.',
   'Official definition; YouTube updates analytics — re-verify against the source.',
   'high', null, 'both', 'strong', true),
  ('youtube','watch-long','https://support.google.com/youtube/answer/9314486',
   'Impressions click-through rate (YouTube)', 'CTR is how often viewers watched a video after seeing its thumbnail, per YouTube Help.',
   'Read thumbnail/title effectiveness via CTR alongside watch time.',
   'CTR alone is not success; pair with watch time. Definition may change.',
   'high', null, 'both', 'strong', true),
  ('youtube','shorts','https://support.google.com/youtube/answer/9314486',
   'Shorts views are counted differently (YouTube)', 'YouTube counts organic Shorts views and ad views with methods that differ from long-form, per YouTube Help.',
   'Do not compare Shorts view counts directly with long-form view counts.',
   'Exact counting method evolves; re-verify before reporting.',
   'medium', null, 'both', 'strong', true),
  -- ── Platform-native creative facts (official best-practice) ────────────────
  ('youtube','shorts','https://www.youtube.com/creators/',
   'Shorts are vertical short-form video', 'YouTube Shorts is a vertical, short-form video surface for discovery.',
   'Produce vertical (9:16) short-form for the Shorts surface.',
   'Maximum length has changed over time; verify the current Shorts length limit.',
   'medium', null, 'organic', 'moderate', false),
  ('tiktok','for-you','https://ads.tiktok.com/business/creativecenter',
   'TikTok Creative Center: research real top ads and trends', 'TikTok Creative Center surfaces high-performing auction ads and trend data for creative research.',
   'Use Creative Center to study real, current top-performing formats before ideating.',
   'Shows auction ads, not a guaranteed formula; interpret, do not copy restricted creative.',
   'high', null, 'both', 'strong', false),
  ('tiktok','for-you','https://ads.tiktok.com/business/creativecenter',
   'TikTok is sound-on, full-screen vertical', 'TikTok is a sound-on, full-screen vertical video environment.',
   'Design for sound-on, native, vertical delivery; hook fast.',
   'Creative best-practice, not a reach guarantee; test per client.',
   'medium', null, 'both', 'moderate', false),
  ('tiktok','search','https://support.tiktok.com/',
   'TikTok Search is a discovery surface', 'Users search TikTok for how-to, product and topic content, making search a discovery path.',
   'Make content discoverable with clear spoken/on-screen topics and relevant terms.',
   'Search behaviour varies; not an SEO guarantee. Avoid hashtag superstition.',
   'medium', null, 'organic', 'moderate', false),
  ('instagram','reels','https://help.instagram.com/',
   'Reels are short-form vertical video for discovery', 'Instagram Reels is a short-form vertical video surface used for discovery beyond existing followers.',
   'Use Reels for reach/discovery with native vertical short-form.',
   'Creative fact; distribution mechanics change. Re-verify features.',
   'medium', null, 'both', 'moderate', false),
  ('instagram','feed','https://help.instagram.com/',
   'Carousels add depth and saveability', 'Instagram carousels are multi-image/video posts used for storytelling and educational depth.',
   'Use carousels when a single frame cannot carry the message.',
   'Format fact, not a guaranteed-engagement rule.',
   'medium', null, 'organic', 'moderate', false),
  ('instagram','stories','https://help.instagram.com/',
   'Stories are ephemeral full-screen updates', 'Instagram Stories are full-screen, time-limited content for in-the-moment connection.',
   'Use Stories for timely updates, polls and behind-the-scenes.',
   'Ephemeral by design; not for evergreen reach.',
   'medium', null, 'organic', 'moderate', false),
  ('facebook','feed','https://www.facebook.com/ads/library/',
   'Meta Ad Library shows active ads (transparency)', 'The Meta Ad Library lets you view ads currently running across Meta for transparency and competitive research.',
   'Study real competitor/industry ad structure; never copy restricted creative.',
   'Access is browser/login-gated; do not mirror restricted creative.',
   'high', null, 'both', 'strong', false),
  ('facebook','feed','https://www.facebook.com/business/help',
   'Organic and paid reach are distinct', 'Paid reach uses ad delivery and targeting; organic reach depends on non-paid distribution — they must be planned and reported separately.',
   'Keep organic and paid strategy, testing and reporting distinct.',
   'Reach mechanics change; re-verify. Not a causal performance promise.',
   'medium', null, 'both', 'moderate', false),
  ('linkedin','documents-carousels','https://www.linkedin.com/help/lms',
   'LinkedIn document (carousel) posts', 'Document posts render as swipeable carousels and suit educational, saveable B2B depth content.',
   'Use document posts for frameworks, checklists and how-to depth.',
   'Format fact; not a guaranteed-reach rule.',
   'medium', null, 'organic', 'moderate', false),
  ('linkedin','feed','https://business.linkedin.com/marketing-solutions',
   'LinkedIn is a professional / B2B context', 'LinkedIn content skews toward professional value, credibility and B2B relationships.',
   'Lead with industry insight and proof, not consumer-style hype.',
   'Audience varies by sector; validate per client.',
   'medium', null, 'both', 'moderate', false),
  ('linkedin','feed','https://www.linkedin.com/ad-library/',
   'LinkedIn Ad Library (transparency)', 'The LinkedIn Ad Library provides transparency into ads for competitive research.',
   'Research real B2B ad structure; do not mirror restricted creative.',
   'Do not mirror restricted creative.',
   'high', null, 'both', 'strong', false),
  ('instagram','reels','https://www.facebook.com/business/help/ads-guide',
   'Captions/subtitles support sound-off viewing', 'Many users watch video without sound; captions/subtitles support comprehension and accessibility.',
   'Add on-screen captions/subtitles to social video by default.',
   'Best-practice for comprehension/accessibility, not a guaranteed metric lift.',
   'medium', 'ZA', 'both', 'moderate', false)
) as v(platform_slug, surface_key, source_url, title, principle, application, limitations,
   confidence, territory, channel, evidence_strength, is_metric_def)
join public.platform_experts p on p.slug = v.platform_slug
left join public.platform_surfaces s on s.platform_expert_id = p.id and s.surface_key = v.surface_key
left join public.marketing_library_sources src on src.canonical_url = v.source_url
where not exists (
  select 1 from public.platform_knowledge_items k where k.platform_expert_id = p.id and k.title = v.title
);

-- Provenance: a 'created' change-log row per seeded item that lacks one.
insert into public.platform_knowledge_change_log (knowledge_item_id, change_type, new_state, note)
select k.id, 'created', 'experimental', 'Seeded from official source (phase-25d). Awaiting admin verification before staff/agent use.'
from public.platform_knowledge_items k
where k.notes = 'Seeded phase-25d from official source; experimental pending admin verification.'
  and not exists (
    select 1 from public.platform_knowledge_change_log c
    where c.knowledge_item_id = k.id and c.change_type = 'created'
  );
