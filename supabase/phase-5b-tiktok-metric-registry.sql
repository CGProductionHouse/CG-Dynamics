-- ============================================================
-- CG Dynamics — Phase 5b TikTok metric registry seed
--
-- Seeds canonical TikTok metric definitions into metric_registry.
-- All metrics use TikTok's native names and definitions.
-- No metrics are invented; only officially documented metrics.
--
-- TikTok Display API provides:
--   view_count, like_count, comment_count, share_count
--   + profile: follower_count, following_count, likes_count, video_count
--
-- Applies cleanly on re-run via ON CONFLICT.
-- ============================================================

-- ── TikTok organic video metrics (from Display API) ────────
insert into public.metric_registry
  (metric_key, platform, source_metric, display_label, definition, aggregation, includes_paid, client_safe, cross_platform_additive, comparable_group, status, notes)
values
  -- view_count: total video plays (TikTok's native "views")
  ('views', 'tiktok', 'view_count', 'Views',
   'Total number of times the video has been played. TikTok native view_count — includes replays and auto-plays. Equivalent to "plays" on TikTok.',
   'sum', 'both', true, false, null, 'active',
   'TikTok view_count from Display API /v2/video/list/ and /v2/video/query/. Point-in-time snapshot per poll; not additive across providers.'),

  -- like_count: likes on videos
  ('likes', 'tiktok', 'like_count', 'Likes',
   'Total number of likes on the video. TikTok native like_count.',
   'sum', 'organic', true, false, null, 'active',
   'TikTok like_count from Display API. Point-in-time snapshot per poll; not additive across providers.'),

  -- comment_count: comments on videos
  ('comments', 'tiktok', 'comment_count', 'Comments',
   'Total number of comments on the video. TikTok native comment_count.',
   'sum', 'organic', true, false, null, 'active',
   'TikTok comment_count from Display API. Point-in-time snapshot per poll; not additive across providers.'),

  -- share_count: shares of videos
  ('shares', 'tiktok', 'share_count', 'Shares',
   'Total number of times the video has been shared. TikTok native share_count.',
   'sum', 'organic', true, false, null, 'active',
   'TikTok share_count from Display API. Point-in-time snapshot per poll; not additive across providers.'),

  -- current_followers: follower count snapshot
  ('current_followers', 'tiktok', 'follower_count', 'Current followers',
   'Total follower count at time of sync. Point-in-time snapshot — not delta/new follows.',
   'snapshot', 'organic', true, false, null, 'active',
   'TikTok follower_count from Display API /v2/user/info/. Snapshot only; not additive across providers.'),

  -- following_count: following count snapshot
  ('following_count', 'tiktok', 'following_count', 'Following',
   'Number of accounts the TikTok user is following. Point-in-time snapshot.',
   'snapshot', 'organic', true, false, 'following_count', 'active',
   'TikTok following_count from Display API /v2/user/info/. Not additive across platforms.'),

  -- total_likes: lifetime likes on all videos
  ('total_likes', 'tiktok', 'likes_count', 'Total likes',
   'Cumulative likes across all videos on the account. Point-in-time snapshot.',
   'snapshot', 'organic', true, false, 'total_likes', 'active',
   'TikTok likes_count from Display API /v2/user/info/. Not additive across platforms.'),

  -- video_count: total videos on account
  ('video_count', 'tiktok', 'video_count', 'Videos',
   'Total number of videos on the account. Point-in-time snapshot.',
   'snapshot', 'organic', true, false, 'video_count', 'active',
   'TikTok video_count from Display API /v2/user/info/. Not additive across platforms.')

on conflict (platform, metric_key, source_metric) do update set
  display_label = excluded.display_label,
  definition = excluded.definition,
  aggregation = excluded.aggregation,
  includes_paid = excluded.includes_paid,
  client_safe = excluded.client_safe,
  cross_platform_additive = excluded.cross_platform_additive,
  comparable_group = excluded.comparable_group,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();
