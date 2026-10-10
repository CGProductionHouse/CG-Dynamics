import { supabase } from './supabase'

export interface PendingClientContextUpdate {
  id: string
  client_id: string
  update_kind: string
  title: string
  body: string | null
  decisions: unknown
  unresolved: unknown
  source_meeting_date: string | null
  created_at: string
}

export interface ClientContextReviewReceipt {
  update_id: string
  client_id: string
  review_state: 'incorporated' | 'rejected'
  reviewed_at: string
  reviewed_by_profile_id: string
  replayed: boolean
}

export async function listPendingClientContextUpdates(clientId: string): Promise<PendingClientContextUpdate[]> {
  const { data, error } = await supabase.from('client_context_updates')
    .select('id,client_id,update_kind,title,body,decisions,unresolved,source_meeting_date,created_at')
    .eq('client_id', clientId).eq('review_state', 'unreviewed')
    .order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error('Client update review is unavailable.')
  return (data ?? []) as PendingClientContextUpdate[]
}

export async function reviewClientContextUpdate(
  clientId: string,
  updateId: string,
  decision: 'incorporated' | 'rejected',
): Promise<ClientContextReviewReceipt> {
  const { data, error } = await supabase.rpc('review_client_context_update', {
    p_client_id: clientId,
    p_update_id: updateId,
    p_expected_state: 'unreviewed',
    p_decision: decision,
  })
  if (error) throw new Error(error.message)
  const receipt = data as ClientContextReviewReceipt | null
  if (!receipt || receipt.client_id !== clientId || receipt.update_id !== updateId ||
      receipt.review_state !== decision || typeof receipt.reviewed_at !== 'string' ||
      typeof receipt.reviewed_by_profile_id !== 'string') {
    throw new Error('Client update review receipt did not match the exact client and decision.')
  }
  return receipt
}
