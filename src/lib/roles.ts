export type AppRole = 'admin' | 'manager' | 'staff' | 'team' | 'client'

export const STAFF_ROLES: AppRole[] = ['admin', 'manager', 'staff', 'team']
export const MANAGER_ROLES: AppRole[] = ['admin', 'manager']

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  team: 'Staff',
  client: 'Client',
}

export function isStaffRole(role: string | null | undefined): role is 'admin' | 'manager' | 'staff' | 'team' {
  return role === 'admin' || role === 'manager' || role === 'staff' || role === 'team'
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

