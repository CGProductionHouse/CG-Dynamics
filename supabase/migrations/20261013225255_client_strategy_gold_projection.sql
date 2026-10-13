-- The published monthly-strategy snapshot and published reports both call this
-- projection. The reviewed gold-standard plan was added after the original
-- allowlist, so omitting it made the client Plan fall back to thin direction.
-- This changes future snapshots only. Existing published_strategy_data is
-- intentionally NOT backfilled from mutable strategy_data here: republishing
-- a reviewed version is a separate manager action.
create or replace function public.client_safe_strategy_data(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when jsonb_typeof(p_data) <> 'object' then null else jsonb_build_object(
    'version', 1,
    'clientDirection', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'clientDirection') = 'array' then p_data -> 'clientDirection' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'clientRequestNotes', case when jsonb_typeof(p_data -> 'clientRequestNotes') = 'string' then p_data -> 'clientRequestNotes' else '""'::jsonb end,
    'topContent', jsonb_build_object(
      'autoCaption', case when jsonb_typeof(p_data #> '{topContent,autoCaption}') = 'string' then p_data #> '{topContent,autoCaption}' else 'null'::jsonb end,
      'autoPlatform', case when jsonb_typeof(p_data #> '{topContent,autoPlatform}') = 'string' then p_data #> '{topContent,autoPlatform}' else 'null'::jsonb end,
      'autoMetricLabel', case when jsonb_typeof(p_data #> '{topContent,autoMetricLabel}') = 'string' then p_data #> '{topContent,autoMetricLabel}' else 'null'::jsonb end,
      'autoMetricValue', case when jsonb_typeof(p_data #> '{topContent,autoMetricValue}') = 'number' then p_data #> '{topContent,autoMetricValue}' else 'null'::jsonb end,
      'autoImageUrl', case when jsonb_typeof(p_data #> '{topContent,autoImageUrl}') = 'string' then p_data #> '{topContent,autoImageUrl}' else 'null'::jsonb end,
      'coverImageUrl', case when jsonb_typeof(p_data #> '{topContent,coverImageUrl}') = 'string' then p_data #> '{topContent,coverImageUrl}' else '""'::jsonb end,
      'contentType', case when jsonb_typeof(p_data #> '{topContent,contentType}') = 'string' then p_data #> '{topContent,contentType}' else '""'::jsonb end,
      'whyItWorked', coalesce((
        select jsonb_agg(item.value) from jsonb_array_elements(
          case when jsonb_typeof(p_data #> '{topContent,whyItWorked}') = 'array' then p_data #> '{topContent,whyItWorked}' else '[]'::jsonb end
        ) item(value) where jsonb_typeof(item.value) = 'string'
      ), '[]'::jsonb),
      'whatThisTellsUs', case when jsonb_typeof(p_data #> '{topContent,whatThisTellsUs}') = 'string' then p_data #> '{topContent,whatThisTellsUs}' else '""'::jsonb end
    ),
    'strategyDrivers', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'strategyDrivers') = 'array' then p_data -> 'strategyDrivers' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'strategyGoingForward', case when jsonb_typeof(p_data -> 'strategyGoingForward') = 'string' then p_data -> 'strategyGoingForward' else '""'::jsonb end,
    'actionPlan', jsonb_build_object(
      'professional_video', public.client_safe_strategy_section(p_data #> '{actionPlan,professional_video}'),
      'reels', public.client_safe_strategy_section(p_data #> '{actionPlan,reels}'),
      'photo_content', public.client_safe_strategy_section(p_data #> '{actionPlan,photo_content}'),
      'design_poster', public.client_safe_strategy_section(p_data #> '{actionPlan,design_poster}'),
      'animated_poster', public.client_safe_strategy_section(p_data #> '{actionPlan,animated_poster}'),
      'campaign_recommendation', public.client_safe_strategy_section(p_data #> '{actionPlan,campaign_recommendation}')
    ),
    'clientActionsRequired', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'clientActionsRequired') = 'array' then p_data -> 'clientActionsRequired' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'calendarSelections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', case when jsonb_typeof(selection.value -> 'title') = 'string' then selection.value -> 'title' else '""'::jsonb end,
        'date', case when jsonb_typeof(selection.value -> 'date') = 'string' then selection.value -> 'date' else 'null'::jsonb end,
        'use', coalesce(selection.value -> 'use', 'false'::jsonb) = 'true'::jsonb,
        'note', case when jsonb_typeof(selection.value -> 'note') = 'string' then selection.value -> 'note' else '""'::jsonb end
      ))
      from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'calendarSelections') = 'array' then p_data -> 'calendarSelections' else '[]'::jsonb end
      ) selection(value)
      where jsonb_typeof(selection.value) = 'object'
    ), '[]'::jsonb),
    'goldStandard', jsonb_build_object(
      'objective', case when jsonb_typeof(p_data #> '{goldStandard,objective}') = 'string' then p_data #> '{goldStandard,objective}' else '""'::jsonb end,
      'audienceAndIntent', case when jsonb_typeof(p_data #> '{goldStandard,audienceAndIntent}') = 'string' then p_data #> '{goldStandard,audienceAndIntent}' else '""'::jsonb end,
      'coreMessage', case when jsonb_typeof(p_data #> '{goldStandard,coreMessage}') = 'string' then p_data #> '{goldStandard,coreMessage}' else '""'::jsonb end,
      'formatsAndRationale', case when jsonb_typeof(p_data #> '{goldStandard,formatsAndRationale}') = 'string' then p_data #> '{goldStandard,formatsAndRationale}' else '""'::jsonb end,
      'testAndChange', case when jsonb_typeof(p_data #> '{goldStandard,testAndChange}') = 'string' then p_data #> '{goldStandard,testAndChange}' else '""'::jsonb end,
      'pillarsAndHooks', case when jsonb_typeof(p_data #> '{goldStandard,pillarsAndHooks}') = 'string' then p_data #> '{goldStandard,pillarsAndHooks}' else '""'::jsonb end,
      'mustAvoid', case when jsonb_typeof(p_data #> '{goldStandard,mustAvoid}') = 'string' then p_data #> '{goldStandard,mustAvoid}' else '""'::jsonb end,
      'channelIntegration', case when jsonb_typeof(p_data #> '{goldStandard,channelIntegration}') = 'string' then p_data #> '{goldStandard,channelIntegration}' else '""'::jsonb end,
      'successSignals', case when jsonb_typeof(p_data #> '{goldStandard,successSignals}') = 'string' then p_data #> '{goldStandard,successSignals}' else '""'::jsonb end,
      'nextMonthGamePlan', case when jsonb_typeof(p_data #> '{goldStandard,nextMonthGamePlan}') = 'string' then p_data #> '{goldStandard,nextMonthGamePlan}' else '""'::jsonb end
    )
  ) end;
$$;

revoke all on function public.client_safe_strategy_data(jsonb) from public, anon, authenticated;

-- Migration self-check: preserve all ten reviewed fields and reject extras.
do $$
declare
  projected jsonb;
  source_gold jsonb;
  field_name text;
  fields text[] := array[
    'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale',
    'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration',
    'successSignals', 'nextMonthGamePlan'
  ];
begin
  select jsonb_object_agg(field, 'Exact ' || field)
    into source_gold from unnest(fields) field;
  projected := public.client_safe_strategy_data(jsonb_build_object(
    'goldStandard', source_gold || '{"privateDraft":"never"}'::jsonb,
    'strategyGoingForward', 'Specific direction',
    'internalNotes', 'never'
  ));
  foreach field_name in array fields loop
    if projected #>> array['goldStandard', field_name] is distinct from 'Exact ' || field_name then
      raise exception 'client-safe gold-standard projection contract failed: %', field_name;
    end if;
  end loop;
  if projected #>> '{strategyGoingForward}' is distinct from 'Specific direction'
    or projected #> '{goldStandard,privateDraft}' is not null
    or projected -> 'internalNotes' is not null
    or (select count(*) from jsonb_object_keys(projected -> 'goldStandard')) <> array_length(fields, 1) then
    raise exception 'client-safe gold-standard projection contract failed';
  end if;
  if public.client_safe_strategy_data('{"goldStandard":{"coreMessage":9}}'::jsonb) #>> '{goldStandard,coreMessage}' is distinct from '' then
    raise exception 'client-safe gold-standard projection type guard failed';
  end if;
end;
$$;
