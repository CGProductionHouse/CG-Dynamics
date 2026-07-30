import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const adminNav = read('../src/pages/admin/adminNavigation.ts')
const layout = read('../src/pages/admin/AdminLayout.tsx')
const contentWorkflow = read('../src/pages/admin/ContentWorkflowPage.tsx')
const fullGuide = read('../src/pages/admin/FullContentGuidePage.tsx')
const contentOverview = read('../src/pages/admin/ContentOverview.tsx')
const usersHub = read('../src/pages/admin/UsersHub.tsx')
const hub = read('../src/pages/admin/CgHubPage.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')
const calendar = read('../src/pages/admin/CompanyCalendarPage.tsx')
const schedule = read('../src/pages/admin/ClientSchedulePage.tsx')
const contentTab = read('../src/pages/admin/contentTabTypes.ts')

// ── Navigation model ────────────────────────────────────────────────────────

test('primaryNavItems has exactly six destinations', () => {
  assert.match(adminNav, /export const primaryNavItems: NavItem\[\] = \[/)
  const labels = ['Hub', 'Work', 'CG Calendar', 'Client Schedule', 'Content', 'Clients']
  for (const label of labels) {
    assert.ok(adminNav.includes(`label: '${label}'`), `primaryNavItems includes ${label}`)
  }
})

test('primaryNavItems uses /admin/content as unified path', () => {
  const contentEntry = adminNav.match(/\{[^}]*'\/admin\/content'[^}]*\}/)?.[0]
  assert.ok(contentEntry, 'primaryNavItems content entry exists')
  assert.ok(contentEntry.includes("/admin/content", "'/admin/content' in entry"))
  assert.ok(contentEntry.includes("/admin/content-workflow"), 'legacy content-workflow in activePaths')
  assert.ok(contentEntry.includes("/admin/full-content-guide"), 'legacy full-content-guide in activePaths')
})

test('adminNavItems has exactly six items with correct access levels', () => {
  assert.match(adminNav, /export const adminNavItems: NavItem\[\] = \[/)
  assert.ok(adminNav.includes("access: 'manager'"), 'manager-gated items exist')
  assert.ok(adminNav.includes("access: 'admin'"), 'admin-gated items exist')
  assert.ok(adminNav.includes("label: 'Users'"), 'Users label used, not Team')
})

test('canShowNavItem gates correctly by role', () => {
  assert.match(adminNav, /if \(item\.access === 'admin'\) return isAdminRole\(role\)/)
  assert.match(adminNav, /if \(item\.access === 'manager'\) return isManagerRole\(role\)/)
  assert.match(adminNav, /return true/)
})

test('isNavItemActive supports activePaths and end flag', () => {
  assert.match(adminNav, /const paths = item\.activePaths \?\? \[item\.to\]/)
  assert.match(adminNav, /item\.end \? pathname === path : pathname === path \|\| pathname\.startsWith/)
})

// ── Route structure ─────────────────────────────────────────────────────────

test('/admin/content route renders ContentWorkflowPage with overview defaultTab', () => {
  assert.match(app, /path="\/admin\/content" element=\{<ContentWorkflowPage defaultTab="overview" \/>\}/)
})

test('legacy content-workflow route maps to library tab', () => {
  assert.match(app, /path="\/admin\/content-workflow" element=\{<ContentWorkflowPage defaultTab="library" \/>\}/)
})

test('legacy full-content-guide route maps to guidelines tab', () => {
  assert.match(app, /path="\/admin\/full-content-guide" element=\{<ContentWorkflowPage defaultTab="guidelines" \/>\}/)
})

test('/admin/team redirects to /admin/users route group', () => {
  assert.match(app, /path="\/admin\/team" element=\{<UsersHub \/>\}/)
})

test('/admin/invites redirects to /admin/users?tab=invites', () => {
  assert.match(app, /path="\/admin\/invites" element=\{<Navigate to="\/admin\/users\?tab=invites" replace \/>\}/)
})

test('Assistant route preserved at /admin/assistant', () => {
  assert.match(app, /path="\/admin\/assistant" element=\{<AssistantPage \/>\}/)
})

test('Integrations routes are manager-gated under RequireManager', () => {
  assert.match(app, /<Route element=\{<RequireManager \/>\}>/)
  assert.match(app, /path="\/admin\/integrations" element=\{<IntegrationsPage \/>\}/)
  assert.match(app, /path="\/admin\/integrations\/meta" element=\{<MetaIntegrationPage \/>\}/)
  assert.match(app, /path="\/admin\/integrations\/google-ads" element=\{<GoogleAdsIntegrationPage \/>\}/)
})

test('Hub renders core work before optional content counters finish', () => {
  assert.match(hub, /listTasks\(\{ activeOnly: true \}\)/)
  assert.match(hub, /setMyDayContext\(myDay\)\s+setLoadingData\(false\)/)
  assert.match(hub, /Promise\.all\(\[listRuns\(\), listPipelineVideos\(\)\]\)/)
})

test('Hub client attention combines tasks and canonical schedule work', () => {
  assert.match(hub, /listActiveClients\(\)/)
  assert.match(hub, /item\.waitingDeliverables\+\+/)
  assert.match(hub, /item\.unscheduledItems\+\+/)
  assert.match(hub, /client-schedule\?client=\$\{encodeURIComponent\(client\.clientId\)\}&mode=needs-action/)
  assert.match(hub, /\{client\.waitingDeliverables\} awaiting review/)
  assert.match(hub, /\{client\.unscheduledItems\} unscheduled/)
})
test('Admin-only routes are gated under RequireAdmin', () => {
  assert.match(app, /<Route element=\{<RequireAdmin \/>\}>/)
  assert.match(app, /path="\/admin\/users" element=\{<UsersHub \/>\}/)
  assert.match(app, /path="\/admin\/import-health" element=\{<ImportHealthPage \/>\}/)
  assert.match(app, /path="\/admin\/marketing-library" element=\{<MarketingLibraryPage \/>\}/)
})

// ── Users heading ───────────────────────────────────────────────────────────

test('UsersHub heading says "Users" not "Team"', () => {
  assert.match(usersHub, /<h1[^>]*>Users<\/h1>/)
  assert.ok(!usersHub.includes('>Team<') || usersHub.includes('Teams'), 'no "Team" heading')
})

// ── ContentTab types ────────────────────────────────────────────────────────

test('contentTabTypes exports ContentTab type and resolveContentTab function', () => {
  assert.match(contentTab, /export type ContentTab =/)
  assert.match(contentTab, /export function resolveContentTab/)
  assert.ok(contentTab.includes("'overview'"), 'overview tab')
  assert.ok(contentTab.includes("'runs'"), 'runs tab')
  assert.ok(contentTab.includes("'guidelines'"), 'guidelines tab')
  assert.ok(contentTab.includes("'pipeline'"), 'pipeline tab')
  assert.ok(contentTab.includes("'library'"), 'library tab')
})

test('resolveContentTab maps old guides label to library', () => {
  assert.match(contentTab, /if \(value === 'guides'\) return 'library'/)
})

// ── Content Workflow Page ───────────────────────────────────────────────────

test('ContentWorkflowPage imports from contentTabTypes', () => {
  assert.match(contentWorkflow, /import.*resolveContentTab.*from '\.\/contentTabTypes'/)
  assert.match(contentWorkflow, /import.*type ContentTab.*from '\.\/contentTabTypes'/)
})

test('ContentWorkflowPage enforces client-before-guideline rule', () => {
  assert.match(contentWorkflow, /One canonical Content Guideline document per Content Run/)
  assert.match(contentWorkflow, /if \(!selectedRun\.client_id\)/)
  assert.match(contentWorkflow, /Assign a real client to this Content Run/)
  assert.match(contentWorkflow, /Client ownership is never guessed/)
})

test('ContentOverview surfaces missing-runs and missing-client attention items', () => {
  assert.match(contentOverview, /Content Guideline has not been created/)
  assert.match(contentOverview, /Content Run needs an explicit client link/)
})

// ── Full Content Guide Page ─────────────────────────────────────────────────

test('FullContentGuidePage accepts embedded prop', () => {
  assert.match(fullGuide, /export default function FullContentGuidePage\(\{ embedded = false \}/)
  assert.match(fullGuide, /embedded \? 'mt-6' :/)
})

test('FullContentGuidePage internal links point to /admin/content', () => {
  assert.match(fullGuide, /\/admin\/content\?tab=runs/)
  assert.match(fullGuide, /\/admin\/content\?tab=runs&event=/)
  assert.match(fullGuide, /\/admin\/content\?tab=runs&run=/)
})

// ── Cross-links to Content ──────────────────────────────────────────────────

test('Hub page links to /admin/content with pipeline and runs tabs', () => {
  assert.match(hub, /\/admin\/content\?tab=pipeline/)
  assert.match(hub, /\/admin\/content\?tab=runs/)
  assert.match(hub, /\/admin\/content\?tab=runs&run=/)
})

test('MyWorkPage links to /admin/content with pipeline and runs tabs', () => {
  assert.match(work, /\/admin\/content\?tab=pipeline/)
  assert.match(work, /\/admin\/content\?tab=runs/)
  assert.match(work, /\/admin\/content\?tab=runs&run=/)
})

test('CompanyCalendarPage links to /admin/content with runs tab and event param', () => {
  assert.match(calendar, /\/admin\/content\?tab=runs&event=/)
})

test('ClientSchedulePage links to /admin/content with guidelines and library tabs', () => {
  assert.match(schedule, /\/admin\/content\?tab=guidelines&guideline=/)
  assert.match(schedule, /\/admin\/content\?tab=library&guide=/)
})

// ── Mobile navigation ───────────────────────────────────────────────────────

test('AdminLayout has mobile drawer and quick nav bar', () => {
  assert.match(layout, /mobileMenuOpen/)
  assert.match(layout, /staff-mobile-navigation/)
  assert.match(layout, /Primary mobile navigation/)
  assert.match(layout, /MobileNavItem/)
})

test('AdminLayout has collapsible desktop sidebar', () => {
  assert.match(layout, /desktopCollapsed/)
  assert.match(layout, /w-20.*w-60/)
})

// ── Content Overview ────────────────────────────────────────────────────────

test('ContentOverview has five filter controls and section structure', () => {
  assert.match(contentOverview, /updateFilter/)
  assert.ok(contentOverview.includes('client'), 'client filter')
  assert.ok(contentOverview.includes('filteredRuns'), 'run filtering')
  assert.ok(contentOverview.includes('attentionItems'), 'attention queue')
  assert.ok(contentOverview.includes('RunCard'), 'run cards')
  assert.ok(contentOverview.includes('GuidelineCard'), 'guideline cards')
})
