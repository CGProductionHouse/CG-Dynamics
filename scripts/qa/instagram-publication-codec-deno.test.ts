// Standalone native Deno acceptance of the actual private adapter. Synthetic
// JPEGs only; no provider/SDK mock can substitute for real pixel decoding.
// Run cached-only, no config/lock/node_modules, no prompt; allow-read ONLY the
// fixture below and deny net/env/write/run/ffi/sys. See the #220 ops receipt.
import jpeg from 'npm:jpeg-js@0.4.4'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decodeInstagramPublicationJpeg, instagramPublicationCodecRuntime } from '../../supabase/functions/_shared/instagramPublicationCodec.ts'
import { PUBLICATION_JPEG_DECODE_OPTIONS, verifyPublicationJpeg } from '../../supabase/functions/_shared/publicationJpeg.ts'
import type { PublishingIntent } from '../../supabase/functions/_shared/socialPublishing.ts'
import { verifyFacebookPublicationMedia } from '../../supabase/functions/_shared/facebookPublicationMedia.ts'

const fixture = new URL('../../tests/fixtures/publication-baseline-320.jpg', import.meta.url)
const clientId = '11111111-1111-4111-8111-111111111111'
const connectionId = '22222222-2222-4222-8222-222222222222'
const jobId = '33333333-3333-4333-8333-333333333333'
function assert(value: unknown, message = 'Native JPEG assertion failed.'): asserts value {
  if (!value) throw new Error(message)
}
async function rejects(action: () => unknown, expected?: string) {
  try { await action() } catch (error) {
    assert(error instanceof Error)
    if (expected) assert(error.message === expected, 'Expected a sanitized qualification failure.')
    return
  }
  throw new Error('Expected rejection.')
}
async function snapshot(input: Uint8Array<ArrayBuffer>) {
  const bytes = input.slice()
  const assetSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')
  return { bytes, assetSha256, byteLength: bytes.length, mediaType: 'image/jpeg' }
}
const target = { route: 'instagram_login' as const, accountId: '123', clientId, connectionId,
  deliverableId: '44444444-4444-4444-8444-444444444444', reviewVersionId: '55555555-5555-4555-8555-555555555555' }

Deno.test('native qualification has no network, credential, command or write permission', async () => {
  for (const name of ['net', 'env', 'run', 'write', 'ffi', 'sys'] as const) {
    assert((await Deno.permissions.query({ name })).state === 'denied', `${name} must be denied.`)
  }
  assert((await Deno.permissions.query({ name: 'read', path: fixture })).state === 'granted')
})

Deno.test('real npm default import decodes RGBA and qualifies unchanged original bytes on both Instagram routes', async () => {
  const original = await Deno.readFile(fixture), source = await snapshot(original)
  const pixels = decodeInstagramPublicationJpeg(source.bytes, PUBLICATION_JPEG_DECODE_OPTIONS)
  assert(pixels.data instanceof Uint8Array && pixels.width === 320 && pixels.height === 320)
  assert(pixels.data[0] > 200 && pixels.data[1] < 120 && pixels.data[2] < 80 && pixels.data[3] === 255)
  for (const route of ['instagram_login', 'instagram_facebook_login'] as const) {
    const result = await verifyPublicationJpeg(source, { ...target, route }, decodeInstagramPublicationJpeg)
    assert(result.verified && result.profile === 'instagram_baseline_jpeg_v1')
    assert(result.width === 320 && result.height === 320)
  }
  assert(original.every((value, i) => value === source.bytes[i]))
  assert((await snapshot(await Deno.readFile(fixture))).assetSha256 === source.assetSha256)
})

Deno.test('real native decoder rejects corrupt entropy; qualification keeps the error sanitized', async () => {
  const original = await Deno.readFile(fixture)
  const marker = original.findIndex((value, i) => value === 255 && original[i + 1] === 218)
  assert(marker > 0)
  const start = marker + 2 + new DataView(original.buffer).getUint16(marker + 2)
  const corrupt = new Uint8Array(start + 3)
  corrupt.set(original.subarray(0, start)); corrupt.set([0, 255, 217], start)
  await rejects(() => decodeInstagramPublicationJpeg(corrupt, PUBLICATION_JPEG_DECODE_OPTIONS))
  await rejects(async () => verifyPublicationJpeg(await snapshot(corrupt), target, decodeInstagramPublicationJpeg),
    'Original publication JPEG qualification unavailable.')
})

Deno.test('Facebook uses the same actual pinned decoder, preserving bytes and rejecting corrupt entropy or MIME substitution', async () => {
  const source = await snapshot(await Deno.readFile(fixture)), facebook = { ...target, route: 'facebook_page' as const }
  const proof = await verifyFacebookPublicationMedia(source, facebook)
  assert(proof.verified && proof.profile === 'facebook_baseline_jpeg_v1')
  assert((await snapshot(await Deno.readFile(fixture))).assetSha256 === source.assetSha256)
  await rejects(() => verifyFacebookPublicationMedia({ ...source, mediaType: 'image/png' }, facebook))
  await rejects(() => verifyFacebookPublicationMedia({ ...source, assetSha256: 'a'.repeat(64) }, facebook))
  const original = source.bytes
  const marker = original.findIndex((value, i) => value === 255 && original[i + 1] === 218)
  assert(marker > 0)
  const start = marker + 2 + new DataView(original.buffer).getUint16(marker + 2)
  const corrupt = new Uint8Array(start + 3)
  corrupt.set(original.subarray(0, start)); corrupt.set([0, 255, 217], start)
  await rejects(async () => verifyFacebookPublicationMedia(await snapshot(corrupt), facebook), 'Original publication JPEG qualification unavailable.')
})

Deno.test('actual codec enforces its native resolution ceiling independently of header admission', async () => {
  const oversized = await Deno.readFile(fixture)
  const marker = oversized.findIndex((value, i) => value === 255 && oversized[i + 1] === 192)
  assert(marker > 0)
  const view = new DataView(oversized.buffer)
  view.setUint16(marker + 5, 4096); view.setUint16(marker + 7, 4096)
  await rejects(() => decodeInstagramPublicationJpeg(oversized, PUBLICATION_JPEG_DECODE_OPTIONS))
})

Deno.test('private runtime stays inactive and rejects absent approval or foreign targets before any SDK access', async () => {
  let databaseCalls = 0
  const sb = { from() { databaseCalls++; throw new Error('SDK access forbidden in native codec qualification.') } } as unknown as SupabaseClient
  const release = { approved: true, route: 'instagram_login' as const, clientId, connectionId, accountId: '123' }
  const config = { server: { projectUrl: 'https://fixture.invalid' }, release }
  const runtime = instagramPublicationCodecRuntime(sb, config)
  assert(typeof runtime.readCandidate === 'function' && typeof runtime.targetForReview === 'function')
  release.accountId = '999' // The composed release is immutable, not caller-updated authority.
  const bindings = runtime.workerBindings(jobId)
  const foreign: PublishingIntent = { ...target, platform: 'instagram', accountId: '999', key: 'native-synthetic-job',
    assetPath: 'synthetic/approved.jpg', assetSha256: 'a'.repeat(64), mediaType: 'image/jpeg', caption: 'Synthetic native qualification',
    scheduledAt: '2026-12-01T08:00:00Z', authorizationId: '66666666-6666-4666-8666-666666666666', state: 'queued', attempt: 0,
    providerOperationId: null, providerPostId: null }
  await rejects(() => bindings.submit(foreign), 'Exact publication release unavailable.')
  await rejects(() => bindings.reconcile(foreign), 'Exact publication release unavailable.')
  await rejects(() => instagramPublicationCodecRuntime(sb, { ...config, release: { ...release, approved: false } }), 'Exact publication release unavailable.')
  assert(databaseCalls === 0)
})

Deno.test('native maximum-profile synthetic JPEGs decode through the actual adapter within strict bounds', async () => {
  const raw = new Uint8Array(1440 * 1800 * 4)
  for (let p = 0; p < raw.length; p += 4) { raw[p] = 239; raw[p + 1] = 80; raw[p + 2] = 40; raw[p + 3] = 255 }
  let state = 1234567
  for (const pattern of ['solid', 'detail']) {
    if (pattern === 'detail') for (let p = 0; p < raw.length; p += 4) {
      for (let c = 0; c < 3; c++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; raw[p + c] = state & 255 }
    }
    const source = await snapshot(Uint8Array.from(jpeg.encode({ width: 1440, height: 1800, data: raw }, 75).data))
    const began = performance.now()
    const result = await verifyPublicationJpeg(source, target, decodeInstagramPublicationJpeg)
    assert(result.width === 1440 && result.height === 1800 && source.byteLength < 8_000_000)
    console.log(JSON.stringify({ nativeDeno: Deno.version.deno, pattern, decodeMs: Math.round(performance.now() - began),
      syntheticBytes: source.byteLength, providerCalls: 0, hostedEdgeAcceptance: false }))
  }
})
