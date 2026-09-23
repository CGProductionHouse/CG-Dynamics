-- #451 protected activation migration.
-- Narrow service-role entrypoint for scheduled Microsoft reconciliation plus
-- durable, bounded automatic source-recovery state.
--
-- DO NOT APPLY IN PRODUCTION WITHOUT CA APPROVAL AT THE #451 ACTIVATION GATE.

alter table public.microsoft_sync_jobs
  add column if not exists automatic_retry_count integer not null default 0 check (automatic_retry_count between 0 and 3),
  add column if not exists automatic_retry_after timestamptz,
  add column if not exists automatic_failure text;

alter table public.microsoft_sync_runs
  add column if not exists automatic_recovery_count integer not null default 0 check (automatic_recovery_count between 0 and 3),
  add column if not exists automatic_recovery_after timestamptz;

create unique index if not exists microsoft_sync_runs_one_automatic_per_preview_idx
  on public.microsoft_sync_runs (preview_job_id)
  where preview_job_id is not null and trigger_type = 'agent';

create or replace function public.claim_microsoft_automatic_apply_recovery(p_run_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.microsoft_sync_runs set
    automatic_recovery_count = automatic_recovery_count + 1,
    automatic_recovery_after = now() + interval '10 minutes'
  where id = p_run_id and trigger_type = 'agent' and status = 'applying'
    and automatic_recovery_count < 3
    and started_at <= now() - interval '10 minutes'
    and (automatic_recovery_after is null or automatic_recovery_after <= now());
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_microsoft_automatic_apply_recovery(uuid) from public, anon, authenticated;
grant execute on function public.claim_microsoft_automatic_apply_recovery(uuid) to service_role;

create or replace function public.apply_microsoft_sync_item_automatic(
  p_system_user_id uuid, p_run_id uuid, p_item_key text, p_destination text,
  p_destination_id uuid, p_expected_updated_at timestamptz, p_action text,
  p_should_apply boolean, p_patch jsonb, p_source_type text,
  p_source_container_id text, p_source_item_id text, p_source_name text,
  p_source_complete boolean, p_details jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if not exists (select 1 from public.profiles where id = p_system_user_id and role = 'admin') then
    raise exception 'Configured Microsoft system admin is invalid';
  end if;
  perform set_config('request.jwt.claim.sub', p_system_user_id::text, true);
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text || ':' || p_item_key, 451));
  return public.apply_microsoft_sync_item(
    p_run_id, p_item_key, p_destination, p_destination_id, p_expected_updated_at,
    p_action, p_should_apply, p_patch, p_source_type, p_source_container_id,
    p_source_item_id, p_source_name, p_source_complete, p_details
  );
end;
$$;

revoke all on function public.apply_microsoft_sync_item_automatic(uuid,uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.apply_microsoft_sync_item_automatic(uuid,uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) to service_role;
