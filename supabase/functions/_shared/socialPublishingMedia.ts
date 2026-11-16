import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { PublishingIntent } from './socialPublishing.ts'

const BUCKET = 'content-review-snapshots'
export const PUBLISHING_MEDIA_URL_SECONDS = 300
// Existing snapshot bucket limit, NOT a universal provider media requirement.
const SNAPSHOT_MAX_BYTES = 52_428_800

export type PublicationSnapshotSource = Pick<PublishingIntent, 'clientId' | 'deliverableId' | 'reviewVersionId' | 'platform' | 'assetPath' | 'mediaType' | 'caption' | 'scheduledAt'> & { assetSha256?: string }
export interface PrivatePublicationSnapshot { bytes: Uint8Array<ArrayBuffer>; assetSha256: string; mediaType: string; byteLength: number }

/** Read exact approved bytes for server preflight WITHOUT signing, uploading,
 * exposing a URL or transforming the file. A hash is derived, never caller proof.
 */
export async function inspectPublicationSnapshot(sb: SupabaseClient, source: Readonly<PublicationSnapshotSource>, maxBytes = SNAPSHOT_MAX_BYTES): Promise<PrivatePublicationSnapshot> {
  function fail(): never { throw new Error('Approved publication snapshot unavailable.') }
  const parts = source.assetPath.split('/')
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > SNAPSHOT_MAX_BYTES
    || parts.length < 2 || parts[0] !== source.deliverableId || parts.some(p => !p || p === '.' || p === '..' || /[%\\?#]/.test(p) || [...p].some(c => c.charCodeAt(0) < 32))
    || (source.assetSha256 !== undefined && !/^[a-f0-9]{64}$/.test(source.assetSha256)) || !['image/jpeg', 'image/png'].includes(source.mediaType)) fail()
  try {
    const { data: review, error } = await sb.from('content_review_versions')
      .select('id,client_id,deliverable_id,state,asset_path,media_type,caption,scheduled_at,channels')
      .eq('id', source.reviewVersionId).eq('client_id', source.clientId).eq('deliverable_id', source.deliverableId).maybeSingle()
    if (error || !review || review.state !== 'approved' || review.asset_path !== source.assetPath || review.media_type !== source.mediaType
      || review.caption !== source.caption || Date.parse(review.scheduled_at) !== Date.parse(source.scheduledAt)
      || !Array.isArray(review.channels) || !review.channels.includes(source.platform)) fail()
    const { data: blob, error: downloadError } = await sb.storage.from(BUCKET).download(source.assetPath)
    if (downloadError || !blob || blob.size === 0 || blob.size > maxBytes || blob.type !== source.mediaType) fail()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const signature = source.mediaType === 'image/png'
      ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
      : bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217
    if (!signature) fail()
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    if (source.assetSha256 !== undefined && digest !== source.assetSha256) fail()
    return { bytes, assetSha256: digest, mediaType: source.mediaType, byteLength: bytes.byteLength }
  } catch { return fail() }
}

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
    try {
      if (!/^[a-f0-9]{64}$/.test(intent.assetSha256)) fail()
      await inspectPublicationSnapshot(sb, intent)
      const bucket = sb.storage.from(BUCKET)
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
