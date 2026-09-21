import type { SourceType } from '../../types/skillCards'
import type { SourceTrustTier } from './skillCardsData'
import type { RegistrationCandidate } from './sourceRegistry'
import evidenceJson from '../../../docs/marketing-library/audience-lifecycle/competitive-creative/evidence.json'

// ── Competitive-creative evidence source bridge (#444) ────────────────────────
//
// Maps competitive-creative evidence sources into RegistrationCandidate format
// for the Marketing Library pipeline.
//
// Rules:
//  • Coverage state is preserved exactly — interface_shell_only, indexed_excerpt_only,
//    selected_sections, full_page_text, page_text_price_unavailable are never
//    coerced to full_read or upgraded.
//  • Source type is classified by explicit evidence-ID lookup; unknown IDs fail
//    closed even when publisher is known.
//  • All entries remain needs_review / metadata_reference only.
//  • Finding/limitation are preserved as review context, never as active doctrine.
//  • Repeat execution is idempotent via classifyRegistrations dedupe.
//  • No auto-activation, no trust upgrade, no production mutation.
//  • No competitor-media, scraping, API credentials, or production mutation path.

interface CompetitiveCreativeSource {
  id: string
  title: string
  publisher: string
  url: string
  coverage: string
  pageDate: string | null
  finding: string
  limitation: string
  status: string
  accessedAt: string
  reviewDue: string
  rights: string
}

/** Supported coverage states — fail closed on anything else. */
const SUPPORTED_COVERAGE_STATES = new Set([
  'interface_shell_only',
  'indexed_excerpt_only',
  'selected_sections',
  'full_page_text',
  'page_text_price_unavailable',
])

/**
 * Explicit evidence-ID → source-type classification.
 *
 * Each ID is classified once against its actual evidence nature:
 *  • official_documentation: platform docs, API references, policy announcements
 *  • professional_source: interface probes, case reports, vendor estimation/pricing
 *
 * Unknown IDs fail closed (null) even if the publisher appears in the ledger.
 * This prevents fuzzy publisher matching from promoting non-documentation evidence.
 */
const SOURCE_TYPE_BY_ID: Record<string, SourceType> = {
  M0: 'professional_source',   // Meta Ad Library interface-only probe — not documentation
  M1: 'official_documentation', // Meta DSA transparency announcement
  M2: 'official_documentation', // Meta Ad Library API indexed reference
  T1: 'official_documentation', // TikTok About Top Ads
  T2: 'official_documentation', // TikTok Top Ads Dashboard guide
  T3: 'official_documentation', // TikTok Commercial Content API overview
  T4: 'official_documentation', // TikTok Commercial Content API countries
  T5: 'official_documentation', // TikTok non-paid commercial content query
  G1: 'official_documentation', // Google Ads transparency help
  B1: 'professional_source',    // Brandsearch estimation methods
  B2: 'professional_source',    // Brandsearch product claims
  B3: 'professional_source',    // Brandsearch pricing review
  W1: 'professional_source',    // WinningHunter data-accuracy help
  W2: 'professional_source',    // WinningHunter product/pricing
  K1: 'professional_source',    // Kalodata FAQ/data limitations
  K2: 'professional_source',    // Kalodata pricing interface probe
  F1: 'official_documentation', // Foreplay API product documentation
  F2: 'professional_source',    // Foreplay pricing page
  O1: 'official_documentation', // Motion MCP documentation
  O2: 'professional_source',    // Motion pricing/scope review
  C1: 'professional_source',    // TikTok Friends & Brgrs case report
  C2: 'professional_source',    // TikTok The Botanist case report
}

function classifySourceType(s: CompetitiveCreativeSource): SourceType | null {
  return SOURCE_TYPE_BY_ID[s.id] ?? null
}

function deriveFamily(sourceType: SourceType): 'official_documentation' | 'professional_source' {
  if (sourceType === 'official_documentation') return 'official_documentation'
  return 'professional_source'
}

function isEligible(s: CompetitiveCreativeSource): boolean {
  if (!SUPPORTED_COVERAGE_STATES.has(s.coverage)) return false
  if (!classifySourceType(s)) return false
  if (!s.id || !s.url) return false
  if (!s.title?.trim() || !s.publisher?.trim() || !s.rights?.trim()) return false
  return true
}

function exclusionReason(s: CompetitiveCreativeSource): string {
  if (!SUPPORTED_COVERAGE_STATES.has(s.coverage)) return `unsupported_coverage:${s.coverage}`
  if (!classifySourceType(s)) return `unknown_source_id:${s.id}`
  if (!s.id || !s.url) return 'missing_identifier'
  if (!s.title?.trim()) return 'missing_title'
  if (!s.publisher?.trim()) return 'missing_publisher'
  if (!s.rights?.trim()) return 'missing_rights'
  return 'unknown'
}

/**
 * Bridge competitive-creative evidence sources into RegistrationCandidate format.
 *
 * Preserves original coverage state exactly. All entries remain
 * needs_review / metadata_reference. Sorted by id for deterministic output.
 */
export function bridgeCompetitiveCreativeSources(
  sources: CompetitiveCreativeSource[] = (evidenceJson as unknown as { sources: CompetitiveCreativeSource[] }).sources,
): RegistrationCandidate[] {
  return sources
    .filter(isEligible)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(s => {
      const sourceType = classifySourceType(s)
      if (!sourceType) throw new Error(`Unexpected: eligible source ${s.id} has no explicit classification`)
      return {
        sourceIdentifier: s.url,
        kind: 'cited_source' as const,
        family: deriveFamily(sourceType),
        title: s.title,
        author: s.publisher,
        canonicalUrl: s.url,
        sourceAttribution: `${s.publisher}.`,
        rightsNote: s.rights,
        sourceType,
        trustTier: 'needs_review' as SourceTrustTier,
        ingestionEligibility: 'metadata_reference' as const,
        citedIn: [`docs/marketing-library/audience-lifecycle/competitive-creative/evidence.json#${s.id}`],
        accessCoverage: s.coverage,
        reviewContext: {
          finding: s.finding || undefined,
          limitations: s.limitation || undefined,
        },
        pageDate: s.pageDate || undefined,
        accessedAt: s.accessedAt || undefined,
        reviewDue: s.reviewDue || undefined,
        sourceStatus: s.status || undefined,
      }
    })
}

/**
 * Summarise source eligibility from the full evidence ledger.
 * Returns counts by exclusion reason and coverage for reporting.
 */
export function summariseCompetitiveCreativeEligibility(
  sources: CompetitiveCreativeSource[] = (evidenceJson as unknown as { sources: CompetitiveCreativeSource[] }).sources,
): { eligible: number; excluded: number; byReason: Record<string, number>; byCoverage: Record<string, number>; bySourceType: Record<string, number> } {
  const byReason: Record<string, number> = {}
  const byCoverage: Record<string, number> = {}
  const bySourceType: Record<string, number> = {}
  let eligible = 0
  let excluded = 0
  for (const s of sources) {
    if (isEligible(s)) {
      eligible++
      byCoverage[s.coverage] = (byCoverage[s.coverage] ?? 0) + 1
      const st = classifySourceType(s) ?? 'unknown'
      bySourceType[st] = (bySourceType[st] ?? 0) + 1
    } else {
      excluded++
      const reason = exclusionReason(s)
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }
  }
  return { eligible, excluded, byReason, byCoverage, bySourceType }
}

/** Raw source list for test inspection. */
export const COMPETITIVE_CREATIVE_SOURCES: CompetitiveCreativeSource[] = (evidenceJson as unknown as { sources: CompetitiveCreativeSource[] }).sources
