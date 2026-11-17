import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveMetaPublishingCredential, type MetaPublishingCredentialPorts } from './metaPublishingCredential.ts'
import { readFacebookPhotoStatus, submitFacebookPhoto } from './facebookPublishing.ts'
import { facebookPhotoTransport, verifyFacebookPageAccess } from './facebookPublishingTransport.ts'
import { approvedSnapshotDelivery, inspectPublicationSnapshot } from './socialPublishingMedia.ts'
import { FACEBOOK_PHOTO_MAX_BYTES } from './facebookPhotoMedia.ts'
import { verifyFacebookPublicationMedia } from './facebookPublicationMedia.ts'
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
type CredentialPorts = MetaPublishingCredentialPorts
async function facebookPublishingCredential(sb: SupabaseClient, intent: Readonly<CredentialTarget>, config: FacebookServerConfig,
  ports: CredentialPorts = {}) {
  function fail(): never { throw new Error('Exact Facebook publishing credential unavailable.') }
  if (intent.platform !== 'facebook' || intent.route !== 'facebook_page' || !/^\d+$/.test(intent.accountId)
    || !/^v\d+\.\d+$/.test(config.graphVersion) || !/^\d+$/.test(config.appId)) fail()
  try {
    const mapping = await sb.from('meta_client_assets').select('id').eq('client_id', intent.clientId).eq('connection_id', intent.connectionId)
      .eq('facebook_page_id', intent.accountId).eq('is_active', true).maybeSingle()
    if (mapping.error || !mapping.data) fail()
    return await resolveMetaPublishingCredential(sb, intent, config, 'facebook_photo', ports)
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
  ports: CredentialPorts & { fetch?: typeof fetch } = {}): Promise<{ binding: PublishingBinding; checkedAt: string; accountName: string | null }> {
  const selected = Object.freeze({ ...target }), settings = Object.freeze({ ...config })
  const intent = { ...selected, platform: 'facebook' as const }
  const credential = await facebookPublishingCredential(sb, intent, settings, ports)
  const access = await verifyFacebookPageAccess({ intent, graphVersion: settings.graphVersion, appSecret: settings.appSecret,
    resolveUserToken: async () => credential.accessToken, fetch: ports.fetch, now: ports.now })
  if (!(Date.parse(credential.tokenValidUntil) > Date.parse(access.checkedAt) + 120_000)) throw new Error('Exact Facebook publishing credential unavailable.')
  return { checkedAt: access.checkedAt, accountName: access.accountName, binding: { clientId: selected.clientId, connectionId: selected.connectionId,
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
      await verifyFacebookPublicationMedia(await inspectPublicationSnapshot(sb, candidate, FACEBOOK_PHOTO_MAX_BYTES), candidate)
      return await media(candidate)
    } })
  return {
    async submit(intent: Readonly<PublishingIntent>) { return await submitFacebookPhoto(intent, await transport(intent)) },
    async reconcile(intent: Readonly<PublishingIntent>) { return await readFacebookPhotoStatus(intent, await transport(intent)) },
  }
}
