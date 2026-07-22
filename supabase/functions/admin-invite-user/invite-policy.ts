export const INVITABLE_ROLES = ['client', 'staff', 'manager'] as const

export type InvitableRole = typeof INVITABLE_ROLES[number]
export type InviteType = 'client' | 'workforce'

export interface ValidInviteRequest {
  email: string
  inviteType: InviteType
  role: InvitableRole
  clientId: string | null
}

export interface PendingInviteSummary {
  id: string
  role: string
  clientId: string | null
}

export interface AuthUserSummary {
  confirmed: boolean
  invited: boolean
}

export type InviteRequestResult =
  | { ok: true; value: ValidInviteRequest }
  | { ok: false; code: string; error: string }

export type InviteDeliveryDecision =
  | { ok: true; delivery: 'send' | 'resend'; createInvite: boolean }
  | { ok: false; code: string; error: string }

export type ClientAccessResult =
  | { ok: true }
  | { ok: false; code: string; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function isAdminRole(role: unknown): boolean {
  return role === 'admin'
}

export function parseInviteRequest(input: unknown): InviteRequestResult {
  const value = record(input)
  if (!value) return { ok: false, code: 'invalid_request', error: 'Invalid invitation request.' }

  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : ''
  const role = value.role
  const inviteType = value.inviteType
  const clientId = typeof value.clientId === 'string' && value.clientId.trim()
    ? value.clientId.trim()
    : null

  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, code: 'invalid_email', error: 'Enter a valid email address.' }
  }
  if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
    return { ok: false, code: 'invalid_role', error: 'That role cannot be invited.' }
  }
  if (inviteType !== 'client' && inviteType !== 'workforce') {
    return { ok: false, code: 'invalid_invite_type', error: 'Choose a valid invitation type.' }
  }
  if (role === 'client' && inviteType !== 'client') {
    return { ok: false, code: 'role_type_mismatch', error: 'Client access requires a client invitation.' }
  }
  if (role !== 'client' && inviteType !== 'workforce') {
    return { ok: false, code: 'role_type_mismatch', error: 'Staff and manager access require a workforce invitation.' }
  }
  if (role === 'client' && (!clientId || !UUID_PATTERN.test(clientId))) {
    return { ok: false, code: 'client_required', error: 'Select an active client for this invitation.' }
  }
  if (role !== 'client' && clientId !== null) {
    return { ok: false, code: 'client_not_allowed', error: 'Workforce invitations cannot be linked to a client.' }
  }

  return {
    ok: true,
    value: { email, inviteType, role, clientId },
  }
}

export function decideInviteDelivery(
  request: ValidInviteRequest,
  pendingInvite: PendingInviteSummary | null,
  authUser: AuthUserSummary | null,
): InviteDeliveryDecision {
  if (
    pendingInvite &&
    (pendingInvite.role !== request.role || (pendingInvite.clientId ?? null) !== request.clientId)
  ) {
    return {
      ok: false,
      code: 'pending_invite_conflict',
      error: 'A pending invitation already exists with different access. Revoke it before creating a new one.',
    }
  }

  if (authUser?.confirmed) {
    if (pendingInvite) {
      return {
        ok: false,
        code: 'confirmed_pending_setup',
        error: 'This account is confirmed but its invitation setup is still pending. Ask the user to sign in and choose Complete setup.',
      }
    }
    return {
      ok: false,
      code: 'already_registered',
      error: 'This email already belongs to a registered CG Dynamics user.',
    }
  }

  if (authUser && !authUser.invited) {
    return {
      ok: false,
      code: 'unconfirmed_signup',
      error: 'This email belongs to an unfinished account setup. Resolve that account before sending an invitation.',
    }
  }

  return {
    ok: true,
    delivery: authUser ? 'resend' : 'send',
    createInvite: pendingInvite === null,
  }
}

export function validateClientAccess(
  request: ValidInviteRequest,
  clientState: 'active' | 'inactive' | 'missing',
): ClientAccessResult {
  if (request.role !== 'client') return { ok: true }
  if (clientState === 'missing') {
    return { ok: false, code: 'client_not_found', error: 'The selected client no longer exists.' }
  }
  if (clientState === 'inactive') {
    return { ok: false, code: 'client_inactive', error: 'The selected client is inactive.' }
  }
  return { ok: true }
}
