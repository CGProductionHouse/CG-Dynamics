-- ============================================================
-- Phase 11a: Client portal read access
--
-- Lets a signed-in CLIENT user read their own schedule data so the
-- client dashboard "month ahead" module can show scheduled posts and
-- client-relevant events. Staff previews already work without this.
--
-- DO NOT RUN LIVE without review in the Supabase SQL editor.
-- Read-only policies only — clients can never insert/update/delete.
-- ============================================================

-- A client user may read their own monthly deliverables (the schedule
-- source of truth). The app renders only client-safe fields, but the
-- row filter is the hard boundary: only rows linked to their client_id.
create policy "monthly_deliverables: client reads own"
  on public.monthly_deliverables for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'client'
        and p.client_id = monthly_deliverables.client_id
    )
  );

-- A client user may read their own client-relevant company calendar
-- events: shoots, content runs and client events only. Internal
-- meetings, internal events, deadlines and cancelled events stay
-- invisible at the database level.
create policy "company_calendar_events: client reads own"
  on public.company_calendar_events for select
  using (
    event_type in ('shoot', 'content_run', 'client_event')
    and status <> 'cancelled'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'client'
        and p.client_id = company_calendar_events.client_id
    )
  );

-- ── Verification (run after applying) ────────────────────────
-- As a client user:
--   select count(*) from public.monthly_deliverables;        -- only own rows
--   select count(*) from public.company_calendar_events;     -- only own safe events
-- ============================================================
