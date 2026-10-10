-- #731: an exact-client, manager-confirmed source decision before strategy AI
-- may use ChatGPT-recorded meeting notes. No strategy approval/publication.
alter table public.client_context_updates
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete restrict,
  add column if not exists reviewed_at timestamptz;

create or replace function public.review_client_context_update(
  p_client_id uuid,
  p_update_id uuid,
  p_expected_state text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_update public.client_context_updates;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_active
    and profile.role in ('admin', 'manager');
  if v_actor.id is null then raise exception 'Active manager access required'; end if;
  if p_client_id is null or p_update_id is null or p_expected_state is distinct from 'unreviewed'
      or p_decision is null or p_decision not in ('incorporated', 'rejected') then
    raise exception 'Exact unreviewed update and decision required';
  end if;
  if not exists (select 1 from public.clients client where client.id = p_client_id and client.active) then
    raise exception 'Active exact client required';
  end if;

  select * into v_update from public.client_context_updates update_row
  where update_row.id = p_update_id and update_row.client_id = p_client_id
  for update;
  if v_update.id is null then raise exception 'Exact client update not found'; end if;
  if v_update.review_state <> p_expected_state then
    if v_update.review_state = p_decision then
      return jsonb_build_object(
        'update_id', v_update.id, 'client_id', v_update.client_id,
        'review_state', v_update.review_state, 'reviewed_at', v_update.reviewed_at,
        'reviewed_by_profile_id', v_update.reviewed_by_profile_id,
        'replayed', true
      );
    end if;
    raise exception 'Client update review conflict';
  end if;

  update public.client_context_updates
  set review_state = p_decision,
      reviewed_by_profile_id = v_actor.id,
      reviewed_at = now()
  where id = v_update.id and client_id = p_client_id and review_state = p_expected_state
  returning * into v_update;
  if v_update.id is null then raise exception 'Client update review conflict'; end if;
  return jsonb_build_object(
    'update_id', v_update.id, 'client_id', v_update.client_id,
    'review_state', v_update.review_state, 'reviewed_at', v_update.reviewed_at,
    'reviewed_by_profile_id', v_update.reviewed_by_profile_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.review_client_context_update(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_client_context_update(uuid, uuid, text, text)
  to authenticated;

comment on function public.review_client_context_update(uuid, uuid, text, text) is
  'Active manager exact-client review of an unreviewed context update; changes review state only and records actor/time. No strategy write or publication.';
