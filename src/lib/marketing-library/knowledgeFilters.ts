import type { IndustryTag, KnowledgeLayer, SkillCardStatus, SourceType } from '../../types/skillCards'
import type { MarketingLibrarySource, SkillCardRecord, SourceTrustTier } from './skillCardsData'

// ── Marketing Library — pure presentation + filtering (no I/O) ───────────────
//
// Label maps and search/filter for the canonical Marketing Library records
// (skill cards + sources). No Supabase import, so these are unit-tested without
// a database and shared by the workspace UI. They read the same record shapes
// the canonical data layer (./skillCardsData) returns — one domain model.

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  book: 'Book',
  research_paper: 'Research paper',
  official_documentation: 'Official documentation',
  market_report: 'Market report',
  internal_campaign_data: 'Internal campaign data',
  client_interview: 'Client interview',
  staff_observation: 'Staff observation',
  professional_source: 'Professional source',
  other: 'Other',
  ai_generated: 'AI generated',
  unsourced_blog: 'Unsourced blog',
}

export const TRUST_TIER_LABELS: Record<SourceTrustTier, string> = {
  tier_1_primary: 'Tier 1 — primary',
  tier_2_trusted_professional: 'Tier 2 — trusted professional',
  tier_3_internal_learning: 'Tier 3 — internal learning',
  tier_4_low_trust: 'Tier 4 — low trust',
  needs_review: 'Needs review',
}

export const KNOWLEDGE_LAYER_LABELS: Record<KnowledgeLayer, string> = {
  universal_principle: 'Universal principle',
  south_african_market: 'South African market',
  industry_specific: 'Industry-specific',
  active_client_specific: 'Active-client-specific',
  internal_learning: 'Internal learning',
}

export const SKILL_STATUS_LABELS: Record<SkillCardStatus, string> = {
  draft: 'Draft',
  needs_review: 'Needs review',
  reviewed: 'Reviewed',
  active: 'Active',
  deprecated: 'Deprecated',
}

export const INDUSTRY_LABELS: Record<IndustryTag, string> = {
  real_estate: 'Real estate',
  restaurants_hospitality: 'Restaurants & hospitality',
  automotive: 'Automotive',
  construction: 'Construction',
  architecture: 'Architecture',
  retail: 'Retail',
  medical: 'Medical',
  legal: 'Legal',
  agriculture: 'Agriculture',
  education: 'Education',
  tourism: 'Tourism',
  general: 'General',
}

// ── Source provenance helpers ────────────────────────────────────────────────

export function sourceUrl(source: Pick<MarketingLibrarySource, 'canonical_url' | 'page_or_url'>): string | null {
  const canonical = (source.canonical_url ?? '').trim()
  if (/^https?:\/\//i.test(canonical)) return canonical
  const page = (source.page_or_url ?? '').trim()
  if (/^https?:\/\//i.test(page)) return page
  return null
}

export function sourceNeedsReview(source: Pick<MarketingLibrarySource, 'trust_tier' | 'rights_checked_at'>): boolean {
  return source.trust_tier === 'needs_review' || !source.rights_checked_at
}

// AI-generated and unsourced material is never trusted knowledge on its own.
export function isUntrustedOrigin(source: Pick<MarketingLibrarySource, 'source_type'>): boolean {
  return source.source_type === 'ai_generated' || source.source_type === 'unsourced_blog'
}

export interface SourceFilters {
  query?: string
  sourceType?: SourceType | 'all'
  trustTier?: SourceTrustTier | 'all'
  hasUrl?: boolean
  needsReview?: boolean
}

export function filterMarketingSources(sources: MarketingLibrarySource[], filters: SourceFilters): MarketingLibrarySource[] {
  const query = (filters.query ?? '').trim().toLowerCase()
  return sources.filter(source => {
    if (filters.sourceType && filters.sourceType !== 'all' && source.source_type !== filters.sourceType) return false
    if (filters.trustTier && filters.trustTier !== 'all' && source.trust_tier !== filters.trustTier) return false
    if (filters.hasUrl && !sourceUrl(source)) return false
    if (filters.needsReview && !sourceNeedsReview(source)) return false
    if (!query) return true
    return [source.source_name, source.title ?? '', source.author_or_organisation ?? '', source.notes ?? '']
      .some(field => field.toLowerCase().includes(query))
  })
}

// ── Skill-card knowledge helpers ─────────────────────────────────────────────

// A card whose scheduled review date has passed is stale and must be re-reviewed
// before it is trusted as current. `today` is an ISO date (YYYY-MM-DD).
export function skillCardIsStale(card: Pick<SkillCardRecord, 'review_expires_at'>, today: string): boolean {
  const expires = (card.review_expires_at ?? '').slice(0, 10)
  return Boolean(expires) && expires < today
}

// A card that is not yet approved-and-active knowledge.
export function skillCardNeedsReview(card: Pick<SkillCardRecord, 'status'>): boolean {
  return card.status === 'draft' || card.status === 'needs_review'
}

// A card with no linked source cannot be activated (phase-18c gate).
export function skillCardMissingSource(card: Pick<SkillCardRecord, 'source_id'>): boolean {
  return !card.source_id
}

export interface SkillCardFilters {
  query?: string
  category?: string | 'all'
  knowledgeLayer?: KnowledgeLayer | 'all'
  industry?: IndustryTag | 'all'
  status?: SkillCardStatus | 'all'
  // Review-queue toggles (admin/manager).
  needsReview?: boolean
  stale?: boolean
  missingSource?: boolean
}

export function filterSkillCards(cards: SkillCardRecord[], filters: SkillCardFilters, today: string): SkillCardRecord[] {
  const query = (filters.query ?? '').trim().toLowerCase()
  return cards.filter(card => {
    if (filters.category && filters.category !== 'all' && card.category !== filters.category) return false
    if (filters.knowledgeLayer && filters.knowledgeLayer !== 'all' && card.knowledge_layer !== filters.knowledgeLayer) return false
    if (filters.industry && filters.industry !== 'all' && !card.relevant_industries.includes(filters.industry)) return false
    if (filters.status && filters.status !== 'all' && card.status !== filters.status) return false
    if (filters.needsReview && !skillCardNeedsReview(card)) return false
    if (filters.stale && !skillCardIsStale(card, today)) return false
    if (filters.missingSource && !skillCardMissingSource(card)) return false
    if (!query) return true
    return [card.title, card.summary, card.principle, card.category, card.subcategory ?? '']
      .some(field => field.toLowerCase().includes(query))
  })
}
