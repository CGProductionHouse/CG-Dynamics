import { supabase } from './supabase'
import {
  buildClientReadiness, buildRunReadiness,
  type AutopilotVideo, type ClientReadiness, type RunFolderMapping, type RunReadiness,
} from './contentAutopilot'

// ── #450 Content readiness — the thin data layer ────────────────────────────
//
// Reads existing canonical tables and hands them to the pure rules in
// contentAutopilot.ts. It creates nothing, writes nothing and never calls OneDrive:
// the Content surface must be safe to open.

export interface ContentReadinessSummary {
  runs: RunReadiness[]
  /** Every ACTIVE client, so a client with no upcoming run is visible rather than absent. */
  clients: ClientReadiness[]
  /** Latest autopilot pass, so staff can see whether preparation actually ran. */
  lastPass: { finished_at: string | null; status: string; runs_prepared: number; blockers: Record<string, number> } | null
}

const LOOKAHEAD_DAYS = 90

function horizon(today: string): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + LOOKAHEAD_DAYS)
  return date.toISOString().slice(0, 10)
}

/** A relation that is not installed yet is unknown evidence, not proof of absence. */
function readable(error: { code?: string; message?: string } | null): boolean {
  return !error
}

export async function fetchContentReadiness(
  today = new Date().toISOString().slice(0, 10),
): Promise<{ data: ContentReadinessSummary | null; error: string | null }> {
  // Active clients are the population, not the runs: a client with no upcoming run must
  // still appear, carrying NO_FUTURE_CONTENT_RUN.
  const activeClientsResult = await supabase
    .from('clients')
    .select('id, name, short_code')
    .eq('active', true)
    .order('name', { ascending: true })
  if (activeClientsResult.error) return { data: null, error: activeClientsResult.error.message }
  const activeClients = (activeClientsResult.data ?? []) as Array<{ id: string; name: string | null; short_code: string | null }>

  const runsResult = await supabase
    .from('content_runs')
    .select('id, client_id, client_name, run_date, status')
    .gte('run_date', today)
    .lte('run_date', horizon(today))
    .neq('status', 'cancelled')
    .order('run_date', { ascending: true })
  if (runsResult.error) return { data: null, error: runsResult.error.message }

  const runs = (runsResult.data ?? []).filter(run => run.client_id)
  const lastPassOnly = await supabase
    .from('content_autopilot_runs')
    .select('finished_at, status, runs_prepared, blockers')
    .order('started_at', { ascending: false })
    .limit(1)
  const shapeLastPass = (rows: Array<Record<string, unknown>> | null) => {
    const row = (rows ?? [])[0]
    return row
      ? {
        finished_at: (row.finished_at as string | null) ?? null,
        status: row.status as string,
        runs_prepared: (row.runs_prepared as number) ?? 0,
        blockers: (row.blockers as Record<string, number>) ?? {},
      }
      : null
  }

  if (!runs.length) {
    // No upcoming run anywhere: every active client is truthfully NO_FUTURE_CONTENT_RUN.
    return {
      data: {
        runs: [],
        clients: activeClients.map(client => buildClientReadiness({ id: client.id, name: client.name }, [], today)),
        lastPass: shapeLastPass(lastPassOnly.data as Array<Record<string, unknown>> | null),
      },
      error: null,
    }
  }

  const runIds = runs.map(run => run.id)
  const clientIds = [...new Set(runs.map(run => run.client_id as string))]

  const [guidelines, folders, closeouts, deliverables, portalCategories] = await Promise.all([
    supabase.from('content_guidelines').select('id, content_run_id, client_id, status').in('content_run_id', runIds),
    supabase.from('content_run_onedrive_folders').select('content_run_id, drive_id, month_folder_item_id, folder_name').in('content_run_id', runIds),
    supabase.from('content_run_closeouts').select('content_run_id, upload_status').in('content_run_id', runIds),
    supabase.from('monthly_deliverables').select('id, client_id, month, deliverable_type').in('client_id', clientIds).in('deliverable_type', ['video', 'reel']).gte('month', `${today.slice(0, 7)}-01`),
    supabase.from('client_portal_library_categories').select('client_id, drive_id, folder_item_id, category').in('client_id', clientIds).eq('category', 'video'),
  ])
  const lastPass = lastPassOnly

  // Per-video folder truth comes from the staff-safe projection: the table itself is
  // service-role only, and the projection deliberately returns no drive or item id.
  const videoFolderStates = await Promise.all(runIds.map(async runId => {
    const { data, error } = await supabase.rpc('content_run_video_folder_states', { p_content_run_id: runId })
    return { runId, rows: (data ?? []) as Array<Record<string, unknown>>, error }
  }))
  const videoFoldersReadable = videoFolderStates.every(entry => !entry.error)

  type GuidelineStatus = NonNullable<RunReadiness['guidelineStatus']>
  const guidelineByRun = new Map<string, { id: string; status: GuidelineStatus }>()
  for (const row of guidelines.data ?? []) {
    guidelineByRun.set(row.content_run_id as string, { id: row.id as string, status: row.status as GuidelineStatus })
  }

  const guidelineIds = [...guidelineByRun.values()].map(guideline => guideline.id)
  const videosResult = guidelineIds.length
    ? await supabase
      .from('content_guide_ideas')
      .select('id, content_guideline_id, title, month, position, deliverable_id, script, shot_breakdown, requirements, cta, production_status')
      .in('content_guideline_id', guidelineIds)
      .neq('status', 'archived')
      .order('position', { ascending: true })
    : { data: [], error: null }
  if (videosResult.error) return { data: null, error: videosResult.error.message }

  const videosByGuideline = new Map<string, AutopilotVideo[]>()
  for (const row of videosResult.data ?? []) {
    const list = videosByGuideline.get(row.content_guideline_id as string) ?? []
    list.push(row as unknown as AutopilotVideo)
    videosByGuideline.set(row.content_guideline_id as string, list)
  }

  const runFolderByRun = new Map<string, RunFolderMapping>()
  for (const row of folders.data ?? []) {
    runFolderByRun.set(row.content_run_id as string, {
      driveId: row.drive_id as string,
      monthFolderItemId: row.month_folder_item_id as string,
      clientFolderName: (row.folder_name as string) ?? '',
    })
  }

  const videoFolderByRun = new Map<string, Record<string, { driveId: string; itemId: string; folderName: string }>>()
  const videoUploadByRun = new Map<string, Record<string, 'verified' | 'missing' | 'partial'>>()
  for (const entry of videoFolderStates) {
    const folderMap: Record<string, { driveId: string; itemId: string; folderName: string }> = {}
    const uploads: Record<string, 'verified' | 'missing' | 'partial'> = {}
    for (const row of entry.rows) {
      const videoId = row.content_guide_idea_id as string
      // The projection carries no Graph identifiers; a mapped folder is proven by the
      // projection returning a row for that video, and the name is what staff read.
      folderMap[videoId] = { driveId: '', itemId: '', folderName: (row.folder_name as string) ?? '' }
      const status = row.upload_status as string | null
      if (status && status !== 'unverified') uploads[videoId] = status as 'verified' | 'missing' | 'partial'
    }
    videoFolderByRun.set(entry.runId, folderMap)
    videoUploadByRun.set(entry.runId, uploads)
  }

  // Real final-output truth: only the minimum safe fields, for these exact videos.
  // client_portal_assets never leaves Graph paths in the client projection, and none of
  // its identifiers reach the readiness output.
  const videoIdsByRun = new Map<string, string[]>()
  const guidelineVideoIds: string[] = []
  for (const run of runs) {
    const guideline = guidelineByRun.get(run.id as string)
    const ids = guideline ? (videosByGuideline.get(guideline.id) ?? []).map(video => video.id) : []
    videoIdsByRun.set(run.id as string, ids)
    guidelineVideoIds.push(...ids)
  }
  const portalAssetsResult = guidelineVideoIds.length
    ? await supabase
      .from('client_portal_assets')
      .select('content_guide_idea_id, active')
      .in('content_guide_idea_id', guidelineVideoIds)
    : { data: [], error: null }
  const portalAssetsReadable = readable(portalAssetsResult.error)
  const publishedByVideo = new Map<string, boolean>()
  for (const row of (portalAssetsResult.data ?? []) as Array<Record<string, unknown>>) {
    const videoId = row.content_guide_idea_id as string
    publishedByVideo.set(videoId, (publishedByVideo.get(videoId) ?? false) || row.active === true)
  }
  const portalAssetsByRun = new Map<string, Record<string, { driveId: string; itemId: string; active: boolean }>>()
  for (const [runId, ids] of videoIdsByRun.entries()) {
    const assets: Record<string, { driveId: string; itemId: string; active: boolean }> = {}
    for (const id of ids) {
      if (!publishedByVideo.has(id)) continue
      // Identity stays internal: readiness only needs "a final output exists, published?".
      assets[id] = { driveId: '', itemId: '', active: publishedByVideo.get(id) === true }
    }
    portalAssetsByRun.set(runId, assets)
  }

  const closeoutByRun = new Map<string, 'verified' | 'missing' | 'partial' | 'unverified'>()
  for (const row of closeouts.data ?? []) {
    closeoutByRun.set(row.content_run_id as string, row.upload_status as 'verified' | 'missing' | 'partial' | 'unverified')
  }

  const clientById = new Map<string, { name: string | null; shortCode: string | null }>()
  for (const row of activeClients) {
    clientById.set(row.id, { name: row.name, shortCode: row.short_code })
  }

  const monthsByClient = new Map<string, string[]>()
  for (const row of deliverables.data ?? []) {
    const list = monthsByClient.get(row.client_id as string) ?? []
    list.push(row.month as string)
    monthsByClient.set(row.client_id as string, list)
  }

  const portalByClient = new Map<string, { driveId: string; folderItemId: string }>()
  for (const row of portalCategories.data ?? []) {
    portalByClient.set(row.client_id as string, { driveId: row.drive_id as string, folderItemId: row.folder_item_id as string })
  }

  const built = runs.map(run => {
    const guideline = guidelineByRun.get(run.id as string) ?? null
    const clientId = run.client_id as string
    const months = monthsByClient.get(clientId) ?? []
    return buildRunReadiness({
      run: { id: run.id as string, client_id: clientId, client_name: (run.client_name as string | null) ?? clientById.get(clientId)?.name ?? null, run_date: (run.run_date as string | null) ?? null },
      guideline,
      videos: guideline ? videosByGuideline.get(guideline.id) ?? [] : [],
      shortCode: clientById.get(clientId)?.shortCode ?? null,
      runFolder: runFolderByRun.get(run.id as string) ?? null,
      videoFolders: videoFolderByRun.get(run.id as string),
      videoUploadStatuses: videoUploadByRun.get(run.id as string),
      portalVideoCategory: portalByClient.get(clientId) ?? null,
      portalAssets: portalAssetsByRun.get(run.id as string),
      portalReadable: readable(portalCategories.error) && portalAssetsReadable,
      providerReadable: videoFoldersReadable,
      closeoutUploadStatus: closeoutByRun.get(run.id as string) ?? null,
      scheduleMonths: months,
      deliverableMonths: months,
      // Generation readiness is decided by the Edge Function, which holds the provider
      // keys; the UI only reports what is already prepared.
      clientContextReady: true,
      aiProviderAvailable: true,
    })
  })

  // Every active client, so one with no upcoming run is reported rather than omitted.
  const clientReadiness = activeClients.map(client =>
    buildClientReadiness({ id: client.id, name: client.name }, built, today))

  return {
    data: {
      runs: built,
      clients: clientReadiness,
      lastPass: shapeLastPass(lastPass.data as Array<Record<string, unknown>> | null),
    },
    error: null,
  }
}
