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
  // Microsoft source identity - added in phase-15a.
  microsoft_source_type?: string | null
  microsoft_calendar_id?: string | null
  microsoft_event_id?: string | null
  microsoft_last_synced_at?: string | null
  superseded_by_event_id?: string | null
  superseded_at?: string | null
  superseded_by_profile_id?: string | null
  client_visible: boolean
  client_visibility_updated_at: string | null
  client_visibility_updated_by_profile_id: string | null
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
  supersessionMigrationNeeded?: boolean
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

export function isCompanyCalendarTableMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string }
  const message = (e.message ?? '').toLowerCase()
  return e.code === '42P01'
    || (e.code === 'PGRST205' && message.includes(TABLE))
    || (message.includes(TABLE) && message.includes('relation') && message.includes('does not exist'))
}

export function isSupersessionColumnMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string }
  const message = (e.message ?? '').toLowerCase()
  return message.includes('superseded_by_event_id')
    && (e.code === '42703' || e.code === 'PGRST204' || message.includes('does not exist') || message.includes('schema cache'))
}

interface CompanyEventsReadResponse {
  data: unknown[] | null
  error: unknown
}

export async function readCompanyEventsWithSupersessionFallback(
  canonicalRead: () => Promise<CompanyEventsReadResponse>,
  legacyRead: () => Promise<CompanyEventsReadResponse>,
): Promise<CompanyEventResult<CompanyCalendarEvent[]>> {
  const canonical = await canonicalRead()
  if (!canonical.error) {
    return { data: (canonical.data ?? []) as CompanyCalendarEvent[], error: null, tableMissing: false, supersessionMigrationNeeded: false }
  }
  if (isCompanyCalendarTableMissingError(canonical.error)) {
    return { data: null, error: null, tableMissing: true, supersessionMigrationNeeded: false }
  }
  if (!isSupersessionColumnMissingError(canonical.error)) {
    return { data: null, error: handleError(canonical.error), tableMissing: false, supersessionMigrationNeeded: false }
  }

  const legacy = await legacyRead()
  if (!legacy.error) {
    return { data: (legacy.data ?? []) as CompanyCalendarEvent[], error: null, tableMissing: false, supersessionMigrationNeeded: true }
  }
  if (isCompanyCalendarTableMissingError(legacy.error)) {
    return { data: null, error: null, tableMissing: true, supersessionMigrationNeeded: true }
  }
  return { data: null, error: handleError(legacy.error), tableMissing: false, supersessionMigrationNeeded: true }
}

export async function listCompanyEvents(
  rangeStart?: string,
  rangeEnd?: string,
): Promise<CompanyEventResult<CompanyCalendarEvent[]>> {
  try {
    async function read(includeSupersessionFilter: boolean) {
      let query = supabase.from(TABLE).select('*')
      if (includeSupersessionFilter) query = query.is('superseded_by_event_id', null)
      query = query.order('start_at', { ascending: true })
      if (rangeEnd) query = query.lt('start_at', rangeEnd)
      if (rangeStart) query = query.or(`end_at.gt.${rangeStart},and(end_at.is.null,start_at.gte.${rangeStart})`)
      const { data, error } = await query
      return { data, error }
    }
    return await readCompanyEventsWithSupersessionFallback(() => read(true), () => read(false))
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

// A single event by id. Used to check a linked Content Run's calendar event
// (e.g. Microsoft ownership) before mirroring edits back to it.
export async function getCompanyEvent(
  id: string,
): Promise<CompanyEventResult<CompanyCalendarEvent>> {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (error) {
      if (isCompanyCalendarTableMissingError(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }
    return { data: data as CompanyCalendarEvent, error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

// Events for a set of ids (linked Content Run events). Empty ids short-circuits.
export async function listCompanyEventsByIds(
  ids: string[],
): Promise<CompanyEventResult<CompanyCalendarEvent[]>> {
  if (ids.length === 0) return { data: [], error: null, tableMissing: false }
  try {
    const { data, error } = await supabase.from(TABLE).select('*').in('id', ids)
    if (error) {
      if (isCompanyCalendarTableMissingError(error)) return { data: null, error: null, tableMissing: true }
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
      if (isCompanyCalendarTableMissingError(error)) return { data: null, error: null, tableMissing: true }
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
      if (isCompanyCalendarTableMissingError(error)) return { data: null, error: null, tableMissing: true }
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
      if (isCompanyCalendarTableMissingError(error)) return { data: null, error: null, tableMissing: true }
      return { data: null, error: handleError(error), tableMissing: false }
    }

    return { data: null, error: null, tableMissing: false }
  } catch (err) {
    return { data: null, error: handleError(err), tableMissing: false }
  }
}

export async function supersedeNativeCompanyEvent(
  nativeEventId: string,
  outlookEventId: string,
  expectedNativeUpdatedAt: string,
  expectedOutlookUpdatedAt: string,
): Promise<{ error: { message: string; code?: string } | null }> {
  try {
    const { error } = await supabase.rpc('supersede_native_calendar_event', {
      p_native_event_id: nativeEventId,
      p_outlook_event_id: outlookEventId,
      p_expected_native_updated_at: expectedNativeUpdatedAt,
      p_expected_outlook_updated_at: expectedOutlookUpdatedAt,
    })
    return { error: error ? handleError(error) : null }
  } catch (err) {
    return { error: handleError(err) }
  }
}

export async function setCompanyEventClientVisibility(
  eventId: string,
  visible: boolean,
): Promise<{ error: { message: string; code?: string } | null }> {
  try {
    const { error } = await supabase.rpc('set_company_calendar_event_client_visibility', {
      p_event_id: eventId,
      p_visible: visible,
    })
    return { error: error ? handleError(error) : null }
  } catch (err) {
    return { error: handleError(err) }
  }
}
