import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { paginateGraph, accumulateOutlookPage, accumulatePlannerPage, planSourceUpdate } from '../supabase/functions/microsoft-transition-sync/job-machine.ts'
import { runBoundedWorkers } from '../supabase/functions/microsoft-transition-sync/bounded-workers.ts'

const source = readFileSync('supabase/functions/microsoft-transition-sync/index.ts', 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const start = 'https://graph.microsoft.com/v1.0/planner/plans/exact-plan/tasks'
const describe = () => 'Microsoft read failed.'

test('actual paginator rejects malformed HTTP200 collections instead of certifying an empty source', async () => {
  for (const body of [null, {}, [], { error: { message: 'not source data' } }, { value: null }, { value: {} }, { value: 'bad' }, { value: [null] }, { value: [[]] }, { value: ['task'] }, { value: [{ id: 'a' }], '@odata.nextLink': 2 }, { value: [], '@odata.nextLink': '' }]) {
    const result = await paginateGraph(start, async () => ({ ok: true, status: 200, body }), describe)
    assert.equal(result.complete, false, JSON.stringify(body))
    assert.equal(result.nextCursor, null)
    assert.deepEqual(result.values, [])
    assert.ok(result.safeError)
  }
})

test('malformed later page preserves earlier exact evidence but cannot complete or checkpoint the source', async () => {
  let calls = 0
  const result = await paginateGraph(start, async () => ({ ok: true, status: 200, body: ++calls === 1 ? { value: [{ id: 'task-a' }], '@odata.nextLink': `${start}?page=2` } : {} }), describe)
  assert.deepEqual(result.values, [{ id: 'task-a' }])
  assert.equal(calls, 2)
  assert.equal(result.complete, false)
  assert.equal(result.nextCursor, null)
  assert.ok(result.safeError)
  const validBuckets = { values: [], complete: true, safeError: null, nextCursor: null }
  for (const unit of [accumulateOutlookPage([], [{ sourceEventId: 'event-a' }], result), accumulatePlannerPage([], [{ sourceTaskId: 'task-a' }], result, validBuckets)]) {
    const update = planSourceUpdate(unit, 1)
    assert.equal(update.stage, 'failed')
    assert.equal(update.complete, false)
  }
})

test('explicit empty collection remains valid; canonical multi-page checkpoint behaviour is unchanged', async () => {
  assert.equal((await paginateGraph(start, async () => ({ ok: true, status: 200, body: { value: [] } }), describe)).complete, true)
  const result = await paginateGraph(start, async () => ({ ok: true, status: 200, body: { value: [{ id: 'task-a' }], '@odata.nextLink': `${start}?page=2` } }), describe, 1)
  assert.equal(result.complete, false)
  assert.equal(result.safeError, null)
  assert.equal(result.nextCursor, `${start}?page=2`)
})

test('actual Graph page adapter turns broken JSON into a sanitized incomplete source receipt', async () => {
  const section = source.slice(source.indexOf('async function graphPages('), source.indexOf('function dateOnly('))
  let calls = 0
  const fetchGraph = async () => {
    calls++
    return new Response('private-provider-body-not-json', { status: 200 })
  }
  const read = new Function('paginateGraph', 'fetchGraph', 'GRAPH_ROOT', 'PAGINATION_BATCH_SIZE', 'safeMessage', `${compile(section)}; return graphPages`)(paginateGraph, fetchGraph, 'https://graph.microsoft.com/v1.0', 500, describe)
  const result = await read('/planner/plans/exact-plan/tasks', 'synthetic-never-sent')
  assert.equal(result.complete, false)
  assert.equal(result.nextCursor, null)
  assert.ok(result.safeError)
  assert.doesNotMatch(result.safeError, /private-provider-body/)
  assert.equal(calls, 1)
})

test('actual detail reader holds broken batch JSON without claiming empty descriptions or leaking payloads', async () => {
  const section = source.slice(source.indexOf('async function graphTaskDescriptions('), source.indexOf('function safeMessage('))
  let calls = 0
  const fetchGraph = async () => { calls++; return new Response('private-provider-body-not-json', { status: 200 }) }
  const read = new Function('runBoundedWorkers', 'fetchGraph', 'GRAPH_DETAIL_CONCURRENCY', 'GRAPH_BATCH_MAX_ATTEMPTS', 'GRAPH_ROOT', 'shouldRetryStatus', 'sleep', 'batchRetryDelay', `${compile(section)};return graphTaskDescriptions`)(runBoundedWorkers, fetchGraph, 4, 8, 'https://graph.microsoft.com/v1.0', () => false, async () => {}, () => 0)
  const result = await read(['task-a'], 'synthetic-never-sent')
  assert.equal(result.complete, false)
  assert.equal(result.descriptions.size, 0)
  assert.equal(calls, 1)
})
