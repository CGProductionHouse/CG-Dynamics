import type { SourceType } from '../../types/skillCards'
import type { MarketingLibrarySource, SourceTrustTier } from './skillCardsData'
import type { CitedSourceFamily } from './citedSourceExtraction'
import { CITED_SOURCES, CONTAINER_REFERENCES, PACK_FILES } from './citedSources.generated'

// ── #184 Repository source registration (pure) ───────────────────────────────
//
// Registration operates on the DISTINCT CITED SOURCES found inside the reusable
// research packs (campaign case studies, books, official platform docs,
// open-access research), not one flattened row per markdown file. Those cited
// sources are extracted deterministically from the pack text
// (citedSourceExtraction.ts) into the committed manifest
// (citedSources.generated.ts); this module normalises them — plus the pack
// container references — into registration candidates and reconciles them
// against the live Marketing Library.
//
// Rules honoured here:
//  • stable identifier = canonical URL, else `repo:<path>#<slug>` (cited
//    sources) or `repo:<path>` (containers) → never a guessed database id;
//  • registered as reference/metadata only — no copyrighted full text;
//  • trust tier starts at needs_review — nothing is auto-approved;
//  • an existing live source with the same identifier is never duplicated;
//  • the container document may be registered as a reference, but never as a
//    substitute for its underlying cited sources.

export { PACK_FILES }

export type RegistrationKind = 'cited_source' | 'container'

export interface RegistrationCandidate {
  /** Stable identifier — canonical URL or `repo:` path. Never a database id. */
  sourceIdentifier: string
  kind: RegistrationKind
  family: CitedSourceFamily
  title: string
  author: string | null
  canonicalUrl: string | null
  sourceAttribution: string | null
  rightsNote: string | null
  sourceType: SourceType
  trustTier: SourceTrustTier
  /** Reference-only registration; copyrighted full text is never ingested. */
  ingestionEligibility: 'metadata_reference'
  /** Pack file paths this source is cited in (container provenance). */
  citedIn: string[]
}

const citedCandidates: RegistrationCandidate[] = CITED_SOURCES.map(source => ({
  sourceIdentifier: source.sourceIdentifier,
  kind: 'cited_source',
  family: source.family,
  title: source.title,
  author: source.author,
  canonicalUrl: source.canonicalUrl,
  sourceAttribution: source.sourceAttribution,
  rightsNote: source.rightsNote,
  sourceType: source.sourceType,
  trustTier: source.trustTier,
  ingestionEligibility: 'metadata_reference',
  citedIn: source.citedIn,
}))

const containerCandidates: RegistrationCandidate[] = CONTAINER_REFERENCES.map(container => ({
  sourceIdentifier: container.sourceIdentifier,
  kind: 'container',
  family: 'container',
  title: container.title,
  author: null,
  canonicalUrl: null,
  sourceAttribution: null,
  rightsNote: null,
  sourceType: 'professional_source',
  trustTier: 'needs_review',
  ingestionEligibility: 'metadata_reference',
  citedIn: [container.path],
}))

// Cited sources first (the substance), then the pack container references.
export const REGISTRATION_MANIFEST: RegistrationCandidate[] = [...citedCandidates, ...containerCandidates]

export const CITED_SOURCE_CANDIDATES = citedCandidates
export const CONTAINER_CANDIDATES = containerCandidates

// ── Deterministic dedupe / classification against live sources ───────────────

export interface RegistrationClassification {
  registered: RegistrationCandidate[]      // already present live (by stable identifier)
  unregistered: RegistrationCandidate[]    // eligible to register
  duplicateInManifest: string[]            // repeated identifiers in the manifest (must be empty)
  counts: {
    manifest: number
    citedSources: number
    containers: number
    registered: number
    unregistered: number
    duplicateInManifest: number
  }
}

// Classify each manifest candidate against the existing live sources using the
// stable identifier — never a guessed id and never a fuzzy title match, so
// re-running registration is idempotent and can never duplicate a live row.
export function classifyRegistrations(
  manifest: RegistrationCandidate[],
  existingSources: Array<Pick<MarketingLibrarySource, 'source_identifier'>>,
): RegistrationClassification {
  const existingIds = new Set(
    existingSources.map(source => (source.source_identifier ?? '').trim()).filter(Boolean),
  )
  const seen = new Set<string>()
  const duplicateInManifest: string[] = []
  const registered: RegistrationCandidate[] = []
  const unregistered: RegistrationCandidate[] = []

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
      citedSources: manifest.filter(c => c.kind === 'cited_source').length,
      containers: manifest.filter(c => c.kind === 'container').length,
      registered: registered.length,
      unregistered: unregistered.length,
      duplicateInManifest: duplicateInManifest.length,
    },
  }
}
