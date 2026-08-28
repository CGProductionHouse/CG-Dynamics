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
const usersHub = read('../src/pages/admin/UsersHub.tsx')
const plannerImport = read('../src/pages/admin/PlannerImportPage.tsx')
const ADMIN_PAGE_FILES = [
  'CgHubPage', 'MyWorkPage', 'OpsHubPage', 'ContentWorkflowPage', 'MarketingLibraryPage',
  'MicrosoftImportPage', 'GoogleAdsIntegrationPage', 'MetaIntegrationPage', 'IntegrationsPage',
  'UsersHub', 'PlannerImportPage', 'ImportHealthPage', 'AiUsageHealthPage', 'PackageMasterPage',
  'CompanyCalendarPage', 'ClientSchedulePage', 'CommandCentrePage',
].map(name => [name, read(`../src/pages/admin/${name}.tsx`)])

// ── #182 Information architecture: grouped specialist nav ─────────────────────

test('daily navigation exposes no backend/specialist terminology', () => {
  const primary = nav.slice(nav.indexOf('export const primaryNavItems'), nav.indexOf('export const performanceNavItems'))
  for (const term of ['Microsoft Sync', 'Planner Import', 'System Health', 'Skill Card Review', 'Marketing Library', 'Marketing AI']) {
    assert.ok(!primary.includes(term), `daily nav must not expose "${term}"`)
  }
})

test('specialist admin tools are grouped under parents; Marketing is a staff destination', () => {
  const admin = nav.slice(nav.indexOf('export const adminNavItems'))
  const primary = nav.slice(nav.indexOf('export const primaryNavItems'), nav.indexOf('export const performanceNavItems'))
  // Admin-group parents.
  assert.match(admin, /to: '\/admin\/integrations', label: 'Integrations'[^}]*access: 'manager'/)
  assert.match(admin, /to: '\/admin\/users', label: 'Users'[^}]*access: 'admin'/)
  assert.match(admin, /to: '\/admin\/system', label: 'System'[^}]*access: 'admin'/)
  // Marketing is a staff daily destination (no access gate), not in the admin group.
  assert.match(primary, /to: '\/admin\/marketing', label: 'Marketing'/)
  assert.ok(!/to: '\/admin\/marketing'/.test(admin), 'Marketing must not be an admin-group entry')
  // The former separate specialist entries are gone as their own `to:` destinations.
  for (const gone of ['/admin/microsoft-import', '/admin/planner-import', '/admin/import-health', '/admin/marketing-library', '/admin/marketing-ai', '/admin/skill-card-review']) {
    assert.ok(!admin.includes(`to: '${gone}'`), `${gone} must not be its own top-level admin entry`)
  }
})

test('grouped parents keep their children highlighted via activePaths', () => {
  const admin = nav.slice(nav.indexOf('export const adminNavItems'))
  const primary = nav.slice(nav.indexOf('export const primaryNavItems'), nav.indexOf('export const performanceNavItems'))
  assert.match(admin, /to: '\/admin\/integrations'[^}]*'\/admin\/microsoft-import'[^}]*'\/admin\/planner-import'/)
  assert.match(primary, /to: '\/admin\/marketing'[^}]*'\/admin\/marketing-library'[^}]*'\/admin\/marketing-ai'[^}]*'\/admin\/skill-card-review'/)
  assert.match(admin, /to: '\/admin\/system'[^}]*'\/admin\/import-health'[^}]*'\/admin\/ai-health'/)
})

// ── #182 Routes: parents added, children + deep links preserved ──────────────

test('Marketing workspace route is staff-accessible; children preserved', () => {
  assert.match(app, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
  // Not nested under RequireManager/RequireAdmin — staff can search approved knowledge.
  const marketingIdx = app.indexOf('path="/admin/marketing"')
  const managerIdx = app.indexOf('<Route element={<RequireManager />}>')
  assert.ok(marketingIdx < managerIdx, 'Marketing route sits at staff level, before the manager block')
  assert.match(app, /path="\/admin\/marketing-library" element=\{<MarketingLibraryPage \/>\}/)
  assert.match(app, /path="\/admin\/marketing-ai" element=\{<MarketingAiDepartmentPage \/>\}/)
  assert.match(app, /path="\/admin\/skill-card-review" element=\{<SkillCardReviewPage \/>\}/)
})

test('System parent route is admin-gated; health children preserved', () => {
  assert.match(app, /path="\/admin\/system" element=\{<SystemHubPage \/>\}/)
  assert.match(app, /path="\/admin\/import-health" element=\{<ImportHealthPage \/>\}/)
  assert.match(app, /path="\/admin\/ai-health" element=\{<AiUsageHealthPage \/>\}/)
})

test('Marketing workspace consolidates sections in-page and links AI + review', () => {
  // Library/Sources/Review/Registration are in-page sections; AI + review link out.
  assert.match(marketing, /\/admin\/marketing-ai/)
  assert.match(marketing, /\/admin\/skill-card-review/)
  // Admin-only sections gate on role, not just hidden nav.
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

// ── #181 rollout: adoption + gutter defects removed ──────────────────────────

test('the content (max-w-6xl) width token exists so page widths are preserved on conversion', () => {
  assert.match(layoutTokens, /content: 'max-w-6xl'/)
})

test('converted admin pages consume PageContainer instead of a bespoke wrapper', () => {
  assert.match(usersHub, /<PageContainer/)
  assert.match(plannerImport, /<PageContainer/)
})

test('no authenticated admin page uses the off-standard lg:px-10 page gutter', () => {
  for (const [name, src] of ADMIN_PAGE_FILES) {
    assert.ok(!src.includes('lg:px-10'), `${name} must use the standard lg:px-8 gutter`)
  }
})

test('no admin page uses a bare p-4 sm:p-6 lg:p-8 page wrapper (non-standard gutter)', () => {
  for (const [name, src] of ADMIN_PAGE_FILES) {
    assert.ok(!src.includes('className="p-4 sm:p-6 lg:p-8"'), `${name} must use the standard px gutter`)
    assert.ok(!src.includes('className="w-full max-w-7xl p-4 sm:p-6 lg:p-8"'), `${name} must use the standard px gutter`)
  }
})

// ── #182 Integrations / System overlap resolved ──────────────────────────────

test('System is diagnostics-only — provider setup (Microsoft) lives under Integrations', () => {
  assert.ok(!system.includes('/admin/microsoft-import'), 'System must not link Microsoft setup')
  assert.match(system, /\/admin\/import-health/)
  assert.match(system, /\/admin\/ai-health/)
  assert.match(integrations, /\/admin\/microsoft-import/)
})
