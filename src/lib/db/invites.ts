import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'

export type InviteStatus = 'pending' | 'accepted'
export type InviteRole = 'admin' | 'team' | 'client'

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

export async function createInvite(input: {
  email: string
  client_id: string | null
  role: InviteRole
  created_by: string | null
}) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_invites')
      .insert({
        email: input.email.trim().toLowerCase(),
        // Team/admin invites are global and not tied to a client.
        client_id: input.role === 'client' ? input.client_id : null,
        role: input.role,
        created_by: input.created_by,
      })
      .select()
      .single(),
    'Saving the invite took too long. Please try again.'
  )
  return { data: data as ClientInvite | null, error }
}

export async function deleteInvite(id: string) {
  const { error } = await withRequestTimeout(
    supabase.from('client_invites').delete().eq('id', id),
    'Deleting the invite took too long. Please try again.'
  )
  return { error }
}

// Security-definer RPC: links the signed-in user to any pending invite
// for their email. No-op (and safely ignored) when there is none, or
// before the phase-3f migration has been run.
export async function claimInvite() {
  const { error } = await supabase.rpc('claim_invite')
  return { error }
}
