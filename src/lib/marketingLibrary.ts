import { supabase } from './supabase'

// ── Marketing Library — registered sources (read-only) ───────────────────────
//
// Read access to public.marketing_library_sources, the provenance/rights
// catalogue behind the Marketing/Knowledge workspace. RLS on that table is
// admin-only ("No staff or client access in v1"), so a non-admin simply reads
// an empty set — this layer never loosens that boundary and never writes.
// Registration/review writes happen through the reviewed admin server paths,
// not here. Filtering/search is pure so it is unit-tested without a database.

export type SourceType =
  | 'book' | 'research_paper' | 'official_documentation' | 'market_report'
  | 'internal_campaign_data' | 'client_interview' | 'staff_observation'
  | 'professional_source' | 'other' | 'ai_generated' | 'unsourced_blog'

export type TrustTier =
  | 'tier_1_primary' | 'tier_2_trusted_professional' | 'tier_3_internal_learning'
  | 'tier_4_low_trust' | 'needs_review'

export interface MarketingSource {
  id: string
  source_type: SourceType
  source_name: string
  author_or_organisation: string | null
  title: string | null
  publication_year: number | null
  chapter_or_section: string | null
  page_or_url: string | null
  notes: string | null
  trust_tier: TrustTier
  // phase-23a / phase-24a rights + reconciliation fields (nullable, additive).
  canonical_url: string | null
  edition: string | null
  language: string | null
  country: string | null
  source_identifier: string | null
  rights_status: string | null
  rights_basis: string | null
  licence_name: string | null
  commercial_use: string | null       // allowed | restricted | unknown
  full_text_storage: boolean | null
  access_mode: string | null
  rights_checked_at: string | null
  rights_review_notes: string | null
  ingestion_status: string | null     // catalogued | ...
  content_hash: string | null
  acquisition_status: string | null   // to_purchase | owned | available_for_review | reviewed | not_approved
  created_at: string
  updated_at: string
}

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

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  tier_1_primary: 'Tier 1 — primary',
  tier_2_trusted_professional: 'Tier 2 — trusted professional',
  tier_3_internal_learning: 'Tier 3 — internal learning',
  tier_4_low_trust: 'Tier 4 — low trust',
  needs_review: 'Needs review',
}

export interface QueryResult<T> {
  data: T
  error: string | null
  migrationNeeded: boolean
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('marketing_library_sources') && (message.includes('does not exist') || message.includes('schema cache'))
}

export async function listMarketingSources(): Promise<QueryResult<MarketingSource[]>> {
  const { data, error } = await supabase
    .from('marketing_library_sources')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    if (isMissingTableError(error)) return { data: [], error: null, migrationNeeded: true }
    return { data: [], error: error.message ?? 'Could not load the Marketing Library.', migrationNeeded: false }
  }
  return { data: (data ?? []) as MarketingSource[], error: null, migrationNeeded: false }
}

// ── Pure filtering / provenance helpers (no I/O) ─────────────────────────────

export interface SourceFilters {
  query?: string
  sourceType?: SourceType | 'all'
  trustTier?: TrustTier | 'all'
  commercialUse?: string | 'all'
  hasUrl?: boolean
  needsReview?: boolean
}

// The best available link for a source: an explicit canonical URL wins, else a
// URL-shaped page_or_url. Repository paths and page references are not links.
export function sourceUrl(source: Pick<MarketingSource, 'canonical_url' | 'page_or_url'>): string | null {
  const canonical = (source.canonical_url ?? '').trim()
  if (/^https?:\/\//i.test(canonical)) return canonical
  const page = (source.page_or_url ?? '').trim()
  if (/^https?:\/\//i.test(page)) return page
  return null
}

// A source still needs review when its trust tier is unset or it is flagged for
// review, or its rights have never been checked. Used to surface a review queue.
export function sourceNeedsReview(source: Pick<MarketingSource, 'trust_tier' | 'rights_checked_at'>): boolean {
  return source.trust_tier === 'needs_review' || !source.rights_checked_at
}

// AI-generated and unsourced material is never trusted knowledge on its own.
export function isUntrustedOrigin(source: Pick<MarketingSource, 'source_type'>): boolean {
  return source.source_type === 'ai_generated' || source.source_type === 'unsourced_blog'
}

export function filterMarketingSources(sources: MarketingSource[], filters: SourceFilters): MarketingSource[] {
  const query = (filters.query ?? '').trim().toLowerCase()
  return sources.filter(source => {
    if (filters.sourceType && filters.sourceType !== 'all' && source.source_type !== filters.sourceType) return false
    if (filters.trustTier && filters.trustTier !== 'all' && source.trust_tier !== filters.trustTier) return false
    if (filters.commercialUse && filters.commercialUse !== 'all' && (source.commercial_use ?? 'unknown') !== filters.commercialUse) return false
    if (filters.hasUrl && !sourceUrl(source)) return false
    if (filters.needsReview && !sourceNeedsReview(source)) return false
    if (!query) return true
    return [source.source_name, source.title ?? '', source.author_or_organisation ?? '', source.notes ?? '']
      .some(field => field.toLowerCase().includes(query))
  })
}
