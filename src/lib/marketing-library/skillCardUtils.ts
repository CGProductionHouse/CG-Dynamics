import type { IndustryTag, RelevantAgent, SkillCard, SourceType } from '../../types/skillCards'

const LOW_TRUST_SOURCE_TYPES: SourceType[] = ['ai_generated', 'unsourced_blog', 'other']

export function filterSkillCardsByCategory(cards: SkillCard[], category: string): SkillCard[] {
  const target = category.trim().toLowerCase()
  return cards.filter(card => card.category.toLowerCase() === target)
}

export function filterSkillCardsByIndustry(cards: SkillCard[], industry: IndustryTag): SkillCard[] {
  return cards.filter(card => card.relevantIndustries.includes(industry))
}

export function filterSkillCardsByRelevantAgent(cards: SkillCard[], agent: RelevantAgent): SkillCard[] {
  return cards.filter(card => card.relevantAgents.includes(agent))
}

export function isSkillCardActive(card: SkillCard): boolean {
  return card.status === 'active'
}

export function isClientSpecificSkillCard(card: SkillCard): boolean {
  return card.clientSpecific === true || card.knowledgeLayer === 'active_client_specific'
}

export function hasLowTrustSourceType(card: SkillCard): boolean {
  return LOW_TRUST_SOURCE_TYPES.includes(card.sourceType)
}

export function getLowTrustSourceTypes(): SourceType[] {
  return [...LOW_TRUST_SOURCE_TYPES]
}
