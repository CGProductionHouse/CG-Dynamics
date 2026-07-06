export type AppRole = 'admin' | 'manager' | 'team' | 'client'

export const STAFF_ROLES: AppRole[] = ['admin', 'manager', 'team']
export const MANAGER_ROLES: AppRole[] = ['admin', 'manager']

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  team: 'Staff',
  client: 'Client',
}

export function isStaffRole(role: string | null | undefined): role is 'admin' | 'manager' | 'team' {
  return role === 'admin' || role === 'manager' || role === 'team'
}

export function isManagerRole(role: string | null | undefined): role is 'admin' | 'manager' {
  return role === 'admin' || role === 'manager'
}

export function isAdminRole(role: string | null | undefined): role is 'admin' {
  return role === 'admin'
}

export function roleLabel(role: string | null | undefined) {
  if (!role) return 'Staff'
  return ROLE_LABELS[role as AppRole] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

