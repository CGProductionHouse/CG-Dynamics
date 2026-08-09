import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// App-shell information architecture (#182) + shared responsive layout system
// (#181). Source-contract checks — no database, no browser. The nav model and
// layout tokens are pure and could also be SSR-loaded, but parsing keeps this
// free of env dependencies.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const nav = read('../src/pages/admin/adminNavigation.ts')
const app = read('../src/App.tsx')
const layoutTokens = read('../src/lib/layout.ts')
const pageShell = read('../src/components/layout/PageShell.tsx')
const marketing = read('../src/pages/admin/MarketingWorkspacePage.tsx')
const system = read('../src/pages/admin/SystemHubPage.tsx')
const integrations = read('../src/pages/admin/IntegrationsPage.tsx')

// ── #182 Information architecture: grouped specialist nav ─────────────────────

test('daily navigation exposes no backend/specialist terminology', () => {
  const primary = nav.slice(nav.indexOf('export const primaryNavItems'), nav.indexOf('export const performanceNavItems'))
  for (const term of ['Microsoft Sync', 'Planner Import', 'System Health', 'Skill Card Review', 'Marketing Library', 'Marketing AI']) {
    assert.ok(!primary.includes(term), `daily nav must not expose "${term}"`)
  }
})

test('admin specialist tools are grouped under four parents, not separate top-level items', () => {
  const admin = nav.slice(nav.indexOf('export const adminNavItems'))
  // The four grouped parents.
  assert.match(admin, /to: '\/admin\/integrations', label: 'Integrations'[^}]*access: 'manager'/)
  assert.match(admin, /to: '\/admin\/marketing', label: 'Marketing'[^}]*access: 'manager'/)
  assert.match(admin, /to: '\/admin\/users', label: 'Users'[^}]*access: 'admin'/)
  assert.match(admin, /to: '\/admin\/system', label: 'System'[^}]*access: 'admin'/)
  // The former separate entries are gone as their own `to:` destinations.
  for (const gone of ['/admin/microsoft-import', '/admin/planner-import', '/admin/import-health', '/admin/marketing-library', '/admin/marketing-ai', '/admin/skill-card-review']) {
    assert.ok(!admin.includes(`to: '${gone}'`), `${gone} must not be its own top-level admin entry`)
  }
})

test('grouped parents keep their children highlighted via activePaths', () => {
  const admin = nav.slice(nav.indexOf('export const adminNavItems'))
  assert.match(admin, /to: '\/admin\/integrations'[^}]*'\/admin\/microsoft-import'[^}]*'\/admin\/planner-import'/)
  assert.match(admin, /to: '\/admin\/marketing'[^}]*'\/admin\/marketing-library'[^}]*'\/admin\/marketing-ai'[^}]*'\/admin\/skill-card-review'/)
  assert.match(admin, /to: '\/admin\/system'[^}]*'\/admin\/import-health'[^}]*'\/admin\/ai-health'/)
})

// ── #182 Routes: parents added, children + deep links preserved ──────────────

test('Marketing parent route is manager-gated; children preserved', () => {
  assert.match(app, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
  assert.match(app, /path="\/admin\/marketing-library" element=\{<MarketingLibraryPage \/>\}/)
  assert.match(app, /path="\/admin\/marketing-ai" element=\{<MarketingAiDepartmentPage \/>\}/)
  assert.match(app, /path="\/admin\/skill-card-review" element=\{<SkillCardReviewPage \/>\}/)
})

test('System parent route is admin-gated; health children preserved', () => {
  assert.match(app, /path="\/admin\/system" element=\{<SystemHubPage \/>\}/)
  assert.match(app, /path="\/admin\/import-health" element=\{<ImportHealthPage \/>\}/)
  assert.match(app, /path="\/admin\/ai-health" element=\{<AiUsageHealthPage \/>\}/)
})

test('Marketing workspace links to each grouped child', () => {
  assert.match(marketing, /\/admin\/marketing-library/)
  assert.match(marketing, /\/admin\/marketing-ai/)
  assert.match(marketing, /\/admin\/skill-card-review/)
  // Admin-only areas gate on role, not just hidden nav.
  assert.match(marketing, /isAdminRole\(profile\?\.role\)/)
})

test('System hub links to the health tools', () => {
  assert.match(system, /\/admin\/import-health/)
  assert.match(system, /\/admin\/ai-health/)
})

test('Integrations hub reaches Microsoft and Planner Import', () => {
  assert.match(integrations, /\/admin\/microsoft-import/)
  assert.match(integrations, /\/admin\/planner-import/)
})

// ── #181 Shared responsive layout system ─────────────────────────────────────

test('layout tokens define one shared gutter, widths and container helper', () => {
  assert.match(layoutTokens, /export const PAGE_GUTTER = 'px-4 sm:px-6 lg:px-8'/)
  assert.match(layoutTokens, /export const PAGE_MAX_WIDTH = \{/)
  assert.match(layoutTokens, /export function pageContainerClass/)
  // The container guards against horizontal overflow (min-w-0) and centres.
  assert.match(layoutTokens, /min-w-0/)
})

test('layout tokens do not use blanket overflow-x hidden as a fix', () => {
  assert.ok(!/overflow-x:\s*hidden/.test(layoutTokens) && !layoutTokens.includes('overflow-x-hidden'), 'no blanket overflow-x hidden')
})

test('shared page primitives exist and consume the tokens', () => {
  assert.match(pageShell, /export function PageContainer/)
  assert.match(pageShell, /export function PageHeader/)
  assert.match(pageShell, /export function Section/)
  assert.match(pageShell, /export function Toolbar/)
  assert.match(pageShell, /from '\.\.\/\.\.\/lib\/layout'/)
})

test('the new hub pages and Integrations consume the shared container', () => {
  for (const [name, src] of [['Marketing', marketing], ['System', system], ['Integrations', integrations]]) {
    assert.match(src, /<PageContainer/, `${name} uses PageContainer`)
    assert.match(src, /<PageHeader/, `${name} uses PageHeader`)
  }
})
