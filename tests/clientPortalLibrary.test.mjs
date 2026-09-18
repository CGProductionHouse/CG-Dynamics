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
  assert.match(migration, /library_year between 2000 and 2100 and library_month between 1 and 12/)
  assert.match(migration, /mapped_category = 'brand_identity'/)
  assert.match(migration, /mapped_category <> 'brand_identity'/)
  assert.match(migration, /get_client_portal_library_summary/)
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
  assert.match(edge, /Boolean\(row\.last_verified_at\)/)
  assert.match(edge, /service\.rpc\('get_client_portal_library_summary'/)
  for (const publicType of [types, library]) {
    assert.doesNotMatch(publicType, /driveId|itemId|parentItemId|webUrl|onedrive/i)
  }
})

test('missing or disabled mapping fails closed without exposing onboarding uploads', () => {
  assert.match(edge, /!library \|\| !library\.enabled/)
  assert.match(edge, /available: false,[\s\S]*categories: \[\]/)
  assert.match(page, /loadClientPortalLibrary\(\)/)
  assert.match(page, /<ClientPortalLibrary library=\{library\} \/>/)
  const clientHub = page.slice(page.indexOf('function ClientBrandHub'))
  assert.doesNotMatch(clientHub, /BrandAssetLibrary/)
})

test('month metadata and file access are lazy, bounded, and server mediated', () => {
  assert.match(api, /action: 'portal_library_month'/)
  assert.match(api, /action: 'portal_library_access'/)
  assert.match(api, /assetId, purpose/)
  assert.doesNotMatch(api, /response\.blob\(\)|URL\.createObjectURL/)
  assert.doesNotMatch(api, /driveId|itemId|webUrl|onedrive/i)
  assert.match(edge, /action === 'portal_library_month'/)
  assert.match(edge, /\.range\(offset, offset \+ 24\)/)
  assert.match(edge, /action === 'portal_library_access'/)
  assert.match(edge, /authorizePortalAsset\(service, assetId\)/)
  assert.match(edge, /asset\.client_id !== authorized\.profile\.client_id/)
  assert.match(edge, /handlePortalStreamRequest\(service, request, serviceRoleKey\)/)
  const streamHandler = edge.slice(edge.indexOf('async function handlePortalStreamRequest'), edge.indexOf('async function getTokenSession'))
  assert.match(streamHandler, /streamDriveItem\(asset\.drive_id, asset\.item_id, range\)/)
  assert.match(streamHandler, /request\.headers\.get\('range'\) \?\? 'bytes=0-'/)
  assert.match(streamHandler, /createPortalMediaResponse\(result\.stream, result\.status, responseHeaders\)/)
  assert.doesNotMatch(streamHandler, /arrayBuffer|\.blob\(/)
  assert.doesNotMatch(edge, /action === 'portal_library_(?:share|grant|copy|move|create)'/)
})

test('existing OneDrive adapter remains bounded with no permission, share, move, or delete path', () => {
  assert.doesNotMatch(adapter, /\/permissions|createLink|invite/i)
  assert.doesNotMatch(adapter, /method:\s*'DELETE'/)
  assert.doesNotMatch(adapter, /method:\s*'PATCH'/)
  assert.match(adapter, /redirect: 'manual'/)
  assert.match(adapter, /headers: options\.range/)
  assert.match(adapter, /contentResponse\.status !== 206/)
  assert.match(adapter, /stream: contentResponse\.body/)
})

test('library UI is metadata-first with Category -> Year -> Month -> Files and native playback', () => {
  assert.match(library, /grid gap-4 md:grid-cols-2/)
  assert.match(library, /min-h-10/)
  assert.match(library, /flex-wrap/)
  assert.match(library, /summary\.years\.map/)
  assert.match(library, /selectedYearSummary\.months\.map/)
  assert.match(library, /loadClientPortalLibraryFiles/)
  assert.match(library, /IntersectionObserver/)
  assert.match(library, /loading="lazy"/)
  assert.match(library, /<video controls playsInline preload="metadata"/)
  assert.match(library, /getClientPortalAssetAccess\(asset\.id, purpose\)/)
  assert.doesNotMatch(library, /URL\.createObjectURL|\.blob\(/)
  assert.match(library, /\/client\/plan\?month=/)
  assert.match(library, /Working files, source files and raw production assets remain private/)
})
