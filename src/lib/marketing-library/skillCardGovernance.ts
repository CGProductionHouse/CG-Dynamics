import type {
  ConfidenceLevel,
  EvidenceLabel,
  IndustryTag,
  KnowledgeLayer,
  SkillCardStatus,
  SourceType,
} from '../../types/skillCards'
import type {
  SkillCardRecord,
  SkillCardReferenceState,
  SkillCardReviewStatus,
} from './skillCardsData'

export type SkillCardFreshness = 'current' | 'expired' | 'no_expiry'

export interface SkillCardFilters {
  search: string
  status: SkillCardStatus | 'all'
  layer: KnowledgeLayer | 'all'
  industry: IndustryTag | 'all'
  confidence: ConfidenceLevel | 'all'
  sourceType: SourceType | 'all'
  evidence: EvidenceLabel | 'all'
  category: string
  source: string
  reference: SkillCardReferenceState | 'missing' | 'all'
  freshness: SkillCardFreshness | 'all'
  review: SkillCardReviewStatus | 'none' | 'all'
}

export function getSkillCardFreshness(
  card: Pick<SkillCardRecord, 'review_expires_at'>,
  today: string,
): SkillCardFreshness {
  if (!card.review_expires_at) return 'no_expiry'
  return card.review_expires_at < today ? 'expired' : 'current'
}

export function matchesSkillCardFilters(
  card: SkillCardRecord,
  filters: SkillCardFilters,
  latestReviewStatus: SkillCardReviewStatus | null,
  today: string,
): boolean {
  if (filters.status !== 'all' && card.status !== filters.status) return false
  if (filters.layer !== 'all' && card.knowledge_layer !== filters.layer) return false
  if (filters.industry !== 'all' && !card.relevant_industries.includes(filters.industry)) return false
  if (filters.confidence !== 'all' && card.confidence_level !== filters.confidence) return false
  if (filters.sourceType !== 'all' && card.source_type !== filters.sourceType) return false
  if (filters.evidence !== 'all' && card.evidence_label !== filters.evidence) return false
  if (filters.category !== 'all' && card.category !== filters.category) return false
  if (filters.source === 'none' && card.source_id) return false
  if (filters.source !== 'all' && filters.source !== 'none' && card.source_id !== filters.source) return false
  if (filters.reference === 'missing' && card.reference_state) return false
  if (filters.reference !== 'all' && filters.reference !== 'missing' && card.reference_state !== filters.reference) return false
  if (filters.freshness !== 'all' && getSkillCardFreshness(card, today) !== filters.freshness) return false
  if (filters.review === 'none' && latestReviewStatus) return false
  if (filters.review !== 'all' && filters.review !== 'none' && latestReviewStatus !== filters.review) return false

  const query = filters.search.trim().toLowerCase()
  if (!query) return true
  return [card.title, card.slug, card.category, card.principle]
    .some(field => field.toLowerCase().includes(query))
}

export function getSkillCardStatusReason(
  card: Pick<SkillCardRecord, 'status' | 'source_id' | 'last_reviewed'>,
): string | null {
  if (card.status === 'active') return null
  if (card.status === 'draft') return 'Draft - not yet approved'
  if (card.status === 'needs_review') return 'Awaiting review'
  if (card.status === 'deprecated') return 'Deprecated - no longer active'

  const missing: string[] = []
  if (!card.source_id) missing.push('linked source')
  if (!card.last_reviewed) missing.push('last-reviewed date')
  return missing.length > 0
    ? `Reviewed; missing ${missing.join(' and ')}`
    : 'Reviewed; awaiting gated activation'
}

export function getSkillCardGovernanceWarnings(
  card: Pick<
    SkillCardRecord,
    | 'source_id'
    | 'source_reference'
    | 'reference_state'
    | 'safe_claim'
    | 'prohibited_overclaim'
    | 'jurisdiction'
    | 'review_expires_at'
  >,
  today: string,
): string[] {
  const warnings: string[] = []
  if (!card.source_id) warnings.push('Missing supporting source')
  if (!card.source_reference) warnings.push('Missing verified source reference')
  if (!card.safe_claim) warnings.push('Missing safe candidate claim')
  if (!card.prohibited_overclaim) warnings.push('Missing limitations or prohibited-overclaim boundary')
  if (!card.jurisdiction) warnings.push('Missing jurisdiction')
  if (!card.reference_state) warnings.push('Missing reference rights state')
  else if (card.reference_state !== 'human_verified') warnings.push('Reference rights are not human verified')
  if (getSkillCardFreshness(card, today) === 'expired') warnings.push('Review has expired - needs re-verification')
  return warnings
}
