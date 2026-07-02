import { supabase } from './supabase'
import { type ClientSafeStatus, type DeliverableType } from './planner'
import type { CompanyEventType } from './companyCalendar'

// ── Client portal "month ahead" calendar ──────────────────────────────────────
//
// Read-only, client-safe view of what CG has planned for a client this month.
// Data comes through safe RPCs that expose only client-facing fields, never
// assignees, helpers, internal notes, codes, priorities or linked internal IDs.
//
// RLS note: clients must not receive direct SELECT on monthly_deliverables or
// company_calendar_events. The phase-11a migration creates RPCs that enforce
// auth.uid() ownership and return only the columns used here. Staff/admin
// previews pass a client id to the same safe RPCs.

export interface ClientCalendarPost {
  id: string
  /** YYYY-MM-DD, or null while CG is still placing the post. */
  date: string | null
  title: string
  type: DeliverableType
  status: ClientSafeStatus
}

export interface ClientCalendarEvent {
  id: string
  /** ISO timestamp. */
  startAt: string
  endAt: string | null
  allDay: boolean
  title: string
  type: CompanyEventType
  location: string | null
}

export interface ClientMonthAhead {
  /** YYYY-MM */
  month: string
  posts: ClientCalendarPost[]
  events: ClientCalendarEvent[]
  /** True when either query failed outright (not merely empty). */
  loadFailed: boolean
}

type ClientPortalPostRow = {
  row_key: string
  schedule_date: string | null
  title: string
  post_type: string
  client_safe_status: string
}

type ClientPortalEventRow = {
  row_key: string
  title: string
  event_type: string
  start_time: string
  end_time: string | null
  all_day: boolean
  location: string | null
}

export async function fetchClientMonthAhead(clientId: string, month: string): Promise<ClientMonthAhead> {
  const monthStart = `${month}-01`

  const [postsResult, eventsResult] = await Promise.all([
    supabase.rpc('client_portal_month_ahead_posts', { p_client_id: clientId, p_month: monthStart }),
    supabase.rpc('client_portal_month_ahead_events', { p_client_id: clientId, p_month: monthStart }),
  ])

  const posts: ClientCalendarPost[] = ((postsResult.data ?? []) as ClientPortalPostRow[]).map(row => ({
    id: row.row_key,
    date: row.schedule_date,
    title: row.title,
    type: row.post_type as DeliverableType,
    status: row.client_safe_status as ClientSafeStatus,
  }))

  const events: ClientCalendarEvent[] = ((eventsResult.data ?? []) as ClientPortalEventRow[]).map(row => ({
    id: row.row_key,
    startAt: row.start_time,
    endAt: row.end_time,
    allDay: row.all_day,
    title: row.title,
    type: row.event_type as CompanyEventType,
    location: row.location,
  }))

  return {
    month,
    posts,
    events,
    loadFailed: Boolean(postsResult.error || eventsResult.error),
  }
}
