/** Private cron proof, independent of public publishable/anon credentials.
 * The base key stays in Edge/Vault, never in pg_net's queued request headers.
 * Proofs expire after 90s but are not single-use; durable job leases and existing
 * provider duplicate fences remain necessary. The worker ignores the body.
 * Release ONLY with the matching signed cron caller and privately configured key.
 */
export async function authorizeBackgroundWorkerInvocation(
  request: Request, get: (name: string) => string | undefined, nowMs = Date.now(),
): Promise<Response | null> {
  const refuse = (status: number, error: string) => Response.json({ ok: false, error }, {
    status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(status === 405 ? { Allow: 'POST' } : {}) },
  })
  if (request.method !== 'POST') return refuse(405, 'POST_REQUIRED')
  let expected: string | undefined
  try { expected = get('BACKGROUND_WORKER_INVOCATION_SECRET') } catch { return refuse(503, 'WORKER_AUTH_UNAVAILABLE') }
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) return refuse(503, 'WORKER_AUTH_UNAVAILABLE')
  const timestamp = request.headers.get('X-CG-Worker-Timestamp') ?? ''
  const signature = request.headers.get('X-CG-Worker-Signature') ?? ''
  if (!/^[1-9][0-9]{9}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return refuse(401, 'WORKER_AUTH_REQUIRED')
  const age = Math.floor(nowMs / 1000) - Number(timestamp)
  if (!Number.isFinite(age) || age < -15 || age > 90) return refuse(401, 'WORKER_AUTH_REQUIRED')
  try {
    const encoder = new TextEncoder()
    // pgcrypto hmac(text,text,'sha256') uses these same UTF-8 key/message bytes.
    const key = await crypto.subtle.importKey('raw', encoder.encode(expected), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const bytes = Uint8Array.from(signature.match(/../g)!, byte => Number.parseInt(byte, 16))
    const valid = await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`cg-background-worker:v1\nPOST\n${timestamp}`))
    return valid ? null : refuse(401, 'WORKER_AUTH_REQUIRED')
  } catch { return refuse(503, 'WORKER_AUTH_UNAVAILABLE') }
}
