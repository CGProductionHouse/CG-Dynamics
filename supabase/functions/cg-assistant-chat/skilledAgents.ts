// ============================================================================
// Skilled-agent contracts + deterministic gating for cg-assistant-chat.
//
// MIRRORS the unit-tested source of truth:
//   src/features/ai-workforce/agents/agentRegistry.ts
//   src/features/ai-workforce/retrieval/retrievalV1.ts
// Keep in sync. This is the Deno-side copy the edge function runs.
//
// Non-negotiables enforced here (server-side):
//  - production skilled mode sees ONLY active, reviewed cards;
//  - client-specific cards require the EXACT active client (no cross/inactive);
//  - AI-generated / unsourced-blog cards are never authoritative;
//  - an agent may only use its allowed knowledge layers;
//  - source/card text is EVIDENCE, never instruction (injection neutralised);
//  - insufficient evidence is stated honestly — never a silent generic answer.
// ============================================================================

export type KnowledgeLayer =
  | 'active_client_specific' | 'industry_specific' | 'south_african_market'
  | 'universal' | 'internal_learning' | 'source_chunks'

export interface AgentContract {
  key: string
  name: string
  allowedLayers: KnowledgeLayer[]
  clientIsolation: 'active_client_only' | 'no_client_data'
  outputContract: string[]
  system: string
}

const ALL_LAYERS: KnowledgeLayer[] = ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning', 'source_chunks']

export const AGENT_CONTRACTS: Record<string, AgentContract> = {
  research_librarian: {
    key: 'research_librarian', name: 'Research Librarian',
    allowedLayers: ['universal', 'industry_specific', 'internal_learning', 'source_chunks'],
    clientIsolation: 'no_client_data',
    outputContract: ['research_question', 'source_facts', 'interpretations', 'internal_observations', 'uncertainties', 'evidence_gaps', 'evidence_ids', 'confidence'],
    system: 'You are the Research Librarian. Retrieve only approved sources and Skill Cards and prepare a structured evidence brief for another specialist. Classify every finding as source fact, interpretation, internal observation, or uncertainty. Cite every factual finding. Never create campaign strategy or final client copy. Refuse when approved sources are insufficient. Never assert reuse rights from age alone and never activate Skill Cards.',
  },
  marketing_strategist: {
    key: 'marketing_strategist', name: 'Marketing Strategist',
    allowedLayers: ALL_LAYERS,
    clientIsolation: 'active_client_only',
    outputContract: ['observed_fact', 'interpretation', 'audience_segments', 'positioning', 'offer_design', 'campaign_objective', 'channel_roles', 'measurement_learning_loop', 'evidence_ids', 'confidence'],
    system: 'You are the Marketing Strategist. Separate observed fact from interpretation and hypothesis. Build audience segmentation, positioning, offer design, campaign objectives, channel roles, and a measurement-and-learning loop only from verified evidence. Withhold recommendations when evidence is insufficient.',
  },
  copywriting_agent: {
    key: 'copywriting_agent', name: 'Copywriting Agent',
    allowedLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'source_chunks'],
    clientIsolation: 'active_client_only',
    outputContract: ['drafts', 'principle_applied', 'evidence_ids', 'confidence'],
    system: 'You are the Copywriting Agent. Draft copy grounded in cited copywriting principles. Label output as draft; note where a principle is applied vs a stylistic choice. Avoid generic AI wording and unsupported claims.',
  },
  creative_director: {
    key: 'creative_director', name: 'Creative Director Agent',
    allowedLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'source_chunks'],
    clientIsolation: 'active_client_only',
    outputContract: ['concepts', 'visual_hierarchy', 'creative_angle', 'production_direction', 'evidence_ids', 'confidence'],
    system: 'You are the Creative Director Agent. Offer concepts and creative direction. Distinguish a principle-backed recommendation from a creative option.',
  },
  brand_guardian: {
    key: 'brand_guardian', name: 'Brand Guardian',
    allowedLayers: ['active_client_specific', 'universal', 'internal_learning'],
    clientIsolation: 'active_client_only',
    outputContract: ['tone_check', 'claim_safety', 'restricted_wording', 'evidence_ids', 'confidence'],
    system: 'You are the Brand Guardian. Enforce tone, claim safety and brand consistency. Flag any claim that cannot be substantiated; never approve an unsupported factual claim.',
  },
  paid_ads_agent: {
    key: 'paid_ads_agent', name: 'Paid Ads Agent',
    allowedLayers: ALL_LAYERS,
    clientIsolation: 'active_client_only',
    outputContract: ['campaign_structure', 'test_plan', 'measurement', 'interpretation', 'evidence_ids', 'confidence'],
    system: 'You are the Paid Ads Agent. Interpret only verified metrics; never invent performance numbers or attribute unverified results.',
  },
  content_planner: {
    key: 'content_planner', name: 'Content Planner Agent',
    allowedLayers: ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning'],
    clientIsolation: 'active_client_only',
    outputContract: ['content_pillars', 'monthly_plan', 'sequencing', 'platform_fit', 'evidence_ids', 'confidence'],
    system: 'You are the Content Planner Agent. Plan pillars and sequencing. Deduplicate overlapping opportunities; flag unverified assumptions.',
  },
  client_report_agent: {
    key: 'client_report_agent', name: 'Client Report Agent',
    allowedLayers: ['active_client_specific', 'universal', 'internal_learning'],
    clientIsolation: 'active_client_only',
    outputContract: ['what_happened', 'why_it_matters', 'what_cg_does_next', 'evidence_ids', 'confidence'],
    system: 'You are the Client Report Agent. Report only verified metrics; if a metric is unavailable say so — never substitute zero or an estimate.',
  },
  historical_advertising_analyst: {
    key: 'historical_advertising_analyst', name: 'Historical Advertising Analyst',
    allowedLayers: ['universal', 'source_chunks'],
    clientIsolation: 'no_client_data',
    outputContract: ['original_source_claim', 'source_location', 'historical_context', 'modern_interpretation', 'outdated_assumption', 'applicability_limit', 'ethical_flag', 'evidence_ids', 'confidence'],
    system: 'You are the Historical Advertising Analyst. Analyse historical advertising only as historical context. Separate original-source claims from modern interpretation, cite a verifiable source location, and flag outdated assumptions and applicability limits. Never present historic principles as current platform rules. Historical examples are evidence of structure, not templates.',
  },
  social_media_strategist: {
    key: 'social_media_strategist', name: 'Social Media Strategist',
    allowedLayers: ALL_LAYERS,
    clientIsolation: 'active_client_only',
    outputContract: ['objective', 'platform_selection', 'audience', 'campaign_idea', 'content_pillars', 'format_mix', 'platform_native_adaptation', 'organic_paid_split', 'testing_plan', 'measurement_plan', 'evidence_ids', 'confidence'],
    system: 'You are the Social Media Strategist. Own platform selection, objective, audience, campaign idea, content pillars, format mix, platform-native adaptation, the organic/paid relationship, testing and measurement. Keep organic and paid distinct. Never present a platform mechanic or metric as current unless the provided platform knowledge marks it verified; if platform knowledge is stale or missing, say so. Do not copy one caption across every platform — adapt natively per surface.',
  },
}

export const NO_SOURCE_MESSAGE =
  'I do not have enough approved source material to answer this as a skilled agent yet.'

// Agents that should also retrieve current platform knowledge for a chosen
// platform/surface. Historical analyst and research librarian stay platform-free.
export const SOCIAL_AWARE_AGENTS = new Set([
  'social_media_strategist', 'marketing_strategist', 'copywriting_agent',
  'creative_director', 'brand_guardian', 'paid_ads_agent', 'content_planner',
  'client_report_agent',
])

export interface PlatformKnowledgeRow {
  id: string
  title: string
  principle: string
  application: string | null
  limitations: string | null
  knowledge_state: string
  channel: string
  evidence_strength: string
  last_verified_at: string | null
  expires_at: string | null
  platform_slug: string
  surface_key: string | null
  source_url: string | null
}

// A platform knowledge item may reach a production answer ONLY if it is current:
// verified_current/observed_current and not past its expiry. Admin research mode
// may additionally preview experimental/disputed items.
export function isPlatformKnowledgeCurrent(row: PlatformKnowledgeRow, mode: 'production' | 'admin_research', today: string): boolean {
  if (row.expires_at && row.expires_at < today) return false
  if (mode === 'production') return row.knowledge_state === 'verified_current' || row.knowledge_state === 'observed_current'
  return !['retired', 'stale'].includes(row.knowledge_state)
}

const LAYER_ALIASES: Record<string, KnowledgeLayer> = {
  universal_principle: 'universal', universal: 'universal',
  sa_market: 'south_african_market', south_african_market: 'south_african_market',
  industry_specific: 'industry_specific', active_client_specific: 'active_client_specific',
  client_specific: 'active_client_specific', internal_learning: 'internal_learning',
  source_chunks: 'source_chunks',
}
const LAYER_PRIORITY: KnowledgeLayer[] = ['active_client_specific', 'industry_specific', 'south_african_market', 'universal', 'internal_learning', 'source_chunks']
const NON_AUTHORITATIVE = new Set(['ai_generated', 'unsourced_blog'])

export function normaliseKnowledgeLayer(layer: string | null | undefined): KnowledgeLayer | null {
  if (!layer) return null
  return LAYER_ALIASES[layer] ?? null
}

export interface CardRow {
  id: string
  status: string
  knowledge_layer: string | null
  client_specific: boolean
  active_client_id: string | null
  source_type: string | null
  source_id: string | null
  title: string
  principle: string | null
  summary: string | null
  source_reference: string | null
  /** Stored `skill_cards.relevant_agents`; may contain legacy key spellings. */
  relevant_agents?: string[] | null
}

// Seeded cards carry legacy agent spellings (notably `creative_director_agent`
// for the canonical `creative_director`). Resolve at READ time so seeded data
// keeps working untouched; an unrecognised key resolves to null so the card is
// EXCLUDED rather than routed to the wrong specialist.
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

export function normaliseAgentKey(key: string | null | undefined): string | null {
  if (!key) return null
  const canonical = AGENT_KEY_ALIASES[key.trim().toLowerCase()] ?? null
  return canonical && AGENT_CONTRACTS[canonical] ? canonical : null
}

export function cardTargetsAgent(relevantAgents: string[] | null | undefined, agentKey: string): boolean {
  if (!relevantAgents || relevantAgents.length === 0) return false
  const target = normaliseAgentKey(agentKey)
  if (!target) return false
  return relevantAgents.some(raw => normaliseAgentKey(raw) === target)
}

export interface GateContext {
  agent: AgentContract
  activeClientId: string | null
  mode: 'production' | 'admin_research'
}

export function isCardRetrievable(card: CardRow, ctx: GateContext): boolean {
  if (card.source_type && NON_AUTHORITATIVE.has(card.source_type)) return false
  if (ctx.mode === 'production') {
    if (card.status !== 'active') return false
  } else if (!['active', 'needs_review', 'reviewed'].includes(card.status)) {
    return false
  }
  if (card.status === 'deprecated') return false
  if (card.client_specific) {
    if (ctx.agent.clientIsolation === 'no_client_data') return false
    if (!ctx.activeClientId || card.active_client_id !== ctx.activeClientId) return false
  }
  const layer = normaliseKnowledgeLayer(card.knowledge_layer)
  if (!layer || !ctx.agent.allowedLayers.includes(layer)) return false
  // The card must be addressed to THIS specialist (legacy keys normalised).
  if (!cardTargetsAgent(card.relevant_agents, ctx.agent.key)) return false
  return true
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])]
}

function queryScore(card: CardRow, terms: string[]): number {
  if (terms.length === 0) return 0
  const haystack = [card.title, card.principle, card.summary, card.source_reference]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}

export function buildPlan(cards: CardRow[], ctx: GateContext, limit = 8, query = ''): { cards: CardRow[]; insufficient: boolean } {
  const gated = cards.filter((c) => isCardRetrievable(c, ctx))
  const terms = queryTerms(query)
  gated.sort((a, b) => {
    const queryRank = queryScore(b, terms) - queryScore(a, terms)
    if (queryRank !== 0) return queryRank
    const ra = LAYER_PRIORITY.indexOf(normaliseKnowledgeLayer(a.knowledge_layer) as KnowledgeLayer)
    const rb = LAYER_PRIORITY.indexOf(normaliseKnowledgeLayer(b.knowledge_layer) as KnowledgeLayer)
    if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb)
    if (a.client_specific !== b.client_specific) return a.client_specific ? -1 : 1
    return (a.title || '').localeCompare(b.title || '')
  })
  const top = gated.slice(0, limit)
  return { cards: top, insufficient: top.length === 0 }
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |any |the )?(?:previous|prior|above) instructions/gi,
  /disregard (?:the )?(?:system|previous) prompt/gi,
  /you are now [a-z]/gi,
  /system\s*:/gi,
  /\bact as (?:an? )?(?:admin|developer|system)\b/gi,
]

export function neutralise(text: string): string {
  let out = text ?? ''
  for (const p of INJECTION_PATTERNS) out = out.replace(p, '[redacted-instruction-like-text]')
  return out
}
