// ============================================================================
// AI Workforce — skilled agent registry
//
// Each agent is a distinct profile with an explicit contract: what knowledge it
// may use, which source trust tiers it accepts, what it must never touch, its
// output shape, and its mandatory citation / uncertainty / review / isolation
// behaviour. Agents are configuration, not generic prompts — they differ in
// allowed knowledge and output contract, not just name.
//
// Retrieval and the Assistant enforce these contracts server-side; this module
// is pure data so it is unit-testable and shared by both.
// ============================================================================

export type KnowledgeLayer =
  | 'active_client_specific'
  | 'industry_specific'
  | 'south_african_market'
  | 'universal'
  | 'internal_learning'
  | 'source_chunks'

export type SourceTrustTier = 'tier_1_primary' | 'tier_2_professional' | 'tier_3_internal'

export type ExcludedSourceType = 'ai_generated' | 'unsourced_blog' | 'research_only_full_content' | 'rights_restricted_full_text' | 'inactive_client'

export interface AgentProfile {
  key: string
  name: string
  purpose: string
  allowedKnowledgeLayers: KnowledgeLayer[]
  allowedSourceTrustTiers: SourceTrustTier[]
  excludedSourceTypes: ExcludedSourceType[]
  relevantIndustries: string[] // empty = all
  /** The shape the agent must return; used to keep answers structured + reviewable. */
  outputContract: string[]
  /** Every applied principle must carry a citation; unsourced points are labelled reasoning. */
  mustCite: true
  /** How the agent behaves when evidence is insufficient. */
  uncertaintyBehaviour: string
  /** Whether client-facing output requires human review before publication. */
  requiresHumanReview: boolean
  /** Client isolation posture. */
  clientIsolation: 'active_client_only' | 'no_client_data'
  /** May this agent activate/approve Skill Cards? (Only research review can, and never to active.) */
  canActivateCards: false
}

const BASE_EXCLUDED: ExcludedSourceType[] = ['ai_generated', 'unsourced_blog', 'research_only_full_content', 'rights_restricted_full_text', 'inactive_client']

export const AI_WORKFORCE_AGENTS: AgentProfile[] = [
  {
    key: 'research_librarian',
    name: 'Research Librarian',
    purpose: 'Find and classify sources, check rights, identify candidate evidence, and draft source notes. Never activates Skill Cards.',
    allowedKnowledgeLayers: ['universal', 'industry_specific', 'internal_learning', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['source_candidates', 'rights_assessment', 'draft_notes', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'State when rights are unconfirmed and default to metadata-only; never assert a source is reusable from age alone.',
    requiresHumanReview: true,
    clientIsolation: 'no_client_data',
    canActivateCards: false,
  },
  {
    key: 'marketing_strategist',
    name: 'Marketing Strategist',
    purpose: 'Connect verified evidence to commercial decisions and campaign direction; separate objective, audience, message, offer and channel.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['observed_fact', 'commercial_meaning', 'objective', 'audience', 'message', 'offer', 'channel', 'kpi', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Separate observed fact from interpretation and hypothesis; withhold recommendation when evidence is insufficient.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'copywriting_agent',
    name: 'Copywriting Agent',
    purpose: 'Draft headlines, hooks, offers, body copy, CTAs, script structure and captions grounded in verified copywriting principles.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['drafts', 'principle_applied', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Label copy as a draft; note where a principle is applied vs where it is stylistic choice.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'creative_director',
    name: 'Creative Director Agent',
    purpose: 'Concepts, visual hierarchy, campaign systems, creative angles and production direction.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['concepts', 'visual_hierarchy', 'creative_angle', 'production_direction', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Distinguish a principle-backed recommendation from a creative option.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'brand_guardian',
    name: 'Brand Guardian',
    purpose: 'Enforce tone, approved wording, claim safety, brand consistency and client-specific restrictions.',
    allowedKnowledgeLayers: ['active_client_specific', 'universal', 'internal_learning'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['tone_check', 'claim_safety', 'restricted_wording', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Flag any claim that cannot be substantiated; never approve an unsupported factual claim.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'paid_ads_agent',
    name: 'Paid Ads Agent',
    purpose: 'Campaign structure, testing plans, offer/message fit, measurement and interpretation of VERIFIED platform data only.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['campaign_structure', 'test_plan', 'measurement', 'interpretation', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Interpret only verified metrics; never invent performance numbers or attribute unverified results.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'content_planner',
    name: 'Content Planner Agent',
    purpose: 'Content pillars, monthly planning, campaign sequencing, calendar opportunities and platform/content-type fit.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['content_pillars', 'monthly_plan', 'sequencing', 'platform_fit', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Deduplicate overlapping opportunities; flag unverified assumptions.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'client_report_agent',
    name: 'Client Report Agent',
    purpose: 'Explain verified results, separate evidence from interpretation, and prepare reviewed recommendations. Never invents metrics.',
    allowedKnowledgeLayers: ['active_client_specific', 'universal', 'internal_learning'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['what_happened', 'why_it_matters', 'what_cg_does_next', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Only report verified metrics; if a metric is unavailable say so — never substitute zero or an estimate.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
  {
    key: 'historical_advertising_analyst',
    name: 'Historical Advertising Analyst',
    purpose: 'Examine historic ads, identify persuasive structure, separate timeless learning from outdated practice, and flag unethical / discriminatory / non-compliant claims.',
    allowedKnowledgeLayers: ['universal', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['persuasion_structure', 'timeless_principle', 'obsolete_practice', 'ethical_flag', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Explicitly separate a timeless principle from an obsolete media practice and from an unethical/non-compliant claim.',
    requiresHumanReview: true,
    clientIsolation: 'no_client_data',
    canActivateCards: false,
  },
]

export function getAgentProfile(key: string): AgentProfile | null {
  return AI_WORKFORCE_AGENTS.find(a => a.key === key) ?? null
}

export const AGENT_KEYS = AI_WORKFORCE_AGENTS.map(a => a.key)

// Standard honest response when no approved source material supports an answer.
export const NO_SOURCE_MESSAGE =
  'I do not have enough approved source material to answer this as a skilled agent yet.'
