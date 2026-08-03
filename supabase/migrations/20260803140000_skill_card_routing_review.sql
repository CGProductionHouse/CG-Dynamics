-- Skill Card routing review.
--
-- Wording review (skill_card_record_review) deliberately CANNOT change which
-- specialists a card reaches — routing is structural, not editorial, so it must
-- not be smuggled through a copy edit. This adds the separate, explicit,
-- admin-gated path for that decision.
--
-- It does not touch status. A card's activation still depends entirely on the
-- existing gate, and re-routing an active card never re-activates anything.

create or replace function public.skill_card_set_routing(
  p_card_id uuid,
  p_agents text[],
  p_note text default null
) returns public.skill_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.skill_cards;
  v_canonical text[] := '{}';
  v_reviewer text;
  k text;
  c text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required to change Skill Card routing';
  end if;
  if p_agents is null or cardinality(p_agents) = 0 then
    raise exception 'A card must route to at least one specialist';
  end if;

  -- Every key must resolve to a real specialist. An unrecognised key is refused
  -- outright rather than silently stored, so a card can never be routed nowhere.
  foreach k in array p_agents loop
    c := public.canonical_agent_key(k);
    if c is null then
      raise exception 'Unrecognised specialist key: %', k;
    end if;
    if not (c = any(v_canonical)) then
      v_canonical := array_append(v_canonical, c);
    end if;
  end loop;

  select * into v_card from public.skill_cards where id = p_card_id for update;
  if not found then raise exception 'Skill Card not found'; end if;

  select coalesce(full_name, 'admin') into v_reviewer from public.profiles where id = auth.uid();

  update public.skill_cards
     set relevant_agents = to_jsonb(v_canonical)
   where id = p_card_id
   returning * into v_card;

  -- Routing changes are recorded in the same review trail as every other
  -- decision, with the before/after captured in the note.
  insert into public.skill_card_reviews (skill_card_id, reviewed_by, review_status, review_notes)
  values (
    p_card_id, v_reviewer, 'approved',
    'Routing updated to [' || array_to_string(v_canonical, ', ') || ']. '
      || coalesce(nullif(btrim(p_note), ''), '')
  );

  return v_card;
end;
$$;

revoke all on function public.skill_card_set_routing(uuid, text[], text) from public, anon;
grant execute on function public.skill_card_set_routing(uuid, text[], text) to authenticated;

notify pgrst, 'reload schema';
