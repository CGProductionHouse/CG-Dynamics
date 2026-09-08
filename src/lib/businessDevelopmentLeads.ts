import { supabase } from './supabase'

export type BusinessDevelopmentLeadStage =
  | 'researching'
  | 'ready_for_outreach'
  | 'attempted_contact'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'proposal_or_quote'
  | 'lost'
  | 'invalid'
  | 'duplicate'
  | 'do_not_contact'

export type LeadEvidenceConfidence = 'needs_review' | 'supported' | 'verified' | 'conflicting'

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
  qualification_summary: string | null
  next_step: string | null
  next_step_at: string | null
  source_kind: string
  source_url: string | null
  confidence: LeadEvidenceConfidence
  do_not_contact: boolean
  converted_client_id: string | null
  archived_at: string | null
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

export interface CreateBusinessDevelopmentLeadInput {
  company_name: string
  website_url?: string | null
  industry?: string | null
  location?: string | null
  source_url?: string | null
  qualification_summary?: string | null
  next_step?: string | null
  stage?: BusinessDevelopmentLeadStage
  confidence?: LeadEvidenceConfidence
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
  qualification_summary?: string | null
  next_step?: string | null
  next_step_at?: string | null
  source_url?: string | null
  confidence?: LeadEvidenceConfidence
  do_not_contact?: boolean
  archived_at?: string | null
}

export const BUSINESS_DEVELOPMENT_STAGES: Array<{ value: BusinessDevelopmentLeadStage; label: string }> = [
  { value: 'researching', label: 'Researching' },
  { value: 'ready_for_outreach', label: 'Ready for outreach' },
  { value: 'attempted_contact', label: 'Attempted contact' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_or_quote', label: 'Proposal / quote' },
  { value: 'lost', label: 'Lost' },
  { value: 'invalid', label: 'Invalid' },
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
    next_step: input.next_step?.trim() || null,
  }
  const { data, error } = await supabase
    .from('business_development_leads')
    .insert(payload)
    .select()
    .single()
  return { data: data as BusinessDevelopmentLead | null, error }
}

export async function updateBusinessDevelopmentLead(id: string, input: UpdateBusinessDevelopmentLeadInput) {
  const { data, error } = await supabase
    .from('business_development_leads')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  return { data: data as BusinessDevelopmentLead | null, error }
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
