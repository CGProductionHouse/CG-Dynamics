import type { SourceType } from '../../types/skillCards'
import type { SourceTrustTier } from './skillCardsData'
import type { RegistrationCandidate } from './sourceRegistry'
import evidenceJson from '../../../docs/marketing-library/audience-lifecycle/commerce-psychology/evidence.json'

// ── Commerce evidence source bridge (#441) ────────────────────────────────────
//
// Maps commerce/choice/learning sources from the evidence ledger into
// RegistrationCandidate format for the Marketing Library pipeline.
//
// Rules:
//  • Access coverage is preserved exactly — abstract_only, selected_full_text,
//    full_page, official_summary are never coerced to full_read or upgraded.
//  • Unknown/unsupported accessLevel or sourceType is excluded (fail closed).
//  • All entries remain needs_review / metadata_reference only.
//  • Finding/limitation are preserved as review context, never as active doctrine.
//  • Repeat execution is idempotent via classifyRegistrations dedupe.
//  • No auto-activation, no trust upgrade, no production mutation.

interface CommerceEvidenceSource {
  id: string
  title: string
  publisher: string
  publicationDate: string | null
  sourceIdentifier: string
  canonicalUrl: string
  accessedAt: string
  accessLevel: string
  sourceType: string
  finding: string
  limitations: string
  reviewStatus: string
  fullTextReviewed: boolean
  fullTextCopied: boolean
  rights: string
  jurisdiction: string
}

/** Supported access levels — fail closed on anything else. */
const SUPPORTED_ACCESS_LEVELS = new Set([
  'abstract_only',
  'selected_full_text_sections',
  'full_page',
  'official_summary',
])

/** Supported source types — fail closed on anything else. */
const SUPPORTED_SOURCE_TYPES = new Set(['research_paper', 'official_documentation'])

function mapSourceType(raw: string): SourceType | null {
  if (raw === 'research_paper') return 'research_paper'
  if (raw === 'official_documentation') return 'official_documentation'
  return null
}

function deriveFamily(sourceType: SourceType): 'research_paper' | 'official_documentation' {
  if (sourceType === 'official_documentation') return 'official_documentation'
  return 'research_paper'
}

function isEligible(s: CommerceEvidenceSource): boolean {
  if (!SUPPORTED_ACCESS_LEVELS.has(s.accessLevel)) return false
  if (!SUPPORTED_SOURCE_TYPES.has(s.sourceType)) return false
  if (!s.sourceIdentifier || !s.canonicalUrl) return false
  if (!s.title?.trim() || !s.publisher?.trim() || !s.rights?.trim()) return false
  return true
}

/**
 * Bridge commerce evidence sources into RegistrationCandidate format.
 *
 * Preserves original access coverage exactly. All entries remain
 * needs_review / metadata_reference. Sorted by id for deterministic output.
 */
export function bridgeCommerceEvidenceSources(
  sources: CommerceEvidenceSource[] = (evidenceJson as unknown as { sources: CommerceEvidenceSource[] }).sources,
): RegistrationCandidate[] {
  return sources
    .filter(isEligible)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(s => {
      const sourceType = mapSourceType(s.sourceType)
      if (!sourceType) throw new Error(`Unexpected: eligible source ${s.id} has unsupported type ${s.sourceType}`)
      return {
        sourceIdentifier: s.sourceIdentifier,
        kind: 'cited_source' as const,
        family: deriveFamily(sourceType),
        title: s.title,
        author: s.publisher,
        canonicalUrl: s.canonicalUrl,
        sourceAttribution: `${s.publisher}.`,
        rightsNote: s.rights,
        sourceType,
        trustTier: 'needs_review' as SourceTrustTier,
        ingestionEligibility: 'metadata_reference' as const,
        citedIn: [`docs/marketing-library/audience-lifecycle/commerce-psychology/evidence.json#${s.id}`],
        accessCoverage: s.accessLevel,
        reviewContext: {
          finding: s.finding || undefined,
          limitations: s.limitations || undefined,
          jurisdiction: s.jurisdiction || undefined,
        },
      }
    })
}

/**
 * Summarise source eligibility from the full evidence ledger.
 * Returns counts by exclusion reason for reporting.
 */
export function summariseCommerceEligibility(
  sources: CommerceEvidenceSource[] = (evidenceJson as unknown as { sources: CommerceEvidenceSource[] }).sources,
): { eligible: number; excluded: number; byReason: Record<string, number>; byAccess: Record<string, number> } {
  const byReason: Record<string, number> = {}
  const byAccess: Record<string, number> = {}
  let eligible = 0
  let excluded = 0
  for (const s of sources) {
    if (isEligible(s)) {
      eligible++
      byAccess[s.accessLevel] = (byAccess[s.accessLevel] ?? 0) + 1
    } else {
      excluded++
      const reason = !SUPPORTED_ACCESS_LEVELS.has(s.accessLevel)
        ? `unsupported_access:${s.accessLevel}`
        : !SUPPORTED_SOURCE_TYPES.has(s.sourceType)
          ? `unsupported_type:${s.sourceType}`
          : 'missing_identifier'
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }
  }
  return { eligible, excluded, byReason, byAccess }
}

/** Raw source list for test inspection. */
export const COMMERCE_EVIDENCE_SOURCES: CommerceEvidenceSource[] = (evidenceJson as unknown as { sources: CommerceEvidenceSource[] }).sources
