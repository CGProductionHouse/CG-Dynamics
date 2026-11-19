import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { socialPublicationFingerprint, type PublicationAuthorizationPorts } from './socialPublicationAuthorization.ts'
import type { PublishingContext, PublishingIntent } from './socialPublishing.ts'

/** Atomic RPC ports. Caller actor must come from the authenticated staff session;
 * no client code receives service credentials or direct RPC execution grants.
 */
export function socialPublicationAuthorizationStore(sb: SupabaseClient): Pick<PublicationAuthorizationPorts, 'authorize' | 'revoke'> {
  return {
    async authorize(intent, actorId, fingerprint, evidence) {
      const { data, error } = await sb.rpc('authorize_social_publication', { p_intent: intent, p_actor: actorId, p_fingerprint: fingerprint, p_evidence: evidence })
      if (error || !data) throw new Error('Publication authorization persistence unavailable.')
      return data
    },
    async revoke(jobId, clientId, actorId) {
      const { data, error } = await sb.rpc('revoke_social_publication', { p_id: jobId, p_client: clientId, p_actor: actorId })
      if (error) throw new Error('Publication authorization revocation unavailable.')
      return data
    },
  }
}

/** Worker current-context adapter: recover the ORIGINAL durable confirmation,
 * rather than minting a new authorization during dispatch/reconnection.
 * Revocation stops submission but does not forbid read-only reconciliation.
 */
export async function readSocialPublicationAuthorization(sb: SupabaseClient, jobId: string, intent: Readonly<PublishingIntent>): Promise<PublishingContext['authorization']> {
  const { data: job, error } = await sb.from('background_jobs').select('id,payload,publication,status')
    .eq('id', jobId).eq('job_type', 'social_publish').maybeSingle()
  if (error) throw new Error('Publication authorization read unavailable.')
  const a = job?.publication?.authorization, recorded = job?.payload?.intent
  if (!job || job.status === 'cancelled' || !a || !recorded || a.revokedAt !== null || a.id !== intent.authorizationId
    || recorded.authorizationId !== a.id || recorded.key !== intent.key
    || a.actorId !== job.payload.authorized_by || a.fingerprint !== await socialPublicationFingerprint(intent)
    || a.fingerprint !== await socialPublicationFingerprint(recorded)) return null
  const { data: actor, error: actorError } = await sb.from('profiles').select('id,role,is_active').eq('id', a.actorId).maybeSingle()
  if (actorError) throw new Error('Publication authorizer read unavailable.')
  if (!actor?.is_active || !['admin', 'manager'].includes(actor.role)) return null
  return { id: a.id, reviewVersionId: recorded.reviewVersionId, clientId: recorded.clientId, connectionId: recorded.connectionId,
    accountId: recorded.accountId, route: recorded.route, scheduledAt: recorded.scheduledAt, assetSha256: recorded.assetSha256 }
}
