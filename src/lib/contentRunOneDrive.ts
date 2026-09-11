// A Content Run's exact OneDrive production month folder (#224, on the #225 model).
//
// The month folder is `My files / Clients / <Client> / Videos / <YYYY> / <YYYY_MM_MON>` and is
// linked by durable Graph drive/item ids. There are no per-video folders. OneDrive tables are
// service-role only, so every read and write goes through the `content-run-onedrive-folder`
// Edge Function; linking is admin-only, matching the existing upsert RPCs.
import { supabase } from './supabase'
import { buildMonthFolderName, buildYearFolderName } from './onedriveCanonical'

export type OneDriveConnectionState = 'not_configured' | 'needs_consent' | 'connected'
export type OneDriveMonthBasis = 'guideline_coverage' | 'run_date'
export type OneDriveVerification = 'verified' | 'identity_mismatch' | 'unavailable' | 'not_checked'

export interface ExpectedMonthFolder {
  year: string
  monthFolder: string
  path: string
}

export interface RunOneDriveFolder {
  driveId: string
  itemId: string
  name: string
  webUrl: string | null
  lastVerifiedAt: string | null
}

export interface RunOneDriveStatus {
  connection: OneDriveConnectionState
  canManage: boolean
  monthBasis: OneDriveMonthBasis | null
  expected: ExpectedMonthFolder | null
  clientMapping: { folderName: string | null; webUrl: string | null } | null
  runFolder: RunOneDriveFolder | null
  verification: OneDriveVerification
}

export interface OneDriveClientFolderOption {
  id: string
  name: string
}

export type LinkMonthFolderResult =
  | { status: 'linked'; runFolder: RunOneDriveFolder; created: string[] }
  | { status: 'create_required'; missing: 'year' | 'month'; expected: ExpectedMonthFolder }

/** Expected month folder for a content month (YYYY-MM or YYYY-MM-DD). Display only — never a lookup key. */
export function expectedRunMonthFolder(monthDate: string | null | undefined, clientFolderName: string | null | undefined): ExpectedMonthFolder | null {
  if (!monthDate || !/^\d{4}-\d{2}/.test(monthDate)) return null
  const year = Number(monthDate.slice(0, 4))
  const month = Number(monthDate.slice(5, 7))
  const yearFolder = buildYearFolderName(year)
  const monthFolder = buildMonthFolderName(year, month)
  return {
    year: yearFolder,
    monthFolder,
    path: ['Clients', clientFolderName?.trim() || '<client folder>', 'Videos', yearFolder, monthFolder].join(' / '),
  }
}

async function callFolderFunction<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  if (!token) return { data: null, error: 'Authentication required.' }
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/content-run-onedrive-folder`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return { data: null, error: typeof payload.error === 'string' ? payload.error : `Server responded ${response.status}.` }
    return { data: payload as T, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Could not reach the OneDrive folder service.' }
  }
}

export function getRunOneDriveStatus(contentRunId: string) {
  return callFolderFunction<RunOneDriveStatus>({ action: 'status', contentRunId })
}

export function listOneDriveClientFolders(contentRunId: string) {
  return callFolderFunction<{ folders: OneDriveClientFolderOption[]; suggestedItemId: string | null }>({ action: 'list_client_folders', contentRunId })
}

export function mapOneDriveClientFolder(contentRunId: string, clientFolderItemId: string) {
  return callFolderFunction<{ status: 'mapped'; folderName: string }>({ action: 'map_client_folder', contentRunId, clientFolderItemId })
}

export function linkRunMonthFolder(contentRunId: string) {
  return callFolderFunction<LinkMonthFolderResult>({ action: 'link_month_folder', contentRunId })
}

/** Creates only the missing canonical year/month folder(s), then links. Never renames, moves or deletes. */
export function createAndLinkRunMonthFolder(contentRunId: string) {
  return callFolderFunction<LinkMonthFolderResult>({ action: 'create_month_folder', contentRunId, confirmCreate: true })
}
