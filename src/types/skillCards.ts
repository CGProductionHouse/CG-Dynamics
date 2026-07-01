export type SkillCardStatus = 'draft' | 'needs_review' | 'reviewed' | 'active' | 'deprecated'

export type KnowledgeLayer =
  | 'universal_principle'
  | 'south_african_market'
  | 'industry_specific'
  | 'active_client_specific'
  | 'internal_learning'

export type SourceType =
  | 'book'
  | 'research_paper'
  | 'official_documentation'
  | 'market_report'
  | 'internal_campaign_data'
  | 'client_interview'
  | 'staff_observation'
  | 'professional_source'
  | 'other'
  | 'ai_generated'
  | 'unsourced_blog'

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'opinion'

export type EvidenceLabel =
  | 'proven_principle'
  | 'platform_rule'
  | 'market_observation'
  | 'internal_learning'
  | 'client_opinion'
  | 'hypothesis'

export type RelevantAgent =
  | 'marketing_strategist'
  | 'copywriting_agent'
  | 'graphic_design_first_draft_agent'
  | 'brand_guardian'
  | 'paid_ads_agent'
  | 'seo_agent'
  | 'client_report_agent'
  | 'creative_director_agent'

export type IndustryTag =
  | 'real_estate'
  | 'restaurants_hospitality'
  | 'automotive'
  | 'construction'
  | 'architecture'
  | 'retail'
  | 'medical'
  | 'legal'
  | 'agriculture'
  | 'education'
  | 'tourism'
  | 'general'

export interface SkillCardSourceReference {
  sourceType: SourceType
  sourceName: string
  authorOrOrganisation?: string
  title?: string
  year?: number
  chapterOrSection?: string
  pageOrUrl?: string
  interpretationNotes?: string
}

export interface SkillCard {
  id: string
  title: string
  category: string
  subcategory?: string
  status: SkillCardStatus
  lastReviewed: string | null
  owner?: string
  knowledgeLayer: KnowledgeLayer
  sourceType: SourceType
  sourceReference: SkillCardSourceReference
  confidenceLevel: ConfidenceLevel
  evidenceLabel: EvidenceLabel
  relevantIndustries: IndustryTag[]
  relevantAgents: RelevantAgent[]
  principle: string
  summary: string
  whyItMatters: string
  howToApply: string[]
  examples: string[]
  mistakesToAvoid: string[]
  agentInstructions: string[]
  relatedCardIds: string[]
  notes?: string
  clientSpecific?: boolean
}
