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
  const runsResult = await supabase
    .from('content_runs')
    .select('id, client_id, client_name, run_date, status')
    .gte('run_date', today)
    .lte('run_date', horizon(today))
    .neq('status', 'cancelled')
    .order('run_date', { ascending: true })
  if (runsResult.error) return { data: null, error: runsResult.error.message }

  const runs = (runsResult.data ?? []).filter(run => run.client_id)
  if (!runs.length) return { data: { runs: [], clients: [], lastPass: null }, error: null }

  const runIds = runs.map(run => run.id)
  const clientIds = [...new Set(runs.map(run => run.client_id as string))]

  const [clients, guidelines, folders, videoFolders, closeouts, deliverables, portalCategories, lastPass] = await Promise.all([
    supabase.from('clients').select('id, name, short_code, active').in('id', clientIds),
    supabase.from('content_guidelines').select('id, content_run_id, client_id, status').in('content_run_id', runIds),
    supabase.from('content_run_onedrive_folders').select('content_run_id, drive_id, month_folder_item_id, folder_name').in('content_run_id', runIds),
    supabase.from('content_guide_video_onedrive_folders').select('content_guide_idea_id, content_run_id, drive_id, folder_item_id, folder_name, upload_status').in('content_run_id', runIds),
    supabase.from('content_run_closeouts').select('content_run_id, upload_status').in('content_run_id', runIds),
    supabase.from('monthly_deliverables').select('id, client_id, month, deliverable_type').in('client_id', clientIds).in('deliverable_type', ['video', 'reel']).gte('month', `${today.slice(0, 7)}-01`),
    supabase.from('client_portal_library_categories').select('client_id, drive_id, folder_item_id, category').in('client_id', clientIds).eq('category', 'video'),
    supabase.from('content_autopilot_runs').select('finished_at, status, runs_prepared, blockers').order('started_at', { ascending: false }).limit(1),
  ])

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
  for (const row of videoFolders.data ?? []) {
    const runId = row.content_run_id as string
    const folderMap = videoFolderByRun.get(runId) ?? {}
    folderMap[row.content_guide_idea_id as string] = {
      driveId: row.drive_id as string,
      itemId: row.folder_item_id as string,
      folderName: row.folder_name as string,
    }
    videoFolderByRun.set(runId, folderMap)
    if (row.upload_status && row.upload_status !== 'unverified') {
      const uploads = videoUploadByRun.get(runId) ?? {}
      uploads[row.content_guide_idea_id as string] = row.upload_status as 'verified' | 'missing' | 'partial'
      videoUploadByRun.set(runId, uploads)
    }
  }

  const closeoutByRun = new Map<string, 'verified' | 'missing' | 'partial' | 'unverified'>()
  for (const row of closeouts.data ?? []) {
    closeoutByRun.set(row.content_run_id as string, row.upload_status as 'verified' | 'missing' | 'partial' | 'unverified')
  }

  const clientById = new Map<string, { name: string | null; shortCode: string | null }>()
  for (const row of clients.data ?? []) {
    clientById.set(row.id as string, { name: (row.name as string | null) ?? null, shortCode: (row.short_code as string | null) ?? null })
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
      portalReadable: readable(portalCategories.error),
      providerReadable: readable(videoFolders.error),
      closeoutUploadStatus: closeoutByRun.get(run.id as string) ?? null,
      scheduleMonths: months,
      deliverableMonths: months,
      // Generation readiness is decided by the Edge Function, which holds the provider
      // keys; the UI only reports what is already prepared.
      clientContextReady: true,
      aiProviderAvailable: true,
    })
  })

  const clientReadiness = [...clientById.entries()].map(([id, client]) =>
    buildClientReadiness({ id, name: client.name }, built, today))

  const pass = (lastPass.data ?? [])[0]
  return {
    data: {
      runs: built,
      clients: clientReadiness,
      lastPass: pass
        ? {
          finished_at: (pass.finished_at as string | null) ?? null,
          status: pass.status as string,
          runs_prepared: (pass.runs_prepared as number) ?? 0,
          blockers: (pass.blockers as Record<string, number>) ?? {},
        }
        : null,
    },
    error: null,
  }
}
