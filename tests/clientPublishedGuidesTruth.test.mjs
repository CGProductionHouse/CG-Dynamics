import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const clientId = '11111111-1111-4111-8111-111111111111'
const video = { position: 1, title: 'Delivery', script: 'Actual complete script', objective: null, hook: null, shot_breakdown: null, cta: null, visual_notes: null, platform: null, format: null }
const guide = { row_key: 'published-guide', title: 'October guide', month: '2026-10-01', run_name: 'Delivery shoot', filming_date: null, published_at: '2026-10-01T10:00:00Z', videos: [video] }

test('published guideline read fails closed for malformed envelopes and preserves a verified empty result', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { fetchPublishedGuides } = await server.ssrLoadModule('/src/lib/clientContentGuides.ts')
    const original = supabase.rpc
    let data = null
    supabase.rpc = async () => ({ data, error: null })
    try {
      for (const invalid of [null, undefined, {}, '[]', [null], [guide, {}], [{ ...guide, videos: {} }], [{ ...guide, videos: [null] }]]) {
        data = invalid
        const result = await fetchPublishedGuides(clientId, '2026-10')
        assert.equal(result.data, null)
        assert.ok(result.error, `invalid response must be unavailable: ${JSON.stringify(invalid)}`)
      }
      data = []
      assert.deepEqual(await fetchPublishedGuides(clientId, '2026-10'), { data: [], error: null })
      data = [{ ...guide, videos: [] }]
      assert.deepEqual((await fetchPublishedGuides(clientId, '2026-10')).data[0].videos, [])
      data = [{ ...guide, videos: [{ ...video, script: null }] }]
      assert.equal((await fetchPublishedGuides(clientId, '2026-10')).data[0].videos[0].script, null)
    } finally { supabase.rpc = original }
  } finally { await server.close() }
})

test('published guideline projection retains full ordered scripts but no extra internal fields', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { fetchPublishedGuides } = await server.ssrLoadModule('/src/lib/clientContentGuides.ts')
    const original = supabase.rpc
    const calls = []
    const row = { ...guide, internal_notes: 'PRIVATE', drive_item_id: 'PRIVATE', videos: [{ ...video, editor_user_id: 'PRIVATE' }, { ...video, position: 2, title: 'Second', script: 'Full second script\nUnchanged' }] }
    const before = JSON.stringify(row)
    supabase.rpc = async (...args) => { calls.push(args); return { data: [row], error: null } }
    try {
      const result = await fetchPublishedGuides(clientId, '2026-10')
      assert.equal(result.error, null)
      assert.deepEqual(result.data[0].videos.map(item => item.script), ['Actual complete script', 'Full second script\nUnchanged'])
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE|internal_notes|drive_item_id|editor_user_id/)
      assert.equal(JSON.stringify(row), before)
      assert.deepEqual(calls, [['client_portal_published_content_guidelines', { p_client_id: clientId, p_month: '2026-10-01' }]])
    } finally { supabase.rpc = original }
  } finally { await server.close() }
})

test('guideline scope, publication and video contract failures stay unavailable, including rejected transport', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { fetchPublishedGuides } = await server.ssrLoadModule('/src/lib/clientContentGuides.ts')
    const original = supabase.rpc
    let row = guide
    let calls = 0
    supabase.rpc = async () => { calls++; return { data: [row], error: null } }
    try {
      for (const invalid of [
        { ...guide, month: '2026-09-01' }, { ...guide, published_at: null }, { ...guide, published_at: 'invalid' },
        { ...guide, title: {} }, { ...guide, videos: [{ ...video, script: {} }] },
        { ...guide, videos: [{ ...video, position: -1 }] }, { ...guide, videos: [{ ...video, position: 1.5 }] },
      ]) {
        row = invalid
        const result = await fetchPublishedGuides(clientId, '2026-10')
        assert.equal(result.data, null)
        assert.ok(result.error)
      }
      const prior = calls
      for (const [id, month] of [['', '2026-10'], ['not-a-uuid', '2026-10'], [clientId, '2026-13'], [clientId, '2026-10-01']]) {
        assert.ok((await fetchPublishedGuides(id, month)).error)
      }
      assert.equal(calls, prior, 'invalid scope never invokes RPC')
      supabase.rpc = async () => ({ data: [guide], error: { message: 'RLS failure' } })
      assert.equal((await fetchPublishedGuides(clientId, '2026-10')).data, null)
      supabase.rpc = async () => { throw new Error('Transport unavailable') }
      const rejected = await fetchPublishedGuides(clientId, '2026-10')
      assert.equal(rejected.data, null)
      assert.ok(rejected.error)
    } finally { supabase.rpc = original }
  } finally { await server.close() }
})
