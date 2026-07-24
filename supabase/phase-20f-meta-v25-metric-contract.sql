-- ============================================================================
-- Phase 20f - Meta Graph v25 metric contract
--
-- Aligns the reporting registry with Meta's post-2025 Page media-view metrics
-- and the current Instagram follows/unfollows metric. This migration changes
-- metadata only; the connector remains responsible for writing monthly facts.
-- ============================================================================

begin;

update public.metric_registry
set
  source_metric = 'page_media_view',
  display_label = 'Facebook views',
  definition = 'Times Facebook content was played or displayed, including repeat views.',
  comparable_group = 'fb_media_views_v2',
  notes = 'Graph v25 replacement for deprecated page_impressions. Not comparable with legacy impression facts.',
  updated_at = now()
where platform = 'facebook'
  and metric_key = 'brand_views';

update public.metric_registry
set
  source_metric = 'page_total_media_view_unique',
  display_label = 'Facebook viewers',
  definition = 'Unique people who viewed Facebook Page media during the reporting period.',
  comparable_group = 'fb_media_viewers_v2',
  notes = 'Graph v25 replacement for deprecated page_impressions_unique. Never sum daily unique values.',
  updated_at = now()
where platform = 'facebook'
  and metric_key in ('unique_viewers', 'reach');

update public.metric_registry
set
  source_metric = 'page_daily_follows',
  display_label = 'Facebook follows gained',
  definition = 'New Facebook Page follows recorded during the reporting period.',
  comparable_group = 'fb_follows_gained_v2',
  notes = 'Current Page Insights follow movement metric.',
  updated_at = now()
where platform = 'facebook'
  and metric_key = 'follows_gained';

update public.metric_registry
set
  source_metric = 'follows_and_unfollows',
  display_label = 'Instagram follows gained',
  definition = 'Instagram follows during the reporting period, selected from the follow_type breakdown.',
  comparable_group = 'ig_follows_gained_v2',
  notes = 'Current Instagram account Insights metric; unfollows are not included in this fact.',
  updated_at = now()
where platform = 'instagram'
  and metric_key = 'follows_gained';

commit;
