import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runBoundedWorkers } from '../supabase/functions/microsoft-transition-sync/bounded-workers.ts'

test('Planner detail batches never exceed the configured concurrency', async () => {
  let active = 0
  let maximum = 0
  const completed = []

  await runBoundedWorkers([1, 2, 3, 4, 5, 6, 7], 3, async item => {
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    completed.push(item)
    active -= 1
  })

  assert.equal(maximum, 3)
  assert.deepEqual(completed.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7])
})

test('bounded workers handle empty input without invoking the worker', async () => {
  let called = false
  await runBoundedWorkers([], 4, async () => { called = true })
  assert.equal(called, false)
})

test('Microsoft fetch processes Planner plans with bounded concurrency', () => {
  const source = readFileSync(
    new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /const GRAPH_PLAN_CONCURRENCY = 2/)
  assert.match(source, /runBoundedWorkers\(manifest\.plans, GRAPH_PLAN_CONCURRENCY/)
})
