import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runBoundedWorkers } from '../supabase/functions/microsoft-transition-sync/bounded-workers.ts'
import { shouldFetchPlannerTaskDetails } from '../supabase/functions/microsoft-transition-sync/planner-details.ts'
import {
  buildAssigneeBatchRequests,
  correlateAssigneeBatchResponses,
} from '../supabase/functions/microsoft-transition-sync/assignee-lookup.ts'

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

test('Microsoft preview is a durable per-source job, not a single monolithic fetch', () => {
  const source = readFileSync(
    new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url),
    'utf8',
  )
  // The monolithic "fetch all plans at once" loop that timed out is gone.
  assert.doesNotMatch(source, /runBoundedWorkers\(manifest\.plans/)
  assert.match(source, /action === 'fetch'[\s\S]*?410/) // one-shot fetch retired
  // Each invocation claims one source and does one bounded unit (tasks, or a
  // single detail batch), then returns for the admin page to poll again.
  assert.match(source, /pickNextSource\(jobRows\)/)
  assert.match(source, /nextDetailBatch\(pending\)/)
  assert.match(source, /'job_start', 'job_process', 'job_status', 'job_result', 'job_retry', 'job_latest'/)
})

test('active operational tasks keep their Planner descriptions', () => {
  assert.equal(shouldFetchPlannerTaskDetails('To Do', 0), true)
  assert.equal(shouldFetchPlannerTaskDetails('To Do', 50), true)
  assert.equal(shouldFetchPlannerTaskDetails('MASTER CLIENT TO DO', null), true)
})

test('completed operational history skips unused Planner detail calls', () => {
  assert.equal(shouldFetchPlannerTaskDetails('To Do', 100), false)
  assert.equal(shouldFetchPlannerTaskDetails('CG Socials', 100), false)
})

test('Client Socials always keeps descriptions and scripts, including scheduled cards', () => {
  assert.equal(shouldFetchPlannerTaskDetails('Client Socials - July 2026', 100), true)
  assert.equal(shouldFetchPlannerTaskDetails('2025 CLIENTS SCHEDULE', 100), true)
})

test('assignee Graph batch requests use safe request IDs and retain source identity', () => {
  const sourceIds = ['4e769c9d-user-id', 'opaque_Planner-user/id']
  const batch = buildAssigneeBatchRequests(sourceIds)

  assert.deepEqual(batch.requests.map(request => request.id), ['assignee-1', 'assignee-2'])
  assert.equal(batch.requests[1].url, '/users/opaque_Planner-user%2Fid?$select=displayName,mail,userPrincipalName')
  assert.equal(batch.sourceIdByRequestId.get('assignee-1'), sourceIds[0])
  assert.equal(batch.sourceIdByRequestId.get('assignee-2'), sourceIds[1])
})

test('assignee Graph responses map metadata back to the original Planner user ID', () => {
  const batch = buildAssigneeBatchRequests(['planner-user-a', 'planner-user-b'])
  const result = correlateAssigneeBatchResponses([
    {
      id: 'assignee-1',
      status: 200,
      body: {
        displayName: 'Alana Example',
        mail: 'alana@example.com',
        userPrincipalName: 'alana@example.onmicrosoft.com',
      },
    },
    { id: 'assignee-2', status: 403 },
  ], batch.sourceIdByRequestId)

  assert.deepEqual(result.assignees['planner-user-a'], {
    displayName: 'Alana Example',
    mail: 'alana@example.com',
    userPrincipalName: 'alana@example.onmicrosoft.com',
  })
  assert.equal(result.assignees['planner-user-b'], undefined)
  assert.deepEqual(result.unresolvedSourceIds, ['planner-user-b'])
})
