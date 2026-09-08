import { supabase } from './supabase'

export type BusinessDevelopmentLeadStage =
  | 'to_research'
  | 'to_contact'
  | 'contacted_awaiting_response'
  | 'follow_up'
  | 'active_opportunity'
  | 'nurture'
  | 'won_converted'
  | 'closed_not_fit'
  | 'duplicate'
  | 'do_not_contact'

export type LeadEvidenceConfidence = 'needs_review' | 'supported' | 'verified' | 'conflicting'
export type LeadQualification = 'unreviewed' | 'researching' | 'qualified' | 'not_qualified' | 'conflicting'

export interface BusinessDevelopmentLead {
  id: string
  owner_profile_id: string
  created_by: string
  company_name: string
  website_url: string | null
  industry: string | null
  location: string | null
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  stage: BusinessDevelopmentLeadStage
  qualification: LeadQualification
  qualification_summary: string | null
  last_action: string | null
  last_action_at: string | null
  next_action: string | null
  follow_up_at: string | null
  source_kind: string
  source_url: string | null
  confidence: LeadEvidenceConfidence
  do_not_contact: boolean
  converted_client_id: string | null
  archived_at: string | null
  idempotency_key: string
  created_at: string
  updated_at: string
}

export interface BusinessDevelopmentLeadResearch {
  id: string
  lead_id: string
  created_by: string
  entry_type: 'observation' | 'source' | 'qualification' | 'outreach_result' | 'correction'
  summary: string
  source_url: string | null
  source_title: string | null
  observed_at: string | null
  confidence: LeadEvidenceConfidence
  supersedes_entry_id: string | null
  created_at: string
}

export interface BusinessDevelopmentLeadEvent {
  id: string
  lead_id: string
  actor_profile_id: string
  event_type: 'created' | 'updated'
  state_snapshot: Record<string, unknown>
  created_at: string
}

export interface CreateBusinessDevelopmentLeadInput {
  company_name: string
  website_url?: string | null
  industry?: string | null
  location?: string | null
  source_url?: string | null
  qualification_summary?: string | null
  last_action?: string | null
  last_action_at?: string | null
  next_action?: string | null
  follow_up_at?: string | null
  stage?: BusinessDevelopmentLeadStage
  qualification?: LeadQualification
  confidence?: LeadEvidenceConfidence
  idempotency_key?: string
}

export interface UpdateBusinessDevelopmentLeadInput {
  website_url?: string | null
  industry?: string | null
  location?: string | null
  contact_name?: string | null
  contact_title?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  stage?: BusinessDevelopmentLeadStage
  qualification?: LeadQualification
  qualification_summary?: string | null
  last_action?: string | null
  last_action_at?: string | null
  next_action?: string | null
  follow_up_at?: string | null
  source_url?: string | null
  confidence?: LeadEvidenceConfidence
  do_not_contact?: boolean
  archived_at?: string | null
}

export const BUSINESS_DEVELOPMENT_STAGES: Array<{ value: BusinessDevelopmentLeadStage; label: string }> = [
  { value: 'to_research', label: 'To research' },
  { value: 'to_contact', label: 'To contact' },
  { value: 'contacted_awaiting_response', label: 'Contacted / awaiting response' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'active_opportunity', label: 'Pursued / active opportunity' },
  { value: 'nurture', label: 'Not now / nurture' },
  { value: 'won_converted', label: 'Won / converted' },
  { value: 'closed_not_fit', label: 'Closed / not a fit' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'do_not_contact', label: 'Do not contact' },
]

export async function listMyBusinessDevelopmentLeads(profileId: string) {
  const { data, error } = await supabase
    .from('business_development_leads')
    .select('*')
    .eq('owner_profile_id', profileId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
  return { data: (data ?? []) as BusinessDevelopmentLead[], error }
}

export async function createBusinessDevelopmentLead(input: CreateBusinessDevelopmentLeadInput) {
  const payload = {
    ...input,
    company_name: input.company_name.trim(),
    website_url: input.website_url?.trim() || null,
    industry: input.industry?.trim() || null,
    location: input.location?.trim() || null,
    source_url: input.source_url?.trim() || null,
    qualification_summary: input.qualification_summary?.trim() || null,
    last_action: input.last_action?.trim() || null,
    last_action_at: input.last_action_at || null,
    next_action: input.next_action?.trim() || null,
    follow_up_at: input.follow_up_at || null,
    idempotency_key: input.idempotency_key ?? crypto.randomUUID(),
  }
  const { data, error } = await supabase
    .from('business_development_leads')
    .upsert(payload, { onConflict: 'owner_profile_id,idempotency_key' })
    .select()
    .single()
  return { data: data as BusinessDevelopmentLead | null, error }
}

export async function updateBusinessDevelopmentLead(id: string, input: UpdateBusinessDevelopmentLeadInput) {
  const normalized = {
    ...input,
    ...(input.website_url !== undefined && { website_url: input.website_url?.trim() || null }),
    ...(input.industry !== undefined && { industry: input.industry?.trim() || null }),
    ...(input.location !== undefined && { location: input.location?.trim() || null }),
    ...(input.contact_name !== undefined && { contact_name: input.contact_name?.trim() || null }),
    ...(input.contact_title !== undefined && { contact_title: input.contact_title?.trim() || null }),
    ...(input.contact_email !== undefined && { contact_email: input.contact_email?.trim() || null }),
    ...(input.contact_phone !== undefined && { contact_phone: input.contact_phone?.trim() || null }),
    ...(input.qualification_summary !== undefined && { qualification_summary: input.qualification_summary?.trim() || null }),
    ...(input.last_action !== undefined && { last_action: input.last_action?.trim() || null }),
    ...(input.next_action !== undefined && { next_action: input.next_action?.trim() || null }),
    ...(input.source_url !== undefined && { source_url: input.source_url?.trim() || null }),
  }
  const { data, error } = await supabase
    .from('business_development_leads')
    .update(normalized)
    .eq('id', id)
    .select()
    .single()
  return { data: data as BusinessDevelopmentLead | null, error }
}

export async function listBusinessDevelopmentLeadEvents(leadId: string) {
  const { data, error } = await supabase
    .from('business_development_lead_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as BusinessDevelopmentLeadEvent[], error }
}

export async function listBusinessDevelopmentLeadResearch(leadId: string) {
  const { data, error } = await supabase
    .from('business_development_lead_research')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as BusinessDevelopmentLeadResearch[], error }
}

export async function addBusinessDevelopmentLeadResearch(input: {
  leadId: string
  entryType: BusinessDevelopmentLeadResearch['entry_type']
  summary: string
  sourceUrl?: string | null
  sourceTitle?: string | null
  observedAt?: string | null
  confidence?: LeadEvidenceConfidence
}) {
  const { data, error } = await supabase
    .from('business_development_lead_research')
    .insert({
      lead_id: input.leadId,
      entry_type: input.entryType,
      summary: input.summary.trim(),
      source_url: input.sourceUrl?.trim() || null,
      source_title: input.sourceTitle?.trim() || null,
      observed_at: input.observedAt || null,
      confidence: input.confidence ?? 'needs_review',
    })
    .select()
    .single()
  return { data: data as BusinessDevelopmentLeadResearch | null, error }
}
