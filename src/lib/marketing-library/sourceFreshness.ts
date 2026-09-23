import type { RegistrationCandidate } from './sourceRegistry'

// ── Source freshness classifier (#448) ────────────────────────────────────────
//
// Pure, testable freshness state machine with an injected `today` date.
// No browser/timezone dependency. No side effects. No activation.
//
// Freshness is governance state — it does not activate/deactivate cards
// or change Assistant retrieval. It answers: "when does this source
// need human re-review?"

export type FreshnessState =
  | 'overdue'       // explicit reviewDue < today
  | 'due_today'     // explicit reviewDue === today
  | 'due_soon'      // explicit reviewDue within dueSoonWindowDays
  | 'current'       // explicit reviewDue beyond dueSoonWindowDays
  | 'unscheduled'   // no reviewDue supplied
  | 'needs_reverify' // source metadata explicitly says so or access state warrants it

export interface FreshnessResult {
  state: FreshnessState
  reviewDue: string | null
  accessedAt: string | null
  pageDate: string | null
  sourceStatus: string | null
}

/** Default due-soon window: 30 days. Documented in code, injectable in tests. */
const DEFAULT_DUE_SOON_WINDOW_DAYS = 30

/**
 * Parse a YYYY-MM-DD date string into a Date at midnight UTC.
 * Returns null for null/empty/invalid input.
 */
function parseDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null
  const d = new Date(`${s.trim()}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Classify the freshness state of a single source.
 *
 * @param candidate - The source registration candidate with governance metadata
 * @param today - Injected current date (YYYY-MM-DD). No timezone drift.
 * @param dueSoonWindowDays - Configurable look-ahead window (default 30)
 */
export function classifyFreshness(
  candidate: Pick<RegistrationCandidate, 'reviewDue' | 'accessedAt' | 'pageDate' | 'sourceStatus'>,
  today: string,
  dueSoonWindowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): FreshnessResult {
  const todayDate = parseDate(today)
  if (!todayDate) {
    return {
      state: 'unscheduled',
      reviewDue: candidate.reviewDue ?? null,
      accessedAt: candidate.accessedAt ?? null,
      pageDate: candidate.pageDate ?? null,
      sourceStatus: candidate.sourceStatus ?? null,
    }
  }

  const reviewDueDate = parseDate(candidate.reviewDue)

  // Check explicit needs_reverify from source status
  if (candidate.sourceStatus === 'needs_reverify') {
    return {
      state: 'needs_reverify',
      reviewDue: candidate.reviewDue ?? null,
      accessedAt: candidate.accessedAt ?? null,
      pageDate: candidate.pageDate ?? null,
      sourceStatus: candidate.sourceStatus ?? null,
    }
  }

  // No reviewDue = unscheduled
  if (!reviewDueDate) {
    return {
      state: 'unscheduled',
      reviewDue: candidate.reviewDue ?? null,
      accessedAt: candidate.accessedAt ?? null,
      pageDate: candidate.pageDate ?? null,
      sourceStatus: candidate.sourceStatus ?? null,
    }
  }

  // Compare dates as UTC day boundaries
  const diffMs = reviewDueDate.getTime() - todayDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  let state: FreshnessState
  if (diffDays < 0) {
    state = 'overdue'
  } else if (diffDays === 0) {
    state = 'due_today'
  } else if (diffDays <= dueSoonWindowDays) {
    state = 'due_soon'
  } else {
    state = 'current'
  }

  return {
    state,
    reviewDue: candidate.reviewDue ?? null,
    accessedAt: candidate.accessedAt ?? null,
    pageDate: candidate.pageDate ?? null,
    sourceStatus: candidate.sourceStatus ?? null,
  }
}

/**
 * Classify freshness for a batch of candidates.
 * Returns a Map keyed by sourceIdentifier for O(1) lookup.
 */
export function classifyFreshnessBatch(
  candidates: Array<Pick<RegistrationCandidate, 'sourceIdentifier' | 'reviewDue' | 'accessedAt' | 'pageDate' | 'sourceStatus'>>,
  today: string,
  dueSoonWindowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): Map<string, FreshnessResult> {
  const results = new Map<string, FreshnessResult>()
  for (const c of candidates) {
    results.set(c.sourceIdentifier, classifyFreshness(c, today, dueSoonWindowDays))
  }
  return results
}
