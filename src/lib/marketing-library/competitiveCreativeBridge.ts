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
//  • Source type is deterministically classified from publisher + title keywords;
//    fail closed on unknown publisher/identity.
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

/** Official documentation publishers — platform docs, API docs, policy announcements. */
const OFFICIAL_PUBLISHERS = new Set(['Meta', 'TikTok', 'Google', 'Foreplay', 'Motion'])

/** Vendor/estimation publishers — estimation tools, pricing pages, third-party products. */
const VENDOR_PUBLISHERS = new Set(['Brandsearch', 'WinningHunter', 'Kalodata'])

/** Case report title keywords — distinguishable from platform docs. */
const CASE_REPORT_KEYWORDS = /case report|case study|friends.*brgrs|botanist|scroll stop/i

/** Pricing-page title keywords — distinguishable from product docs. */
const PRICING_KEYWORDS = /pricing|price|plan comparison|cost|spending.*intelligence|data-accuracy/i

function isCaseReport(s: CompetitiveCreativeSource): boolean {
  return CASE_REPORT_KEYWORDS.test(s.title)
}

function isPricingPage(s: CompetitiveCreativeSource): boolean {
  return PRICING_KEYWORDS.test(s.title)
}

/**
 * Deterministic source-type classification.
 *
 * Official provider documentation → official_documentation
 * Provider case reports → professional_source (not platform docs)
 * Vendor estimation/pricing → professional_source
 * Unknown publisher → fail closed (null)
 */
function classifySourceType(s: CompetitiveCreativeSource): SourceType | null {
  if (OFFICIAL_PUBLISHERS.has(s.publisher)) {
    if (isCaseReport(s)) return 'professional_source'
    if (isPricingPage(s)) return 'professional_source'
    return 'official_documentation'
  }
  if (VENDOR_PUBLISHERS.has(s.publisher)) {
    return 'professional_source'
  }
  return null
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
  if (!classifySourceType(s)) return `unknown_publisher:${s.publisher}`
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
      if (!sourceType) throw new Error(`Unexpected: eligible source ${s.id} has unclassifiable publisher ${s.publisher}`)
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
