-- Issue #238: admit the system-owned TikTok read-only analytics freshness job
-- to the existing durable queue. This does not schedule anything by itself and
-- is intentionally additive to the canonical queue/scheduler architecture.
begin;

alter table public.background_jobs
  drop constraint background_jobs_allowed_type;

alter table public.background_jobs
  add constraint background_jobs_allowed_type
  check (
    job_type in (
      'meta_sync',
      'report_prep',
      'web_push_delivery',
      'monthly_strategy_autopilot',
      'content_autopilot',
      'tiktok_analytics_refresh'
    )
  ) not valid;

commit;
