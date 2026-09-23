-- Issue #511: preserve explicitly unknown package fields without weakening the
-- canonical clients.package_settings authority or strategy approval guard.

create or replace function public.confirm_client_package_settings(
  p_client_id uuid,
  p_package_settings jsonb,
  p_evidence_note text,
  p_inference_note text default '',
  p_source_references text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_client public.clients;
  v_before jsonb;
  v_confirmed_at timestamptz := now();
  v_settings jsonb := '{}'::jsonb;
  v_verification jsonb;
  v_field_states jsonb;
  v_field text;
  v_state text;
  v_source text;
  v_numeric numeric;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.is_active and profile.role = 'admin';
  if v_actor.id is null then
    raise exception 'Active admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_package_settings) is distinct from 'object' then
    raise exception 'Package settings must be an object';
  end if;
  if length(btrim(coalesce(p_evidence_note, ''))) < 12 then
    raise exception 'A specific package evidence note is required';
  end if;
  if coalesce(cardinality(p_source_references), 0) = 0 then
    raise exception 'At least one exact package source reference is required';
  end if;
  v_field_states := p_package_settings -> 'field_states';
  if jsonb_typeof(v_field_states) is distinct from 'object' then
    raise exception 'Every package field requires an explicit evidence state';
  end if;

  foreach v_field in array array[
    'professional_videos_per_month', 'reels_per_month', 'photo_posts_per_month',
    'design_posters_per_month', 'animated_posters_per_month', 'monthly_campaign_budget',
    'shoot_days_per_month', 'website_updates_per_month'
  ] loop
    v_state := v_field_states ->> v_field;
    if v_state = 'unknown' then
      if jsonb_typeof(p_package_settings -> v_field) is distinct from 'null' then
        raise exception 'Unknown package field % must remain null', v_field;
      end if;
      v_settings := v_settings || jsonb_build_object(v_field, null);
    elsif v_state in ('known', 'explicit_zero') then
      if jsonb_typeof(p_package_settings -> v_field) is distinct from 'number' then
        raise exception 'Known package field % must be a non-negative integer', v_field;
      end if;
      v_numeric := (p_package_settings ->> v_field)::numeric;
      if v_numeric < 0 or trunc(v_numeric) <> v_numeric
         or (v_state = 'explicit_zero' and v_numeric <> 0)
         or (v_state = 'known' and v_numeric = 0) then
        raise exception 'Package field % does not match its evidence state %', v_field, v_state;
      end if;
      v_settings := v_settings || jsonb_build_object(v_field, v_numeric::integer);
    else
      raise exception 'Package field % requires known, explicit_zero or unknown state', v_field;
    end if;
  end loop;

  v_state := v_field_states ->> 'campaign_management_included';
  if v_state = 'unknown' then
    if jsonb_typeof(p_package_settings -> 'campaign_management_included') is distinct from 'null' then
      raise exception 'Unknown campaign_management_included must remain null';
    end if;
    v_settings := v_settings || jsonb_build_object('campaign_management_included', null);
  elsif v_state = 'known' and jsonb_typeof(p_package_settings -> 'campaign_management_included') = 'boolean' then
    v_settings := v_settings || jsonb_build_object('campaign_management_included', (p_package_settings ->> 'campaign_management_included')::boolean);
  else
    raise exception 'campaign_management_included state/value mismatch';
  end if;

  foreach v_field in array array['other_agreed_deliverables', 'package_notes', 'package_exclusions'] loop
    v_state := v_field_states ->> v_field;
    if v_state = 'unknown' then
      if jsonb_typeof(p_package_settings -> v_field) is distinct from 'null'
         and (jsonb_typeof(p_package_settings -> v_field) is distinct from 'string'
           or nullif(btrim(coalesce(p_package_settings ->> v_field, '')), '') is not null) then
        raise exception 'Unknown package field % must be null or blank', v_field;
      end if;
      v_settings := v_settings || jsonb_build_object(v_field, null);
    elsif v_state = 'known' and jsonb_typeof(p_package_settings -> v_field) = 'string'
          and nullif(btrim(p_package_settings ->> v_field), '') is not null then
      v_settings := v_settings || jsonb_build_object(v_field, btrim(p_package_settings ->> v_field));
    else
      raise exception 'Package field % state/value mismatch', v_field;
    end if;
  end loop;

  foreach v_source in array coalesce(p_source_references, '{}'::text[]) loop
    if length(btrim(v_source)) = 0 then raise exception 'Package source references cannot be blank'; end if;
  end loop;
  select * into v_client from public.clients client where client.id = p_client_id for update;
  if v_client.id is null or not v_client.active then raise exception 'Active client not found'; end if;

  v_before := v_client.package_settings;
  v_verification := jsonb_build_object(
    'status', 'confirmed', 'version', 2, 'confirmed_at', v_confirmed_at,
    'confirmed_by_profile_id', v_actor.id, 'evidence_note', btrim(p_evidence_note),
    'inference_note', btrim(coalesce(p_inference_note, '')),
    'source_references', to_jsonb(coalesce(p_source_references, '{}'::text[])),
    'field_states', v_field_states
  );
  v_settings := v_settings || jsonb_build_object('verification', v_verification);

  perform set_config('app.client_package_verification_write', 'on', true);
  update public.clients set package_settings = v_settings where id = p_client_id;
  insert into public.planner_activity_log (entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_package_settings', p_client_id, 'package_verified', v_actor.id, v_actor.full_name,
    jsonb_build_object('client_id', p_client_id, 'previous_package_settings', v_before,
      'confirmed_package_settings', v_settings - 'verification', 'verification', v_verification));
  return jsonb_build_object('client_id', p_client_id, 'package_settings', v_settings, 'verification', v_verification);
end;
$$;

revoke all on function public.confirm_client_package_settings(uuid, jsonb, text, text, text[]) from public, anon, authenticated;
grant execute on function public.confirm_client_package_settings(uuid, jsonb, text, text, text[]) to authenticated;

create or replace function public.enforce_gold_standard_monthly_strategy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package jsonb;
  v_brief jsonb;
  v_field text;
  v_value text;
  v_capacity_field text;
  v_action_key text;
  v_label text;
begin
  if new.workflow_status not in ('approved', 'published') then return new; end if;
  if tg_op = 'UPDATE' and new.workflow_status is not distinct from old.workflow_status
     and new.strategy_data is not distinct from old.strategy_data
     and new.seed_context is not distinct from old.seed_context
     and new.client_id is not distinct from old.client_id then return new; end if;

  select client.package_settings into v_package from public.clients client
  where client.id = new.client_id and client.active;
  if v_package #>> '{verification,status}' is distinct from 'confirmed'
     or coalesce((v_package #>> '{verification,version}')::integer, 0) not in (1, 2) then
    raise exception 'PACKAGE_UNVERIFIED: confirm the exact active-client package before strategy approval';
  end if;
  if new.seed_context ->> 'client_id' is distinct from new.client_id::text then
    raise exception 'Strategy provenance does not belong to the exact client';
  end if;
  if nullif(new.seed_context #>> '{sources,package_verification_confirmed_at}', '') is null
     or (new.seed_context #>> '{sources,package_verification_confirmed_at}')::timestamptz is distinct from (v_package #>> '{verification,confirmed_at}')::timestamptz
     or new.seed_context #>> '{sources,package_verification_actor_id}' is distinct from v_package #>> '{verification,confirmed_by_profile_id}'
     or new.seed_context #> '{sources,package_source_references}' is distinct from v_package #> '{verification,source_references}' then
    raise exception 'Strategy provenance does not match the current confirmed package receipt';
  end if;
  if not ((jsonb_typeof(new.seed_context -> 'intelligence_evidence') = 'array' and jsonb_array_length(new.seed_context -> 'intelligence_evidence') > 0)
    or nullif(new.seed_context #>> '{sources,previous_report_id}', '') is not null
    or nullif(new.seed_context #>> '{sources,previous_monthly_strategy_id}', '') is not null) then
    raise exception 'Exact-client intelligence or previous-work evidence is required before strategy approval';
  end if;

  v_brief := new.strategy_data -> 'goldStandard';
  if jsonb_typeof(v_brief) is distinct from 'object' then raise exception 'Gold-standard exact-client strategy is required before approval'; end if;
  foreach v_field in array array['objective','audienceAndIntent','coreMessage','formatsAndRationale','testAndChange','pillarsAndHooks','mustAvoid','channelIntegration','successSignals','nextMonthGamePlan'] loop
    v_value := btrim(coalesce(v_brief ->> v_field, ''));
    if length(v_value) < 20 then raise exception 'Gold-standard strategy field % requires exact-client detail', v_field; end if;
    if lower(regexp_replace(v_value, '[[:punct:]]', '', 'g')) in ('increase engagement','build awareness','build brand awareness','post consistently','grow social media','create engaging content') then
      raise exception 'Generic strategy filler is not approvable: %', v_field;
    end if;
  end loop;

  for v_action_key, v_capacity_field, v_label in values
    ('professional_video','professional_videos_per_month','Professional video'),
    ('reels','reels_per_month','Reels'), ('photo_content','photo_posts_per_month','Photo content'),
    ('design_poster','design_posters_per_month','Design poster'),
    ('animated_poster','animated_posters_per_month','Animated poster')
  loop
    if coalesce((new.strategy_data #>> array['actionPlan',v_action_key,'enabled'])::boolean, false) then
      if jsonb_typeof(v_package -> v_capacity_field) is distinct from 'number' then
        raise exception '% capacity is unknown; strategy cannot be approved', v_label;
      elsif (v_package ->> v_capacity_field)::integer = 0 then
        raise exception '% plan exceeds the confirmed package', v_label;
      end if;
    end if;
  end loop;
  if coalesce((new.strategy_data #>> '{actionPlan,campaign_recommendation,enabled}')::boolean, false) then
    if jsonb_typeof(v_package -> 'campaign_management_included') is distinct from 'boolean' then
      raise exception 'Campaign management capacity is unknown; strategy cannot be approved';
    elsif not (v_package ->> 'campaign_management_included')::boolean then
      raise exception 'Campaign plan exceeds the confirmed package';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_gold_standard_monthly_strategy() from public, anon, authenticated;

comment on function public.confirm_client_package_settings(uuid, jsonb, text, text, text[]) is
  'Issue #511: exact package confirmation with per-field known, explicit-zero or unknown evidence states. Unknown values remain null.';
