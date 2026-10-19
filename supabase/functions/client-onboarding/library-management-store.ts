import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { LibraryStore, LibraryRow, CategoryRow, AssetRow } from './library-management.ts'

// Service-only tables stay inaccessible to browser roles. All reads/writes are
// scoped by the already-authorized admin's exact client, never user metadata.
export function libraryManagementStore(service: SupabaseClient): LibraryStore {
  const checked = <T>(result: { data: T; error: unknown }): T => {
    if (result.error) throw new Error('Library storage unavailable')
    return result.data
  }
  return {
    async client(id) { return checked(await service.from('clients').select('id,name').eq('id', id).eq('active', true).maybeSingle()) },
    async binding(id) { return checked(await service.from('client_onedrive_mappings').select('drive_id,client_folder_item_id').eq('client_id', id).maybeSingle()) },
    async library(id) { return checked(await service.from('client_portal_libraries').select('*').eq('client_id', id).maybeSingle()) as LibraryRow | null },
    async categories(id) { return checked(await service.from('client_portal_library_categories').select('*').eq('library_id', id)) as CategoryRow[] },
    async assets(client, library) {
      const rows = checked(await service.from('client_portal_assets').select('id,client_id,library_id,category_id,drive_id,item_id,display_name,active,published_at').eq('client_id', client).eq('library_id', library).order('created_at', { ascending: false }).limit(501)) as AssetRow[]
      if (!rows || rows.length > 500) throw new Error('Library asset review requires pagination')
      return rows
    },
    async createLibrary(row) {
      const data = checked(await service.from('client_portal_libraries').insert(row).select('*').single())
      if (!data) throw new Error('Library not created')
      return data as LibraryRow
    },
    async createCategories(rows) { if (rows.length) checked(await service.from('client_portal_library_categories').insert(rows)) },
    async verifyLibrary(id, client, at) { checked(await service.from('client_portal_libraries').update({ last_verified_at: at }).eq('id', id).eq('client_id', client).select('id').single()) },
    async setEnabled(id, client, enabled, at, expected) {
      // Compare-and-set at the write, not just the earlier Graph verification.
      // A delayed request must not override another admin's visibility decision.
      let query = service.from('client_portal_libraries').update({ enabled, ...(enabled ? { last_verified_at: at } : {}) }).eq('id', id).eq('client_id', client).eq('enabled', expected.enabled)
      query = expected.last_verified_at === null ? query.is('last_verified_at', null) : query.eq('last_verified_at', expected.last_verified_at)
      checked(await query.select('id').single())
    },
    async findAsset(drive, item) { return checked(await service.from('client_portal_assets').select('id,client_id,library_id,category_id,drive_id,item_id,display_name,active,published_at').eq('drive_id', drive).eq('item_id', item).maybeSingle()) as AssetRow | null },
    async publish(row, existing) {
      if (existing) checked(await service.from('client_portal_assets').update(row).eq('id', existing.id).eq('client_id', existing.client_id).eq('library_id', existing.library_id)
        .eq('category_id', existing.category_id).eq('drive_id', existing.drive_id).eq('item_id', existing.item_id)
        .eq('active', false).eq('published_at', existing.published_at).eq('display_name', existing.display_name).select('id').single())
      else checked(await service.from('client_portal_assets').insert(row).select('id').single())
    },
    async hide(id, client) { checked(await service.from('client_portal_assets').update({ active: false }).eq('id', id).eq('client_id', client).select('id').single()) },
  }
}
