import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { PublishingIntent } from './socialPublishing.ts'

const BUCKET = 'content-review-snapshots'
export const PUBLISHING_MEDIA_URL_SECONDS = 300
// Existing snapshot bucket limit, NOT a universal provider media requirement.
const SNAPSHOT_MAX_BYTES = 52_428_800

/** Server-only. Never accepts a caller's source URL, bucket or storage path.
 * Snapshot storage is INSERT-only for staff; no re-export/transformation occurs.
 * Provider dimensions/codecs/rights still require separate media preflight.
 */
export function approvedSnapshotDelivery(sb: SupabaseClient, projectUrl: string) {
  const project = new URL(projectUrl)
  if (project.protocol !== 'https:' || project.username || project.password || project.search || project.hash || project.pathname !== '/') {
    throw new Error('Publishing storage configuration is invalid.')
  }
  return async (intent: Readonly<PublishingIntent>): Promise<string> => {
    function fail(): never { throw new Error('Approved publication snapshot unavailable.') }
    const parts = intent.assetPath.split('/')
    if (parts.length < 2 || parts[0] !== intent.deliverableId || parts.some(p => !p || p === '.' || p === '..' || /[%\\?#]/.test(p) || [...p].some(c => c.charCodeAt(0) < 32))
      || !/^[a-f0-9]{64}$/.test(intent.assetSha256) || !['image/jpeg', 'image/png'].includes(intent.mediaType)) fail()
    try {
      const { data: review, error } = await sb.from('content_review_versions')
        .select('id,client_id,deliverable_id,state,asset_path,media_type,caption,scheduled_at,channels')
        .eq('id', intent.reviewVersionId).eq('client_id', intent.clientId).eq('deliverable_id', intent.deliverableId).maybeSingle()
      if (error || !review || review.state !== 'approved' || review.asset_path !== intent.assetPath || review.media_type !== intent.mediaType
        || review.caption !== intent.caption || Date.parse(review.scheduled_at) !== Date.parse(intent.scheduledAt)
        || !Array.isArray(review.channels) || !review.channels.includes(intent.platform)) fail()
      const bucket = sb.storage.from(BUCKET)
      const { data: blob, error: downloadError } = await bucket.download(intent.assetPath)
      if (downloadError || !blob || blob.size === 0 || blob.size > SNAPSHOT_MAX_BYTES || blob.type !== intent.mediaType) fail()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      // Catch mismatched file metadata before giving the provider a URL.
      const signature = intent.mediaType === 'image/png'
        ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217
      if (!signature) fail()
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
      if (digest !== intent.assetSha256) fail()
      const { data, error: signError } = await bucket.createSignedUrl(intent.assetPath, PUBLISHING_MEDIA_URL_SECONDS)
      if (signError || !data?.signedUrl) fail()
      const url = new URL(data.signedUrl)
      const expectedPath = `/storage/v1/object/sign/${BUCKET}/${parts.map(encodeURIComponent).join('/')}`
      if (url.origin !== project.origin || url.pathname !== expectedPath || url.username || url.password || url.hash
        || [...url.searchParams.keys()].some(k => k !== 'token') || url.searchParams.getAll('token').length !== 1 || !url.searchParams.get('token')) fail()
      return url.href
    } catch { return fail() } // Never echo SDK errors, object URLs or signed credentials.
  }
}
