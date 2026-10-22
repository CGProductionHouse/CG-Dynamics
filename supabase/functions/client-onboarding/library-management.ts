// #396: explicit admin curation, sharing the existing library tables and broker.
// Discovery is read-only. No folder creation, Graph sharing or bulk publication.
import { portalRootFolderName } from '../_shared/portal-visibility.ts'
export const LIBRARY_LABELS = { brand_identity: 'Brand Identity', graphic_design: 'Graphic Design', video: 'Video' } as const
export type LibraryCategory = keyof typeof LIBRARY_LABELS
export type LibraryRow = { id: string; client_id: string; drive_id: string; root_folder_item_id: string; root_folder_name: string; enabled: boolean; last_verified_at: string | null }
export type CategoryRow = { id: string; library_id: string; client_id: string; drive_id: string; folder_item_id: string; folder_name: string; category: LibraryCategory; last_verified_at: string | null }
export type AssetRow = { id: string; client_id: string; library_id: string; category_id: string; drive_id: string; item_id: string; display_name: string; active: boolean; published_at: string }
export type DriveEntry = { id: string; name: string; isFolder: boolean; size: number | null; mimeType: string | null; parentId: string; driveId: string; reviewUrl?: string | null }
export interface LibraryDrive { children(drive: string, parent: string): Promise<DriveEntry[] | null> }
export interface LibraryStore {
  client(id: string): Promise<{ id: string; name: string } | null>
  binding(id: string): Promise<{ drive_id: string; client_folder_item_id: string } | null>
  library(id: string): Promise<LibraryRow | null>
  categories(id: string): Promise<CategoryRow[]>
  assets(client: string, library: string): Promise<AssetRow[]>
  createLibrary(row: Record<string, unknown>): Promise<LibraryRow>
  createCategories(rows: Record<string, unknown>[]): Promise<void>
  verifyLibrary(id: string, client: string, at: string): Promise<void>
  setEnabled(id: string, client: string, enabled: boolean, at: string, expected: LibraryRow): Promise<void>
  findAsset(drive: string, item: string): Promise<AssetRow | null>
  publish(row: Record<string, unknown>, existing: AssetRow | null): Promise<void>
  hide(id: string, client: string): Promise<void>
}
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s)
const rootName = (s: string) => /^A_ClientPortal_[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(s)
const allowedMime = (s: string | null) => /^(image\/(png|jpeg|webp|gif|avif)|application\/pdf|video\/mp4)$/i.test(s ?? '')
const fail = (error: string, status = 409) => ({ status, body: { ok: false as const, error } })
const ok = (data: unknown) => ({ status: 200, body: { ok: true as const, data } })

export async function manageLibrary(body: Record<string, unknown>, actor: { id: string; role: string }, store: LibraryStore, drive: LibraryDrive) {
  if (actor.role !== 'admin') return fail('Admin access required.', 403)
  if (!uuid(body.clientId)) return fail('Select an exact client.', 400)
  const clientId = body.clientId
  try {
    const client = await store.client(clientId)
    if (!client) return fail('Active client not found.', 404)
    const action = body.action
    if (!['staff_library_review', 'staff_library_prepare', 'staff_library_browse', 'staff_library_publish', 'staff_library_hide', 'staff_library_enable'].includes(String(action))) return fail('Unknown library action.', 400)
    let library = await store.library(clientId)
    const verificationFailure = (error: string, status = 409) => action === 'staff_library_review' && library
      ? ok({ clientId, clientName: client.name, prepared: false, enabled: library.enabled, verificationError: error, categories: [], assets: [] })
      : fail(error, status)

    // Disabling/hiding does not need Graph availability. Neither destroys history.
    if (action === 'staff_library_enable' && body.enabled === false) {
      if (!library) return fail('Library not found.', 404)
      await store.setEnabled(library.id, clientId, false, new Date().toISOString(), library)
      return ok({ enabled: false })
    }
    if (action === 'staff_library_hide') {
      if (!library || !uuid(body.assetId)) return fail('Select a published file.', 400)
      const assets = await store.assets(clientId, library.id)
      if (!assets.some(a => a.id === body.assetId && a.client_id === clientId)) return fail('File not found.', 404)
      await store.hide(body.assetId, clientId)
      return ok({ hidden: true })
    }

    const binding = await store.binding(clientId)
    if (!binding?.drive_id || !binding.client_folder_item_id) return verificationFailure('Exact client folder binding is unavailable.')
    // Durable mapping is authoritative even if an internal folder was nested or renamed.
    const roots = await drive.children(binding.drive_id, binding.client_folder_item_id)
    if (!roots) return verificationFailure('Could not verify the client folder.', 503)
    const portals = roots.filter(row => row.isFolder && rootName(row.name))
    if (portals.length !== 1) return verificationFailure('One exact client portal folder is required.')
    const root = portals[0]
    if (root.name !== portalRootFolderName(client.name)) return verificationFailure('The portal folder name needs exact-client review.')
    const folders = await drive.children(binding.drive_id, root.id)
    if (!folders) return verificationFailure('Could not verify the library sections.', 503)
    const keys = Object.keys(LIBRARY_LABELS) as LibraryCategory[]
    const exact = keys.map(key => ({ key, matches: folders.filter(f => f.isFolder && f.name === LIBRARY_LABELS[key]) }))
    if (exact.some(e => e.matches.length !== 1)) return verificationFailure('Each library section needs one exact folder.')
    if (library && (library.client_id !== clientId || library.drive_id !== binding.drive_id || library.root_folder_item_id !== root.id || library.root_folder_name !== root.name)) return verificationFailure('The saved library no longer matches this client folder.')

    if (action === 'staff_library_prepare' && !library) {
      library = await store.createLibrary({ client_id: clientId, drive_id: binding.drive_id, root_folder_item_id: root.id, root_folder_name: root.name, enabled: false, mapped_by: actor.id })
    }
    let categories = library ? await store.categories(library.id) : []
    if (action === 'staff_library_prepare' && library && !library.enabled) {
      // Retry only fills missing rows; never overwrite/remap an existing section.
      for (const entry of exact) {
        const saved = categories.find(c => c.category === entry.key)
        if (saved && (saved.client_id !== clientId || saved.drive_id !== binding.drive_id || saved.folder_item_id !== entry.matches[0].id || saved.folder_name !== LIBRARY_LABELS[entry.key])) return fail('A saved section needs mapping review.')
      }
      const at = new Date().toISOString()
      await store.createCategories(exact.filter(e => !categories.some(c => c.category === e.key)).map(e => ({ library_id: library!.id, client_id: clientId, drive_id: binding.drive_id, category: e.key, folder_item_id: e.matches[0].id, folder_name: LIBRARY_LABELS[e.key], mapped_by: actor.id, last_verified_at: at })))
      await store.verifyLibrary(library.id, clientId, at)
      library = await store.library(clientId)
      categories = library ? await store.categories(library.id) : []
    }
    const verified = Boolean(library?.last_verified_at) && categories.length === keys.length && keys.every(key => categories.some(c => c.category === key && c.client_id === clientId && c.library_id === library!.id && c.drive_id === binding.drive_id && c.folder_item_id === exact.find(e => e.key === key)!.matches[0].id && c.folder_name === LIBRARY_LABELS[key] && Boolean(c.last_verified_at)))
    if (action === 'staff_library_review' || action === 'staff_library_prepare') {
      return ok({ clientId, clientName: client.name, prepared: verified, enabled: library?.enabled ?? false,
        categories: keys.map(category => ({ category, label: LIBRARY_LABELS[category] })),
        assets: library ? (await store.assets(clientId, library.id)).map(a => ({ id: a.id, displayName: a.display_name, active: a.active, publishedAt: a.published_at })) : [] })
    }
    if (!library || !verified) return fail('Prepare and verify this library first.')
    if (action === 'staff_library_enable') {
      if (body.enabled !== true || body.confirmed !== true) return fail('Confirm enabling this library.', 400)
      // Enabling an empty curated library never publishes its backing folder.
      await store.setEnabled(library.id, clientId, true, new Date().toISOString(), library)
      return ok({ enabled: true })
    }
    if (typeof body.category !== 'string' || !Object.hasOwn(LIBRARY_LABELS, body.category)) return fail('Select a library section.', 400)
    const category = categories.find(c => c.category === body.category)!
    const path = body.folderPath ?? []
    if (!Array.isArray(path) || path.length > 5 || path.some(id => typeof id !== 'string' || !id || id.length > 255) || new Set(path).size !== path.length) return fail('Invalid folder selection.', 400)
    let parent = category.folder_item_id
    for (const id of path) {
      const children = await drive.children(binding.drive_id, parent)
      if (!children) return fail('Could not read this folder.', 503)
      if (!children.some(e => e.id === id && e.isFolder)) return fail('Folder is outside this library section.', 404)
      parent = id
    }
    const children = await drive.children(binding.drive_id, parent)
    if (!children) return fail('Could not read this folder.', 503)
    if (action === 'staff_library_browse') {
      const offset = body.offset ?? 0
      if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return fail('Invalid page.', 400)
      const sorted = [...children].sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      const page = sorted.slice(offset, offset + 24)
      return ok({ entries: page.map(e => ({ id: e.id, name: e.name, folder: e.isFolder, size: e.size, mimeType: e.mimeType, reviewUrl: e.reviewUrl ?? null, selectable: !e.isFolder && allowedMime(e.mimeType) && Number.isSafeInteger(e.size) && e.size! > 0 })), nextOffset: sorted.length > offset + 24 ? offset + 24 : null })
    }
    if (body.confirmed !== true) return fail('Confirm that this exact file is client-ready.', 400)
    const file = children.find(e => !e.isFolder && e.id === body.itemId)
    if (!file || file.driveId !== binding.drive_id || file.parentId !== parent || !allowedMime(file.mimeType) || !Number.isSafeInteger(file.size) || file.size! <= 0) return fail('A supported client-ready file is required.', 400)
    const flat = category.category === 'brand_identity'
    if (flat && path.length) return fail('Brand Identity files must be in its mapped folder.', 400)
    const year = flat ? null : body.year, month = flat ? null : body.month
    if (!flat && (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100 || typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12)) return fail('Select the exact delivery month.', 400)
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
    /* eslint-disable no-control-regex */
    if (!displayName || displayName.length > 255 || /[\x00-\x1f]/.test(displayName)) return fail('Enter a clear file name.', 400)
/* eslint-enable no-control-regex */
    const existing = await store.findAsset(binding.drive_id, file.id)
    if (existing && (existing.client_id !== clientId || existing.library_id !== library.id || existing.category_id !== category.id)) return fail('This file already belongs to a different library.')
    if (existing?.active) return ok({ published: true, unchanged: true })
    await store.publish({ client_id: clientId, library_id: library.id, category_id: category.id, drive_id: binding.drive_id,
      parent_folder_item_id: category.folder_item_id, item_id: file.id, file_name: file.name, display_name: displayName,
      mime_type: file.mimeType, size_bytes: file.size, library_year: year, library_month: month,
      published_by: actor.id, published_at: new Date().toISOString(), active: true }, existing)
    return ok({ published: true, unchanged: false })
  } catch {
    return fail('The library operation could not be confirmed. Reload before trying again.', 503)
  }
}
