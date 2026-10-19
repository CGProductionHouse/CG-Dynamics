import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('actual OneDrive management adapter paginates safely and checks exact live ancestry', async () => {
  const previousFetch = globalThis.fetch, previousDeno = globalThis.Deno
  globalThis.Deno = { env: { get: name => ['ONEDRIVE_MS_CLIENT_ID', 'ONEDRIVE_MS_CLIENT_SECRET'].includes(name) ? 'synthetic-only' : undefined } }
  const plugin = { name: 'synthetic-delegated-store', enforce: 'pre', transform(_code, id) {
    if (id.replaceAll('\\', '/').endsWith('/client-onboarding/onedrive-token-store.ts')) return `export const ONEDRIVE_ACCOUNT_KEY='fixture';export function isTokenStoreConfigured(){return true};export async function getStoredTokens(){return {refreshToken:'synthetic-refresh',accessToken:'synthetic-access',accessTokenExpiresAt:Date.now()+3600000}};export async function saveTokens(){throw Error('Read test must not rotate tokens')}`
  } }
  const server = await createServer({ configFile: false, plugins: [plugin], server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { listLibraryEntries, verifyLibraryAsset } = await server.ssrLoadModule('/supabase/functions/client-onboarding/onedrive-adapter.ts')
    let mode = 'pages', requests = []
    const item = (id, parent, folder = false) => ({ id, name: `${id}.png`, ...(folder ? { folder: {} } : { file: { mimeType: 'image/png' }, size: 100 }), parentReference: { id: parent, driveId: 'drive' }, webUrl: 'https://onedrive.live.com/?id=synthetic' })
    globalThis.fetch = async (url, init) => {
      requests.push(String(url)); assert.equal(init.headers.Authorization, 'Bearer synthetic-access')
      assert.ok(String(url).startsWith('https://graph.microsoft.com/v1.0/'))
      if (mode === 'ancestry') {
        const id = decodeURIComponent(new URL(url).pathname.split('/').at(-1))
        return Response.json(id === 'category' ? item('category', 'root', true) : item('asset', 'category'))
      }
      if (mode === 'failure') return new Response('', { status: 503 })
      if (mode === 'wrong-parent') return Response.json({ value: [item('a', 'outside')] })
      if (mode === 'duplicate') return Response.json({ value: [item('a', 'category'), item('a', 'category')] })
      if (mode === 'untrusted-page') return Response.json({ value: [item('a', 'category')], '@odata.nextLink': 'https://evil.example/steal' })
      if (mode === 'cycle') return Response.json({ value: [item('a', 'category')], '@odata.nextLink': String(url) })
      return Response.json(String(url).endsWith('page=2') ? { value: [item('b', 'category')] } : { value: [item('a', 'category')], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/drive-page?page=2' })
    }
    const entries = await listLibraryEntries('drive', 'category')
    assert.deepEqual(entries.map(e => e.id), ['a', 'b']); assert.equal(requests.length, 2)
    assert.equal(entries[0].reviewUrl, 'https://onedrive.live.com/?id=synthetic')
    assert.equal('webUrl' in entries[0], false)
    for (mode of ['failure', 'wrong-parent', 'duplicate', 'untrusted-page', 'cycle']) {
      requests = []; assert.equal(await listLibraryEntries('drive', 'category'), null, mode)
      assert.ok(requests.every(url => !url.startsWith('https://evil.')))
    }
    mode = 'ancestry'
    assert.equal(await verifyLibraryAsset('drive', 'asset', 'category', 'root', 'image/png', 100), true)
    assert.equal(await verifyLibraryAsset('drive', 'asset', 'category', 'wrong-root', 'image/png', 100), false)
    assert.equal(await verifyLibraryAsset('drive', 'asset', 'category', 'root', 'image/png', 200), false)
  } finally {
    globalThis.fetch = previousFetch
    if (previousDeno === undefined) delete globalThis.Deno; else globalThis.Deno = previousDeno
    await server.close()
  }
})
