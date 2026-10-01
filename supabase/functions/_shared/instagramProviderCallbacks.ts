// Meta signed_request contract. Never resolve user_id as a username or account ID.
export type InstagramCallbackKind = 'deauthorize' | 'data_deletion'
export interface VerifiedInstagramCallback {
  appId: string
  appScopedUserId: string
  issuedAt: number
  requestKey: string
  confirmationCode: string
  confirmationHash: string
}

class CallbackError extends Error {
  status: number
  constructor(status: number) {
    super('Instagram callback could not be accepted.')
    this.status = status
  }
}

const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
export const sha256 = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new CallbackError(400)
  const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0))
  const canonical = btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (canonical !== value) throw new CallbackError(400)
  return bytes
}

async function hmac(secret: string, value: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', key, encoder.encode(value))
}

export async function verifyInstagramSignedRequest(input: {
  signedRequest: string; appSecret: string; appId: string; kind: InstagramCallbackKind; now?: Date
}): Promise<VerifiedInstagramCallback> {
  if (!input.appSecret || !/^\d{1,40}$/.test(input.appId)) throw new CallbackError(503)
  if (input.signedRequest.length > 8192) throw new CallbackError(413)
  const parts = input.signedRequest.split('.')
  if (parts.length !== 2) throw new CallbackError(400)
  const signature = decodeBase64Url(parts[0])
  const bytes = decodeBase64Url(parts[1])
  if (signature.length !== 32) throw new CallbackError(401)
  const key = await crypto.subtle.importKey('raw', encoder.encode(input.appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  // Verify original encoded payload bytes, not decoded/re-serialized JSON.
  if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[1]))) throw new CallbackError(401)
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { throw new CallbackError(400) }
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000)
  if (!payload || Array.isArray(payload) || payload.algorithm !== 'HMAC-SHA256'
    || typeof payload.user_id !== 'string' || !/^\d{1,40}$/.test(payload.user_id)
    || !Number.isSafeInteger(payload.issued_at) || (payload.issued_at as number) <= 0
    || (payload.issued_at as number) > now + 60
    || (payload.app_id !== undefined && payload.app_id !== input.appId)
    || (payload.expires !== undefined && (!Number.isSafeInteger(payload.expires)
      || (payload.expires as number) < 0 || ((payload.expires as number) !== 0 && (payload.expires as number) <= now)))) {
    throw new CallbackError(400)
  }
  // No arbitrary age TTL: provider retries may arrive late. SQL generation fencing
  // and persistent idempotency protect later reconnects instead.
  const requestKey = hex(await hmac(input.appSecret, `instagram-callback-v1:${input.appId}:${input.kind}:${parts[1]}`))
  const confirmationCode = hex(await hmac(input.appSecret, `instagram-deletion-confirmation-v1:${requestKey}`))
  return { appId: input.appId, appScopedUserId: payload.user_id, issuedAt: payload.issued_at as number,
    requestKey, confirmationCode, confirmationHash: await sha256(confirmationCode) }
}

export interface InstagramCallbackStore {
  apply: (kind: InstagramCallbackKind, verified: VerifiedInstagramCallback) => Promise<void>
  status: (confirmationHash: string) => Promise<'completed' | null>
}

async function readBoundedForm(req: Request): Promise<string> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') throw new CallbackError(415)
  if (Number(req.headers.get('content-length')) > 16384) throw new CallbackError(413)
  if (!req.body) throw new CallbackError(400)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > 16384) { await reader.cancel(); throw new CallbackError(413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const form = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (form.size !== 1 || !form.get('signed_request')) throw new CallbackError(400)
  return form.get('signed_request')!
}

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" }

export async function handleInstagramProviderCallback(req: Request, input: {
  kind: InstagramCallbackKind
  appSecret: string | undefined
  appId: string | undefined
  statusUrl: string
  store: InstagramCallbackStore
  now?: Date
}): Promise<Response> {
  try {
    if (input.kind === 'data_deletion' && req.method === 'GET') {
      const query = new URL(req.url).searchParams
      const code = query.get('code')
      if (query.size !== 1 || !code || !/^[a-f0-9]{64}$/.test(code)) throw new CallbackError(404)
      if (await input.store.status(await sha256(code)) !== 'completed') throw new CallbackError(404)
      return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instagram data deletion</title><h1>Request completed</h1><p>The standalone Instagram credential and connection data associated with this request have been removed, or no matching stored connection existed. Historical client reports were not modified.</p></html>',
        { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
    }
    if (req.method !== 'POST') throw new CallbackError(405)
    if (new URL(req.url).search) throw new CallbackError(400)
    if (!input.appSecret || !input.appId) throw new CallbackError(503)
    const statusUrl = new URL(input.statusUrl)
    if (statusUrl.protocol !== 'https:' || statusUrl.search || statusUrl.hash || statusUrl.username || statusUrl.password) throw new CallbackError(503)
    const verified = await verifyInstagramSignedRequest({ signedRequest: await readBoundedForm(req),
      appSecret: input.appSecret, appId: input.appId, kind: input.kind, now: input.now })
    await input.store.apply(input.kind, verified)
    if (input.kind === 'deauthorize') return new Response(null, { status: 200, headers })
    statusUrl.searchParams.set('code', verified.confirmationCode)
    return Response.json({ url: statusUrl.toString(), confirmation_code: verified.confirmationCode }, { headers })
  } catch (error) {
    // Never log payloads, provider IDs, signatures, codes, credentials or DB details.
    const status = error instanceof CallbackError ? error.status : 500
    return Response.json({ error: 'Callback request unavailable.' }, { status, headers })
  }
}
