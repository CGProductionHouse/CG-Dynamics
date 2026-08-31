export const REPOSITORY_OWNER = 'CGProductionHouse'
export const REPOSITORY_NAME = 'CG-Dynamics'
export const DEFAULT_BRANCH = 'main'

export const READ_SCOPE = 'dev:read'
export const WRITE_SCOPE = 'dev:write'

export type BridgeConfig = {
  publicUrl: string
  issuer: string
  audience: string
  jwksUri: string
  allowedSubjects: Set<string>
}

export function getPublicUrl(): string {
  return required('OWNER_BRIDGE_PUBLIC_URL').replace(/\/$/, '')
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required configuration: ${name}`)
  return value
}

export function getBridgeConfig(): BridgeConfig {
  const publicUrl = getPublicUrl()
  return {
    publicUrl,
    issuer: required('OWNER_BRIDGE_OAUTH_ISSUER'),
    audience: required('OWNER_BRIDGE_OAUTH_AUDIENCE'),
    jwksUri: required('OWNER_BRIDGE_OAUTH_JWKS_URI'),
    allowedSubjects: new Set(required('OWNER_BRIDGE_ALLOWED_SUBJECTS').split(',').map(value => value.trim()).filter(Boolean)),
  }
}

export function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}
