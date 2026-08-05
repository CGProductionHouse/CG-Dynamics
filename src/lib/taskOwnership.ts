// Shared task-ownership authority (PR 3).
//
// Every operational consumer — the WhatsApp morning message, the end-of-day
// update, My Work, Team Work, board labels, notifications and CG Assistant
// context — must answer "whose task is this?" through THIS module. Screens used
// to reconstruct ownership independently from free text, which is how the same
// logical task ended up under two different people.
//
// The false-output paths this replaces, all found in production:
//
//   CommandCentrePage.staffGroups   grouped by `assigned_to_name`, a RAW
//                                   imported string. "Sydney Oosthuizen;Franco
//                                   Lessing" became a staff group heading, and
//                                   stale text put work under the wrong person.
//   workforceMyDay.userMatches      matched on `assigned_to_name` AND
//                                   `helper_names`, so a HELPER received the
//                                   task as their own work.
//
// The rule this enforces: CG Dynamics may show that ownership is unresolved. It
// may never place an unresolved or conflicting task under a named person as
// though the assignment were verified.

export type OwnershipState = 'verified' | 'unresolved' | 'conflict' | 'unassigned'

export interface OwnershipPerson {
  id: string
  name: string
}

export interface OwnershipInput {
  /** Canonical assignee links. The ONLY source of verified ownership. */
  assigneeUserIds?: string[] | null
  /** Native single-assignee column, also canonical. */
  assignedToUserId?: string | null
  /** PR 1 review state: 'ok' | 'unresolved' | 'conflict'. */
  assignmentReviewState?: string | null
  /** Imported text. Audit evidence ONLY — never ownership truth. */
  importedAssigneeText?: string | null
  /** Imported names that could not be resolved to a person. */
  unresolvedNames?: string[] | null
  /** Helpers. Never promoted to owners. */
  helperNames?: string[] | null
}

export interface Ownership {
  state: OwnershipState
  /** Verified people this task may be listed under. Empty unless verified. */
  owners: OwnershipPerson[]
  /** Helpers, kept separate from owners on purpose. */
  helpers: string[]
  /** Imported names still awaiting resolution. */
  unresolvedNames: string[]
  /** The original imported string, for manager review only. */
  importedText: string | null
  /** Why this is not verified. Empty when it is. */
  reason: string
}

/**
 * Resolve ownership from canonical evidence.
 *
 * `directory` maps canonical user id -> display name, so names shown are the
 * canonical ones rather than whatever an import happened to contain.
 */
export function resolveOwnership(input: OwnershipInput, directory: Map<string, string>): Ownership {
  const helpers = (input.helperNames ?? []).filter(Boolean)
  const unresolvedNames = (input.unresolvedNames ?? []).filter(Boolean)
  const importedText = input.importedAssigneeText?.trim() || null

  const ids = [...new Set([
    ...(input.assigneeUserIds ?? []).filter(Boolean),
    ...(input.assignedToUserId ? [input.assignedToUserId] : []),
  ])] as string[]

  const owners = ids
    .filter(id => directory.has(id))
    .map(id => ({ id, name: directory.get(id) as string }))

  const reviewState = input.assignmentReviewState ?? 'ok'

  // A conflict outranks everything: durable evidence disagrees with itself, so
  // no person may be shown as the owner until a manager decides.
  if (reviewState === 'conflict') {
    return {
      state: 'conflict',
      owners: [],
      helpers,
      unresolvedNames,
      importedText,
      reason: 'Durable source evidence disagrees about who owns this task.',
    }
  }

  // Partly-known ownership is not ownership. Even where some names resolved,
  // listing the task under those people would present an incomplete answer as a
  // complete one.
  if (reviewState === 'unresolved' || unresolvedNames.length > 0) {
    return {
      state: 'unresolved',
      owners: [],
      helpers,
      unresolvedNames,
      importedText,
      reason: unresolvedNames.length > 0
        ? `Imported ${unresolvedNames.length === 1 ? 'name' : 'names'} could not be matched to a CG Dynamics account: ${unresolvedNames.join(', ')}.`
        : 'This task has imported assignment text that has not been resolved to a person.',
    }
  }

  if (owners.length === 0) {
    return {
      state: 'unassigned',
      owners: [],
      helpers,
      unresolvedNames,
      importedText,
      reason: importedText
        ? 'Imported assignment text exists but no canonical person is linked.'
        : 'Nobody is assigned to this task.',
    }
  }

  return { state: 'verified', owners, helpers, unresolvedNames, importedText, reason: '' }
}

/** Only a verified task may be listed beneath a named person. */
export function mayAppearUnderPerson(ownership: Ownership): boolean {
  return ownership.state === 'verified' && ownership.owners.length > 0
}

/**
 * Is this task verified work for a specific person?
 *
 * Used by My Work and by person-specific notifications. Deliberately takes a
 * user id, never a name: matching on display strings is what let helpers and
 * stale imported text into someone's personal list.
 */
export function isVerifiedOwner(ownership: Ownership, userId: string | null | undefined): boolean {
  if (!userId) return false
  return mayAppearUnderPerson(ownership) && ownership.owners.some(o => o.id === userId)
}

export interface OwnershipGrouping<T> {
  /** Verified work, keyed by canonical user id. Safe for copy-ready output. */
  byOwner: Map<string, { person: OwnershipPerson; items: T[] }>
  /** Manager-only: imported identities awaiting resolution. */
  needsAssignmentReview: Array<{ item: T; ownership: Ownership }>
  /** Manager-only: durable evidence disagrees. */
  assignmentConflict: Array<{ item: T; ownership: Ownership }>
  /** Genuinely nobody assigned, with no imported identity to resolve. */
  unassigned: T[]
}

/**
 * Split a task list into the only four buckets an operational output may use.
 *
 * A task appears in exactly ONE bucket, and a verified task appears under each
 * of its verified owners — never under someone merely mentioned in text.
 */
export function groupByOwnership<T>(
  items: T[],
  read: (item: T) => OwnershipInput,
  directory: Map<string, string>,
): OwnershipGrouping<T> {
  const byOwner = new Map<string, { person: OwnershipPerson; items: T[] }>()
  const needsAssignmentReview: Array<{ item: T; ownership: Ownership }> = []
  const assignmentConflict: Array<{ item: T; ownership: Ownership }> = []
  const unassigned: T[] = []

  for (const item of items) {
    const ownership = resolveOwnership(read(item), directory)
    if (ownership.state === 'conflict') { assignmentConflict.push({ item, ownership }); continue }
    if (ownership.state === 'unresolved') { needsAssignmentReview.push({ item, ownership }); continue }
    if (ownership.state === 'unassigned') { unassigned.push(item); continue }
    for (const person of ownership.owners) {
      const entry = byOwner.get(person.id) ?? { person, items: [] }
      entry.items.push(item)
      byOwner.set(person.id, entry)
    }
  }

  return { byOwner, needsAssignmentReview, assignmentConflict, unassigned }
}

/** Truthful headline counts for the manager review area. */
export function ownershipCounts<T>(grouping: OwnershipGrouping<T>) {
  let verified = 0
  for (const entry of grouping.byOwner.values()) verified += entry.items.length
  return {
    verified,
    needsReview: grouping.needsAssignmentReview.length,
    conflicts: grouping.assignmentConflict.length,
    unassigned: grouping.unassigned.length,
  }
}
