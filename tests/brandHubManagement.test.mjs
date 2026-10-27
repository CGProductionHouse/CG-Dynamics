import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { syntheticBrandHubPacket } from './fixtures/brandHubSyntheticPacket.mjs'

test('Brand Hub management is admin-only and never implicitly publishes folder contents', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { manageLibrary } = await server.ssrLoadModule('/supabase/functions/client-onboarding/library-management.ts')
    for (const role of ['client', 'manager', 'staff', 'team', '']) {
      const result = await manageLibrary({ action: 'staff_library_review', clientId: '11111111-1111-4111-8111-111111111111' },
        { role, id: 'actor' }, new Proxy({}, { get() { throw new Error('Unauthorized storage access') } }), {})
      assert.equal(result.status, 403)
    }
  } finally { await server.close() }
})

const clientId = '11111111-1111-4111-8111-111111111111'
const admin = { role: 'admin', id: 'admin' }
function fixture() {
  let library = null
  let categories = [], assets = []
  const writes = []
  const entry = (id, name, parentId, isFolder = true) => ({ id, name, parentId, driveId: 'drive', isFolder, size: isFolder ? null : 100, mimeType: isFolder ? null : 'image/png' })
  const folders = { bound: [entry('root', 'A_ClientPortal_Exact_Client', 'bound')], root: [entry('brand', 'Brand Identity', 'root'), entry('design', 'Graphic Design', 'root'), entry('video', 'Video', 'root')],
    brand: [entry('logo', 'Logo.png', 'brand', false), { ...entry('source', 'Source.psd', 'brand', false), mimeType: 'application/vnd.adobe.photoshop' }], design: [entry('year', '2026', 'design')], year: [entry('month', '2026_10_OCT', 'year')], month: [entry('poster', 'Poster.png', 'month', false)], video: [] }
  const store = {
    async client(id) { return id === clientId ? { id, name: 'Exact Client' } : null },
    async binding() { return { drive_id: 'drive', client_folder_item_id: 'bound' } },
    async library() { return library },
    async categories() { return categories }, async assets() { return assets },
    async createLibrary(row) { writes.push('library'); return library = { id: 'lib', ...row, last_verified_at: null } },
    async createCategories(rows) { writes.push('categories'); categories.push(...rows.map((r, n) => ({ id: `cat-${n}`, ...r }))) },
    async verifyLibrary(_id, _client, at) { writes.push('verify'); library.last_verified_at = at },
    async setEnabled(_id, _client, enabled) { writes.push('enable'); library.enabled = enabled },
    async findAsset(drive, item) { return assets.find(a => a.drive_id === drive && a.item_id === item) ?? null },
    async publish(row, existing) { writes.push('publish'); if (existing) Object.assign(existing, row); else assets.push({ id: '22222222-2222-4222-8222-222222222222', ...row }) },
    async hide(id, client) { writes.push('hide'); assets.find(a => a.id === id && a.client_id === client).active = false },
  }
  return { store, drive: { async children(_drive, id) { return folders[id] ?? null } }, folders, writes, get library() { return library }, get categories() { return categories }, get assets() { return assets } }
}

test('exact-client lifecycle, exclusions, recovery and explicit per-file curation', async t => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { manageLibrary } = await server.ssrLoadModule('/supabase/functions/client-onboarding/library-management.ts')
    const call = (f, action, input = {}) => manageLibrary({ action: `staff_library_${action}`, clientId, ...input }, admin, f.store, f.drive)
    async function prepared() { const f = fixture(); assert.equal((await call(f, 'prepare')).status, 200); return f }
    await t.test('review is read-only; prepare stages disabled mappings and never assets', async () => {
      const f = fixture()
      assert.equal((await call(f, 'review')).body.data.prepared, false); assert.deepEqual(f.writes, [])
      const result = await call(f, 'prepare')
      assert.equal(result.body.data.prepared, true); assert.equal(result.body.data.enabled, false)
      assert.equal(f.categories.length, 3); assert.equal(f.assets.length, 0)
      await call(f, 'prepare'); assert.equal(f.categories.length, 3); assert.equal(f.assets.length, 0)
    })
    await t.test('enable has explicit consent; no automatic publication', async () => {
      const f = await prepared()
      assert.equal((await call(f, 'enable', { enabled: true })).status, 400)
      assert.equal(f.library.enabled, false)
      assert.equal((await call(f, 'enable', { enabled: true, confirmed: true })).status, 200)
      assert.equal(f.assets.length, 0)
      await call(f, 'prepare'); assert.equal(f.library.enabled, true, 'Repeated preparation must not hide a live library')
    })
    await t.test('safe browser metadata excludes unsupported sources and does not publish', async () => {
      const f = await prepared()
      const result = await call(f, 'browse', { category: 'brand_identity' })
      assert.equal(result.body.data.entries.find(e => e.id === 'logo').selectable, true)
      assert.equal(result.body.data.entries.find(e => e.id === 'source').selectable, false)
      assert.equal(f.assets.length, 0)
    })
    await t.test('publish rechecks file membership, explicit consent, actor and unique identity', async () => {
      const f = await prepared()
      const input = { category: 'brand_identity', itemId: 'logo', displayName: 'Logo pack' }
      assert.equal((await call(f, 'publish', input)).status, 400)
      assert.equal((await call(f, 'publish', { ...input, confirmed: true, itemId: 'outside' })).status, 400)
      assert.equal((await call(f, 'publish', { ...input, confirmed: true })).status, 200)
      assert.equal(f.assets[0].published_by, admin.id); assert.equal(f.assets[0].client_id, clientId)
      const at = f.assets[0].published_at
      const duplicate = await call(f, 'publish', { ...input, confirmed: true })
      assert.equal(duplicate.body.data.unchanged, true); assert.equal(f.assets.length, 1); assert.equal(f.assets[0].published_at, at)
    })
    await t.test('display names reject every embedded ASCII control before publication without blocking Unicode', async () => {
      const f = await prepared(), count = f.writes.length
      const input = { category: 'brand_identity', itemId: 'logo', confirmed: true }
      for (let code = 0; code < 32; code++) {
        const result = await call(f, 'publish', { ...input, displayName: `Logo${String.fromCharCode(code)}pack` })
        assert.equal(result.status, 400, `ASCII control ${code} rejected`)
        assert.equal(f.writes.length, count, 'Invalid name cannot publish, enable or mutate library')
      }
      for (const displayName of ['', '  ', 'x'.repeat(256), null, 4, {}]) {
        assert.equal((await call(f, 'publish', { ...input, displayName })).status, 400)
        assert.equal(f.writes.length, count)
      }
      for (const displayName of ['x'.repeat(255), 'Élan — logo 🎨', '品牌標誌', 'A\u007fB']) {
        const valid = await prepared()
        assert.equal((await call(valid, 'publish', { ...input, displayName })).status, 200)
        assert.equal(valid.assets[0].display_name, displayName, 'Keep the existing Unicode/DEL boundary; no extra content policy')
      }
    })
    await t.test('nested media require the complete exact section path and explicit month', async () => {
      const f = await prepared()
      const input = { category: 'graphic_design', folderPath: ['year', 'month'], itemId: 'poster', displayName: 'October poster', confirmed: true }
      assert.equal((await call(f, 'publish', input)).status, 400)
      assert.equal((await call(f, 'publish', { ...input, year: 2026, month: 10 })).status, 200)
      assert.equal(f.assets[0].parent_folder_item_id, 'design'); assert.equal(f.assets[0].library_month, 10)
      assert.equal((await call(f, 'publish', { ...input, folderPath: ['month'], year: 2026, month: 10 })).status, 404)
    })
    await t.test('cross-client/category/moved/stale mappings fail before writes', async () => {
      const f = await prepared()
      const count = f.writes.length
      f.categories[0].client_id = 'another-client'
      assert.equal((await call(f, 'enable', { enabled: true, confirmed: true })).status, 409)
      assert.equal(f.writes.length, count)
      f.categories[0].client_id = clientId
      f.folders.root[0].id = 'moved'
      assert.equal((await call(f, 'browse', { category: 'brand_identity' })).status, 409)
    })
    await t.test('ambiguous roots, mismatched names and missing categories fail closed', async () => {
      for (const change of [f => f.folders.bound.push({ ...f.folders.bound[0], id: 'duplicate' }), f => { f.folders.bound[0].name = 'A_ClientPortal_Other_Client' }, f => f.folders.root.pop()]) {
        const f = fixture(); change(f); assert.equal((await call(f, 'prepare')).status, 409); assert.deepEqual(f.writes, [])
      }
    })
    await t.test('missing/foreign clients, unsupported files and malformed folders never write', async () => {
      const f = await prepared(), count = f.writes.length
      assert.equal((await call(f, 'publish', { category: 'brand_identity', itemId: 'source', displayName: 'source', confirmed: true })).status, 400)
      assert.equal((await call(f, 'browse', { category: 'brand_identity', folderPath: ['x', 'x'] })).status, 400)
      assert.equal((await call(f, 'browse', { category: 'brand_identity', offset: -1 })).status, 400)
      assert.equal((await call(f, 'prepare', { clientId: 'other' })).status, 400)
      assert.equal((await call(f, 'prepare', { clientId: '33333333-3333-4333-8333-333333333333' })).status, 404)
      assert.equal(f.writes.length, count)
    })
    await t.test('existing foreign asset cannot be reassigned; hide preserves history during provider outage', async () => {
      const f = await prepared()
      f.assets.push({ id: '22222222-2222-4222-8222-222222222222', client_id: 'other', drive_id: 'drive', item_id: 'logo', library_id: 'elsewhere', category_id: 'elsewhere', active: true })
      assert.equal((await call(f, 'publish', { category: 'brand_identity', itemId: 'logo', displayName: 'Logo', confirmed: true })).status, 409)
      f.assets.length = 0
      await call(f, 'publish', { category: 'brand_identity', itemId: 'logo', displayName: 'Logo', confirmed: true })
      f.drive.children = async () => null
      f.library.enabled = true
      const unavailable = await call(f, 'review')
      assert.equal(unavailable.status, 200)
      assert.equal(unavailable.body.data.enabled, true)
      assert.equal(unavailable.body.data.prepared, false)
      assert.match(unavailable.body.data.verificationError, /verify/)
      assert.equal((await call(f, 'hide', { assetId: f.assets[0].id })).status, 200)
      assert.equal(f.assets.length, 1); assert.equal(f.assets[0].active, false)
      assert.equal((await call(f, 'enable', { enabled: false })).status, 200)
    })
    await t.test('storage failures are sanitized, never successful empty reads', async () => {
      const f = fixture(); f.store.library = async () => { throw new Error('private token/path') }
      const result = await call(f, 'review'); assert.equal(result.status, 503); assert.doesNotMatch(JSON.stringify(result), /private token/)
    })
  } finally { await server.close() }
})

test('provider ancestry revokes moved/replaced files without leaking private trees', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { isAssetInsideCategory } = await server.ssrLoadModule('/supabase/functions/client-onboarding/library-asset-boundary.ts')
    const expected = { itemId: 'asset', driveId: 'drive', categoryId: 'category', rootId: 'root', mime: 'image/png', size: 10 }
    const rows = { asset: { id: 'asset', driveId: 'drive', parentId: 'month', file: true, mime: 'image/png', size: 10 }, month: { id: 'month', driveId: 'drive', parentId: 'category', file: false }, category: { id: 'category', driveId: 'drive', parentId: 'root', file: false } }
    const check = () => isAssetInsideCategory(async id => rows[id] ?? null, expected)
    assert.equal(await check(), true)
    rows.month.parentId = 'private'; assert.equal(await check(), false)
    rows.month.parentId = 'category'; rows.asset.size = 20; assert.equal(await check(), false)
    rows.asset.size = 10; rows.month.driveId = 'other'; assert.equal(await check(), false)
    rows.month.driveId = 'drive'; rows.month.parentId = 'asset'; assert.equal(await check(), false)
    rows.month.parentId = 'category'; rows.category.parentId = 'another-root'; assert.equal(await check(), false)
  } finally { await server.close() }
})

test('61 synthetic exact folder topologies stage privately without private provider receipts', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { manageLibrary } = await server.ssrLoadModule('/supabase/functions/client-onboarding/library-management.ts')
    const packet = syntheticBrandHubPacket()
    for (const c of packet.clients) {
      const f = fixture()
      f.store.client = async id => id === c.client_id ? { id, name: c.client } : null
      f.store.binding = async () => ({ drive_id: packet.drive_id, client_folder_item_id: c.internal_parent_folder_item_id })
      f.drive.children = async (driveId, parent) => parent === c.internal_parent_folder_item_id
        ? [{ id: c.root.id, name: c.root.name, isFolder: true, parentId: parent, driveId }]
        : parent === c.root.id ? c.categories.map(x => ({ id: x.id, name: x.name, isFolder: true, parentId: parent, driveId })) : null
      const result = await manageLibrary({ action: 'staff_library_prepare', clientId: c.client_id }, admin, f.store, f.drive)
      assert.equal(result.status, 200, c.client)
      assert.equal(result.body.data.prepared, true, c.client)
      assert.equal(f.library.enabled, false, c.client)
      assert.equal(f.assets.length, 0, c.client)
    }
  } finally { await server.close() }
})

test('management projections strip provider extras, reject wrong clients and require typed write receipts', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') } })
  try {
    const { projectManagedLibrary, projectLibraryBrowse, managementWriteConfirmed } = await server.ssrLoadModule('/src/features/client-portal-library/managementApi.ts')
    const data = { clientId, clientName: 'Exact Client', prepared: true, enabled: false, assets: [], privileged: 'must be omitted' }
    assert.equal(projectManagedLibrary(data, 'other'), null)
    assert.equal('privileged' in projectManagedLibrary(data, clientId), false)
    const entry = { id: 'item', name: 'Logo.png', folder: false, selectable: true, size: 100, mimeType: 'image/png' }
    for (const reviewUrl of ['javascript:alert(1)', 'https://evil.example/', 'https://user:password@onedrive.live.com/', 'https://onedrive.live.com.evil.example/']) {
      assert.equal(projectLibraryBrowse({ entries: [{ ...entry, reviewUrl }], nextOffset: null }).entries[0].reviewUrl, null)
    }
    assert.equal(projectLibraryBrowse({ entries: [entry, entry], nextOffset: null }), null)
    assert.equal(managementWriteConfirmed('staff_library_prepare', data, clientId), true)
    assert.equal(managementWriteConfirmed('staff_library_publish', {}, clientId), false)
    assert.equal(managementWriteConfirmed('staff_library_enable', { enabled: false }, clientId, true), false)
  } finally { await server.close() }
})
