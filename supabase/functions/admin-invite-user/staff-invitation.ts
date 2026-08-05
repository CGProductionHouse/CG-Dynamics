// Staff invitation policy (PR 5).
//
// Pure decision logic, kept out of index.ts so it can be tested without Deno,
// a database or a network. Nothing here sends anything; it decides what the
// caller is allowed to do and what a failure should say in plain language.

export const STAFF_ROLES = ['team', 'manager', 'admin'] as const
export type StaffRole = typeof STAFF_ROLES[number]

// 'staff' is an older spelling of the same role. Accepting it here and storing
// 'team' keeps one canonical value in the database, which is what the identity
// resolver and every permission check read.
const ROLE_ALIASES: Record<string, StaffRole> = {
  team: 'team',
  staff: 'team',
  manager: 'manager',
  admin: 'admin',
}

export type StaffInviteStatus =
  | 'pending' | 'sending' | 'sent' | 'accepted' | 'failed' | 'expired' | 'cancelled'

export const LIVE_STATUSES: StaffInviteStatus[] = ['pending', 'sending', 'sent']

export interface StaffInviteRequest {
  email: string
  role: StaffRole
  fullName: string | null
}

export interface Rejection { ok: false; code: string; error: string }
export type Parsed = { ok: true; value: StaffInviteRequest } | Rejection

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.length > 320) return null
  if (!EMAIL_PATTERN.test(trimmed)) return null
  return trimmed
}

export function emailDomain(email: string): string {
  return email.slice(email.indexOf('@') + 1)
}

export function emailLocalPart(email: string): string {
  return email.slice(0, email.indexOf('@'))
}

/**
 * Levenshtein distance, capped — used only to spot a mistyped domain against
 * domains this workspace already delivers to. It never rewrites the address;
 * it only produces a warning a human confirms.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = Array.from({ length: cols }, (_, i) => i)
  for (let i = 1; i < rows; i += 1) {
    const current = [i]
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[cols - 1]
}

/**
 * A domain that is ALMOST one of the workspace's known domains is very likely a
 * typo — `cgoroductionhouse.com` against `cgproductionhouse.com` is distance 2.
 * Returns the domain it was probably meant to be, or null.
 */
export function likelyDomainTypo(email: string, knownDomains: string[]): string | null {
  const domain = emailDomain(email)
  if (knownDomains.includes(domain)) return null
  let best: { domain: string; distance: number } | null = null
  for (const known of knownDomains) {
    const distance = editDistance(domain, known)
    // Allow roughly one edit per eight characters, never more than three.
    const budget = Math.min(3, Math.max(1, Math.floor(known.length / 8)))
    if (distance <= budget && (!best || distance < best.distance)) {
      best = { domain: known, distance }
    }
  }
  return best?.domain ?? null
}

export function parseStaffInviteRequest(body: unknown): Parsed {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'invalid_request', error: 'Invalid invitation request.' }
  }
  const value = body as Record<string, unknown>

  const email = normaliseEmail(value.email)
  if (!email) {
    return { ok: false, code: 'invalid_email', error: 'Enter a valid email address.' }
  }

  const rawRole = typeof value.role === 'string' ? value.role.trim().toLowerCase() : ''
  const role = ROLE_ALIASES[rawRole]
  if (!role) {
    return { ok: false, code: 'invalid_role', error: 'Choose a staff role: Staff, Manager or Admin.' }
  }

  const rawName = typeof value.fullName === 'string' ? value.fullName.trim() : ''
  const fullName = rawName.length > 0 ? rawName.slice(0, 120) : null

  return { ok: true, value: { email, role, fullName } }
}

export interface ExistingState {
  authUserExists: boolean
  activeProfile: { role: string; isActive: boolean; isClientAccount: boolean } | null
  liveInvitation: { id: string; status: StaffInviteStatus; role: StaffRole } | null
  duplicateIdentityForms: string[]
}

export type Decision =
  | { ok: true; action: 'create' }
  | { ok: true; action: 'retry'; invitationId: string }
  | Rejection

/**
 * Decides whether a new invitation may be created. Refusing here is what stops
 * a second account being made for somebody who already has one.
 */
export function decideStaffInvite(request: StaffInviteRequest, state: ExistingState): Decision {
  if (state.activeProfile?.isClientAccount) {
    return {
      ok: false,
      code: 'client_account_conflict',
      error: 'That address already belongs to a client account. A client login cannot be reused as a staff identity.',
    }
  }

  if (state.activeProfile && state.activeProfile.isActive) {
    return {
      ok: false,
      code: 'already_active',
      error: 'That person already has an active CG Dynamics account. Change their role instead of inviting them again.',
    }
  }

  const live = state.liveInvitation
  if (live) {
    // A failed invitation is retried in place; a live one is not duplicated.
    if (live.status === 'sent' || live.status === 'sending' || live.status === 'pending') {
      return {
        ok: false,
        code: 'invitation_already_live',
        error: 'An invitation to that address is already open. Resend or cancel it instead of creating another.',
      }
    }
  }

  if (state.authUserExists && !state.activeProfile) {
    // A sign-in exists but no profile — inviting again is the right repair.
    return { ok: true, action: 'create' }
  }

  return { ok: true, action: 'create' }
}

/**
 * Turns a provider error into something an operator can act on, without
 * discarding the original evidence (which is stored alongside in provider_result).
 */
export function describeDeliveryFailure(error: { status?: number; code?: string; message?: string }): {
  failureCode: string
  failureReason: string
} {
  const status = error.status ?? 0
  const code = (error.code ?? '').toLowerCase()

  if (status === 429 || code.includes('rate')) {
    return {
      failureCode: 'rate_limited',
      failureReason: 'The email provider is rate limiting invitations. Wait a few minutes and retry.',
    }
  }
  if (status === 422 || code.includes('already') || code.includes('registered')) {
    return {
      failureCode: 'already_registered',
      failureReason: 'That address is already registered in authentication. Check the existing account before inviting again.',
    }
  }
  if (status === 400 && code.includes('email')) {
    return {
      failureCode: 'invalid_email',
      failureReason: 'The email provider rejected that address. Check the spelling and try again.',
    }
  }
  if (status >= 500 || code.includes('smtp') || code.includes('send')) {
    return {
      failureCode: 'smtp_unavailable',
      failureReason: 'The email service did not accept the message. The invitation is saved and can be retried once email delivery is working.',
    }
  }
  return {
    failureCode: 'delivery_failed',
    failureReason: 'The invitation could not be sent. It is saved as failed and can be retried.',
  }
}
