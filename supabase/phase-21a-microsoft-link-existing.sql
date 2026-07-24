-- ============================================================================
-- phase-21a-microsoft-link-existing.sql
--
-- Extends the Microsoft sync apply RPC so a legacy monthly_deliverables row
-- (one that already represents a Microsoft source task but has no Microsoft IDs)
-- can be LINKED in place: the client_schedule UPDATE branch may now attach
-- microsoft_plan_id / microsoft_task_id / microsoft_source_type when present in
-- the patch. All fields remain optional (`case when p_patch ? '...'`), so every
-- existing create/update flow is unchanged — a legacy link only sets what the
-- link patch sends, preserving all CG-owned fields (notes, assignments, helpers).
--
-- Bumps the apply version 2 -> 3. The frontend (MICROSOFT_SYNC_APPLY_VERSION) is
-- bumped to 3 in the same release. RELEASE ORDERING: apply this migration only
-- together with the v3 frontend deploy — applying it while a v2 frontend is live
-- would fail the apply preflight version check.
--
-- Additive and idempotent (create or replace). No data is modified. No RLS or
-- unrelated migration is changed. Depends on phase-17a and phase-19c.
-- ============================================================================

create or replace function public.microsoft_sync_apply_version()
returns integer
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return 3;
end;
$$;

revoke all on function public.microsoft_sync_apply_version() from public;
revoke all on function public.microsoft_sync_apply_version() from anon;
revoke all on function public.microsoft_sync_apply_version() from authenticated;
grant execute on function public.microsoft_sync_apply_version() to authenticated;

create or replace function public.apply_microsoft_sync_item(
  p_run_id uuid,
  p_item_key text,
  p_destination text,
  p_destination_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_should_apply boolean,
  p_patch jsonb,
  p_source_type text,
  p_source_container_id text,
  p_source_item_id text,
  p_source_name text,
  p_source_complete boolean,
  p_details jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $function$
declare
  result_id uuid := p_destination_id;
  affected integer := 0;
  current_transition_status text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select transition_status into current_transition_status
  from public.microsoft_sync_settings where id = true for update;
  if current_transition_status is distinct from 'active' then
    raise exception 'Microsoft transition sync is not active';
  end if;
  if not exists (select 1 from public.microsoft_sync_runs where id = p_run_id and status = 'applying') then
    raise exception 'Microsoft sync run is not applying';
  end if;
  select destination_id into result_id
  from public.microsoft_sync_run_items where run_id = p_run_id and item_key = p_item_key;
  if found then return result_id; end if;

  if p_patch ? 'helper_names'
    and jsonb_typeof(p_patch->'helper_names') not in ('array', 'null') then
    raise exception 'helper_names must be a JSON array or null';
  end if;

  if p_should_apply and p_action not in ('unchanged', 'conflict', 'skipped', 'failed') then
    if p_destination = 'planner' and p_action = 'create' then
      insert into public.planner_tasks (
        board_id, bucket_id, title, client_id, client_name, assigned_to_name,
        helper_names, status, priority, start_date, due_date, source,
        original_plan_name, original_bucket_name, original_task_id, import_hash,
        microsoft_source_type, microsoft_plan_id, microsoft_bucket_id,
        microsoft_task_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        nullif(p_patch->>'board_id','')::uuid, nullif(p_patch->>'bucket_id','')::uuid,
        p_patch->>'title', nullif(p_patch->>'client_id','')::uuid, p_patch->>'client_name',
        p_patch->>'assigned_to_name',
        case when jsonb_typeof(p_patch->'helper_names') = 'array'
          then array(select jsonb_array_elements_text(p_patch->'helper_names'))
          else '{}'::text[] end,
        p_patch->>'status', coalesce(p_patch->>'priority','normal'),
        nullif(p_patch->>'start_date','')::date, nullif(p_patch->>'due_date','')::date,
        p_patch->>'source', p_patch->>'original_plan_name', p_patch->>'original_bucket_name',
        p_patch->>'original_task_id', p_patch->>'import_hash', p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_plan_id', p_patch->>'microsoft_bucket_id', p_patch->>'microsoft_task_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'client_schedule' and p_action = 'create' then
      insert into public.monthly_deliverables (
        client_id, package_id, template_id, board_id, bucket_id, month, code,
        instance_number, title, deliverable_type, production_status, priority,
        assigned_to_user_id, assigned_to_name, helper_names, scheduled_date,
        microsoft_source_type, microsoft_plan_id, microsoft_bucket_id,
        microsoft_task_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        nullif(p_patch->>'client_id','')::uuid, nullif(p_patch->>'package_id','')::uuid,
        nullif(p_patch->>'template_id','')::uuid, nullif(p_patch->>'board_id','')::uuid,
        nullif(p_patch->>'bucket_id','')::uuid, (p_patch->>'month')::date,
        p_patch->>'code', (p_patch->>'instance_number')::integer, p_patch->>'title',
        p_patch->>'deliverable_type', p_patch->>'production_status', coalesce(p_patch->>'priority','normal'),
        nullif(p_patch->>'assigned_to_user_id','')::uuid, p_patch->>'assigned_to_name',
        case when jsonb_typeof(p_patch->'helper_names') = 'array'
          then array(select jsonb_array_elements_text(p_patch->'helper_names'))
          else '{}'::text[] end,
        nullif(p_patch->>'scheduled_date','')::date, p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_plan_id', p_patch->>'microsoft_bucket_id', p_patch->>'microsoft_task_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'cg_calendar' and p_action = 'create' then
      insert into public.company_calendar_events (
        title, event_type, client_id, client_name, start_at, end_at, all_day,
        location, status, microsoft_source_type, microsoft_calendar_id,
        microsoft_event_id, microsoft_source_description,
        microsoft_last_synced_at, microsoft_last_seen_at,
        microsoft_source_modified_at, microsoft_source_hash,
        microsoft_source_removed_at, microsoft_sync_run_id
      ) values (
        p_patch->>'title', p_patch->>'event_type', nullif(p_patch->>'client_id','')::uuid,
        p_patch->>'client_name', (p_patch->>'start_at')::timestamptz,
        nullif(p_patch->>'end_at','')::timestamptz, (p_patch->>'all_day')::boolean,
        p_patch->>'location', p_patch->>'status', p_patch->>'microsoft_source_type',
        p_patch->>'microsoft_calendar_id', p_patch->>'microsoft_event_id',
        p_patch->>'microsoft_source_description', (p_patch->>'microsoft_last_synced_at')::timestamptz,
        (p_patch->>'microsoft_last_seen_at')::timestamptz, nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz,
        p_patch->>'microsoft_source_hash', nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz, p_run_id
      ) returning id into result_id;
    elsif p_destination = 'planner' then
      update public.planner_tasks set
        board_id = case when p_patch ? 'board_id' then nullif(p_patch->>'board_id','')::uuid else board_id end,
        bucket_id = case when p_patch ? 'bucket_id' then nullif(p_patch->>'bucket_id','')::uuid else bucket_id end,
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        assigned_to_name = case when p_patch ? 'assigned_to_name' then p_patch->>'assigned_to_name' else assigned_to_name end,
        helper_names = case when p_patch ? 'helper_names' then
          case when jsonb_typeof(p_patch->'helper_names') = 'array'
            then array(select jsonb_array_elements_text(p_patch->'helper_names'))
            else '{}'::text[] end
          else helper_names end,
        status = case when p_patch ? 'status' then p_patch->>'status' else status end,
        start_date = case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else start_date end,
        due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date','')::date else due_date end,
        original_plan_name = case when p_patch ? 'original_plan_name' then p_patch->>'original_plan_name' else original_plan_name end,
        original_bucket_name = case when p_patch ? 'original_bucket_name' then p_patch->>'original_bucket_name' else original_bucket_name end,
        microsoft_bucket_id = case when p_patch ? 'microsoft_bucket_id' then p_patch->>'microsoft_bucket_id' else microsoft_bucket_id end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        archived_at = case when p_patch ? 'archived_at' then nullif(p_patch->>'archived_at','')::timestamptz else archived_at end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    elsif p_destination = 'client_schedule' then
      update public.monthly_deliverables set
        client_id = case when p_patch ? 'client_id' then nullif(p_patch->>'client_id','')::uuid else client_id end,
        package_id = case when p_patch ? 'package_id' then nullif(p_patch->>'package_id','')::uuid else package_id end,
        template_id = case when p_patch ? 'template_id' then nullif(p_patch->>'template_id','')::uuid else template_id end,
        month = case when p_patch ? 'month' then (p_patch->>'month')::date else month end,
        code = case when p_patch ? 'code' then p_patch->>'code' else code end,
        instance_number = case when p_patch ? 'instance_number' then (p_patch->>'instance_number')::integer else instance_number end,
        deliverable_type = case when p_patch ? 'deliverable_type' then p_patch->>'deliverable_type' else deliverable_type end,
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        production_status = case when p_patch ? 'production_status' then p_patch->>'production_status' else production_status end,
        assigned_to_user_id = case when p_patch ? 'assigned_to_user_id' then nullif(p_patch->>'assigned_to_user_id','')::uuid else assigned_to_user_id end,
        assigned_to_name = case when p_patch ? 'assigned_to_name' then p_patch->>'assigned_to_name' else assigned_to_name end,
        helper_names = case when p_patch ? 'helper_names' then
          case when jsonb_typeof(p_patch->'helper_names') = 'array'
            then array(select jsonb_array_elements_text(p_patch->'helper_names'))
            else '{}'::text[] end
          else helper_names end,
        scheduled_date = case when p_patch ? 'scheduled_date' then nullif(p_patch->>'scheduled_date','')::date else scheduled_date end,
        -- phase-21a: legacy link may attach the Microsoft source identity in place.
        microsoft_source_type = case when p_patch ? 'microsoft_source_type' then p_patch->>'microsoft_source_type' else microsoft_source_type end,
        microsoft_plan_id = case when p_patch ? 'microsoft_plan_id' then p_patch->>'microsoft_plan_id' else microsoft_plan_id end,
        microsoft_task_id = case when p_patch ? 'microsoft_task_id' then p_patch->>'microsoft_task_id' else microsoft_task_id end,
        microsoft_bucket_id = case when p_patch ? 'microsoft_bucket_id' then p_patch->>'microsoft_bucket_id' else microsoft_bucket_id end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        archived_at = case when p_patch ? 'archived_at' then nullif(p_patch->>'archived_at','')::timestamptz else archived_at end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    elsif p_destination = 'cg_calendar' then
      update public.company_calendar_events set
        title = case when p_patch ? 'title' then p_patch->>'title' else title end,
        event_type = case when p_patch ? 'event_type' then p_patch->>'event_type' else event_type end,
        start_at = case when p_patch ? 'start_at' then (p_patch->>'start_at')::timestamptz else start_at end,
        end_at = case when p_patch ? 'end_at' then nullif(p_patch->>'end_at','')::timestamptz else end_at end,
        all_day = case when p_patch ? 'all_day' then (p_patch->>'all_day')::boolean else all_day end,
        location = case when p_patch ? 'location' then p_patch->>'location' else location end,
        status = case when p_patch ? 'status' then p_patch->>'status' else status end,
        microsoft_source_description = case when p_patch ? 'microsoft_source_description' then p_patch->>'microsoft_source_description' else microsoft_source_description end,
        microsoft_last_synced_at = case when p_patch ? 'microsoft_last_synced_at' then (p_patch->>'microsoft_last_synced_at')::timestamptz else microsoft_last_synced_at end,
        microsoft_last_seen_at = case when p_patch ? 'microsoft_last_seen_at' then (p_patch->>'microsoft_last_seen_at')::timestamptz else microsoft_last_seen_at end,
        microsoft_source_modified_at = case when p_patch ? 'microsoft_source_modified_at' then nullif(p_patch->>'microsoft_source_modified_at','')::timestamptz else microsoft_source_modified_at end,
        microsoft_source_hash = case when p_patch ? 'microsoft_source_hash' then p_patch->>'microsoft_source_hash' else microsoft_source_hash end,
        microsoft_source_removed_at = case when p_patch ? 'microsoft_source_removed_at' then nullif(p_patch->>'microsoft_source_removed_at','')::timestamptz else microsoft_source_removed_at end,
        microsoft_sync_run_id = p_run_id
      where id = p_destination_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
      get diagnostics affected = row_count;
    else
      raise exception 'Unsupported Microsoft sync destination/action';
    end if;

    if p_action <> 'create' and affected = 0 then
      raise exception 'Destination changed after preview';
    end if;
  end if;

  insert into public.microsoft_sync_run_items (
    run_id, item_key, source_type, source_container_id, source_item_id, source_name,
    destination, destination_id, action, result_status, source_complete, details
  ) values (
    p_run_id, p_item_key, p_source_type, p_source_container_id, p_source_item_id, p_source_name,
    p_destination, result_id, p_action,
    case when p_should_apply and p_action not in ('unchanged','conflict','skipped','failed') then 'applied' else 'skipped' end,
    p_source_complete, coalesce(p_details, '{}'::jsonb)
  );
  return result_id;
end;
$function$;

revoke all on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) from public;
revoke all on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) from anon;
grant execute on function public.apply_microsoft_sync_item(uuid,text,text,uuid,timestamptz,text,boolean,jsonb,text,text,text,text,boolean,jsonb) to authenticated;
