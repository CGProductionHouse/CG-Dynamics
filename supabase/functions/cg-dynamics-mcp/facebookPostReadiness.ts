import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { facebookPublicationInspector } from '../_shared/facebookPublicationInspection.ts'
import { readFacebookInspectionConfiguration, readFacebookStaffConfiguration } from '../_shared/facebookPublicationRuntime.ts'
import { publicationPreparationBlocker } from '../_shared/socialPublicationAuthorization.ts'
import { verifyFacebookPublishingTarget } from '../_shared/facebookPublishingProvider.ts'

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const unavailable = (code: string) => ({ data_state: 'unavailable', code, canConfirm: false, canPublish: false })

/** Company-admin adapter over the SAME inspector as the staff UI. Listing is
 * exact-client, paged metadata only; inspection is exact-review or explicitly
 * account-only, with no fabricated review/source IDs. No write port,
 * media URL, approval/authorization, token refresh or global-client sweep.
 */
export async function readFacebookPostReadiness(sb: SupabaseClient, actorId: string, rawInput: Record<string, unknown>, get: (name: string) => string | undefined) {
  const input = Object.freeze({ ...rawInput })
  if (!uuid(actorId) || !uuid(input.client_id) || input.review_id !== undefined && !uuid(input.review_id)
    || Object.keys(input).some(key => !['client_id', 'review_id', 'offset', 'account_only'].includes(key))
    || input.account_only !== undefined && typeof input.account_only !== 'boolean'
    || input.offset !== undefined && (!Number.isSafeInteger(input.offset) || Number(input.offset) < 0 || Number(input.offset) > 5000)
    || input.review_id !== undefined && input.offset !== undefined
    || input.account_only === true && (input.review_id !== undefined || input.offset !== undefined)) return unavailable('READINESS_INPUT_INVALID')
  try {
    const actor = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
    if (actor.error || actor.data?.is_active !== true || !['admin', 'manager'].includes(actor.data.role)) return unavailable('ACTIVE_MANAGER_REQUIRED')
    const client = await sb.from('clients').select('id,active').eq('id', input.client_id).eq('active', true).maybeSingle()
    if (client.error || client.data?.id !== input.client_id || client.data.active !== true) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
    if (input.account_only === true) {
      const settings = readFacebookInspectionConfiguration(get)
      if (!settings) return unavailable('PUBLICATION_INSPECTION_DISABLED')
      const readMapping = () => sb.from('meta_client_assets').select('connection_id,facebook_page_id')
        .eq('client_id', input.client_id).eq('is_active', true).maybeSingle()
      const mapping = await readMapping(), m = mapping.data
      if (mapping.error || !m || !uuid(m.connection_id) || typeof m.facebook_page_id !== 'string' || !/^\d+$/.test(m.facebook_page_id)) return unavailable('EXACT_ACCOUNT_MAPPING_REQUIRED')
      const target = Object.freeze({ clientId: input.client_id, connectionId: m.connection_id, accountId: m.facebook_page_id, route: 'facebook_page' as const })
      const account = await verifyFacebookPublishingTarget(sb, target, settings), b = account.binding, completed = Date.now()
      if (!Number.isFinite(completed) || !(Date.parse(account.checkedAt) >= completed - 120_000) || !(Date.parse(account.checkedAt) <= completed + 30_000)
        || !(Date.parse(b.tokenValidUntil ?? '') > completed + 120_000) || b.clientId !== target.clientId || b.connectionId !== target.connectionId
        || b.accountId !== target.accountId || b.route !== target.route || !b.active || b.appAccessVerified !== true || b.accountPublishingVerified !== true
        || !Array.isArray(b.grantedScopes) || !['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].every(scope => b.grantedScopes.includes(scope))) return unavailable('CURRENT_PROVIDER_PROOF_REQUIRED')
      // A slow provider read cannot certify a removed client, revoked role or
      // a mapping that now belongs to a different account/connection.
      const [finalActor, finalClient, finalMapping] = await Promise.all([
        sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle(),
        sb.from('clients').select('id,active').eq('id', target.clientId).eq('active', true).maybeSingle(), readMapping(),
      ])
      if (finalActor.error || finalActor.data?.is_active !== true || !['admin', 'manager'].includes(finalActor.data.role)) return unavailable('ACTIVE_MANAGER_REQUIRED')
      if (finalClient.error || finalClient.data?.id !== target.clientId || finalClient.data.active !== true) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
      if (finalMapping.error || finalMapping.data?.connection_id !== target.connectionId || finalMapping.data.facebook_page_id !== target.accountId) return unavailable('EXACT_ACCOUNT_MAPPING_REQUIRED')
      const finished = Date.now()
      if (!Number.isFinite(finished) || finished < completed || Date.parse(account.checkedAt) < finished - 120_000
        || !(Date.parse(b.tokenValidUntil ?? '') > finished + 120_000)) return unavailable('CURRENT_PROVIDER_PROOF_REQUIRED')
      return { data_state: 'available', scope: 'facebook_account_readiness', client_id: target.clientId,
        checked_at: new Date(finished).toISOString(), account: { account_id: target.accountId, account_name: account.accountName,
          native_access_verified: true, required_permissions_verified: true, create_content_task_verified: true },
        canConfirm: false, canPublish: false,
        note: 'Mapped Page access only. App review/release eligibility, approved creative, original media, Teams/time, native duplicates and publication are not checked. No review ID, upload, job, confirmation, account connection or Microsoft sync was created.' }
    }
    if (input.review_id !== undefined) {
      const review = await sb.from('content_review_versions').select('id,client_id').eq('id', input.review_id).eq('client_id', input.client_id).maybeSingle()
      if (review.error || review.data?.id !== input.review_id || review.data.client_id !== input.client_id) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
      const settings = readFacebookInspectionConfiguration(get)
      if (!settings) return unavailable('PUBLICATION_INSPECTION_DISABLED')
      return { data_state: 'available', canConfirm: false, canPublish: false,
        inspection: await facebookPublicationInspector(sb, settings, readFacebookStaffConfiguration(get))(input.review_id as string, actorId) }
    }
    const offset = Number(input.offset ?? 0), checkedAt = new Date().toISOString()
    const reviews = await sb.from('content_review_versions').select('id,client_id,deliverable_id,state,channels,media_type,scheduled_at')
      .eq('client_id', input.client_id).eq('state', 'approved').in('media_type', ['image/png', 'image/jpeg']).contains('channels', ['facebook'])
      .gt('scheduled_at', checkedAt).order('scheduled_at').order('id').range(offset, offset + 25)
    if (reviews.error || !Array.isArray(reviews.data) || reviews.data.length > 26) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
    const rows = reviews.data.slice(0, 25), seen = new Set<string>()
    for (const r of rows) {
      if (!uuid(r.id) || !uuid(r.deliverable_id) || r.client_id !== input.client_id || r.state !== 'approved' || !['image/png', 'image/jpeg'].includes(r.media_type)
        || !Array.isArray(r.channels) || !r.channels.includes('facebook') || typeof r.scheduled_at !== 'string'
        || !(Date.parse(r.scheduled_at) > Date.parse(checkedAt)) || seen.has(r.id)) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
      seen.add(r.id)
    }
    const candidates: { review_id: string; deliverable_id: string; scheduled_at: string }[] = []
    if (rows.length) {
      const source = await sb.from('monthly_deliverables').select('id,client_id,production_status,archived_at,posted_at')
        .eq('client_id', input.client_id).in('id', rows.map(r => r.deliverable_id))
      if (source.error || !Array.isArray(source.data)) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
      for (const r of rows) {
        const matches = source.data.filter(d => d.id === r.deliverable_id)
        if (matches.length > 1) return unavailable('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
        const d = matches[0]
        if (d?.client_id === input.client_id && d.archived_at === null && d.posted_at === null && !['scheduled', 'posted'].includes(d.production_status))
          candidates.push({ review_id: r.id, deliverable_id: r.deliverable_id, scheduled_at: r.scheduled_at })
      }
    }
    return { data_state: 'available', scope: 'future_approved_facebook_photo_reviews', client_id: input.client_id, checked_at: checkedAt,
      candidates, has_more: reviews.data.length > 25, next_offset: reviews.data.length > 25 ? offset + 25 : null,
      canConfirm: false, canPublish: false, note: 'Candidate metadata only. Inspect the exact review before preparing any separate publication confirmation. No native duplicate or publishing permission is inferred.' }
  } catch (error) { return unavailable(publicationPreparationBlocker(error) ?? 'PUBLICATION_VERIFICATION_UNAVAILABLE') }
}
