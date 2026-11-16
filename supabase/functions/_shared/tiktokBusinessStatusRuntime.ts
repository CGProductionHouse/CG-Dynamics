import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { PublishingIntent } from './socialPublishing.ts'
import { resolveTikTokBusinessStatusCredential, type TikTokBusinessStatusCredentialConfig } from './tiktokBusinessStatusCredential.ts'
import { readTikTokBusinessPublishingStatus } from './tiktokBusinessPublishingStatus.ts'
import { tiktokBusinessPublishingStatusTransport } from './tiktokBusinessPublishingStatusTransport.ts'

/** PRIVATE read-only composition. No env parser, endpoint/worker registration,
 * account connection, refresh, mutation or new publication authority.
 */
export async function readStoredTikTokBusinessStatus(sb: SupabaseClient, configuration: TikTokBusinessStatusCredentialConfig, input: Readonly<PublishingIntent>,
  options: { fetch?: typeof fetch; now?: () => number; signal?: AbortSignal; readTimeoutMs?: number } = {}) {
  const intent = Object.freeze({ ...input }), config = Object.freeze({ ...configuration }), settings = Object.freeze({ ...options })
  const port = await tiktokBusinessPublishingStatusTransport({ intent, ...settings,
    resolveCredential: (target, signal) => resolveTikTokBusinessStatusCredential(sb, target, config, { ...settings, signal }) })
  return await readTikTokBusinessPublishingStatus(intent, port, { signal: settings.signal, readTimeoutMs: settings.readTimeoutMs })
}
