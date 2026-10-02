import { supabase } from '../supabase'
import {
  isLeadInboxUnavailableError,
  mapWebsiteLeadRow,
  normaliseLeadLifecycle,
  validateLeadLifecycle,
  type LeadLifecycleInput,
  type WebsiteLead,
  type WebsiteLeadMetrics,
} from '../websiteLeads'

export type LeadLoad<T> =
  | { state: 'ready'; data: T }
  | { state: 'unavailable' }
  | { state: 'error'; message: string }

/**
 * Exact-client Lead Inbox. Client users omit clientId (pinned server-side to
 * their profile); staff must pass the selected client. The database decides.
 */
export async function listWebsiteLeads(clientId?: string, limit = 100): Promise<LeadLoad<WebsiteLead[]>> {
  const { data, error } = await supabase.rpc('website_lead_inbox', {
    p_client_id: clientId ?? null,
    p_limit: limit,
    p_before: null,
  })
  if (isLeadInboxUnavailableError(error)) return { state: 'unavailable' }
  if (error) return { state: 'error', message: 'Leads could not be loaded. Please try again shortly.' }
  try {
    return { state: 'ready', data: ((data ?? []) as Record<string, unknown>[]).map(mapWebsiteLeadRow) }
  } catch {
    return { state: 'error', message: 'Lead data was not in the expected shape.' }
  }
}

export async function saveWebsiteLeadLifecycle(enquiryId: string, input: LeadLifecycleInput) {
  const invalid = validateLeadLifecycle(input)
  if (invalid) throw new Error(invalid)
  const value = normaliseLeadLifecycle(input)
  const { error } = await supabase.rpc('set_website_lead_lifecycle', {
    p_enquiry_id: enquiryId,
    p_status: value.status,
    p_quality: value.quality,
    p_poor_reason: value.poorReason,
    p_poor_note: value.poorNote,
  })
  if (error) {
    throw new Error(error.code === '22023' ? error.message : 'The lead could not be updated. Please try again.')
  }
}

export async function getWebsiteLeadMetrics(clientId: string | null, from: string, to: string): Promise<LeadLoad<WebsiteLeadMetrics>> {
  const { data, error } = await supabase.rpc('website_lead_metrics', {
    p_client_id: clientId,
    p_from: from,
    p_to: to,
  })
  if (isLeadInboxUnavailableError(error)) return { state: 'unavailable' }
  if (error || !data || typeof data !== 'object') return { state: 'error', message: 'Lead metrics could not be loaded.' }
  const metrics = data as WebsiteLeadMetrics & { clientId?: string }
  if (clientId && metrics.clientId !== clientId) return { state: 'error', message: 'Lead metrics identity mismatch.' }
  return { state: 'ready', data: metrics }
}
