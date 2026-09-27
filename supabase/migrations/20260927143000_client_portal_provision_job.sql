-- Issue #548: admit only the protected client portal provisioning job to
-- the existing durable background queue. The authenticated manager enqueue RPC
-- remains unchanged; this type is system-owned and used only by the reviewed
-- exact nine-client activation batch.
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
      'tiktok_analytics_refresh',
      'client_portal_provision'
    )
  ) not valid;

commit;
