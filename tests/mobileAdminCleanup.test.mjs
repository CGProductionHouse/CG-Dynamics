import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = path => readFileSync(path, 'utf8')
function load(path, dependencies = {}) {
  const code = ts.transpileModule(read(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), document: globalThis.document, HTMLElement: globalThis.HTMLElement })
  return exports
}
const roles = load('src/lib/roles.ts')
const navigation = load('src/pages/admin/adminNavigation.ts', { '../../lib/roles': roles })
const { mobileNavigationGroups } = load('src/lib/mobileStaffNavigation.ts', { '../pages/admin/adminNavigation': navigation })
const { mobilePackageSummary } = load('src/lib/mobilePackageSummary.ts')

test('mobile More reaches both workspaces and admin tools exactly once, independent of zone', () => {
  const items = mobileNavigationGroups('admin').flatMap(group => group.items)
  const paths = items.map(item => item.to)
  for (const path of ['/admin/work', '/admin/content', '/admin/cg-calendar', '/admin/client-schedule', '/admin/clients', '/admin/reports', '/admin/users', '/admin/system', '/admin/users?tab=client-access', '/admin/integrations']) assert.ok(paths.includes(path), path)
  assert.equal(paths.length, new Set(paths).size)
  assert.ok(!paths.includes('/admin/command-centre#morning-import'), 'import remains inside Team Work, not a second mobile destination')
  const filtered = mobileNavigationGroups('admin', 'password').flatMap(group => group.items)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].to, '/admin/users?tab=client-access')
  assert.equal(mobileNavigationGroups('admin', 'not-a-page').length, 0)
})

test('mobile navigation preserves the real role authority and never advertises admin tools to staff', () => {
  for (const role of ['staff', 'team', 'manager']) {
    const items = mobileNavigationGroups(role).flatMap(group => group.items)
    assert.ok(items.every(item => navigation.canShowNavItem(item, role)))
    assert.ok(!items.some(item => item.to.startsWith('/admin/users') || item.to === '/admin/system'))
    assert.equal(items.some(item => item.to === '/admin/integrations'), role === 'manager')
  }
})

test('compact package copy retains explicit quantities and unknown/zero distinctions', () => {
  const settings = { design_posters_per_month: 4, photo_posts_per_month: 3, professional_videos_per_month: null, reels_per_month: 0 }
  assert.equal(mobilePackageSummary({ status: 'confirmed', settings }), '4 posters · 3 photos · some quantities unconfirmed')
  assert.equal(mobilePackageSummary({ status: 'unverified', settings }), 'Package needs review')
  assert.equal(mobilePackageSummary({ status: 'confirmed', settings: { design_posters_per_month: 0, photo_posts_per_month: 0, professional_videos_per_month: 0, reels_per_month: 0 } }), 'Package verified · view scope')
  assert.doesNotMatch(mobilePackageSummary({ status: 'confirmed', settings }), /0 reels|0 videos|premium|not included/i)
})

test('actual action-sheet lifecycle opens native modal, restores focus/scroll and dismisses safely', () => {
  const effects = []
  const calls = []
  const dialog = { showModal: () => calls.push('open'), close: () => calls.push('close') }
  class Element { isConnected = true; focus() { calls.push('focus') } }
  const oldDocument = globalThis.document
  const oldElement = globalThis.HTMLElement
  try {
    globalThis.HTMLElement = Element
    globalThis.document = { activeElement: new Element(), body: { style: { overflow: 'auto' } } }
    const { ActionSheet } = load('src/components/ui/ActionSheet.tsx', { react: { useRef: () => ({ current: dialog }), useId: () => 'sheet-title', useEffect: effect => effects.push(effect) } })
    let closes = 0
    const rendered = ActionSheet({ title: 'Example client', children: 'Actions', onClose: () => { closes++ } })
    assert.equal(rendered.type, 'dialog')
    assert.equal(rendered.props['aria-labelledby'], 'sheet-title')
    assert.equal(rendered.props['aria-modal'], 'true')
    const cleanup = effects[0]()
    assert.equal(globalThis.document.body.style.overflow, 'hidden')
    let prevented = false
    rendered.props.onCancel({ preventDefault() { prevented = true } })
    assert.equal(prevented, true)
    rendered.props.onClick({ target: 1, currentTarget: 2 })
    assert.equal(closes, 1, 'clicking content does not dismiss')
    rendered.props.onClick({ target: 1, currentTarget: 1 })
    assert.equal(closes, 2)
    cleanup()
    assert.equal(globalThis.document.body.style.overflow, 'auto')
    assert.deepEqual(calls, ['open', 'close', 'focus'])
  } finally {
    globalThis.document = oldDocument
    globalThis.HTMLElement = oldElement
  }
})

test('staff mobile forms prevent iOS zoom without disabling zoom or touching client styles', () => {
  const css = read('src/index.css')
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\[data-staff-shell\] input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)/)
  assert.match(css, /\[data-staff-shell\] textarea \{\s*font-size: 16px/)
  assert.doesNotMatch(read('index.html'), /user-scalable=no|maximum-scale=1/)
  const access = read('src/pages/admin/ClientAccessAdmin.tsx')
  assert.match(access, /if \(await provision\(managedRow\)\) setManageId\(null\)/)
  assert.match(access, /setConfirmation\('reset'\)/)
  assert.match(access, /setConfirmation\('disable'\)/)
  assert.match(access, /managedRow.provisioned && usernames\[managedRow.client_id\] === managedRow.username/)
})
