-- Canonical staff identity and assignment resolution (PR 1).
--
-- planner_tasks records assignment as FREE TEXT (assigned_to_name) with no
-- canonical user column, and multi-assignee values were stored as one unsplit
-- blob: 661 rows held ["Amonique Fourie;Franco Lessing"] as a SINGLE element.
-- That single string matches no profile, so a perfectly unambiguous
-- "Franco Lessing" stayed Unassigned while the UI still displayed the name.
--
-- Nothing here hardcodes a person. Staff are discovered from profiles, and the
-- candidate forms for every person are derived by the same rules, so a new hire
-- resolves with no code change.

-- ── Normalisation ───────────────────────────────────────────────────────────
create or replace function public.cg_normalise_identity(p_value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '', 'g'), '');
$$;

-- ── Durable alias registry ──────────────────────────────────────────────────
-- The identity mapping layer. Microsoft/Teams assignee IDs are NOT available:
-- the importer records "Outlook attendee or assignee IDs are not imported", so
-- microsoft_user_mappings cannot be keyed on a real Graph id. Display-name
-- aliases are therefore the durable link, recorded here with the exact imported
-- text kept verbatim for audit.
create table if not exists public.staff_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  alias_text text not null,
  alias_normalised text not null,
  match_rule text not null check (match_rule in ('exact_full_name', 'exact_email_local', 'unique_first_token', 'manual')),
  first_seen_at timestamptz not null default now(),
  created_by uuid,
  unique (alias_normalised, profile_id)
);
create index if not exists staff_identity_aliases_norm_idx on public.staff_identity_aliases (alias_normalised);
alter table public.staff_identity_aliases enable row level security;
alter table public.staff_identity_aliases force row level security;
drop policy if exists staff_identity_aliases_staff_read on public.staff_identity_aliases;
create policy staff_identity_aliases_staff_read on public.staff_identity_aliases for select using (public.is_staff());
drop policy if exists staff_identity_aliases_admin_write on public.staff_identity_aliases;
create policy staff_identity_aliases_admin_write on public.staff_identity_aliases for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Manager review queue ────────────────────────────────────────────────────
-- Anything the generic rules cannot resolve WITHOUT GUESSING lands here and
-- stays out of staff-specific summaries until a manager decides.
create table if not exists public.staff_identity_review (
  id uuid primary key default gen_random_uuid(),
  alias_text text not null,
  alias_normalised text not null,
  occurrences integer not null default 0,
  reason text not null check (reason in ('no_match', 'ambiguous', 'duplicate_account', 'assignment_conflict')),
  candidate_profile_ids uuid[] not null default '{}',
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_profile_id uuid references public.profiles(id),
  reviewed_by uuid,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (alias_normalised, reason)
);
alter table public.staff_identity_review enable row level security;
alter table public.staff_identity_review force row level security;
drop policy if exists staff_identity_review_staff_read on public.staff_identity_review;
create policy staff_identity_review_staff_read on public.staff_identity_review for select using (public.is_staff());
drop policy if exists staff_identity_review_manager_write on public.staff_identity_review;
create policy staff_identity_review_manager_write on public.staff_identity_review for all
  using (public.is_manager()) with check (public.is_manager());

-- ── Rollback log ────────────────────────────────────────────────────────────
-- Every production write, with the value that was there before. Nothing is
-- destroyed; this is the undo path.
create table if not exists public.assignment_corrections (
  id uuid primary key default gen_random_uuid(),
  batch_label text not null,
  entity_table text not null,
  entity_id uuid not null,
  field text not null,
  before_value jsonb,
  after_value jsonb,
  applied_at timestamptz not null default now(),
  applied_by uuid,
  reverted_at timestamptz
);
create index if not exists assignment_corrections_batch_idx on public.assignment_corrections (batch_label, entity_table);
alter table public.assignment_corrections enable row level security;
alter table public.assignment_corrections force row level security;
drop policy if exists assignment_corrections_staff_read on public.assignment_corrections;
create policy assignment_corrections_staff_read on public.assignment_corrections for select using (public.is_staff());
drop policy if exists assignment_corrections_admin_write on public.assignment_corrections;
create policy assignment_corrections_admin_write on public.assignment_corrections for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Keep unresolved ownership out of person-specific summaries ──────────────
alter table public.planner_tasks
  add column if not exists assignment_review_state text not null default 'ok'
    check (assignment_review_state in ('ok', 'unresolved', 'conflict'));
comment on column public.planner_tasks.assignment_review_state is
  'ok = every assignee resolved; unresolved = at least one imported name could not be resolved; conflict = durable evidence disagrees. Anything other than ok must be excluded from person-specific summaries and shown under Needs assignment review.';
create index if not exists planner_tasks_review_state_idx on public.planner_tasks (assignment_review_state) where archived_at is null;

-- ── Candidate forms, derived identically for every person ───────────────────
create or replace function public.cg_staff_identity_candidates()
returns table (profile_id uuid, form text, rule text)
language sql stable security definer set search_path = '' as $$
  with staff as (
    select id, full_name, email from public.profiles
     where is_active and role in ('admin', 'manager', 'team')
  ),
  forms as (
    select id, public.cg_normalise_identity(full_name) as form, 'exact_full_name' as rule from staff
    union all
    select id, public.cg_normalise_identity(split_part(email, '@', 1)), 'exact_email_local' from staff
    union all
    -- First token of the display name, e.g. a directory "Ger-Marie Pretorius"
    -- against a profile named "Ger-Marie". Only usable when unique.
    select id, public.cg_normalise_identity(split_part(btrim(full_name), ' ', 1)), 'unique_first_token' from staff
  )
  select id, form, rule from forms where form is not null;
$$;

-- ── Resolve ONE imported identity segment ───────────────────────────────────
-- Returns a person only when exactly one active staff member matches. Never
-- guesses: CG Dynamics may show information as unresolved, but must never
-- present a guess as truth.
create or replace function public.cg_resolve_identity_segment(p_segment text)
returns table (profile_id uuid, match_rule text, reason text, candidates uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_full text := public.cg_normalise_identity(p_segment);
  v_first text := public.cg_normalise_identity(split_part(btrim(p_segment), ' ', 1));
  v_ids uuid[];
  v_rule text;
begin
  if v_full is null then
    return query select null::uuid, null::text, 'no_match'::text, '{}'::uuid[]; return;
  end if;

  select array_agg(distinct c.profile_id), min(c.rule)
    into v_ids, v_rule
    from public.cg_staff_identity_candidates() c
   where c.form = v_full and c.rule in ('exact_full_name', 'exact_email_local');

  if v_ids is not null and array_length(v_ids, 1) = 1 then
    return query select v_ids[1], v_rule, null::text, v_ids; return;
  elsif v_ids is not null and array_length(v_ids, 1) > 1 then
    return query select null::uuid, null::text, 'ambiguous'::text, v_ids; return;
  end if;

  select array_agg(distinct c.profile_id) into v_ids
    from public.cg_staff_identity_candidates() c
   where c.form = v_first;

  if v_ids is not null and array_length(v_ids, 1) = 1 then
    return query select v_ids[1], 'unique_first_token'::text, null::text, v_ids; return;
  elsif v_ids is not null and array_length(v_ids, 1) > 1 then
    return query select null::uuid, null::text, 'ambiguous'::text, v_ids; return;
  end if;

  return query select null::uuid, null::text, 'no_match'::text, '{}'::uuid[];
end;
$$;

-- ── Split a combined imported string into individual identities ─────────────
create or replace function public.cg_split_identity_string(p_value text)
returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(btrim(s) order by ord), '{}')
    from unnest(string_to_array(coalesce(p_value, ''), ';')) with ordinality as t(s, ord)
   where btrim(s) <> '';
$$;

revoke all on function public.cg_staff_identity_candidates() from public, anon;
revoke all on function public.cg_resolve_identity_segment(text) from public, anon;
grant execute on function public.cg_staff_identity_candidates() to authenticated, service_role;
grant execute on function public.cg_resolve_identity_segment(text) to authenticated, service_role;
grant execute on function public.cg_normalise_identity(text) to authenticated, service_role;
grant execute on function public.cg_split_identity_string(text) to authenticated, service_role;
