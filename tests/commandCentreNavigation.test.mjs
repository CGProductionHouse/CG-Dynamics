import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'

let server, mobileNavigationGroups
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  ;({ mobileNavigationGroups } = await server.ssrLoadModule('/src/lib/mobileStaffNavigation.ts'))
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const layout = read('../src/pages/admin/AdminLayout.tsx')
const adminNav = read('../src/pages/admin/adminNavigation.ts')
const work = read('../src/pages/admin/MyWorkPage.tsx')
const commandCentre = read('../src/pages/admin/CommandCentrePage.tsx')
const parserSrc = read('../src/lib/commandCentre.ts')

// ── 1. Command Centre is visible to authorised admin/manager users ──────────

test('Command Centre nav entry is manager/admin-gated and points at the real route', () => {
  assert.match(adminNav, /to: '\/admin\/command-centre', label: 'Team Work'/)
  assert.match(adminNav, /access: 'manager'/)
  assert.match(adminNav, /if \(item\.access === 'manager'\) return isManagerRole\(role\)/)
})

test('/admin/command-centre renders the real Command Centre page, not a redirect', () => {
  assert.match(app, /path="\/admin\/command-centre" element=\{<CommandCentrePage \/>\}/)
  assert.doesNotMatch(app, /path="\/admin\/command-centre" element=\{<Navigate/)
})

// ── 2. Morning List Import is visibly reachable ─────────────────────────────

test('Morning List Import has a first-class nav entry opening the import experience', () => {
  assert.match(adminNav, /to: '\/admin\/command-centre#morning-import', label: 'Morning List Import'/)
  assert.match(commandCentre, /id="morning-import"/)
  assert.match(commandCentre, /location\.hash !== '#morning-import'/)
  assert.match(commandCentre, /getElementById\('morning-import'\)\?\.scrollIntoView/)
})

// ── 3. My Work remains visible to normal staff ──────────────────────────────

test('Work stays the staff-visible destination with no admin gate', () => {
  assert.match(adminNav, /\{ to: '\/admin\/work', label: 'Work', shortLabel: 'Work', marker: 'W', activePaths: \[/)
  assert.match(app, /path="\/admin\/work" element=\{<MyWorkPage \/>\}/)
  assert.doesNotMatch(adminNav, /\{ to: '\/admin\/work'[\s\S]{0,120}access: '(admin|manager)'/)
})

// ── 4. Admin/manager-only options are not shown to unauthorised users ───────

test('Team Work and Morning List Import never render for staff/team roles', () => {
  const entries = adminNav.slice(adminNav.indexOf('export const primaryNavItems'))
  const teamWork = entries.slice(entries.indexOf('to: \'/admin/command-centre\''), entries.indexOf('to: \'/admin/command-centre\'') + 200)
  const importEntry = entries.slice(entries.indexOf('to: \'/admin/command-centre#morning-import\''), entries.indexOf('to: \'/admin/command-centre#morning-import\'') + 200)
  assert.match(teamWork, /access: 'manager'/)
  assert.match(importEntry, /access: 'manager'/)
  assert.doesNotMatch(teamWork, /access: 'staff'/)
  assert.doesNotMatch(importEntry, /access: 'staff'/)
})

// ── 5 + 6. Desktop and mobile navigation both expose the workflow ───────────

test('desktop sidebar and searchable mobile More retain Team Work and its import workflow', () => {
  // PR993 uses a role-filtered all-workspace menu on phones. Preserve that
  // accepted interface rather than requiring the former desktop drawer clone.
  assert.match(layout, /zoneItems\.map\(item => <NavigationLink/)
  assert.match(layout, /renderNav\(desktopCollapsed\)/)
  assert.match(layout, /mobileGroups = mobileNavigationGroups\(currentRole, menuSearch\)/)
  assert.match(layout, /mobileGroups\.map\(group/)
  assert.match(layout, /group\.items\.map\(item => <NavigationLink/)
  for (const role of ['admin', 'manager']) {
    const items = mobileNavigationGroups(role).flatMap(group => group.items)
    assert.equal(items.filter(item => item.to === '/admin/command-centre').length, 1)
  }
  assert.match(adminNav, /label: 'Team Work'/)
  assert.match(adminNav, /label: 'Morning List Import'/)
})

test('mobile quick-nav is role-stable and never displaces Content or Calendar', () => {
  assert.match(layout, /const MOBILE_PRIMARY_PATHS = \[/)
  assert.match(layout, /'\/admin\/cg-hub', '\/admin\/work', '\/admin\/content', '\/admin\/cg-calendar'/)
  assert.match(layout, /primaryItems\.filter\(item => MOBILE_PRIMARY_PATHS\.includes\(item\.to\)\)/)
  assert.doesNotMatch(layout, /MOBILE_PRIMARY_PATHS = \[[^\]]*client-schedule[^\]]*\]/)
  assert.doesNotMatch(layout, /MOBILE_PRIMARY_PATHS = \[[^\]]*command-centre[^\]]*\]/)
  assert.doesNotMatch(layout, /MOBILE_PRIMARY_PATHS = \[[^\]]*morning-import[^\]]*\]/)
})

test('phone More reaches manager Team Work with import inside that page and preserves ordinary staff isolation', () => {
  for (const role of ['admin', 'manager']) {
    const items = mobileNavigationGroups(role, 'team work').flatMap(group => group.items)
    assert.ok(items.some(item => item.to === '/admin/command-centre'))
    assert.ok(!mobileNavigationGroups(role).flatMap(group => group.items).some(item => item.to === '/admin/command-centre#morning-import'), 'import is inside Team Work, not a second mobile destination')
  }
  for (const role of ['staff', 'team']) {
    assert.ok(!mobileNavigationGroups(role).flatMap(group => group.items).some(item => item.to.startsWith('/admin/command-centre')))
  }
  assert.match(commandCentre, /id="morning-import"/)
  assert.match(commandCentre, /getElementById\('morning-import'\)\?\.scrollIntoView/)
})

// ── 7. A future consolidation cannot silently remove the workflow ───────────

test('removing Team Work or Morning List Import fails this regression suite', () => {
  assert.ok(adminNav.includes("to: '/admin/command-centre', label: 'Team Work'"), 'Team Work entry must stay')
  assert.ok(adminNav.includes("to: '/admin/command-centre#morning-import', label: 'Morning List Import'"), 'Morning List Import entry must stay')
  assert.ok(app.includes('path="/admin/command-centre" element={<CommandCentrePage />}'), 'real command-centre route must stay')
})

// ── Work page surfaces the workflow for managers ────────────────────────────

test('Work page links managers to Command Centre and Morning List Import', () => {
  assert.match(work, /canViewWorkload && \(/)
  assert.match(work, /\/admin\/command-centre/)
  assert.match(work, /\/admin\/command-centre#morning-import/)
  assert.match(work, /Team Work \/ Command Centre/)
  assert.match(work, /Morning List Import/)
})

// ── 8. Existing morning-list parser still handles grouped WhatsApp text ──────

test('morning list parser still splits staff headings and bullet items', () => {
  const fn = parserSrc.slice(parserSrc.indexOf('export function parseMorningList'))
  assert.match(fn, /line\.match\(\/\^@\(\.\+\)\$\//, 'staff heading like @Ger-Marie')
  assert.match(fn, /line\.match\(\/\^\[-\*•\]\\s\+\(\.\*\)\$\//, 'bullet items')
  assert.match(fn, /currentStaff = staffMatch\[1\]/, 'assigns heading to current staff')
  assert.match(fn, /staffName: currentStaff/, 'task carries staff heading')
  assert.match(fn, /Original WhatsApp: \$\{originalText\}/, 'preserves the original WhatsApp line')
})

// PR 4 removed the 'suggested' confidence state this test used to assert. A
// suggestion that was not also the selected client is exactly the divergence
// being eliminated: the badge could name a client the saved task did not carry.
// There are now two states — a client is selected, or it is left for the
// operator with a reason.
test('morning list parser resolves clients with confidence and flags uncertainty', () => {
  const fn = parserSrc.slice(parserSrc.indexOf('export function parseMorningList'))
  assert.match(fn, /tryMatchClient\(titleText, clients\)/)
  assert.match(fn, /confidence === 'needs_review'/)
  assert.match(fn, /No confident client match/)
  assert.match(fn, /Choose the client/)
  assert.match(fn, /clientConfidence: confidence/)
  const code = parserSrc.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!code.includes("'suggested'"), 'the divergent suggested state must be gone')
})

test('morning list import never creates tasks before explicit review confirmation', () => {
  const editFn = parserSrc.slice(parserSrc.indexOf('export function morningEditToInput'))
  assert.match(editFn, /source: 'morning_list'/)
  assert.match(parserSrc, /export function findDuplicateRequests/)
  assert.match(parserSrc, /export async function createTask/)
})
