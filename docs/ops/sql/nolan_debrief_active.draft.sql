-- REVIEW ONLY. Requires nolan_source_active_reads.draft.sql; no production apply.
-- Guard one confirmed inactive-caller bypass; retain author/manager, exact
-- guideline/client/video, action validation and transaction atomicity semantics.
begin;
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='apply_content_run_debrief' and md5(p.prosrc) in ('7dcb837f5e9aa32777cb870211e2e877','10cd2b749d56e900eee0e672879de61d')) <> 1 then
    raise exception 'Unexpected RPC body: apply_content_run_debrief';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.apply_content_run_debrief(p_debrief_id uuid, p_actions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_debrief public.content_run_debriefs;
  v_run public.content_runs;
  v_action jsonb;
  v_video public.content_guide_ideas;
  v_action_name text;
  v_note text;
  v_video_id uuid;
  v_next_month date;
  v_next_status text;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;
  if jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) <> 'array' then
    raise exception 'Debrief actions must be an array';
  end if;
  if jsonb_array_length(coalesce(p_actions, '[]'::jsonb)) > 100 then
    raise exception 'Too many debrief actions';
  end if;

  select * into v_debrief
  from public.content_run_debriefs
  where id = p_debrief_id
  for update;

  if v_debrief.id is null then
    raise exception 'Debrief not found';
  end if;
  if v_debrief.status <> 'draft' then
    raise exception 'This debrief has already been finalised';
  end if;
  if v_debrief.created_by <> auth.uid() and not public.is_manager() then
    raise exception 'Only the author or a manager can apply this debrief';
  end if;

  select * into v_run
  from public.content_runs
  where id = v_debrief.content_run_id
    and client_id = v_debrief.client_id
  for key share;

  if v_run.id is null then
    raise exception 'Content Run ownership changed; review the debrief again';
  end if;
  if not exists (
    select 1
    from public.content_guidelines guideline
    where guideline.id = v_debrief.content_guideline_id
      and guideline.content_run_id = v_run.id
      and guideline.client_id = v_debrief.client_id
  ) then
    raise exception 'Content Guideline ownership changed; review the debrief again';
  end if;

  for v_action in
    select value from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_action_name := lower(coalesce(v_action ->> 'action', ''));
    v_note := nullif(trim(coalesce(v_action ->> 'note', '')), '');

    if coalesce(v_action ->> 'videoId', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'Invalid video identifier in debrief action';
    end if;
    v_video_id := (v_action ->> 'videoId')::uuid;

    select * into v_video
    from public.content_guide_ideas
    where id = v_video_id
      and content_guideline_id = v_debrief.content_guideline_id
      and client_id = v_debrief.client_id
      and status <> 'archived'
    for update;

    if v_video.id is null then
      raise exception 'A proposed video no longer belongs to this Content Guideline';
    end if;

    if v_action_name in ('no_change', 'uncertain') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_action_name in ('shot', 'changed') then
      v_next_status := case
        when v_video.production_status = 'not_shot'
          and coalesce(v_video.onedrive_footage_url, '') ~* '^https://'
          then 'ready_to_edit'
        when v_video.production_status = 'not_shot' then 'shot'
        else v_video.production_status
      end;

      update public.content_guide_ideas
      set
        production_status = v_next_status,
        production_note = case
          when v_note is null then production_note
          when nullif(trim(coalesce(production_note, '')), '') is null then v_note
          else production_note || E'\n\nPost-run debrief: ' || v_note
        end,
        production_status_updated_at = case
          when production_status is distinct from v_next_status then now()
          else production_status_updated_at
        end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    if v_action_name = 'not_approved' then
      if v_video.production_status <> 'not_shot' then
        raise exception 'Video % has already moved beyond Not shot; review it manually', v_video.video_number;
      end if;
      update public.content_guide_ideas
      set production_note = case
        when v_note is null then 'Not approved on site.'
        when nullif(trim(coalesce(production_note, '')), '') is null then v_note
        else production_note || E'\n\nPost-run debrief: ' || v_note
      end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    if v_action_name = 'move_next_month' then
      if v_video.production_status not in ('not_shot', 'shot') then
        raise exception 'Video % is already in production and cannot be moved automatically', v_video.video_number;
      end if;
      v_next_month := (
        date_trunc(
          'month',
          coalesce(v_video.month, v_run.run_date, current_date)::timestamp
        ) + interval '1 month'
      )::date;
      update public.content_guide_ideas
      set
        month = v_next_month,
        deliverable_id = null,
        production_status = 'not_shot',
        production_status_updated_at = now(),
        production_note = case
          when v_note is null then 'Moved to next month after the Content Run. Client Schedule link requires confirmation.'
          when nullif(trim(coalesce(production_note, '')), '') is null then
            v_note || E'\nClient Schedule link requires confirmation.'
          else
            production_note || E'\n\nPost-run debrief: ' || v_note ||
            E'\nClient Schedule link requires confirmation.'
        end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    raise exception 'Unsupported debrief action: %', v_action_name;
  end loop;

  update public.content_run_debriefs
  set
    status = 'applied',
    applied_actions = coalesce(p_actions, '[]'::jsonb),
    applied_at = now()
  where id = v_debrief.id;

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
end;
$function$;
commit;
