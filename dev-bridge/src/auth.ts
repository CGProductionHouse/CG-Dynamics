import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { getBridgeConfig, getPublicUrl, READ_SCOPE, WRITE_SCOPE } from './config.js'

export type OwnerIdentity = {
  subject: string
  scopes: Set<string>
  claims: JWTPayload
}

const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function challenge(): string {
  return `Bearer resource_metadata="${getPublicUrl()}/.well-known/oauth-protected-resource/mcp", scope="${READ_SCOPE}"`
}

export function writeScopeChallenge(): string {
  const config = getBridgeConfig()
  return `Bearer resource_metadata="${config.publicUrl}/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", error_description="Owner write permission is required", scope="${READ_SCOPE} ${WRITE_SCOPE}"`
}

export function unauthorizedResponse(message = 'Owner authentication required.'): Response {
  return Response.json({ error: 'unauthorized', message }, {
    status: 401,
    headers: { 'WWW-Authenticate': challenge(), 'Cache-Control': 'no-store' },
  })
}

export async function authenticate(request: Request): Promise<OwnerIdentity | null> {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return null

  const config = getBridgeConfig()
  let jwks = jwksByUri.get(config.jwksUri)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.jwksUri), { timeoutDuration: 5_000, cooldownDuration: 30_000 })
    jwksByUri.set(config.jwksUri, jwks)
  }

  try {
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: 5,
      maxTokenAge: '1h',
    })
    if (!payload.sub || !config.allowedSubjects.has(payload.sub)) return null
    const scopeValue = typeof payload.scope === 'string' ? payload.scope : ''
    const scopes = new Set(scopeValue.split(/\s+/).filter(Boolean))
    if (!scopes.has(READ_SCOPE)) return null
    return { subject: payload.sub, scopes, claims: payload }
  } catch {
    return null
  }
}

export function requireWriteScope(identity: OwnerIdentity): void {
  if (!identity.scopes.has(WRITE_SCOPE)) throw new Error(`Missing required OAuth scope: ${WRITE_SCOPE}`)
}

export function protectedResourceMetadata(): Record<string, unknown> {
  const config = getBridgeConfig()
  return {
    resource: `${config.publicUrl}/mcp`,
    // RFC 8414 issuer identifiers are exact strings. In particular, Auth0's
    // discovery document normally includes a trailing slash; changing it here
    // can make ChatGPT reject the authorization response issuer.
    authorization_servers: [config.issuer],
    scopes_supported: [READ_SCOPE, WRITE_SCOPE],
    resource_documentation: 'https://github.com/CGProductionHouse/CG-Dynamics/blob/main/docs/owner-dev-bridge.md',
  }
}
