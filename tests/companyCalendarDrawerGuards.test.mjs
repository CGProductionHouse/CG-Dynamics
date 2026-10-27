import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const page = readFileSync('src/pages/admin/CompanyCalendarPage.tsx', 'utf8')
const drawer = page.slice(page.indexOf('function EventDrawer('))
function actual(name, end, values) {
  const start = drawer.indexOf(`  ${name === 'requestClose' ? '' : 'async '}function ${name}(`)
  assert.ok(start >= 0, `actual ${name} exists`)
  const code = ts.transpileModule(drawer.slice(start, drawer.indexOf(end, start)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function(...Object.keys(values), `${code};return ${name}`)(...Object.values(values))
}

test('actual close path retains unsaved changes and never closes a pending mutation', () => {
  for (const dirty of [false, true]) {
    for (const pending of [false, true]) {
      const closed = [], confirmed = []
      const close = actual('requestClose', '  useEffect(', {
        hasUnsavedChanges: dirty, mutationPending: { current: pending }, creationReadbackPending: false,
        onClose: () => closed.push(true), setConfirmDiscard: value => confirmed.push(value),
      })
      close()
      assert.equal(closed.length, !pending && !dirty ? 1 : 0)
      assert.deepEqual(confirmed, !pending && dirty ? [true] : [])
    }
  }
})

function visibilityFixture({ rejects = false, error = null, overrides = {}, deferred } = {}) {
  const calls = [], pending = [], errors = [], saved = [], mutationPending = { current: false }
  const values = {
    mutationPending, isNew: false, canManage: true, visibilitySaving: false, saving: false, cancelling: false, hasUnsavedChanges: false,
    event: { id: 'synthetic-event', client_visible: false }, canPublishToClient: true,
    setVisibilitySaving: value => pending.push(value), setSaveError: value => errors.push(value),
    setCompanyEventClientVisibility: async (...args) => {
      calls.push(args)
      if (deferred) await deferred
      if (rejects) throw Error('Synthetic transport failure')
      return { error }
    },
    onSaved: () => saved.push(true), ...overrides,
  }
  return { run: actual('handleClientVisibility', '  return (', values), calls, pending, errors, saved, mutationPending }
}

test('actual visibility action releases shared guard after a thrown or returned failure', async () => {
  for (const options of [{ rejects: true }, { error: { message: 'denied' } }]) {
    const f = visibilityFixture(options); await f.run()
    assert.equal(f.calls.length, 1)
    assert.deepEqual(f.pending, [true, false])
    assert.equal(f.mutationPending.current, false)
    assert.equal(f.saved.length, 0)
    assert.deepEqual(f.errors, [null, 'Could not update client visibility.'])
  }
})

test('same-tick visibility replay issues one request and retains the real guarded action', async () => {
  let release
  const deferred = new Promise(resolve => { release = resolve })
  const f = visibilityFixture({ deferred })
  const first = f.run()
  await f.run()
  assert.deepEqual(f.calls, [['synthetic-event', true]])
  assert.equal(f.mutationPending.current, true)
  release(); await first
  assert.equal(f.saved.length, 1)
  assert.equal(f.mutationPending.current, false)
})

test('new/staff/ineligible/busy visibility requests make no mutation', async () => {
  for (const overrides of [
    { isNew: true }, { canManage: false }, { canPublishToClient: false }, { saving: true },
    { cancelling: true }, { visibilitySaving: true }, { mutationPending: { current: true } },
  ]) {
    const f = visibilityFixture({ overrides }); await f.run()
    assert.equal(f.calls.length, 0)
    assert.equal(f.saved.length, 0)
  }
})

test('visibility cannot discard unsaved staff notes or implicitly save them', async () => {
  const f = visibilityFixture({ overrides: { hasUnsavedChanges: true } }); await f.run()
  assert.equal(f.calls.length, 0)
  assert.equal(f.saved.length, 0)
  assert.deepEqual(f.errors, ['Save your changes before updating client visibility.'])
})
