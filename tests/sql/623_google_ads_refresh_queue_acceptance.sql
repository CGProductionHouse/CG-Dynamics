-- Run after the actual migration in a disposable PostgreSQL fixture whose
-- background_jobs table has the previous allowed-type constraint and grants.
do $$
declare item text;
begin
  foreach item in array array['meta_sync','report_prep','web_push_delivery',
    'monthly_strategy_autopilot','content_autopilot','tiktok_analytics_refresh',
    'client_portal_provision','google_ads_refresh'] loop
    insert into public.background_jobs(job_type) values (item);
  end loop;
  begin
    insert into public.background_jobs(job_type) values ('unreviewed_provider_write');
    raise exception 'Unexpected job type accepted';
  exception when check_violation then null;
  end;
  if has_table_privilege('authenticated', 'public.background_jobs', 'INSERT') or
     has_table_privilege('anon', 'public.background_jobs', 'INSERT') then
    raise exception 'Browser insertion authority expanded';
  end if;
  if not has_table_privilege('service_role', 'public.background_jobs', 'INSERT') then
    raise exception 'Existing system queue authority was lost';
  end if;
end;
$$;
