// Shared, framework-free helpers for the OneDrive production-folder model (#225).
//
// Pure functions only — no network, no Deno, no React — so both the Vite app and
// tests can import them, and the Edge Function can mirror the same rules.
//
// Hard rules encoded here:
//   * Runtime resolution is by DURABLE Graph item id, never by name (no fuzzy matching).
//   * Name builders are used ONLY to propose names for folders CG staff explicitly
//     create; they never drive lookups of existing folders.
//   * No rename/move/delete logic exists anywhere in this module.

/** Canonical 3-letter English month codes (issue #225 convention). */
export const CANONICAL_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

/** 1-based month number -> canonical abbreviation. Throws on out-of-range. */
export function canonicalMonthAbbrev(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`)
  }
  return CANONICAL_MONTHS[month - 1]
}

/** Year folder name, e.g. "2026". */
export function buildYearFolderName(year: number): string {
  assertYear(year)
  return String(year)
}

/** Month folder name, e.g. "2026_09_SEP". */
export function buildMonthFolderName(year: number, month: number): string {
  assertYear(year)
  const mm = String(month).padStart(2, '0')
  return `${year}_${mm}_${canonicalMonthAbbrev(month)}`
}

/**
 * Shoot/video folder name, e.g. "2026_09_ECONO_VIDEO_02".
 * `shortCode` must be a configured client short code (never derived from a folder name).
 */
export function buildVideoFolderName(
  year: number,
  month: number,
  shortCode: string,
  sequence: number,
): string {
  assertYear(year)
  const code = normalizeShortCode(shortCode)
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99) {
    throw new Error(`Invalid video sequence: ${sequence}`)
  }
  const mm = String(month).padStart(2, '0')
  const xx = String(sequence).padStart(2, '0')
  return `${year}_${mm}_${code}_VIDEO_${xx}`
}

/** Validate a client short code (e.g. ECONO). Uppercase A-Z 0-9 _ -, 1..32 chars. */
export function normalizeShortCode(shortCode: string): string {
  const code = (shortCode ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(code)) {
    throw new Error(`Invalid client short code: ${JSON.stringify(shortCode)}`)
  }
  return code
}

export interface DriveChild {
  id: string
  name: string
  folder?: boolean
}

/**
 * RUNTIME resolution: find a child by its durable Graph item id.
 * This is the only lookup runtime code may use once a mapping exists.
 */
export function resolveChildByDurableId<T extends DriveChild>(
  children: readonly T[],
  itemId: string,
): T | null {
  if (!itemId) return null
  return children.find((c) => c.id === itemId) ?? null
}

/**
 * MAPPING-TIME ONLY: find a child by exact name, for the initial human-confirmed
 * mapping step. `caseInsensitive` tolerates the known casing drift, but this is a
 * one-off assist for a human to confirm — it must never run in the resolve path.
 */
export function findChildByExactName<T extends DriveChild>(
  children: readonly T[],
  name: string,
  opts: { caseInsensitive?: boolean } = {},
): T | null {
  const target = opts.caseInsensitive ? name.toLowerCase() : name
  return (
    children.find((c) =>
      opts.caseInsensitive ? c.name.toLowerCase() === target : c.name === name,
    ) ?? null
  )
}

/**
 * Decide what to do to satisfy a requested canonical folder, WITHOUT creating anything.
 * Returns either the existing child (resolved by name at mapping time) or a proposal
 * to create it. Creation itself is a separate, explicit staff action.
 */
export function planCanonicalFolder<T extends DriveChild>(
  children: readonly T[],
  desiredName: string,
): { action: 'exists'; item: T } | { action: 'create'; name: string } {
  const existing = findChildByExactName(children, desiredName, { caseInsensitive: true })
  return existing ? { action: 'exists', item: existing } : { action: 'create', name: desiredName }
}

/** Exact-client isolation guard. Throws if a mapping is used for a different client. */
export function assertSameClient(mappedClientId: string, requestedClientId: string): void {
  if (!mappedClientId || !requestedClientId || mappedClientId !== requestedClientId) {
    throw new Error('Client isolation violation: mapping does not belong to the requested client.')
  }
}

export type TokenState = 'valid' | 'needs_refresh' | 'needs_consent'

/**
 * Pure token lifecycle decision for the delegated OAuth flow.
 * - no refresh token stored -> needs_consent (one-time interactive sign-in required)
 * - access token missing or within `skewSeconds` of expiry -> needs_refresh
 * - otherwise -> valid
 */
export function computeTokenState(input: {
  hasRefreshToken: boolean
  accessTokenExpiresAt: number | null // epoch ms
  now: number // epoch ms
  skewSeconds?: number
}): TokenState {
  if (!input.hasRefreshToken) return 'needs_consent'
  const skewMs = (input.skewSeconds ?? 300) * 1000
  if (input.accessTokenExpiresAt == null) return 'needs_refresh'
  if (input.accessTokenExpiresAt - input.now <= skewMs) return 'needs_refresh'
  return 'valid'
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}`)
  }
}
