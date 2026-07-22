import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'
import type { AppRole } from '../roles'

export type InviteStatus = 'pending' | 'accepted'
export type InviteRole = AppRole

export interface ClientInvite {
  id: string
  email: string
  client_id: string | null
  role: InviteRole
  status: InviteStatus
  created_by: string | null
  created_at: string
  accepted_at: string | null
}

interface AdminInviteResponse {
  ok?: boolean
  inviteId?: string
  delivery?: 'sent' | 'resent'
  code?: string
  error?: string
}

interface AcceptedInviteResult {
  invite_id: string
  role: InviteRole
  client_id: string | null
}

export async function listInvites() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_invites')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    'Loading invites took too long. Please try again.'
  )
  return { data: (data ?? []) as ClientInvite[], error }
}

async function functionError(error: unknown, fallback: string): Promise<Error> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = error.context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as AdminInviteResponse
        if (body.error) return new Error(body.error)
      } catch {
        // Fall back to the safe SDK error below.
      }
    }
  }
  if (error instanceof Error && error.message) return error
  return new Error(fallback)
}

export async function sendInvite(input: {
  email: string
  client_id: string | null
  role: InviteRole
}) {
  const { data, error } = await supabase.functions.invoke<AdminInviteResponse>('admin-invite-user', {
    body: {
      email: input.email.trim().toLowerCase(),
      inviteType: input.role === 'client' ? 'client' : 'workforce',
      role: input.role,
      clientId: input.role === 'client' ? input.client_id : null,
    },
  })
  if (error) return { data: null, error: await functionError(error, 'Could not send the invitation.') }
  if (!data?.ok) return { data: null, error: new Error(data?.error ?? 'Could not send the invitation.') }
  return { data, error: null }
}

export async function deleteInvite(id: string) {
  const { error } = await withRequestTimeout(
    supabase.from('client_invites').delete().eq('id', id),
    'Deleting the invite took too long. Please try again.'
  )
  return { error }
}

export async function acceptInvite(fullName?: string) {
  const { data, error } = await supabase.rpc('accept_invite', {
    requested_full_name: fullName?.trim() || null,
  })
  return { data: data as AcceptedInviteResult | null, error }
}

export async function validatePendingInvite() {
  const { error } = await supabase.rpc('validate_pending_invite')
  return { error }
}
