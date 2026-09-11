-- CG Dynamics MCP: lead updates under the service-role connection.
--
-- Prepared only. Do not apply to production without explicit CA approval.
--
-- Every lead insert/update appends a business_development_lead_events row whose actor_profile_id
-- is NOT NULL and was taken only from auth.uid(). The CG Dynamics MCP updates leads with the
-- service role, where auth.uid() is NULL, so update_lead and log_lead_email_activity failed from
-- ChatGPT with "null value in column actor_profile_id" (reproduced on a local database built from
-- this repo). The app is unaffected: it writes leads as the signed-in user under RLS.
--
-- Fix:
--   * update_business_development_lead_as_actor — a service-role-only RPC the MCP calls instead of
--     updating the table directly. It re-checks the actor (active workforce), applies the same
--     rule as the app's RLS update policy (the owner, or an active manager/admin; owner-only when
--     the caller asks), accepts only the columns the app itself may update, and records the actor
--     for the audit trigger in a transaction-local setting.
--   * audit_business_development_lead reads that setting ONLY for the service role. A signed-in
--     user is still recorded as auth.uid(), so nobody can attribute a change to someone else. An
--     unidentified write is refused with a clear message instead of a NOT NULL violation.
--
-- Behaviour note: the MCP previously let the 'team' role update other people's leads, which the
-- app's RLS never allowed. The RPC applies the RLS rule, so that is now refused.

create or replace function public.audit_business_development_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case
    when auth.uid() is null and auth.role() = 'service_role'
      then nullif(current_setting('app.lead_actor_profile_id', true), '')::uuid
    else auth.uid()
  end;
begin
  if v_actor_id is null then
    raise exception 'Lead changes must be made by an identified staff member';
  end if;
  insert into public.business_development_lead_events (
    lead_id, actor_profile_id, event_type, state_snapshot
  ) values (
    new.id,
    v_actor_id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    jsonb_build_object(
      'stage', new.stage,
      'qualification', new.qualification,
      'last_action', new.last_action,
      'last_action_at', new.last_action_at,
      'next_action', new.next_action,
      'follow_up_at', new.follow_up_at,
      'archived_at', new.archived_at
    )
  );
  return new;
end;
$$;

create or replace function public.update_business_development_lead_as_actor(
  p_actor_profile_id uuid,
  p_lead_id uuid,
  p_changes jsonb,
  p_owner_only boolean default false
)
returns public.business_development_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Exactly the columns the app may update (the column grant to authenticated).
  c_updatable constant text[] := array[
    'company_name', 'website_url', 'industry', 'location', 'contact_name', 'contact_title',
    'contact_email', 'contact_phone', 'stage', 'qualification', 'qualification_summary',
    'last_action', 'last_action_at', 'next_action', 'follow_up_at', 'source_kind', 'source_url',
    'confidence', 'do_not_contact', 'archived_at'
  ];
  v_actor public.profiles%rowtype;
  v_lead public.business_development_leads%rowtype;
  v_unknown text[];
  v_previous_actor text;
begin
  select * into v_actor
  from public.profiles profile
  where profile.id = p_actor_profile_id
    and profile.is_active is true
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff profile required'; end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Lead changes must be a JSON object';
  end if;

  select * into v_lead from public.business_development_leads lead where lead.id = p_lead_id for update;
  if v_lead.id is null then raise exception 'Lead not found'; end if;

  -- The app's RLS update rule: the owner, or an active manager/admin.
  if v_lead.owner_profile_id is distinct from v_actor.id
     and (p_owner_only or v_actor.role not in ('admin', 'manager')) then
    raise exception 'You can only update your own leads';
  end if;

  select array_agg(change.key order by change.key) into v_unknown
  from jsonb_object_keys(p_changes) as change(key)
  where change.key <> all (c_updatable);
  if v_unknown is not null then
    raise exception 'Lead fields cannot be changed here: %', array_to_string(v_unknown, ', ');
  end if;

  if p_changes = '{}'::jsonb then return v_lead; end if;

  v_previous_actor := current_setting('app.lead_actor_profile_id', true);
  perform set_config('app.lead_actor_profile_id', v_actor.id::text, true);
  update public.business_development_leads lead set
    company_name = case when p_changes ? 'company_name' then p_changes ->> 'company_name' else lead.company_name end,
    website_url = case when p_changes ? 'website_url' then p_changes ->> 'website_url' else lead.website_url end,
    industry = case when p_changes ? 'industry' then p_changes ->> 'industry' else lead.industry end,
    location = case when p_changes ? 'location' then p_changes ->> 'location' else lead.location end,
    contact_name = case when p_changes ? 'contact_name' then p_changes ->> 'contact_name' else lead.contact_name end,
    contact_title = case when p_changes ? 'contact_title' then p_changes ->> 'contact_title' else lead.contact_title end,
    contact_email = case when p_changes ? 'contact_email' then p_changes ->> 'contact_email' else lead.contact_email end,
    contact_phone = case when p_changes ? 'contact_phone' then p_changes ->> 'contact_phone' else lead.contact_phone end,
    stage = case when p_changes ? 'stage' then p_changes ->> 'stage' else lead.stage end,
    qualification = case when p_changes ? 'qualification' then p_changes ->> 'qualification' else lead.qualification end,
    qualification_summary = case when p_changes ? 'qualification_summary' then p_changes ->> 'qualification_summary' else lead.qualification_summary end,
    last_action = case when p_changes ? 'last_action' then p_changes ->> 'last_action' else lead.last_action end,
    last_action_at = case when p_changes ? 'last_action_at' then (p_changes ->> 'last_action_at')::timestamptz else lead.last_action_at end,
    next_action = case when p_changes ? 'next_action' then p_changes ->> 'next_action' else lead.next_action end,
    follow_up_at = case when p_changes ? 'follow_up_at' then (p_changes ->> 'follow_up_at')::timestamptz else lead.follow_up_at end,
    source_kind = case when p_changes ? 'source_kind' then p_changes ->> 'source_kind' else lead.source_kind end,
    source_url = case when p_changes ? 'source_url' then p_changes ->> 'source_url' else lead.source_url end,
    confidence = case when p_changes ? 'confidence' then p_changes ->> 'confidence' else lead.confidence end,
    do_not_contact = case when p_changes ? 'do_not_contact' then (p_changes ->> 'do_not_contact')::boolean else lead.do_not_contact end,
    archived_at = case when p_changes ? 'archived_at' then (p_changes ->> 'archived_at')::timestamptz else lead.archived_at end
  where lead.id = v_lead.id
  returning * into v_lead;
  perform set_config('app.lead_actor_profile_id', coalesce(v_previous_actor, ''), true);

  return v_lead;
end;
$$;

revoke all on function public.update_business_development_lead_as_actor(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.update_business_development_lead_as_actor(uuid, uuid, jsonb, boolean) to service_role;
