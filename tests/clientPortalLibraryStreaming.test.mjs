import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as portalStream from '../supabase/functions/client-onboarding/portal-library-stream.ts'
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
  assert.equal(normalizeRangeHeader(undefined, 1_000), undefined)
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

test('media grants use the configured public gateway, not the rewritten internal request URL', async () => {
  const secret = 'test-secret-with-at-least-thirty-two-characters'
  const assetId = '22222222-2222-4222-8222-222222222222'
  const now = 1_800_000_000
  for (const purpose of ['inline', 'download', 'stream', 'thumbnail']) {
    const grant = await portalStream.createPortalAccessGrant('https://example.supabase.co', secret, assetId, purpose, now)
    const url = new URL(grant.url)
    assert.equal(url.origin, 'https://example.supabase.co')
    assert.equal(url.pathname, '/functions/v1/client-onboarding')
    assert.deepEqual([...url.searchParams.keys()], ['asset', 'purpose', 'expires', 'signature'])
    assert.equal(Date.parse(grant.expiresAt), Number(url.searchParams.get('expires')) * 1000)
    assert.equal(await verifyPortalAccess(secret, assetId, purpose, Number(url.searchParams.get('expires')), url.searchParams.get('signature'), now), true)
  }
  const edge = readFileSync(new URL('../supabase/functions/client-onboarding/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /createPortalAccessGrant\(supabaseUrl, portalStreamSecret\(serviceRoleKey\), asset\.id, purpose\)/)
  assert.doesNotMatch(edge, /async function portalAccessUrl|new URL\(request\.url\)[\s\S]{0,100}url\.search = new URLSearchParams/)
})

test('media gateway configuration fails closed; only explicit loopback HTTP is allowed for local tests', async () => {
  const args = ['fixture-secret', '22222222-2222-4222-8222-222222222222', 'download', 1_800_000_000]
  for (const invalid of ['', 'not-a-url', 'http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://example.supabase.co/path', 'https://example.supabase.co?redirect=bad', 'https://example.supabase.co/#bad']) {
    await assert.rejects(() => portalStream.createPortalAccessGrant(invalid, ...args))
  }
  const grant = await portalStream.createPortalAccessGrant('http://127.0.0.1:54321', ...args)
  assert.equal(new URL(grant.url).origin, 'http://127.0.0.1:54321')
})
