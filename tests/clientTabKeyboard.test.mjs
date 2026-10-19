import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, moveClientTabFocus
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  ;({ moveClientTabFocus } = await server.ssrLoadModule('/src/lib/clientTabKeyboard.ts'))
})
after(async () => { await server?.close() })

const keys = ['overview', 'facebook', 'instagram', 'tiktok']
function dispatch(key, index, selected = 'facebook', modifiers = {}, suppliedKeys = keys) {
  const focused = []
  let prevented = 0
  const buttons = Object.fromEntries(suppliedKeys.map(name => [name, { focus: () => focused.push(name) }]))
  moveClientTabFocus({ key, altKey: false, ctrlKey: false, metaKey: false,
    preventDefault: () => prevented++, ...modifiers }, index, selected, suppliedKeys, buttons)
  return { focused, prevented }
}

test('manual tab arrows wrap and Home/End focus endpoints without selection callbacks', () => {
  for (const [key, index, target] of [
    ['ArrowRight', 0, 'facebook'], ['ArrowLeft', 0, 'tiktok'],
    ['ArrowRight', 3, 'overview'], ['ArrowLeft', 3, 'instagram'],
    ['Home', 2, 'overview'], ['End', 1, 'tiktok'],
  ]) assert.deepEqual(dispatch(key, index), { focused: [target], prevented: 1 })
})

test('Tab and Shift+Tab leave using the selected tab sequence position without preventing native traversal', () => {
  for (const index of [0, 1, 3]) for (const shiftKey of [false, true]) {
    assert.deepEqual(dispatch('Tab', index, 'facebook', { shiftKey }), { focused: ['facebook'], prevented: 0 })
  }
})

test('native Enter/Space activation, vertical scrolling and unrelated shortcuts are not intercepted', () => {
  for (const key of ['Enter', ' ', 'Space', 'ArrowUp', 'ArrowDown', 'Escape', 'a']) {
    assert.deepEqual(dispatch(key, 1), { focused: [], prevented: 0 })
  }
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) for (const key of ['ArrowRight', 'Home', 'Tab']) {
    assert.deepEqual(dispatch(key, 1, 'facebook', { [modifier]: true }), { focused: [], prevented: 0 })
  }
})

test('invalid indices, an empty list and a missing ref never select or throw', () => {
  for (const index of [-1, 4, 0.5, NaN]) assert.deepEqual(dispatch('ArrowRight', index), { focused: [], prevented: 0 })
  assert.deepEqual(dispatch('ArrowRight', 0, 'facebook', {}, []), { focused: [], prevented: 0 })
  assert.doesNotThrow(() => moveClientTabFocus({ key: 'Tab' }, 0, 'overview', keys, {}))
  assert.deepEqual(dispatch('ArrowLeft', 0, 'overview', {}, ['overview']), { focused: ['overview'], prevented: 1 })
})

test('Plan and Performance use one keyboard authority and empty inactive semantic panels', () => {
  const plan = readFileSync('src/pages/client/ClientPlanPage.tsx', 'utf8')
  const report = readFileSync('src/pages/client/ClientReportView.tsx', 'utf8')
  for (const source of [plan, report]) {
    assert.match(source, /import \{ moveClientTabFocus \} from '\.\.\/\.\.\/lib\/clientTabKeyboard'/)
    assert.match(source, /role="tabpanel"/)
    assert.match(source, /aria-labelledby=\{`\$\{tabsId\}-\$\{item\.key\}-tab`\}/)
    assert.match(source, /aria-controls=\{`\$\{tabsId\}-\$\{item\.key\}-panel`\}/)
    assert.match(source, /focus-visible:outline/)
    assert.doesNotMatch(source, /function moveTabFocus|onFocus=/)
  }
  assert.match(report, /\{activeTab === item\.key \? activePanel : null\}/)
  assert.match(report, /tabIndex=\{isActive \? 0 : -1\}/)
})
