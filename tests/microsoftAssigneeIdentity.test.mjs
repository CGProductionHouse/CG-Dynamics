import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { buildAssigneeBatchRequests, correlateAssigneeBatchResponses } from '../supabase/functions/microsoft-transition-sync/assignee-lookup.ts'
import { resolveMicrosoftAssignee } from '../src/lib/microsoftAssigneeMapping.ts'

const batch = buildAssigneeBatchRequests(['user-a', 'user-b'])
const row = (id = 'assignee-1', body = { id: 'user-a', displayName: 'Exact User', mail: 'exact@example.test' }) => ({ id, status: 200, body })

test('assignee metadata must belong to the exact requested Microsoft user, not merely a batch correlation', () => {
  for (const body of [{ id: 'foreign-user', displayName: 'Other', mail: 'other@example.test' }, { displayName: 'Missing identity' }, {}, null, [], { id: 'user-a', displayName: 42 }, { id: 'user-a', displayName: ' ' }, { id: 'user-a', displayName: 'Exact', mail: {} }, { id: 'user-a', displayName: 'Exact', userPrincipalName: 9 }]) {
    const result = correlateAssigneeBatchResponses([row('assignee-1', body)], batch.sourceIdByRequestId)
    assert.deepEqual(result.assignees, {}, JSON.stringify(body))
    assert.deepEqual(result.unresolvedSourceIds, ['user-a', 'user-b'])
  }
})

test('duplicate correlations including casing variants are unresolved, never last-wins staff identity', () => {
  for (const duplicate of ['assignee-1', 'ASSIGNEE-1']) {
    const result = correlateAssigneeBatchResponses([row(), row(duplicate, { id: 'user-a', displayName: 'Conflicting', mail: 'other@example.test' }), row('assignee-2', { id: 'user-b', displayName: 'Second', mail: null, userPrincipalName: null })], batch.sourceIdByRequestId)
    assert.equal(result.assignees['user-a'], undefined)
    assert.equal(result.assignees['user-b'].displayName, 'Second')
    assert.deepEqual(result.unresolvedSourceIds, ['user-a'])
  }
})

test('valid out-of-order case-insensitive correlations preserve exact source IDs and real nullable metadata', () => {
  const result = correlateAssigneeBatchResponses([row('ASSIGNEE-2', { id: 'user-b', displayName: 'Second', mail: null }), row('ASSIGNEE-1')], batch.sourceIdByRequestId)
  assert.deepEqual(result.unresolvedSourceIds, [])
  assert.equal(result.assignees['user-a'].mail, 'exact@example.test')
  assert.deepEqual(result.assignees['user-b'], { displayName: 'Second', mail: null, userPrincipalName: null })
  assert.ok(batch.requests.every(request => request.url.includes('$select=id,displayName,mail,userPrincipalName')))
})

test('malformed batch rows/envelopes stay unresolved rather than throwing or inventing Unknown users', () => {
  for (const responses of [null, {}, 'broken', [null, 2, {}, { id: 1 }, row('foreign-correlation')]]) {
    const result = correlateAssigneeBatchResponses(responses, batch.sourceIdByRequestId)
    assert.deepEqual(result.assignees, {})
    assert.deepEqual(result.unresolvedSourceIds, ['user-a', 'user-b'])
  }
})

test('real downstream staff resolver cannot email-match rejected foreign metadata; existing explicit mappings remain authoritative', () => {
  const profiles = [{ id: 'staff-other', email: 'other@example.test', full_name: 'Other Staff' }]
  const rejected = correlateAssigneeBatchResponses([row('assignee-1', { id: 'foreign-user', displayName: 'Other Staff', mail: 'other@example.test' })], batch.sourceIdByRequestId)
  const unresolved = resolveMicrosoftAssignee('user-a', rejected.assignees['user-a'], new Map(), profiles)
  assert.equal(unresolved.resolved, false)
  assert.equal(unresolved.cgProfileId, null)
  assert.equal(unresolved.method, 'unresolved')
  const stored = resolveMicrosoftAssignee('user-a', rejected.assignees['user-a'], new Map([['user-a', 'staff-other']]), profiles)
  assert.equal(stored.resolved, true)
  assert.equal(stored.method, 'stored')
  const valid = correlateAssigneeBatchResponses([row()], batch.sourceIdByRequestId)
  const matched = resolveMicrosoftAssignee('user-a', valid.assignees['user-a'], new Map(), [{ id: 'staff-exact', email: 'exact@example.test', full_name: 'Exact Staff' }])
  assert.equal(matched.cgProfileId, 'staff-exact')
  assert.equal(matched.method, 'email_match')
})

test('actual optional assignee reader isolates failed/broken batches and keeps later exact resolutions', async () => {
  const source = readFileSync('supabase/functions/microsoft-transition-sync/index.ts', 'utf8')
  const section = source.slice(source.indexOf('async function resolveAssignees('), source.indexOf('async function fetchOutlookUnit('))
  const code = ts.transpileModule(section, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const failure of ['broken JSON', 'null', '{"responses":{}}']) {
    const requests = []
    const fetchGraph = async (_url, _token, _prefer, options) => {
      const batch = JSON.parse(options.body).requests
      requests.push(batch)
      if (requests.length === 1) return new Response(failure, { status: 200 })
      return new Response(JSON.stringify({ responses: batch.map(request => row(request.id, { id: decodeURIComponent(request.url.split('/users/')[1].split('?')[0]), displayName: 'Exact Later User', mail: null })) }), { status: 200 })
    }
    const read = new Function('fetchGraph', 'buildAssigneeBatchRequests', 'correlateAssigneeBatchResponses', 'GRAPH_ROOT', 'sleep', `${code};return resolveAssignees`)(fetchGraph, buildAssigneeBatchRequests, correlateAssigneeBatchResponses, 'https://graph.microsoft.com/v1.0', async () => {})
    const ids = Array.from({ length: 21 }, (_, i) => `user-${i}`)
    const result = await read([...ids, ids[0], ids[20]], 'synthetic-never-sent')
    assert.deepEqual(Object.keys(result), ['user-20'])
    assert.equal(result['user-20'].displayName, 'Exact Later User')
    assert.equal(requests.length, 2)
    assert.equal(requests[0].length, 20)
    assert.equal(requests[1].length, 1)
  }
})
