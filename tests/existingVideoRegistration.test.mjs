import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, rules
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  rules = await server.ssrLoadModule('/src/lib/existingVideoRegistration.ts')
})
after(async () => { await server?.close() })

const input = {
  clientId: '11111111-1111-4111-8111-111111111111', clientName: 'Practice company', month: '2026-12',
  title: 'A year together', identity: '2026_12_PRACTICE_VIDEO_01_A_YEAR_TOGETHER',
  filename: '2026_12_PRACTICE_VIDEO_01_A_YEAR_TOGETHER_R16_REVIEW.mp4',
  sha256: 'a'.repeat(64), revision: 'R16', editorName: 'Nolan MSI',
  mediaUrl: 'https://example.com/private-film', evidenceUrl: 'https://example.com/handoff',
  evidence: 'Owner confirmed this exact revision on 9 November. Private approval receipt retained; not publicly posted.',
  evidenceKind: 'owner_approval',
}

function repository(initial = []) {
  let rows = [...initial], writes = 0, gets = 0
  return {
    get rows() { return rows }, get writes() { return writes }, get gets() { return gets },
    listClient: async clientId => ({ data: rows.filter(row => row.client_id === clientId), error: null }),
    insert: async row => { writes++; rows = [...rows, { ...row, updated_at: '2026-11-11T12:00:00Z' }]; return { data: rows.at(-1), error: null } },
    get: async id => { gets++; return { data: rows.find(row => row.id === id) ?? null, error: null } },
  }
}

test('historical registration preserves owner vs client approval and invents no run/slot/date', async () => {
  const repo = repository()
  const result = await rules.registerExistingVideoWith(input, 'signed-in-actor', repo)
  assert.equal(result.error, null)
  assert.equal(repo.writes, 1); assert.equal(repo.gets, 1)
  assert.equal(result.data.production_status, 'ready_for_client')
  assert.equal(result.data.content_guideline_id, null)
  assert.equal(result.data.deliverable_id, null)
  assert.equal(result.data.proposed_post_date, null)
  assert.equal(result.data.client_published_at, undefined)
  assert.equal(result.data.onedrive_client_approval_url, null)
  assert.equal(result.data.editor_name, 'Nolan MSI')
  assert.equal(result.data.folder_client_code, 'PRACTICE')
  assert.equal(result.data.video_number, 1)
  assert.equal(result.data.created_by, 'signed-in-actor')
  assert.match(result.data.notes, /not a new assignment/)
})

test('retry/new revision opens matching history without changing its approved status', async () => {
  const repo = repository()
  const first = await rules.registerExistingVideoWith(input, 'actor', repo)
  first.data.production_status = 'client_approved'
  const second = await rules.registerExistingVideoWith({ ...input, sha256: 'b'.repeat(64), revision: 'R17' }, 'actor', repo)
  assert.equal(repo.writes, 1)
  assert.equal(second.data, null)
  assert.equal(second.matches[0].id, first.data.id)
  assert.equal(first.data.production_status, 'client_approved')
})

test('same stable identity is deterministic across devices and independent of revision bytes', async () => {
  assert.equal(await rules.existingVideoId(input.clientId, input.identity), await rules.existingVideoId(input.clientId.toUpperCase(), input.identity))
  assert.notEqual(await rules.existingVideoId(input.clientId, input.identity), await rules.existingVideoId('22222222-2222-4222-8222-222222222222', input.identity))
})

test('legacy title and archived hash matches block creation; sibling clients stay isolated', async () => {
  const legacy = { id: 'legacy', client_id: input.clientId, month: '2026-12-01', title: input.title, canonical_name: null, notes: '', status: 'archived' }
  const repo = repository([legacy])
  const result = await rules.registerExistingVideoWith(input, 'actor', repo)
  assert.equal(repo.writes, 0); assert.equal(result.matches[0].id, 'legacy')
  assert.equal(rules.existingVideoMatches(input, [{ ...legacy, client_id: 'other' }], 'id').length, 0)
  assert.equal(rules.existingVideoMatches(input, [{ ...legacy, title: 'Different', month: null, notes: input.sha256 }], 'id').length, 1)
})

test('partial/error duplicate scan fails closed without writing', async () => {
  const repo = repository()
  repo.listClient = async () => ({ data: [], error: 'Page two failed' })
  const result = await rules.registerExistingVideoWith(input, 'actor', repo)
  assert.equal(result.error, 'Page two failed'); assert.equal(repo.writes, 0)
})

test('concurrent/timeout insert reads the winner without upsert or blind retry', async () => {
  const repo = repository()
  const insert = repo.insert
  repo.insert = async row => { await insert(row); return { data: null, error: 'Timed out after acceptance' } }
  const result = await rules.registerExistingVideoWith(input, 'actor', repo)
  assert.equal(repo.writes, 1); assert.equal(result.data, null)
  assert.equal(result.matches.length, 1); assert.match(result.error, /already exists/)
})

test('readback mismatch is not a successful registration', async () => {
  const repo = repository()
  repo.get = async () => ({ data: { ...repo.rows[0], notes: 'concurrently changed' }, error: null })
  const result = await rules.registerExistingVideoWith(input, 'actor', repo)
  assert.equal(result.data, null); assert.match(result.error, /readback could not verify/)
})

test('invalid inputs cannot create arbitrary state, local links or fabricated month identity', async () => {
  for (const patch of [
    { clientId: 'guess' }, { month: '2026-13' }, { identity: input.identity + '_R16' },
    { month: '2026-11' }, { filename: 'different.mp4' }, { sha256: 'short' },
    { mediaUrl: 'file:///C:/private.mp4' }, { evidenceUrl: 'javascript:alert(1)' },
    { evidence: 'approved' }, { editorName: '' }, { evidenceKind: 'posted' },
  ]) {
    const repo = repository()
    const result = await rules.registerExistingVideoWith({ ...input, ...patch }, 'actor', repo)
    assert.ok(result.error, JSON.stringify(patch)); assert.equal(repo.writes, 0)
  }
})

test('editor preservation handles name-only/inactive owners; clear/reassign are explicit', () => {
  assert.deepEqual(rules.selectedEditorPatch('__keep__', []), {})
  assert.deepEqual(rules.selectedEditorPatch('', []), { editor_user_id: null, editor_name: null })
  assert.deepEqual(rules.selectedEditorPatch('active', [{ id: 'active', full_name: 'Sydney' }]), { editor_user_id: 'active', editor_name: 'Sydney' })
  assert.throws(() => rules.selectedEditorPatch('missing', []), /listed editor/)
})

test('only explicit client evidence maps to client delivery/approval; private work stays editing', async () => {
  for (const [evidenceKind, expected] of [['private_edit', 'editing'], ['internal_delivery', 'internal_review'], ['client_delivery', 'sent_to_client'], ['client_approval', 'client_approved']]) {
    const repo = repository()
    const result = await rules.registerExistingVideoWith({ ...input, evidenceKind }, 'actor', repo)
    assert.equal(result.data.production_status, expected)
    assert.equal(result.data.onedrive_client_approval_url, evidenceKind.startsWith('client_') ? input.evidenceUrl : null)
  }
})

test('name-only editors can be filtered without conflating staff identity or unassigned work', () => {
  assert.equal(rules.matchesVideoEditor('name:Nolan MSI', { editor_user_id: null, editor_name: 'Nolan MSI' }), true)
  assert.equal(rules.matchesVideoEditor('name:Nolan MSI', { editor_user_id: 'staff', editor_name: 'Nolan MSI' }), false)
  assert.equal(rules.matchesVideoEditor('name:Nolan MSI', { editor_user_id: null, editor_name: 'Nolan Studio PC' }), false)
  assert.equal(rules.matchesVideoEditor('staff', { editor_user_id: 'staff', editor_name: 'Nolan MSI' }), true)
})

test('unrelated edits preserve actual old names/codes and do not invent missing names', () => {
  const old = { title: 'Christmas / one click away', folder_client_code: null, video_number: null, canonical_name: '2026_12_WATCH_ADDICT_VIDEO_01_ONE_CLICK_AWAY' }
  const unchanged = { title: old.title, folder_client_code: '', video_number: '' }
  assert.equal(rules.canonicalForVideoEdit(old, unchanged, 'WRONG_DERIVED_NAME', null), old.canonical_name)
  assert.equal(rules.canonicalForVideoEdit({ ...old, canonical_name: null }, unchanged, 'WRONG_DERIVED_NAME', null), null)
  assert.equal(rules.canonicalForVideoEdit(old, { ...unchanged, title: 'Explicit new title' }, 'NEW_NAME', null), 'NEW_NAME')
})

test('production form uses saved row revision; adapter uses existing table and complete client history', () => {
  const page = readFileSync('src/pages/admin/VideoPipelineTab.tsx', 'utf8')
  const adapter = readFileSync('src/lib/contentWorkflow.ts', 'utf8')
  assert.match(page, /updateGuideIdea\(selected.id, patch, selected.updated_at\)/)
  assert.match(page, /\['admin', 'manager'\]\.includes/)
  assert.match(page, /Keep current:/)
  assert.match(adapter, /fetchAllPages<ContentGuideIdea>/)
  assert.match(adapter, /\.eq\('client_id', clientId\)/)
  assert.doesNotMatch(adapter.slice(adapter.indexOf('export async function registerExistingVideo'), adapter.indexOf('export interface DeliverableLabel')), /\.upsert\(|monthly_deliverables|content_runs/)
})
