import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'
import { assertRecordClientMatchesContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { buildGuidelineNavigation, validateNewVideo, validateVideoPatch } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'

const CLIENT = '11111111-1111-4111-8111-111111111111'
const FOREIGN = '22222222-2222-4222-8222-222222222222'
const RUN = '33333333-3333-4333-8333-333333333333'
const GUIDE = '44444444-4444-4444-8444-444444444444'
const ACTOR = '55555555-5555-4555-8555-555555555555'
const VIDEO = '66666666-6666-4666-8666-666666666666'
const source = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
const start = source.indexOf('const handleAddContentGuidelineVideo:')
const end = source.indexOf('const handleReorderContentGuidelineVideos:', start)
assert.ok(start >= 0 && end > start)
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function fixture({ videoClient = CLIENT } = {}) {
  const videos = [{ id: VIDEO, client_id: videoClient, content_guideline_id: GUIDE,
    title: 'Existing exact script', script: 'Preserve staff wording', position: 1, status: 'idea', month: null }]
  const receipts = new Map(), writes = [], reads = []
  const db = {
    async rpc(name, args) {
      assert.equal(name, 'mcp_check_idempotency')
      const row = receipts.get(args.p_idempotency_key)
      return { data: [{ already_executed: !!row, existing_result: row
        ? row.input_hash === args.p_input_hash ? row.result_payload : { status: 'conflict' } : null }], error: null }
    },
    from(table) {
      if (table === 'mcp_idempotency_log') return { async insert(row) {
        assert.equal(receipts.has(row.idempotency_key), false)
        receipts.set(row.idempotency_key, row)
        return { error: null }
      } }
      assert.equal(table, 'content_guide_ideas')
      const filters = []
      let operation = 'read', fields = null
      return {
        select() { return this }, eq(key, value) { filters.push([key, value]); return this },
        insert(value) { operation = 'insert'; fields = value; return this },
        update(value) { operation = 'update'; fields = value; return this },
        async maybeSingle() {
          reads.push(filters)
          return { data: videos.find(row => filters.every(([k, v]) => row[k] === v)) ?? null, error: null }
        },
        async single() {
          writes.push({ operation, fields, filters })
          if (operation === 'insert') {
            const row = { id: '77777777-7777-4777-8777-777777777777', ...fields }
            videos.push(row)
            return { data: row, error: null }
          }
          assert.equal(operation, 'update')
          const row = videos.find(row => filters.every(([k, v]) => row[k] === v))
          assert.ok(row)
          Object.assign(row, fields)
          return { data: row, error: null }
        },
      }
    },
  }
  const loadRunGuideline = async (staff, runId) => {
    assert.equal(runId, RUN)
    const scope = assertRecordClientMatchesContext(staff.contextKind, staff.effectiveClientId, CLIENT, 'content run')
    if (!scope.allowed) return { error: scope.error }
    return { scope: { clientId: CLIENT, clientName: 'Exact client', runId: RUN },
      guideline: { id: GUIDE }, videos: videos.filter(row => row.client_id === CLIENT) }
  }
  // Compile the real add/update handlers and real video ownership resolver; only
  // the already-tested run loader and database transport are injected.
  const handlers = new Function('loadRunGuideline', 'validateNewVideo', 'validateVideoPatch',
    'buildGuidelineNavigation', 'assertRecordClientMatchesContext', 'GUIDELINE_VIDEO_SELECT',
    `${js}; return { add_content_guideline_video: handleAddContentGuidelineVideo,
      update_content_guideline_video: handleUpdateContentGuidelineVideo }`)(loadRunGuideline,
    validateNewVideo, validateVideoPatch, buildGuidelineNavigation, assertRecordClientMatchesContext, '*')
  const connection = { userId: ACTOR, profileId: ACTOR, fullName: 'Verified staff', role: 'admin' }
  const dispatch = actualOperationalDispatcher({ supabase: db, contextKind: 'client', effectiveClientId: CLIENT,
    effectiveStaffProfileId: null, profileId: ACTOR, role: 'admin', connection }, handlers)
  return { dispatch, videos, writes, reads, receipts, handlers, db }
}
const context = { context_kind: 'client', client_id: CLIENT }
const payload = response => JSON.parse(response.result.content[0].text)

test('client Project appends one real draft despite the dispatcher injecting its exact routing client', async () => {
  const f = fixture(), input = { context, content_run_id: RUN, title: 'New authored script', idempotency_key: 'add-exact' }
  const first = await f.dispatch(input, 'add_content_guideline_video')
  assert.equal(first.result?.isError, false, JSON.stringify(first))
  const result = payload(first)
  assert.equal(result.position, 2)
  assert.equal(f.writes[0].fields.client_id, CLIENT)
  assert.equal(f.writes[0].fields.created_by, ACTOR)
  assert.equal(f.writes[0].fields.content_guideline_id, GUIDE)
  assert.equal(f.writes[0].fields.status, 'idea')
  assert.equal(f.writes[0].fields.month, undefined, 'No guessed coverage month')
  assert.equal(f.videos[0].script, 'Preserve staff wording')
  assert.deepEqual(await f.dispatch(input, 'add_content_guideline_video'), first)
  assert.equal(f.writes.length, 1, 'Lost responses cannot append a second video')
})

test('client Project edits exact script fields, preserves staff content and retries the original receipt', async () => {
  const f = fixture(), input = { context, content_guide_idea_id: VIDEO, script: 'Exact final script\n\nNext shot.',
    visual_notes: 'Keep actual client direction', idempotency_key: 'edit-exact' }
  const first = await f.dispatch(input, 'update_content_guideline_video')
  assert.equal(first.result?.isError, false, JSON.stringify(first))
  assert.deepEqual(f.writes[0].fields, { script: input.script, visual_notes: input.visual_notes })
  assert.deepEqual(f.writes[0].filters, [['id', VIDEO], ['client_id', CLIENT]])
  assert.equal(f.videos[0].title, 'Existing exact script')
  assert.equal(f.videos[0].month, null)
  assert.deepEqual(await f.dispatch(input, 'update_content_guideline_video'), first)
  assert.equal(f.writes.length, 1)
})

test('contradictory client routing never reaches either authoring handler', async () => {
  for (const tool of ['add_content_guideline_video', 'update_content_guideline_video']) {
    const f = fixture()
    const result = await f.dispatch({ context, client_id: FOREIGN, content_run_id: RUN,
      content_guide_idea_id: VIDEO, title: 'No write', idempotency_key: tool }, tool)
    assert.match(result.error.message, /Cross-client request refused/)
    assert.equal(f.writes.length, 0)
    assert.equal(f.reads.length, 0)
  }
})

test('foreign saved video ownership is checked before validating or writing script fields', async () => {
  const f = fixture({ videoClient: FOREIGN })
  const result = await f.dispatch({ context, content_guide_idea_id: VIDEO, script: 'No write',
    idempotency_key: 'foreign-video' }, 'update_content_guideline_video')
  assert.match(payload(result).error, /Cross-client request refused/)
  assert.equal(f.writes.length, 0)
})

test('routing separation never permits reserved state, ordering or deliverable edits', async () => {
  for (const field of ['position', 'video_number', 'status', 'production_status', 'deliverable_id', 'canonical_name']) {
    for (const tool of ['add_content_guideline_video', 'update_content_guideline_video']) {
      const f = fixture()
      const result = await f.dispatch({ context, content_run_id: RUN, content_guide_idea_id: VIDEO,
        title: 'Exact title', [field]: 'forbidden', idempotency_key: `${tool}-${field}` }, tool)
      assert.match(payload(result).error, /cannot be set here/)
      assert.equal(f.writes.length, 0)
    }
  }
  assert.equal(validateVideoPatch({ client_id: CLIENT, script: 'No reassignment' }).ok, false)
})

test('handlers refuse mismatched routing even outside the client dispatcher', async () => {
  const f = fixture(), staff = { supabase: f.db,
    contextKind: 'company_admin', connection: { profileId: ACTOR } }
  const added = await f.handlers.add_content_guideline_video(staff,
    { content_run_id: RUN, client_id: FOREIGN, title: 'No write' })
  assert.match(added.error, /client.*does not match/i)
  const updated = await f.handlers.update_content_guideline_video(staff,
    { content_guide_idea_id: VIDEO, client_id: FOREIGN, script: 'No write' })
  assert.match(updated.error, /client.*does not match/i)
  assert.equal(f.writes.length, 0)
})

test('changed input with a saved authoring key conflicts instead of silently rewriting a script', async () => {
  const f = fixture(), input = { context, content_guide_idea_id: VIDEO,
    script: 'First exact staff edit', idempotency_key: 'same-edit' }
  const first = await f.dispatch(input, 'update_content_guideline_video')
  assert.equal(first.result.isError, false)
  const changed = await f.dispatch({ ...input, script: 'Unexpected second edit' }, 'update_content_guideline_video')
  assert.match(JSON.stringify(changed), /conflict/i)
  assert.equal(f.writes.length, 1)
  assert.equal(f.videos[0].script, input.script)
})
