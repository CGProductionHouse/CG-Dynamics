-- ============================================================================
-- phase-25c — Social platform surfaces (AI Workforce social master)
--
-- Factual surfaces per priority platform with user intent and organic/paid type.
-- These are structural facts (which surfaces exist and what users do there), not
-- algorithm rules. Idempotent by (platform, surface_key). Additive.
-- ============================================================================

insert into public.platform_surfaces (platform_expert_id, surface_key, name, user_intent, surface_type)
select p.id, v.surface_key, v.name, v.user_intent, v.surface_type
from (values
  -- Instagram
  ('instagram', 'feed', 'Feed', 'Browse and catch up on followed and recommended accounts', 'shared'),
  ('instagram', 'reels', 'Reels', 'Lean-back short-form video discovery and entertainment', 'shared'),
  ('instagram', 'stories', 'Stories', 'Ephemeral, in-the-moment updates and connection', 'shared'),
  ('instagram', 'explore-search', 'Explore & Search', 'Active discovery of new content and topics', 'shared'),
  ('instagram', 'profile', 'Profile', 'Brand hub; validation and deeper look after discovery', 'organic'),
  -- Facebook
  ('facebook', 'feed', 'Feed', 'Browse updates from friends, groups, followed Pages and recommendations', 'shared'),
  ('facebook', 'reels', 'Reels', 'Short-form video discovery', 'shared'),
  ('facebook', 'stories', 'Stories', 'Ephemeral updates', 'shared'),
  ('facebook', 'groups', 'Groups', 'Community participation and niche discussion', 'organic'),
  ('facebook', 'video', 'Video / Watch', 'Longer video viewing and discovery', 'shared'),
  ('facebook', 'page', 'Page', 'Brand hub, contact and validation', 'organic'),
  -- TikTok
  ('tiktok', 'for-you', 'For You feed', 'Lean-back algorithmic short-form discovery', 'shared'),
  ('tiktok', 'search', 'Search', 'Active discovery and how-to / product research', 'shared'),
  ('tiktok', 'profile', 'Profile', 'Creator/brand hub after discovery', 'organic'),
  ('tiktok', 'live', 'LIVE', 'Real-time engagement and community', 'organic'),
  -- YouTube
  ('youtube', 'shorts', 'Shorts', 'Lean-back short-form vertical discovery', 'shared'),
  ('youtube', 'watch-long', 'Long-form (Watch)', 'Intent-led and lean-back longer viewing', 'shared'),
  ('youtube', 'search', 'Search', 'Active intent: how-to, reviews, research', 'shared'),
  ('youtube', 'home', 'Home & Recommendations', 'Personalised discovery', 'shared'),
  ('youtube', 'community', 'Community', 'Channel engagement between videos', 'organic'),
  -- LinkedIn
  ('linkedin', 'feed', 'Feed', 'Professional browsing, industry updates and networking', 'shared'),
  ('linkedin', 'company-page', 'Company Page', 'Brand credibility hub for B2B', 'organic'),
  ('linkedin', 'documents-carousels', 'Documents / Carousels', 'Educational, saveable depth content', 'organic'),
  ('linkedin', 'video', 'Video', 'Thought leadership and demonstration', 'shared'),
  ('linkedin', 'newsletter', 'Newsletter', 'Subscribed long-form thought leadership', 'organic')
) as v(platform_slug, surface_key, name, user_intent, surface_type)
join public.platform_experts p on p.slug = v.platform_slug
on conflict (platform_expert_id, surface_key) do nothing;
