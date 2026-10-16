-- #623: system-owned daily refresh in the existing durable queue.
-- No new cron, browser grant, activation flag or metrics write is installed here.
begin;
alter table public.background_jobs drop constraint background_jobs_allowed_type;
alter table public.background_jobs add constraint background_jobs_allowed_type
  check (job_type in (
    'meta_sync', 'report_prep', 'web_push_delivery', 'monthly_strategy_autopilot',
    'content_autopilot', 'tiktok_analytics_refresh', 'client_portal_provision',
    'google_ads_refresh'
  )) not valid;
-- enqueue_background_job remains restricted to its existing manager job types.
commit;
