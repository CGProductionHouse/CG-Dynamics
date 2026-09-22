-- Issue #463: admit only the two system-owned Autopilot job types while
-- preserving the existing durable queue allowlist. Keep the constraint NOT
-- VALID to match its current production semantics: existing rows are not
-- rescanned, while every new or updated row is checked immediately.
begin;

alter table public.background_jobs
  drop constraint background_jobs_allowed_type;

alter table public.background_jobs
  add constraint background_jobs_allowed_type
  check (
    job_type in (
      'meta_sync',
      'report_prep',
      'monthly_strategy_autopilot',
      'content_autopilot'
    )
  ) not valid;

commit;
