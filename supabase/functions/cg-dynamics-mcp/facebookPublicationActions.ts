import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { facebookPublicationRuntime, readFacebookStaffConfiguration } from '../_shared/facebookPublicationRuntime.ts'
import { photoPublicationStaffHandler } from '../_shared/facebookPublicationStaff.ts'
import { socialPublicationAuthorizationStore } from '../_shared/socialPublicationAuthorizationStore.ts'
import { readPublicationManagementStatus } from '../_shared/socialPublicationManagement.ts'

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const failure = (error: string, mayHaveCommitted = false) => ({ data_state: 'unavailable', error, canConfirm: false, canPublish: false,
  ...(mayHaveCommitted ? { outcome: 'unverified', mayHaveCommitted: true, next_action: 'Read get_social_publication_status for the same client/review before retrying. Never switch keys or create a replacement blindly.' } : {}) })

/** Company-admin MCP bridge to the SAME staff authorization/receipt services.
 * No provider submission, caller-supplied account/time/content or new queue.
 * The MCP gate cannot enable staff/dispatch gates or an exact-account release.
 */
export async function facebookPublicationAction(sb: SupabaseClient, actorId: string, action: 'preview' | 'confirm' | 'status',
  raw: Record<string, unknown>, get: (name: string) => string | undefined) {
  const input = Object.freeze({ ...raw }), confirm = action === 'confirm'
  const keys = confirm ? ['client_id', 'review_id', 'expected_fingerprint', 'confirm_scheduling', 'idempotency_key'] : ['client_id', 'review_id']
  if (!['preview', 'confirm', 'status'].includes(action) || !uuid(actorId) || !uuid(input.client_id) || !uuid(input.review_id)
    || Object.keys(input).length !== keys.length || keys.some(k => !Object.hasOwn(input, k))
    || confirm && (!hash(input.expected_fingerprint) || input.confirm_scheduling !== true
      || typeof input.idempotency_key !== 'string' || !input.idempotency_key.trim() || input.idempotency_key.length > 240)) return failure('PUBLICATION_INPUT_INVALID')
  let mutationAttempted = false
  try {
    const authenticate = async () => {
      const result = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
      return result.error || result.data?.is_active !== true || !['admin', 'manager'].includes(result.data.role)
        ? null : { id: actorId, role: result.data.role, active: true }
    }
    if (!await authenticate()) return failure('ACTIVE_MANAGER_REQUIRED')
    // Refuse a wrong-client review before reading jobs, tokens, media or provider.
    const readScope = () => sb.from('content_review_versions').select('id,client_id,deliverable_id')
      .eq('id', input.review_id).eq('client_id', input.client_id).maybeSingle()
    const scope = await readScope(), r = scope.data
    if (scope.error || r?.id !== input.review_id || r.client_id !== input.client_id || !uuid(r.deliverable_id)) return failure('EXACT_CLIENT_REVIEW_REQUIRED')
    if (action === 'status') {
      const status = await readPublicationManagementStatus(sb, actorId, input.review_id)
      if (!status || status.clientId !== input.client_id || status.reviewId !== input.review_id) return failure('PUBLICATION_STATUS_UNAVAILABLE')
      return { data_state: 'available', scope: 'stored_publication_jobs', status, nativeSchedulesChecked: false, canConfirm: false, canPublish: false }
    }
    if (get('SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED') !== 'true') return failure('PUBLICATION_MCP_DISABLED')
    const configuration = readFacebookStaffConfiguration(get)
    if (!configuration) return failure('PUBLICATION_ROLLOUT_DISABLED')
    if (configuration.release.clientId !== input.client_id) return failure('EXACT_ACCOUNT_RELEASE_REQUIRED')
    const handler = photoPublicationStaffHandler({ authenticate, runtime: facebookPublicationRuntime(sb, configuration),
      persistence: socialPublicationAuthorizationStore(sb) })
    mutationAttempted = confirm
    const response = await handler(new Request('https://internal.invalid/publication', { method: 'POST', body: JSON.stringify({
      action, reviewId: input.review_id,
      ...(confirm ? { expectedFingerprint: input.expected_fingerprint, confirmPublication: true } : {}),
    }) }))
    const body: unknown = await response.json()
    // A committed confirmation can outlive lost/revoked access. Never report it
    // failed or repeat the mutation when the final receipt cannot be verified.
    const current = await readScope()
    // Both review IDs are already validated strings, so the preceding optional
    // ID comparison excludes null data before the remaining field comparisons.
    if (!await authenticate() || current.error || current.data?.id !== r.id || current.data!.client_id !== r.client_id
      || current.data!.deliverable_id !== r.deliverable_id) return failure('PUBLICATION_RECEIPT_UNVERIFIED', mutationAttempted)
    if (!response.ok || !object(body) || body.ok !== true) {
      const code = object(body) && typeof body.error === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(body.error) ? body.error : 'PUBLICATION_VERIFICATION_UNAVAILABLE'
      const blockers = object(body) && Array.isArray(body.blockers) ? body.blockers.filter(v => typeof v === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(v)).slice(0, 20) : []
      return { ...failure(code, mutationAttempted && response.status >= 500), ...(blockers.length ? { blockers } : {}) }
    }
    if (!confirm) {
      const p = body.preview, t = object(p) ? p.target : null
      if (!object(p) || !object(t) || t.clientId !== input.client_id || t.reviewVersionId !== input.review_id
        || t.deliverableId !== r.deliverable_id || t.connectionId !== configuration.release.connectionId
        || t.accountId !== configuration.release.accountId || t.route !== 'facebook_page' || p.platform !== 'facebook'
        || typeof p.caption !== 'string' || !['image/png', 'image/jpeg'].includes(String(p.mediaType))
        || !hash(p.assetSha256) || !hash(p.fingerprint) || typeof p.scheduledAt !== 'string' || !(Date.parse(p.scheduledAt) > Date.now())) return failure('PUBLICATION_PREVIEW_UNVERIFIED')
      return { data_state: 'available', scope: 'facebook_scheduling_preview', canConfirm: true, canPublish: false,
        requiresExplicitSchedulingConfirmation: true, preview: { reviewId: input.review_id, clientId: input.client_id,
          accountId: t.accountId, platform: 'facebook', caption: p.caption, mediaType: p.mediaType,
          assetSha256: p.assetSha256, scheduledAt: p.scheduledAt, fingerprint: p.fingerprint } }
    }
    const p = body.publication
    if (!object(p) || !uuid(p.jobId) || !uuid(p.authorizationId) || p.fingerprint !== input.expected_fingerprint
      || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(String(p.status))
      || !['queued', 'retry_wait', 'submitting', 'provider_scheduled', 'processing', 'posted', 'unknown_outcome', 'blocked', 'failed', 'cancelled'].includes(String(p.state))) return failure('PUBLICATION_RECEIPT_UNVERIFIED', true)
    return { data_state: 'available', scope: 'durable_publication_authorization', canConfirm: false, canPublish: false,
      providerPublicationVerified: false, publication: { jobId: p.jobId, authorizationId: p.authorizationId,
        fingerprint: p.fingerprint, status: p.status, state: p.state },
      next_action: 'Read get_social_publication_status. A durable authorization is not a verified platform publication; never manually schedule a duplicate.' }
  } catch { return failure('PUBLICATION_VERIFICATION_UNAVAILABLE', mutationAttempted) }
}
