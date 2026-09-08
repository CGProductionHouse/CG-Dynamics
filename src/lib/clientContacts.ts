import { supabase } from './supabase'
import { withRequestTimeout } from './db/requestTimeout'
import type {
  ClientContactFreshness,
  ClientContactState,
  ClientContactVisibility,
  FooterRequirement,
} from './clientContactPolicy'

export type ClientContactType =
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'website'
  | 'address'
  | 'booking'
  | 'quote'
  | 'order'
  | 'other'

export interface ClientContact {
  id: string
  client_id: string
  scope_key: string | null
  scope_label: string | null
  contact_type: ClientContactType
  display_label: string
  person_name: string | null
  person_role: string | null
  value: string
  approved_for_caption: boolean
  blocks_caption: boolean
  visibility: ClientContactVisibility
  allowed_purposes: string[]
  provenance_summary: string
  source_reference: string | null
  observed_at: string | null
  last_verified_at: string | null
  verified_by: string | null
  freshness_state: ClientContactFreshness
  lifecycle_state: ClientContactState
  superseded_by_contact_id: string | null
  platforms: string[]
  content_modes: string[]
  footer_order: number
  created_at: string
  updated_at: string
}

export interface ClientFooterPolicy {
  id: string
  client_id: string
  scope_key: string | null
  scope_label: string | null
  content_mode: string
  platform: string | null
  requirement: FooterRequirement
  format_template: string | null
  review_state: 'current_verified' | 'unverified_hold'
  provenance_summary: string
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export async function listClientContacts(clientId: string, scopeKey?: string | null) {
  let query = supabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('footer_order', { ascending: true })
    .order('display_label', { ascending: true })
  query = scopeKey ? query.eq('scope_key', scopeKey) : query.is('scope_key', null)
  const { data, error } = await withRequestTimeout(query, 'Loading client contacts took too long.')
  return { data: (data ?? []) as ClientContact[], error }
}

/** Manager/admin inventory for the Client Intelligence workspace. */
export async function listAllClientContacts() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_contacts')
      .select('*')
      .order('client_id', { ascending: true })
      .order('footer_order', { ascending: true }),
    'Loading client contacts took too long.',
  )
  return { data: (data ?? []) as ClientContact[], error }
}

export async function listClientFooterPolicies(clientId: string, scopeKey?: string | null) {
  let query = supabase
    .from('client_contact_footer_policies')
    .select('*')
    .eq('client_id', clientId)
    .order('content_mode', { ascending: true })
  query = scopeKey ? query.eq('scope_key', scopeKey) : query.is('scope_key', null)
  const { data, error } = await withRequestTimeout(query, 'Loading footer policies took too long.')
  return { data: (data ?? []) as ClientFooterPolicy[], error }
}

export async function upsertClientContact(input: Omit<ClientContact, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  const { data, error } = await withRequestTimeout(
    supabase.from('client_contacts').upsert(input).select('*').single(),
    'Saving client contact took too long.',
  )
  return { data: data as ClientContact | null, error }
}

export async function upsertClientFooterPolicy(input: Omit<ClientFooterPolicy, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  const { data, error } = await withRequestTimeout(
    supabase.from('client_contact_footer_policies').upsert(input).select('*').single(),
    'Saving footer policy took too long.',
  )
  return { data: data as ClientFooterPolicy | null, error }
}
