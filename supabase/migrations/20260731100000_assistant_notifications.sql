-- CG Assistant in-app notifications (APPLIED to production, migration:
-- assistant_notifications_and_approval_wiring). Staff-only — clients are
-- completely outside CG Assistant. Inserts happen only through the SECURITY
-- DEFINER create_notification(), which refuses client targets; users read and
-- mark-read only their own rows via RLS. The Client Schedule approval RPCs and
-- proposal trigger notify the relevant staff (admins on proposal, the requester
-- on approve/reject).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No INSERT policy: notifications are created only via create_notification().

create or replace function public.create_notification(
  p_user_id uuid, p_type text, p_title text, p_body text default null,
  p_entity_type text default null, p_entity_id uuid default null, p_link text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare target_role text; nid uuid;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select role into target_role from public.profiles where id = p_user_id;
  -- Clients never receive CG Assistant notifications.
  if target_role is null or target_role = 'client' then return null; end if;
  insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link)
  values (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link)
  returning id into nid;
  return nid;
end $$;
revoke all on function public.create_notification(uuid,text,text,text,text,uuid,text) from public;
grant execute on function public.create_notification(uuid,text,text,text,text,uuid,text) to authenticated;
