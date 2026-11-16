import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readMetaStoredToken } from './metaTokenStorage.ts'
import { inspectMetaAccessToken } from './metaTokenDiagnostics.ts'
import { readFacebookPhotoStatus, submitFacebookPhoto } from './facebookPublishing.ts'
import { facebookPhotoTransport } from './facebookPublishingTransport.ts'
import { approvedSnapshotDelivery } from './socialPublishingMedia.ts'
import type { PublishingIntent } from './socialPublishing.ts'

interface FacebookServerConfig {
  graphVersion: string; appId: string; appSecret: string; projectUrl: string
  encryptionKey: string; keyVersion: string
}

/** Uses existing mapping + encrypted Meta store; never picks the latest global
 * connection or falls back to another client's/user token for publication.
 * Read-only diagnostics verify the current app, scopes and token lifetime.
 */
export async function facebookPublishingUserToken(sb: SupabaseClient, intent: Readonly<PublishingIntent>, config: FacebookServerConfig,
  ports: { inspect?: typeof inspectMetaAccessToken; now?: () => number } = {}): Promise<string> {
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
    return stored.accessToken
  } catch { return fail() }
}

/** Ready-to-compose private provider ports. Deliberately NOT registered in the
 * worker: current context/explicit consent and an enqueue producer are separate
 * gates. Construct with server configuration only, never a request body.
 */
export function facebookPhotoProvider(sb: SupabaseClient, config: FacebookServerConfig) {
  const media = approvedSnapshotDelivery(sb, config.projectUrl)
  const transport = (intent: Readonly<PublishingIntent>) => facebookPhotoTransport({ intent,
    graphVersion: config.graphVersion, appSecret: config.appSecret,
    resolveUserToken: () => facebookPublishingUserToken(sb, intent, config), approvedMediaUrl: media })
  return {
    async submit(intent: Readonly<PublishingIntent>) { return await submitFacebookPhoto(intent, await transport(intent)) },
    async reconcile(intent: Readonly<PublishingIntent>) { return await readFacebookPhotoStatus(intent, await transport(intent)) },
  }
}
