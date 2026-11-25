import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { assertToolAllowedInContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { CG_DYNAMICS_MCP_TOOLS } from '../supabase/functions/cg-dynamics-mcp/toolCatalog.ts'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

let server, register
before(async () => {
  server = await createServer({ logLevel: 'error', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  register = (await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/existingVideoTracking.ts')).registerExistingInternalVideo
})
after(async () => server?.close())

const CLIENT = '11111111-1111-4111-8111-111111111111', FOREIGN = '22222222-2222-4222-8222-222222222222'
const input = { client_id: CLIENT, month: '2026-12', title: 'The lights you never see', identity: '2026_12_PRACTICE_VIDEO_1',
  filename: '2026_12_PRACTICE_VIDEO_1.mp4', sha256: 'a'.repeat(64), revision: 'R02', editor_name: 'Actual Studio editor',
  source_device: 'STUDIO-PC', source_path: 'D:\\Review\\2026_12_PRACTICE_VIDEO_1.mp4',
  evidence_url: 'https://example.test/private-project', evidence_kind: 'internal_delivery',
  evidence: 'Exact R02 sent to internal review on 19 November; matching file hash verified. No client approval or public posting.', idempotency_key: 'film-r02' }

function fixture({ inactive = false, clientError = false, pageError = false, rows = [] } = {}) {
  const saved = [...rows], writes = [], reads = [], receipts = new Map()
  const db = {
    async rpc(name, args) {
      assert.equal(name, 'mcp_check_idempotency')
      const row = receipts.get(args.p_idempotency_key)
      return { data: [{ already_executed: !!row, existing_result: row ? row.input_hash === args.p_input_hash ? row.result_payload : { status: 'conflict' } : null }], error: null }
    },
    from(table) {
      if (table === 'mcp_idempotency_log') return { async insert(row) { receipts.set(row.idempotency_key, row); return { error: null } } }
      assert.ok(['clients', 'content_guide_ideas'].includes(table))
      const filters = []; let pending
      const matches = row => filters.every(([k, v]) => row[k] === v)
      return {
        select() { return this }, eq(k, v) { filters.push([k, v]); return this }, order() { return this },
        insert(row) { pending = row; return this },
        async range(from, to) { reads.push({ table, filters: [...filters], from, to }); return { data: saved.filter(matches).slice(from, to + 1), error: pageError && from >= 1000 ? { message: 'second page unavailable' } : null } },
        async maybeSingle() {
          reads.push({ table, filters: [...filters] })
          return table === 'clients' ? { data: inactive ? null : { id: CLIENT, name: 'Practice', active: true }, error: clientError ? { message: 'offline' } : null }
            : { data: saved.find(matches) ?? null, error: null }
        },
        async single() {
          assert.equal(table, 'content_guide_ideas'); assert.ok(pending)
          writes.push(pending); const row = { ...pending, updated_at: '2026-11-24T10:00:00Z' }; saved.push(row)
          return { data: row, error: null }
        },
      }
    },
  }
  return { db, saved, writes, reads, actor: { profileId: '33333333-3333-4333-8333-333333333333', contextKind: 'company_admin', connection: { role: 'admin' }, supabase: db } }
}

test('catalog/context and handler require actual company admin; no client Project or staff elevation', async () => {
  const tool = CG_DYNAMICS_MCP_TOOLS.find(x => x.name === 'register_existing_internal_video')
  assert.equal(tool.annotations.readOnlyHint, false); assert.ok(tool.inputSchema.required.includes('context'))
  for (const contextKind of ['staff', 'client']) {
    assert.equal(assertToolAllowedInContext(tool.name, contextKind).allowed, false)
    const f = fixture(); assert.equal((await register({ ...f.actor, contextKind }, input)).error, 'COMPANY_ADMIN_REQUIRED'); assert.equal(f.reads.length, 0)
  }
  const f = fixture(); assert.equal((await register({ ...f.actor, connection: { role: 'staff' } }, input)).error, 'COMPANY_ADMIN_REQUIRED')
})

test('real handler reuses canonical registration, exact-client reads and supported internal state', async () => {
  const f = fixture(); const result = await register(f.actor, input)
  assert.ok(result.id); assert.equal(f.writes.length, 1)
  assert.equal(result.production_status, 'internal_review'); assert.equal(result.media_filing, 'pending')
  assert.equal(f.saved[0].client_name, 'Practice'); assert.equal(f.saved[0].created_by, f.actor.profileId)
  assert.equal(f.saved[0].content_guideline_id, null); assert.equal(f.saved[0].deliverable_id, null)
  assert.equal(f.saved[0].onedrive_internal_review_url, null)
  assert.ok(f.reads.filter(x => x.table === 'content_guide_ideas').every(x => x.filters.some(([k, v]) => k === 'client_id' && v === CLIENT)))
})

test('inactive/unreadable clients, unsupported writes and approval claims fail closed', async () => {
  for (const config of [{ inactive: true }, { clientError: true }]) { const f = fixture(config); assert.ok((await register(f.actor, input)).error); assert.equal(f.writes.length, 0) }
  for (const patch of [{ client_name: 'Spoofed' }, { content_guideline_id: 'foreign' }, { status: 'approved' }, { evidence_kind: 'owner_approval' }, { client_id: 'guessed' }]) {
    const f = fixture(); assert.ok((await register(f.actor, { ...input, ...patch })).error); assert.equal(f.writes.length, 0)
  }
})

test('complete duplicate scan reaches row1001 including archived films and refuses partial reads', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), client_id: CLIENT, title: String(i), month: '2026-11-01', canonical_name: null, status: 'archived', notes: '' }))
  const duplicate = { id: 'held', client_id: CLIENT, title: input.title, month: '2026-12-01', canonical_name: input.identity, status: 'archived', notes: '' }
  for (const pageError of [false, true]) {
    const f = fixture({ rows: [...rows, duplicate], pageError })
    const result = await register(f.actor, input)
    assert.ok(result.error); assert.equal(f.writes.length, 0)
    assert.ok(f.reads.some(x => x.from === 1000))
  }
  const foreign = fixture({ rows: [{ ...duplicate, client_id: FOREIGN }] })
  assert.ok((await register(foreign.actor, input)).id); assert.equal(foreign.writes.length, 1)
})

test('actual dispatcher retries return original saved ID; changed payload conflicts without another insert', async () => {
  const f = fixture()
  const dispatch = actualOperationalDispatcher(f.actor, { register_existing_internal_video: register })
  const call = patch => dispatch({ context: { context_kind: 'company_admin' }, ...input, ...patch }, 'register_existing_internal_video')
  const first = await call({}), repeat = await call({}), conflict = await call({ title: 'Changed payload' })
  assert.equal(first.error, undefined, JSON.stringify(first))
  assert.equal(first.result.isError, false); assert.equal(repeat.result.isError, false)
  assert.equal(JSON.parse(first.result.content[0].text).id, JSON.parse(repeat.result.content[0].text).id)
  assert.equal(conflict.result.isError, true); assert.equal(f.writes.length, 1)
  assert.match(readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8'), /register_existing_internal_video: registerExistingInternalVideo/)
})
