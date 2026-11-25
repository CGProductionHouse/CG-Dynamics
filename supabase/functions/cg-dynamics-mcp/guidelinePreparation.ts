import { fetchAllRows } from '../_shared/paginatedRows.ts'
import { assertRecordClientMatchesContext, deriveMcpIdempotencyKey, isUuid } from './projectContext.ts'

// A planning workspace is not a shoot, package allocation or calendar booking.
// Reuse the canonical tables and canonical guideline RPC; never manufacture dates.
interface PreparationActor {
  profileId: string
  contextKind: 'staff' | 'client' | 'company_admin'
  effectiveClientId: string | null
  // Supabase's query-builder types differ between the browser and Edge runtime.
  supabase: import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient
}
type Row = Record<string, unknown>
const RUN_FIELDS = 'id,client_id,name,run_date,status,calendar_event_id,internal_notes'
const GUIDE_FIELDS = 'id,client_id,content_run_id,title,month,coverage_start,coverage_end,status,updated_at'

export async function resolveGuidelinePreparation(staff: PreparationActor, input: Row) {
  const clientId = input.client_id ?? staff.effectiveClientId
  if (!isUuid(clientId)) return { error: 'Choose the exact client for this guideline.' }
  const fence = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, clientId, 'guideline preparation')
  if (!fence.allowed) return { error: fence.error }
  const clientRead = await staff.supabase.from('clients').select('id,name,active').eq('id', clientId).eq('active', true).maybeSingle()
  if (clientRead.error || !clientRead.data) return { error: 'The exact active client could not be verified. No planning record was created.' }

  if (input.calendar_event_id !== undefined) {
    if (!isUuid(input.calendar_event_id)) return { error: 'Use the exact saved calendar event.' }
    const eventRead = await staff.supabase.from('company_calendar_events').select('id,client_id,event_type,status').eq('id', input.calendar_event_id).maybeSingle()
    const event = eventRead.data
    if (eventRead.error || !event || event.client_id !== clientId || event.event_type !== 'content_run' || event.status === 'cancelled') {
      return { error: 'That exact client content-run booking could not be verified. No alternative booking was created.' }
    }
    // The existing calendar trigger owns its mirror. Resolve it by both durable
    // identities; do not invoke a service-only ensure with no expected-client
    // argument after a client-scope check (the event could change concurrently).
    const mirrored = await staff.supabase.from('content_runs').select(RUN_FIELDS)
      .eq('calendar_event_id', event.id).eq('client_id', clientId).neq('status', 'cancelled').limit(2)
    if (mirrored.error || mirrored.data?.length !== 1 || mirrored.data[0].client_id !== clientId) return { error: 'The booking was saved, but its exact Content Run could not be verified. Re-read the same event; do not book it again.', calendar_event_id: event.id }
    return { runId: String(mirrored.data[0].id), createdRun: false, requestedMonth: null }
  }

  const rawMonth = typeof input.month === 'string' ? input.month : ''
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-01)?$/.test(rawMonth)) return { error: 'For an unbooked guideline, supply its content month (YYYY-MM). A shoot date is not required.' }
  const month = rawMonth.slice(0, 7) + '-01'
  const [guides, runs] = await Promise.all([
    fetchAllRows<Row>((from, to) => staff.supabase.from('content_guidelines').select(GUIDE_FIELDS).eq('client_id', clientId).order('id').range(from, to)),
    fetchAllRows<Row>((from, to) => staff.supabase.from('content_runs').select(RUN_FIELDS).eq('client_id', clientId).order('id').range(from, to)),
  ])
  if (guides.error || runs.error) return { error: 'Existing client planning history could not be read completely. No replacement was created.' }
  if ([...guides.data, ...runs.data].some(row => row.client_id !== clientId)) return { error: 'Cross-client planning history refused.' }
  const documents = guides.data.filter(guide => guide.month === month && guide.status !== 'archived')
  if (documents.length > 1) return { error: 'This month has more than one real guideline. Select the intended saved document; no replacement was created.', candidates: documents.map(g => ({ guideline_id: g.id, content_run_id: g.content_run_id })) }
  if (documents.length === 1) {
    const run = runs.data.find(row => row.id === documents[0].content_run_id)
    if (!run || run.status === 'cancelled') return { error: 'The saved monthly guideline has an unavailable or cancelled run. Its content is preserved.', guideline_id: documents[0].id }
    return { runId: String(run.id), createdRun: false, requestedMonth: month }
  }

  const id = await deriveMcpIdempotencyKey(clientId, 'guideline-planning-v1', month)
  const known = runs.data.find(row => row.id === id)
  if (known) {
    if (known.status === 'cancelled') return { error: 'This planning workspace was cancelled. It was not recreated or reopened.', content_run_id: id }
    return { runId: id, createdRun: false, requestedMonth: month }
  }
  // Check our exact deterministic workspace first: an interrupted month write
  // must remain recoverable. Other unassigned documents need exact selection;
  // missing coverage is not permission to duplicate or silently relabel them.
  const unassigned = guides.data.filter(guide => guide.month == null && guide.status !== 'archived'
    && runs.data.some(run => run.id === guide.content_run_id && run.run_date == null && run.status !== 'cancelled'))
  if (unassigned.length) return {
    error: 'Existing undated guidelines have unassigned coverage. Read these saved documents first and reuse the intended exact content_run_id; no replacement or month assignment was made.',
    candidates: unassigned.map(g => ({ guideline_id: g.id, content_run_id: g.content_run_id, title: g.title, month: null, status: g.status })),
  }
  const candidates = runs.data.filter(run => typeof run.run_date === 'string' && run.run_date.slice(0, 7) === month.slice(0, 7) && !['cancelled', 'completed'].includes(String(run.status)))
  if (candidates.length > 1) return { error: 'More than one shoot exists for this month. Select the intended booking; no duplicate was created.', candidates: candidates.map(r => ({ content_run_id: r.id, name: r.name, run_date: r.run_date })) }
  if (candidates.length === 1) return { runId: String(candidates[0].id), createdRun: false, requestedMonth: month }

  const inserted = await staff.supabase.from('content_runs').insert({
    id, client_id: clientId, client_name: clientRead.data.name,
    name: `${clientRead.data.name} — ${month.slice(0, 7)} content preparation`,
    run_date: null, start_time: null, calendar_event_id: null, status: 'planning',
    created_by: staff.profileId,
    internal_notes: `GUIDELINE_PREPARATION_V1\nContent month: ${month}\nUndated content preparation requested by staff. No shoot booking, accepted package scope, edit assignment or posting allocation is inferred.`,
  })
  // Includes concurrent ensures and an accepted insert whose response was lost.
  const saved = await staff.supabase.from('content_runs').select(RUN_FIELDS).eq('id', id).eq('client_id', clientId).maybeSingle()
  if (saved.error || !saved.data || saved.data.client_id !== clientId || saved.data.status === 'cancelled') {
    return { error: 'Planning creation could not be verified. Re-read this exact Content Run before retrying; do not create another booking.', content_run_id: id }
  }
  return { runId: id, createdRun: !inserted.error, requestedMonth: month }
}

// Only a newly prepared undated draft gets the explicitly requested coverage
// month. Never overwrite an existing month, publication or concurrent staff edit.
export async function setPreparedGuidelineMonth(staff: PreparationActor, guideline: Row, month: string | null) {
  if (!month || guideline.month === month) return { guideline }
  if (guideline.month != null || guideline.status !== 'draft' || typeof guideline.updated_at !== 'string') return { error: 'The saved guideline has different coverage or changed status. It was preserved.', guideline_id: guideline.id }
  const write = await staff.supabase.from('content_guidelines').update({ month }).eq('id', guideline.id)
    .eq('client_id', guideline.client_id).eq('content_run_id', guideline.content_run_id)
    .eq('status', 'draft').is('month', null).eq('updated_at', guideline.updated_at).select(GUIDE_FIELDS).maybeSingle()
  if (write.error) return { error: 'The guideline exists, but its content-month readback failed. Re-read the saved document.', guideline_id: guideline.id }
  const read = await staff.supabase.from('content_guidelines').select(GUIDE_FIELDS).eq('id', guideline.id).eq('client_id', guideline.client_id).maybeSingle()
  if (read.error || !read.data || read.data.month !== month || read.data.content_run_id !== guideline.content_run_id) return { error: 'The guideline changed while its month was being set. No staff content was overwritten.', guideline_id: guideline.id }
  return { guideline: { ...guideline, ...read.data } }
}
