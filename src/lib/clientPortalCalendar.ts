import { supabase } from './supabase'
import {
  PACKAGE_DELIVERABLE_TYPES,
  getEffectiveScheduleDate,
  listMonthlyDeliverablesByMonth,
  toClientSafeStatus,
  type ClientSafeStatus,
  type DeliverableType,
  type MonthlyDeliverable,
} from './planner'
import type { CompanyEventType } from './companyCalendar'

// ── Client portal "month ahead" calendar ──────────────────────────────────────
//
// Read-only, client-safe view of what CG has planned for a client this month:
// scheduled posts from monthly_deliverables (the schedule source of truth) and
// client-relevant company calendar events (shoots, content runs, client
// events). Never exposes assignees, helpers, internal notes or codes.
//
// RLS note: monthly_deliverables and company_calendar_events are staff-select
// today, so a client login receives empty lists until the prepared
// phase-11a-client-portal-read-access.sql migration is applied. Callers should
// hide the module when it has no content — staff previews (Client Preview)
// already see the real data.

// Only these event types are client-relevant. Internal meetings, internal
// admin events and deadlines never reach the client portal.
const CLIENT_SAFE_EVENT_TYPES: CompanyEventType[] = ['shoot', 'content_run', 'client_event']

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

function toClientPost(deliverable: MonthlyDeliverable): ClientCalendarPost {
  return {
    id: deliverable.id,
    date: getEffectiveScheduleDate(deliverable),
    title: deliverable.title,
    type: deliverable.deliverable_type,
    status: toClientSafeStatus(deliverable.production_status),
  }
}

export async function fetchClientMonthAhead(clientId: string, month: string): Promise<ClientMonthAhead> {
  const monthStart = `${month}-01`
  const [year, m] = month.split('-').map(Number)
  const nextMonthStart = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`

  const [postsResult, eventsResult] = await Promise.all([
    listMonthlyDeliverablesByMonth(monthStart, { clientId }),
    supabase
      .from('company_calendar_events')
      .select('id, title, event_type, start_at, end_at, all_day, location, status')
      .eq('client_id', clientId)
      .in('event_type', CLIENT_SAFE_EVENT_TYPES)
      .neq('status', 'cancelled')
      .gte('start_at', `${monthStart}T00:00:00Z`)
      .lt('start_at', `${nextMonthStart}T00:00:00Z`)
      .order('start_at'),
  ])

  const posts = (postsResult.data ?? [])
    .filter(item => PACKAGE_DELIVERABLE_TYPES.includes(item.deliverable_type))
    .map(toClientPost)
    .sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31'))

  const events: ClientCalendarEvent[] = (eventsResult.data ?? []).map(row => ({
    id: row.id as string,
    startAt: row.start_at as string,
    endAt: (row.end_at as string | null) ?? null,
    allDay: Boolean(row.all_day),
    title: row.title as string,
    type: row.event_type as CompanyEventType,
    location: (row.location as string | null) ?? null,
  }))

  return {
    month,
    posts,
    events,
    loadFailed: Boolean(postsResult.error && eventsResult.error),
  }
}
