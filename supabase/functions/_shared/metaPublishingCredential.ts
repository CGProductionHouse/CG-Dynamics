import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readMetaStoredToken } from './metaTokenStorage.ts'
import { inspectMetaAccessToken, verifiedMetaTokenValidUntil } from './metaTokenDiagnostics.ts'

export interface MetaPublishingCredentialConfig { graphVersion: string; appId: string; appSecret: string; encryptionKey: string; keyVersion: string }
export type MetaPublishingCredentialPorts = { inspect?: typeof inspectMetaAccessToken; now?: () => number }
const scopes = {
  facebook_photo: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
  instagram_facebook_photo: ['pages_show_list', 'instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
} as const

/** Fixed server-owned diagnostics only. Never copy provider reasons, tokens or
 * arbitrary exception codes into preparation receipts. Unknown expiry remains
 * blocked; this classification does not relax credential lifetime policy. */
export class MetaPublishingCredentialError extends Error {
  constructor(readonly code: 'META_PUBLISHING_CREDENTIAL_UNAVAILABLE' | 'META_PUBLISHING_TOKEN_EXPIRY_UNVERIFIED') {
    super('Exact Meta publishing credential unavailable.')
  }
}

/** PRIVATE token/app validation only; this does NOT grant any Page/Instagram
 * account access. Callers must independently verify the exact active asset and
 * current Page tasks/account identity. No legacy plaintext or latest-user fallback.
 */
export async function resolveMetaPublishingCredential(sb: SupabaseClient, target: Readonly<{ clientId: string; connectionId: string }>,
  config: MetaPublishingCredentialConfig, use: keyof typeof scopes, ports: MetaPublishingCredentialPorts = {}) {
  function fail(code: MetaPublishingCredentialError['code'] = 'META_PUBLISHING_CREDENTIAL_UNAVAILABLE'): never {
    throw new MetaPublishingCredentialError(code)
  }
  if (!Object.hasOwn(scopes, use) || !/^v\d+\.\d+$/.test(config.graphVersion) || !/^\d+$/.test(config.appId)) fail()
  try {
    const [client, connection, token] = await Promise.all([
      sb.from('clients').select('id').eq('id', target.clientId).eq('active', true).maybeSingle(),
      sb.from('meta_connections').select('id').eq('id', target.connectionId).eq('status', 'connected').maybeSingle(),
      sb.from('meta_connection_tokens').select('encrypted_access_token').eq('connection_id', target.connectionId).maybeSingle(),
    ])
    if ([client, connection, token].some(r => r.error || !r.data) || !token.data) fail()
    const stored = await readMetaStoredToken(token.data.encrypted_access_token, target.connectionId, config.encryptionKey, config.keyVersion)
    if (!stored.encryptedAtRest) fail()
    const d = await (ports.inspect ?? inspectMetaAccessToken)({ graphBaseUrl: `https://graph.facebook.com/${config.graphVersion}`,
      appId: config.appId, appSecret: config.appSecret, accessToken: stored.accessToken })
    const now = (ports.now ?? Date.now)()
    if (d.state !== 'valid' || d.tokenType !== 'USER' || scopes[use].some(s => !d.grantedScopes.includes(s))) fail()
    const validUntil = verifiedMetaTokenValidUntil(d, now)
    if (!validUntil) {
      if (!Number.isFinite(Date.parse(d.expiresAt ?? ''))) fail('META_PUBLISHING_TOKEN_EXPIRY_UNVERIFIED')
      fail()
    }
    return { accessToken: stored.accessToken, tokenValidUntil: validUntil, grantedScopes: [...d.grantedScopes] }
  } catch (error) {
    if (error instanceof MetaPublishingCredentialError) throw error
    return fail()
  }
}
