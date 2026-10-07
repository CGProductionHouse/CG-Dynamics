import { AGENT_CONTRACTS, buildPlan, normaliseKnowledgeLayer, neutralise, type CardRow } from '../cg-assistant-chat/skilledAgents.ts'
import type { DirectorKnowledgeReference } from '../../../src/lib/contentDirectorEvidence.ts'

export interface DirectorCard extends CardRow {
  relevant_industries?: string[] | null
  confidence_level?: string | null
  evidence_label?: string | null
  safe_claim?: string | null
  prohibited_overclaim?: string | null
  updated_at?: string | null
  linked_source?: { trust_tier: string | null; source_type: string | null; rights_status: string | null } | null
}

/** Task applicability before the EXISTING specialist gate; no second routing system. */
export function selectDirectorKnowledge(cards: DirectorCard[], clientId: string, industry: string | null, today: string) {
  const applicable = cards.filter(card => {
    if ([card.id, card.title, card.source_id, card.source_reference, card.source_type].some(value => typeof value !== 'string' || !value.trim())) return false
    // Read back the CURRENT linked source, not just its trust at activation time.
    // These are the existing source tiers admitted by the DB activation contract.
    if (!card.linked_source || !['tier_1_primary', 'tier_2_trusted_professional', 'tier_3_internal_learning'].includes(card.linked_source.trust_tier ?? '')) return false
    if (card.linked_source.source_type !== card.source_type || card.linked_source.rights_status === 'prohibited') return false
    const layer = normaliseKnowledgeLayer(card.knowledge_layer)
    if (layer === 'industry_specific') {
      if (!industry || !Array.isArray(card.relevant_industries) || !card.relevant_industries.includes(industry)) return false
    }
    return true
  }).sort((a, b) => a.id.localeCompare(b.id))
  const plan = buildPlan(applicable, { agent: AGENT_CONTRACTS.creative_director, activeClientId: clientId, mode: 'production', today }, 8, 'content creative video')
  const selected = plan.cards as DirectorCard[]
  const references = selected.map(card => ({
    card_id: card.id, title: card.title, source_id: card.source_id!, source_reference: card.source_reference!,
    confidence_level: card.confidence_level ?? null, evidence_label: card.evidence_label ?? null,
    safe_claim: card.safe_claim ?? null, prohibited_overclaim: card.prohibited_overclaim ?? null,
    updated_at: card.updated_at ?? null,
  } satisfies DirectorKnowledgeReference))
  const lines = selected.map((card, index) => `<<source_evidence card="${card.id}">>\n${neutralise(JSON.stringify({
    ...references[index], principle: card.principle, summary: card.summary,
  }))}\n<<end_source_evidence>>`)
  return { references, lines, insufficient: plan.insufficient }
}

/** Calendar-day expiry uses CG's operating timezone, not UTC midnight. */
export function directorOperatingDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
