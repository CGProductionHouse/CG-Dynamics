// oauthConsent.ts — pure, framework-free helpers for the Supabase OAuth 2.1 consent
// page (Issue #316). All decision logic lives here so it can be unit-tested without a
// DOM; the page component stays a thin shell over the Supabase Auth OAuth server API.
//
// This module never handles tokens or secrets. It only parses the incoming
// authorization request, decides consent-vs-redirect, and computes safe internal paths.

import type {
  OAuthAuthorizationDetails,
  OAuthRedirect,
} from '@supabase/supabase-js'

/** The consent route, matching the Supabase OAuth Server "Authorization Path". */
export const OAUTH_CONSENT_PATH = '/oauth/consent'

/**
 * Read and validate the `authorization_id` from a location search string. Fails closed:
 * returns null for a missing or blank value so the page can refuse rather than call the
 * API with garbage.
 */
export function readAuthorizationId(search: string): string | null {
  let id: string | null
  try {
    id = new URLSearchParams(search).get('authorization_id')
  } catch {
    return null
  }
  const trimmed = (id ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * The exact internal path a user should return to after logging in, preserving the
 * authorization request. Same-origin, no host — safe to hand to the router as `from`.
 */
export function consentReturnPath(authorizationId: string): string {
  return `${OAUTH_CONSENT_PATH}?authorization_id=${encodeURIComponent(authorizationId)}`
}

/**
 * Is `path` a safe OAuth-consent return target? Used by Login to decide whether to honour
 * a post-login `from`. Only an internal `/oauth/consent` path qualifies — never an
 * absolute URL, protocol-relative URL, or other route.
 */
export function isSafeOAuthReturnPath(path: string | null | undefined): boolean {
  if (typeof path !== 'string') return false
  // Reject anything that could escape the app origin (absolute or protocol-relative).
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return false
  return /^\/oauth\/consent(?:[/?#]|$)/.test(path)
}

/**
 * Narrow a getAuthorizationDetails response: `true` when the user must still consent
 * (full details returned), `false` when Supabase returned a ready redirect (already
 * consented / decided) that the caller should follow.
 */
export function needsConsent(
  data: OAuthAuthorizationDetails | OAuthRedirect | null | undefined,
): data is OAuthAuthorizationDetails {
  return !!data && 'authorization_id' in data
}

/** Extract a completed redirect URL from a redirect-style response, else null. */
export function redirectUrlFrom(
  data: OAuthAuthorizationDetails | OAuthRedirect | null | undefined,
): string | null {
  if (!!data && 'redirect_url' in data && typeof data.redirect_url === 'string' && data.redirect_url.length > 0) {
    return data.redirect_url
  }
  return null
}

/** Split a space-separated OAuth scope string into a clean, de-duplicated list. */
export function parseScopes(scope: string | null | undefined): string[] {
  const parts = (scope ?? '').split(/\s+/).map(s => s.trim()).filter(Boolean)
  return [...new Set(parts)]
}

/** Human-readable label for a requested scope, with a safe fallback to the raw token. */
export function describeScope(scope: string): string {
  const known: Record<string, string> = {
    openid: 'Confirm your CG Dynamics identity',
    profile: 'Read your basic profile',
    email: 'Read your email address',
    offline_access: 'Stay connected when you are away',
  }
  return known[scope] ?? scope
}
