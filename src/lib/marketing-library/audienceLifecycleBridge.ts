import type { SourceType } from '../../types/skillCards'
import type { SourceTrustTier } from './skillCardsData'
import type { RegistrationCandidate } from './sourceRegistry'
import sourcesJson from '../../../docs/marketing-library/audience-lifecycle/sources.json'

// ── Audience Lifecycle source bridge (#426) ───────────────────────────────────
//
// Maps eligible official FULL-READ sources from the audience-lifecycle
// source ledger into RegistrationCandidate format for the Marketing Library
// source-registration pipeline.
//
// Rules:
//  • FULL-READ official sources only — blocked, rate-limited, login-gated,
//    partial/abstract sources are excluded;
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

/** Map sourceType string from sources.json to the canonical SourceType union. */
function mapSourceType(raw: string): SourceType {
  if (raw === 'official_documentation') return 'official_documentation'
  if (raw === 'professional_source') return 'professional_source'
  return 'other'
}

/** Derive CitedSourceFamily from sourceType. */
function deriveFamily(sourceType: SourceType): 'official_documentation' | 'professional_source' {
  if (sourceType === 'professional_source') return 'professional_source'
  return 'official_documentation'
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
    .filter(s => ELIGIBLE_ACCESS.has(s.sourceAccess))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(s => {
      const sourceType = mapSourceType(s.sourceType)
      return {
        sourceIdentifier: s.sourceIdentifier,
        kind: 'cited_source' as const,
        family: deriveFamily(sourceType),
        title: s.title,
        author: s.publisher,
        canonicalUrl: s.canonicalUrl,
        sourceAttribution: `${s.publisher} official documentation.`,
        rightsNote: s.rights,
        sourceType,
        trustTier: 'needs_review' as SourceTrustTier,
        ingestionEligibility: 'metadata_reference' as const,
        citedIn: [`docs/marketing-library/audience-lifecycle/sources.json#${s.key}`],
      }
    })
}

/**
 * Summarise source eligibility from the full source list.
 * Returns counts by access reason for reporting.
 */
export function summariseEligibility(
  sources: AudienceLifecycleSource[] = (sourcesJson as unknown as { sources: AudienceLifecycleSource[] }).sources,
): { eligible: number; excluded: number; byReason: Record<string, number> } {
  const byReason: Record<string, number> = {}
  let eligible = 0
  let excluded = 0
  for (const s of sources) {
    if (ELIGIBLE_ACCESS.has(s.sourceAccess)) {
      eligible++
    } else {
      excluded++
      byReason[s.sourceAccess] = (byReason[s.sourceAccess] ?? 0) + 1
    }
  }
  return { eligible, excluded, byReason }
}

/** Raw source list for test inspection. */
export const AUDIENCE_LIFECYCLE_SOURCES: AudienceLifecycleSource[] = (sourcesJson as unknown as { sources: AudienceLifecycleSource[] }).sources
