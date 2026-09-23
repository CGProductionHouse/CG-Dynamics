import {
  decryptInstagramAccessToken,
  INSTAGRAM_TOKEN_ENCRYPTION_VERSION,
} from './instagramTokenEncryption.ts'
import { resolveInstagramGraphConfig } from './instagramLogin.ts'

export interface InstagramReportingAsset {
  id: string
  clientId: string
  instagramAccountId: string
  instagramConnectionId: string | null
  facebookPageId: string | null
}

export interface StandaloneInstagramCredentialRows {
  connection: {
    id: string
    client_id: string
    instagram_account_id: string
    status: string
    confirmed_asset_id: string | null
  } | null
  token: {
    ciphertext_base64: string | null
    iv_base64: string | null
    encryption_version: string | null
    key_version: string | null
    token_expires_at: string | null
  } | null
}

export interface InstagramReportingCredential {
  token: string
  connectionId: string
  baseUrl: string
  apiVersion: string
  tokenClass: 'page' | 'user'
  route: 'page_linked' | 'legacy_meta' | 'standalone_instagram'
}

export class InstagramReportingCredentialError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'InstagramReportingCredentialError'
    this.code = code
  }
}

function unusable(code: string, detail: string): never {
  throw new InstagramReportingCredentialError(
    code,
    `Standalone Instagram access is unavailable: ${detail} Reconnect Instagram and complete staff review.`,
  )
}

export async function resolveInstagramReportingCredential(input: {
  asset: InstagramReportingAsset
  metaConnectionId: string | null
  metaBaseUrl: string
  metaApiVersion: string
  metaUserToken: string | null
  pageToken: string | null
  loadStandalone: (connectionId: string) => Promise<StandaloneInstagramCredentialRows>
  encryptionKeyBase64: string | undefined
  supportedKeyVersion: string | undefined
  instagramGraphVersion: string | undefined
  now?: Date
}): Promise<InstagramReportingCredential> {
  const { asset } = input

  // Page-linked Instagram remains the preferred route. A standalone credential
  // is never considered for a Page-linked asset or for Facebook work.
  if (asset.facebookPageId) {
    const token = input.pageToken ?? input.metaUserToken
    if (!token || !input.metaConnectionId) {
      unusable('page_linked_token_missing', 'the linked Facebook Page credential is missing.')
    }
    return {
      token,
      connectionId: input.metaConnectionId,
      baseUrl: input.metaBaseUrl,
      apiVersion: input.metaApiVersion,
      tokenClass: input.pageToken ? 'page' : 'user',
      route: 'page_linked',
    }
  }

  if (!asset.instagramConnectionId) {
    if (!input.metaUserToken || !input.metaConnectionId) {
      unusable('meta_token_missing', 'no reviewed reporting credential is available.')
    }
    return {
      token: input.metaUserToken,
      connectionId: input.metaConnectionId,
      baseUrl: input.metaBaseUrl,
      apiVersion: input.metaApiVersion,
      tokenClass: 'user',
      route: 'legacy_meta',
    }
  }

  const rows = await input.loadStandalone(asset.instagramConnectionId)
  const connection = rows.connection
  const tokenRow = rows.token
  if (!connection || connection.id !== asset.instagramConnectionId) {
    unusable('connection_missing', 'the reviewed connection could not be found.')
  }
  if (connection.client_id !== asset.clientId) {
    unusable('client_mismatch', 'the reviewed connection does not belong to this client.')
  }
  if (connection.instagram_account_id !== asset.instagramAccountId) {
    unusable('account_mismatch', 'the reviewed account does not match this asset.')
  }
  if (connection.status !== 'connected' || connection.confirmed_asset_id !== asset.id) {
    unusable('review_binding_invalid', 'the connection is not currently approved for this asset.')
  }
  if (!tokenRow?.ciphertext_base64 || !tokenRow.iv_base64 || !tokenRow.key_version) {
    unusable('encrypted_token_missing', 'the encrypted credential is missing.')
  }
  if (tokenRow.encryption_version !== INSTAGRAM_TOKEN_ENCRYPTION_VERSION) {
    unusable('encryption_version_unsupported', 'the encrypted credential version is unsupported.')
  }
  if (!input.supportedKeyVersion || tokenRow.key_version !== input.supportedKeyVersion) {
    unusable('key_version_unsupported', 'the encrypted credential key version is unsupported.')
  }
  if (!input.encryptionKeyBase64) {
    unusable('encryption_key_missing', 'the credential decryption service is not configured.')
  }
  if (!tokenRow.token_expires_at || new Date(tokenRow.token_expires_at).getTime() <= (input.now ?? new Date()).getTime()) {
    unusable('token_expired', 'the provider credential has expired.')
  }

  let token: string
  try {
    token = await decryptInstagramAccessToken({
      encrypted: {
        encryptionVersion: INSTAGRAM_TOKEN_ENCRYPTION_VERSION,
        keyVersion: tokenRow.key_version,
        ivBase64: tokenRow.iv_base64,
        ciphertextBase64: tokenRow.ciphertext_base64,
      },
      keyBase64: input.encryptionKeyBase64,
      context: {
        clientId: asset.clientId,
        instagramAccountId: asset.instagramAccountId,
        keyVersion: tokenRow.key_version,
      },
    })
  } catch {
    unusable('credential_authentication_failed', 'the encrypted credential could not be authenticated.')
  }

  const graph = resolveInstagramGraphConfig(input.instagramGraphVersion)
  return {
    token,
    connectionId: connection.id,
    baseUrl: graph.baseUrl,
    apiVersion: graph.version,
    tokenClass: 'user',
    route: 'standalone_instagram',
  }
}
