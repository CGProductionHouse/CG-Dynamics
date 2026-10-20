import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { resolve } from 'node:path'

// Actual Edge dispatcher + real Supabase SDK + actual management repository and
// client projections. Only external Auth/PostgREST/provider responses are doubles.
// No production credentials, SQL, existing browser sessions or network requests.
test('actual Brand Hub handler: admin preparation through client listing and range media', async t => {
  const saved = { fetch: globalThis.fetch, Deno: globalThis.Deno }
  const client = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', alice = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bob = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', staff = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const profiles = [{ id: admin, role: 'admin', client_id: null, is_active: true }, { id: alice, role: 'client', client_id: client, is_active: true }, { id: bob, role: 'client', client_id: other, is_active: true }, { id: staff, role: 'staff', client_id: null, is_active: true }]
  const db = { clients: [{ id: client, name: 'Exact Client', active: true, logo_url: null }, { id: other, name: 'Other Client', active: true, logo_url: null }], profiles,
    client_onedrive_mappings: [{ client_id: client, drive_id: 'synthetic-drive', client_folder_item_id: 'bound' }], client_portal_libraries: [], client_portal_library_categories: [], client_portal_assets: [], monthly_deliverables: [], client_onboarding_sessions: [] }
  const make = (id, name, parentId, folder = true, size = null, mimeType = null) => ({ id, name, parentId, isFolder: folder, size, mimeType, driveId: 'synthetic-drive' })
  const tree = { bound: [make('root', 'A_ClientPortal_Exact_Client', 'bound')], root: [make('brand', 'Brand Identity', 'root'), make('design', 'Graphic Design', 'root'), make('video', 'Video', 'root')], brand: [make('logo', 'Logo.png', 'brand', false, 100, 'image/png')], design: [], video: [make('film', 'Film.mp4', 'video', false, 50_000_000, 'video/mp4')] }
  let handler, transportFailure = false, failAssetUpdate = false, concurrentAssetChange = false, concurrentLibraryChange = false, failSetupRead = false
  const calls = [], streams = []
  globalThis.__brandHandlerFixture = { tree, streams }
  globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key-only' })[key] }, serve: fn => { handler = fn } }
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url), method = init.method ?? 'GET', headers = new Headers(init.headers)
    assert.equal(url.origin, 'http://127.0.0.1:1', 'All SDK transport is isolated loopback, never production')
    calls.push({ path: url.pathname, method })
    if (transportFailure) throw new Error('synthetic private transport detail')
    if (url.pathname === '/auth/v1/user') {
      const id = headers.get('authorization')?.replace(/^Bearer /, '')
      return id && profiles.some(p => p.id === id) ? Response.json({ id, app_metadata: {}, user_metadata: {} }) : Response.json({ message: 'invalid session' }, { status: 401 })
    }
    assert.ok(url.pathname.startsWith('/rest/v1/'))
    const table = url.pathname.slice('/rest/v1/'.length)
    if (table === 'client_onboarding_sessions' && failSetupRead) return Response.json({message:'synthetic private setup database failure',code:'XX000'}, {status:503})
    if (table === 'rpc/get_client_portal_library_summary') {
      const args = JSON.parse(init.body)
      const groups = new Map()
      for (const a of db.client_portal_assets.filter(a => a.library_id === args.p_library_id && a.client_id === args.p_client_id && a.active && a.published_at <= new Date().toISOString())) {
        const key = `${a.category_id}:${a.library_year}:${a.library_month}`, group = groups.get(key) ?? { category_id: a.category_id, library_year: a.library_year, library_month: a.library_month, file_count: 0 }
        group.file_count++; groups.set(key, group)
      }
      return Response.json([...groups.values()])
    }
    assert.ok(table in db, `Unexpected table ${table}`)
    if (method === 'PATCH' && table === 'client_portal_libraries' && concurrentLibraryChange) {
      concurrentLibraryChange = false
      db.client_portal_libraries[0].enabled = false
      db.client_portal_libraries[0].last_verified_at = '2026-10-01T00:00:00Z'
    }
    if (method === 'PATCH' && table === 'client_portal_assets' && concurrentAssetChange) {
      concurrentAssetChange = false
      const changed = db.client_portal_assets.find(a => a.item_id === 'logo')
      changed.active = true; changed.display_name = 'Newer staff decision'
    }
    let rows = db[table]
    for (const [key, filter] of url.searchParams) {
      if (filter.startsWith('eq.')) rows = rows.filter(r => String(r[key]) === filter.slice(3))
      else if (filter.startsWith('lte.')) rows = rows.filter(r => r[key] <= filter.slice(4))
      else if (filter.startsWith('is.')) rows = rows.filter(r => filter === 'is.null' && r[key] == null)
      else if (filter.startsWith('in.')) rows = rows.filter(r => filter.slice(4, -1).split(',').includes(String(r[key])))
    }
    if (method === 'POST') {
      const raw = JSON.parse(init.body), inserted = (Array.isArray(raw) ? raw : [raw]).map(r => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }))
      db[table].push(...inserted); rows = inserted
    } else if (method === 'PATCH') {
      if (table === 'client_portal_assets' && failAssetUpdate) { failAssetUpdate = false; rows = [] }
      const patch = JSON.parse(init.body)
      rows.forEach(r => Object.assign(r, patch))
    } else assert.equal(method, 'GET')
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000)
    rows = rows.slice(offset, offset + limit)
    const object = headers.get('accept')?.includes('application/vnd.pgrst.object+json')
    if (object && rows.length !== 1) return Response.json({ message: 'Cannot coerce result to object', code: 'PGRST116', details: '0 rows' }, { status: 406 })
    return Response.json(object ? rows[0] : rows)
  }
  const fixturePlugin = { name: 'isolated-edge-transport', enforce: 'pre',
    resolveId(id) { if (id === 'https://esm.sh/@supabase/supabase-js@2') return resolve('node_modules/@supabase/supabase-js/dist/index.mjs') },
    transform(_code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/client-onboarding/onedrive-adapter.ts') && _code.includes('https://esm.sh/@supabase/supabase-js@2')) return _code.replaceAll('https://esm.sh/@supabase/supabase-js@2', '@supabase/supabase-js')
      if (!id.replaceAll('\\', '/').endsWith('/client-onboarding/onedrive-adapter.ts')) return
      return `import {isAssetInsideCategory} from '/supabase/functions/client-onboarding/library-asset-boundary.ts';
      export const isUploadAdapterConfigured=()=>true;
      export const listLibraryEntries=async(drive,parent)=>globalThis.__brandHandlerFixture.tree[parent]??null;
      export const verifyLibraryAsset=async(driveId,itemId,categoryId,rootId,mime,size)=>isAssetInsideCategory(async id=>{const item=Object.values(globalThis.__brandHandlerFixture.tree).flat().find(e=>e.id===id);return item?{id:item.id,driveId:item.driveId,parentId:item.parentId,file:!item.isFolder,mime:item.mimeType,size:item.size}:null},{driveId,itemId,categoryId,rootId,mime,size});
      export async function streamDriveItem(drive,item,range){globalThis.__brandHandlerFixture.streams.push({drive,item,range});const size=item==='film'?50000000:100;const m=/^bytes=(\\d+)-(\\d+)$/.exec(range??'');const start=m?Number(m[1]):0,end=m?Number(m[2]):size-1;return {stream:new Response(new Uint8Array(end-start+1)).body,status:m?206:200,contentType:item==='film'?'video/mp4':'image/png',contentLength:String(end-start+1),contentRange:m?'bytes '+start+'-'+end+'/'+size:null,acceptRanges:'bytes',etag:'synthetic'};}
      export const streamDriveThumbnail=async()=>({stream:new Response('thumb').body,status:200,contentType:'image/jpeg',contentLength:'5',contentRange:null,acceptRanges:null,etag:null});
      export const createUploadSession=async()=>{throw Error('Unexpected upload')};export const downloadFile=async()=>{throw Error('Unexpected legacy download')};export const listChildren=listLibraryEntries;export const resolveClientsFolder=async()=>null;export const verifyDriveItem=async()=>null;`
    } }
  const server = await createServer({ configFile: false, plugins: [fixturePlugin], server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    await server.ssrLoadModule('/supabase/functions/client-onboarding/index.ts')
    assert.equal(typeof handler, 'function')
    const post = async (body, actor = admin) => {
      const response = await handler(new Request('http://127.0.0.1:1/functions/v1/client-onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor}` } : {}) }, body: JSON.stringify(body) }))
      return { status: response.status, body: await response.json() }
    }
    const manage = (action, fields = {}) => post({ action: `staff_library_${action}`, clientId: client, ...fields })
    await t.test('absent optional setup is successful empty context, not a library failure', async () => {
      const before = calls.length
      for (const [body, actor] of [[{action:'portal_load'},alice],[{action:'staff_preview_portal_load',clientId:client},admin]]) {
        const result = await post(body, actor)
        assert.equal(result.status,200)
        assert.deepEqual(result.body,{ok:true,data:null})
      }
      assert.ok(calls.slice(before).every(call=>call.method==='GET'),'Optional setup reads never create or publish onboarding data')
      assert.equal((await post({action:'portal_load',clientId:client},bob)).status,403)
      assert.equal((await post({action:'staff_preview_portal_load',clientId:client},staff)).status,403)
    })
    await t.test('failed optional setup read remains an explicit sanitized failure', async () => {
      failSetupRead = true
      try {
        const result = await post({action:'portal_load'},alice)
        assert.equal(result.status,503)
        assert.equal(result.body.ok,false)
        assert.doesNotMatch(JSON.stringify(result.body),/synthetic private|XX000/)
      } finally { failSetupRead = false }
    })
    await t.test('real dispatcher rejects anonymous, client, inactive and staff management', async () => {
      for (const [actor, status] of [[null, 401], [alice, 403], [staff, 403]]) assert.equal((await post({ action: 'staff_library_prepare', clientId: client }, actor)).status, status)
      profiles[0].is_active = false
      assert.equal((await manage('prepare')).status, 401); profiles[0].is_active = true
      assert.equal(db.client_portal_libraries.length, 0)
    })
    await t.test('actual repository stages exact rows and private file before separate enable', async () => {
      assert.equal((await manage('prepare')).status, 200)
      assert.equal(db.client_portal_libraries[0].enabled, false)
      assert.equal(db.client_portal_library_categories.length, 3)
      assert.equal((await manage('publish', { category: 'brand_identity', itemId: 'logo', displayName: 'Client logo', confirmed: true })).status, 200)
      assert.equal(db.client_portal_assets[0].published_by, admin)
      assert.equal((await post({ action: 'portal_library_load' }, alice)).body.data.available, false)
      assert.equal((await manage('enable', { enabled: true, confirmed: true })).status, 200)
    })
    await t.test('client and preview projections expose no provider identity or internal fields', async () => {
      const clientRead = await post({ action: 'portal_library_load' }, alice)
      assert.equal(clientRead.body.data.available, true)
      assert.equal(clientRead.body.data.categories.find(c => c.category === 'brand_identity').fileCount, 1)
      const files = await post({ action: 'portal_library_month', category: 'brand_identity' }, alice)
      assert.equal(files.body.data.assets.length, 1)
      assert.equal(files.body.data.assets[0].displayName, 'Client logo')
      assert.doesNotMatch(JSON.stringify([clientRead.body, files.body]), /synthetic-drive|parent_folder|root_folder|published_by|item_id/)
      assert.deepEqual((await post({ action: 'staff_preview_portal_library_load', clientId: client })).body, clientRead.body)
      assert.equal((await post({ action: 'portal_library_load', clientId: client }, bob)).status, 403)
      assert.equal((await post({ action: 'staff_preview_portal_library_load', clientId: client }, staff)).status, 403)
    })
    await t.test('real signed range path refuses another client, tamper, moves and hiding', async () => {
      const period = await server.ssrLoadModule('/supabase/functions/_shared/portal-visibility.ts')
      const { year, month } = period.visiblePortalMonths()[0]
      assert.equal((await manage('publish', { category: 'video', itemId: 'film', displayName: 'Client film', confirmed: true, year, month })).status, 200)
      const film = db.client_portal_assets.find(a => a.item_id === 'film')
      const access = await post({ action: 'portal_library_access', assetId: film.id, purpose: 'stream' }, alice)
      assert.equal(access.status, 200)
      const link = access.body.data.url
      assert.doesNotMatch(link, /synthetic-drive|film|synthetic-server-key/)
      assert.equal((await post({ action: 'portal_library_access', assetId: film.id, purpose: 'stream' }, bob)).status, 404)
      let result = await handler(new Request(link, { headers: { Range: 'bytes=0-9' } }))
      assert.equal(result.status, 206); assert.equal(result.headers.get('Content-Range'), 'bytes 0-9/50000000'); assert.equal((await result.arrayBuffer()).byteLength, 10)
      assert.equal(streams.at(-1).range, 'bytes=0-9')
      result = await handler(new Request(link.replace('purpose=stream', 'purpose=download'))); assert.equal(result.status, 403)
      result = await handler(new Request(link, { headers: { Range: 'bytes=50000000-' } })); assert.equal(result.status, 416)
      tree.video[0].parentId = 'private'; assert.equal((await handler(new Request(link))).status, 404); tree.video[0].parentId = 'video'
      await manage('hide', { assetId: film.id }); assert.equal((await handler(new Request(link))).status, 404)
    })
    await t.test('malformed request bodies are contained, not unhandled exceptions', async () => {
      for (const body of [null, [], 'not an object', 5]) assert.equal((await post(body)).status, 400)
    })
    await t.test('republishing cannot overwrite a newer concurrent staff decision', async () => {
      const logo = db.client_portal_assets.find(a => a.item_id === 'logo')
      await manage('hide', { assetId: logo.id })
      assert.equal(logo.active, false)
      concurrentAssetChange = true
      const result = await manage('publish', { category: 'brand_identity', itemId: 'logo', displayName: 'Older selection', confirmed: true })
      assert.equal(result.status, 503)
      assert.equal(logo.display_name, 'Newer staff decision')
      assert.equal(logo.active, true)
    })
    await t.test('an enable request cannot overwrite a concurrent library hide/review', async () => {
      await manage('enable', { enabled: false })
      concurrentLibraryChange = true
      assert.equal((await manage('enable', { enabled: true, confirmed: true })).status, 503)
      assert.equal(db.client_portal_libraries[0].enabled, false)
      assert.equal(db.client_portal_libraries[0].last_verified_at, '2026-10-01T00:00:00Z')
    })
    await t.test('transport and zero-row writes are not reported successful', async () => {
      const logo = db.client_portal_assets.find(a => a.item_id === 'logo')
      failAssetUpdate = true; assert.equal((await manage('hide', { assetId: logo.id })).status, 503); assert.equal(logo.active, true)
      transportFailure = true; assert.equal((await manage('review')).status, 401); transportFailure = false
    })
  } finally {
    globalThis.fetch = saved.fetch
    if (saved.Deno === undefined) delete globalThis.Deno; else globalThis.Deno = saved.Deno
    delete globalThis.__brandHandlerFixture
    await server.close()
  }
})
