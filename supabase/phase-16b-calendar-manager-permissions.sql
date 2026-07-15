-- ============================================================
-- Phase 16b: Calendar manager permissions
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
-- Staff retain Calendar visibility. Managers/admins manage normal events.
-- ============================================================

drop policy if exists "company_calendar_events: staff insert" on public.company_calendar_events;
drop policy if exists "company_calendar_events: staff update" on public.company_calendar_events;
drop policy if exists "company_calendar_events: admin delete" on public.company_calendar_events;
drop policy if exists "company_calendar_events: manager insert" on public.company_calendar_events;
drop policy if exists "company_calendar_events: manager update" on public.company_calendar_events;
drop policy if exists "company_calendar_events: manager delete" on public.company_calendar_events;

create policy "company_calendar_events: manager insert"
on public.company_calendar_events for insert
with check (public.is_manager());

create policy "company_calendar_events: manager update"
on public.company_calendar_events for update
using (public.is_manager())
with check (public.is_manager());

create policy "company_calendar_events: manager delete"
on public.company_calendar_events for delete
using (public.is_manager());
