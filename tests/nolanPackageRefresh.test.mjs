import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
let server, load
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  ;({ loadNolanPackageEvidence: load } = await server.ssrLoadModule('/src/lib/nolanPackageEvidence.ts'))
})
after(async () => { await server?.close() })
test('a failed evidence read has no success timestamp; a retry can recover with a fresh receipt', async () => {
  let attempt = 0, clockCalls = 0
  const clients = [{ id: 'fixture' }]
  const readClients = async () => ({data:clients,error:null})
  const matrix = async rows => {
    assert.equal(rows, clients)
    return ++attempt === 1 ? {data:[],error:new Error('temporary')} : {data:[{clientId:'fixture'}],error:null}
  }
  const clock = () => { clockCalls++; return '2026-11-15T10:00:00Z' }
  await assert.rejects(load(readClients,matrix,clock), /temporary/)
  assert.equal(clockCalls,0)
  assert.deepEqual(await load(readClients,matrix,clock), {data:[{clientId:'fixture'}],checkedAt:'2026-11-15T10:00:00Z'})
  assert.equal(clockCalls,1)
})
test('client read failure stops package query rather than reporting empty success', async () => {
  let queried = false
  await assert.rejects(load(async()=>({data:[],error:new Error('client read failed')}), async()=>{queried=true; return {data:[],error:null}}), /client read failed/)
  assert.equal(queried,false)
})
test('UI refresh/retry cancels superseded reads and clears stale results, with its own receipt', () => {
  const page = readFileSync('src/pages/admin/NolanPackageEvidence.tsx','utf8')
  const parent = readFileSync('src/pages/admin/NolanOverview.tsx','utf8')
  assert.ok(parent.includes('refreshGeneration={generation}'))
  assert.ok(page.includes('[requested, retry, refreshGeneration, month]'))
  assert.ok(page.includes('return () => { cancelled = true }'))
  assert.ok(page.includes('if (!cancelled) { setData(result.data); setCheckedAt(result.checkedAt) }'))
  for (const text of ['setData(null)','setCheckedAt(null)','setError(null)','Retry package evidence','Package evidence last read:','disabled={loading}']) assert.ok(page.includes(text))
})
test('partial evidence accompanying an error never receives a successful read receipt', async () => {
  let clockCalls = 0
  await assert.rejects(load(
    async()=>({data:[{id:'fixture'}],error:null}),
    async()=>({data:[{clientId:'partial-result'}],error:new Error('later page unavailable')}),
    ()=>{clockCalls++; return '2026-11-15T10:00:00Z'}
  ), /later page unavailable/)
  assert.equal(clockCalls,0)
})
