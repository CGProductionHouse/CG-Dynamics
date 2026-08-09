import { supabase } from './supabase'
import { type ClientSafeStatus, type DeliverableType } from './planner'
import type { CompanyEventType } from './companyCalendar'

// ── Client portal "month ahead" calendar ──────────────────────────────────────
//
// Read-only, client-safe view of what CG has planned for a client this month.
// Data comes through safe RPCs that expose only client-facing fields, never
// assignees, helpers, internal notes, codes, priorities or linked internal IDs.
//
// Clients never receive direct table access. The visibility-contract RPCs
// enforce active-profile ownership and return only the fields used here.
// Staff previews pass a client id through the same safe projection.

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
  /** Opaque key for this event's published, same-client Content Guideline. */
  guidelineKey: string | null
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
  guideline_row_key: string | null
}

type ClientPortalRpcResult = { data: unknown; error: unknown }
type ClientPortalRpc = (functionName: string, args?: Record<string, unknown>) => Promise<ClientPortalRpcResult>

const CLIENT_PORTAL_POST_TYPES = new Set(['dp', 'photo', 'video', 'reel'])
const CLIENT_PORTAL_POST_STATUSES = new Set(['awaiting_approval', 'approved', 'scheduled', 'posted'])
const CLIENT_PORTAL_EVENT_TYPES = new Set(['shoot', 'content_run', 'client_event'])

export async function fetchClientMonthAheadWithRpc(
  rpc: ClientPortalRpc,
  clientId: string,
  month: string,
): Promise<ClientMonthAhead> {
  const monthStart = `${month}-01`
  const unavailable = { month, posts: [], events: [], loadFailed: true }

  const capability = await rpc('client_portal_visibility_contract_version')
  if (capability.error || capability.data !== 1) return unavailable

  const [postsResult, eventsResult] = await Promise.all([
    rpc('client_portal_month_ahead_posts_v2', { p_client_id: clientId, p_month: monthStart }),
    rpc('client_portal_month_ahead_events', { p_client_id: clientId, p_month: monthStart }),
  ])
  if (postsResult.error || eventsResult.error) return unavailable

  const posts: ClientCalendarPost[] = ((postsResult.data ?? []) as ClientPortalPostRow[])
    .filter(row => CLIENT_PORTAL_POST_TYPES.has(row.post_type) && CLIENT_PORTAL_POST_STATUSES.has(row.client_safe_status))
    .map(row => ({
      id: row.row_key,
      date: row.schedule_date,
      title: row.title,
      type: row.post_type as DeliverableType,
      status: row.client_safe_status as ClientSafeStatus,
    }))

  const events: ClientCalendarEvent[] = ((eventsResult.data ?? []) as ClientPortalEventRow[])
    .filter(row => CLIENT_PORTAL_EVENT_TYPES.has(row.event_type))
    .map(row => ({
      id: row.row_key,
      startAt: row.start_time,
      endAt: row.end_time,
      allDay: row.all_day,
      title: row.title,
      type: row.event_type as CompanyEventType,
      location: row.location,
      guidelineKey: row.guideline_row_key,
    }))

  return {
    month,
    posts,
    events,
    loadFailed: false,
  }
}

export async function fetchClientMonthAhead(clientId: string, month: string): Promise<ClientMonthAhead> {
  return fetchClientMonthAheadWithRpc(async (functionName, args) => {
    const { data, error } = await supabase.rpc(functionName, args)
    return { data, error }
  }, clientId, month)
}
