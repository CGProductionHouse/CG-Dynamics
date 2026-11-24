import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'
import { assertRecordClientMatchesContext } from '../supabase/functions/cg-dynamics-mcp/projectContext.ts'
import { buildGuidelineNavigation } from '../supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts'

const CLIENT = '11111111-1111-4111-8111-111111111111'
const FOREIGN = '22222222-2222-4222-8222-222222222222'
const RUN = '33333333-3333-4333-8333-333333333333'
const GUIDE = '44444444-4444-4444-8444-444444444444'
const ACTOR = '55555555-5555-4555-8555-555555555555'
const source = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
const start = source.indexOf('const handleFindContentRuns:')
const end = source.indexOf('\n/**', start)
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const discover = new Function('classifyOneDriveReadiness', 'buildGuidelineNavigation', 'assertRecordClientMatchesContext',
  `${js}; return handleFindContentRuns`)(() => ({ readiness: 'unmapped' }), buildGuidelineNavigation, assertRecordClientMatchesContext)

function database({ rows = {}, fail = null, ignoreRunFilter = false } = {}) {
  const reads = []
  return { reads, from(table) {
    const filters = []
    reads.push({ table, filters })
    const resolve = () => {
      if (fail === table) return { data: null, error: { message: 'Source unavailable' } }
      let data = rows[table] ?? []
      if (!(ignoreRunFilter && table === 'content_runs')) data = data.filter(row => filters.every(([key, value, op]) =>
        op === 'neq' ? row[key] !== value : row[key] === value))
      return { data, error: null }
    }
    const query = { select() { return this }, order() { return this }, limit() { return this },
      eq(key, value) { filters.push([key, value, 'eq']); return this },
      neq(key, value) { filters.push([key, value, 'neq']); return this },
      async maybeSingle() { const result = resolve(); return { ...result, data: result.data?.[0] ?? null } },
      then(done, reject) { return Promise.resolve(resolve()).then(done, reject) },
    }
    return query
  } }
}

function dispatcher(db) {
  const connection = { userId: ACTOR, profileId: ACTOR, fullName: 'Verified staff', role: 'admin' }
  return actualOperationalDispatcher({ supabase: db, contextKind: 'client', effectiveClientId: CLIENT,
    effectiveStaffProfileId: null, profileId: ACTOR, role: 'admin', connection }, { find_content_runs: discover }, new Set())
}
const context = { context_kind: 'client', client_id: CLIENT }
const result = response => JSON.parse(response.result.content[0].text)
const ownRun = { id: RUN, client_id: CLIENT, client_name: 'Exact client', name: 'Unbooked script preparation', run_date: null, status: 'planning' }

test('the actual dispatcher permits exact-client guideline discovery without becoming a staff Project', async () => {
  const db = database({ rows: { content_runs: [ownRun, { ...ownRun, id: 'other-run', client_id: FOREIGN }],
    content_guidelines: [{ id: GUIDE, content_run_id: RUN, client_id: CLIENT, title: 'Existing guideline', month: null, status: 'draft' }],
    content_guide_ideas: [{ id: 'video', content_guideline_id: GUIDE, client_id: CLIENT, title: 'Saved script', status: 'draft' }] } })
  const response = await dispatcher(db)({ context }, 'find_content_runs')
  assert.equal(response.error, undefined, JSON.stringify(response.error))
  const found = result(response)
  assert.equal(found.runs.length, 1)
  assert.equal(found.runs[0].content_run.id, RUN)
  assert.equal(found.runs[0].content_run.run_date, null, 'Discovery cannot invent a booked shoot date')
  assert.equal(found.runs[0].content_guideline.id, GUIDE)
  assert.equal(found.runs[0].videos.length, 1)
  assert.equal(found._context.effective_context_kind, 'client')
  assert.equal(found._context.effective_client_id, CLIENT)
  assert.ok(db.reads[0].filters.some(([key, value]) => key === 'client_id' && value === CLIENT))
})

test('a contradictory client id is rejected by the actual dispatcher before any source read', async () => {
  const db = database()
  const response = await dispatcher(db)({ context, client_id: FOREIGN }, 'find_content_runs')
  assert.match(response.error.message, /Cross-client request refused/)
  assert.equal(db.reads.length, 0)
})

test('a foreign run returned by a faulty adapter is refused before guideline, folder or closeout reads', async () => {
  const db = database({ rows: { content_runs: [{ ...ownRun, client_id: FOREIGN, client_name: 'Foreign private identity' }] }, ignoreRunFilter: true })
  const response = await dispatcher(db)({ context }, 'find_content_runs')
  const text = JSON.stringify(response)
  assert.match(text, /Cross-client request refused/)
  assert.doesNotMatch(text, /Foreign private identity/)
  assert.deepEqual(db.reads.map(read => read.table), ['content_runs'])
})

test('deliverable discovery queries only exact-client ideas and cannot resolve a foreign video', async () => {
  const db = database({ rows: { content_guide_ideas: [{ id: 'foreign-video', client_id: FOREIGN,
    deliverable_id: 'requested-slot', content_guideline_id: GUIDE, status: 'draft' }] } })
  const response = await dispatcher(db)({ context, deliverable_id: 'requested-slot' }, 'find_content_runs')
  const found = result(response)
  assert.deepEqual(found.runs, [])
  assert.equal(found.matched_by, 'deliverable_id')
  const ideas = db.reads.find(read => read.table === 'content_guide_ideas')
  assert.ok(ideas.filters.some(([key, value]) => key === 'client_id' && value === CLIENT))
  assert.equal(db.reads.some(read => read.table === 'content_guidelines'), false)
})

test('missing matches and a read failure remain truthful; neither creates a guideline', async () => {
  assert.deepEqual(result(await dispatcher(database())({ context }, 'find_content_runs')).runs, [])
  const response = await dispatcher(database({ fail: 'content_runs' }))({ context }, 'find_content_runs')
  assert.equal(response.result.isError, true)
  assert.match(JSON.stringify(response), /Source unavailable/)
})

test('personal tasks, staff identities, calendar mutations and company inventories remain unavailable', async () => {
  for (const tool of ['create_task', 'get_my_day', 'upsert_calendar_event', 'link_content_run_deliverables', 'list_company_tasks']) {
    const db = database()
    const response = await actualOperationalDispatcher({ supabase: db, contextKind: 'client', effectiveClientId: CLIENT,
      effectiveStaffProfileId: null, profileId: ACTOR, role: 'admin', connection: { userId: ACTOR, profileId: ACTOR, role: 'admin' } },
    { [tool]: async () => { throw Error('The unrelated handler must not execute') } }, new Set())({ context }, tool)
    assert.ok(response.error, tool)
    assert.equal(db.reads.length, 0)
  }
})
