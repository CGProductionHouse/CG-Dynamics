// oauthDiscovery.ts — OAuth 2.1 discovery + challenge helpers for the CG Dynamics MCP
// resource server (Issue #316 / PR #317). Pure and import-free so it is unit-tested
// without the Deno runtime.
//
// Implements the client-facing half of the MCP Authorization spec:
//   • RFC 9728 Protected Resource Metadata — tells ChatGPT which authorization server
//     protects this MCP resource, so it can fetch that server's metadata (and its
//     Dynamic Client Registration endpoint) with no manual client credentials.
//   • RFC 6750 Bearer `WWW-Authenticate` challenge — points an unauthenticated caller at
//     the protected-resource metadata document.
//
// All URLs are derived from the public Supabase project origin (SUPABASE_URL). This module
// NEVER embeds an OAuth client id, client secret, or ChatGPT callback URL.

/** Path of the canonical MCP resource, relative to the Supabase project origin. */
export const MCP_RESOURCE_SUFFIX = '/functions/v1/cg-dynamics-mcp/mcp'

/** Path where this function serves its Protected Resource Metadata document. */
export const PRM_PATH_SUFFIX = '/functions/v1/cg-dynamics-mcp/.well-known/oauth-protected-resource'

/** Substring identifying any Protected Resource Metadata request reaching this function. */
export const PROTECTED_RESOURCE_METADATA_MARKER = '/.well-known/oauth-protected-resource'

export interface McpOAuthUrls {
  /** Canonical MCP resource identifier (the value ChatGPT connects to). */
  resource: string
  /** Supabase authorization server base (serves its own AS metadata + DCR). */
  authorizationServer: string
  /** Absolute URL of this function's Protected Resource Metadata document. */
  protectedResourceMetadataUrl: string
}

/**
 * Derive the canonical MCP OAuth URLs from the Supabase project URL
 * (e.g. `https://<ref>.supabase.co`). Returns null for a missing/invalid origin rather
 * than guessing, so callers fail closed. Never hardcodes credentials or callbacks.
 */
export function deriveMcpOAuthUrls(supabaseUrl: string | null | undefined): McpOAuthUrls | null {
  if (!supabaseUrl) return null
  const origin = supabaseUrl.trim().replace(/\/+$/, '')
  if (!/^https:\/\/[^/\s]+$/i.test(origin)) return null
  return {
    resource: `${origin}${MCP_RESOURCE_SUFFIX}`,
    authorizationServer: `${origin}/auth/v1`,
    protectedResourceMetadataUrl: `${origin}${PRM_PATH_SUFFIX}`,
  }
}

/** RFC 9728 Protected Resource Metadata document for the MCP resource. */
export function buildProtectedResourceMetadata(urls: McpOAuthUrls) {
  return {
    resource: urls.resource,
    authorization_servers: [urls.authorizationServer],
    bearer_methods_supported: ['header'],
    // Supabase OAuth Server currently supports openid/email/profile/phone only.
    // CG Dynamics does not need OIDC ID tokens for MCP access; the access token is
    // resolved to the exact Supabase user and RLS remains authoritative. Keep the
    // advertised set to scopes we actually need and avoid unsupported offline_access.
    scopes_supported: ['email', 'profile'],
  }
}

/**
 * RFC 6750 `WWW-Authenticate` challenge value. Always advertises `resource_metadata`;
 * includes `error`/`error_description` when a token was supplied but rejected.
 */
export function buildWwwAuthenticateChallenge(
  protectedResourceMetadataUrl: string,
  opts?: { error?: string; errorDescription?: string },
): string {
  const parts = [`Bearer resource_metadata="${protectedResourceMetadataUrl}"`]
  if (opts?.error) parts.push(`error="${opts.error}"`)
  if (opts?.errorDescription) parts.push(`error_description="${opts.errorDescription}"`)
  return parts.join(', ')
}

/** True when the request path targets this function's Protected Resource Metadata. */
export function isProtectedResourceMetadataRequest(pathname: string): boolean {
  return typeof pathname === 'string' && pathname.includes(PROTECTED_RESOURCE_METADATA_MARKER)
}

// ── Tool-level auth challenge (OpenAI Plugins "Triggering authentication UI") ──
//
// Current OpenAI Plugins auth docs require BOTH per-tool `securitySchemes` metadata AND a
// runtime auth error carrying `_meta["mcp/www_authenticate"]`. The HTTP 401 +
// WWW-Authenticate transport challenge stays in place; this is the MCP-result form ChatGPT
// reads to surface the account-linking UI for a tool call.

export type McpAuthChallengeError = 'invalid_token' | 'insufficient_scope'

export interface McpAuthChallengeMeta {
  'mcp/www_authenticate': string[]
}

/** The `_meta` block for an MCP tool auth error. Never carries a token or secret. */
export function buildMcpAuthChallengeMeta(
  protectedResourceMetadataUrl: string,
  error: McpAuthChallengeError,
  errorDescription: string,
): McpAuthChallengeMeta {
  return {
    'mcp/www_authenticate': [
      buildWwwAuthenticateChallenge(protectedResourceMetadataUrl, { error, errorDescription }),
    ],
  }
}
