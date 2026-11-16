import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readMetaStoredToken } from './metaTokenStorage.ts'
import { inspectMetaAccessToken } from './metaTokenDiagnostics.ts'
import { readFacebookPhotoStatus, submitFacebookPhoto } from './facebookPublishing.ts'
import { facebookPhotoTransport, verifyFacebookPageAccess } from './facebookPublishingTransport.ts'
import { approvedSnapshotDelivery, inspectPublicationSnapshot } from './socialPublishingMedia.ts'
import { verifyFacebookPhotoMedia, FACEBOOK_PHOTO_MAX_BYTES } from './facebookPhotoMedia.ts'
import type { PublishingIntent, PublishingBinding } from './socialPublishing.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'

export interface FacebookServerConfig {
  graphVersion: string; appId: string; appSecret: string; projectUrl: string
  encryptionKey: string; keyVersion: string
}

/** Uses existing mapping + encrypted Meta store; never picks the latest global
 * connection or falls back to another client's/user token for publication.
 * Read-only diagnostics verify the current app, scopes and token lifetime.
 */
type CredentialTarget = Pick<PublishingIntent, 'platform' | 'route' | 'accountId' | 'clientId' | 'connectionId'>
type CredentialPorts = { inspect?: typeof inspectMetaAccessToken; now?: () => number }
async function facebookPublishingCredential(sb: SupabaseClient, intent: Readonly<CredentialTarget>, config: FacebookServerConfig,
  ports: CredentialPorts = {}) {
  function fail(): never { throw new Error('Exact Facebook publishing credential unavailable.') }
  if (intent.platform !== 'facebook' || intent.route !== 'facebook_page' || !/^\d+$/.test(intent.accountId)
    || !/^v\d+\.\d+$/.test(config.graphVersion) || !/^\d+$/.test(config.appId)) fail()
  try {
    const [client, mapping, connection, token] = await Promise.all([
      sb.from('clients').select('id').eq('id', intent.clientId).eq('active', true).maybeSingle(),
      sb.from('meta_client_assets').select('id').eq('client_id', intent.clientId).eq('connection_id', intent.connectionId)
        .eq('facebook_page_id', intent.accountId).eq('is_active', true).maybeSingle(),
      sb.from('meta_connections').select('id').eq('id', intent.connectionId).eq('status', 'connected').maybeSingle(),
      sb.from('meta_connection_tokens').select('encrypted_access_token').eq('connection_id', intent.connectionId).maybeSingle(),
    ])
    if ([client, mapping, connection, token].some(r => r.error || !r.data) || !token.data) fail()
    const stored = await readMetaStoredToken(token.data.encrypted_access_token, intent.connectionId, config.encryptionKey, config.keyVersion)
    // Existing reporting may still diagnose legacy plaintext; new publishing
    // cannot use that fallback or silently rewrite the credential.
    if (!stored.encryptedAtRest) fail()
    const diagnostics = await (ports.inspect ?? inspectMetaAccessToken)({ graphBaseUrl: `https://graph.facebook.com/${config.graphVersion}`,
      appId: config.appId, appSecret: config.appSecret, accessToken: stored.accessToken })
    const now = (ports.now ?? Date.now)()
    const expiry = Date.parse(diagnostics.expiresAt ?? '')
    const dataExpiry = diagnostics.dataAccessExpiresAt === null ? Infinity : Date.parse(diagnostics.dataAccessExpiresAt)
    if (diagnostics.state !== 'valid' || diagnostics.tokenType !== 'USER' || !Number.isFinite(now)
      || !Number.isFinite(expiry) || expiry <= now + 120_000 || !(dataExpiry > now + 120_000)
      || ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].some(s => !diagnostics.grantedScopes.includes(s))) fail()
    return { accessToken: stored.accessToken, tokenValidUntil: new Date(Math.min(expiry, dataExpiry)).toISOString(), grantedScopes: [...diagnostics.grantedScopes] }
  } catch { return fail() }
}

export async function facebookPublishingUserToken(sb: SupabaseClient, intent: Readonly<PublishingIntent>, config: FacebookServerConfig,
  ports: CredentialPorts = {}): Promise<string> {
  return (await facebookPublishingCredential(sb, intent, config, ports)).accessToken
}

/** Private preparation adapter. Reads live app/token/permission/Page evidence;
 * returns only exact-account metadata, never a token, URL or mutation handle.
 * A successful Page read is not rollout approval or staff publication consent.
 */
export async function verifyFacebookPublishingTarget(sb: SupabaseClient, target: Readonly<PublicationTarget>, config: FacebookServerConfig,
  ports: CredentialPorts & { fetch?: typeof fetch } = {}): Promise<{ binding: PublishingBinding; checkedAt: string }> {
  const selected = Object.freeze({ ...target }), settings = Object.freeze({ ...config })
  const intent = { ...selected, platform: 'facebook' as const }
  const credential = await facebookPublishingCredential(sb, intent, settings, ports)
  const access = await verifyFacebookPageAccess({ intent, graphVersion: settings.graphVersion, appSecret: settings.appSecret,
    resolveUserToken: async () => credential.accessToken, fetch: ports.fetch, now: ports.now })
  if (!(Date.parse(credential.tokenValidUntil) > Date.parse(access.checkedAt) + 120_000)) throw new Error('Exact Facebook publishing credential unavailable.')
  return { checkedAt: access.checkedAt, binding: { clientId: selected.clientId, connectionId: selected.connectionId,
    accountId: selected.accountId, route: selected.route, active: true, grantedScopes: credential.grantedScopes,
    tokenValidUntil: credential.tokenValidUntil, appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: false } }
}

/** Ready-to-compose private provider ports. Deliberately NOT registered in the
 * worker: current context/explicit consent and an enqueue producer are separate
 * gates. Construct with server configuration only, never a request body.
 */
export function facebookPhotoProvider(sb: SupabaseClient, config: FacebookServerConfig) {
  const media = approvedSnapshotDelivery(sb, config.projectUrl)
  const transport = (intent: Readonly<PublishingIntent>) => facebookPhotoTransport({ intent,
    graphVersion: config.graphVersion, appSecret: config.appSecret,
    resolveUserToken: () => facebookPublishingUserToken(sb, intent, config), approvedMediaUrl: async candidate => {
      // Revalidate the original bytes immediately before creating delivery URL.
      await verifyFacebookPhotoMedia(await inspectPublicationSnapshot(sb, candidate, FACEBOOK_PHOTO_MAX_BYTES), candidate)
      return await media(candidate)
    } })
  return {
    async submit(intent: Readonly<PublishingIntent>) { return await submitFacebookPhoto(intent, await transport(intent)) },
    async reconcile(intent: Readonly<PublishingIntent>) { return await readFacebookPhotoStatus(intent, await transport(intent)) },
  }
}
