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
    purpose: 'Retrieve approved sources and Skill Cards, classify each finding, and prepare a cited evidence brief for another specialist. Never creates strategy, final copy, or activates cards.',
    allowedKnowledgeLayers: ['universal', 'industry_specific', 'internal_learning', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['research_question', 'source_facts', 'interpretations', 'internal_observations', 'uncertainties', 'evidence_gaps', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Cite every factual finding. Refuse the brief when approved sources are insufficient. Keep interpretation, internal observation and uncertainty separate from source fact.',
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
    outputContract: ['observed_fact', 'interpretation', 'audience_segments', 'positioning', 'offer_design', 'campaign_objective', 'channel_roles', 'measurement_learning_loop', 'evidence_ids', 'confidence'],
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
    purpose: 'Analyse historical advertising as historical context, separating original-source claims from modern interpretation, outdated assumptions, and present-day applicability limits.',
    allowedKnowledgeLayers: ['universal', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['original_source_claim', 'source_location', 'historical_context', 'modern_interpretation', 'outdated_assumption', 'applicability_limit', 'ethical_flag', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Cite a verifiable source location for every original-source claim. Never present a historic principle as a current platform rule; refuse when the location or applicability cannot be verified.',
    requiresHumanReview: true,
    clientIsolation: 'no_client_data',
    canActivateCards: false,
  },
  {
    key: 'social_media_strategist',
    name: 'Social Media Strategist',
    purpose: 'Own social strategy end to end: platform selection, objective, audience, campaign idea, content pillars, format mix, platform-native adaptation, the organic/paid relationship, testing plan and measurement plan — grounded in current platform knowledge and verified evidence.',
    allowedKnowledgeLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning', 'source_chunks'],
    allowedSourceTrustTiers: ['tier_1_primary', 'tier_2_professional', 'tier_3_internal'],
    excludedSourceTypes: BASE_EXCLUDED,
    relevantIndustries: [],
    outputContract: ['objective', 'platform_selection', 'audience', 'campaign_idea', 'content_pillars', 'format_mix', 'platform_native_adaptation', 'organic_paid_split', 'testing_plan', 'measurement_plan', 'evidence_ids', 'confidence'],
    mustCite: true,
    uncertaintyBehaviour: 'Keep organic and paid distinct; never present a platform mechanic as current unless it is verified; state when platform knowledge is stale or missing; separate a timeless principle from a current platform fact from an experiment.',
    requiresHumanReview: true,
    clientIsolation: 'active_client_only',
    canActivateCards: false,
  },
]

// ── Agent key normalisation ──────────────────────────────────────────────────
// Seeded Skill Cards carry legacy spellings in `relevant_agents` (notably
// `creative_director_agent` for the canonical `creative_director`). Rather than
// rewriting seeded rows — which would break anything already referencing the
// stored value — aliases are resolved at READ time, exactly like the knowledge
// layer aliases in retrievalV1. An unrecognised key resolves to null so a
// mislabelled card is EXCLUDED rather than silently routed to a wrong
// specialist.
const AGENT_KEY_ALIASES: Record<string, string> = {
  creative_director_agent: 'creative_director',
  creative_director: 'creative_director',
  marketing_strategist_agent: 'marketing_strategist',
  marketing_strategist: 'marketing_strategist',
  copywriter: 'copywriting_agent',
  copywriting: 'copywriting_agent',
  copywriting_agent: 'copywriting_agent',
  brand_guardian_agent: 'brand_guardian',
  brand_guardian: 'brand_guardian',
  paid_ads: 'paid_ads_agent',
  paid_ads_agent: 'paid_ads_agent',
  content_planner_agent: 'content_planner',
  content_planner: 'content_planner',
  client_report: 'client_report_agent',
  client_report_agent: 'client_report_agent',
  research_librarian_agent: 'research_librarian',
  research_librarian: 'research_librarian',
  historical_advertising_analyst_agent: 'historical_advertising_analyst',
  historical_advertising_analyst: 'historical_advertising_analyst',
  social_media_strategist_agent: 'social_media_strategist',
  social_media_strategist: 'social_media_strategist',
}

/** Canonical agent key for a stored/legacy value, or null when unrecognised. */
export function normaliseAgentKey(key: string | null | undefined): string | null {
  if (!key) return null
  const canonical = AGENT_KEY_ALIASES[key.trim().toLowerCase()] ?? null
  // Only ever return a key that is a real registered agent.
  return canonical && AI_WORKFORCE_AGENTS.some(a => a.key === canonical) ? canonical : null
}

/** True when a card's relevant_agents list targets this agent. */
export function cardTargetsAgent(relevantAgents: readonly string[] | null | undefined, agentKey: string): boolean {
  if (!relevantAgents || relevantAgents.length === 0) return false
  const target = normaliseAgentKey(agentKey)
  if (!target) return false
  return relevantAgents.some(raw => normaliseAgentKey(raw) === target)
}

export function getAgentProfile(key: string): AgentProfile | null {
  const canonical = normaliseAgentKey(key)
  return canonical ? AI_WORKFORCE_AGENTS.find(a => a.key === canonical) ?? null : null
}

export const AGENT_KEYS = AI_WORKFORCE_AGENTS.map(a => a.key)

// Standard honest response when no approved source material supports an answer.
export const NO_SOURCE_MESSAGE =
  'I do not have enough approved source material to answer this as a skilled agent yet.'
