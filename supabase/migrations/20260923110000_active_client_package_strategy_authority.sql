-- Issue #494: verified active-client package authority and strategy quality gate.
-- clients.package_settings remains the single package-settings store. The
-- existing planner_activity_log retains immutable confirmation receipts.

create or replace function public.guard_client_package_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.client_package_verification_write', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.package_settings := coalesce(new.package_settings, '{}'::jsonb) - 'verification';
    elsif new.package_settings is distinct from old.package_settings then
      -- A direct package edit is allowed for backwards compatibility, but it
      -- is evidence gathering only. It cannot retain or manufacture authority.
      new.package_settings := coalesce(new.package_settings, '{}'::jsonb) - 'verification';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_client_package_verification on public.clients;
create trigger guard_client_package_verification
before update of package_settings on public.clients
for each row execute function public.guard_client_package_verification();

drop trigger if exists guard_client_package_verification_insert on public.clients;
create trigger guard_client_package_verification_insert
before insert on public.clients
for each row
when (new.package_settings ? 'verification')
execute function public.guard_client_package_verification();

revoke all on function public.guard_client_package_verification() from public, anon, authenticated;

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
  v_settings jsonb;
  v_verification jsonb;
  v_number_field text;
  v_source text;
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

  foreach v_number_field in array array[
    'professional_videos_per_month', 'reels_per_month', 'photo_posts_per_month',
    'design_posters_per_month', 'animated_posters_per_month', 'monthly_campaign_budget',
    'shoot_days_per_month', 'website_updates_per_month'
  ] loop
    if jsonb_typeof(p_package_settings -> v_number_field) is distinct from 'number'
       or (p_package_settings ->> v_number_field)::numeric < 0
       or trunc((p_package_settings ->> v_number_field)::numeric) <> (p_package_settings ->> v_number_field)::numeric then
      raise exception 'Package field % must be an explicit non-negative integer', v_number_field;
    end if;
  end loop;
  if jsonb_typeof(p_package_settings -> 'campaign_management_included') is distinct from 'boolean' then
    raise exception 'campaign_management_included must be an explicit boolean';
  end if;
  foreach v_number_field in array array['other_agreed_deliverables', 'package_notes', 'package_exclusions'] loop
    if jsonb_typeof(p_package_settings -> v_number_field) is distinct from 'string' then
      raise exception 'Package field % must be an explicit string', v_number_field;
    end if;
  end loop;
  foreach v_source in array coalesce(p_source_references, '{}'::text[]) loop
    if length(btrim(v_source)) = 0 then raise exception 'Package source references cannot be blank'; end if;
  end loop;

  select * into v_client from public.clients client where client.id = p_client_id for update;
  if v_client.id is null or not v_client.active then
    raise exception 'Active client not found';
  end if;
  v_before := v_client.package_settings;
  v_verification := jsonb_build_object(
    'status', 'confirmed',
    'version', 1,
    'confirmed_at', v_confirmed_at,
    'confirmed_by_profile_id', v_actor.id,
    'evidence_note', btrim(p_evidence_note),
    'inference_note', btrim(coalesce(p_inference_note, '')),
    'source_references', to_jsonb(coalesce(p_source_references, '{}'::text[]))
  );
  v_settings := jsonb_build_object(
    'professional_videos_per_month', (p_package_settings ->> 'professional_videos_per_month')::integer,
    'reels_per_month', (p_package_settings ->> 'reels_per_month')::integer,
    'photo_posts_per_month', (p_package_settings ->> 'photo_posts_per_month')::integer,
    'design_posters_per_month', (p_package_settings ->> 'design_posters_per_month')::integer,
    'animated_posters_per_month', (p_package_settings ->> 'animated_posters_per_month')::integer,
    'campaign_management_included', (p_package_settings ->> 'campaign_management_included')::boolean,
    'monthly_campaign_budget', (p_package_settings ->> 'monthly_campaign_budget')::integer,
    'shoot_days_per_month', (p_package_settings ->> 'shoot_days_per_month')::integer,
    'website_updates_per_month', (p_package_settings ->> 'website_updates_per_month')::integer,
    'other_agreed_deliverables', p_package_settings ->> 'other_agreed_deliverables',
    'package_notes', p_package_settings ->> 'package_notes',
    'package_exclusions', p_package_settings ->> 'package_exclusions',
    'verification', v_verification
  );

  perform set_config('app.client_package_verification_write', 'on', true);
  update public.clients set package_settings = v_settings where id = p_client_id;

  insert into public.planner_activity_log (
    entity_type, entity_id, action, actor_user_id, actor_name, metadata
  ) values (
    'client_package_settings', p_client_id, 'package_verified', v_actor.id, v_actor.full_name,
    jsonb_build_object(
      'client_id', p_client_id,
      'previous_package_settings', v_before,
      'confirmed_package_settings', v_settings - 'verification',
      'verification', v_verification
    )
  );

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
begin
  if new.workflow_status not in ('approved', 'published')
     or new.workflow_status is not distinct from old.workflow_status then
    return new;
  end if;

  select client.package_settings into v_package
  from public.clients client
  where client.id = new.client_id and client.active;
  if v_package #>> '{verification,status}' is distinct from 'confirmed'
     or coalesce((v_package #>> '{verification,version}')::integer, 0) <> 1 then
    raise exception 'PACKAGE_UNVERIFIED: confirm the exact active-client package before strategy approval';
  end if;
  if new.seed_context ->> 'client_id' is distinct from new.client_id::text then
    raise exception 'Strategy provenance does not belong to the exact client';
  end if;

  v_brief := new.strategy_data -> 'goldStandard';
  if jsonb_typeof(v_brief) is distinct from 'object' then
    raise exception 'Gold-standard exact-client strategy is required before approval';
  end if;
  foreach v_field in array array[
    'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale',
    'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration',
    'successSignals', 'nextMonthGamePlan'
  ] loop
    v_value := btrim(coalesce(v_brief ->> v_field, ''));
    if length(v_value) < 20 then
      raise exception 'Gold-standard strategy field % requires exact-client detail', v_field;
    end if;
    if lower(regexp_replace(v_value, '[[:punct:]]', '', 'g')) in (
      'increase engagement', 'build awareness', 'build brand awareness',
      'post consistently', 'grow social media', 'create engaging content'
    ) then
      raise exception 'Generic strategy filler is not approvable: %', v_field;
    end if;
  end loop;
  if coalesce((new.strategy_data #>> '{actionPlan,professional_video,enabled}')::boolean, false)
     and coalesce((v_package ->> 'professional_videos_per_month')::integer, 0) = 0 then
    raise exception 'Professional video plan exceeds the confirmed package';
  end if;
  if coalesce((new.strategy_data #>> '{actionPlan,reels,enabled}')::boolean, false)
     and coalesce((v_package ->> 'reels_per_month')::integer, 0) = 0 then
    raise exception 'Reels plan exceeds the confirmed package';
  end if;
  if coalesce((new.strategy_data #>> '{actionPlan,photo_content,enabled}')::boolean, false)
     and coalesce((v_package ->> 'photo_posts_per_month')::integer, 0) = 0 then
    raise exception 'Photo content plan exceeds the confirmed package';
  end if;
  if coalesce((new.strategy_data #>> '{actionPlan,design_poster,enabled}')::boolean, false)
     and coalesce((v_package ->> 'design_posters_per_month')::integer, 0) = 0 then
    raise exception 'Design poster plan exceeds the confirmed package';
  end if;
  if coalesce((new.strategy_data #>> '{actionPlan,animated_poster,enabled}')::boolean, false)
     and coalesce((v_package ->> 'animated_posters_per_month')::integer, 0) = 0 then
    raise exception 'Animated poster plan exceeds the confirmed package';
  end if;
  if coalesce((new.strategy_data #>> '{actionPlan,campaign_recommendation,enabled}')::boolean, false)
     and not coalesce((v_package ->> 'campaign_management_included')::boolean, false) then
    raise exception 'Campaign plan exceeds the confirmed package';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_gold_standard_monthly_strategy on public.monthly_client_strategies;
create trigger enforce_gold_standard_monthly_strategy
before update of workflow_status on public.monthly_client_strategies
for each row execute function public.enforce_gold_standard_monthly_strategy();

revoke all on function public.enforce_gold_standard_monthly_strategy() from public, anon, authenticated;

comment on function public.confirm_client_package_settings(uuid, jsonb, text, text, text[]) is
  'Issue #494: active-admin confirmation of exact package scope in clients.package_settings, with an append-only Planner activity receipt. Blank fields never become zero.';
