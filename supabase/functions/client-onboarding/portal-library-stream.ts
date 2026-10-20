// Long enough for a client to watch or seek through a normal video, while still
// remaining a short-lived opaque access grant rather than a durable media URL.
export const PORTAL_STREAM_TTL_SECONDS = 60 * 60
export const MAX_PORTAL_RANGE_BYTES = 8 * 1024 * 1024

export type PortalAccessPurpose = 'inline' | 'download' | 'stream' | 'thumbnail'

export function isPortalAccessPurpose(value: unknown): value is PortalAccessPurpose {
  return value === 'inline' || value === 'download' || value === 'stream' || value === 'thumbnail'
}

export function normalizeRangeHeader(value: string | null | undefined, sizeBytes: number): string | null | undefined {
  if (!value) return undefined
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || (!match[1] && !match[2])) return null

  let start: number
  let end: number
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null
    const boundedLength = Math.min(suffixLength, MAX_PORTAL_RANGE_BYTES, sizeBytes)
    start = sizeBytes - boundedLength
    end = sizeBytes - 1
  } else {
    start = Number(match[1])
    if (!Number.isSafeInteger(start) || start < 0 || start >= sizeBytes) return null
    const requestedEnd = match[2] ? Number(match[2]) : sizeBytes - 1
    if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null
    end = Math.min(requestedEnd, sizeBytes - 1, start + MAX_PORTAL_RANGE_BYTES - 1)
  }
  return `bytes=${start}-${end}`
}

export function isValidPartialContent(range: string, status: number, contentRange: string | null) {
  if (status !== 206 || !contentRange) return false
  const requested = /^bytes=(\d+)-(\d+)$/.exec(range)
  const returned = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange.trim())
  if (!requested || !returned) return false
  const requestedStart = Number(requested[1])
  const requestedEnd = Number(requested[2])
  const returnedStart = Number(returned[1])
  const returnedEnd = Number(returned[2])
  return returnedStart === requestedStart
    && returnedEnd >= returnedStart
    && returnedEnd <= requestedEnd
}

export function createPortalMediaResponse(
  stream: ReadableStream<Uint8Array>,
  status: 200 | 206,
  headers: HeadersInit,
) {
  return new Response(stream, { status, headers })
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function signingKey(secret: string) {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function signaturePayload(assetId: string, purpose: PortalAccessPurpose, expiresAt: number) {
  return `cg-client-portal-stream-v1.${assetId}.${purpose}.${expiresAt}`
}

export async function signPortalAccess(
  secret: string,
  assetId: string,
  purpose: PortalAccessPurpose,
  expiresAt: number,
) {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    new TextEncoder().encode(signaturePayload(assetId, purpose, expiresAt)),
  )
  return hex(signature)
}

/** The Edge gateway rewrites request.url; only server configuration names the public broker. */
export async function createPortalAccessGrant(
  publicApiUrl: string,
  secret: string,
  assetId: string,
  purpose: PortalAccessPurpose,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const base = new URL(publicApiUrl)
  const localHttp = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if ((base.protocol !== 'https:' && !localHttp) || base.username || base.password
    || base.pathname !== '/' || base.search || base.hash) throw new Error('Invalid public media gateway')
  const expiresAt = nowSeconds + PORTAL_STREAM_TTL_SECONDS
  const signature = await signPortalAccess(secret, assetId, purpose, expiresAt)
  const url = new URL('/functions/v1/client-onboarding', base)
  url.search = new URLSearchParams({ asset: assetId, purpose, expires: String(expiresAt), signature }).toString()
  return { url: url.toString(), expiresAt: new Date(expiresAt * 1000).toISOString() }
}

export async function verifyPortalAccess(
  secret: string,
  assetId: string,
  purpose: PortalAccessPurpose,
  expiresAt: number,
  suppliedSignature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!/^[a-f0-9]{64}$/.test(suppliedSignature)) return false
  if (!Number.isSafeInteger(expiresAt) || expiresAt < nowSeconds || expiresAt > nowSeconds + PORTAL_STREAM_TTL_SECONDS) return false
  const expected = await signPortalAccess(secret, assetId, purpose, expiresAt)
  let mismatch = expected.length ^ suppliedSignature.length
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ (suppliedSignature.charCodeAt(index) || 0)
  }
  return mismatch === 0
}
