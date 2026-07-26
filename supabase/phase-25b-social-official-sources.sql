-- ============================================================================
-- phase-25b — Official social-platform sources (AI Workforce social master)
--
-- Catalogs CURRENT official platform documentation, ad libraries and creative
-- centres as provenance for platform knowledge. All are official_reference /
-- metadata_and_link_only (cite + link; never mirrored). rights_checked_at is the
-- research date; each item's freshness is tracked per knowledge item that cites
-- it. Idempotent by canonical_url. Additive.
-- ============================================================================

insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, canonical_url,
   rights_status, rights_basis, access_mode, trust_tier, ingestion_status,
   rights_checked_at, rights_review_notes)
select * from (values
  -- Meta ecosystem
  ('official_documentation', 'Meta Business Help Center', 'Meta',
   'Meta Business Help Center', 'https://www.facebook.com/business/help',
   'official_reference', 'Official Meta documentation; copyrighted.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Ads, metric definitions, policy. Cite + link only. Re-verify per item.'),
  ('official_documentation', 'Meta Ad Library', 'Meta',
   'Meta Ad Library (transparency)', 'https://www.facebook.com/ads/library/',
   'official_reference', 'Official Meta transparency tool.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Browser/login-gated ad transparency. Reference for real ad structure; do not mirror restricted creative.'),
  ('official_documentation', 'Instagram Help Center', 'Meta / Instagram',
   'Instagram Help Center', 'https://help.instagram.com/',
   'official_reference', 'Official Instagram documentation; copyrighted.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Creator/insights/features. Cite + link only.'),
  ('official_documentation', 'Meta for Business — Reels & video', 'Meta',
   'Meta for Business creative guidance', 'https://www.facebook.com/business/help/ads-guide',
   'official_reference', 'Official Meta ad format guidance.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Ad formats and specs. Re-verify per item; specs change.'),
  -- TikTok
  ('official_documentation', 'TikTok Creative Center', 'TikTok',
   'TikTok Creative Center', 'https://ads.tiktok.com/business/creativecenter',
   'official_reference', 'Official TikTok creative/trends resource.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Top ads, trends, creative insight. Verified live 2026-07-25. Cite + link only.'),
  ('official_documentation', 'TikTok Business Help Center', 'TikTok',
   'TikTok Business Help Center', 'https://ads.tiktok.com/help/',
   'official_reference', 'Official TikTok Ads documentation.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Ads, metrics, policy. Cite + link only.'),
  ('official_documentation', 'TikTok Ad Library', 'TikTok',
   'TikTok Commercial Content / Ad Library', 'https://library.tiktok.com/ads',
   'official_reference', 'Official TikTok ad transparency.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Ad transparency. Do not mirror restricted creative.'),
  ('official_documentation', 'TikTok Support', 'TikTok',
   'TikTok Support (creator)', 'https://support.tiktok.com/',
   'official_reference', 'Official TikTok creator help.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Creator features, community, safety. Cite + link only.'),
  -- YouTube
  ('official_documentation', 'YouTube Help — metrics', 'Google / YouTube',
   'YouTube Help: analytics metric definitions', 'https://support.google.com/youtube/answer/9314486',
   'official_reference', 'Official YouTube metric definitions.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Impressions, CTR, views, watch time, unique viewers. Verified live 2026-07-25.'),
  ('official_documentation', 'YouTube Help Center', 'Google / YouTube',
   'YouTube Help Center', 'https://support.google.com/youtube',
   'official_reference', 'Official YouTube documentation.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Shorts, uploads, policy. Cite + link only.'),
  ('official_documentation', 'YouTube Creators', 'Google / YouTube',
   'YouTube Creators resources', 'https://www.youtube.com/creators/',
   'official_reference', 'Official YouTube creator resources.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Creator best-practice. Cite + link only.'),
  -- LinkedIn
  ('official_documentation', 'LinkedIn Marketing Solutions Help', 'LinkedIn / Microsoft',
   'LinkedIn Marketing Solutions Help', 'https://www.linkedin.com/help/lms',
   'official_reference', 'Official LinkedIn ads documentation.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Campaign types, metrics, policy. Cite + link only.'),
  ('official_documentation', 'LinkedIn Ad Library', 'LinkedIn / Microsoft',
   'LinkedIn Ad Library', 'https://www.linkedin.com/ad-library/',
   'official_reference', 'Official LinkedIn ad transparency.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'Ad transparency. Do not mirror restricted creative.'),
  ('official_documentation', 'LinkedIn Business — Marketing', 'LinkedIn / Microsoft',
   'LinkedIn Marketing Solutions', 'https://business.linkedin.com/marketing-solutions',
   'official_reference', 'Official LinkedIn marketing resources.', 'metadata_and_link_only',
   'tier_1_primary', 'catalogued', now(), 'B2B formats, best-practice. Cite + link only.')
) as v(source_type, source_name, author_or_organisation, title, canonical_url,
   rights_status, rights_basis, access_mode, trust_tier, ingestion_status,
   rights_checked_at, rights_review_notes)
where not exists (
  select 1 from public.marketing_library_sources s where s.canonical_url = v.canonical_url
);
