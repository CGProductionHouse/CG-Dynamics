import type { RegistrationCandidate } from './sourceRegistry'
import { REGISTRATION_MANIFEST, classifyRegistrations } from './sourceRegistry'
import type { MarketingLibrarySource } from './skillCardsData'
import { classifyFreshness } from './sourceFreshness'
import { bridgeAudienceLifecycleSources } from './audienceLifecycleBridge'
import { bridgeCommerceEvidenceSources } from './commerceEvidenceBridge'
import { bridgeCompetitiveCreativeSources } from './competitiveCreativeBridge'

// ── Unified research-source registration preview (#446) ───────────────────────
//
// Derived preview layer that combines the seed-backed REGISTRATION_MANIFEST
// with the three completed research-source bridges. No registration, no write,
// no activation, no schema change.
//
// Rules:
//  • Dedupe by exact sourceIdentifier.
//  • Preserve source provenance / origin pack(s).
//  • Surface metadata conflicts rather than choosing one silently.
//  • Distinguish seed-backed from research-preview-only candidates.
//  • Never upgrade trust, access, source type or rights.
//  • Null/absent optional metadata must not overwrite richer known metadata.

export type SourceOrigin = 'seed' | 'audience_lifecycle' | 'commerce_evidence' | 'competitive_creative'

export interface ConflictVariant {
  /** Origin that contributed this variant. */
  origin: SourceOrigin
  /** Exact candidate metadata from this origin. */
  candidate: RegistrationCandidate
}

export interface PreviewEntry {
  /** Merged RegistrationCandidate — richest compatible metadata wins for optional fields. */
  candidate: RegistrationCandidate
  /** All origins that contributed this sourceIdentifier. */
  origins: SourceOrigin[]
  /** Whether this entry conflicts (same identifier, materially different metadata). */
  conflict: boolean
  /** Conflict fields if conflict=true. */
  conflictFields?: string[]
  /** Exact source variants that caused the conflict. Preserved for human review. */
  conflictVariants?: ConflictVariant[]
  /** How many times this sourceIdentifier appeared across all inputs. */
  duplicateCount: number
}

export interface GovernanceQueues {
  conflicts: string[]
  overdue: string[]
  dueToday: string[]
  dueSoon: string[]
  current: string[]
  unscheduled: string[]
  alreadyRegistered: string[]
  previewReady: string[]
}

export interface UnifiedPreview {
  entries: PreviewEntry[]
  summary: PreviewSummary
  /** Exact set of sourceIdentifiers that are preview-ready (non-conflict + not already registered). */
  previewReadyIdentifiers: Set<string>
  /** Derived governance queues — every list length matches the corresponding summary count. */
  governanceQueues: GovernanceQueues
}

export interface PreviewSummary {
  totalSeed: number
  totalResearchPreviewOnly: number
  totalDuplicate: number
  totalConflict: number
  totalAlreadyRegistered: number
  totalPreviewReady: number
  byOrigin: Record<SourceOrigin, number>
  // ── Governance counts ─────────────────────────────────────────────────────
  totalOverdue: number
  totalDueToday: number
  totalDueSoon: number
  totalCurrent: number
  totalUnscheduled: number
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Material fields that trigger a conflict when they differ across
 * same-identifier entries. Optional fields that are null/absent on one
 * side do NOT conflict — the richer value survives.
 */
function conflictFields(a: RegistrationCandidate, b: RegistrationCandidate): string[] {
  const conflicts: string[] = []

  if (a.sourceType !== b.sourceType) conflicts.push('sourceType')
  if (a.canonicalUrl != null && b.canonicalUrl != null && a.canonicalUrl !== b.canonicalUrl) conflicts.push('canonicalUrl')
  if (a.title !== b.title) conflicts.push('title')
  if (a.author != null && b.author != null && a.author !== b.author) conflicts.push('author')
  if (a.rightsNote != null && b.rightsNote != null && a.rightsNote !== b.rightsNote) conflicts.push('rightsNote')
  if (a.accessCoverage != null && b.accessCoverage != null && a.accessCoverage !== b.accessCoverage) {
    conflicts.push('accessCoverage')
  }

  // Review context: conflict only when BOTH provide a value and it differs.
  if (a.reviewContext && b.reviewContext) {
    if (a.reviewContext.finding && b.reviewContext.finding && a.reviewContext.finding !== b.reviewContext.finding) {
      conflicts.push('reviewContext.finding')
    }
    if (a.reviewContext.limitations && b.reviewContext.limitations && a.reviewContext.limitations !== b.reviewContext.limitations) {
      conflicts.push('reviewContext.limitations')
    }
    if (a.reviewContext.jurisdiction && b.reviewContext.jurisdiction && a.reviewContext.jurisdiction !== b.reviewContext.jurisdiction) {
      conflicts.push('reviewContext.jurisdiction')
    }
  }

  return conflicts
}

/**
 * Merge two compatible candidates. Preserves richer optional metadata
 * from either side. Never overwrites a present value with null/undefined.
 */
function mergeCandidates(base: RegistrationCandidate, overlay: RegistrationCandidate): RegistrationCandidate {
  const mergedReviewContext = {
    finding: base.reviewContext?.finding || overlay.reviewContext?.finding,
    limitations: base.reviewContext?.limitations || overlay.reviewContext?.limitations,
    jurisdiction: base.reviewContext?.jurisdiction || overlay.reviewContext?.jurisdiction,
  }

  return {
    sourceIdentifier: base.sourceIdentifier,
    kind: base.kind,
    family: base.family,
    title: base.title || overlay.title,
    author: base.author || overlay.author,
    canonicalUrl: base.canonicalUrl || overlay.canonicalUrl,
    sourceAttribution: base.sourceAttribution || overlay.sourceAttribution,
    rightsNote: base.rightsNote || overlay.rightsNote,
    sourceType: base.sourceType,
    trustTier: base.trustTier,
    ingestionEligibility: base.ingestionEligibility,
    citedIn: [...new Set([...base.citedIn, ...overlay.citedIn])],
    accessCoverage: base.accessCoverage ?? overlay.accessCoverage,
    reviewContext: mergedReviewContext,
    pageDate: base.pageDate ?? overlay.pageDate,
    accessedAt: base.accessedAt ?? overlay.accessedAt,
    reviewDue: base.reviewDue ?? overlay.reviewDue,
    sourceStatus: base.sourceStatus ?? overlay.sourceStatus,
  }
}

// ── Preview builder ───────────────────────────────────────────────────────────

/**
 * Build the unified derived preview from seed manifest + research bridges.
 * Pure function — no side effects, no writes.
 *
 * When liveSources is provided, computes already-registered and preview-ready
 * counts using the existing classifyRegistrations() against the non-conflict
 * unified candidates. Conflicts are excluded from preview-ready.
 *
 * @param today - Injected date string (YYYY-MM-DD) for freshness classification.
 *                No timezone drift. If omitted, freshness queues are empty.
 */
export function buildUnifiedPreview(
  seedManifest: RegistrationCandidate[] = REGISTRATION_MANIFEST,
  audienceLifecycle: RegistrationCandidate[] = bridgeAudienceLifecycleSources(),
  commerceEvidence: RegistrationCandidate[] = bridgeCommerceEvidenceSources(),
  competitiveCreative: RegistrationCandidate[] = bridgeCompetitiveCreativeSources(),
  liveSources: Array<Pick<MarketingLibrarySource, 'source_identifier'>> = [],
  today?: string,
): UnifiedPreview {
  // Tag each candidate with its origin
  const tagged: Array<{ candidate: RegistrationCandidate; origin: SourceOrigin }> = [
    ...seedManifest.map(c => ({ candidate: c, origin: 'seed' as const })),
    ...audienceLifecycle.map(c => ({ candidate: c, origin: 'audience_lifecycle' as const })),
    ...commerceEvidence.map(c => ({ candidate: c, origin: 'commerce_evidence' as const })),
    ...competitiveCreative.map(c => ({ candidate: c, origin: 'competitive_creative' as const })),
  ]

  // Group by sourceIdentifier
  const grouped = new Map<string, Array<{ candidate: RegistrationCandidate; origin: SourceOrigin }>>()
  for (const item of tagged) {
    const id = item.candidate.sourceIdentifier
    const existing = grouped.get(id) ?? []
    existing.push(item)
    grouped.set(id, existing)
  }

  const entries: PreviewEntry[] = []
  const byOrigin: Record<SourceOrigin, number> = {
    seed: 0,
    audience_lifecycle: 0,
    commerce_evidence: 0,
    competitive_creative: 0,
  }

  for (const [, items] of grouped) {
    const origins = [...new Set(items.map(i => i.origin))]
    const duplicateCount = items.length

    if (items.length === 1) {
      // Single origin — no conflict
      const c = items[0].candidate
      entries.push({
        candidate: c,
        origins,
        conflict: false,
        duplicateCount,
      })
      for (const o of origins) byOrigin[o]++
      continue
    }

    // Multiple items with same sourceIdentifier — check for conflicts
    let merged = items[0].candidate
    let allConflicts: string[] = []
    const variants: ConflictVariant[] = items.map(i => ({ origin: i.origin, candidate: i.candidate }))

    for (let i = 1; i < items.length; i++) {
      const cf = conflictFields(merged, items[i].candidate)
      if (cf.length > 0) {
        allConflicts = [...allConflicts, ...cf]
      } else {
        merged = mergeCandidates(merged, items[i].candidate)
      }
    }

    // Deduplicate conflict field names
    const uniqueConflicts = [...new Set(allConflicts)]

    entries.push({
      candidate: merged,
      origins,
      conflict: uniqueConflicts.length > 0,
      conflictFields: uniqueConflicts.length > 0 ? uniqueConflicts : undefined,
      conflictVariants: uniqueConflicts.length > 0 ? variants : undefined,
      duplicateCount,
    })

    for (const o of origins) byOrigin[o]++
  }

  // Sort deterministically by sourceIdentifier
  entries.sort((a, b) => a.candidate.sourceIdentifier.localeCompare(b.candidate.sourceIdentifier))

  // Compute registration state using existing classifier
  const nonConflictCandidates = entries
    .filter(e => !e.conflict)
    .map(e => e.candidate)
  const registration = classifyRegistrations(nonConflictCandidates, liveSources)

  // ── Governance queues ─────────────────────────────────────────────────────
  const conflictIds = entries.filter(e => e.conflict).map(e => e.candidate.sourceIdentifier)
  const registeredIds = new Set(registration.registered.map(c => c.sourceIdentifier))
  const previewReadyIdentifiers = new Set(registration.unregistered.map(c => c.sourceIdentifier))

  const overdue: string[] = []
  const dueToday: string[] = []
  const dueSoon: string[] = []
  const current: string[] = []
  const unscheduled: string[] = []

  if (today) {
    for (const e of entries) {
      if (e.conflict) continue
      const freshness = classifyFreshness(e.candidate, today)
      switch (freshness.state) {
        case 'overdue': overdue.push(e.candidate.sourceIdentifier); break
        case 'due_today': dueToday.push(e.candidate.sourceIdentifier); break
        case 'due_soon': dueSoon.push(e.candidate.sourceIdentifier); break
        case 'current': current.push(e.candidate.sourceIdentifier); break
        case 'unscheduled': unscheduled.push(e.candidate.sourceIdentifier); break
        case 'needs_reverify': overdue.push(e.candidate.sourceIdentifier); break
      }
    }
  }

  const governanceQueues: GovernanceQueues = {
    conflicts: conflictIds,
    overdue,
    dueToday,
    dueSoon,
    current,
    unscheduled,
    alreadyRegistered: [...registeredIds],
    previewReady: [...previewReadyIdentifiers],
  }

  const summary: PreviewSummary = {
    totalSeed: seedManifest.length,
    totalResearchPreviewOnly: entries.filter(e => !e.origins.includes('seed')).length,
    totalDuplicate: entries.filter(e => e.duplicateCount > 1 && !e.conflict).length,
    totalConflict: entries.filter(e => e.conflict).length,
    totalAlreadyRegistered: registration.counts.registered,
    totalPreviewReady: registration.counts.unregistered,
    byOrigin,
    totalOverdue: overdue.length,
    totalDueToday: dueToday.length,
    totalDueSoon: dueSoon.length,
    totalCurrent: current.length,
    totalUnscheduled: unscheduled.length,
  }

  return { entries, summary, previewReadyIdentifiers, governanceQueues }
}

/**
 * Summarise the unified preview for admin display.
 */
export function summarisePreview(preview: UnifiedPreview): PreviewSummary {
  return preview.summary
}
