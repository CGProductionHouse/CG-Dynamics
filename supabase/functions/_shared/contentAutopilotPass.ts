// #450 Content Production Autopilot — one idempotent pass.
//
// Runs on the EXISTING durable background_jobs cycle (job_type 'content_autopilot').
// It is not a second scheduler, not a second content store and not a file mover.
//
// What one pass does, per active client with an upcoming real Content Run:
//   1. ensure that run's ONE canonical Content Guideline exists (draft);
//   2. read its saved videos, their production-folder mappings and raw evidence;
//   3. derive edit readiness per video;
//   4. record the truthful summary and blockers for the daily operating cycle.
//
// What one pass never does:
//   * create a Content Run, or invent a shoot date — a client with no upcoming run
//     is reported as NO_FUTURE_CONTENT_RUN;
//   * write monthly_deliverables;
//   * overwrite a human-edited field, or touch a guideline that is not a draft;
//   * rename, move or delete anything in OneDrive;
//   * publish anything to a client.

import {
  deriveEditReadiness, deriveRawEvidence,
} from '../cg-dynamics-mcp/contentGuidelineActions.ts'

/** Bounded so one invocation always fits the Edge time budget. */
export const MAX_RUNS_PER_PASS = 25

/** How far ahead an upcoming run is considered by one pass. */
export const LOOKAHEAD_DAYS = 90

// The narrow slice of the Supabase client this pass uses. Typed loosely on purpose:
// the query builder is chainable and this module only ever reads or inserts its own
// pass record, so a structural type keeps it honest without importing the SDK types.
type QueryBuilder = {
  select: (columns: string) => QueryBuilder
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  eq: (column: string, value: unknown) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  gte: (column: string, value: unknown) => QueryBuilder
  lte: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  not: (column: string, operator: string, value: unknown) => QueryBuilder
  order: (column: string, options: { ascending: boolean }) => QueryBuilder
  limit: (count: number) => QueryBuilder
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
  then: Promise<{ data: unknown; error: { message: string } | null }>['then']
}

type Supabase = {
  from: (table: string) => QueryBuilder
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

export interface AutopilotPassResult extends Record<string, unknown> {
  ok: boolean
  clients_considered: number
  runs_prepared: number
  guidelines_created: number
  videos_planned: number
  ready_to_edit: number
  blockers: Record<string, number>
  runs: Array<Record<string, unknown>>
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * One idempotent pass. Every step is find-or-read; the only write is the canonical
 * guideline a run must already have, plus the pass record itself.
 */
export async function runContentAutopilotPass(
  supabase: Supabase,
  options: { today: string; maxRuns?: number } = { today: new Date().toISOString().slice(0, 10) },
): Promise<AutopilotPassResult> {
  const today = options.today
  const horizon = addDays(today, LOOKAHEAD_DAYS)
  const blockers: Record<string, number> = {}
  const note = (blocker: string) => { blockers[blocker] = (blockers[blocker] ?? 0) + 1 }

  const { data: runRows, error: runError } = await supabase
    .from('content_runs')
    .select('id, client_id, client_name, run_date, status')
    .gte('run_date', today)
    .lte('run_date', horizon)
    .not('client_id', 'is', null)
    .neq('status', 'cancelled')
    .order('run_date', { ascending: true })
    .limit(options.maxRuns ?? MAX_RUNS_PER_PASS)
  if (runError) throw new Error(`Upcoming content runs could not be read: ${runError.message}`)

  const runs = (runRows ?? []) as Array<Record<string, unknown>>
  const clientIds = [...new Set(runs.map(run => run.client_id as string))]

  // Active clients only, and the configured short code — never derived from a name.
  const { data: clientRows } = clientIds.length
    ? await supabase.from('clients').select('id, name, short_code, active').in('id', clientIds)
    : { data: [] as Array<Record<string, unknown>> }
  const clients = new Map<string, { name: string | null; shortCode: string | null; active: boolean }>()
  for (const row of (clientRows ?? []) as Array<Record<string, unknown>>) {
    clients.set(row.id as string, {
      name: (row.name as string | null) ?? null,
      shortCode: (row.short_code as string | null) ?? null,
      active: row.active === true,
    })
  }

  const summaries: Array<Record<string, unknown>> = []
  let guidelinesCreated = 0
  let videosPlanned = 0
  let readyToEdit = 0

  for (const run of runs) {
    const clientId = run.client_id as string
    const client = clients.get(clientId)
    if (!client?.active) continue

    // 1. The one canonical guideline. get_or_create is idempotent by contract.
    const existing = await supabase
      .from('content_guidelines')
      .select('id, status, coverage_start, coverage_end')
      .eq('content_run_id', run.id)
      .maybeSingle()
    let guideline = existing.data as Record<string, unknown> | null
    if (!guideline && !existing.error) {
      const created = await supabase.rpc('get_or_create_content_guideline', { p_run_id: run.id })
      if (created.error) {
        note('GUIDELINE_UNAVAILABLE')
        continue
      }
      guideline = (Array.isArray(created.data) ? created.data[0] : created.data) as Record<string, unknown> | null
      if (guideline) guidelinesCreated += 1
    }
    if (!guideline) {
      note('NO_GUIDELINE')
      continue
    }

    // 2. Saved videos, in saved order — CA's edits and order are the authority.
    const videosResult = await supabase
      .from('content_guide_ideas')
      .select('id, title, month, position, script, deliverable_id, production_status, status')
      .eq('content_guideline_id', guideline.id)
      .eq('client_id', clientId)
      .neq('status', 'archived')
      .order('position', { ascending: true })
    const videos = (videosResult.data ?? []) as Array<Record<string, unknown>>

    // 3. Evidence. A relation that is not installed yet is UNKNOWN, not "no files".
    const [folders, closeout] = await Promise.all([
      supabase.from('content_guide_video_onedrive_folders')
        .select('content_guide_idea_id, upload_status').eq('content_run_id', run.id),
      supabase.from('content_run_closeouts')
        .select('upload_status').eq('content_run_id', run.id).maybeSingle(),
    ])
    const foldersReadable = !folders.error
    const folderByVideo = new Map<string, string>()
    for (const row of (folders.data ?? []) as Array<Record<string, unknown>>) {
      folderByVideo.set(row.content_guide_idea_id as string, row.upload_status as string)
    }
    const closeoutStatus = (closeout.data?.upload_status as string | undefined) ?? null

    let runReady = 0
    let unallocated = 0
    let needsScript = 0
    for (const video of videos) {
      const mapped = folderByVideo.get(video.id as string) ?? null
      const folderState: 'mapped' | 'ready_to_create' | 'blocked' = mapped !== null
        ? 'mapped'
        : !client.shortCode ? 'blocked' : 'ready_to_create'
      const folderBlocked = folderState === 'blocked' ? 'BLOCKED_MISSING_SHORT_CODE' as const : null
      const raw = deriveRawEvidence({
        folderState,
        providerReadable: foldersReadable,
        closeoutUploadStatus: closeoutStatus as 'verified' | 'missing' | 'partial' | 'unverified' | null,
        videoUploadStatus: mapped as 'verified' | 'missing' | 'partial' | null,
      })
      const readiness = deriveEditReadiness({
        folderState, folderBlocked, raw,
        productionStatus: String(video.production_status ?? 'not_shot'),
      })
      if (readiness.readiness === 'READY_TO_EDIT') runReady += 1
      if (folderBlocked) note(folderBlocked)
      if (raw === 'UNVERIFIED') note('RAW_UNVERIFIED')
      if (!video.deliverable_id) unallocated += 1
      if (!String(video.script ?? '').trim()) needsScript += 1
    }

    videosPlanned += videos.length
    readyToEdit += runReady
    if (!videos.length) note('GUIDELINE_EMPTY')
    if (guideline.status !== 'draft') note('GUIDELINE_APPROVED')

    summaries.push({
      content_run_id: run.id,
      client_id: clientId,
      client_name: client.name,
      run_date: run.run_date,
      guideline_id: guideline.id,
      guideline_status: guideline.status,
      videos: videos.length,
      unallocated,
      needs_script: needsScript,
      ready_to_edit: runReady,
      production_folder_state_readable: foldersReadable,
    })
  }

  // A client that has an active row but no upcoming run is reported, never invented.
  const { data: activeClients } = await supabase.from('clients').select('id').eq('active', true)
  const withRuns = new Set(summaries.map(summary => summary.client_id as string))
  for (const row of (activeClients ?? []) as Array<Record<string, unknown>>) {
    if (!withRuns.has(row.id as string)) note('NO_FUTURE_CONTENT_RUN')
  }

  return {
    ok: true,
    clients_considered: (activeClients ?? []).length,
    runs_prepared: summaries.length,
    guidelines_created: guidelinesCreated,
    videos_planned: videosPlanned,
    ready_to_edit: readyToEdit,
    blockers,
    runs: summaries,
  }
}

/** Record the pass so the daily operating cycle can say whether content preparation ran. */
export async function recordContentAutopilotPass(
  supabase: Supabase,
  result: AutopilotPassResult | null,
  error: string | null,
): Promise<void> {
  await supabase.from('content_autopilot_runs').insert({
    finished_at: new Date().toISOString(),
    status: error ? 'failed' : 'succeeded',
    clients_considered: result?.clients_considered ?? 0,
    runs_prepared: result?.runs_prepared ?? 0,
    videos_planned: result?.videos_planned ?? 0,
    ready_to_edit: result?.ready_to_edit ?? 0,
    blockers: result?.blockers ?? {},
    error,
  })
}
