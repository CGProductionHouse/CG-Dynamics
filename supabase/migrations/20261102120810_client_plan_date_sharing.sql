-- Explicitly share posting dates, independently from sending/approving content.
-- Default private; no backfill. A changed schedule date needs fresh sharing.
alter table public.monthly_deliverables
  add column client_plan_shared_date date,
  add column client_plan_shared_at timestamptz,
  add column client_plan_shared_by_profile_id uuid references public.profiles(id),
  add constraint monthly_deliverables_plan_share_audit check (
    (client_plan_shared_at is null) = (client_plan_shared_by_profile_id is null)
    and (client_plan_shared_date is null or client_plan_shared_at is not null)
  );

create function public.guard_client_schedule_plan_sharing()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.client_plan_shared_at is not null
      and (new.client_id is distinct from old.client_id or new.month is distinct from old.month) then
      raise exception 'A previously shared plan cannot move to another client or month' using errcode = '42501';
    end if;
    if row(new.client_plan_shared_date, new.client_plan_shared_at, new.client_plan_shared_by_profile_id)
      is not distinct from row(old.client_plan_shared_date, old.client_plan_shared_at, old.client_plan_shared_by_profile_id) then
      return new;
    end if;
  elsif new.client_plan_shared_date is null and new.client_plan_shared_at is null and new.client_plan_shared_by_profile_id is null then
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
create trigger guard_client_schedule_plan_sharing
before insert or update on public.monthly_deliverables
for each row execute function public.guard_client_schedule_plan_sharing();
revoke all on function public.guard_client_schedule_plan_sharing() from public, anon, authenticated;

create function public.set_client_schedule_plan_visibility(
  p_client_id uuid, p_month date, p_visible boolean, p_expected_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles%rowtype;
  v_expected record;
  v_row public.monthly_deliverables%rowtype;
  v_count integer := 0;
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
    if (p_visible and v_row.client_plan_shared_date is distinct from v_row.scheduled_date)
      or (not p_visible and v_row.client_plan_shared_date is not null) then
      update public.monthly_deliverables set
        client_plan_shared_date = case when p_visible then scheduled_date else null end,
        client_plan_shared_at = clock_timestamp(),
        client_plan_shared_by_profile_id = v_profile.id
      where id = v_row.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return jsonb_build_object('changed', v_count, 'visible', p_visible);
end;
$$;
alter function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) owner to postgres;
revoke all on function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) from public, anon;
grant execute on function public.set_client_schedule_plan_visibility(uuid,date,boolean,jsonb) to authenticated;

-- Preserve the current projection signature, ownership checks and evidence
-- precedence. Only an explicitly shared, still-matching date adds Planned.
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
    and deliverable.month = date_trunc('month', p_month)::date
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

