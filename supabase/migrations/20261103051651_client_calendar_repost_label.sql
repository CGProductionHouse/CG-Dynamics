-- Narrow planned-title projection fix. Existing ownership, ACL, dates and
-- content-approval precedence are unchanged. No base rows are written.
-- Production application requires the exact owner approval.
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

