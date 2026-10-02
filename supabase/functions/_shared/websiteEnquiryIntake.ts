// Issue #624 (#405 M2C): server-to-server website enquiry intake adapter.
//
// Pure request handling with injected dependencies, so the exact handler is tested under
// Node against the real canonical M2A transaction in disposable PostgreSQL.
//
// Authority model:
// - The only credential is one opaque per-endpoint intake key in the server-only
//   `x-cg-intake-key` header. The canonical `submit_website_enquiry` transaction resolves
//   client, Website, environment and approved recipients from that key alone.
// - The body can never name a client, Website, environment, recipient, role or
//   lifecycle state: unknown top-level fields are rejected outright.
// - Browser requests (Origin or Sec-Fetch-Site present) are refused and no CORS headers are
//   sent; this is for CG website server routes only.
// - A filled honeypot creates nothing and returns a generic "handled" response.
// - Logs carry outcome categories only — never the key, body, answers or PII.
// - No provider send happens here; the transaction only creates pending outbox jobs.

export const INTAKE_KEY_HEADER = 'x-cg-intake-key'
export const MAX_INTAKE_BODY_BYTES = 32 * 1024

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCHEMA_KEY = /^[a-z][a-z0-9_]{1,63}$/
const SUBMISSION_KEY = /^[A-Za-z0-9:_-]{16,128}$/
const FIELD_KEY = /^[a-z][a-z0-9_]{1,63}$/
const TOP_LEVEL_FIELDS = new Set(['schemaKey', 'schemaVersion', 'submissionKey', 'answers', 'attribution', 'honeypot'])
const ATTRIBUTION_FIELDS = new Set([
  'landing_path', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'device_class',
])

export type IntakeErrorCategory =
  | 'method_not_allowed'
  | 'server_to_server_only'
  | 'unauthorized'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'invalid_request'
  | 'intake_unavailable'
  | 'schema_unsupported'
  | 'invalid_submission'
  | 'submission_conflict'
  | 'temporarily_unavailable'
  | 'rate_limited'

export interface SubmitArgs {
  p_intake_key: string
  p_schema_key: string
  p_schema_version: number
  p_submission_key: string
  p_answers: Record<string, string | boolean | null>
  p_attribution: Record<string, string>
}

export interface SubmitResult {
  data?: unknown
  error?: { code?: string; message?: string } | null
}

export interface IntakeLogEntry {
  event: 'website_enquiry_intake'
  outcome: 'accepted' | 'replayed' | 'honeypot' | IntakeErrorCategory
  status: number
}

export interface IntakeDeps {
  admit: (intakeKey: string) => Promise<SubmitResult>
  submit: (args: SubmitArgs) => Promise<SubmitResult>
  log?: (entry: IntakeLogEntry) => void
}

const STATUS: Record<IntakeErrorCategory, number> = {
  method_not_allowed: 405,
  server_to_server_only: 403,
  unauthorized: 401,
  unsupported_media_type: 415,
  payload_too_large: 413,
  invalid_request: 400,
  intake_unavailable: 403,
  schema_unsupported: 422,
  invalid_submission: 422,
  submission_conflict: 409,
  temporarily_unavailable: 503,
  rate_limited: 429,
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

function fail(deps: IntakeDeps, category: IntakeErrorCategory): Response {
  const status = STATUS[category]
  deps.log?.({ event: 'website_enquiry_intake', outcome: category, status })
  // Only `temporarily_unavailable` is worth retrying with the same submission key.
  return json({ ok: false, error: category, retryable: category === 'temporarily_unavailable' || category === 'rate_limited' }, status,
    category === 'method_not_allowed' ? { Allow: 'POST' } : {})
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export type ParsedIntake =
  | { ok: true; honeypot: boolean; args: Omit<SubmitArgs, 'p_intake_key'> }
  | { ok: false }

/** Strict body contract. Anything not explicitly allowed is rejected. */
export function parseIntakeBody(value: unknown): ParsedIntake {
  if (!isPlainObject(value)) return { ok: false }
  for (const key of Object.keys(value)) if (!TOP_LEVEL_FIELDS.has(key)) return { ok: false }

  const { schemaKey, schemaVersion, submissionKey, answers, attribution, honeypot } = value
  if (typeof schemaKey !== 'string' || !SCHEMA_KEY.test(schemaKey)) return { ok: false }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 10_000) return { ok: false }
  if (typeof submissionKey !== 'string' || !SUBMISSION_KEY.test(submissionKey)) return { ok: false }
  if (honeypot !== undefined && honeypot !== null && (typeof honeypot !== 'string' || honeypot.length > 500)) return { ok: false }

  if (!isPlainObject(answers)) return { ok: false }
  const answerEntries = Object.entries(answers)
  if (answerEntries.length < 1 || answerEntries.length > 32) return { ok: false }
  const cleanAnswers: Record<string, string | boolean | null> = {}
  for (const [key, answer] of answerEntries) {
    if (!FIELD_KEY.test(key)) return { ok: false }
    if (!(answer === null || typeof answer === 'boolean' || (typeof answer === 'string' && answer.length <= 4000))) return { ok: false }
    cleanAnswers[key] = answer
  }

  const cleanAttribution: Record<string, string> = {}
  if (attribution !== undefined && attribution !== null) {
    if (!isPlainObject(attribution)) return { ok: false }
    for (const [key, item] of Object.entries(attribution)) {
      if (!ATTRIBUTION_FIELDS.has(key)) return { ok: false }
      if (item === null || item === undefined) continue
      if (typeof item !== 'string' || /[\r\n]/.test(item) || item.length > (key === 'referrer' ? 2048 : 500)) return { ok: false }
      cleanAttribution[key] = item
    }
  }

  return {
    ok: true,
    honeypot: typeof honeypot === 'string' && honeypot.trim() !== '',
    args: {
      p_schema_key: schemaKey,
      p_schema_version: schemaVersion,
      p_submission_key: submissionKey,
      p_answers: cleanAnswers,
      p_attribution: cleanAttribution,
    },
  }
}

/** Maps canonical transaction errors to bounded, non-revealing categories. */
export function classifySubmitError(error: { code?: string; message?: string }): IntakeErrorCategory {
  const message = error.message ?? ''
  if (error.code === '23505') return 'submission_conflict'
  if (error.code === '22023') {
    if (message.startsWith('Website intake')) return 'intake_unavailable'
    if (message === 'Form schema is unsupported.') return 'schema_unsupported'
    return 'invalid_submission'
  }
  return 'temporarily_unavailable'
}

/** Reads at most `limit` bytes; returns null (and stops reading) once exceeded. */
export async function readCapped(req: Request, limit: number, timeoutMs = 5000): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array()
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, timeoutMs)
  try {
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  if (timedOut) throw new Error('body_timeout')
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength }
  return out
  } finally { clearTimeout(timer); reader.releaseLock() }
}

export async function handleIntakeRequest(req: Request, deps: IntakeDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(deps, 'method_not_allowed')
  // Browsers always send Origin and Sec-Fetch-Site on a cross-site POST. Sec-Fetch-Mode is
  // NOT a browser signal: Node/undici server-side fetch (e.g. a Vercel route) always sends
  // `sec-fetch-mode: cors`, so rejecting it blocked every legitimate website server.
  if (req.headers.has('origin') || req.headers.has('sec-fetch-site')) {
    return fail(deps, 'server_to_server_only')
  }

  const intakeKey = req.headers.get(INTAKE_KEY_HEADER)?.trim() ?? ''
  if (!UUID.test(intakeKey)) return fail(deps, 'unauthorized')

  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') return fail(deps, 'unsupported_media_type')

  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INTAKE_BODY_BYTES) return fail(deps, 'payload_too_large')
  let raw: Uint8Array | null
  try { raw = await readCapped(req, MAX_INTAKE_BODY_BYTES) }
  catch { return fail(deps, 'invalid_request') }
  if (raw === null) return fail(deps, 'payload_too_large')

  let body: unknown
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  } catch {
    return fail(deps, 'invalid_request')
  }
  const parsed = parseIntakeBody(body)
  if (!parsed.ok) return fail(deps, 'invalid_request')

  if (parsed.honeypot) {
    deps.log?.({ event: 'website_enquiry_intake', outcome: 'honeypot', status: 202 })
    return json({ ok: true, handled: true }, 202)
  }

  let result: SubmitResult
  try {
    const admission = await deps.admit(intakeKey)
    const state = admission.data as Record<string, unknown> | null
    if (admission.error || !state) return fail(deps, 'temporarily_unavailable')
    if (state.state === 'unavailable') return fail(deps, 'intake_unavailable')
    if (state.state === 'rate_limited') {
      deps.log?.({ event: 'website_enquiry_intake', outcome: 'rate_limited', status: 429 })
      return json({ ok: false, error: 'rate_limited', retryable: true }, 429,
        { 'Retry-After': state.retry_after === 3600 ? '3600' : '60' })
    }
    if (state.state !== 'allowed') return fail(deps, 'temporarily_unavailable')
    result = await deps.submit({ p_intake_key: intakeKey, ...parsed.args })
  } catch {
    return fail(deps, 'temporarily_unavailable')
  }
  if (result.error) return fail(deps, classifySubmitError(result.error))

  const receipt = result.data as Record<string, unknown> | null
  if (!receipt || receipt.accepted !== true || typeof receipt.receipt_id !== 'string' || !UUID.test(receipt.receipt_id)
    || typeof receipt.accepted_at !== 'string' || !Number.isFinite(Date.parse(receipt.accepted_at))) {
    return fail(deps, 'temporarily_unavailable')
  }
  const replayed = receipt.replayed === true
  deps.log?.({ event: 'website_enquiry_intake', outcome: replayed ? 'replayed' : 'accepted', status: replayed ? 200 : 201 })
  return json({
    ok: true,
    handled: true,
    accepted: true,
    receiptId: receipt.receipt_id,
    acceptedAt: receipt.accepted_at,
    replayed,
  }, replayed ? 200 : 201)
}
