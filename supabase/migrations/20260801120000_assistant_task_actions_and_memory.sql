-- CG Assistant: direct task actions + durable per-user memory.
--
-- planner_tasks direct INSERT/UPDATE is manager-only via RLS. Staff act on
-- tasks through CG Assistant via these audited SECURITY DEFINER RPCs, which
-- enforce role rules server-side, write the canonical audit log, and notify the
-- assignee. No hidden AI task store and no privileged bypass: tasks land on the
-- real operations board and flow through the same activity log + notifications
-- as every other task.
--
-- assistant_memory is strictly per-user (RLS: user_id = auth.uid()), so each
-- staff member's memory is isolated — no cross-user or cross-client leakage, and
-- clients (no staff profile) have none. Idempotent; already applied in prod.

-- ── Durable per-user assistant memory ───────────────────────────────────────
create table if not exists public.assistant_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'note',
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_memory_user_idx
  on public.assistant_memory (user_id, created_at desc);

alter table public.assistant_memory enable row level security;

drop policy if exists "assistant_memory own all" on public.assistant_memory;
create policy "assistant_memory own all" on public.assistant_memory
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Create a task from CG Assistant (audited, notifies assignee) ─────────────
create or replace function public.create_assistant_task(
  p_title text,
  p_assignee_name text default null,
  p_due_date date default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_notes text default null
) returns public.planner_tasks
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.planner_tasks; v_board uuid; v_bucket uuid; assignee_id uuid; actor_name text;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  if coalesce(btrim(p_title),'') = '' then raise exception 'Task title required'; end if;
  select id into v_board from public.planner_boards where slug = 'operations-todo' and archived_at is null limit 1;
  select bk.id into v_bucket from public.planner_buckets bk
    where bk.board_id = v_board and bk.archived_at is null
      and upper(bk.name) = case when p_client_id is not null then 'CLIENT REQUESTS' else 'ADMIN / TO DO' end
    limit 1;
  if v_bucket is null then
    select id into v_bucket from public.planner_buckets where board_id = v_board and archived_at is null order by sort_order limit 1;
  end if;
  insert into public.planner_tasks(board_id, bucket_id, title, client_id, client_name, assigned_to_name, due_date, notes, status, priority, source, import_hash, checklist)
  values (v_board, v_bucket, btrim(p_title), p_client_id, p_client_name, nullif(btrim(coalesce(p_assignee_name,'')),''), p_due_date, p_notes, 'to_do', 'normal', 'cg_assistant', 'cga-' || gen_random_uuid()::text, '[]'::jsonb)
  returning * into t;
  select full_name into actor_name from public.profiles where id = auth.uid();
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', t.id, 'assistant_created', auth.uid(), actor_name, jsonb_build_object('title', t.title, 'assignee', t.assigned_to_name, 'due_date', t.due_date));
  if t.assigned_to_name is not null then
    select id into assignee_id from public.profiles where lower(full_name) = lower(t.assigned_to_name) and coalesce(role,'') <> 'client' limit 1;
    if assignee_id is not null and assignee_id <> auth.uid() then
      insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
      values (assignee_id, 'task_assigned', 'New task assigned', coalesce(actor_name,'CG Assistant') || ' assigned you: ' || t.title, 'planner_task', t.id);
    end if;
  end if;
  return t;
end $function$;

-- ── Update an existing task from CG Assistant (role-gated, audited) ──────────
-- reassign/assign/due  → manager only
-- complete/comment/block → manager OR the assignee
create or replace function public.update_assistant_task(
  p_task_id uuid,
  p_action text,
  p_assignee_name text default null,
  p_due_date date default null,
  p_comment text default null
) returns public.planner_tasks
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.planner_tasks; actor_name text; assignee_id uuid; is_assignee boolean;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select full_name into actor_name from public.profiles where id = auth.uid();
  select * into t from public.planner_tasks where id = p_task_id for update;
  if t.id is null then raise exception 'Task not found'; end if;
  is_assignee := t.assigned_to_name is not null and lower(t.assigned_to_name) = lower(coalesce(actor_name,''));
  if p_action in ('reassign','assign','due') and not is_manager() then raise exception 'Only a manager can reassign or reschedule tasks'; end if;
  if p_action in ('complete','comment','block') and not (is_manager() or is_assignee) then raise exception 'Only a manager or the assignee can update this task'; end if;
  if p_action = 'reassign' or p_action = 'assign' then
    update public.planner_tasks set assigned_to_name = nullif(btrim(coalesce(p_assignee_name,'')),''), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'due' then
    update public.planner_tasks set due_date = p_due_date, updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'complete' then
    update public.planner_tasks set archived_at = now(), archived_by_name = actor_name, archive_reason = coalesce(p_comment,'Completed via CG Assistant'), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'block' then
    update public.planner_tasks set notes = coalesce(notes,'') || E'\n[BLOCKED] ' || coalesce(p_comment,'') || ' - ' || coalesce(actor_name,''), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'comment' then
    update public.planner_tasks set notes = coalesce(notes,'') || E'\n' || coalesce(actor_name,'') || ': ' || coalesce(p_comment,''), updated_at = now() where id = p_task_id returning * into t;
  else raise exception 'Unknown task action: %', p_action; end if;
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', t.id, 'assistant_' || p_action, auth.uid(), actor_name, jsonb_build_object('assignee', t.assigned_to_name, 'due_date', t.due_date, 'comment', p_comment));
  if p_action in ('reassign','assign') and t.assigned_to_name is not null then
    select id into assignee_id from public.profiles where lower(full_name) = lower(t.assigned_to_name) and coalesce(role,'') <> 'client' limit 1;
    if assignee_id is not null and assignee_id <> auth.uid() then
      insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
      values (assignee_id, 'task_assigned', 'Task assigned to you', coalesce(actor_name,'CG Assistant') || ' assigned you: ' || t.title, 'planner_task', t.id);
    end if;
  end if;
  return t;
end $function$;
