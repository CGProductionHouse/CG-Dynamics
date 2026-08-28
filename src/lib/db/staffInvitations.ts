import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'

// Staff invitations (PR 5). Separate from client invites by design — see
// supabase/migrations/20260806090000_staff_invitation_lifecycle.sql.

export type StaffInvitationStatus =
  | 'pending' | 'sending' | 'sent' | 'accepted' | 'failed' | 'expired' | 'cancelled'

export type StaffInvitationRole = 'team' | 'manager' | 'admin'

export interface StaffInvitation {
  id: string
  email: string
  intended_full_name: string | null
  intended_role: StaffInvitationRole
  status: StaffInvitationStatus
  invited_by: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  accepted_at: string | null
  expires_at: string
  cancelled_at: string | null
  failure_code: string | null
  failure_reason: string | null
  retry_count: number
  accepted_profile_id: string | null
}

/** Statuses that still need somebody to do something. */
export const OPEN_STATUSES: StaffInvitationStatus[] = ['pending', 'sending', 'sent', 'failed']

export const STATUS_LABELS: Record<StaffInvitationStatus, string> = {
  pending: 'Pending',
  sending: 'Sending',
  sent: 'Sent',
  accepted: 'Accepted',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export const ROLE_LABELS: Record<StaffInvitationRole, string> = {
  team: 'Staff',
  manager: 'Manager',
  admin: 'Admin',
}

interface InviteResponse {
  ok?: boolean
  invitationId?: string
  status?: StaffInvitationStatus
  code?: string
  error?: string
  suggestedDomain?: string
  enteredDomain?: string
}

/**
 * Reads the persisted staff invitations. This is the ONLY source the Pending
 * Invites view may use — the previous UI could report a saved invitation while
 * its list read a table the invitation was not in.
 */
export async function listStaffInvitations() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('staff_invitations')
      .select('id, email, intended_full_name, intended_role, status, invited_by, created_at, updated_at, sent_at, accepted_at, expires_at, cancelled_at, failure_code, failure_reason, retry_count, accepted_profile_id')
      .order('created_at', { ascending: false }),
    'Loading staff invitations took too long. Please try again.',
  )
  return { data: (data ?? []) as StaffInvitation[], error }
}

async function functionError(error: unknown, fallback: string): Promise<{ message: string; body: InviteResponse | null }> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context: unknown }).context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as InviteResponse
        if (body.error) return { message: body.error, body }
      } catch {
        // Fall through to the SDK error below.
      }
    }
  }
  if (error instanceof Error && error.message) return { message: error.message, body: null }
  return { message: fallback, body: null }
}

export async function sendStaffInvitation(input: {
  email: string
  role: StaffInvitationRole
  fullName: string | null
  /** Set to the entered domain to proceed past a suspected-typo warning. */
  acknowledgeDomain?: string
}) {
  const { data, error } = await supabase.functions.invoke<InviteResponse>('admin-invite-user', {
    body: {
      inviteType: 'workforce',
      email: input.email.trim().toLowerCase(),
      role: input.role,
      fullName: input.fullName,
      acknowledgeDomain: input.acknowledgeDomain,
    },
  })
  if (error) {
    const detail = await functionError(error, 'Could not send the invitation.')
    return { data: null, error: new Error(detail.message), detail: detail.body }
  }
  if (!data?.ok) {
    return { data: null, error: new Error(data?.error ?? 'Could not send the invitation.'), detail: data ?? null }
  }
  return { data, error: null, detail: null }
}

export async function resendStaffInvitation(invitationId: string) {
  const { data, error } = await supabase.functions.invoke<InviteResponse>('admin-invite-user', {
    body: { inviteType: 'workforce', invitationId },
  })
  if (error) {
    const detail = await functionError(error, 'Could not resend the invitation.')
    return { data: null, error: new Error(detail.message) }
  }
  if (!data?.ok) return { data: null, error: new Error(data?.error ?? 'Could not resend the invitation.') }
  return { data, error: null }
}

export async function cancelStaffInvitation(invitationId: string, reason?: string) {
  const { error } = await supabase.rpc('cancel_staff_invitation', {
    p_invitation_id: invitationId,
    p_reason: reason ?? null,
  })
  return { error }
}

export async function acceptStaffInvitation(fullName?: string) {
  const { data, error } = await supabase.rpc('accept_staff_invitation', {
    requested_full_name: fullName?.trim() || null,
  })
  return { data, error }
}

/** Moves anything past its expiry into 'expired'. Safe to call repeatedly. */
export async function expireStaffInvitations() {
  const { data, error } = await supabase.rpc('expire_staff_invitations')
  return { data: (data as number | null) ?? 0, error }
}
