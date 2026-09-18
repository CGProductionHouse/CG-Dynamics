import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_PORTAL_RANGE_BYTES,
  isValidPartialContent,
  createPortalMediaResponse,
  normalizeRangeHeader,
  signPortalAccess,
  verifyPortalAccess,
} from '../supabase/functions/client-onboarding/portal-library-stream.ts'

test('open-ended video ranges are capped without buffering the complete asset', () => {
  assert.equal(normalizeRangeHeader('bytes=0-', 500_000_000), `bytes=0-${MAX_PORTAL_RANGE_BYTES - 1}`)
  assert.equal(normalizeRangeHeader('bytes=16777216-', 500_000_000), `bytes=16777216-${16777216 + MAX_PORTAL_RANGE_BYTES - 1}`)
})

test('explicit and suffix ranges preserve valid partial-content semantics', () => {
  assert.equal(normalizeRangeHeader('bytes=100-199', 1_000), 'bytes=100-199')
  assert.equal(normalizeRangeHeader('bytes=-500', 1_000), 'bytes=500-999')
  assert.equal(normalizeRangeHeader('bytes=900-2000', 1_000), 'bytes=900-999')
})

test('invalid or multi ranges fail closed with a 416-compatible result', () => {
  assert.equal(normalizeRangeHeader('bytes=1000-', 1_000), null)
  assert.equal(normalizeRangeHeader('bytes=200-100', 1_000), null)
  assert.equal(normalizeRangeHeader('bytes=0-1,3-4', 1_000), null)
  assert.equal(normalizeRangeHeader(null, 1_000), undefined)
})

test('range delivery accepts only matching 206 partial-content responses', () => {
  assert.equal(isValidPartialContent('bytes=0-8388607', 206, 'bytes 0-8388607/500000000'), true)
  assert.equal(isValidPartialContent('bytes=0-8388607', 200, null), false)
  assert.equal(isValidPartialContent('bytes=0-8388607', 206, null), false)
  assert.equal(isValidPartialContent('bytes=8388608-16777215', 206, 'bytes 0-8388607/500000000'), false)
  assert.equal(isValidPartialContent('bytes=0-8388607', 206, 'bytes 0-16777215/500000000'), false)
})

test('large video response stays streaming and returns HTTP 206 with range headers', async () => {
  let pulls = 0
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1
      controller.enqueue(new Uint8Array(1024))
    },
  })
  const response = createPortalMediaResponse(stream, 206, {
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes 0-${MAX_PORTAL_RANGE_BYTES - 1}/500000000`,
    'Content-Length': String(MAX_PORTAL_RANGE_BYTES),
    'Content-Type': 'video/mp4',
  })
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('accept-ranges'), 'bytes')
  assert.equal(response.headers.get('content-range'), `bytes 0-${MAX_PORTAL_RANGE_BYTES - 1}/500000000`)
  const reader = response.body.getReader()
  const first = await reader.read()
  assert.equal(first.value.byteLength, 1024)
  assert.ok(pulls <= 2, 'constructing the response must not drain the simulated 500 MB body')
  await reader.cancel()
})

test('opaque stream grants are purpose-bound, short-lived, and tamper evident', async () => {
  const secret = 'test-secret-with-at-least-thirty-two-characters'
  const now = 1_800_000_000
  const expires = now + 120
  const signature = await signPortalAccess(secret, 'asset-opaque-id', 'stream', expires)
  assert.equal(await verifyPortalAccess(secret, 'asset-opaque-id', 'stream', expires, signature, now), true)
  assert.equal(await verifyPortalAccess(secret, 'other-asset', 'stream', expires, signature, now), false)
  assert.equal(await verifyPortalAccess(secret, 'asset-opaque-id', 'download', expires, signature, now), false)
  assert.equal(await verifyPortalAccess(secret, 'asset-opaque-id', 'stream', expires, signature, expires + 1), false)
})
