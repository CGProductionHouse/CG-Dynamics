import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const page = readFileSync('src/pages/admin/CompanyCalendarPage.tsx', 'utf8')
const start = page.search(/  async function handle(?:Delete|CancelEvent)\(\)/)
assert.ok(start >= 0, 'actual drawer cancellation handler exists')
const source = page.slice(start, page.indexOf('  const canPublishToClient', start))
const handlerName = source.match(/async function (\w+)/)[1]
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function fixture({ result, throws = false, overrides = {} } = {}) {
  const calls = [], errors = [], pending = [], saved = []
  const event = { id: 'synthetic-event', updated_at: '2026-10-25T11:30:00.123456Z', status: 'confirmed', notes: 'Preserve staff wording', start_at: '2026-10-28T08:00:45.123Z', microsoft_event_id: 'synthetic-source' }
  const values = {
    event, canManage: true, isNew: false, deleting: false, cancelling: false, saving: false, visibilitySaving: false, hasUnsavedChanges: false, mutationPending: { current: false },
    setDeleting: value => pending.push(value), setCancelling: value => pending.push(value),
    setSaveError: value => errors.push(value), onSaved: () => saved.push(true),
    updateCompanyEvent: async (...args) => {
      calls.push({ kind: 'update', args })
      if (throws) throw Error('Synthetic transport failure')
      return result ?? { data: { ...event, status: 'cancelled' }, error: null, tableMissing: false }
    },
    deleteCompanyEvent: async (...args) => { calls.push({ kind: 'delete', args }); return { data: null, error: null, tableMissing: false } },
    ...overrides,
  }
  const run = new Function(...Object.keys(values), `${code};return ${handlerName}`)(...Object.values(values))
  return { run, calls, errors, pending, saved, event }
}

test('actual drawer cancels only the exact revision/status; never deletes or resubmits staff/source fields', async () => {
  const f = fixture(), before = structuredClone(f.event)
  await f.run()
  assert.deepEqual(f.calls, [{ kind: 'update', args: [f.event.id, { status: 'cancelled' }, f.event.updated_at] }])
  assert.deepEqual(f.event, before)
  assert.deepEqual(f.pending, [true, false])
  assert.equal(f.saved.length, 1)
})

test('stale, denied and missing-schema cancellation stay visible with no delete fallback', async () => {
  for (const result of [
    { data: null, error: { message: 'Event changed. Reload before saving.' }, tableMissing: false },
    { data: null, error: { message: 'Permission denied' }, tableMissing: false },
    { data: null, error: null, tableMissing: true },
  ]) {
    const f = fixture({ result }); await f.run()
    assert.equal(f.saved.length, 0)
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].kind, 'update')
    assert.ok(f.errors.at(-1))
    assert.equal(f.pending.at(-1), false)
  }
})

test('null, foreign and unconfirmed returned rows are not cancellation success', async () => {
  for (const data of [null, { id: 'another-event', status: 'cancelled' }, { id: 'synthetic-event', status: 'confirmed' }]) {
    const f = fixture({ result: { data, error: null, tableMissing: false } }); await f.run()
    assert.equal(f.saved.length, 0)
    assert.match(f.errors.at(-1), /could not be verified/i)
    assert.equal(f.calls.length, 1)
  }
})

test('missing original revision makes no cancellation request', async () => {
  const f = fixture({ overrides: { event: { id: 'synthetic-event', status: 'confirmed', updated_at: '' } } })
  await f.run()
  assert.equal(f.calls.length, 0)
  assert.match(f.errors.at(-1), /Reload/)
})

test('transport failure is shown and pending state always clears without retry', async () => {
  const f = fixture({ throws: true }); await f.run()
  assert.equal(f.saved.length, 0)
  assert.match(f.errors.at(-1), /Could not cancel/)
  assert.deepEqual(f.pending, [true, false])
  assert.equal(f.calls.length, 1)
})

test('cancellation cannot discard unsaved staff changes or silently save them', async () => {
  const f = fixture({ overrides: { hasUnsavedChanges: true } }); await f.run()
  assert.equal(f.calls.length, 0)
  assert.equal(f.saved.length, 0)
  assert.match(f.errors.at(-1), /Save your changes/)
})

test('staff, new/already-cancelled events and another pending action cannot cancel', async () => {
  for (const overrides of [
    { canManage: false }, { isNew: true }, { cancelling: true }, { saving: true }, { visibilitySaving: true },
    { event: { id: 'synthetic-event', status: 'cancelled', updated_at: '2026-10-25T11:30:00Z' } },
  ]) {
    const f = fixture({ overrides }); await f.run()
    assert.equal(f.calls.length, 0)
    assert.equal(f.saved.length, 0)
  }
})

test('same-tick cancellation replay cannot issue a second status write', async () => {
  let release, writes = 0
  const deferred = new Promise(resolve => { release = resolve })
  const f = fixture({ overrides: { updateCompanyEvent: async () => {
    writes += 1
    await deferred
    return { data: { id: 'synthetic-event', status: 'cancelled' }, error: null, tableMissing: false }
  } } })
  const first = f.run()
  await f.run()
  assert.equal(writes, 1)
  assert.deepEqual(f.pending, [true])
  release(); await first
  assert.equal(f.saved.length, 1)
  assert.deepEqual(f.pending, [true, false])
})
