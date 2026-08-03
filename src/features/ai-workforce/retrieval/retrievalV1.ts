// ============================================================================
// AI Workforce — Retrieval V1 (deterministic, source-backed)
//
// Pure logic that decides what approved knowledge an agent may use for a query.
// No embeddings; PostgreSQL full-text search backs the DB layer. This module is
// the gate: it enforces the retrieval priority order and the non-negotiable
// rules (only active/reviewed knowledge in production; no inactive/cross-client
// data; AI-generated and unsourced blogs are never authoritative; research-only
// and rights-restricted full text are never returned; every applied principle
// carries a citation). It is pure so it is unit-testable and shared by the
// Assistant edge function and any admin tooling.
// ============================================================================
import { cardTargetsAgent } from '../agents/agentRegistry'
import type { AgentProfile, KnowledgeLayer } from '../agents/agentRegistry'

export interface RetrievalContext {
  agent: AgentProfile
  activeClientId: string | null
  industry: string | null
  /** admin research mode may see needs-review cards; production agents may not. */
  mode: 'production' | 'admin_research'
}

export interface SkillCardRecord {
  id: string
  status: string                 // 'draft' | 'needs_review' | 'active' | 'deprecated' | ...
  knowledgeLayer: KnowledgeLayer | string
  clientSpecific: boolean
  activeClientId: string | null
  sourceType: string | null      // e.g. 'book', 'ai_generated', 'unsourced_blog'
  sourceId: string | null
  title: string
  /** Stored `skill_cards.relevant_agents`; may contain legacy key spellings. */
  relevantAgents?: readonly string[] | null
}

export interface SourceRecord {
  id: string
  sourceType: string
  rightsStatus: string | null
  accessMode: string | null
}

// Layer priority (lower index = higher priority) — exactly the mission order.
const LAYER_PRIORITY: KnowledgeLayer[] = [
  'active_client_specific',
  'industry_specific',
  'south_african_market',
  'universal',
  'internal_learning',
  'source_chunks',
]

// The database `skill_cards.knowledge_layer` CHECK uses `universal_principle`
// (and other legacy spellings); the agent contracts + priority use the canonical
// KnowledgeLayer union. Normalise at READ time so a legacy/mislabelled layer can
// never silently bypass an agent's allow-list. The DB keeps its stored value.
const LAYER_ALIASES: Record<string, KnowledgeLayer> = {
  universal_principle: 'universal',
  universal: 'universal',
  sa_market: 'south_african_market',
  south_african_market: 'south_african_market',
  industry_specific: 'industry_specific',
  active_client_specific: 'active_client_specific',
  client_specific: 'active_client_specific',
  internal_learning: 'internal_learning',
  source_chunks: 'source_chunks',
}

export function normaliseKnowledgeLayer(layer: string | null | undefined): KnowledgeLayer | null {
  if (!layer) return null
  return LAYER_ALIASES[layer] ?? null
}

const NON_AUTHORITATIVE_SOURCE_TYPES = new Set(['ai_generated', 'unsourced_blog'])

// A source's full text may be returned only when rights + access mode permit it.
export function sourceTextRetrievable(source: SourceRecord): boolean {
  if (NON_AUTHORITATIVE_SOURCE_TYPES.has(source.sourceType)) return false
  if (source.rightsStatus === 'prohibited' || source.rightsStatus === 'research_only' || source.rightsStatus === 'bibliographic_only') return false
  return source.accessMode === 'full_text_allowed' || source.accessMode === 'excerpt_only'
}

// A source is authoritative (may back an applied principle) only when it is a
// real human/official source — never AI-generated or an unsourced blog.
export function isSourceAuthoritative(source: SourceRecord): boolean {
  return !NON_AUTHORITATIVE_SOURCE_TYPES.has(source.sourceType) && source.rightsStatus !== 'prohibited'
}

// Whether a Skill Card may reach a production agent for this context.
export function isCardRetrievable(card: SkillCardRecord, ctx: RetrievalContext): boolean {
  // AI-generated / unsourced source cards are never authoritative.
  if (card.sourceType && NON_AUTHORITATIVE_SOURCE_TYPES.has(card.sourceType)) return false
  // Production only ever sees active reviewed cards; admin research may see needs-review.
  if (ctx.mode === 'production') {
    if (card.status !== 'active') return false
  } else if (!['active', 'needs_review'].includes(card.status)) {
    return false
  }
  if (card.status === 'deprecated') return false
  // Client-specific cards require the EXACT active client — never cross-client,
  // never inactive-client data leaking into another client's context.
  if (card.clientSpecific) {
    if (!ctx.activeClientId || card.activeClientId !== ctx.activeClientId) return false
  }
  // The agent must be allowed to use this card's knowledge layer. Normalise the
  // stored (possibly legacy) layer first so a mislabelled value cannot bypass the
  // allow-list, and an unrecognised layer is excluded rather than trusted.
  const layer = normaliseKnowledgeLayer(card.knowledgeLayer)
  if (!layer || !ctx.agent.allowedKnowledgeLayers.includes(layer)) return false
  // The card must be addressed to THIS specialist. Legacy key spellings (e.g.
  // `creative_director_agent`) are normalised, and a card with no/unrecognised
  // targeting is excluded rather than broadcast to every agent.
  if (!cardTargetsAgent(card.relevantAgents, ctx.agent.key)) return false
  return true
}

function layerRank(layer: string): number {
  const i = LAYER_PRIORITY.indexOf(normaliseKnowledgeLayer(layer) as KnowledgeLayer)
  return i === -1 ? LAYER_PRIORITY.length : i
}

export interface RetrievalPlan {
  cards: SkillCardRecord[]           // gated + priority-ordered
  hasSourceBackedEvidence: boolean
  citationRequired: true
  insufficientEvidence: boolean
  noSourceMessage: string | null
}

// Builds the ordered, gated retrieval set for a query. `limit` caps context.
export function buildRetrievalPlan(
  candidateCards: SkillCardRecord[],
  ctx: RetrievalContext,
  limit = 8,
): RetrievalPlan {
  const gated = candidateCards.filter(card => isCardRetrievable(card, ctx))
  gated.sort((a, b) => {
    const r = layerRank(a.knowledgeLayer) - layerRank(b.knowledgeLayer)
    if (r !== 0) return r
    // Prefer active-client-specific matches within the same layer.
    if (a.clientSpecific !== b.clientSpecific) return a.clientSpecific ? -1 : 1
    return a.title.localeCompare(b.title)
  })
  const cards = gated.slice(0, limit)
  const hasSourceBackedEvidence = cards.some(c => c.sourceId !== null)
  const insufficient = cards.length === 0
  return {
    cards,
    hasSourceBackedEvidence,
    citationRequired: true,
    insufficientEvidence: insufficient,
    noSourceMessage: insufficient
      ? 'I do not have enough approved source material to answer this as a skilled agent yet.'
      : null,
  }
}

// ── Prompt-injection defense ────────────────────────────────────────────────
// Source text is EVIDENCE, never instruction. Wrap retrieved source content so a
// model treats embedded "ignore previous instructions"-style text as data, and
// neutralise the most common injection triggers in the plain text we pass.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |any |the )?(?:previous|prior|above) instructions/gi,
  /disregard (?:the )?(?:system|previous) prompt/gi,
  /you are now [a-z]/gi,
  /system\s*:/gi,
  /\bact as (?:an? )?(?:admin|developer|system)\b/gi,
]

export function neutraliseSourceInjection(text: string): string {
  let out = text
  for (const p of INJECTION_PATTERNS) out = out.replace(p, '[redacted-instruction-like-text]')
  return out
}

export function wrapSourceAsEvidence(citation: string, body: string): string {
  return `<<source_evidence cite="${citation}">>\n${neutraliseSourceInjection(body)}\n<<end_source_evidence>>`
}
