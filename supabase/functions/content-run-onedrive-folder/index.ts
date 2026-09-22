// Content Run → exact OneDrive production month folder (#224 on the #225 model).
//
// Canonical structure (CA lock, #224/#450):
//   My files / Clients / <Client> / Videos / <YYYY> / <YYYY_MM_MON> / <YYYY_MM_<SHORT_CODE>_VIDEO_<XX>>
// A run links to its ONE month folder, and each saved guideline video to its ONE production
// folder, by durable Graph drive/item ids. docs/onedrive-naming-authority.md is the authority.
//
// Rules:
//   * Runtime identity is the stored durable id. Folder names are matched ONLY while an admin is
//     linking (exact name, case-insensitive for known casing drift) and the admin sees the result.
//   * The client folder is chosen by an admin from the real children of `Clients` — never guessed.
//   * Missing year/month folders are created only on an explicit admin action, create-only
//     (Graph conflictBehavior 'fail'). Nothing here renames, moves or deletes anything in OneDrive.
//   * OneDrive tables are service-role only; the existing upsert RPCs require an active admin actor.
//
// POST /content-run-onedrive-folder
// { action: 'status' | 'list_client_folders' | 'map_client_folder' | 'link_month_folder'
//         | 'create_month_folder' | 'ensure_video_folders',
//   contentRunId: uuid, clientFolderItemId?: string, confirmCreate?: boolean, videoIds?: uuid[] }

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  assertSameClient,
  buildMonthFolderName,
  buildVideoFolderName,
  buildYearFolderName,
  findChildByExactName,
  resolveChildByDurableId,
} from '../_shared/onedrive-canonical.ts'
import {
  ensureCanonicalChildFolder,
  getItem,
  getValidAccessToken,
  isUploadAdapterConfigured,
  listChildren,
  resolveClientsFolder,
  type ChildItem,
} from '../client-onboarding/onedrive-adapter.ts'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'staff', 'team']
const ACTIONS = ['status', 'list_client_folders', 'map_client_folder', 'link_month_folder', 'create_month_folder', 'ensure_video_folders'] as const
type Action = typeof ACTIONS[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VIDEOS_FOLDER_NAME = 'Videos'

interface ClientMappingRow {
  client_id: string
  drive_id: string
  client_folder_item_id: string
  videos_folder_item_id: string | null
  web_url: string | null
  folder_name: string | null
}

interface RunFolderRow {
  content_run_id: string
  client_id: string
  drive_id: string
  month_folder_item_id: string
  web_url: string | null
  folder_name: string | null
  last_verified_at: string | null
}

function foldersOnly(children: ChildItem[]): ChildItem[] {
  return children.filter((child) => child.isFolder)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error.' }, 500)
  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const WORKER_TOKEN = Deno.env.get('WORKER_INTERNAL_TOKEN') ?? ''
  const internalWorkerToken = req.headers.get('X-Internal-Worker-Token') ?? ''
  const isInternalWorker = WORKER_TOKEN.length > 0 && internalWorkerToken === WORKER_TOKEN

  let userId: string
  let canManage: boolean
  const systemProfileId = Deno.env.get('WORKER_SYSTEM_PROFILE_ID') ?? ''
  if (isInternalWorker) {
    userId = systemProfileId || '00000000-0000-0000-0000-000000000001'
    canManage = true
  } else {
    if (!token) return jsonResponse({ error: 'Authentication required.' }, 401)
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Authentication required.' }, 401)
    userId = user.id
    const { data: profile } = await sb.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
    if (!profile || profile.is_active !== true || !STAFF_ROLES.includes(profile.role)) {
      return jsonResponse({ error: 'Staff access required.' }, 403)
    }
    canManage = profile.role === 'admin'
  }

  let body: { action?: string; contentRunId?: string; clientFolderItemId?: string; confirmCreate?: boolean }
  try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid request body.' }, 400) }
  const action = body.action as Action
  if (!ACTIONS.includes(action)) return jsonResponse({ error: `action must be one of: ${ACTIONS.join(', ')}` }, 400)
  if (!body.contentRunId || !UUID_RE.test(body.contentRunId)) return jsonResponse({ error: 'contentRunId must be a valid UUID.' }, 400)

  // Internal worker authority is limited to reading status and ensuring video folders.
  // All mapping actions (map_client_folder, link_month_folder, create_month_folder) are human-only.
  if (isInternalWorker && !['status', 'ensure_video_folders'].includes(action)) {
    return jsonResponse({ error: 'Internal worker may only read status or ensure video folders.' }, 403)
  }

  // ── The run, its client and its content month ────────────────────────────────────────
  const { data: run } = await sb.from('content_runs').select('id, client_id, run_date').eq('id', body.contentRunId).maybeSingle()
  if (!run) return jsonResponse({ error: 'Content Run not found.' }, 404)
  if (!run.client_id) return jsonResponse({ error: 'Assign a client to this Content Run first.' }, 409)
  const { data: client } = await sb.from('clients').select('id, name, active, short_code').eq('id', run.client_id).maybeSingle()
  if (!client || client.active !== true) return jsonResponse({ error: 'The Content Run client is not an active client.' }, 409)

  // The month folder follows the guideline's content month; the shoot date is the fallback.
  const { data: guideline } = await sb.from('content_guidelines').select('coverage_start, month').eq('content_run_id', run.id).maybeSingle()
  const guidelineMonth: string | null = guideline?.coverage_start ?? guideline?.month ?? null
  const monthDate: string | null = guidelineMonth ?? run.run_date ?? null
  const monthBasis = guidelineMonth ? 'guideline_coverage' : run.run_date ? 'run_date' : null
  const expectedNames = monthDate
    ? { year: buildYearFolderName(Number(monthDate.slice(0, 4))), month: buildMonthFolderName(Number(monthDate.slice(0, 4)), Number(monthDate.slice(5, 7))) }
    : null

  const { data: mappingRows } = await sb.rpc('get_client_onedrive_mapping', { p_client_id: client.id })
  const mapping = (Array.isArray(mappingRows) ? mappingRows[0] : null) as ClientMappingRow | null
  const { data: folderRows } = await sb.rpc('get_content_run_onedrive_folder', { p_content_run_id: run.id })
  const runFolder = (Array.isArray(folderRows) ? folderRows[0] : null) as RunFolderRow | null

  const connection = !isUploadAdapterConfigured() ? 'not_configured' : (await getValidAccessToken()) ? 'connected' : 'needs_consent'
  const expected = expectedNames
    ? { year: expectedNames.year, monthFolder: expectedNames.month, path: ['Clients', mapping?.folder_name ?? '<client folder>', VIDEOS_FOLDER_NAME, expectedNames.year, expectedNames.month].join(' / ') }
    : null

  const folderView = (row: RunFolderRow | null) => row
    ? { driveId: row.drive_id, itemId: row.month_folder_item_id, name: row.folder_name ?? '', webUrl: row.web_url, lastVerifiedAt: row.last_verified_at }
    : null

  if (action === 'status') {
    // Re-read the linked folder by its durable ids; never by name.
    let verification: 'verified' | 'identity_mismatch' | 'unavailable' | 'not_checked' = 'not_checked'
    if (runFolder && connection === 'connected') {
      if (runFolder.client_id !== client.id) verification = 'identity_mismatch'
      else {
        const item = await getItem(runFolder.drive_id, runFolder.month_folder_item_id)
        verification = !item ? 'unavailable' : item.itemId === runFolder.month_folder_item_id ? 'verified' : 'identity_mismatch'
      }
    }
    return jsonResponse({
      connection,
      canManage,
      monthBasis,
      expected,
      clientMapping: mapping ? { folderName: mapping.folder_name, webUrl: mapping.web_url } : null,
      runFolder: folderView(runFolder),
      verification,
    })
  }

  // ── Everything below changes a mapping: admin only, OneDrive must be connected ──────────
  if (!canManage) return jsonResponse({ error: 'Only an admin can link OneDrive production folders.' }, 403)
  if (connection !== 'connected') {
    return jsonResponse({ error: connection === 'not_configured' ? 'OneDrive is not configured for CG Dynamics yet.' : 'OneDrive needs its one-time sign-in before folders can be linked.', connection }, 409)
  }

  if (action === 'list_client_folders' || action === 'map_client_folder') {
    const clientsRoot = await resolveClientsFolder()
    if (!clientsRoot) return jsonResponse({ error: 'The OneDrive Clients folder could not be read.' }, 502)
    const children = await listChildren(clientsRoot.driveId, clientsRoot.itemId)
    if (children == null) return jsonResponse({ error: 'The OneDrive Clients folder could not be listed.' }, 502)
    const clientFolders = foldersOnly(children)

    if (action === 'list_client_folders') {
      // A hint only: the admin still chooses the folder explicitly.
      const suggested = findChildByExactName(clientFolders, client.name, { caseInsensitive: true })
      return jsonResponse({ folders: clientFolders.map(({ id, name }) => ({ id, name })), suggestedItemId: suggested?.id ?? null })
    }

    if (!body.clientFolderItemId) return jsonResponse({ error: 'clientFolderItemId is required.' }, 400)
    const selected = resolveChildByDurableId(clientFolders, body.clientFolderItemId)
    if (!selected) return jsonResponse({ error: 'Choose a folder that sits directly inside Clients.' }, 422)
    const inside = await listChildren(clientsRoot.driveId, selected.id)
    if (inside == null) return jsonResponse({ error: 'The selected client folder could not be listed.' }, 502)
    const videos = findChildByExactName(foldersOnly(inside), VIDEOS_FOLDER_NAME, { caseInsensitive: true })
    if (!videos) return jsonResponse({ error: `"${selected.name}" has no ${VIDEOS_FOLDER_NAME} folder. Nothing was mapped.` }, 422)
    const { error: mapError } = await sb.rpc('upsert_client_onedrive_mapping', {
      p_client_id: client.id,
      p_drive_id: clientsRoot.driveId,
      p_client_folder_item_id: selected.id,
      p_videos_folder_item_id: videos.id,
      p_web_url: selected.webUrl,
      p_folder_name: selected.name,
      p_actor_id: userId,
      ...(isInternalWorker && systemProfileId ? { p_actor_profile_id: systemProfileId } : {}),
    })
    if (mapError) return jsonResponse({ error: mapError.message }, 400)
    return jsonResponse({ status: 'mapped', folderName: selected.name })
  }

  // ── #450: the run's per-video production folders ───────────────────────────────────────
  //
  // One create-only folder per saved guideline video, named from the CONFIGURED client short
  // code — never from the client or folder display name. An existing exact-name folder is
  // mapped by its durable id instead of creating a near-match twin. Nothing is renamed,
  // moved or deleted, and a video already mapped is left untouched.
  if (action === 'ensure_video_folders') {
    if (!runFolder) return jsonResponse({ error: 'Link this run\'s month folder first.' }, 409)
    try { assertSameClient(runFolder.client_id, run.client_id) } catch { return jsonResponse({ error: 'Client isolation check failed.' }, 409) }
    if (!client.short_code) {
      return jsonResponse({ error: 'This client has no configured short code, so canonical video folders cannot be named.', blocked: 'BLOCKED_MISSING_SHORT_CODE' }, 409)
    }
    if (!monthDate) return jsonResponse({ error: 'Set the guideline coverage month or the run date first.' }, 409)

    const { data: guidelineRow } = await sb.from('content_guidelines').select('id').eq('content_run_id', run.id).maybeSingle()
    if (!guidelineRow) return jsonResponse({ error: 'This run has no Content Guideline yet.' }, 409)
    const { data: videoRows, error: videoError } = await sb
      .from('content_guide_ideas')
      .select('id, title, position, month, client_id')
      .eq('content_guideline_id', guidelineRow.id)
      .eq('client_id', run.client_id)
      .neq('status', 'archived')
      .order('position', { ascending: true })
    if (videoError) return jsonResponse({ error: videoError.message }, 400)

    const requested = Array.isArray(body.videoIds) && body.videoIds.length
      ? new Set(body.videoIds.map(String))
      : null
    const videos = ((videoRows ?? []) as Array<{ id: string; title: string | null; position: number | null; month: string | null }>)
      .filter(video => !requested || requested.has(video.id))
    if (!videos.length) return jsonResponse({ error: 'No saved guideline video matched.' }, 422)

    const { data: mappedRows } = await sb.rpc('get_content_run_video_folders', { p_content_run_id: run.id })
    const alreadyMapped = new Set(((mappedRows ?? []) as Array<{ content_guide_idea_id: string }>).map(row => row.content_guide_idea_id))

    const children = await listChildren(runFolder.drive_id, runFolder.month_folder_item_id)
    if (children == null) return jsonResponse({ error: 'The run month folder could not be listed.' }, 502)
    const monthChildren = foldersOnly(children)

    const results: Array<Record<string, unknown>> = []
    for (const [index, video] of videos.entries()) {
      if (alreadyMapped.has(video.id)) {
        results.push({ videoId: video.id, state: 'already_mapped' })
        continue
      }
      const position = video.position && video.position > 0 ? video.position : index + 1
      const videoMonth = video.month ?? monthDate
      const name = buildVideoFolderName(
        Number(videoMonth.slice(0, 4)), Number(videoMonth.slice(5, 7)), client.short_code, position,
      )
      // An existing folder with this exact canonical name is mapped, not duplicated.
      let folder = findChildByExactName(monthChildren, name, { caseInsensitive: true })
      let origin: 'canonical' | 'legacy_mapped' = folder ? 'legacy_mapped' : 'canonical'
      if (!folder) {
        if (body.confirmCreate !== true) {
          results.push({ videoId: video.id, state: 'create_required', expectedName: name })
          continue
        }
        const made = await ensureCanonicalChildFolder(runFolder.drive_id, runFolder.month_folder_item_id, name)
        if (!made) { results.push({ videoId: video.id, state: 'create_failed', expectedName: name }); continue }
        folder = { id: made.ref.itemId, name: made.ref.name, isFolder: true, webUrl: made.ref.webUrl }
        origin = 'canonical'
      }
      const { error: mapError } = await sb.rpc('upsert_content_guide_video_folder', {
        p_content_guide_idea_id: video.id,
        p_content_run_id: run.id,
        p_client_id: run.client_id,
        p_drive_id: runFolder.drive_id,
        p_folder_item_id: folder.id,
        p_folder_name: folder.name,
        p_mapping_origin: origin,
        p_actor_id: userId,
        ...(isInternalWorker && systemProfileId ? { p_actor_profile_id: systemProfileId } : {}),
      })
      if (mapError) { results.push({ videoId: video.id, state: 'map_failed', error: mapError.message }); continue }
      results.push({ videoId: video.id, state: origin === 'canonical' ? 'created' : 'mapped_existing', folderName: folder.name })
    }
    return jsonResponse({
      status: 'ensured',
      results,
      note: 'Create-only: existing folders were left exactly as they are, and an existing canonical folder was mapped by its durable id.',
    })
  }

  // link_month_folder | create_month_folder
  if (!mapping) return jsonResponse({ error: 'Map this client\'s OneDrive folder first.' }, 409)
  try { assertSameClient(mapping.client_id, run.client_id) } catch { return jsonResponse({ error: 'Client isolation check failed.' }, 409) }
  if (!mapping.videos_folder_item_id) return jsonResponse({ error: 'This client mapping has no Videos folder.' }, 409)
  if (!expectedNames || !expected) return jsonResponse({ error: 'Set the guideline coverage month or the run date first.' }, 409)
  const create = action === 'create_month_folder' && body.confirmCreate === true
  const created: string[] = []

  const years = await listChildren(mapping.drive_id, mapping.videos_folder_item_id)
  if (years == null) return jsonResponse({ error: 'The client Videos folder could not be listed.' }, 502)
  let yearFolder = findChildByExactName(foldersOnly(years), expectedNames.year, { caseInsensitive: true })
  if (!yearFolder) {
    if (!create) return jsonResponse({ status: 'create_required', missing: 'year', expected })
    const made = await ensureCanonicalChildFolder(mapping.drive_id, mapping.videos_folder_item_id, expectedNames.year)
    if (!made) return jsonResponse({ error: `Could not create ${expectedNames.year}.` }, 502)
    yearFolder = { id: made.ref.itemId, name: made.ref.name, isFolder: true, webUrl: made.ref.webUrl }
    if (made.created) created.push(made.ref.name)
  }

  const months = await listChildren(mapping.drive_id, yearFolder.id)
  if (months == null) return jsonResponse({ error: `${yearFolder.name} could not be listed.` }, 502)
  let monthFolder = findChildByExactName(foldersOnly(months), expectedNames.month, { caseInsensitive: true })
  if (!monthFolder) {
    if (!create) return jsonResponse({ status: 'create_required', missing: 'month', expected })
    const made = await ensureCanonicalChildFolder(mapping.drive_id, yearFolder.id, expectedNames.month)
    if (!made) return jsonResponse({ error: `Could not create ${expectedNames.month}.` }, 502)
    monthFolder = { id: made.ref.itemId, name: made.ref.name, isFolder: true, webUrl: made.ref.webUrl }
    if (made.created) created.push(made.ref.name)
  }

  const { error: linkError } = await sb.rpc('upsert_content_run_onedrive_folder', {
    p_content_run_id: run.id,
    p_client_id: run.client_id,
    p_drive_id: mapping.drive_id,
    p_month_folder_item_id: monthFolder.id,
    p_web_url: monthFolder.webUrl,
    p_folder_name: monthFolder.name,
    p_actor_id: userId,
    ...(isInternalWorker && systemProfileId ? { p_actor_profile_id: systemProfileId } : {}),
  })
  if (linkError) return jsonResponse({ error: linkError.message }, 400)
  return jsonResponse({
    status: 'linked',
    runFolder: { driveId: mapping.drive_id, itemId: monthFolder.id, name: monthFolder.name, webUrl: monthFolder.webUrl, lastVerifiedAt: new Date().toISOString() },
    created,
  })
})
