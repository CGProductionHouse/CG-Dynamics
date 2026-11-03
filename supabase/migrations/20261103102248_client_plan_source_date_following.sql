-- Opt-in following of already-shared Microsoft posting dates only.
-- No new calendar/task store, imports, inferred client IDs or status/publication writes.
alter table public.monthly_deliverables
  add column client_plan_follow_source boolean not null default false,
  add column client_plan_follow_source_at timestamptz,
  add column client_plan_follow_source_by uuid references public.profiles(id),
  add constraint monthly_deliverables_source_follow_audit check (
    (client_plan_follow_source_at is null) = (client_plan_follow_source_by is null)
    and (not client_plan_follow_source or (
      client_plan_follow_source_at is not null and client_plan_shared_at is not null
      and client_plan_shared_by_profile_id is not null
      and nullif(microsoft_plan_id,'') is not null
      and nullif(microsoft_task_id,'') is not null
      and nullif(microsoft_bucket_id,'') is not null))
  );

-- Private shared validator: known complete job, exact source identity, one task,
-- observed nullable business date. Missing/ambiguous/malformed is not unscheduling.
create function public.client_schedule_verified_source_date(p_job_id uuid,p_plan_id text,p_task_id text)
returns table(source_date date,bucket_id text,observed_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare v_job record; v_source record; v_record jsonb; v_matches bigint; v_text text;
begin
  select j.* into v_job from public.microsoft_sync_jobs j where j.id=p_job_id and j.status='complete';
  if not found or v_job.exported_at is null
    or v_job.exported_at < clock_timestamp()-interval '4 hours'
    or v_job.exported_at > clock_timestamp()+interval '5 minutes'
    or v_job.created_at < clock_timestamp()-interval '4 hours'
    or not exists(select 1 from public.profiles p where p.id=v_job.created_by and p.is_active and p.role in ('admin','manager')) then return; end if;
  select count(*) into v_matches from public.microsoft_sync_job_sources s
    where s.job_id=p_job_id and s.source_type='planner_plan' and s.source_id=p_plan_id;
  if v_matches<>1 then return; end if;
  select s.* into v_source from public.microsoft_sync_job_sources s
    where s.job_id=p_job_id and s.source_type='planner_plan' and s.source_id=p_plan_id;
  if not found or v_source.required is distinct from true or v_source.complete is distinct from true or v_source.stage is distinct from 'complete'
    or v_source.safe_error is not null or v_source.pagination_cursor is not null then return; end if;
  if jsonb_typeof(v_source.records) is distinct from 'array' then return; end if;
  if jsonb_array_length(v_source.records) is distinct from v_source.record_count then return; end if;
  select count(*), (jsonb_agg(r)->0) into v_matches,v_record
    from jsonb_array_elements(v_source.records) r where r->>'sourceTaskId'=p_task_id;
  if v_matches<>1 or jsonb_typeof(v_record->'sourceTaskId') is distinct from 'string'
    or jsonb_typeof(v_record->'sourcePlanId') is distinct from 'string'
    or jsonb_typeof(v_record->'sourceBucketId') is distinct from 'string'
    or v_record->>'sourceType' is distinct from 'planner_task'
    or v_record->>'sourcePlanId' is distinct from p_plan_id
    or nullif(v_record->>'sourceBucketId','') is null
    or not (v_record ? 'dueDate') then return; end if;
  if jsonb_typeof(v_record->'dueDate')='null' then source_date:=null;
  elsif jsonb_typeof(v_record->'dueDate')='string' then
    v_text:=v_record->>'dueDate';
    if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return; end if;
    begin source_date:=v_text::date;
    exception when invalid_datetime_format or datetime_field_overflow then return; end;
    if to_char(source_date,'YYYY-MM-DD')<>v_text then return; end if;
  else return; end if;
  bucket_id:=v_record->>'sourceBucketId'; observed_at:=v_job.exported_at;
  return next;
end;
$$;
alter function public.client_schedule_verified_source_date(uuid,text,text) owner to postgres;
revoke all on function public.client_schedule_verified_source_date(uuid,text,text)
  from public,anon,authenticated,service_role;

create or replace function public.guard_client_schedule_plan_sharing()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.client_plan_shared_at is not null
      and (new.client_id is distinct from old.client_id or new.month is distinct from old.month) then
      raise exception 'A previously shared plan cannot move to another client or month' using errcode = '42501';
    end if;
    if old.client_plan_follow_source and row(new.microsoft_plan_id,new.microsoft_task_id,new.microsoft_bucket_id)
      is distinct from row(old.microsoft_plan_id,old.microsoft_task_id,old.microsoft_bucket_id) then
      raise exception 'Stop source following before changing its exact Microsoft identity' using errcode = '42501';
    end if;
    if row(new.client_plan_shared_date, new.client_plan_shared_at, new.client_plan_shared_by_profile_id, new.client_plan_follow_source, new.client_plan_follow_source_at, new.client_plan_follow_source_by)
      is not distinct from row(old.client_plan_shared_date, old.client_plan_shared_at, old.client_plan_shared_by_profile_id, old.client_plan_follow_source, old.client_plan_follow_source_at, old.client_plan_follow_source_by) then
      return new;
    end if;
  elsif new.client_plan_shared_date is null and new.client_plan_shared_at is null and new.client_plan_shared_by_profile_id is null and not new.client_plan_follow_source
    and new.client_plan_follow_source_at is null and new.client_plan_follow_source_by is null then
    return new;
  end if;
  -- Invoker is intentional: ordinary table writes must not gain definer rights.
  -- Only the authenticated, role-checked, postgres-owned RPC below changes audit.
  if current_user <> 'postgres' then
    raise exception 'Use the reviewed plan sharing action' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.set_client_schedule_plan_visibility(
  p_client_id uuid, p_month date, p_visible boolean, p_expected_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles%rowtype;
  v_expected record;
  v_row public.monthly_deliverables%rowtype;
  v_count integer := 0;
  v_follow_count integer := 0;
  v_follow boolean;
  v_job_id uuid;
  v_source record;
begin
  select * into v_profile from public.profiles where id = auth.uid() and is_active;
  if not found or v_profile.role not in ('admin', 'manager') then
    raise exception 'Active manager access required' using errcode = '42501';
  end if;
  if p_client_id is null or p_month is null or p_month <> date_trunc('month', p_month)::date or p_visible is null then
    raise exception 'Exact client, month and visibility are required' using errcode = '22023';
  end if;
  if not exists(select 1 from public.clients where id = p_client_id and active) then
    raise exception 'Active client required' using errcode = '42501';
  end if;
  if p_expected_rows is null or jsonb_typeof(p_expected_rows) <> 'array' then
    raise exception 'Expected row revisions required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_expected_rows) not between 1 and 200 then
    raise exception 'Review between one and 200 rows' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_expected_rows) as e(id uuid, updated_at timestamptz) where e.id is null or e.updated_at is null)
    or (select count(distinct e.id) from jsonb_to_recordset(p_expected_rows) as e(id uuid, updated_at timestamptz)) <> jsonb_array_length(p_expected_rows) then
    raise exception 'Unique rows and revisions required' using errcode = '22023';
  end if;
  -- Sorted locks avoid deadlocks. Any changed/foreign row rolls back the whole set.
  for v_expected in select * from jsonb_to_recordset(p_expected_rows) as e(id uuid, updated_at timestamptz) order by e.id loop
    select * into v_row from public.monthly_deliverables where id = v_expected.id for update;
    if not found or v_row.client_id is distinct from p_client_id or v_row.month is distinct from p_month
      or v_row.archived_at is not null or v_row.deliverable_type not in ('dp', 'photo', 'video', 'reel') then
      raise exception 'Exact active client-month rows required' using errcode = '42501';
    end if;
    if v_row.updated_at is distinct from v_expected.updated_at then
      raise exception 'Schedule changed; refresh and review' using errcode = '40001';
    end if;
    if p_visible and (v_row.scheduled_date is null or date_trunc('month', v_row.scheduled_date)::date <> p_month) then
      raise exception 'A real date in the selected month is required' using errcode = '22023';
    end if;
    -- A share delegates date following only when a fresh complete source proves
    -- the SAME date, task, plan and bucket. Local overrides stay static.
    v_follow := false;
    if p_visible and v_row.month between date_trunc('month',clock_timestamp() at time zone 'Africa/Johannesburg')::date
      and (date_trunc('month',clock_timestamp() at time zone 'Africa/Johannesburg') + interval '1 month')::date
      and nullif(v_row.microsoft_plan_id,'') is not null and nullif(v_row.microsoft_task_id,'') is not null
      and nullif(v_row.microsoft_bucket_id,'') is not null then
      select j.id into v_job_id from public.microsoft_sync_jobs j
      join public.microsoft_sync_job_sources s on s.job_id=j.id
      where j.status='complete' and s.source_type='planner_plan' and s.source_id=v_row.microsoft_plan_id
      order by j.exported_at desc nulls last,j.created_at desc,j.id desc limit 1;
      select * into v_source from public.client_schedule_verified_source_date(v_job_id,v_row.microsoft_plan_id,v_row.microsoft_task_id);
      v_follow := found and v_source.source_date is not distinct from v_row.scheduled_date
        and v_source.bucket_id=v_row.microsoft_bucket_id;
    end if;
    if v_follow then v_follow_count := v_follow_count + 1; end if;
    if (p_visible and v_row.client_plan_shared_date is distinct from v_row.scheduled_date)
      or (not p_visible and v_row.client_plan_shared_date is not null)
      or v_row.client_plan_follow_source is distinct from v_follow then
      update public.monthly_deliverables set
        client_plan_shared_date = case when p_visible then scheduled_date else null end,
        client_plan_shared_at = clock_timestamp(),
        client_plan_shared_by_profile_id = v_profile.id,
        client_plan_follow_source = v_follow,
        client_plan_follow_source_at = clock_timestamp(),
        client_plan_follow_source_by = v_profile.id
      where id = v_row.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return jsonb_build_object('changed', v_count, 'visible', p_visible, 'source_following', v_follow_count);
end;
$$;
alter function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) owner to postgres;
revoke all on function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) from public, anon;
grant execute on function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) to authenticated;


-- Existing service cycle may move only the dates explicitly delegated by a
-- manager. General protected Client Schedule reconciliation remains excluded.
create function public.refresh_shared_client_schedule_source_dates(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_run record; v_row record; v_source record; v_result jsonb;
  v_checked integer:=0; v_changed integer:=0; v_held integer:=0;
  v_month date:=date_trunc('month',clock_timestamp() at time zone 'Africa/Johannesburg')::date;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'Service access required' using errcode='42501';
  end if;
  select r.id,r.trigger_type,r.status,r.requested_by,r.preview_job_id,r.summary,
    j.status as job_status,j.created_by,j.created_at,j.exported_at
    into v_run from public.microsoft_sync_runs r
    join public.microsoft_sync_jobs j on j.id=r.preview_job_id
    where r.id=p_run_id for update of r;
  if not found or v_run.trigger_type<>'agent' or v_run.status not in ('completed','partial')
    or v_run.job_status<>'complete' or v_run.requested_by is distinct from v_run.created_by
    or not exists(select 1 from public.profiles p where p.id=v_run.requested_by
      and p.is_active and p.role in ('admin','manager')) then
    raise exception 'Exact completed automatic source run required' using errcode='42501';
  end if;
  if v_run.summary ? 'sharedScheduleDateRefresh' then
    return v_run.summary->'sharedScheduleDateRefresh';
  end if;
  if v_run.exported_at is null or v_run.exported_at < clock_timestamp()-interval '4 hours'
    or v_run.created_at < clock_timestamp()-interval '4 hours'
    or v_run.exported_at > clock_timestamp()+interval '5 minutes'
    or exists(select 1 from public.microsoft_sync_jobs j where j.created_by=v_run.created_by
      and j.status='complete' and j.exported_at>v_run.exported_at)
    or exists(select 1 from public.microsoft_sync_job_sources s where s.job_id=v_run.preview_job_id
      and s.required and (not s.complete or s.stage<>'complete' or s.safe_error is not null or s.pagination_cursor is not null)) then
    return jsonb_build_object('checked',0,'changed',0,'held',0,'blocked','Source run is stale or incomplete');
  end if;
  -- One set of scoped rows; no protected 6,000-record payload enters Edge memory.
  -- Staff date overrides (current date != last shared date), unsharing, archival,
  -- completed posts and inactive clients/consent owners cannot be overwritten.
  for v_row in select md.* from public.monthly_deliverables md
    join public.clients c on c.id=md.client_id and c.active
    join public.profiles p on p.id=md.client_plan_follow_source_by and p.is_active and p.role in ('admin','manager')
    where md.client_plan_follow_source and md.archived_at is null and md.posted_at is null
      and md.client_plan_shared_at is not null and md.client_plan_shared_by_profile_id is not null
      and md.month between (v_month-interval '1 month')::date and (v_month+interval '1 month')::date
      and md.deliverable_type in ('dp','photo','video','reel')
    order by md.id limit 1000 for update of md
  loop
    v_checked:=v_checked+1;
    if v_row.scheduled_date is distinct from v_row.client_plan_shared_date then
      v_held:=v_held+1; continue;
    end if;
    select * into v_source from public.client_schedule_verified_source_date(
      v_run.preview_job_id,v_row.microsoft_plan_id,v_row.microsoft_task_id);
    if not found or v_source.bucket_id is distinct from v_row.microsoft_bucket_id then
      v_held:=v_held+1; continue;
    end if;
    if v_source.source_date is not null and
      (v_source.source_date<v_month or v_source.source_date>=(v_month+interval '2 months')::date) then
      v_held:=v_held+1; continue;
    end if;
    if v_row.scheduled_date is not distinct from v_source.source_date then continue; end if;
    update public.monthly_deliverables set scheduled_date=v_source.source_date,
      client_plan_shared_date=v_source.source_date where id=v_row.id;
    insert into public.planner_activity_log(entity_type,entity_id,action,actor_user_id,actor_name,metadata)
      values('monthly_deliverable',v_row.id,'source_plan_date_refreshed',null,'Microsoft automatic date refresh',
        jsonb_build_object('automatic',true,'run_id',p_run_id,'job_id',v_run.preview_job_id,
          'old_date',v_row.scheduled_date,'new_date',v_source.source_date,'source_observed_at',v_source.observed_at,
          'delegated_by_profile_id',v_row.client_plan_follow_source_by));
    v_changed:=v_changed+1;
  end loop;
  v_result:=jsonb_build_object('checked',v_checked,'changed',v_changed,'held',v_held,
    'bounded',v_checked=1000,'observed_at',v_run.exported_at);
  update public.microsoft_sync_runs set summary=coalesce(summary,'{}'::jsonb)
    ||jsonb_build_object('sharedScheduleDateRefresh',v_result) where id=p_run_id;
  return v_result;
end;
$$;
alter function public.refresh_shared_client_schedule_source_dates(uuid) owner to postgres;
revoke all on function public.refresh_shared_client_schedule_source_dates(uuid) from public,anon,authenticated;
grant execute on function public.refresh_shared_client_schedule_source_dates(uuid) to service_role;

create or replace function public.client_portal_month_ahead_posts_v2(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  schedule_date date,
  title text,
  post_type text,
  client_safe_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_allowed_client_id uuid;
begin
  if p_month is null then
    raise exception 'Month is required' using errcode = '22023';
  end if;

  select profile.*
    into v_profile
    from public.profiles profile
   where profile.id = auth.uid()
     and profile.is_active;

  if not found or v_profile.role not in ('admin', 'manager', 'staff', 'team', 'client') then
    raise exception 'Active portal access required' using errcode = '42501';
  end if;

  if v_profile.role = 'client' then
    if v_profile.client_id is null or p_client_id is distinct from v_profile.client_id then
      raise exception 'Client access denied' using errcode = '42501';
    end if;
    v_allowed_client_id := v_profile.client_id;
  else
    if p_client_id is null then
      raise exception 'Client is required' using errcode = '22023';
    end if;
    v_allowed_client_id := p_client_id;
  end if;

  return query
  select
    'post-' || substr(md5(deliverable.id::text), 1, 16),
    case
      when deliverable.posted_at is not null
        then (deliverable.posted_at at time zone 'Africa/Johannesburg')::date
      else deliverable.scheduled_date
    end,
    case when deliverable.sent_to_client_at is not null or deliverable.client_approved_at is not null or deliverable.posted_at is not null
      then deliverable.title
      -- A recognised scheduling instruction becomes a fixed public label only.
      -- Never reveal the rest of the private task title or infer a new allowance.
      when deliverable.deliverable_type::text = 'video'
        and deliverable.title ~* '^[[:space:]]*REPOST[[:space:]]+VIDEO([[:space:]]|$)'
        then 'Video repost'
      when deliverable.deliverable_type::text = 'reel'
        and deliverable.title ~* '^[[:space:]]*REPOST[[:space:]]+REEL([[:space:]]|$)'
        then 'Reel repost'
      else (case deliverable.deliverable_type::text when 'dp' then 'Poster' when 'photo' then 'Photo' when 'video' then 'Video' else 'Reel' end)
        || ' ' || deliverable.instance_number::text end,
    deliverable.deliverable_type::text,
    case
      when deliverable.posted_at is not null then 'posted'
      when deliverable.client_approved_at is not null and deliverable.scheduled_date is not null then 'scheduled'
      when deliverable.client_approved_at is not null then 'approved'
      when deliverable.sent_to_client_at is not null then 'awaiting_approval'
      else 'planned'
    end
  from public.monthly_deliverables deliverable
  where deliverable.client_id = v_allowed_client_id
    and deliverable.archived_at is null
    -- Keep capacity/month ownership unchanged. An authorised source-followed
    -- future date appears in its actual calendar month, including a month move.
    and case when deliverable.client_plan_follow_source and deliverable.posted_at is null
      then date_trunc('month',deliverable.scheduled_date)::date = date_trunc('month',p_month)::date
      else deliverable.month = date_trunc('month',p_month)::date end
    and deliverable.deliverable_type in ('dp', 'photo', 'video', 'reel')
    and (
      deliverable.sent_to_client_at is not null
      or deliverable.client_approved_at is not null
      or deliverable.posted_at is not null
      or (deliverable.client_plan_shared_date = deliverable.scheduled_date
        and date_trunc('month', deliverable.scheduled_date)::date = date_trunc('month', p_month)::date
        and deliverable.client_plan_shared_at is not null
        and deliverable.client_plan_shared_by_profile_id is not null)
    )
  order by
    case
      when deliverable.posted_at is not null
        then (deliverable.posted_at at time zone 'Africa/Johannesburg')::date
      else deliverable.scheduled_date
    end nulls last,
    deliverable.title;
end;
$$;
