// clientContactBackfill.ts — deterministic preflight/audit for the #294 contact/footer
// backfill. Pure and framework-free so it is unit-tested, and so the eventual production
// apply can report EXACTLY what will change before any mutation.
//
// The backfill migrations are idempotent (`on conflict do nothing`); this preflight
// classifies a proposal against the current live rows so the operator sees, up front:
// clients covered, contacts/policies to insert, records skipped (already present),
// stale/superseded values, unresolved conflicts, and the exact entity/branch scopes.

export interface ProposedContact {
  client_ref: string // exact client name (resolved to one id at apply)
  client_id: string
  scope_key: string | null
  contact_type: string
  value: string
  visibility: 'public_marketing' | 'internal_only' | 'client_portal_only' | 'unverified_hold'
  freshness_state: 'current_verified' | 'possible_change' | 'stale_unverified' | 'historical' | 'rejected'
  lifecycle_state: 'active' | 'superseded'
  approved_for_caption: boolean
  blocks_caption: boolean
}

export interface ProposedPolicy {
  client_ref: string
  client_id: string
  scope_key: string | null
  content_mode: string
  platform: string | null
  requirement: 'mandatory' | 'optional' | 'omitted'
}

export interface ExistingContactKey {
  client_id: string
  scope_key: string | null
  contact_type: string
  value: string
}

export interface ExistingPolicyKey {
  client_id: string
  scope_key: string | null
  content_mode: string
  platform: string | null
}

const s = (v: string | null | undefined): string => (v ?? '').trim().toLowerCase() || '∅'

const contactKey = (c: { client_id: string; scope_key: string | null; contact_type: string; value: string }) =>
  `${c.client_id}|${s(c.scope_key)}|${c.contact_type}|${c.value}`

const policyKey = (p: { client_id: string; scope_key: string | null; content_mode: string; platform: string | null }) =>
  `${p.client_id}|${s(p.scope_key)}|${p.content_mode}|${s(p.platform)}`

export interface BackfillPreflight {
  clients_covered: string[]
  scopes: Array<{ client_ref: string; scope_key: string | null }>
  contacts_to_insert: ProposedContact[]
  contacts_skipped_existing: ProposedContact[]
  policies_to_insert: ProposedPolicy[]
  policies_skipped_existing: ProposedPolicy[]
  stale_superseded: ProposedContact[]
  unresolved_conflicts: Array<{ client_ref: string; scope_key: string | null; contact_type: string; reason: string; values: string[] }>
  summary: {
    clients: number
    contacts_insert: number
    contacts_skip: number
    policies_insert: number
    policies_skip: number
    stale_superseded: number
    unresolved_conflicts: number
  }
}

/**
 * Report what the proposed backfill would do against the current rows. Read-only:
 * returns a plan, mutates nothing. Deterministic (stable ordering by input order).
 */
export function preflightContactBackfill(input: {
  proposedContacts: ProposedContact[]
  proposedPolicies: ProposedPolicy[]
  existingContacts: ExistingContactKey[]
  existingPolicies: ExistingPolicyKey[]
}): BackfillPreflight {
  const existingContactKeys = new Set(input.existingContacts.map(contactKey))
  const existingPolicyKeys = new Set(input.existingPolicies.map(policyKey))

  const contacts_to_insert: ProposedContact[] = []
  const contacts_skipped_existing: ProposedContact[] = []
  for (const c of input.proposedContacts) {
    (existingContactKeys.has(contactKey(c)) ? contacts_skipped_existing : contacts_to_insert).push(c)
  }

  const policies_to_insert: ProposedPolicy[] = []
  const policies_skipped_existing: ProposedPolicy[] = []
  for (const p of input.proposedPolicies) {
    (existingPolicyKeys.has(policyKey(p)) ? policies_skipped_existing : policies_to_insert).push(p)
  }

  const stale_superseded = input.proposedContacts.filter(
    c => c.lifecycle_state === 'superseded' || c.freshness_state === 'historical' || c.freshness_state === 'stale_unverified' || c.freshness_state === 'rejected',
  )

  // Unresolved conflicts: (a) explicit holds, and (b) two different current-verified
  // approved values of the same contact_type within one exact scope.
  const unresolved_conflicts: BackfillPreflight['unresolved_conflicts'] = []
  const holds = input.proposedContacts.filter(
    c => c.lifecycle_state === 'active' && (c.visibility === 'unverified_hold' || c.freshness_state === 'possible_change'),
  )
  for (const c of holds) {
    unresolved_conflicts.push({
      client_ref: c.client_ref,
      scope_key: c.scope_key,
      contact_type: c.contact_type,
      reason: c.visibility === 'unverified_hold' ? 'held: unverified' : 'held: possible change — value not confirmed current',
      values: [c.value],
    })
  }
  const approvedByScopeType = new Map<string, { c: ProposedContact; values: Set<string> }>()
  for (const c of input.proposedContacts) {
    if (c.lifecycle_state !== 'active' || c.visibility !== 'public_marketing' || !c.approved_for_caption || c.freshness_state !== 'current_verified') continue
    const key = `${c.client_id}|${s(c.scope_key)}|${c.contact_type}`
    const entry = approvedByScopeType.get(key) ?? { c, values: new Set<string>() }
    entry.values.add(c.value)
    approvedByScopeType.set(key, entry)
  }
  for (const { c, values } of approvedByScopeType.values()) {
    if (values.size > 1) {
      unresolved_conflicts.push({
        client_ref: c.client_ref,
        scope_key: c.scope_key,
        contact_type: c.contact_type,
        reason: 'ambiguous: multiple approved current values of the same type in one scope',
        values: [...values],
      })
    }
  }

  const clients_covered = [...new Set(input.proposedContacts.concat(input.proposedPolicies as unknown as ProposedContact[]).map(x => x.client_ref))]
  const scopeSet = new Map<string, { client_ref: string; scope_key: string | null }>()
  for (const x of [...input.proposedContacts, ...input.proposedPolicies]) {
    scopeSet.set(`${x.client_ref}|${s(x.scope_key)}`, { client_ref: x.client_ref, scope_key: x.scope_key })
  }

  return {
    clients_covered,
    scopes: [...scopeSet.values()],
    contacts_to_insert,
    contacts_skipped_existing,
    policies_to_insert,
    policies_skipped_existing,
    stale_superseded,
    unresolved_conflicts,
    summary: {
      clients: clients_covered.length,
      contacts_insert: contacts_to_insert.length,
      contacts_skip: contacts_skipped_existing.length,
      policies_insert: policies_to_insert.length,
      policies_skip: policies_skipped_existing.length,
      stale_superseded: stale_superseded.length,
      unresolved_conflicts: unresolved_conflicts.length,
    },
  }
}
