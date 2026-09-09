// clientScope.ts — exact client + entity/sub-brand scope selection (#241/#248/#294).
//
// Pure, framework-free. Enforces exact client_id + exact entity scope with NO sibling
// or client-wide fallback, so Piek Group modes (Piek Group / Engen / Sasol / Get Together)
// stay isolated within one canonical client and never leak facts across entities.
//
// Mirrored by the get-client-context Edge Function (DB filter + defensive in-memory guard)
// and unit-tested here so the isolation rule has one definition.

export interface ScopedCard {
  id: string
  active_client_id: string | null
  client_scope_key: string | null
  client_specific?: boolean
  status?: string
}

/** null/'' entity scope means the client-wide (group/umbrella) scope, matched exactly. */
export function normalizeScope(scope: string | null | undefined): string | null {
  const value = (scope ?? '').trim().toLowerCase()
  return value.length === 0 ? null : value
}

/**
 * Select only the cards for the EXACT client and EXACT entity scope.
 * - clientId must match active_client_id exactly (no fuzzy client match).
 * - scopeKey must match client_scope_key exactly; a group request (null) never
 *   receives entity cards, and an entity request never falls back to group/sibling cards.
 */
export function selectScopeCards<T extends ScopedCard>(
  cards: readonly T[],
  input: { clientId: string; scopeKey?: string | null },
): T[] {
  const clientId = input.clientId
  const scopeKey = normalizeScope(input.scopeKey)
  if (!clientId) return []
  return cards.filter(
    card =>
      card.active_client_id === clientId &&
      normalizeScope(card.client_scope_key) === scopeKey,
  )
}
