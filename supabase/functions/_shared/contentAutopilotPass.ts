// #450 Content Production Autopilot — one idempotent pass.
//
// Runs on the EXISTING durable background_jobs cycle (job_type 'content_autopilot').
// It is not a second scheduler, not a second content store and not a file mover.
//
// What one pass does:
//   1. ensure the exact Microsoft content-run event has its Content Run mirror,
//      matched by the durable calendar event row — never by title;
//   2. ensure that run's ONE canonical Content Guideline exists (draft);
//   3. link a guideline video to a real same-client Client Schedule slot when the
//      provenance is unambiguous;
//   4. optionally prepare draft AI content, behind an explicit feature gate;
//   5. read folder mappings and raw evidence, derive edit readiness;
//   6. record the truthful summary, blockers and coverage for the daily cycle.
//
// What one pass never does:
//   * invent a Content Run from an ordinary meeting, a cancelled event, an
//     unresolved client, or nothing at all;
//   * write monthly_deliverables;
//   * overwrite a human-edited field or a link a human already set, or touch a
//     guideline that is not a draft;
//   * rename, move or delete anything in OneDrive;
//   * publish anything to a client.

import {
  deriveEditReadiness, deriveRawEvidence,
} from '../cg-dynamics-mcp/contentGuidelineActions.ts'

/** Bounded so one invocation always fits the Edge time budget. */
export const MAX_RUNS_PER_PASS = 25

/** How far ahead an upcoming run is considered by one pass. */
export const LOOKAHEAD_DAYS = 90

/**
 * Automatic draft generation is latent: the executable path exists, but it runs only
 * when CA switches this on. Activation is a protected production action.
 */
export const GENERATION_FLAG = 'CONTENT_AUTOPILOT_GENERATION'

/**
 * Automatic per-video OneDrive folder creation is latent: the executable path exists,
 * but it runs only when CA switches this on. Activation is a protected production
 * action that enables writes to OneDrive.
 */
export const VIDEO_FOLDER_FLAG = 'CONTENT_AUTOPILOT_VIDEO_FOLDERS'

// The narrow slice of the Supabase client this pass uses. Typed structurally so the
// module stays honest without importing the SDK types.
type QueryBuilder = {
  select: (columns: string) => QueryBuilder
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  update: (row: Record<string, unknown>) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  gte: (column: string, value: unknown) => QueryBuilder
  lte: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  is: (column: string, value: unknown) => QueryBuilder
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

/** Injected so the generation path is executable and testable without a live provider. */
export type DraftGenerator = (input: {
  clientId: string
  contentRunId: string
  guidelineId: string
  mode: 'ideas' | 'develop'
  videoIds: string[]
}) => Promise<{ ok: boolean; generated?: number; error?: string }>

/**
 * Injected so the OneDrive folder ensure path is executable and testable without
 * a live Graph API. The real implementation calls the existing ensure_video_folders
 * Edge Function action. Behind a protected production gate; OFF by default.
 */
export type VideoFolderEnsurer = (input: {
  contentRunId: string
  videoIds: string[]
}) => Promise<{ ok: boolean; ensured?: number; error?: string }>

export interface AutopilotPassOptions {
  today: string
  maxRuns?: number
  /** Latent executable path. Off unless CA has switched generation on. */
  generationEnabled?: boolean
  generateDrafts?: DraftGenerator
  /** Latent executable OneDrive folder path. Off unless CA has switched it on. */
  videoFolderEnabled?: boolean
  ensureVideoFolders?: VideoFolderEnsurer
  /** Automatic same-client slot linking. On by default; the link itself is DB-guarded. */
  linkDeliverables?: boolean
}

export interface AutopilotPassResult extends Record<string, unknown> {
  ok: boolean
  clients_considered: number
  runs_ensured: number
  runs_prepared: number
  runs_unprocessed: number
  guidelines_created: number
  videos_planned: number
  videos_linked: number
  drafts_generated: number
  generation_enabled: boolean
  ready_to_edit: number
  clients_without_future_run: string[]
  clients_preparation_failed: string[]
  blockers: Record<string, number>
  runs: Array<Record<string, unknown>>
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/**
 * One idempotent pass. Every content write is find-or-create against an exact id:
 * the run mirroring an exact Microsoft event, the one guideline that run must have,
 * and an unambiguous same-client slot link.
 */
export async function runContentAutopilotPass(
  supabase: Supabase,
  options: AutopilotPassOptions = { today: new Date().toISOString().slice(0, 10) },
): Promise<AutopilotPassResult> {
  const today = options.today
  const horizon = addDays(today, LOOKAHEAD_DAYS)
  const maxRuns = options.maxRuns ?? MAX_RUNS_PER_PASS
  const blockers: Record<string, number> = {}
  const note = (blocker: string) => { blockers[blocker] = (blockers[blocker] ?? 0) + 1 }

  // ── 1. Exact Microsoft content-run events without a Dynamics mirror ───────
  //
  // Identity is the durable calendar event row. An ordinary meeting, a cancelled
  // event or an event with no exact client is never turned into a run — the RPC
  // refuses those, and a refusal is recorded as a blocker rather than worked around.
  //
  // Already-mirrored events are excluded BEFORE the bounded work limit so a later
  // missing mirror is never starved by earlier completed mirrors filling the slice.
  let runsEnsured = 0
  const existingRuns = await supabase
    .from('content_runs')
    .select('calendar_event_id')
    .not('calendar_event_id', 'is', null)
  const mirroredEventIds = new Set(
    ((existingRuns.data ?? []) as Array<Record<string, unknown>>)
      .map(row => row.calendar_event_id as string)
      .filter(Boolean),
  )
  const eventsResult = await supabase
    .from('company_calendar_events')
    .select('id, client_id, event_type, status, start_at')
    .eq('event_type', 'content_run')
    .not('microsoft_event_id', 'is', null)
    .not('client_id', 'is', null)
    .neq('status', 'cancelled')
    .gte('start_at', `${today}T00:00:00Z`)
    .lte('start_at', `${horizon}T23:59:59Z`)
  if (eventsResult.error) {
    note('CALENDAR_EVENTS_UNREADABLE')
  } else {
    const events = (eventsResult.data ?? []) as Array<Record<string, unknown>>
    const missing = events.filter(event => !mirroredEventIds.has(event.id as string))
    for (const event of missing.slice(0, maxRuns)) {
      const ensured = await supabase.rpc('ensure_content_run_for_calendar_event', { p_calendar_event_id: event.id })
      if (ensured.error) {
        note('RUN_MIRROR_REFUSED')
        continue
      }
      const row = (Array.isArray(ensured.data) ? ensured.data[0] : ensured.data) as Record<string, unknown> | null
      if (row?.created === true) runsEnsured += 1
    }
  }

  // ── 2. Upcoming runs ──────────────────────────────────────────────────────
  // Full scan so the unprocessed count is truthful, then slice for bounded work.
  const { data: runRows, error: runError } = await supabase
    .from('content_runs')
    .select('id, client_id, client_name, run_date, status')
    .gte('run_date', today)
    .lte('run_date', horizon)
    .not('client_id', 'is', null)
    .neq('status', 'cancelled')
    .order('run_date', { ascending: true })
  if (runError) throw new Error(`Upcoming content runs could not be read: ${runError.message}`)

  const allUpcoming = (runRows ?? []) as Array<Record<string, unknown>>
  const runs = allUpcoming.slice(0, maxRuns)
  const unprocessedCount = Math.max(0, allUpcoming.length - maxRuns)
  const clientIds = [...new Set(allUpcoming.map(run => run.client_id as string))]

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
  const preparationFailed = new Set<string>()
  let guidelinesCreated = 0
  let videosPlanned = 0
  let videosLinked = 0
  let draftsGenerated = 0
  let readyToEdit = 0

  for (const run of runs) {
    const clientId = run.client_id as string
    const client = clients.get(clientId)
    if (!client?.active) continue

    // 2a. The one canonical guideline. get_or_create is idempotent by contract.
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
        preparationFailed.add(clientId)
        continue
      }
      guideline = (Array.isArray(created.data) ? created.data[0] : created.data) as Record<string, unknown> | null
      if (guideline) guidelinesCreated += 1
    }
    if (!guideline) {
      note('NO_GUIDELINE')
      preparationFailed.add(clientId)
      continue
    }

    // 2b. Saved videos, in saved order — CA's edits and order are the authority.
    const videosResult = await supabase
      .from('content_guide_ideas')
      .select('id, title, month, position, script, deliverable_id, production_status, status')
      .eq('content_guideline_id', guideline.id)
      .eq('client_id', clientId)
      .neq('status', 'archived')
      .order('position', { ascending: true })
    if (videosResult.error) {
      note('GUIDELINE_VIDEOS_UNREADABLE')
      preparationFailed.add(clientId)
      continue
    }
    const videos = (videosResult.data ?? []) as Array<Record<string, unknown>>

    // 2c. Link unallocated videos to a real same-client slot, but only where the
    // provenance is unambiguous: one free video/reel slot in that exact month. The
    // database refuses a cross-client link and never moves a link a human set.
    if (options.linkDeliverables !== false) {
      const unlinked = videos.filter(video => !video.deliverable_id && video.month)
      if (unlinked.length) {
        const candidates = await supabase
          .from('monthly_deliverables')
          .select('id, client_id, month, deliverable_type')
          .eq('client_id', clientId)
          .in('deliverable_type', ['video', 'reel'])
          .gte('month', monthOf(today))
        if (candidates.error) {
          note('SCHEDULE_UNREADABLE')
        } else {
          const taken = new Set(videos.map(video => video.deliverable_id).filter(Boolean) as string[])
          const byMonth = new Map<string, string[]>()
          for (const row of (candidates.data ?? []) as Array<Record<string, unknown>>) {
            const month = monthOf(row.month as string)
            const list = byMonth.get(month) ?? []
            if (!taken.has(row.id as string)) list.push(row.id as string)
            byMonth.set(month, list)
          }
          for (const video of unlinked) {
            const free = byMonth.get(monthOf(video.month as string)) ?? []
            // Ambiguity is left to a human: only a single free slot is linked.
            if (free.length !== 1) {
              if (free.length > 1) note('SCHEDULE_LINK_AMBIGUOUS')
              continue
            }
            const linked = await supabase.rpc('link_content_guide_video_deliverable', {
              p_content_guide_idea_id: video.id,
              p_deliverable_id: free[0],
            })
            if (linked.error) { note('SCHEDULE_LINK_REFUSED'); continue }
            if (linked.data === true) {
              video.deliverable_id = free[0]
              taken.add(free[0])
              byMonth.set(monthOf(video.month as string), [])
              videosLinked += 1
            }
          }
        }
      }
    }

    // 2d. Draft preparation. The executable path is here; it runs only once CA has
    // switched generation on. A guideline that is not a draft is never regenerated.
    // An empty guideline (no videos yet) gets initial ideas; a guideline with videos
    // needing scripts gets develop-mode generation. Both paths are gated on the same
    // project secret.
    const needsScript = videos.filter(video => !String(video.script ?? '').trim())
    if (guideline.status === 'draft' && options.generateDrafts) {
      if (!videos.length) {
        // Empty guideline — generate initial ideas so the first draft concepts are
        // prebuilt instead of waiting for a human to open the editor.
        if (!options.generationEnabled) {
          note('GENERATION_NOT_ENABLED')
        } else {
          const generated = await options.generateDrafts({
            clientId,
            contentRunId: run.id as string,
            guidelineId: guideline.id as string,
            mode: 'ideas',
            videoIds: [],
          })
          if (!generated.ok) note('GENERATION_BLOCKED')
          else draftsGenerated += generated.generated ?? 0
        }
      } else if (needsScript.length) {
        // Existing videos needing scripts — develop mode.
        if (!options.generationEnabled) {
          note('GENERATION_NOT_ENABLED')
        } else {
          const generated = await options.generateDrafts({
            clientId,
            contentRunId: run.id as string,
            guidelineId: guideline.id as string,
            mode: 'develop',
            videoIds: needsScript.map(video => video.id as string),
          })
          if (!generated.ok) note('GENERATION_BLOCKED')
          else draftsGenerated += generated.generated ?? 0
        }
      }
    }

    // 2e. Evidence. A relation that is not installed yet is UNKNOWN, not "no files".
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
      if (folderState === 'ready_to_create') note('VIDEO_FOLDER_NOT_CREATED')
      if (raw === 'UNVERIFIED') note('RAW_UNVERIFIED')
      if (!video.deliverable_id) unallocated += 1
    }

    videosPlanned += videos.length
    readyToEdit += runReady
    if (!videos.length) note('GUIDELINE_EMPTY')
    if (guideline.status !== 'draft') note('GUIDELINE_APPROVED')

    // 2f. Per-video OneDrive folder auto-ensure. Latent: the executable path exists
    // but only runs when CA has switched the OneDrive-write gate on. Production writes
    // are OFF by default. The ensurer re-proves client isolation and create-only
    // authority; it never bypasses admin gates or invents folders.
    const videosNeedingFolders = videos
      .filter(video => {
        const mapped = folderByVideo.get(video.id as string) ?? null
        return mapped === null && client.shortCode
      })
      .map(video => video.id as string)
    if (videosNeedingFolders.length && options.ensureVideoFolders) {
      if (!options.videoFolderEnabled) {
        note('VIDEO_FOLDER_NOT_ENABLED')
      } else {
        const ensured = await options.ensureVideoFolders({
          contentRunId: run.id as string,
          videoIds: videosNeedingFolders,
        })
        if (!ensured.ok) note('VIDEO_FOLDER_ENSURE_FAILED')
      }
    }

    summaries.push({
      content_run_id: run.id,
      client_id: clientId,
      client_name: client.name,
      run_date: run.run_date,
      guideline_id: guideline.id,
      guideline_status: guideline.status,
      videos: videos.length,
      unallocated,
      needs_script: needsScript.length,
      ready_to_edit: runReady,
      production_folder_state_readable: foldersReadable,
    })
  }

  // ── 3. Which active clients genuinely have NO future run ──────────────────
  //
  // This is decided from the FULL upcoming-run set, not from what this pass had time
  // to process. A client whose run fell outside this pass, or whose preparation
  // failed, is reported as such — never as "no future content run".
  const { data: activeClients, error: activeError } = await supabase
    .from('clients').select('id').eq('active', true)
  if (activeError) note('CLIENT_LIST_UNREADABLE')

  const clientsWithUpcomingRun = new Set<string>()
  const scanned = await supabase
    .from('content_runs')
    .select('client_id')
    .gte('run_date', today)
    .lte('run_date', horizon)
    .not('client_id', 'is', null)
    .neq('status', 'cancelled')
  if (scanned.error) {
    note('UPCOMING_RUN_SCAN_UNREADABLE')
    for (const run of allUpcoming) clientsWithUpcomingRun.add(run.client_id as string)
  } else {
    for (const row of (scanned.data ?? []) as Array<Record<string, unknown>>) {
      clientsWithUpcomingRun.add(row.client_id as string)
    }
  }

  const withoutFutureRun: string[] = []
  for (const row of (activeClients ?? []) as Array<Record<string, unknown>>) {
    const id = row.id as string
    if (clientsWithUpcomingRun.has(id)) continue
    withoutFutureRun.push(id)
    note('NO_FUTURE_CONTENT_RUN')
  }
  if (preparationFailed.size) blockers.PREPARATION_FAILED = preparationFailed.size
  if (unprocessedCount) note('RUNS_UNPROCESSED_THIS_PASS')

  return {
    ok: true,
    clients_considered: (activeClients ?? []).length,
    runs_ensured: runsEnsured,
    runs_prepared: summaries.length,
    runs_unprocessed: unprocessedCount,
    guidelines_created: guidelinesCreated,
    videos_planned: videosPlanned,
    videos_linked: videosLinked,
    drafts_generated: draftsGenerated,
    generation_enabled: options.generationEnabled === true,
    ready_to_edit: readyToEdit,
    clients_without_future_run: withoutFutureRun,
    clients_preparation_failed: [...preparationFailed],
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
