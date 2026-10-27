-- LOCAL PREPARATION ONLY. No production apply authorised.
-- Reuse the existing caller/tool/key ledger and canonical task creator, not a second task store.
alter table public.mcp_idempotency_log add column if not exists result_payload jsonb;

create or replace function public.mcp_check_idempotency(
  p_caller_profile_id uuid, p_tool_name text, p_idempotency_key uuid, p_input_hash text
) returns table(already_executed boolean, existing_result jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_existing public.mcp_idempotency_log;
begin
  select * into v_existing from public.mcp_idempotency_log
  where caller_profile_id=p_caller_profile_id and tool_name=p_tool_name and idempotency_key=p_idempotency_key;
  if not found then return query select false,null::jsonb; return; end if;
  if v_existing.input_hash is distinct from p_input_hash then
    return query select true,jsonb_build_object('status','conflict','message','Same idempotency key used with different inputs. Provide a new key.');
  else
    return query select true,coalesce(v_existing.result_payload,jsonb_build_object('status',v_existing.result_status,'message','Legacy receipt has no record projection.'));
  end if;
end $$;
revoke all on function public.mcp_check_idempotency(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.mcp_check_idempotency(uuid,text,uuid,text) to service_role;

create or replace function public.mcp_commit_operational_write(
  p_actor_profile_id uuid, p_connection_principal_user_id uuid, p_context_kind text,
  p_tool_name text, p_idempotency_key uuid, p_input_hash text, p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_actor public.profiles;
  v_principal public.profiles;
  v_log public.mcp_idempotency_log;
  v_task public.planner_tasks;
  v_event public.company_calendar_events;
  v_original public.company_calendar_events;
  v_action text;
  v_result jsonb;
  v_client_name text;
  v_client_id uuid;
  v_client_name_explicit boolean := p_payload ? 'client_name';
  v_native boolean;
  v_partial boolean;
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Only the authenticated Edge service may invoke this, with its server-resolved actor.
  if auth.role() is distinct from 'service_role' or auth.uid() is not null then raise exception 'Service-only operational receipt'; end if;
  select * into v_actor from public.profiles where id=p_actor_profile_id and is_active and role in ('admin','manager','staff','team');
  select * into v_principal from public.profiles where id=p_connection_principal_user_id and is_active and role in ('admin','manager','staff','team');
  if v_actor.id is null or v_principal.id is null then raise exception 'Active workforce identity required'; end if;
  if p_context_kind='company_admin' then
    if v_principal.role<>'admin' or v_actor.id<>v_principal.id then raise exception 'Exact company admin required'; end if;
  elsif p_context_kind='staff' then
    if v_principal.role<>'admin' and v_actor.id<>v_principal.id then raise exception 'Staff context cannot borrow another actor'; end if;
  else raise exception 'Operational writes require staff or company admin context'; end if;
  if p_tool_name not in ('create_task','create_recurring_task','update_task','upsert_calendar_event') or p_tool_name is null
    or p_idempotency_key is null or nullif(p_input_hash,'') is null or jsonb_typeof(p_payload) is distinct from 'object'
    then raise exception 'Invalid operational receipt request'; end if;

  -- Serialise only this actor/tool/key. Business write, assignment/audit and receipt commit together.
  perform pg_advisory_xact_lock(hashtextextended(p_actor_profile_id::text||'/'||p_tool_name||'/'||p_idempotency_key::text,0));
  select * into v_log from public.mcp_idempotency_log
  where caller_profile_id=p_actor_profile_id and tool_name=p_tool_name and idempotency_key=p_idempotency_key;
  if found then
    if v_log.input_hash is distinct from p_input_hash then raise exception 'Idempotency payload conflict'; end if;
    if v_log.result_payload is null then raise exception 'Legacy receipt unverified; re-read the original record before any new create'; end if;
    return v_log.result_payload;
  end if;

  if p_tool_name='upsert_calendar_event' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('title','event_type','start_at','end_at','all_day','location','notes','assigned_to_name','client_id','client_name','status','microsoft_event_id','microsoft_calendar_id','microsoft_source_type','microsoft_last_synced_at','sync_intent','outlook_write_succeeded','action','event_id','expected_updated_at','matched_by')) then raise exception 'Unsupported calendar write field'; end if;
    v_action:=coalesce(p_payload->>'action','create');
    if v_action not in ('create','update','cancel') then raise exception 'Unsupported calendar action'; end if;
    if nullif(p_payload->>'event_id','') is not null then
      select * into v_original from public.company_calendar_events where id=(p_payload->>'event_id')::uuid for update;
      if not found or v_original.superseded_by_event_id is not null or v_original.microsoft_source_removed_at is not null then raise exception 'Exact current event required'; end if;
      if nullif(p_payload->>'expected_updated_at','') is null or v_original.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then raise exception 'Calendar revision drift; re-read before retry'; end if;
      if p_payload->>'sync_intent'='dynamics_only' and (v_original.microsoft_event_id is not null or v_original.microsoft_calendar_id is not null) then raise exception 'Native mode cannot detach an Outlook-linked event'; end if;
      if (nullif(p_payload->>'microsoft_event_id','') is not null and v_original.microsoft_event_id is not null and p_payload->>'microsoft_event_id'<>v_original.microsoft_event_id)
        or (nullif(p_payload->>'microsoft_calendar_id','') is not null and v_original.microsoft_calendar_id is not null and p_payload->>'microsoft_calendar_id'<>v_original.microsoft_calendar_id) then raise exception 'Calendar source identity mismatch'; end if;
      if p_payload ? 'client_id' and v_original.client_visible and v_original.client_id is distinct from nullif(p_payload->>'client_id','')::uuid then raise exception 'Visible event client cannot be reassigned'; end if;
      p_payload:=to_jsonb(v_original)||p_payload;
    elsif v_action<>'create' then raise exception 'Exact event identity required for edit'; end if;
    if v_action='cancel' then p_payload:=p_payload||jsonb_build_object('status','cancelled'); end if;
  end if;

  v_client_id := nullif(p_payload->>'client_id','')::uuid;
  if v_client_id is not null then
    select name into v_client_name from public.clients where id=v_client_id and active;
    if not found then raise exception 'Exact active client required'; end if;
    if v_client_name_explicit and nullif(p_payload->>'client_name','') is not null and p_payload->>'client_name'<>v_client_name
      then raise exception 'Client name does not match exact client'; end if;
    if v_original.id is not null and not v_client_name_explicit and v_original.client_id=v_client_id then v_client_name:=v_original.client_name; end if;
  else v_client_name:=nullif(p_payload->>'client_name',''); end if;
  if (p_payload->>'due_date' is not null and (p_payload->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    or (p_payload->>'recurrence_until' is not null and (p_payload->>'recurrence_until') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then raise exception 'Exact ISO date required'; end if;
  if p_tool_name='create_recurring_task' and nullif(p_payload->>'recurrence_until','')::date < (now() at time zone 'Africa/Johannesburg')::date then raise exception 'Recurrence end date is in the business-date past'; end if;

  if p_tool_name='create_task' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('title','assignee_name','due_date','client_id','client_name','notes'))
      then raise exception 'Unsupported task create field'; end if;
    select * into v_task from public.create_assistant_task(
      p_payload->>'title',p_payload->>'assignee_name',nullif(p_payload->>'due_date','')::date,
      v_client_id,v_client_name,p_payload->>'notes',p_actor_profile_id);
    v_result:=jsonb_build_object('task',to_jsonb(v_task),'message','Task created.');
  elsif p_tool_name='create_recurring_task' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('title','recurrence_rule','recurrence_until','assignee_name','client_id','client_name','notes')) then raise exception 'Unsupported recurrence create field'; end if;
    select * into v_task from public.create_assistant_recurring_task(p_payload->>'title',p_payload->>'recurrence_rule',nullif(p_payload->>'recurrence_until','')::date,p_payload->>'assignee_name',v_client_id,v_client_name,p_payload->>'notes',p_actor_profile_id);
    v_result:=jsonb_build_object('template',to_jsonb(v_task),'message','Recurring template and receipt committed. Instances use the existing bounded on-view materialiser.');
  elsif p_tool_name='update_task' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('task_id','action','assignee_name','due_date','note')) then raise exception 'Unsupported task update field'; end if;
    select * into v_task from public.planner_tasks where id=(p_payload->>'task_id')::uuid for update;
    if not found or v_task.archived_at is not null or v_task.superseded_by_task_id is not null or v_task.microsoft_source_removed_at is not null then raise exception 'Exact active task required'; end if;
    if v_task.microsoft_task_id is not null then raise exception 'Microsoft-linked work requires exact upstream update and reconciliation'; end if;
    if p_payload->>'action' in ('assign','reassign') and nullif(btrim(p_payload->>'assignee_name'),'') is null then raise exception 'Exact assignee required'; end if;
    if p_payload->>'action' in ('start','reopen') then
      select * into v_task from public.update_planner_task_status(v_task.id,case when p_payload->>'action'='start' then 'in_progress' else 'to_do' end,p_actor_profile_id);
    elsif p_payload->>'action' in ('due','complete','block','comment','assign','reassign') then
      select * into v_task from public.update_assistant_task(v_task.id,p_payload->>'action',p_payload->>'assignee_name',nullif(p_payload->>'due_date','')::date,p_payload->>'note',p_actor_profile_id);
    else raise exception 'Unsupported task action'; end if;
    v_result:=jsonb_build_object('task',to_jsonb(v_task),'message','Task action applied.');
  else
    if nullif(btrim(p_payload->>'title'),'') is null then raise exception 'Calendar title required'; end if;
    if p_payload->>'event_type' is not null and p_payload->>'event_type' not in ('meeting','shoot','content_run','client_event','internal','deadline') then raise exception 'Unsupported event type'; end if;
    if p_payload->>'status' is not null and p_payload->>'status' not in ('planned','confirmed','completed','cancelled') then raise exception 'Unsupported event status'; end if;
    if coalesce(p_payload->>'sync_intent','coexistence') not in ('coexistence','dynamics_only') then raise exception 'Unsupported sync intent'; end if;
    v_native:=p_payload->>'sync_intent'='dynamics_only';
    v_native:=coalesce(v_native,false);
    if not v_native and jsonb_typeof(p_payload->'outlook_write_succeeded') is distinct from 'boolean' then raise exception 'Explicit Outlook outcome required'; end if;
    v_partial:=not v_native and not (p_payload->>'outlook_write_succeeded')::boolean;
    if v_native and (nullif(p_payload->>'microsoft_event_id','') is not null or nullif(p_payload->>'microsoft_calendar_id','') is not null or p_payload->>'outlook_write_succeeded'='true') then raise exception 'Native event cannot claim Microsoft identity'; end if;
    if not v_native and not v_partial and (nullif(p_payload->>'microsoft_event_id','') is null or nullif(p_payload->>'microsoft_calendar_id','') is null) then raise exception 'Complete Microsoft identity required'; end if;
    if (p_payload->>'start_at') is null or (p_payload->>'start_at') !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
      or (p_payload->>'end_at' is not null and (p_payload->>'end_at') !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Explicit-offset event timestamps required'; end if;
    v_start:=(p_payload->>'start_at')::timestamptz; v_end:=(p_payload->>'end_at')::timestamptz;
    if not isfinite(v_start) or (v_end is not null and (not isfinite(v_end) or v_end<=v_start)) then raise exception 'Invalid calendar interval'; end if;
    if v_original.id is null then
    insert into public.company_calendar_events(title,event_type,start_at,end_at,all_day,location,notes,assigned_to_name,client_id,client_name,status,microsoft_event_id,microsoft_calendar_id,microsoft_source_type,microsoft_last_synced_at)
    values(btrim(p_payload->>'title'),coalesce(p_payload->>'event_type','meeting'),v_start,v_end,coalesce((p_payload->>'all_day')::boolean,false),p_payload->>'location',p_payload->>'notes',p_payload->>'assigned_to_name',v_client_id,v_client_name,coalesce(p_payload->>'status','planned'),
      case when not v_native and not v_partial then p_payload->>'microsoft_event_id' end,
      case when not v_native and not v_partial then p_payload->>'microsoft_calendar_id' end,
      case when not v_native and not v_partial then 'outlook_calendar' end,
      case when not v_native and not v_partial then now() end) returning * into v_event;
    else
      update public.company_calendar_events set title=btrim(p_payload->>'title'),event_type=p_payload->>'event_type',
        start_at=v_start,end_at=v_end,all_day=(p_payload->>'all_day')::boolean,location=p_payload->>'location',notes=p_payload->>'notes',assigned_to_name=p_payload->>'assigned_to_name',
        client_id=v_client_id,client_name=v_client_name,status=p_payload->>'status',updated_at=now(),
        microsoft_event_id=case when not v_native and not v_partial then p_payload->>'microsoft_event_id' else v_original.microsoft_event_id end,
        microsoft_calendar_id=case when not v_native and not v_partial then p_payload->>'microsoft_calendar_id' else v_original.microsoft_calendar_id end,
        microsoft_source_type=case when not v_native and not v_partial then 'outlook_calendar' else v_original.microsoft_source_type end,
        microsoft_last_synced_at=case when not v_native and not v_partial then now() else v_original.microsoft_last_synced_at end
      where id=v_original.id returning * into v_event;
    end if;
    v_result:=jsonb_build_object('verdict',case when v_partial then 'PARTIAL_SYNC' else 'PASS' end,'action',v_action,
      'event',jsonb_build_object('id',v_event.id,'title',v_event.title,'event_type',v_event.event_type,'start_at',v_event.start_at,'end_at',v_event.end_at,'status',v_event.status,'client_id',v_event.client_id,'client_name',v_event.client_name,'microsoft_event_id',v_event.microsoft_event_id,'microsoft_calendar_id',v_event.microsoft_calendar_id,'microsoft_last_synced_at',v_event.microsoft_last_synced_at),
      'matched_by',case when v_original.id is null then 'created' else coalesce(p_payload->>'matched_by','event_id') end,'sync_state',case when v_native then 'DYNAMICS_ONLY' when v_partial then 'PARTIAL SYNC' else 'BOTH_SIDES_REPORTED_OK' end,
      'note','Dynamics record and receipt committed together. Microsoft write outcome is caller-reported, never provider-verified here. No Microsoft write was performed. Client Schedule and visibility were not changed.');
  end if;
  v_result:=v_result||jsonb_build_object('receipt',jsonb_build_object('contract','mcp_operational_atomic_v1','tool_name',p_tool_name,'actor_profile_id',p_actor_profile_id,'idempotency_key',p_idempotency_key,'entity_id',coalesce(v_result#>>'{task,id}',v_result#>>'{event,id}',v_result#>>'{template,id}')));
  insert into public.mcp_idempotency_log(caller_profile_id,tool_name,idempotency_key,input_hash,result_status,result_payload,connection_principal_user_id,effective_context_kind,effective_staff_profile_id,effective_client_id)
  values(p_actor_profile_id,p_tool_name,p_idempotency_key,p_input_hash,'success',v_result,p_connection_principal_user_id,p_context_kind,case when p_context_kind='staff' then p_actor_profile_id end,null);
  return v_result;
end $$;
revoke all on function public.mcp_commit_operational_write(uuid,uuid,text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_commit_operational_write(uuid,uuid,text,text,uuid,text,jsonb) to service_role;
