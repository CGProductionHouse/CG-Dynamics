import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyFacebookPublishingTarget, type FacebookServerConfig } from './facebookPublishingProvider.ts'
import { verifyFacebookPhotoMedia, FACEBOOK_PHOTO_MAX_BYTES } from './facebookPhotoMedia.ts'
import { inspectPublicationSnapshot } from './socialPublishingMedia.ts'
import { readApprovedPublicationSource, readCapturedPublicationSchedule, PublicationPreparationError } from './socialPublicationPreparation.ts'
import type { FacebookPublicationConfiguration } from './facebookPublicationRuntime.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export interface FacebookInspection {
  contract: 'facebook_publication_readiness_v1'; reviewId: string; clientId: string; accountId: string; accountName: string | null
  scheduledAt: string; checkedAt: string; assetSha256: string | null; canConfirm: false; canPublish: false
  checks: { key: 'account' | 'image' | 'teams' | 'time' | 'release'; status: 'pass' | 'blocked' | 'unavailable'; code: string | null }[]
}

/** Read-only ports only: no store/authorize/revoke/sign/submit dependency. The
 * Page comes from ONE existing active exact-client mapping, not caller fields,
 * a global connection, analytics health or a proposed release configuration.
 */
export function facebookPublicationInspector(sb: SupabaseClient, server: FacebookServerConfig, release: FacebookPublicationConfiguration | null) {
  const settings = Object.freeze({ ...server }), packet = release ? Object.freeze({ ...release.release }) : null
  return async (reviewId: string, actorId: string): Promise<FacebookInspection> => {
    function fail(code: string): never { throw new PublicationPreparationError(code) }
    if (!UUID.test(reviewId) || !UUID.test(actorId)) fail('PREPARATION_SCOPE_INVALID')
    const actor = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
    if (actor.error || actor.data?.is_active !== true || !['admin', 'manager'].includes(actor.data.role)) fail('ACTIVE_MANAGER_REQUIRED')
    const review = await sb.from('content_review_versions').select('id,client_id,deliverable_id').eq('id', reviewId).maybeSingle()
    const row = review.data
    if (review.error || !row || row.id !== reviewId || !UUID.test(row.client_id) || !UUID.test(row.deliverable_id)) fail('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
    const mapping = await sb.from('meta_client_assets').select('connection_id,facebook_page_id').eq('client_id', row.client_id).eq('is_active', true).maybeSingle()
    if (mapping.error || !mapping.data || !UUID.test(mapping.data.connection_id) || !/^\d+$/.test(mapping.data.facebook_page_id)) fail('EXACT_ACCOUNT_MAPPING_REQUIRED')
    const target = Object.freeze({ clientId: row.client_id as string, deliverableId: row.deliverable_id as string, reviewVersionId: reviewId,
      connectionId: mapping.data.connection_id as string, accountId: mapping.data.facebook_page_id as string, route: 'facebook_page' as const })
    const { r, d } = await readApprovedPublicationSource(sb, target)
    if (r.media_type !== 'image/png' || typeof r.caption !== 'string' || !r.caption.trim() || r.caption.length > 63_206
      || typeof r.scheduled_at !== 'string' || !Number.isFinite(Date.parse(r.scheduled_at))) fail('REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED')
    const checks: FacebookInspection['checks'] = []
    let accountName: string | null = null, assetSha256: string | null = null
    // Independent reads: a held Teams capture must not conceal the actual Page
    // grant or image result. Failure never becomes permission or a passing check.
    const [account, image, teams] = await Promise.allSettled([
      verifyFacebookPublishingTarget(sb, target, settings),
      (async () => {
        const snapshot = await inspectPublicationSnapshot(sb, { clientId: target.clientId, deliverableId: d.id, reviewVersionId: r.id,
          platform: 'facebook', assetPath: r.asset_path, mediaType: r.media_type, caption: r.caption, scheduledAt: r.scheduled_at }, FACEBOOK_PHOTO_MAX_BYTES)
        await verifyFacebookPhotoMedia(snapshot, target)
        return snapshot.assetSha256
      })(),
      readCapturedPublicationSchedule(sb, target, actorId, d, Date.now()),
    ])
    const completed = Date.now()
    if (!Number.isFinite(completed)) fail('PRIVATE_PREFLIGHT_UNAVAILABLE')
    if (account.status === 'fulfilled' && Date.parse(account.value.checkedAt) >= completed - 120_000
      && Date.parse(account.value.checkedAt) <= completed + 30_000 && Date.parse(account.value.binding.tokenValidUntil ?? '') > completed + 120_000) {
      accountName = account.value.accountName; checks.push({ key: 'account', status: 'pass', code: null })
    }
    else checks.push({ key: 'account', status: 'unavailable', code: 'CURRENT_PROVIDER_PROOF_REQUIRED' })
    if (image.status === 'fulfilled') { assetSha256 = image.value; checks.push({ key: 'image', status: 'pass', code: null }) }
    else checks.push({ key: 'image', status: 'unavailable', code: 'REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED' })
    checks.push(teams.status === 'fulfilled' && Date.parse(teams.value.capturedAt) >= completed - 300_000
      && Date.parse(teams.value.capturedAt) <= completed + 30_000 ? { key: 'teams', status: 'pass', code: null }
      : { key: 'teams', status: 'unavailable', code: 'FRESH_TEAMS_EVIDENCE_REQUIRED' })
    checks.push(Date.parse(r.scheduled_at) > Date.now() ? { key: 'time', status: 'pass', code: null }
      : { key: 'time', status: 'blocked', code: 'BLOCKED_OVERDUE_REVIEW' })
    checks.push(packet?.approved === true && packet.route === target.route && packet.clientId === target.clientId
      && packet.connectionId === target.connectionId && packet.accountId === target.accountId
      ? { key: 'release', status: 'pass', code: null } : { key: 'release', status: 'blocked', code: 'PUBLISHING_DISABLED' })
    // A source/role/mapping change during a slow read cannot leave a reassuring
    // report for a different current client/account/version.
    const current = await readApprovedPublicationSource(sb, target)
    const fields = ['asset_path', 'caption', 'scheduled_at', 'media_type'] as const
    if (fields.some(key => current.r[key] !== r[key]) || ['scheduled_date', 'microsoft_task_id', 'microsoft_plan_id', 'microsoft_bucket_id']
      .some(key => current.d[key as keyof typeof d] !== d[key as keyof typeof d])) fail('PREPARATION_SOURCE_CHANGED')
    const [finalActor, finalMapping] = await Promise.all([
      sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle(),
      sb.from('meta_client_assets').select('connection_id,facebook_page_id').eq('client_id', target.clientId).eq('is_active', true).maybeSingle(),
    ])
    if (finalActor.error || finalActor.data?.is_active !== true || !['admin', 'manager'].includes(finalActor.data.role)) fail('ACTIVE_MANAGER_REQUIRED')
    if (finalMapping.error || finalMapping.data?.connection_id !== target.connectionId || finalMapping.data?.facebook_page_id !== target.accountId) fail('EXACT_ACCOUNT_MAPPING_REQUIRED')
    return { contract: 'facebook_publication_readiness_v1', reviewId, clientId: target.clientId, accountId: target.accountId, accountName,
      scheduledAt: r.scheduled_at, checkedAt: new Date().toISOString(), assetSha256, canConfirm: false, canPublish: false, checks }
  }
}
