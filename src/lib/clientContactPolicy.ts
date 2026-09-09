export type ClientContactVisibility =
  | 'public_marketing'
  | 'internal_only'
  | 'client_portal_only'
  | 'unverified_hold'

export type ClientContactState = 'active' | 'superseded'
export type ClientContactFreshness =
  | 'current_verified'
  | 'possible_change'
  | 'stale_unverified'
  | 'historical'
  | 'rejected'

export type FooterRequirement = 'mandatory' | 'optional' | 'omitted'

export interface CaptionContactCandidate {
  id: string
  client_id: string
  scope_key: string | null
  contact_type: string
  display_label: string
  person_name: string | null
  person_role: string | null
  value: string
  approved_for_caption: boolean
  blocks_caption: boolean
  visibility: ClientContactVisibility
  freshness_state: ClientContactFreshness
  lifecycle_state: ClientContactState
  platforms: string[]
  content_modes: string[]
  footer_order: number
  last_verified_at: string | null
  provenance_summary: string
}

export interface FooterPolicyCandidate {
  client_id: string
  scope_key: string | null
  content_mode: string
  platform: string | null
  requirement: FooterRequirement
  format_template: string | null
  review_state: 'current_verified' | 'unverified_hold'
}

export interface CaptionContactResolution {
  contacts: CaptionContactCandidate[]
  policy: FooterPolicyCandidate | null
  unresolved: Array<{ id: string; display_label: string; reason: string }>
  can_generate_footer: boolean
  reason: string | null
}

function exactScope(rowScope: string | null, requestedScope: string | null): boolean {
  return (rowScope ?? null) === (requestedScope ?? null)
}

function applies(values: string[], requested: string | null): boolean {
  return !requested || values.length === 0 || values.includes(requested)
}

/**
 * Resolve the public caption/footer slice without broad or sibling-scope fallback.
 * This pure policy is mirrored by get-client-context and unit tested independently.
 */
export function resolveCaptionContacts(input: {
  clientId: string
  scopeKey?: string | null
  contentMode?: string
  platform?: string | null
  contacts: CaptionContactCandidate[]
  policies: FooterPolicyCandidate[]
}): CaptionContactResolution {
  const scopeKey = input.scopeKey ?? null
  const contentMode = input.contentMode ?? 'caption'
  const platform = input.platform ?? null

  const exactClientScope = input.contacts.filter(contact =>
    contact.client_id === input.clientId && exactScope(contact.scope_key, scopeKey),
  )

  const unresolved = exactClientScope
    .filter(contact =>
      contact.lifecycle_state === 'active' &&
      (contact.visibility === 'unverified_hold' ||
        contact.freshness_state === 'possible_change' ||
        contact.freshness_state === 'stale_unverified'),
    )
    .map(contact => ({
      id: contact.id,
      display_label: contact.display_label,
      reason: contact.visibility === 'unverified_hold'
        ? 'Contact is on unverified hold.'
        : `Contact freshness is ${contact.freshness_state}.`,
    }))

  const contacts = exactClientScope
    .filter(contact =>
      contact.lifecycle_state === 'active' &&
      contact.visibility === 'public_marketing' &&
      contact.approved_for_caption &&
      contact.freshness_state === 'current_verified' &&
      applies(contact.platforms, platform) &&
      applies(contact.content_modes, contentMode),
    )
    .sort((a, b) => a.footer_order - b.footer_order || a.display_label.localeCompare(b.display_label))

  const policy = input.policies.find(candidate =>
    candidate.client_id === input.clientId &&
    exactScope(candidate.scope_key, scopeKey) &&
    candidate.content_mode === contentMode &&
    (candidate.platform === platform || candidate.platform === null) &&
    candidate.review_state === 'current_verified',
  ) ?? null

  const mandatory = policy?.requirement === 'mandatory'
  const blockingUnresolved = exactClientScope.some(contact =>
    contact.lifecycle_state === 'active' &&
    contact.blocks_caption &&
    (contact.visibility === 'unverified_hold' ||
      contact.freshness_state === 'possible_change' ||
      contact.freshness_state === 'stale_unverified'),
  )

  // Ambiguity guard: within one exact scope, two different approved values of the same
  // contact_type is an unresolved conflict. Fail closed rather than guess which is current.
  const valuesByType = new Map<string, Set<string>>()
  for (const contact of contacts) {
    const set = valuesByType.get(contact.contact_type) ?? new Set<string>()
    set.add(contact.value)
    valuesByType.set(contact.contact_type, set)
  }
  const conflictingTypes = [...valuesByType.entries()].filter(([, values]) => values.size > 1).map(([type]) => type)
  const ambiguousConflict = conflictingTypes.length > 0
  const conflictUnresolved = ambiguousConflict
    ? contacts
        .filter(contact => conflictingTypes.includes(contact.contact_type))
        .map(contact => ({
          id: contact.id,
          display_label: contact.display_label,
          reason: `Multiple approved ${contact.contact_type} contacts conflict for this exact scope.`,
        }))
    : []

  const blocked = blockingUnresolved || ambiguousConflict || (mandatory && contacts.length === 0)

  return {
    contacts: blocked ? [] : contacts,
    policy,
    unresolved: [...unresolved, ...conflictUnresolved],
    can_generate_footer: !blocked && policy?.requirement !== 'omitted',
    reason: blockingUnresolved || ambiguousConflict
      ? 'Contact conflict or freshness hold must be resolved before use.'
      : mandatory && contacts.length === 0
        ? 'A footer is mandatory but no current caption-approved contact is available for this exact scope.'
        : null,
  }
}
