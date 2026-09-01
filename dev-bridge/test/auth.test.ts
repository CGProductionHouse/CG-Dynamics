import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { exportJWK, SignJWT } from 'jose'
import { authenticate } from '../src/auth.js'

test('OAuth authentication enforces issuer, audience, owner subject and read scope', { concurrency: false }, async () => {
  const issuer = 'https://issuer-auth-test.example.com/'
  const audience = 'https://bridge-auth-test.example.com/mcp'
  const jwksUri = `${issuer}.well-known/jwks.json`
  process.env.OWNER_BRIDGE_PUBLIC_URL = 'https://bridge-auth-test.example.com'
  process.env.OWNER_BRIDGE_OAUTH_ISSUER = issuer
  process.env.OWNER_BRIDGE_OAUTH_AUDIENCE = audience
  process.env.OWNER_BRIDGE_OAUTH_JWKS_URI = jwksUri
  process.env.OWNER_BRIDGE_ALLOWED_SUBJECTS = 'provider|owner'

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...await exportJWK(publicKey), alg: 'RS256', kid: 'auth-test' }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async input => {
    assert.equal(String(input), jwksUri)
    return Response.json({ keys: [jwk] })
  }

  const token = async (subject: string, scope: string, tokenAudience = audience) => new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', kid: 'auth-test' })
    .setIssuer(issuer)
    .setAudience(tokenAudience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

  try {
    const owner = await authenticate(new Request(audience, { headers: { Authorization: `Bearer ${await token('provider|owner', 'dev:read dev:write')}` } }))
    assert.equal(owner?.subject, 'provider|owner')
    assert.deepEqual(owner?.scopes, new Set(['dev:read', 'dev:write']))
    assert.equal(await authenticate(new Request(audience, { headers: { Authorization: `Bearer ${await token('provider|other', 'dev:read')}` } })), null)
    assert.equal(await authenticate(new Request(audience, { headers: { Authorization: `Bearer ${await token('provider|owner', 'dev:write')}` } })), null)
    assert.equal(await authenticate(new Request(audience, { headers: { Authorization: `Bearer ${await token('provider|owner', 'dev:read', 'https://wrong.example/mcp')}` } })), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
