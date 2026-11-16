import { primaryNavItems, performanceNavItems, adminNavItems, canShowNavItem, type NavItem } from '../pages/admin/adminNavigation'

// Same canonical routes and role gates as desktop. Mobile shows both workspaces
// together so Users/System never disappear merely because Performance is open.
export function mobileNavigationGroups(role: string, query = '') {
  const needle = query.trim().toLocaleLowerCase()
  const seen = new Set<string>()
  const groups = [
    { label: 'Daily work', items: primaryNavItems.filter(item => !['/admin/clients', '/admin/command-centre#morning-import'].includes(item.to)) },
    { label: 'Clients & reporting', items: performanceNavItems.filter(item => item.to !== '/admin/integrations') },
    { label: 'Administration', items: [
      { to: '/admin/users?tab=client-access', label: 'Client logins', shortLabel: 'Logins', marker: 'CL', access: 'admin' } as NavItem,
      ...adminNavItems,
    ] },
  ]
  return groups.map(group => ({ ...group, items: group.items.filter(item => {
    if (!canShowNavItem(item, role) || seen.has(item.to)) return false
    seen.add(item.to)
    const searchable = `${item.label} ${item.shortLabel} ${item.to.includes('client-access') ? 'password access login' : ''}`.toLocaleLowerCase()
    return !needle || searchable.includes(needle)
  }) })).filter(group => group.items.length > 0)
}
