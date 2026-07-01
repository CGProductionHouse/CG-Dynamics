import { supabase } from './supabase'

export type CompanyEventType =
  | 'meeting'
  | 'shoot'
  | 'content_run'
  | 'client_event'
  | 'internal'
  | 'deadline'

export type CompanyEventStatus =
  | 'planned'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

export interface CompanyCalendarEvent {
  id: string
  title: string
  event_type: CompanyEventType
  client_id: string | null
  client_name: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  location: string | null
  notes: string | null
  assigned_to_name: string | null
  status: CompanyEventStatus
  linked_deliverable_id: string | null
  linked_task_id: string | null
  created_at: string
  updated_at: string
}

export interface CompanyEventInput {
  title: string
  event_type: CompanyEventType
  client_id?: string | null
  client_name?: string | null
  start_at: string
  end_at?: string | null
  all_day?: boolean
  location?: string | null
  notes?: string | null
  assigned_to_name?: string | null
  status?: CompanyEventStatus
  linked_deliverable_id?: string | null
  linked_task_id?: string | null
}

export interface CompanyEventPatch {
  title?: string
  event_type?: CompanyEventType
  client_id?: string | null
  client_name?: string | null
  start_at?: string
  end_at?: string | null
  all_day?: boolean
  location?: string | null
  notes?: string | null
  assigned_to_name?: string | null
  status?: CompanyEventStatus
  linked_deliverable_id?: string | null
  linked_task_id?: string | null
}

export interface CompanyEventResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
  tableMissing: boolean
}

const TABLE = 'company_calendar_events'

export const EVENT_TYPES: CompanyEventType[] = [
  'meeting', 'shoot', 'content_run', 'client_event', 'internal', 'deadline',
]

export const EVENT_STATUSES: CompanyEventStatus[] = [
  'planned', 'confirmed', 'completed', 'cancelled',
]

export const EVENT_TYPE_LABELS: Record<CompanyEventType, string> = {
  meeting: 'Meeting',
  shoot: 'Shoot',
  content_run: 'Content Run',
  client_event: 'Client Event',
  internal: 'Internal',
  deadline: 'Deadline',
}

export const EVENT_STATUS_LABELS: Record<CompanyEventStatus, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function handleError(err: unknown): { message: string; code?: string } | null {
  if (!err || typeof err !== 'object') return { message: 'Unknown error' }
  const e = err as { message?: string; code?: string }
  return { message: e.message ?? 'Unknown error', code: e.code }
}

function isTableMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string }
  return (e.message?.includes('does not exist') || e.code === '42P01') ?? false
}

export async function listCompanyEvents(
  rangeStart?: string,
  rangeEnd?: string,
): Promise<CompanyEventResult<CompanyCalendarEvent[]>> {
  try {
    let query = supabase
      .from(TABLE)
      .select('*')
      .order('start_at', { ascending: true })

    if (rangeStart) query = query.gte('start_at', rangeStart)
    if (rangeEnd) query = query.lt('start_at', rangeEnd)

    const { data, error } = await query

    if (error) {
      if (isTableMissing(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }

    return { data: (data ?? []) as CompanyCalendarEvent[], error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

export async function createCompanyEvent(
  payload: CompanyEventInput,
): Promise<CompanyEventResult<CompanyCalendarEvent>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title: payload.title,
        event_type: payload.event_type,
        client_id: payload.client_id ?? null,
        client_name: payload.client_name ?? null,
        start_at: payload.start_at,
        end_at: payload.end_at ?? null,
        all_day: payload.all_day ?? false,
        location: payload.location ?? null,
        notes: payload.notes ?? null,
        assigned_to_name: payload.assigned_to_name ?? null,
        status: payload.status ?? 'planned',
        linked_deliverable_id: payload.linked_deliverable_id ?? null,
        linked_task_id: payload.linked_task_id ?? null,
      })
      .select()
      .single()

    if (error) {
      if (isTableMissing(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }

    return { data: data as CompanyCalendarEvent, error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

export async function updateCompanyEvent(
  id: string,
  patch: CompanyEventPatch,
): Promise<CompanyEventResult<CompanyCalendarEvent>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (isTableMissing(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }

    return { data: data as CompanyCalendarEvent, error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

export async function deleteCompanyEvent(
  id: string,
): Promise<CompanyEventResult<null>> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)

    if (error) {
      if (isTableMissing(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }

    return { data: null, error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}
