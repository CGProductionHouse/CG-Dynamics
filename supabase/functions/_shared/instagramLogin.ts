export const INSTAGRAM_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
] as const

export const INSTAGRAM_LOGIN_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
export const INSTAGRAM_LOGIN_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
export const INSTAGRAM_GRAPH_HOST = 'https://graph.instagram.com'

export interface InstagramShortLivedToken {
  accessToken: string
  appScopedUserId: string
  permissions: string[]
}

export interface InstagramProfessionalIdentity {
  appScopedUserId: string
  instagramAccountId: string
  username: string
  accountType: 'Business' | 'Media_Creator'
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Instagram ${label} is missing.`)
  return value.trim()
}

function numericProviderId(value: unknown, label: string): string {
  const id = requiredString(value, label)
  if (!/^\d+$/.test(id)) throw new Error(`Instagram ${label} is invalid.`)
  return id
}

export function resolveInstagramGraphConfig(rawVersion: string | undefined): { version: string; baseUrl: string } {
  const version = (rawVersion ?? '').trim()
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error('INSTAGRAM_GRAPH_VERSION must be an explicit version such as v26.0.')
  }
  return { version, baseUrl: `${INSTAGRAM_GRAPH_HOST}/${version}` }
}

export function buildInstagramAuthorizationUrl(input: {
  appId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: requiredString(input.appId, 'App ID'),
    redirect_uri: requiredString(input.redirectUri, 'redirect URI'),
    response_type: 'code',
    scope: INSTAGRAM_LOGIN_SCOPES.join(','),
    state: requiredString(input.state, 'OAuth state'),
  })
  return `${INSTAGRAM_LOGIN_AUTHORIZE_URL}?${params.toString()}`
}

export function parseInstagramShortLivedToken(body: unknown): InstagramShortLivedToken {
  const candidate = body as {
    data?: Array<{ access_token?: unknown; user_id?: unknown; permissions?: unknown }>
  }
  const record = candidate?.data?.[0]
  if (!record) throw new Error('Instagram token response did not contain one account.')

  const permissions = Array.isArray(record.permissions)
    ? record.permissions.filter((scope): scope is string => typeof scope === 'string')
    : typeof record.permissions === 'string'
      ? record.permissions.split(',').map(scope => scope.trim()).filter(Boolean)
      : []

  return {
    accessToken: requiredString(record.access_token, 'access token'),
    appScopedUserId: numericProviderId(record.user_id, 'app-scoped user ID'),
    permissions,
  }
}

export function parseInstagramProfessionalIdentity(body: unknown): InstagramProfessionalIdentity {
  const candidate = body as {
    data?: Array<{ id?: unknown; user_id?: unknown; username?: unknown; account_type?: unknown }>
  }
  const records = candidate?.data ?? []
  if (records.length !== 1) throw new Error('Instagram identity response did not contain exactly one account.')
  const record = records[0]
  const accountType = requiredString(record.account_type, 'account type')
  if (accountType !== 'Business' && accountType !== 'Media_Creator') {
    throw new Error('Instagram Login requires a Business or Creator professional account.')
  }

  const username = requiredString(record.username, 'username')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new Error('Instagram username is invalid.')

  return {
    appScopedUserId: numericProviderId(record.id, 'app-scoped user ID'),
    instagramAccountId: numericProviderId(record.user_id, 'professional account ID'),
    username,
    accountType,
  }
}

export function missingInstagramLoginScopes(grantedScopes: readonly string[]): string[] {
  return INSTAGRAM_LOGIN_SCOPES.filter(scope => !grantedScopes.includes(scope))
}
