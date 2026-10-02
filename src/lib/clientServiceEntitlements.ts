import { supabase } from './supabase'
import type { ServiceEntitlement, ServiceKey, EntitlementState } from './clientServicePresentation'
import { parseServiceEntitlements } from './clientServicePresentation'

export async function readMyServiceEntitlements(): Promise<ServiceEntitlement[]> {
  const { data, error } = await supabase.rpc('get_my_client_service_entitlements')
  if (error) throw error
  return parseServiceEntitlements(data)
}

export async function requestServiceExpansion(service: ServiceKey, message: string, key: string, surface: 'overview' | 'performance') {
  const { data, error } = await supabase.rpc('submit_client_service_expansion_request', {
    p_service_key: service, p_message: message, p_idempotency_key: key, p_surface: surface,
  })
  if (error) throw error
  return data as { submitted_at: string; replayed: boolean }
}

export async function recordServiceSurface(surface: 'overview' | 'performance', key: string) {
  const { error } = await supabase.rpc('record_client_service_surface', { p_surface: surface, p_view_key: key })
  if (error) throw error
}

export interface ServiceEvidence {
  service_key: ServiceKey; state: EntitlementState; evidence_note: string; source_references: string[]
  verified_at: string; revision: number; notes: string | null
}
export interface ServiceExpansionReview {
  service_key: ServiceKey; surface_views: number; requests: number; latest_request_at: string | null
}
export async function readServiceExpansionReview(clientId: string): Promise<ServiceExpansionReview[]> {
  const { data, error } = await supabase.rpc('get_client_service_expansion_review', { p_client_id: clientId })
  if (error) throw error
  return data ?? []
}
export async function readServiceEvidence(clientId: string): Promise<ServiceEvidence[]> {
  const { data, error } = await supabase.from('client_service_entitlements')
    .select('service_key,state,evidence_note,source_references,verified_at,revision,notes').eq('client_id', clientId)
  if (error) throw error
  return data ?? []
}
export async function verifyServiceEvidence(clientId: string, service: ServiceKey, state: EntitlementState, evidence: string, sources: string[], revision: number) {
  const { error } = await supabase.rpc('verify_client_service_entitlement', {
    p_client_id: clientId, p_service_key: service, p_state: state, p_evidence_note: evidence,
    p_source_references: sources, p_expected_revision: revision,
  })
  if (error) throw error
}
