import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { runBoundedWorkers } from '../supabase/functions/microsoft-transition-sync/bounded-workers.ts'

const path = 'supabase/functions/microsoft-transition-sync/index.ts'
const source = readFileSync(path, 'utf8')
const section = source.slice(source.indexOf('async function graphTaskDescriptions('), source.indexOf('function safeMessage('))
const code = ts.transpileModule(section, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function actual(responses) {
  const requests = []
  const fetchGraph = async (_url, _token, _prefer, options) => {
    requests.push(JSON.parse(options.body).requests)
    const rows = typeof responses === 'function' ? responses(requests.length, requests.at(-1)) : responses
    const requestBySource = new Map(requests.at(-1).map(request => [decodeURIComponent(request.url.slice('/planner/tasks/'.length, -'/details'.length)), request.id]))
    const correlated = Array.isArray(rows) ? rows.map(row => ({ ...row, id: requestBySource.get(row.id) ?? row.id })) : rows
    return new Response(JSON.stringify({ responses: correlated }), { status: 200 })
  }
  const read = new Function('runBoundedWorkers', 'fetchGraph', 'GRAPH_DETAIL_CONCURRENCY', 'GRAPH_BATCH_MAX_ATTEMPTS', 'GRAPH_ROOT', 'shouldRetryStatus', 'sleep', 'batchRetryDelay', `${code};return graphTaskDescriptions`)(runBoundedWorkers, fetchGraph, 4, 8, 'https://graph.microsoft.com/v1.0', status => status === 429 || status >= 500, async () => {}, () => 0)
  return { read: ids => read(ids, 'synthetic-never-sent'), requests }
}
const success = (id, description = 'Exact description') => ({ id, status: 200, body: { id, description } })

test('actual detail fetch refuses duplicate or wrong-task successes instead of last-wins source corruption', async () => {
  for (const responses of [[success('task-a'), success('task-a', 'Contradiction')], [{ ...success('task-a'), body: { id: 'task-b', description: 'Foreign' } }]]) {
    const fixture = actual(responses), result = await fixture.read(['task-a'])
    assert.equal(result.complete, false)
    assert.equal(result.descriptions.has('task-a'), false)
  }
})

test('actual missing/malformed success is unknown, not a destructive empty description', async () => {
  for (const body of [undefined, null, {}, { id: 'task-a' }, { id: 'task-a', description: 1 }]) {
    const result = await actual([{ id: 'task-a', status: 200, body }]).read(['task-a'])
    assert.equal(result.complete, false)
    assert.equal(result.descriptions.has('task-a'), false)
  }
})

test('exact empty and explicit null are retained; out-of-order exact responses and case-sensitive IDs are safe', async () => {
  const fixture = actual([success('Task-A', null), success('task-a', '')])
  const result = await fixture.read(['task-a', 'Task-A'])
  assert.equal(result.complete, true)
  assert.equal(result.descriptions.get('task-a'), '')
  assert.equal(result.descriptions.get('Task-A'), null)
  assert.deepEqual(fixture.requests[0].map(r => [r.id, r.url]), [
    ['detail-1', '/planner/tasks/task-a/details'], ['detail-2', '/planner/tasks/Task-A/details'],
  ])
})

test('missing and throttled details retry only unresolved exact IDs, within the existing bound', async () => {
  const recovered = actual(attempt => attempt === 1 ? [success('task-a'), { id: 'task-b', status: 429 }] : [success('task-b')])
  assert.equal((await recovered.read(['task-a', 'task-b'])).complete, true)
  assert.deepEqual(recovered.requests.map(batch => batch.map(r => r.url)), [['/planner/tasks/task-a/details', '/planner/tasks/task-b/details'], ['/planner/tasks/task-b/details']])
  const unavailable = actual([]), result = await unavailable.read(['task-a'])
  assert.equal(result.complete, false)
  assert.equal(unavailable.requests.length, 8)
})

test('Graph correlation casing is independent of exact source casing; foreign/duplicate correlation stays incomplete', async () => {
  const result = await actual([{ id: 'DETAIL-1', status: 200, body: { id: 'task-a', description: '' } }]).read(['task-a'])
  assert.equal(result.complete, true)
  for (const responses of [
    [success('task-a'), { id: 'DETAIL-1', status: 200, body: { id: 'task-a', description: 'Other' } }],
    [success('task-a'), success('unrequested-task')],
    [{ ...success('task-a'), status: '200' }],
  ]) assert.equal((await actual(responses).read(['task-a'])).complete, false)
})

test('many exact tasks remain bounded to20 per request; duplicate request identities never read or write', async () => {
  const fixture = actual((_attempt, requests) => requests.map(request => success(decodeURIComponent(request.url.slice('/planner/tasks/'.length, -'/details'.length)))))
  const ids = Array.from({ length: 41 }, (_, i) => `task/${i}`)
  const result = await fixture.read(ids)
  assert.equal(result.complete, true)
  assert.equal(result.descriptions.size, 41)
  assert.equal(fixture.requests.length, 3)
  assert.ok(fixture.requests.every(requests => requests.length <= 20 && new Set(requests.map(r => r.id.toLowerCase())).size === requests.length))
  const invalid = actual([])
  assert.equal((await invalid.read(['task-a', 'task-a'])).complete, false)
  assert.equal(invalid.requests.length, 0)
})
