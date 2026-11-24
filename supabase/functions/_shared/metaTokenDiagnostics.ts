import { metaFetch, readMetaError, redact } from './meta.ts'

export type MetaTokenValidationState = 'valid' | 'invalid' | 'unverified'

export interface MetaTokenDiagnostics {
  state: MetaTokenValidationState
  tokenType: string | null
  expiresAt: string | null
  expiryKind?: 'fixed' | 'explicit_zero' | 'unknown'
  dataAccessExpiresAt: string | null
  validatedAt: string
  grantedScopes: string[]
  errorCode: string | null
  errorReason: string | null
}

function epochSecondsToIso(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

/** A finite PRIVATE proof window, not a fabricated token expiry. Meta's SDK
 * treats literal numeric zero separately from expired dates. Missing/malformed
 * expiry is never equivalent. Zero requires fresh valid USER/app proof plus a
 * finite future data-access expiry; revalidate at every prepare/dispatch.
 * https://github.com/facebookarchive/php-graph-sdk/blob/5.x/src/Facebook/Authentication/AccessTokenMetadata.php
 */
export function verifiedMetaTokenValidUntil(d: MetaTokenDiagnostics, now: number): string | null {
  const checked = Date.parse(d.validatedAt), fixed = Date.parse(d.expiresAt ?? '')
  const data = d.dataAccessExpiresAt === null ? Infinity : Date.parse(d.dataAccessExpiresAt)
  if (d.state !== 'valid' || d.tokenType !== 'USER' || !Number.isFinite(now) || !Number.isFinite(checked)
    || checked < now - 120_000 || checked > now + 30_000 || !(data > now + 120_000)) return null
  let until: number
  if (Number.isFinite(fixed)) until = Math.min(fixed, data)
  else if (d.expiryKind === 'explicit_zero' && d.expiresAt === null && Number.isFinite(data)) until = Math.min(data, checked + 900_000)
  else return null
  return until > now + 120_000 ? new Date(until).toISOString() : null
}

/**
 * Validate a user token with Meta's /debug_token endpoint. The app token and
 * inspected token stay server-side and are always redacted from errors.
 */
export async function inspectMetaAccessToken(args: {
  graphBaseUrl: string
  appId: string
  appSecret: string
  accessToken: string
}): Promise<MetaTokenDiagnostics> {
  const validatedAt = new Date().toISOString()
  const appToken = `${args.appId}|${args.appSecret}`

  try {
    const response = await metaFetch(
      `${args.graphBaseUrl}/debug_token?input_token=${encodeURIComponent(args.accessToken)}`,
      { headers: { Authorization: `Bearer ${appToken}` } },
    )
    if (!response.ok) {
      const error = await readMetaError(response, [args.accessToken, appToken, args.appSecret])
      return {
        state: 'unverified', tokenType: null, expiresAt: null, dataAccessExpiresAt: null,
        validatedAt, grantedScopes: [], errorCode: error.code,
        errorReason: redact(error.message, [args.accessToken, appToken, args.appSecret]),
      }
    }

    const body = await response.json() as { data?: Record<string, unknown> }
    const data = body.data ?? {}
    const appMatches = data.app_id === args.appId
    const isValid = data.is_valid === true && appMatches
    const scopes = Array.isArray(data.scopes)
      ? data.scopes.filter((scope): scope is string => typeof scope === 'string')
      : []

    const expiresAt = epochSecondsToIso(data.expires_at)
    return {
      state: isValid ? 'valid' : 'invalid',
      tokenType: typeof data.type === 'string' ? data.type : null,
      expiresAt,
      expiryKind: data.expires_at === 0 ? 'explicit_zero' : expiresAt ? 'fixed' : 'unknown',
      dataAccessExpiresAt: epochSecondsToIso(data.data_access_expires_at),
      validatedAt,
      grantedScopes: scopes,
      errorCode: isValid ? null : (appMatches ? 'invalid_token' : 'wrong_app'),
      errorReason: isValid ? null : (appMatches
        ? 'Meta reports that this access token is invalid.'
        : 'The Meta token belongs to a different app.'),
    }
  } catch (error) {
    return {
      state: 'unverified', tokenType: null, expiresAt: null, dataAccessExpiresAt: null,
      validatedAt, grantedScopes: [], errorCode: 'validation_unavailable',
      errorReason: redact(error instanceof Error ? error.message : String(error), [args.accessToken, appToken, args.appSecret]),
    }
  }
}

