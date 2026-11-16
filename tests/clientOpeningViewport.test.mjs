import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync('src/lib/clientOpeningViewport.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function fixture({ ios = true, mobile = true, scale = 16 / 14, focused = false, missingMeta = false, missingViewport = false } = {}) {
  const original = 'width=device-width, initial-scale=1.0'
  const writes = [], frames = new Map(), timers = new Map(), listeners = new Map()
  class Element { matches() { return focused } }
  const meta = { getAttribute: () => original, setAttribute: (_name, value) => writes.push(value) }
  let id = 0
  const window = {
    matchMedia: () => ({ matches: mobile }), visualViewport: missingViewport ? null : { scale },
    requestAnimationFrame: cb => { frames.set(++id, cb); return id }, cancelAnimationFrame: n => frames.delete(n),
    setTimeout: (cb, delay) => { assert.equal(delay, 250); timers.set(++id, cb); return id }, clearTimeout: n => timers.delete(n),
    addEventListener: (name, cb, options) => { assert.equal(options.passive, true); listeners.set(name, cb) },
    removeEventListener: name => listeners.delete(name),
  }
  const exports = {}
  vm.runInNewContext(code, { exports, window, navigator: { userAgent: ios ? 'iPhone' : 'Windows', maxTouchPoints: 0 }, HTMLElement: Element,
    document: { activeElement: new Element(), querySelector: () => missingMeta ? null : meta } })
  const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb()) }
  return { run: exports.restoreClientOpeningViewport, original, writes, frames, timers, listeners, tick }
}

test('cropped iOS opening gets one bounded reset, restores the exact original meta and leaves no listeners/timers', () => {
  const f = fixture()
  const cleanup = f.run()
  assert.equal(f.writes.length, 1)
  assert.match(f.writes[0], /initial-scale=1, minimum-scale=1, maximum-scale=1/)
  f.tick()
  assert.equal(f.writes.length, 1)
  f.tick()
  assert.equal(f.writes[1], f.original)
  assert.equal(f.listeners.size + f.timers.size + f.frames.size, 0)
  cleanup()
  assert.equal(f.writes.length, 2)
})

test('background tab timeout, unmount and any new touch restore user zoom immediately', () => {
  for (const event of ['timeout', 'unmount', 'touch']) {
    const f = fixture()
    const cleanup = f.run()
    if (event === 'timeout') [...f.timers.values()][0]()
    if (event === 'unmount') cleanup()
    if (event === 'touch') f.listeners.get('touchstart')()
    assert.equal(f.writes.at(-1), f.original, event)
    assert.equal(f.listeners.size + f.timers.size + f.frames.size, 0, event)
  }
})

test('normal scale, desktop, non-iOS, active editors and missing browser capabilities are untouched', () => {
  for (const options of [{ scale: 1 }, { scale: NaN }, { mobile: false }, { ios: false }, { focused: true }, { missingMeta: true }, { missingViewport: true }]) {
    const f = fixture(options)
    f.run()()
    assert.deepEqual(f.writes, [], JSON.stringify(options))
    assert.equal(f.frames.size + f.timers.size + f.listeners.size, 0)
  }
  const exports = {}
  vm.runInNewContext(code, { exports })
  assert.doesNotThrow(() => exports.restoreClientOpeningViewport()())
})

test('real shell repairs only on entry, previews never reset and login blurs before asynchronous auth', () => {
  const shell = readFileSync('src/components/client/ClientPortalShell.tsx', 'utf8')
  assert.match(shell, /useLayoutEffect\(\(\) => \{\s*if \(!isPreview\) return restoreClientOpeningViewport\(\)\s*\}, \[isPreview\]\)/)
  const login = readFileSync('src/pages/Login.tsx', 'utf8')
  assert.ok(login.indexOf('active.blur()') < login.indexOf('await signIn('))
  assert.doesNotMatch(source, /setInterval|user-scalable=no|preventDefault/)
})
