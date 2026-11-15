import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
let server, rules
before(async () => { server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' }); rules = await server.ssrLoadModule('/src/lib/nolanSourceLanes.ts') })
after(async () => { await server?.close() })
test('exact linked app repository is used, prose name is not identity', () => {
  assert.equal(rules.linkedAppRepository({ notes: 'CG Hours work', whatsapp_source_text: null }), null)
  assert.equal(rules.linkedAppRepository({ notes: 'https://github.com/CGProductionHouse/CG-Hours/issues/10', whatsapp_source_text: null }), 'CGProductionHouse/CG-Hours')
})
test('lookalike repos and ambiguous two-app sources do not establish identity', () => {
  assert.equal(rules.linkedAppRepository({ notes: 'https://github.com/CGProductionHouse/CG-Hours-evil/issues/10', whatsapp_source_text: null }), null)
  assert.equal(rules.linkedAppRepository({ notes: 'https://github.com/CGProductionHouse/CG-Hours/issues/10 https://github.com/CGProductionHouse/cg-pay/issues/1', whatsapp_source_text: null }), null)
})
test('task lane completion and personal ownership remain canonical', () => {
  const base = { status: 'to_do', bucket: 'Once-off', assigned_to_user_id: 'u1', notes: null, whatsapp_source_text: null }
  assert.equal(rules.taskInNolanLane(base,'special'),true)
  assert.equal(rules.taskInNolanLane(base,'needs','u1'),true)
  assert.equal(rules.taskInNolanLane(base,'needs','u2'),false)
  assert.equal(rules.taskInNolanLane({...base,status:'done'},'work'),false)
  assert.equal(rules.taskInNolanLane({...base,status:'done'},'done'),true)
  assert.equal(rules.taskInNolanLane({...base,status:'approved'},'done'),false)
})
