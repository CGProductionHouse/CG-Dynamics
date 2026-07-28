-- Canonical Planner multi-assignment model.
-- Review in the Supabase SQL editor before applying to production.
-- Additive data changes only: legacy assignment names and Microsoft metadata
-- are preserved. Microsoft remains read-only upstream.

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists avatar_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_avatar_url_safe'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_url_safe
      check (avatar_url is null or avatar_url ~* '^https://[^[:space:]]+$');
  end if;
end
$$;

comment on column public.profiles.is_active is
  'False removes a workforce profile from assignment selection; historical assignments remain readable.';
comment on column public.profiles.avatar_url is
  'Optional HTTPS avatar URL exposed only through safe workforce RPC projections.';

create or replace function public.is_active_planner_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_active
        and profile.role in ('admin', 'manager')
    );
$$;

revoke all on function public.is_active_planner_manager() from public, anon, authenticated;
grant execute on function public.is_active_planner_manager() to authenticated;

alter table public.planner_tasks
  add column if not exists unresolved_assignee_names text[] not null default '{}';

comment on column public.planner_tasks.unresolved_assignee_names is
  'Legacy primary/helper identities that did not resolve to exactly one workforce profile during canonical assignment backfill.';

create table if not exists public.planner_task_assignees (
  task_id uuid not null references public.planner_tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  position integer not null check (position >= 0),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, profile_id),
  unique (task_id, position)
);

comment on table public.planner_task_assignees is
  'Canonical ordered Planner assignments. Position 0 is primary; every row is an assignee.';

create index if not exists planner_task_assignees_task_idx
  on public.planner_task_assignees(task_id);
create index if not exists planner_task_assignees_profile_idx
  on public.planner_task_assignees(profile_id);

-- Remove this migration's installed triggers before rerun backfill. The prior
-- projection guard must not reject the safe unresolved-name rewrite, and prior
-- sync/audit triggers must not create migration-side effects.
drop trigger if exists planner_tasks_guard_assignment_projections on public.planner_tasks;
drop trigger if exists planner_tasks_sync_microsoft_assignees on public.planner_tasks;
drop trigger if exists planner_tasks_sync_legacy_assignees on public.planner_tasks;
drop trigger if exists planner_tasks_audit_direct_write on public.planner_tasks;
drop trigger if exists planner_tasks_inherit_recurring_assignments on public.planner_tasks;

-- Resolve only case-insensitive exact workforce-name matches. A duplicate
-- profile name is intentionally unresolved. The primary identity sorts before
-- helpers, helper order is retained, and duplicate profile IDs collapse to the
-- first occurrence before positions are made contiguous.
with legacy_names as (
  select
    t.id as task_id,
    t.assigned_to_name as legacy_name,
    0::integer as source_order,
    0::bigint as name_order
  from public.planner_tasks t
  where nullif(btrim(t.assigned_to_name), '') is not null

  union all

  select
    t.id,
    helper.name,
    1::integer,
    helper.ordinality
  from public.planner_tasks t
  cross join lateral unnest(coalesce(t.helper_names, '{}'::text[]))
    with ordinality as helper(name, ordinality)
  where nullif(btrim(helper.name), '') is not null
), matched_names as (
  select
    legacy.*,
    match.profile_ids,
    cardinality(match.profile_ids) as match_count
  from legacy_names legacy
  cross join lateral (
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) as profile_ids
    from public.profiles p
    where p.role in ('admin', 'manager', 'staff', 'team')
      and lower(btrim(p.full_name)) = lower(btrim(legacy.legacy_name))
  ) match
), first_profile_occurrence as (
  select distinct on (task_id, profile_ids[1])
    task_id,
    profile_ids[1] as profile_id,
    source_order,
    name_order
  from matched_names
  where match_count = 1
  order by task_id, profile_ids[1], source_order, name_order
), positioned_profiles as (
  select
    task_id,
    profile_id,
    row_number() over (
      partition by task_id
      order by source_order, name_order, profile_id
    )::integer - 1 as position
  from first_profile_occurrence
)
insert into public.planner_task_assignees (task_id, profile_id, position)
select task_id, profile_id, position
from positioned_profiles
on conflict do nothing;

with legacy_names as (
  select
    t.id as task_id,
    t.assigned_to_name as legacy_name,
    0::integer as source_order,
    0::bigint as name_order
  from public.planner_tasks t
  where nullif(btrim(t.assigned_to_name), '') is not null

  union all

  select
    t.id,
    helper.name,
    1::integer,
    helper.ordinality
  from public.planner_tasks t
  cross join lateral unnest(coalesce(t.helper_names, '{}'::text[]))
    with ordinality as helper(name, ordinality)
  where nullif(btrim(helper.name), '') is not null
), unresolved_candidates as (
  select
    legacy.task_id,
    legacy.legacy_name,
    1::integer as origin_order,
    legacy.source_order,
    legacy.name_order
  from legacy_names legacy
  where (
    select count(*)
    from public.profiles p
    where p.role in ('admin', 'manager', 'staff', 'team')
      and lower(btrim(p.full_name)) = lower(btrim(legacy.legacy_name))
  ) <> 1

  union all

  select
    task.id,
    existing.name,
    0::integer,
    0::integer,
    existing.ordinality
  from public.planner_tasks task
  cross join lateral unnest(coalesce(task.unresolved_assignee_names, '{}'::text[]))
    with ordinality as existing(name, ordinality)
  where nullif(btrim(existing.name), '') is not null
), ordered_distinct_unresolved as (
  select distinct on (task_id, lower(btrim(legacy_name)))
    task_id,
    legacy_name,
    origin_order,
    source_order,
    name_order
  from unresolved_candidates
  order by
    task_id,
    lower(btrim(legacy_name)),
    origin_order,
    source_order,
    name_order
), unresolved as (
  select
    task_id,
    array_agg(legacy_name order by origin_order, source_order, name_order) as names
  from ordered_distinct_unresolved
  group by task_id
)
update public.planner_tasks task
set unresolved_assignee_names = unresolved.names
from unresolved
where task.id = unresolved.task_id;

-- Direct updates may not diverge canonical assignments from their legacy
-- projections. Canonical SECURITY DEFINER functions opt in transaction-locally;
-- Microsoft-identity rows are accepted and normalized by the sync trigger below.
create or replace function public.guard_planner_assignment_projections()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_table_owner text;
begin
  if new.assigned_to_name is not distinct from old.assigned_to_name
    and new.helper_names is not distinct from old.helper_names
    and new.unresolved_assignee_names is not distinct from old.unresolved_assignee_names
  then
    return new;
  end if;

  select pg_get_userbyid(class.relowner) into v_table_owner
  from pg_class class
  where class.oid = 'public.planner_tasks'::regclass;

  if (
      new.unresolved_assignee_names is not distinct from old.unresolved_assignee_names
      and (
        public.is_active_planner_manager()
        or (
          new.microsoft_task_id is not null
          and (current_user = v_table_owner or auth.role() = 'service_role')
        )
      )
    )
    or (
      current_user = v_table_owner
      and current_setting('app.planner_assignment_projection_write', true) = 'on'
    )
  then
    return new;
  end if;

  raise exception 'Planner assignment projections must be changed through a canonical assignment RPC';
end;
$$;

revoke all on function public.guard_planner_assignment_projections()
  from public, anon, authenticated;

drop trigger if exists planner_tasks_guard_assignment_projections on public.planner_tasks;
create trigger planner_tasks_guard_assignment_projections
  before update of assigned_to_name, helper_names, unresolved_assignee_names
  on public.planner_tasks
  for each row execute function public.guard_planner_assignment_projections();

create or replace function public.set_planner_task_assignees_internal(
  p_task_id uuid,
  p_profile_ids uuid[],
  p_actor_user_id uuid,
  p_write_audit boolean,
  p_audit_origin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.planner_tasks;
  v_assignee_ids uuid[];
  v_old_assignee_ids uuid[];
  v_primary_name text;
  v_helper_names text[];
  v_valid_count integer;
  v_actor_name text;
  v_previous_guard text;
begin
  select * into v_task
  from public.planner_tasks
  where id = p_task_id
  for update;
  if v_task.id is null then
    raise exception 'Planner task not found';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_profile_ids, '{}'::uuid[])) profile_id
    where profile_id is null
  ) then
    raise exception 'Assignee profile IDs cannot contain null';
  end if;

  select coalesce(array_agg(dedup.profile_id order by dedup.first_ordinal), '{}'::uuid[])
  into v_assignee_ids
  from (
    select profile_id, min(ordinality) as first_ordinal
    from unnest(coalesce(p_profile_ids, '{}'::uuid[]))
      with ordinality as requested(profile_id, ordinality)
    group by profile_id
  ) dedup;

  select count(*) into v_valid_count
  from public.profiles profile
  where profile.id = any(v_assignee_ids)
    and profile.is_active
    and nullif(btrim(profile.full_name), '') is not null
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_valid_count <> cardinality(v_assignee_ids) then
    raise exception 'Assignees must be active named workforce profiles';
  end if;

  select coalesce(array_agg(assignment.profile_id order by assignment.position), '{}'::uuid[])
  into v_old_assignee_ids
  from public.planner_task_assignees assignment
  where assignment.task_id = p_task_id;

  if v_old_assignee_ids = v_assignee_ids then
    return false;
  end if;

  select profile.full_name into v_primary_name
  from public.profiles profile
  where profile.id = v_assignee_ids[1];

  select coalesce(array_agg(profile.full_name order by requested.ordinality), '{}'::text[])
  into v_helper_names
  from unnest(v_assignee_ids) with ordinality as requested(profile_id, ordinality)
  join public.profiles profile on profile.id = requested.profile_id
  where requested.ordinality > 1;

  delete from public.planner_task_assignees
  where task_id = p_task_id;

  insert into public.planner_task_assignees (
    task_id, profile_id, position, assigned_by
  )
  select p_task_id, requested.profile_id, requested.ordinality::integer - 1, p_actor_user_id
  from unnest(v_assignee_ids) with ordinality as requested(profile_id, ordinality);

  v_previous_guard := current_setting('app.planner_assignment_projection_write', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  update public.planner_tasks
  set assigned_to_name = v_primary_name,
      helper_names = v_helper_names
  where id = p_task_id;
  perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_guard, ''), true);

  if p_write_audit then
    select profile.full_name into v_actor_name
    from public.profiles profile
    where profile.id = p_actor_user_id;
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', p_task_id, 'assignment_changed', p_actor_user_id, v_actor_name,
      jsonb_build_object(
        'old_profile_ids', to_jsonb(v_old_assignee_ids),
        'new_profile_ids', to_jsonb(v_assignee_ids),
        'unresolved_names', to_jsonb(v_task.unresolved_assignee_names),
        'origin', p_audit_origin
      )
    );
  end if;

  return true;
end;
$$;

revoke all on function public.set_planner_task_assignees_internal(
  uuid, uuid[], uuid, boolean, text
) from public, anon, authenticated;

-- Existing UI/import and Microsoft apply paths may write legacy names. Resolve
-- every unguarded insert/name change into canonical active assignments with a
-- neutral server-side origin; this performs no external provider write.
create or replace function public.sync_planner_task_legacy_assignees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_assignee_ids uuid[];
  v_old_assignee_ids uuid[];
  v_unresolved_names text[];
  v_old_unresolved_names text[];
  v_actor_name text;
  v_previous_guard text;
begin
  if new.source = 'recurring' and new.recurrence_parent_id is not null then
    return new;
  end if;
  if current_setting('app.planner_assignment_projection_write', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.assigned_to_name is not distinct from old.assigned_to_name
    and new.helper_names is not distinct from old.helper_names
  then
    return new;
  end if;

  with legacy_names as (
    select new.assigned_to_name as legacy_name, 0::bigint as name_order
    where nullif(btrim(new.assigned_to_name), '') is not null
    union all
    select helper.name, helper.ordinality
    from unnest(coalesce(new.helper_names, '{}'::text[]))
      with ordinality as helper(name, ordinality)
    where nullif(btrim(helper.name), '') is not null
  ), matched as (
    select legacy.*, match.profile_ids, cardinality(match.profile_ids) as match_count
    from legacy_names legacy
    cross join lateral (
      select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[]) as profile_ids
      from public.profiles profile
      where profile.is_active
        and nullif(btrim(profile.full_name), '') is not null
        and profile.role in ('admin', 'manager', 'staff', 'team')
        and lower(btrim(profile.full_name)) = lower(btrim(legacy.legacy_name))
    ) match
  ), resolved_first as (
    select distinct on (profile_ids[1]) profile_ids[1] as profile_id, name_order
    from matched
    where match_count = 1
    order by profile_ids[1], name_order
  ), unresolved_first as (
    select distinct on (lower(btrim(legacy_name))) legacy_name, name_order
    from matched
    where match_count <> 1
    order by lower(btrim(legacy_name)), name_order
  )
  select
    coalesce((select array_agg(profile_id order by name_order, profile_id) from resolved_first), '{}'::uuid[]),
    coalesce((select array_agg(legacy_name order by name_order) from unresolved_first), '{}'::text[])
  into v_new_assignee_ids, v_unresolved_names;

  select coalesce(array_agg(assignment.profile_id order by assignment.position), '{}'::uuid[])
  into v_old_assignee_ids
  from public.planner_task_assignees assignment
  where assignment.task_id = new.id;

  v_old_unresolved_names := case
    when tg_op = 'INSERT' then '{}'::text[]
    else coalesce(old.unresolved_assignee_names, '{}'::text[])
  end;

  if v_old_assignee_ids is distinct from v_new_assignee_ids then
    delete from public.planner_task_assignees where task_id = new.id;
    insert into public.planner_task_assignees (task_id, profile_id, position, assigned_by)
    select new.id, requested.profile_id, requested.ordinality::integer - 1, auth.uid()
    from unnest(v_new_assignee_ids) with ordinality as requested(profile_id, ordinality);
  end if;

  if coalesce(new.unresolved_assignee_names, '{}'::text[]) is distinct from v_unresolved_names then
    v_previous_guard := current_setting('app.planner_assignment_projection_write', true);
    perform set_config('app.planner_assignment_projection_write', 'on', true);
    update public.planner_tasks
    set unresolved_assignee_names = v_unresolved_names
    where id = new.id;
    perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_guard, ''), true);
  end if;

  if v_old_assignee_ids is distinct from v_new_assignee_ids
    or v_old_unresolved_names is distinct from v_unresolved_names
  then
    select profile.full_name into v_actor_name
    from public.profiles profile
    where profile.id = auth.uid();
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', new.id, 'assignment_changed', auth.uid(), v_actor_name,
      jsonb_build_object(
        'old_profile_ids', to_jsonb(v_old_assignee_ids),
        'new_profile_ids', to_jsonb(v_new_assignee_ids),
        'old_unresolved_names', to_jsonb(v_old_unresolved_names),
        'new_unresolved_names', to_jsonb(v_unresolved_names),
        'origin', 'legacy_projection_sync'
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_planner_task_legacy_assignees()
  from public, anon, authenticated;

drop trigger if exists planner_tasks_sync_microsoft_assignees on public.planner_tasks;
drop trigger if exists planner_tasks_sync_legacy_assignees on public.planner_tasks;
create trigger planner_tasks_sync_legacy_assignees
  after insert or update of assigned_to_name, helper_names
  on public.planner_tasks
  for each row
  execute function public.sync_planner_task_legacy_assignees();

-- Recurrence materialisation inserts only the instance row. Inherit canonical
-- assignments and unresolved imported identities atomically after that insert,
-- without requiring client-side follow-up writes or producing audit noise.
create or replace function public.inherit_recurring_planner_task_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_guard text;
begin
  if new.recurrence_parent_id is null or new.source is distinct from 'recurring' then
    return new;
  end if;

  if not public.is_active_planner_manager() or not exists (
    select 1
    from public.planner_tasks parent
    join public.planner_boards board on board.id = parent.board_id
    where parent.id = new.recurrence_parent_id
      and parent.recurrence_rule is not null
      and parent.board_id = new.board_id
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ) then
    raise exception 'Recurring parent must be on the same visible Planner board';
  end if;

  v_previous_guard := current_setting('app.planner_assignment_projection_write', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  update public.planner_tasks instance
  set assigned_to_name = parent.assigned_to_name,
      helper_names = parent.helper_names,
      unresolved_assignee_names = parent.unresolved_assignee_names
  from public.planner_tasks parent
  where instance.id = new.id
    and parent.id = new.recurrence_parent_id;
  perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_guard, ''), true);

  insert into public.planner_task_assignees (
    task_id, profile_id, position, assigned_by
  )
  select new.id, assignment.profile_id, assignment.position, assignment.assigned_by
  from public.planner_task_assignees assignment
  where assignment.task_id = new.recurrence_parent_id
  order by assignment.position
  on conflict (task_id, profile_id) do nothing;

  return new;
end;
$$;

revoke all on function public.inherit_recurring_planner_task_assignments()
  from public, anon, authenticated;

drop trigger if exists planner_tasks_inherit_recurring_assignments on public.planner_tasks;
create trigger planner_tasks_inherit_recurring_assignments
  after insert on public.planner_tasks
  for each row
  when (new.recurrence_parent_id is not null and new.source = 'recurring')
  execute function public.inherit_recurring_planner_task_assignments();

create or replace function public.audit_direct_planner_task_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  if current_setting('app.planner_task_audit_write', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT'
    and new.source = 'recurring'
    and new.recurrence_parent_id is not null
  then
    return new;
  end if;

  select profile.full_name into v_actor_name
  from public.profiles profile
  where profile.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', new.id, 'created', auth.uid(), v_actor_name,
      jsonb_build_object(
        'board_id', new.board_id,
        'bucket_id', new.bucket_id,
        'origin', 'direct_write'
      )
    );
    return new;
  end if;

  if new.title is distinct from old.title
    or new.board_id is distinct from old.board_id
    or new.bucket_id is distinct from old.bucket_id
    or new.client_id is distinct from old.client_id
    or new.client_name is distinct from old.client_name
    or new.status is distinct from old.status
    or new.priority is distinct from old.priority
    or new.start_date is distinct from old.start_date
    or new.due_date is distinct from old.due_date
    or new.notes is distinct from old.notes
    or new.checklist is distinct from old.checklist
    or new.archived_at is distinct from old.archived_at
    or new.archived_by_name is distinct from old.archived_by_name
    or new.archive_reason is distinct from old.archive_reason
  then
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', new.id, 'task_updated', auth.uid(), v_actor_name,
      jsonb_build_object('origin', 'direct_write')
    );
  end if;

  return new;
end;
$$;

revoke all on function public.audit_direct_planner_task_write()
  from public, anon, authenticated;

drop trigger if exists planner_tasks_audit_direct_write on public.planner_tasks;
create trigger planner_tasks_audit_direct_write
  after insert or update on public.planner_tasks
  for each row execute function public.audit_direct_planner_task_write();

alter table public.planner_task_assignees enable row level security;

drop policy if exists "planner_tasks: manager insert" on public.planner_tasks;
drop policy if exists "planner_tasks: manager update" on public.planner_tasks;
drop policy if exists "planner_tasks: manager delete" on public.planner_tasks;
drop policy if exists "planner_tasks: admin insert" on public.planner_tasks;
drop policy if exists "planner_tasks: admin update" on public.planner_tasks;
drop policy if exists "planner_tasks: admin delete" on public.planner_tasks;
drop policy if exists "planner_tasks: active manager insert" on public.planner_tasks;
drop policy if exists "planner_tasks: active manager update" on public.planner_tasks;
drop policy if exists "planner_tasks: active manager delete" on public.planner_tasks;
create policy "planner_tasks: active manager insert"
  on public.planner_tasks for insert
  with check (
    public.is_active_planner_manager()
    and exists (
      select 1
      from public.planner_boards board
      where board.id = planner_tasks.board_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  );
create policy "planner_tasks: active manager update"
  on public.planner_tasks for update
  using (
    public.is_active_planner_manager()
    and exists (
      select 1
      from public.planner_boards board
      where board.id = planner_tasks.board_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  )
  with check (
    public.is_active_planner_manager()
    and exists (
      select 1
      from public.planner_boards board
      where board.id = planner_tasks.board_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  );

-- admin_only remains owner/admin visibility; managers see staff boards only.
drop policy if exists "planner_boards: staff select public" on public.planner_boards;
drop policy if exists "planner_boards: staff select visible" on public.planner_boards;
create policy "planner_boards: staff select visible"
  on public.planner_boards for select
  using (
    public.is_staff()
    and (
      visibility in ('public_internal', 'staff')
      or (visibility = 'admin_only' and public.is_admin())
    )
  );

drop policy if exists "planner_buckets: staff select" on public.planner_buckets;
drop policy if exists "planner_buckets: staff select visible" on public.planner_buckets;
create policy "planner_buckets: staff select visible"
  on public.planner_buckets for select
  using (
    public.is_staff()
    and exists (
      select 1
      from public.planner_boards board
      where board.id = planner_buckets.board_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  );

drop policy if exists "planner_tasks: staff select visible boards" on public.planner_tasks;
drop policy if exists "planner_tasks: staff select" on public.planner_tasks;
create policy "planner_tasks: staff select visible boards"
  on public.planner_tasks for select
  using (
    public.is_staff()
    and exists (
      select 1
      from public.planner_boards board
      where board.id = planner_tasks.board_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  );

drop policy if exists "planner_task_assignees: staff select visible boards"
  on public.planner_task_assignees;
create policy "planner_task_assignees: staff select visible boards"
  on public.planner_task_assignees for select
  using (
    public.is_staff()
    and exists (
      select 1
      from public.planner_tasks task
      join public.planner_boards board on board.id = task.board_id
      where task.id = planner_task_assignees.task_id
        and (
          board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and public.is_admin())
        )
    )
  );

revoke all on table public.planner_task_assignees from public, anon, authenticated;
grant select on table public.planner_task_assignees to authenticated;

drop function if exists public.list_planner_assignment_directory();
create or replace function public.list_planner_assignment_directory()
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then
    raise exception 'Staff access required';
  end if;

  return query
  select
    profile.id::uuid as result_profile_id,
    profile.full_name::text as result_full_name,
    profile.role::text as result_role,
    profile.avatar_url::text as result_avatar_url
  from public.profiles profile
  where profile.is_active
    and nullif(btrim(profile.full_name), '') is not null
    and profile.role in ('admin', 'manager', 'staff', 'team')
  order by lower(profile.full_name) nulls last, profile.id;
end;
$$;

drop function if exists public.list_planner_board_assignments(uuid);
create or replace function public.list_planner_board_assignments(p_board_id uuid default null)
returns table (
  task_id uuid,
  profile_id uuid,
  full_name text,
  role text,
  avatar_url text,
  "position" integer,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    assignment.task_id::uuid as result_task_id,
    profile.id::uuid as result_profile_id,
    profile.full_name::text as result_full_name,
    profile.role::text as result_role,
    profile.avatar_url::text as result_avatar_url,
    assignment.position::integer as result_position,
    profile.is_active::boolean as result_is_active
  from public.planner_task_assignees assignment
  join public.planner_tasks task on task.id = assignment.task_id
  join public.planner_boards board on board.id = task.board_id
  join public.profiles profile on profile.id = assignment.profile_id
  where public.is_staff()
    and exists (
      select 1
      from public.profiles caller
      where caller.id = auth.uid()
        and caller.is_active
        and caller.role in ('admin', 'manager', 'staff', 'team')
    )
    and (p_board_id is null or task.board_id = p_board_id)
    and (
      board.visibility in ('public_internal', 'staff')
      or (board.visibility = 'admin_only' and public.is_admin())
    )
  order by assignment.task_id, assignment.position;
$$;

create or replace function public.create_planner_task_with_assignees(
  p_title text,
  p_board_id uuid,
  p_bucket_id uuid,
  p_assignee_profile_ids uuid[] default '{}'::uuid[],
  p_status text default 'to_do',
  p_priority text default 'normal',
  p_start_date date default null,
  p_due_date date default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_notes text default null,
  p_checklist jsonb default '[]'::jsonb,
  p_unresolved_assignee_names text[] default '{}'::text[]
)
returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.planner_tasks;
  v_actor_name text;
  v_assignment_changed boolean;
  v_previous_projection_guard text;
  v_previous_audit_guard text;
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Planner task title is required';
  end if;
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'Planner checklist must be an array';
  end if;
  if not exists (
    select 1 from public.planner_boards board
    where board.id = p_board_id
      and board.archived_at is null
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ) then
    raise exception 'Planner board not found or not visible';
  end if;
  if not exists (
    select 1 from public.planner_buckets bucket
    where bucket.id = p_bucket_id
      and bucket.board_id = p_board_id
      and bucket.archived_at is null
  ) then
    raise exception 'Planner bucket does not belong to board';
  end if;
  v_previous_projection_guard := current_setting('app.planner_assignment_projection_write', true);
  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  insert into public.planner_tasks (
    board_id,
    bucket_id,
    title,
    client_id,
    client_name,
    assigned_to_name,
    helper_names,
    unresolved_assignee_names,
    status,
    priority,
    start_date,
    due_date,
    notes,
    checklist,
    source,
    import_hash
  ) values (
    p_board_id,
    p_bucket_id,
    btrim(p_title),
    p_client_id,
    p_client_name,
    null,
    '{}'::text[],
    coalesce(p_unresolved_assignee_names, '{}'::text[]),
    p_status,
    p_priority,
    p_start_date,
    p_due_date,
    p_notes,
    p_checklist,
    'manual',
    'manual-' || gen_random_uuid()::text
  )
  returning * into v_task;
  perform set_config(
    'app.planner_assignment_projection_write',
    coalesce(v_previous_projection_guard, ''),
    true
  );
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);

  select profile.full_name into v_actor_name
  from public.profiles profile
  where profile.id = auth.uid();

  insert into public.planner_activity_log (
    entity_type, entity_id, action, actor_user_id, actor_name, metadata
  ) values (
    'planner_task', v_task.id, 'created', auth.uid(), v_actor_name,
    jsonb_build_object('board_id', p_board_id, 'bucket_id', p_bucket_id)
  );

  select public.set_planner_task_assignees_internal(
    v_task.id,
    p_assignee_profile_ids,
    auth.uid(),
    true,
    'create_rpc'
  ) into v_assignment_changed;

  if not v_assignment_changed
    and cardinality(coalesce(p_unresolved_assignee_names, '{}'::text[])) > 0
  then
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', v_task.id, 'assignment_changed', auth.uid(), v_actor_name,
      jsonb_build_object(
        'old_profile_ids', '[]'::jsonb,
        'new_profile_ids', '[]'::jsonb,
        'unresolved_names', to_jsonb(p_unresolved_assignee_names),
        'origin', 'create_rpc'
      )
    );
  end if;

  select * into v_task from public.planner_tasks where id = v_task.id;

  return v_task;
end;
$$;

create or replace function public.set_planner_task_assignees(
  p_task_id uuid,
  p_profile_ids uuid[] default '{}'::uuid[]
)
returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.planner_tasks;
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;

  select * into v_task
  from public.planner_tasks
  where id = p_task_id
  for update;
  if v_task.id is null then
    raise exception 'Planner task not found';
  end if;

  if not exists (
    select 1 from public.planner_boards board
    where board.id = v_task.board_id
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ) then
    raise exception 'Planner board not visible';
  end if;

  perform public.set_planner_task_assignees_internal(
    p_task_id,
    p_profile_ids,
    auth.uid(),
    true,
    'set_rpc'
  );

  select * into v_task from public.planner_tasks where id = p_task_id;

  return v_task;
end;
$$;

create or replace function public.update_planner_task_with_assignees(
  p_task_id uuid,
  p_title text,
  p_client_id uuid,
  p_client_name text,
  p_bucket_id uuid,
  p_status text,
  p_priority text,
  p_start_date date,
  p_due_date date,
  p_notes text,
  p_checklist jsonb,
  p_profile_ids uuid[] default '{}'::uuid[]
)
returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.planner_tasks;
  v_core_changed boolean;
  v_actor_name text;
  v_previous_audit_guard text;
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Planner task title is required';
  end if;
  if p_status not in (
    'to_do', 'in_progress', 'blocked', 'waiting_client',
    'ready_internal_review', 'approved', 'scheduled', 'done'
  ) then
    raise exception 'Unsupported Planner status';
  end if;
  if p_priority not in ('normal', 'client_request', 'urgent') then
    raise exception 'Unsupported Planner priority';
  end if;
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'Planner checklist must be an array';
  end if;
  if p_client_id is not null and not exists (
    select 1 from public.clients client where client.id = p_client_id
  ) then
    raise exception 'Planner client not found';
  end if;

  select * into v_task
  from public.planner_tasks
  where id = p_task_id
  for update;
  if v_task.id is null then
    raise exception 'Planner task not found';
  end if;
  if not exists (
    select 1 from public.planner_boards board
    where board.id = v_task.board_id
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ) then
    raise exception 'Planner board not visible';
  end if;
  if p_bucket_id is not null and not exists (
    select 1 from public.planner_buckets bucket
    where bucket.id = p_bucket_id
      and bucket.board_id = v_task.board_id
      and bucket.archived_at is null
  ) then
    raise exception 'Planner bucket does not belong to board';
  end if;

  v_core_changed :=
    v_task.title is distinct from btrim(p_title)
    or v_task.client_id is distinct from p_client_id
    or v_task.client_name is distinct from p_client_name
    or v_task.bucket_id is distinct from p_bucket_id
    or v_task.status is distinct from p_status
    or v_task.priority is distinct from p_priority
    or v_task.start_date is distinct from p_start_date
    or v_task.due_date is distinct from p_due_date
    or v_task.notes is distinct from p_notes
    or v_task.checklist is distinct from p_checklist;

  if v_core_changed then
    v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
    perform set_config('app.planner_task_audit_write', 'on', true);
    update public.planner_tasks
    set title = btrim(p_title),
        client_id = p_client_id,
        client_name = p_client_name,
        bucket_id = p_bucket_id,
        status = p_status,
        priority = p_priority,
        start_date = p_start_date,
        due_date = p_due_date,
        notes = p_notes,
        checklist = p_checklist
    where id = p_task_id;
    perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);

    select profile.full_name into v_actor_name
    from public.profiles profile
    where profile.id = auth.uid();
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', p_task_id, 'task_updated', auth.uid(), v_actor_name,
      jsonb_build_object(
        'old', jsonb_build_object(
          'title', v_task.title, 'client_id', v_task.client_id,
          'client_name', v_task.client_name, 'bucket_id', v_task.bucket_id,
          'status', v_task.status, 'priority', v_task.priority,
          'start_date', v_task.start_date, 'due_date', v_task.due_date,
          'notes', v_task.notes, 'checklist', v_task.checklist
        ),
        'new', jsonb_build_object(
          'title', btrim(p_title), 'client_id', p_client_id,
          'client_name', p_client_name, 'bucket_id', p_bucket_id,
          'status', p_status, 'priority', p_priority,
          'start_date', p_start_date, 'due_date', p_due_date,
          'notes', p_notes, 'checklist', p_checklist
        )
      )
    );
  end if;

  perform public.set_planner_task_assignees_internal(
    p_task_id,
    p_profile_ids,
    auth.uid(),
    true,
    'update_rpc'
  );

  select * into v_task from public.planner_tasks where id = p_task_id;
  return v_task;
end;
$$;

create or replace function public.update_planner_task_status(p_task_id uuid, p_status text)
returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_profile_active boolean;
  v_name_matches uuid[];
  v_task public.planner_tasks;
  v_old_status text;
  v_previous_audit_guard text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;
  if p_status not in (
    'to_do', 'in_progress', 'blocked', 'waiting_client',
    'ready_internal_review', 'approved', 'scheduled', 'done'
  ) then
    raise exception 'Unsupported Planner status';
  end if;

  select profile.full_name, profile.is_active
  into v_profile_name, v_profile_active
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if not found or not coalesce(v_profile_active, false) then
    raise exception 'Active staff access required';
  end if;

  select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[])
  into v_name_matches
  from public.profiles profile
  where profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team')
    and nullif(btrim(v_profile_name), '') is not null
    and lower(btrim(profile.full_name)) = lower(btrim(v_profile_name));

  select * into v_task
  from public.planner_tasks
  where id = p_task_id
  for update;
  if v_task.id is null then
    raise exception 'Planner task not found';
  end if;

  if not exists (
    select 1
    from public.planner_boards board
    where board.id = v_task.board_id
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ) then
    raise exception 'Planner board not visible';
  end if;

  if not public.is_active_planner_manager() then
    if exists (
      select 1
      from public.planner_task_assignees assignment
      where assignment.task_id = p_task_id
    ) then
      if not exists (
        select 1
        from public.planner_task_assignees assignment
        where assignment.task_id = p_task_id
          and assignment.profile_id = auth.uid()
      ) then
        raise exception 'Planner task is not assigned to this user';
      end if;
    elsif nullif(btrim(v_profile_name), '') is null
      or cardinality(v_name_matches) <> 1
      or v_name_matches[1] is distinct from auth.uid()
      or (
        lower(btrim(coalesce(v_task.assigned_to_name, ''))) <> lower(btrim(v_profile_name))
        and not exists (
          select 1
          from unnest(coalesce(v_task.helper_names, '{}'::text[])) helper(name)
          where lower(btrim(helper.name)) = lower(btrim(v_profile_name))
        )
      )
    then
      raise exception 'Planner task is not assigned to this user';
    end if;
  end if;

  v_old_status := v_task.status;
  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  update public.planner_tasks
  set status = p_status
  where id = p_task_id
  returning * into v_task;
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);

  if v_old_status is distinct from p_status then
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', p_task_id, 'status_changed', auth.uid(), v_profile_name,
      jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
    );
  end if;

  return v_task;
end;
$$;

drop policy if exists "planner_activity_log: staff insert" on public.planner_activity_log;
drop policy if exists "planner_activity_log: staff select" on public.planner_activity_log;
drop policy if exists "planner_activity_log: visible planner task select"
  on public.planner_activity_log;
create policy "planner_activity_log: visible planner task select"
  on public.planner_activity_log for select
  using (
    public.is_staff()
    and (
      (
        entity_type = 'planner_task'
        and exists (
          select 1
          from public.planner_tasks task
          join public.planner_boards board on board.id = task.board_id
          where task.id = planner_activity_log.entity_id
            and (
              board.visibility in ('public_internal', 'staff')
              or (board.visibility = 'admin_only' and public.is_admin())
            )
        )
      )
      or (
        entity_type <> 'planner_task'
        and public.is_manager()
      )
    )
  );

revoke insert, update, delete on table public.planner_activity_log
  from public, anon, authenticated;
grant select on table public.planner_activity_log to authenticated;

drop function if exists public.list_planner_workload_summary();
create or replace function public.list_planner_workload_summary()
returns table (
  profile_id uuid,
  full_name text,
  role text,
  avatar_url text,
  active_task_count bigint,
  overdue_count bigint,
  blocked_count bigint,
  due_today_count bigint,
  due_next_7_days_count bigint,
  unassigned_total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;

  return query
  with active_tasks as (
    select task.id, task.status, task.due_date
    from public.planner_tasks task
    join public.planner_boards board on board.id = task.board_id
    where task.archived_at is null
      and task.recurrence_rule is null
      and task.status not in ('approved', 'scheduled', 'done')
      and board.archived_at is null
      and board.board_type <> 'client_schedule'
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ), unassigned as (
    select count(*)::bigint as total
    from active_tasks task
    where not exists (
      select 1
      from public.planner_task_assignees assignment
      join public.profiles assignee on assignee.id = assignment.profile_id
      where assignment.task_id = task.id
        and assignee.is_active
        and assignee.role in ('admin', 'manager', 'staff', 'team')
    )
  )
  select
    profile.id::uuid as result_profile_id,
    profile.full_name::text as result_full_name,
    profile.role::text as result_role,
    profile.avatar_url::text as result_avatar_url,
    count(task.id)::bigint as result_active_task_count,
    count(task.id) filter (where task.due_date < current_date)::bigint as result_overdue_count,
    count(task.id) filter (where task.status = 'blocked')::bigint as result_blocked_count,
    count(task.id) filter (where task.due_date = current_date)::bigint as result_due_today_count,
    count(task.id) filter (
      where task.due_date > current_date
        and task.due_date <= current_date + 7
    )::bigint as result_due_next_7_days_count,
    unassigned.total::bigint as result_unassigned_total
  from public.profiles profile
  cross join unassigned
  left join public.planner_task_assignees assignment on assignment.profile_id = profile.id
  left join active_tasks task on task.id = assignment.task_id
  where profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team')
    and nullif(btrim(profile.full_name), '') is not null
  group by profile.id, profile.full_name, profile.role, profile.avatar_url, unassigned.total
  order by lower(profile.full_name) nulls last, profile.id;
end;
$$;

drop function if exists public.list_planner_workload_tasks();
create or replace function public.list_planner_workload_tasks()
returns table (
  task_id uuid,
  title text,
  status text,
  priority text,
  start_date date,
  due_date date,
  client_name text,
  board_id uuid,
  board_name text,
  bucket_id uuid,
  bucket_name text,
  assignee_profile_ids uuid[],
  is_unassigned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;

  return query
  with active_tasks as (
    select task.*
    from public.planner_tasks task
    join public.planner_boards board on board.id = task.board_id
    where task.archived_at is null
      and task.recurrence_rule is null
      and task.status not in ('approved', 'scheduled', 'done')
      and board.archived_at is null
      and board.board_type <> 'client_schedule'
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  )
  select
    task.id::uuid as result_task_id,
    task.title::text as result_title,
    task.status::text as result_status,
    task.priority::text as result_priority,
    task.start_date::date as result_start_date,
    task.due_date::date as result_due_date,
    task.client_name::text as result_client_name,
    board.id::uuid as result_board_id,
    board.name::text as result_board_name,
    bucket.id::uuid as result_bucket_id,
    bucket.name::text as result_bucket_name,
    active_assignees.profile_ids::uuid[] as result_assignee_profile_ids,
    (cardinality(active_assignees.profile_ids) = 0)::boolean as result_is_unassigned
  from active_tasks task
  join public.planner_boards board on board.id = task.board_id
  left join public.planner_buckets bucket on bucket.id = task.bucket_id
  cross join lateral (
    select coalesce(
      array_agg(assignment.profile_id order by assignment.position)
        filter (where assignee.id is not null),
      '{}'::uuid[]
    ) as profile_ids
    from public.planner_task_assignees assignment
    join public.profiles assignee
      on assignee.id = assignment.profile_id
      and assignee.is_active
      and assignee.role in ('admin', 'manager', 'staff', 'team')
    where assignment.task_id = task.id
  ) active_assignees
  order by task.due_date nulls last, task.created_at, task.id;
end;
$$;

revoke all on function public.list_planner_assignment_directory() from public, anon, authenticated;
revoke all on function public.list_planner_board_assignments(uuid) from public, anon, authenticated;
revoke all on function public.create_planner_task_with_assignees(
  text, uuid, uuid, uuid[], text, text, date, date, uuid, text, text, jsonb, text[]
) from public, anon, authenticated;
revoke all on function public.set_planner_task_assignees(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.update_planner_task_with_assignees(
  uuid, text, uuid, text, uuid, text, text, date, date, text, jsonb, uuid[]
) from public, anon, authenticated;
revoke all on function public.update_planner_task_status(uuid, text) from public, anon, authenticated;
revoke all on function public.list_planner_workload_summary() from public, anon, authenticated;
revoke all on function public.list_planner_workload_tasks() from public, anon, authenticated;

grant execute on function public.list_planner_assignment_directory() to authenticated;
grant execute on function public.list_planner_board_assignments(uuid) to authenticated;
grant execute on function public.create_planner_task_with_assignees(
  text, uuid, uuid, uuid[], text, text, date, date, uuid, text, text, jsonb, text[]
) to authenticated;
grant execute on function public.set_planner_task_assignees(uuid, uuid[]) to authenticated;
grant execute on function public.update_planner_task_with_assignees(
  uuid, text, uuid, text, uuid, text, text, date, date, text, jsonb, uuid[]
) to authenticated;
grant execute on function public.update_planner_task_status(uuid, text) to authenticated;
grant execute on function public.list_planner_workload_summary() to authenticated;
grant execute on function public.list_planner_workload_tasks() to authenticated;

notify pgrst, 'reload schema';
