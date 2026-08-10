import type { IndustryTag, SourceType } from '../../types/skillCards'
import type { MarketingLibrarySource, SourceTrustTier } from './skillCardsData'

// ── #184 Repository source registration manifest (pure) ──────────────────────
//
// A deterministic inventory of the human-marketing research documents already in
// the repository, prepared for reviewed registration into
// public.marketing_library_sources. This module is the single source of truth
// for both the app inventory view and the idempotent seed migration
// (phase-28a) — a test asserts the two stay in sync.
//
// Rules honoured here:
//  • stable identifier = `repo:<path>` (never a guessed DB id) → dedupe key;
//  • registered as reference/metadata only — no copyrighted full text;
//  • trust tier starts at needs_review — nothing is auto-approved;
//  • an existing live source with the same identifier is never duplicated.

export type SourceFamily = 'industry_pack' | 'source_pack'

export interface RepoSourceCandidate {
  /** Stable identifier — `repo:<repository path>`. Never a database id. */
  sourceIdentifier: string
  repoPath: string
  title: string
  family: SourceFamily
  industries: IndustryTag[]
  sourceType: SourceType
  trustTier: SourceTrustTier
  /** Reference-only registration; copyrighted full text is never ingested. */
  ingestionEligibility: 'metadata_reference'
  reason: string
}

const DOCS = 'docs/ai-workforce'

// [filename, human title, family, industries]
type Row = [string, string, SourceFamily, IndustryTag[]]

const INDUSTRY_PACKS: Row[] = [
  ['AGRICULTURE-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Agriculture human-marketing goldmine', 'industry_pack', ['agriculture']],
  ['AUTOMOTIVE-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Automotive human-marketing goldmine', 'industry_pack', ['automotive']],
  ['B2B-MANUFACTURING-INDUSTRIAL-SUPPLIERS-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'B2B manufacturing & industrial suppliers goldmine', 'industry_pack', ['general']],
  ['BUILDING-MATERIALS-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Building materials & home improvement goldmine', 'industry_pack', ['construction']],
  ['BUILDING-MATERIALS-SUSTAINABILITY-GREEN-ENERGY-MARKETING-GOLDMINE-2026-08.md', 'Building sustainability & green energy goldmine', 'industry_pack', ['construction']],
  ['COMMUNITY-SPORT-ENTERTAINMENT-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Community, sport & entertainment goldmine', 'industry_pack', ['general']],
  ['EDUCATION-TRAINING-SKILLS-DEVELOPMENT-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Education, training & skills development goldmine', 'industry_pack', ['education']],
  ['FINANCIAL-INSURANCE-CREDIT-SERVICES-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Financial, insurance & credit services goldmine', 'industry_pack', ['general']],
  ['HEALTHCARE-WELLNESS-MEDICAL-SERVICES-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Healthcare, wellness & medical services goldmine', 'industry_pack', ['medical']],
  ['HOSPITALITY-RESTAURANTS-BARS-EVENTS-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Hospitality, restaurants, bars & events goldmine', 'industry_pack', ['restaurants_hospitality']],
  ['LEGAL-PROFESSIONAL-SERVICES-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Legal & professional services goldmine', 'industry_pack', ['legal']],
  ['MUSIC-ENTERTAINMENT-CREATORS-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Music, entertainment & creators goldmine', 'industry_pack', ['general']],
  ['PROPERTY-ARCHITECTURE-CONSTRUCTION-SERVICES-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Property, architecture & construction services goldmine', 'industry_pack', ['real_estate', 'architecture', 'construction']],
  ['RETAIL-ECOMMERCE-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Retail & ecommerce goldmine', 'industry_pack', ['retail']],
  ['SECURITY-GUARDING-SURVEILLANCE-RISK-SERVICES-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Security, guarding & risk services goldmine', 'industry_pack', ['general']],
  ['TOURISM-ACCOMMODATION-DESTINATION-HUMAN-MARKETING-GOLDMINE-2026-08.md', 'Tourism, accommodation & destinations goldmine', 'industry_pack', ['tourism']],
]

const SOURCE_PACKS: Row[] = [
  ['BRAND-STRATEGY-CREATIVE-EFFECTIVENESS-SOURCE-PACK.md', 'Brand strategy & creative effectiveness source pack', 'source_pack', ['general']],
  ['CONVERSION-EXPERIMENTATION-SOURCE-PACK.md', 'Conversion & experimentation source pack', 'source_pack', ['general']],
  ['CREATOR-INFLUENCER-PARTNERSHIP-SOURCE-PACK.md', 'Creator & influencer partnership source pack', 'source_pack', ['general']],
  ['HOOKS-TREND-LED-CREATIVE-SOURCE-PACK.md', 'Hooks & trend-led creative source pack', 'source_pack', ['general']],
  ['LANDING-PAGE-OFFER-CONVERSION-WRITING-SOURCE-PACK.md', 'Landing page, offer & conversion writing source pack', 'source_pack', ['general']],
  ['LIFECYCLE-MESSAGING-CRM-SOURCE-PACK.md', 'Lifecycle, messaging & CRM source pack', 'source_pack', ['general']],
  ['LOCAL-MARKETING-REPUTATION-SOURCE-PACK.md', 'Local marketing & reputation source pack', 'source_pack', ['general']],
  ['PAID-ADS-WEBSITE-LEADS-SOURCE-PACK.md', 'Paid ads, website & leads source pack', 'source_pack', ['general']],
  ['SHOPIFY-COMMERCE-PLATFORM-SOURCE-PACK.md', 'Shopify & commerce platform source pack', 'source_pack', ['retail']],
  ['SOCIAL-NATIVE-SHORT-FORM-STORYTELLING-SOURCE-PACK.md', 'Social-native short-form storytelling source pack', 'source_pack', ['general']],
  ['STORYTELLING-SCRIPTWRITING-SHORT-FORM-CRAFT-SOURCE-PACK.md', 'Storytelling & scriptwriting craft source pack', 'source_pack', ['general']],
  ['STRATEGY-RESEARCH-HISTORICAL-SOURCE-PACK.md', 'Strategy, research & historical advertising source pack', 'source_pack', ['general']],
  ['VIDEO-PHOTOGRAPHY-SOUND-EDITING-CRAFT-SOURCE-PACK.md', 'Video, photography & sound editing craft source pack', 'source_pack', ['general']],
]

function toCandidate([file, title, family, industries]: Row): RepoSourceCandidate {
  const repoPath = `${DOCS}/${file}`
  return {
    sourceIdentifier: `repo:${repoPath}`,
    repoPath,
    title,
    family,
    industries,
    // Curated human research digests — professional secondary sources, not raw
    // primary works. Registered as needs_review so nothing is trusted on import.
    sourceType: 'professional_source',
    trustTier: 'needs_review',
    ingestionEligibility: 'metadata_reference',
    reason: family === 'industry_pack'
      ? 'Human-marketing industry research digest; reference metadata only pending review.'
      : 'Cross-industry marketing source pack; reference metadata only pending review.',
  }
}

// The full deterministic manifest (industry packs first, then source packs).
export const REPO_SOURCE_MANIFEST: RepoSourceCandidate[] = [...INDUSTRY_PACKS, ...SOURCE_PACKS].map(toCandidate)

// ── Deterministic dedupe / classification against live sources ───────────────

export interface RegistrationClassification {
  registered: RepoSourceCandidate[]      // already present live (by stable identifier)
  unregistered: RepoSourceCandidate[]    // eligible to register
  duplicateInManifest: string[]          // repeated identifiers in the manifest (must be empty)
  counts: { manifest: number; registered: number; unregistered: number; duplicateInManifest: number }
}

// Classify each manifest candidate against the existing live sources using the
// stable `repo:` identifier — never a guessed id and never a fuzzy title match,
// so re-running registration is idempotent and can never duplicate a live row.
export function classifyRegistrations(
  manifest: RepoSourceCandidate[],
  existingSources: Array<Pick<MarketingLibrarySource, 'source_identifier'>>,
): RegistrationClassification {
  const existingIds = new Set(
    existingSources.map(source => (source.source_identifier ?? '').trim()).filter(Boolean),
  )
  const seen = new Set<string>()
  const duplicateInManifest: string[] = []
  const registered: RepoSourceCandidate[] = []
  const unregistered: RepoSourceCandidate[] = []

  for (const candidate of manifest) {
    if (seen.has(candidate.sourceIdentifier)) {
      duplicateInManifest.push(candidate.sourceIdentifier)
      continue
    }
    seen.add(candidate.sourceIdentifier)
    if (existingIds.has(candidate.sourceIdentifier)) registered.push(candidate)
    else unregistered.push(candidate)
  }

  return {
    registered,
    unregistered,
    duplicateInManifest,
    counts: {
      manifest: manifest.length,
      registered: registered.length,
      unregistered: unregistered.length,
      duplicateInManifest: duplicateInManifest.length,
    },
  }
}
