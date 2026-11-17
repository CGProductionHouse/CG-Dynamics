import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
let server, fetchAllPages
before(async () => { server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' }); ({ fetchAllPages } = await server.ssrLoadModule('/src/lib/paginatedQuery.ts')) })
after(async () => { await server?.close() })
test('multi-page source loads all rows; later failure never returns a partial success', async () => {
  const requests = []
  const rows = await fetchAllPages((from, to) => { requests.push([from,to]); return Promise.resolve({ data: from < 4 ? [from,from+1] : [from], error:null }) }, 2)
  assert.deepEqual(rows.data, [0,1,2,3,4]); assert.deepEqual(requests, [[0,1],[2,3],[4,5]])
  const failed = await fetchAllPages(from => Promise.resolve(from === 0 ? {data:[0,1],error:null} : {data:null,error:{message:'source unavailable'}}),2)
  assert.deepEqual(failed.data, []); assert.equal(failed.error.message,'source unavailable')
})
test('native readers opt into stable canonical pagination', () => {
  const command = readFileSync('src/lib/commandCentre.ts','utf8')
  const planner = readFileSync('src/lib/planner.ts','utf8')
  assert.ok(command.includes('fetchAllPages<CommandCentreTask>'))
  assert.ok(command.includes(".order('name').order('id').range(from, to)"))
  assert.ok(planner.includes('fetchAllPages<MonthlyDeliverable>'))
})
