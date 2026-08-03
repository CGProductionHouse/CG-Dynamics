import { isAdminRole, isManagerRole } from '../../lib/roles'

export type NavAccess = 'staff' | 'manager' | 'admin'

export type NavItem = {
  to: string
  label: string
  shortLabel: string
  marker: string
  access?: NavAccess
  activePaths?: string[]
  end?: boolean
}

export const primaryNavItems: NavItem[] = [
  { to: '/admin/cg-hub', label: 'Hub', shortLabel: 'Hub', marker: 'H', end: true },
  { to: '/admin/work', label: 'Work', shortLabel: 'Work', marker: 'W', activePaths: ['/admin/work', '/admin/my-work', '/admin/my-day', '/admin/command-centre', '/admin/planner'] },
  { to: '/admin/cg-calendar', label: 'CG Calendar', shortLabel: 'Calendar', marker: 'C', activePaths: ['/admin/cg-calendar', '/admin/company-calendar'] },
  { to: '/admin/client-schedule', label: 'Client Schedule', shortLabel: 'Schedule', marker: 'S', activePaths: ['/admin/client-schedule', '/admin/monthly-planner', '/admin/master-schedule'] },
  { to: '/admin/content', label: 'Content', shortLabel: 'Content', marker: 'CT', activePaths: ['/admin/content', '/admin/content-workflow', '/admin/full-content-guide'] },
  { to: '/admin/clients', label: 'Clients', shortLabel: 'Clients', marker: 'CL', activePaths: ['/admin/clients', '/admin/client-performance', '/admin/client-dashboard', '/admin/client-calendar'] },
]

// Client Performance zone — the client-intelligence surfaces, kept prominent and
// reachable via the Hub/Performance switcher without hiding daily Hub navigation.
export const performanceNavItems: NavItem[] = [
  { to: '/admin/client-performance', label: 'Performance Dashboard', shortLabel: 'Performance', marker: 'PD', activePaths: ['/admin/client-performance'] },
  { to: '/admin/clients', label: 'Clients', shortLabel: 'Clients', marker: 'CL', activePaths: ['/admin/clients', '/admin/client-dashboard'] },
  { to: '/admin/reports', label: 'Reports', shortLabel: 'Reports', marker: 'R', activePaths: ['/admin/reports', '/admin/reports/new'] },
  { to: '/admin/published', label: 'Client Preview', shortLabel: 'Preview', marker: 'CP', activePaths: ['/admin/published', '/admin/client-preview'] },
  { to: '/admin/integrations', label: 'Integrations', shortLabel: 'Integrations', marker: 'IN', access: 'manager', activePaths: ['/admin/integrations'] },
]

export type NavZone = 'hub' | 'performance'

// Routes that belong ONLY to the Performance zone. Landing on one auto-selects
// Performance; shared surfaces (e.g. Clients) never force a zone switch.
const PERFORMANCE_ONLY_PATHS = ['/admin/client-performance', '/admin/reports', '/admin/published', '/admin/integrations']
const SHARED_ZONE_PATHS = ['/admin/clients', '/admin/client-dashboard']

export function resolveNavZone(pathname: string): NavZone {
  return PERFORMANCE_ONLY_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`)) ? 'performance' : 'hub'
}

export function isSharedNavZonePath(pathname: string): boolean {
  return SHARED_ZONE_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

export const adminNavItems: NavItem[] = [
  { to: '/admin/integrations', label: 'Integrations', shortLabel: 'Integrations', marker: 'IN', access: 'manager', activePaths: ['/admin/integrations'] },
  { to: '/admin/planner-import', label: 'Planner Import', shortLabel: 'Planner', marker: 'PI', access: 'manager' },
  { to: '/admin/users', label: 'Users', shortLabel: 'Users', marker: 'U', access: 'admin', activePaths: ['/admin/users', '/admin/team', '/admin/invites'] },
  { to: '/admin/microsoft-import', label: 'Microsoft Sync', shortLabel: 'Microsoft', marker: 'MS', access: 'admin' },
  { to: '/admin/import-health', label: 'System Health', shortLabel: 'Health', marker: 'IH', access: 'admin', activePaths: ['/admin/import-health', '/admin/ai-health'] },
  { to: '/admin/marketing-library', label: 'Marketing Library', shortLabel: 'Library', marker: 'ML', access: 'admin' },
  { to: '/admin/marketing-ai', label: 'Marketing AI', shortLabel: 'Marketing AI', marker: 'AI', access: 'manager', activePaths: ['/admin/marketing-ai'] },
]

export function canShowNavItem(item: NavItem, role: string) {
  if (item.access === 'admin') return isAdminRole(role)
  if (item.access === 'manager') return isManagerRole(role)
  return true
}

export function isNavItemActive(pathname: string, item: NavItem) {
  const paths = item.activePaths ?? [item.to]
  return paths.some(path => item.end ? pathname === path : pathname === path || pathname.startsWith(`${path}/`))
}
