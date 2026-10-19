import { supabase } from '../../lib/supabase'
import type { ClientPortalLibraryCategory } from './types'

export type ManagedLibrary = { clientId: string; clientName: string; prepared: boolean; enabled: boolean; verificationError: string | null; assets: Array<{ id: string; displayName: string; active: boolean; publishedAt: string }> }
export type LibraryEntry = { id: string; name: string; folder: boolean; size: number | null; mimeType: string | null; selectable: boolean; reviewUrl: string | null }
export type LibraryBrowse = { entries: LibraryEntry[]; nextOffset: number | null }
export const LIBRARY_MANAGEMENT_LABELS: Record<ClientPortalLibraryCategory, string> = { brand_identity: 'Brand Identity', graphic_design: 'Graphic Design', video: 'Video' }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export function projectManagedLibrary(value: unknown, clientId: string): ManagedLibrary | null {
  if (!record(value) || value.clientId !== clientId || typeof value.clientName !== 'string' || typeof value.prepared !== 'boolean' || typeof value.enabled !== 'boolean' || !Array.isArray(value.assets)) return null
  const assets: ManagedLibrary['assets'] = []
  for (const a of value.assets) {
    if (!record(a) || typeof a.id !== 'string' || typeof a.displayName !== 'string' || typeof a.active !== 'boolean' || typeof a.publishedAt !== 'string') return null
    assets.push({ id: a.id, displayName: a.displayName, active: a.active, publishedAt: a.publishedAt })
  }
  if (new Set(assets.map(a => a.id)).size !== assets.length) return null
  return { clientId, clientName: value.clientName, prepared: value.prepared, enabled: value.enabled, verificationError: value.verificationError ? 'Folder verification is unavailable. You can still hide the library.' : null, assets }
}
export function managementWriteConfirmed(action: string, data: unknown, clientId: string, enabled: unknown): boolean {
  if (!record(data)) return false
  if (action === 'staff_library_prepare') return projectManagedLibrary(data, clientId)?.prepared === true
  if (action === 'staff_library_enable') return typeof enabled === 'boolean' && data.enabled === enabled
  if (action === 'staff_library_publish') return data.published === true
  if (action === 'staff_library_hide') return data.hidden === true
  return false
}
export function projectLibraryBrowse(value: unknown): LibraryBrowse | null {
  if (!record(value) || !Array.isArray(value.entries) || value.entries.length > 24 || !(value.nextOffset === null || (typeof value.nextOffset === 'number' && Number.isSafeInteger(value.nextOffset) && value.nextOffset >= 0))) return null
  const entries: LibraryEntry[] = []
  for (const e of value.entries) {
    if (!record(e) || typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.folder !== 'boolean' || typeof e.selectable !== 'boolean' || !(e.size === null || (typeof e.size === 'number' && Number.isSafeInteger(e.size) && e.size >= 0)) || !(e.mimeType === null || typeof e.mimeType === 'string')) return null
    let reviewUrl: string | null = null
    try {
      const url = new URL(typeof e.reviewUrl === 'string' ? e.reviewUrl : '')
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'onedrive.live.com' || url.hostname === '1drv.ms' || url.hostname.endsWith('.sharepoint.com'))) reviewUrl = url.href
    } catch { /* Provider preview remains optional; never accept an unsafe link. */ }
    entries.push({ id: e.id, name: e.name, folder: e.folder, selectable: e.selectable, size: e.size, mimeType: e.mimeType, reviewUrl })
  }
  if (new Set(entries.map(e => e.id)).size !== entries.length) return null
  return { entries, nextOffset: value.nextOffset as number | null }
}
export async function libraryManagement(action: string, clientId: string, input: Record<string, unknown> = {}): Promise<{ data: unknown; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('client-onboarding', { body: { ...input, action, clientId } })
    if (error || data?.ok !== true) return { data: null, error: 'Could not confirm this library action. Reload and check its current state.' }
    return { data: data.data, error: null }
  } catch { return { data: null, error: 'Could not reach the library. Please try again.' } }
}
