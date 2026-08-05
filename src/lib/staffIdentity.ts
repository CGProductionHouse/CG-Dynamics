// Canonical staff identity resolution (PR 1).
//
// planner_tasks stores assignment as FREE TEXT (`assigned_to_name`) with no
// canonical user column, and multi-assignee values arrived as one unsplit blob:
// production held 661 rows whose `unresolved_assignee_names` was a SINGLE
// element like ["Amonique Fourie;Franco Lessing"]. That one string matches no
// profile, so a perfectly unambiguous "Franco Lessing" stayed Unassigned while
// the UI still displayed the name.
//
// Nothing here names a person. Staff are discovered from the profile directory
// and every person gets the same candidate forms by the same rules, so a new
// hire resolves with no code change.
//
// This mirrors the SQL in 20260805100000_canonical_staff_identity.sql. The
// database is the enforcement authority; this is the client-side view of the
// same rules, and tests pin the two to identical fixtures.

export interface StaffDirectoryEntry {
  id: string
  fullName: string | null
  email: string | null
  role: string
  isActive: boolean
}

export type IdentityMatchRule = 'exact_full_name' | 'exact_email_local' | 'unique_first_token'
export type IdentityUnresolvedReason = 'no_match' | 'ambiguous'

export interface IdentityResolution {
  /** The exact imported text, always preserved for audit. */
  segment: string
  profileId: string | null
  matchRule: IdentityMatchRule | null
  reason: IdentityUnresolvedReason | null
  /** Populated when more than one active person matched. */
  candidateIds: string[]
}

/** Case, punctuation and spacing are all noise in an imported display name. */
export function normaliseIdentity(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Split a combined imported assignee string into individual identities.
 *
 * Production stored these semicolon-joined, sometimes with empty segments
 * ("Christie-Ann Groenewald;;Amonique Fourie;"). Empty pieces are dropped and
 * the surviving text is returned verbatim — never lower-cased or rewritten,
 * because the original is the audit record.
 */
export function splitIdentityString(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

interface CandidateForm {
  profileId: string
  form: string
  rule: IdentityMatchRule
}

/**
 * Every form a person's name could legitimately arrive as. Derived, not listed:
 * the display name, the email local part, and the first token of the display
 * name (which is how a directory "Ger-Marie Pretorius" reaches a profile named
 * "Ger-Marie").
 */
export function buildCandidateForms(directory: StaffDirectoryEntry[]): CandidateForm[] {
  const forms: CandidateForm[] = []
  for (const person of directory) {
    if (!person.isActive) continue
    if (!['admin', 'manager', 'team'].includes(person.role)) continue

    const fullName = normaliseIdentity(person.fullName)
    if (fullName) forms.push({ profileId: person.id, form: fullName, rule: 'exact_full_name' })

    const local = normaliseIdentity((person.email ?? '').split('@')[0])
    if (local) forms.push({ profileId: person.id, form: local, rule: 'exact_email_local' })

    const firstToken = normaliseIdentity((person.fullName ?? '').trim().split(/\s+/)[0])
    if (firstToken) forms.push({ profileId: person.id, form: firstToken, rule: 'unique_first_token' })
  }
  return forms
}

/**
 * Resolve ONE imported identity segment against the live directory.
 *
 * Returns a person only when exactly one active staff member matches. Anything
 * else stays unresolved with a reason — the product rule is that CG Dynamics
 * may show information as unresolved, but must never present a guess as truth.
 */
export function resolveIdentitySegment(
  segment: string,
  directory: StaffDirectoryEntry[],
): IdentityResolution {
  const forms = buildCandidateForms(directory)
  const full = normaliseIdentity(segment)
  const firstToken = normaliseIdentity(segment.trim().split(/\s+/)[0])

  if (!full) return { segment, profileId: null, matchRule: null, reason: 'no_match', candidateIds: [] }

  // 1. The whole segment is a known full name or email local part.
  const exact = forms.filter(f => f.form === full && f.rule !== 'unique_first_token')
  const exactIds = [...new Set(exact.map(f => f.profileId))]
  if (exactIds.length === 1) {
    return { segment, profileId: exactIds[0], matchRule: exact[0].rule, reason: null, candidateIds: exactIds }
  }
  if (exactIds.length > 1) {
    return { segment, profileId: null, matchRule: null, reason: 'ambiguous', candidateIds: exactIds }
  }

  // 2. The first token identifies exactly one person.
  const byToken = forms.filter(f => f.form === firstToken)
  const tokenIds = [...new Set(byToken.map(f => f.profileId))]
  if (tokenIds.length === 1) {
    return { segment, profileId: tokenIds[0], matchRule: 'unique_first_token', reason: null, candidateIds: tokenIds }
  }
  if (tokenIds.length > 1) {
    return { segment, profileId: null, matchRule: null, reason: 'ambiguous', candidateIds: tokenIds }
  }

  return { segment, profileId: null, matchRule: null, reason: 'no_match', candidateIds: [] }
}

export interface TaskAssignmentResolution {
  resolved: IdentityResolution[]
  unresolved: IdentityResolution[]
  /** Drives whether the task may appear in a person-specific summary. */
  reviewState: 'ok' | 'unresolved'
}

/**
 * Resolve a whole `assigned_to_name` value.
 *
 * A task keeps its resolved links even when one co-assignee cannot be resolved
 * — those people genuinely are assignees. But the task is marked `unresolved`,
 * because its ownership is only partly known, and partly-known ownership must
 * not be presented as a person's confirmed work.
 */
export function resolveTaskAssignment(
  assignedToName: string | null | undefined,
  directory: StaffDirectoryEntry[],
): TaskAssignmentResolution {
  const segments = splitIdentityString(assignedToName)
  const all = segments.map(segment => resolveIdentitySegment(segment, directory))
  const resolved = all.filter(r => r.profileId !== null)
  const unresolved = all.filter(r => r.profileId === null)
  return { resolved, unresolved, reviewState: unresolved.length > 0 ? 'unresolved' : 'ok' }
}

/**
 * Only fully-resolved, non-conflicting tasks may appear under a named person.
 * Everything else belongs in "Needs assignment review".
 */
export function canAppearInPersonSummary(reviewState: string): boolean {
  return reviewState === 'ok'
}

/**
 * Identity forms owned by more than one active person — the generic duplicate
 * account signal. Discovered from the directory, never a maintained shortlist.
 */
export function findDuplicateIdentityForms(directory: StaffDirectoryEntry[]): Array<{ form: string; profileIds: string[] }> {
  const owners = new Map<string, Set<string>>()
  for (const { form, profileId } of buildCandidateForms(directory)) {
    const set = owners.get(form) ?? new Set<string>()
    set.add(profileId)
    owners.set(form, set)
  }
  return [...owners.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([form, ids]) => ({ form, profileIds: [...ids] }))
    .sort((a, b) => a.form.localeCompare(b.form))
}
