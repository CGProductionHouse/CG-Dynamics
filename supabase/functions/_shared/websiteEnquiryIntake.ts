// M2C: trusted site server -> existing canonical M2A transaction. No provider calls.
export const INTAKE_MAX_BYTES = 16_384
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type RpcResult = { data: unknown; error: { code?: string } | null }
export type IntakeRpc = (name: string, args: Record<string, unknown>) => Promise<RpcResult>
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function intakeResponse(body: Record<string, unknown>, status = 200, retryAfter?: number): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
  } })
}

// Actual streamed byte cap, including multibyte UTF-8 and absent/spoofed Content-Length.
export async function readIntakeBody(req: Request, timeoutMs = 5000): Promise<unknown> {
  const reader = req.body?.getReader()
  if (!reader) throw new Error('invalid_body')
  let size = 0
  const chunks: Uint8Array[] = []
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, timeoutMs)
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > INTAKE_MAX_BYTES) { await reader.cancel(); throw new Error('too_large') }
      chunks.push(value)
    }
    if (timedOut) throw new Error('invalid_body')
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } finally { clearTimeout(timeout); reader.releaseLock() }
}

export function createWebsiteIntakeHandler({ enabled, rpc }: { enabled: boolean; rpc: IntakeRpc }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return intakeResponse({ accepted: false, error: 'method_not_allowed' }, 405)
    if (!enabled) return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
    // Never accept client/site/recipient identity from the public body. These
    // headers belong to the site server, whose opaque capability stays private.
    const key = req.headers.get('x-intake-key') ?? ''
    if (!UUID.test(key)) return intakeResponse({ accepted: false, error: 'unauthorized' }, 401)
    const host = req.headers.get('x-website-host') ?? ''
    const schema = req.headers.get('x-form-schema') ?? ''
    const versionText = req.headers.get('x-form-version') ?? ''
    let origin: URL
    try { origin = new URL(req.headers.get('origin') ?? '') }
    catch { return intakeResponse({ accepted: false, error: 'unauthorized' }, 401) }
    if (origin.origin !== `https://${host}` || !/^[a-z][a-z0-9_]{1,63}$/.test(schema)
      || !/^[1-9]\d{0,5}$/.test(versionText)) {
      return intakeResponse({ accepted: false, error: 'unauthorized' }, 401)
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') ?? '')) {
      return intakeResponse({ accepted: false, error: 'invalid_payload' }, 415)
    }
    let payload: unknown
    try { payload = await readIntakeBody(req) }
    catch (error) {
      return intakeResponse({ accepted: false, error: 'invalid_payload' }, error instanceof Error && error.message === 'too_large' ? 413 : 400)
    }
    if (!object(payload) || Object.keys(payload).some(key => !['submissionKey', 'answers', 'attribution', 'honeypot'].includes(key))
      || typeof payload.submissionKey !== 'string' || !UUID.test(payload.submissionKey)
      || !object(payload.answers) || (payload.attribution !== undefined && !object(payload.attribution))
      || (payload.honeypot !== undefined && payload.honeypot !== '')) {
      return intakeResponse({ accepted: false, error: 'invalid_payload' }, 400)
    }
    try {
      const guard = await rpc('reserve_website_enquiry_intake', {
        p_intake_key: key, p_canonical_host: host, p_schema_key: schema, p_schema_version: Number(versionText),
      })
      if (guard.error || !object(guard.data)) return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
      if (guard.data.state === 'rate_limited') {
        return intakeResponse({ accepted: false, error: 'rate_limited' }, 429, guard.data.retry_after === 3600 ? 3600 : 60)
      }
      if (guard.data.state !== 'allowed') return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
      const result = await rpc('submit_website_enquiry', {
        p_intake_key: key, p_schema_key: schema, p_schema_version: Number(versionText),
        p_submission_key: payload.submissionKey, p_answers: payload.answers, p_attribution: payload.attribution ?? {},
      })
      if (result.error) return intakeResponse({ accepted: false, error: 'submission_rejected' }, result.error.code === '23505' ? 409 : result.error.code === '22023' ? 422 : 503)
      if (!object(result.data) || result.data.accepted !== true || typeof result.data.receipt_id !== 'string'
        || !UUID.test(result.data.receipt_id) || typeof result.data.accepted_at !== 'string'
        || !Number.isFinite(Date.parse(result.data.accepted_at))) {
        return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503)
      }
      // Whitelist receipt facts only; no internal identity, PII, recipients or keys.
      return intakeResponse({ accepted: true, receiptId: result.data.receipt_id, acceptedAt: result.data.accepted_at })
    } catch { return intakeResponse({ accepted: false, error: 'intake_unavailable' }, 503) }
  }
}
