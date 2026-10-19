import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

// Actual encrypted token store, real Supabase SDK and Web Crypto. Only the
// service's Auth/PostgREST transport is replaced; all requests stay loopback.
test('OneDrive PKCE state is consumed once without erasing a newer attempt', async t => {
  const saved = { fetch: globalThis.fetch, Deno: globalThis.Deno }
  let row = null, failWrite = false, beforeWrite = null, reads = 0, writes = 0
  const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
  globalThis.Deno = { env: { get: name => ({ SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key', ONEDRIVE_TOKEN_ENC_KEY: key })[name] } }
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    assert.equal(url.origin, 'http://127.0.0.1:1')
    assert.equal(url.pathname, '/rest/v1/microsoft_oauth_tokens')
    const method = init.method ?? 'GET'
    if (method === 'POST') {
      row = { ...row, ...JSON.parse(init.body) }
      return new Response(null, { status: 201 })
    }
    if (method === 'PATCH') {
      writes++
      if (beforeWrite) { const hook = beforeWrite; beforeWrite = null; await hook() }
      if (failWrite) return Response.json({ message: 'synthetic private DB detail' }, { status: 500 })
    } else { assert.equal(method, 'GET'); reads++ }
    let matches = Boolean(row)
    for (const [column, filter] of url.searchParams) {
      if (filter.startsWith('eq.')) matches &&= String(row?.[column]) === filter.slice(3)
      if (filter.startsWith('gt.')) matches &&= String(row?.[column]) > filter.slice(3)
    }
    const result = matches ? { ...row } : null
    if (method === 'PATCH' && matches) Object.assign(row, JSON.parse(init.body))
    const object = new Headers(init.headers).get('accept')?.includes('application/vnd.pgrst.object+json')
    return Response.json(object ? result : result ? [result] : [])
  }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [{
    name: 'isolated-onedrive-token-store', enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/client-onboarding/onedrive-token-store.ts')) return code.replace('https://esm.sh/@supabase/supabase-js@2', '@supabase/supabase-js')
    },
  }] })
  try {
    const store = await server.ssrLoadModule('/supabase/functions/client-onboarding/onedrive-token-store.ts')
    const start = async (state = 'state-one', verifier = 'synthetic-pkce-verifier') => {
      row = null; failWrite = false; beforeWrite = null; reads = 0; writes = 0
      assert.equal(await store.savePendingAuth(state, verifier), true)
      assert.notEqual(row.pending_verifier_enc, verifier, 'Real AES-GCM encryption, not plaintext')
    }
    await t.test('one successful consumption; replay and wrong state fail closed', async () => {
      await start()
      assert.equal(await store.takePendingAuth('wrong-state'), null)
      assert.equal(writes, 0)
      assert.equal(await store.takePendingAuth('state-one'), 'synthetic-pkce-verifier')
      assert.equal(row.pending_state, null)
      assert.equal(await store.takePendingAuth('state-one'), null)
    })
    await t.test('failed persistence does not authorize a code exchange', async () => {
      await start(); failWrite = true
      assert.equal(await store.takePendingAuth('state-one'), null)
      assert.equal(row.pending_state, 'state-one')
    })
    await t.test('delayed callback preserves the newer pending sign-in', async () => {
      await start()
      beforeWrite = () => { row = { ...row, pending_state: 'newer-state', pending_verifier_enc: 'newer-encrypted-verifier' } }
      assert.equal(await store.takePendingAuth('state-one'), null)
      assert.equal(row.pending_state, 'newer-state')
      assert.equal(row.pending_verifier_enc, 'newer-encrypted-verifier')
    })
    await t.test('two callbacks have exactly one winner', async () => {
      await start()
      const results = await Promise.all([store.takePendingAuth('state-one'), store.takePendingAuth('state-one')])
      assert.equal(reads, 2)
      assert.equal(results.filter(v => v === 'synthetic-pkce-verifier').length, 1)
      assert.equal(results.filter(v => v === null).length, 1)
    })
    await t.test('invalid, missing and expired expiry values never authorize', async () => {
      for (const expiry of [null, '', 'not-a-date', new Date(Date.now() - 1000).toISOString()]) {
        await start(); row.pending_expires_at = expiry
        assert.equal(await store.takePendingAuth('state-one'), null)
        assert.equal(writes, 0)
      }
    })
    await t.test('ciphertext tampering does not clear pending state or authorize', async () => {
      await start(); row.pending_verifier_enc = 'not-a-ciphertext'
      assert.equal(await store.takePendingAuth('state-one'), null)
      assert.equal(writes, 0)
    })
    await t.test('pending state replaced only by expiry change is still protected', async () => {
      await start()
      const newerExpiry = new Date(Date.now() + 900_000).toISOString()
      beforeWrite = () => { row.pending_expires_at = newerExpiry }
      assert.equal(await store.takePendingAuth('state-one'), null)
      assert.equal(row.pending_expires_at, newerExpiry)
    })
    await t.test('another logical account cannot consume this pending state', async () => {
      await start()
      assert.equal(await store.takePendingAuth('state-one', 'other-account'), null)
      assert.equal(writes, 0)
      assert.equal(row.pending_state, 'state-one')
    })
  } finally {
    await server.close()
    globalThis.fetch = saved.fetch
    if (saved.Deno === undefined) delete globalThis.Deno
    else globalThis.Deno = saved.Deno
  }
})
