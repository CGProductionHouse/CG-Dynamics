-- REVIEW ONLY; apply after nolan_source_active_reads.draft.sql in isolated acceptance.
-- No production application authorized. Preserve original privileges and all
-- active-role/client publication semantics; only add an active-profile guard.
begin;
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_or_create_content_guideline' and md5(p.prosrc) in ('1c8da6b6aacee0a0006f9b38c088b9fa','d00951f0e78927b97d2542eba2feec16')) <> 1 then
    raise exception 'Unexpected RPC body: get_or_create_content_guideline';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reorder_content_guideline_videos' and md5(p.prosrc) in ('58f0f24c1dc2e359fd703a4b0288d094','4cbbcadf5042b0b8df49e9f91ee31b1b')) <> 1 then
    raise exception 'Unexpected RPC body: reorder_content_guideline_videos';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_content_guideline_publication' and md5(p.prosrc) in ('37fd64a5097606c4e3a31f10d65c2ea2','854a0268817bb463eb98d51a504c088b')) <> 1 then
    raise exception 'Unexpected RPC body: set_content_guideline_publication';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='client_portal_published_content_guidelines' and md5(p.prosrc) in ('3c26d923c6064d7a2bfc121e173a6df8','30fa6da0df380d7cb7f985a5c6fbd80d')) <> 1 then
    raise exception 'Unexpected RPC body: client_portal_published_content_guidelines';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_content_guideline(p_run_id uuid)
 RETURNS public.content_guidelines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_run public.content_runs;
  v_guideline public.content_guidelines;
  v_client_name text;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_run
  from public.content_runs
  where id = p_run_id
  for update;

  if v_run.id is null then
    raise exception 'Content Run not found';
  end if;
  if v_run.client_id is null then
    raise exception 'Assign a client to the Content Run before creating its Content Guideline';
  end if;

  select * into v_guideline
  from public.content_guidelines
  where content_run_id = p_run_id;

  if v_guideline.id is not null then
    return v_guideline;
  end if;

  select name into v_client_name
  from public.clients
  where id = v_run.client_id;

  insert into public.content_guidelines (
    content_run_id,
    client_id,
    title,
    month,
    created_by
  ) values (
    v_run.id,
    v_run.client_id,
    'CONTENT GUIDELINE - ' || coalesce(v_client_name, v_run.client_name, 'CLIENT') ||
      case when v_run.run_date is not null
        then ' - ' || upper(to_char(v_run.run_date, 'FMMonth YYYY'))
        else '' end,
    case when v_run.run_date is not null then date_trunc('month', v_run.run_date)::date else null end,
    auth.uid()
  )
  on conflict (content_run_id) do nothing;

  select * into v_guideline
  from public.content_guidelines
  where content_run_id = p_run_id;

  return v_guideline;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reorder_content_guideline_videos(p_guideline_id uuid, p_video_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_expected_count integer;
  v_distinct_count integer;
  v_index integer;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  perform 1 from public.content_guidelines where id = p_guideline_id for update;
  if not found then
    raise exception 'Content Guideline not found';
  end if;

  select count(*) into v_expected_count
  from public.content_guide_ideas
  where content_guideline_id = p_guideline_id and status <> 'archived';

  select count(distinct video_id) into v_distinct_count
  from unnest(coalesce(p_video_ids, array[]::uuid[])) as video_id;

  if cardinality(coalesce(p_video_ids, array[]::uuid[])) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(coalesce(p_video_ids, array[]::uuid[])) as requested(video_id)
      left join public.content_guide_ideas video
        on video.id = requested.video_id
       and video.content_guideline_id = p_guideline_id
       and video.status <> 'archived'
      where video.id is null
    )
  then
    raise exception 'Video order must include each active video exactly once';
  end if;

  update public.content_guide_ideas
  set position = position + 1000000
  where content_guideline_id = p_guideline_id and status <> 'archived';

  if v_expected_count > 0 then
    for v_index in 1..v_expected_count loop
      update public.content_guide_ideas
      set position = v_index,
          video_number = v_index
      where id = p_video_ids[v_index]
        and content_guideline_id = p_guideline_id;
    end loop;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_content_guideline_publication(p_guideline_id uuid, p_publish boolean)
 RETURNS public.content_guidelines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_guideline public.content_guidelines;
  v_video_count integer;
  v_incomplete_count integer;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_guideline
  from public.content_guidelines
  where id = p_guideline_id
  for update;

  if v_guideline.id is null then
    raise exception 'Content Guideline not found';
  end if;

  if p_publish then
    select
      count(*),
      count(*) filter (
        where nullif(trim(title), '') is null
           or nullif(trim(script), '') is null
      )
    into v_video_count, v_incomplete_count
    from public.content_guide_ideas
    where content_guideline_id = p_guideline_id
      and status <> 'archived';

    if v_video_count = 0 then
      raise exception 'Add at least one video before publishing';
    end if;
    if v_incomplete_count > 0 then
      raise exception 'Every video needs a name and complete script before publishing';
    end if;
  end if;

  update public.content_guidelines
  set
    client_published_at = case when p_publish then now() else null end,
    status = case when p_publish then 'published' else 'ready' end
  where id = p_guideline_id
  returning * into v_guideline;

  return v_guideline;
end;
$function$;

CREATE OR REPLACE FUNCTION public.client_portal_published_content_guidelines(p_client_id uuid DEFAULT NULL::uuid, p_month date DEFAULT NULL::date)
 RETURNS TABLE(row_key text, title text, month date, run_name text, filming_date date, published_at timestamp with time zone, videos jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_client_id uuid;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if public.is_staff() then
    v_client_id := p_client_id;
  else
    v_client_id := public.my_client_id();
  end if;

  if v_client_id is null then
    return;
  end if;

  return query
  select
    md5(guideline.id::text) as row_key,
    guideline.title,
    guideline.month,
    run.name as run_name,
    run.run_date as filming_date,
    guideline.client_published_at as published_at,
    coalesce(
      jsonb_agg(
        public.guideline_video_client_snapshot(video) order by video.position, video.created_at
      ) filter (where video.id is not null),
      '[]'::jsonb
    ) as videos
  from public.content_guidelines guideline
  join public.content_runs run on run.id = guideline.content_run_id
  left join public.content_guide_ideas video
    on video.content_guideline_id = guideline.id
   and video.status <> 'archived'
  where guideline.client_id = v_client_id
    and guideline.client_published_at is not null
    and guideline.status = 'published'
    and (p_month is null or guideline.month = date_trunc('month', p_month)::date)
  group by guideline.id, run.id
  order by guideline.month desc nulls last, run.run_date desc nulls last, guideline.created_at desc;
end;
$function$;
commit;
