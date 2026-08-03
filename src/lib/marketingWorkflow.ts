import { supabase } from './supabase'

// Marketing AI Department client library.
//
// Reads go through RLS (active staff only — client-role users have no policy on
// any ai_marketing_* table). Writes only ever happen server-side: specialist
// runs via the `marketing-workflow` Edge Function, human decisions via the
// manager-gated `ai_marketing_record_decision` RPC. Nothing here can publish,
// spend budget, change client records or activate knowledge.

export type MarketingSpecialist =
  | 'marketing_strategist' | 'copywriting_agent' | 'creative_director' | 'brand_guardian'
  | 'social_media_strategist' | 'paid_ads_agent' | 'content_planner'

export type ArtifactStatus = 'draft' | 'in_review' | 'changes_requested' | 'rejected' | 'human_approved'

export const SPECIALIST_LABELS: Record<MarketingSpecialist, string> = {
  marketing_strategist: 'Marketing Strategist',
  copywriting_agent: 'Copywriting Agent',
  creative_director: 'Creative Director',
  brand_guardian: 'Brand Guardian',
  social_media_strategist: 'Social Media Strategist',
  paid_ads_agent: 'Paid Ads Agent',
  content_planner: 'Content Planner',
}

/** The production chain the workflow advances through. */
export const WORKFLOW_CHAIN: MarketingSpecialist[] = [
  'marketing_strategist', 'copywriting_agent', 'brand_guardian',
]

export interface MarketingArtifact {
  id: string
  client_id: string
  campaign_id: string | null
  campaign_name: string | null
  originating_request: string
  requested_specialist: string
  current_specialist: MarketingSpecialist
  artifact_type: string
  status: ArtifactStatus
  current_version: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface MarketingArtifactVersion {
  id: string
  artifact_id: string
  version: number
  specialist: MarketingSpecialist
  content: Record<string, unknown>
  confidence: number | null
  evidence_card_ids: string[]
  provider: string | null
  model: string | null
  ai_usage_request_id: string | null
  parent_version_id: string | null
  created_by: string
  created_at: string
}

export interface MarketingTransition {
  id: string
  artifact_id: string
  version_id: string | null
  action: 'created' | 'regenerated' | 'handed_off' | 'changes_requested' | 'returned' | 'approved' | 'rejected'
  from_specialist: string | null
  to_specialist: string | null
  note: string | null
  actor_id: string
  created_at: string
}

export interface MarketingApproval {
  id: string
  artifact_id: string
  version_id: string
  decision: 'approved' | 'rejected' | 'changes_requested' | 'returned'
  note: string | null
  reviewer_id: string
  created_at: string
}

export interface RunResult {
  ok: boolean
  insufficientEvidence?: boolean
  message?: string
  pendingCardCount?: number
  artifact?: MarketingArtifact
  version?: MarketingArtifactVersion
  specialist?: MarketingSpecialist
  specialistName?: string
  routeReason?: string
  nextSpecialist?: MarketingSpecialist | null
  evidenceUsed?: Array<{ id: string; title: string; principle: string; summary: string; reference: string | null; layer: string | null }>
  provider?: string
  model?: string
  error?: string
}

function fnError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Deterministic routing preview — explains who would act, runs nothing. */
export async function routeMarketingRequest(request: string): Promise<{ specialist: MarketingSpecialist; reason: string } | null> {
  const { data, error } = await supabase.functions.invoke('marketing-workflow', {
    body: { action: 'route', request },
  })
  if (error || !data?.ok) return null
  return { specialist: data.specialist as MarketingSpecialist, reason: data.reason as string }
}

export interface RunInput {
  clientId: string
  request?: string
  artifactId?: string
  specialist?: MarketingSpecialist
  campaignId?: string | null
  campaignName?: string | null
  regenerate?: boolean
  changeNote?: string
}

/** Run one specialist. Creates the artifact on first run, else advances it. */
export async function runMarketingSpecialist(input: RunInput): Promise<RunResult> {
  try {
    const { data, error } = await supabase.functions.invoke('marketing-workflow', {
      body: { action: 'run', ...input },
    })
    if (error) return { ok: false, error: fnError(error, 'The specialist could not be run.') }
    return data as RunResult
  } catch (error) {
    return { ok: false, error: fnError(error, 'The specialist could not be run.') }
  }
}

export async function listMarketingArtifacts(clientId?: string) {
  let query = supabase
    .from('ai_marketing_artifacts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (clientId) query = query.eq('client_id', clientId)
  return query
}

export async function listArtifactVersions(artifactId: string) {
  return supabase
    .from('ai_marketing_artifact_versions')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('version', { ascending: false })
}

export async function listArtifactHistory(artifactId: string) {
  return supabase
    .from('ai_marketing_artifact_transitions')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: false })
}

export async function listArtifactApprovals(artifactId: string) {
  return supabase
    .from('ai_marketing_artifact_approvals')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: false })
}

/**
 * Record a human decision. Approve/reject are manager+admin only (enforced in
 * the SECURITY DEFINER RPC, not here). The decision must target the CURRENT
 * version, so a stale screen can never approve superseded content.
 */
export async function recordMarketingDecision(input: {
  artifactId: string
  versionId: string
  decision: 'approved' | 'rejected' | 'changes_requested' | 'returned'
  note?: string
  returnSpecialist?: MarketingSpecialist | null
}) {
  return supabase.rpc('ai_marketing_record_decision', {
    p_artifact_id: input.artifactId,
    p_version_id: input.versionId,
    p_decision: input.decision,
    p_note: input.note ?? null,
    p_return_specialist: input.returnSpecialist ?? null,
  })
}

export async function listCampaignOptions(clientId: string) {
  return supabase.rpc('ai_marketing_campaign_options', { p_client_id: clientId })
}
