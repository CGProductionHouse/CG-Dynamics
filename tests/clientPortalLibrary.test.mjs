import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const migration = read('../supabase/migrations/20260918113000_client_portal_library_foundation.sql')
const edge = read('../supabase/functions/client-onboarding/index.ts')
const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const page = read('../src/features/client-onboarding/ClientSetupPage.tsx')
const library = read('../src/features/client-portal-library/ClientPortalLibrary.tsx')
const api = read('../src/features/client-portal-library/api.ts')
const types = read('../src/features/client-portal-library/types.ts')

test('portal library schema is additive, service-role only, and exact-client linked', () => {
  for (const table of ['client_portal_libraries', 'client_portal_library_categories', 'client_portal_assets']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`))
  }
  assert.match(migration, /root_folder_name ~ '\^A_ClientPortal_/)
  assert.match(migration, /check \(not enabled or last_verified_at is not null\)/)
  assert.match(migration, /foreign key \(library_id, client_id, drive_id\)/)
  assert.match(migration, /foreign key \(category_id, library_id, client_id, drive_id, parent_folder_item_id\)/)
  assert.match(migration, /deliverable\.client_id = new\.client_id/)
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i)
})

test('only the locked category names can be mapped', () => {
  for (const [key, label] of [
    ['brand_identity', 'Brand Identity'],
    ['graphic_design', 'Graphic Design'],
    ['video', 'Video'],
    ['photography', 'Photography'],
  ]) {
    assert.match(migration, new RegExp(`category = '${key}' and folder_name = '${label}'`))
    assert.ok(types.includes(`'${key}'`))
    assert.ok(library.includes(`${key}: '${label}'`))
  }
})

test('client projection uses the authenticated exact client and returns no Graph identity', () => {
  assert.match(edge, /action === 'portal_library_load'/)
  assert.match(edge, /authorized\.profile\.role !== 'client' \|\| !authorized\.profile\.client_id/)
  assert.match(edge, /safePortalLibrary\(service, authorized\.profile\.client_id\)/)
  assert.match(edge, /\.eq\('client_id', clientId\)/)
  assert.match(edge, /row\.parent_folder_item_id !== category\.folder_item_id/)
  assert.match(edge, /Boolean\(row\.last_verified_at\)/)
  assert.match(edge, /\.lte\('published_at', new Date\(\)\.toISOString\(\)\)/)

  const projection = edge.slice(edge.indexOf('assets.push({'), edge.indexOf('return {', edge.indexOf('assets.push({')))
  for (const forbidden of ['driveId', 'itemId', 'parentItemId', 'webUrl', 'path']) {
    assert.doesNotMatch(projection, new RegExp(forbidden, 'i'))
  }
  for (const publicType of [types, library]) {
    assert.doesNotMatch(publicType, /driveId|itemId|parentItemId|webUrl|onedrive/i)
  }
})

test('missing or disabled mapping fails closed without exposing onboarding uploads', () => {
  assert.match(edge, /!library \|\| !library\.enabled/)
  assert.match(edge, /available: false,[\s\S]*categories: \[\],[\s\S]*assets: \[\]/)
  assert.match(page, /loadClientPortalLibrary\(\)/)
  assert.match(page, /<ClientPortalLibrary library=\{library\} \/>/)
  const clientHub = page.slice(page.indexOf('function ClientBrandHub'))
  assert.doesNotMatch(clientHub, /BrandAssetLibrary/)
})

test('file open and download are server mediated and re-check the exact boundary', () => {
  assert.match(api, /action: 'portal_library_file'/)
  assert.match(api, /assetId, disposition/)
  assert.doesNotMatch(api, /driveId|itemId|webUrl|onedrive/i)
  assert.match(edge, /action === 'portal_library_file'/)
  assert.match(edge, /\.eq\('client_id', authorized\.profile\.client_id\)/)
  const fileRoute = edge.slice(edge.indexOf("action === 'portal_library_file'"), edge.indexOf("action === 'portal_load'"))
  assert.match(fileRoute, /\.lte\('published_at', new Date\(\)\.toISOString\(\)\)/)
  assert.match(edge, /category\.folder_item_id === asset\.parent_folder_item_id/)
  assert.match(edge, /downloadFile\(asset\.drive_id, asset\.item_id\)/)
  assert.match(edge, /isSafeInlineMimeType\(mimeType\)/)
  assert.match(edge, /streamResponse\(buffer, mimeType, asset\.file_name, disposition\)/)
  assert.doesNotMatch(edge, /action === 'portal_library_(?:share|grant|copy|move|create)'/)
})

test('existing OneDrive adapter remains bounded with no permission, share, move, or delete path', () => {
  assert.doesNotMatch(adapter, /\/permissions|createLink|invite/i)
  assert.doesNotMatch(adapter, /method:\s*'DELETE'/)
  assert.doesNotMatch(adapter, /method:\s*'PATCH'/)
})

test('library UI has mobile-safe controls and one canonical Plan link', () => {
  assert.match(library, /grid gap-4 md:grid-cols-2/)
  assert.match(library, /min-h-10/)
  assert.match(library, /flex-wrap/)
  assert.match(library, /const canOpen = Boolean/)
  assert.match(library, /\/client\/plan\?month=/)
  assert.match(library, /Only final files approved for your organisation appear here/)
  assert.match(library, /Working files, source files and raw production assets remain private/)
})
