import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dispatchMetaWorker } from '../supabase/functions/_shared/metaWorkerDispatch.ts'

test('missing worker secret fails closed without sending', async () => {
  let called = false
  const result = await dispatchMetaWorker('https://worker.invalid', '', {}, 10, async () => {
    called = true
    return new Response(null, { status: 200 })
  })
  assert.equal(result, false)
  assert.equal(called, false)
})

test('only an OK child response proves admission', async () => {
  assert.equal(await dispatchMetaWorker('https://worker.invalid', 'secret', {}, 10,
    async () => new Response(null, { status: 200 })), true)
  assert.equal(await dispatchMetaWorker('https://worker.invalid', 'secret', {}, 10,
    async () => new Response(null, { status: 401 })), false)
  assert.equal(await dispatchMetaWorker('https://worker.invalid', 'secret', {}, 10,
    async () => new Response(null, { status: 500 })), false)
})

test('timeout or transport failure is not reported as accepted', async () => {
  assert.equal(await dispatchMetaWorker('https://worker.invalid', 'secret', {}, 10,
    async () => { throw new DOMException('timeout', 'TimeoutError') }), false)
  assert.equal(await dispatchMetaWorker('https://worker.invalid', 'secret', {}, 10,
    async () => { throw new Error('network') }), false)
})
