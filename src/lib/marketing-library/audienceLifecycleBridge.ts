import type { SourceType } from '../../types/skillCards'
import type { SourceTrustTier } from './skillCardsData'
import type { RegistrationCandidate } from './sourceRegistry'
import sourcesJson from '../../../docs/marketing-library/audience-lifecycle/sources.json'

// ── Audience Lifecycle source bridge (#426) ───────────────────────────────────
//
// Maps eligible FULL-READ official sources from the audience-lifecycle
// source ledger into RegistrationCandidate format for the Marketing Library
// source-registration pipeline.
//
// Rules:
//  • Eligibility requires BOTH full_read access AND a supported
//    first-party/provider-owned source class:
//    - official_documentation (Google, TikTok official docs)
//    - professional_source where publisher is explicitly Meta-owned first-party
//  • Unknown/unsupported sourceType is excluded (fail closed).
//  • blocked_login, rate_limited, login-gated sources are excluded.
//  • all mapped entries remain needs_review / reference-only;
//  • no auto-activation, no trust upgrade;
//  • repeat execution is idempotent (dedupe by sourceIdentifier via
//    classifyRegistrations in sourceRegistry.ts);
//  • evidence/access level is preserved and never silently upgraded.

interface AudienceLifecycleSource {
  key: string
  publisher: string
  title: string
  sourceIdentifier: string
  canonicalUrl: string
  pageDate: string | null
  accessedAt: string
  sourceAccess: string
  status: string
  trustTier: string
  sourceType: string
  rights: string
  finding: string | null
  limitation: string | null
  reviewDue: string
}

/** Eligible sourceAccess values for this checkpoint. */
const ELIGIBLE_ACCESS = new Set(['full_read'])

/** Supported first-party/provider-owned source types for this pack. */
const SUPPORTED_SOURCE_TYPES = new Set(['official_documentation', 'professional_source'])

/** Explicitly trusted Meta-owned first-party publishers (for professional_source). */
const META_OWNED_PUBLISHERS = new Set(['Meta'])

/** Map sourceType string from sources.json to the canonical SourceType union. */
function mapSourceType(raw: string): SourceType | null {
  if (raw === 'official_documentation') return 'official_documentation'
  if (raw === 'professional_source') return 'professional_source'
  return null
}

/** Derive CitedSourceFamily from sourceType. */
function deriveFamily(sourceType: SourceType): 'official_documentation' | 'professional_source' {
  if (sourceType === 'professional_source') return 'professional_source'
  return 'official_documentation'
}

/** Build source attribution matching the actual stored sourceType. */
function buildAttribution(publisher: string, sourceType: SourceType): string {
  if (sourceType === 'professional_source') return `${publisher} first-party publication.`
  return `${publisher} official documentation.`
}

function isEligible(s: AudienceLifecycleSource): boolean {
  if (!ELIGIBLE_ACCESS.has(s.sourceAccess)) return false
  if (!SUPPORTED_SOURCE_TYPES.has(s.sourceType)) return false
  if (s.sourceType === 'professional_source' && !META_OWNED_PUBLISHERS.has(s.publisher)) return false
  return true
}

/**
 * Bridge audience-lifecycle FULL-READ official sources into
 * RegistrationCandidate format for the Marketing Library pipeline.
 *
 * Returns candidates sorted by key for deterministic output.
 * All entries: trustTier = needs_review, ingestionEligibility = metadata_reference.
 */
export function bridgeAudienceLifecycleSources(
  sources: AudienceLifecycleSource[] = (sourcesJson as unknown as { sources: AudienceLifecycleSource[] }).sources,
): RegistrationCandidate[] {
  return sources
    .filter(isEligible)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(s => {
      const sourceType = mapSourceType(s.sourceType)
      if (!sourceType) throw new Error(`Unexpected: eligible source ${s.key} has unsupported type ${s.sourceType}`)
      return {
        sourceIdentifier: s.sourceIdentifier,
        kind: 'cited_source' as const,
        family: deriveFamily(sourceType),
        title: s.title,
        author: s.publisher,
        canonicalUrl: s.canonicalUrl,
        sourceAttribution: buildAttribution(s.publisher, sourceType),
        rightsNote: s.rights,
        sourceType,
        trustTier: 'needs_review' as SourceTrustTier,
        ingestionEligibility: 'metadata_reference' as const,
        citedIn: [`docs/marketing-library/audience-lifecycle/sources.json#${s.key}`],
        pageDate: s.pageDate || undefined,
        accessedAt: s.accessedAt || undefined,
        reviewDue: s.reviewDue || undefined,
        sourceStatus: s.status || undefined,
      }
    })
}

/**
 * Summarise source eligibility from the full source list.
 * Returns counts by exclusion reason for reporting.
 */
export function summariseEligibility(
  sources: AudienceLifecycleSource[] = (sourcesJson as unknown as { sources: AudienceLifecycleSource[] }).sources,
): { eligible: number; excluded: number; byReason: Record<string, number> } {
  const byReason: Record<string, number> = {}
  let eligible = 0
  let excluded = 0
  for (const s of sources) {
    if (isEligible(s)) {
      eligible++
    } else {
      excluded++
      const reason = !ELIGIBLE_ACCESS.has(s.sourceAccess)
        ? s.sourceAccess
        : !SUPPORTED_SOURCE_TYPES.has(s.sourceType)
          ? `unsupported_type:${s.sourceType}`
          : `unsupported_publisher:${s.publisher}`
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }
  }
  return { eligible, excluded, byReason }
}

/** Raw source list for test inspection. */
export const AUDIENCE_LIFECYCLE_SOURCES: AudienceLifecycleSource[] = (sourcesJson as unknown as { sources: AudienceLifecycleSource[] }).sources
