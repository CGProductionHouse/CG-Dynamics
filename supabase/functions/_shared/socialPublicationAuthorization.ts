import { PUBLISHING_PATHS, preparePublishingIntent, type PublishingContext, type PublishingIntent, type PublishingRoute } from './socialPublishing.ts'

export interface PublicationTarget {
  clientId: string; deliverableId: string; reviewVersionId: string
  connectionId: string; accountId: string; route: PublishingRoute
}
export interface PublicationPreflightEvidence {
  intentFingerprint: string; checkedAt: string; teamsRecordId: string; teamsRevision: string; mediaProfile: string
}
export interface PublicationAuthorizationReceipt {
  jobId: string; authorizationId: string; fingerprint: string; status: string; state: string
}
export interface PublicationAuthorizationPorts {
  // Authenticated identity + active profile, never caller-supplied actor/role.
  authenticate(request: Request): Promise<{ id: string; role: string; active: boolean } | null>
  // Re-read canonical review/schedule, exact binding, private asset hash,
  // provider/media access and Teams instruction through trusted server adapters.
  // Neither booleans nor evidence may be copied from the request body.
  readCandidate(target: PublicationTarget, actorId: string): Promise<{ context: PublishingContext; evidence: PublicationPreflightEvidence }>
  authorize(intent: PublishingIntent, actorId: string, fingerprint: string, evidence: PublicationPreflightEvidence): Promise<PublicationAuthorizationReceipt>
  revoke(jobId: string, clientId: string, actorId: string): Promise<{ jobId: string; status: string; state: string; authorizationRevoked: boolean; providerMayHaveStarted: boolean } | null>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]) => Object.keys(r).every(k => keys.includes(k)) && keys.every(k => Object.hasOwn(r, k))
const hash = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s)

/** This is a stale-preview detector, NOT a bearer capability. Authorization
 * still requires an active manager, fresh private preflight and atomic storage.
 * Keep the UTF-8 byte-length projection identical to the SQL helper.
 */
export async function socialPublicationFingerprint(intent: Readonly<PublishingIntent>): Promise<string> {
  const fields = ['social-publication-confirmation:v1', intent.clientId, intent.deliverableId, intent.reviewVersionId, intent.platform,
    intent.route, intent.connectionId, intent.accountId, intent.assetPath, intent.assetSha256, intent.mediaType, intent.caption, intent.scheduledAt]
  const encoder = new TextEncoder()
  if (fields.some(v => typeof v !== 'string' || !v)) throw new Error('Exact publication preview required.')
  const bytes = encoder.encode(fields.map(v => `${encoder.encode(v).length}:${v}`).join(''))
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
}

function target(value: unknown): PublicationTarget | null {
  if (!record(value) || !exactKeys(value, ['clientId', 'deliverableId', 'reviewVersionId', 'connectionId', 'accountId', 'route'])
    || !['clientId', 'deliverableId', 'reviewVersionId', 'connectionId'].every(k => typeof value[k] === 'string' && UUID.test(value[k] as string))
    || typeof value.accountId !== 'string' || !value.accountId.trim() || value.accountId.length > 256 || /\s/.test(value.accountId)
    || typeof value.route !== 'string' || !Object.hasOwn(PUBLISHING_PATHS, value.route)) return null
  return value as unknown as PublicationTarget
}

function freshEvidence(e: PublicationPreflightEvidence, fingerprint: string, now: number) {
  if (!record(e)) return false
  const checked = Date.parse(e.checkedAt)
  return record(e) && exactKeys(e as unknown as Record<string, unknown>, ['intentFingerprint', 'checkedAt', 'teamsRecordId', 'teamsRevision', 'mediaProfile'])
    && e.intentFingerprint === fingerprint && Number.isFinite(checked) && checked >= now - 300_000 && checked <= now + 30_000
    && [e.teamsRecordId, e.teamsRevision, e.mediaProfile].every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 512)
    && e.mediaProfile.length <= 128
}

export async function readBoundedPublicationBody(request: Request): Promise<string | null> {
  if (!request.body) return null
  const reader = request.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return text + decoder.decode()
      size += value.byteLength
      if (size > 8192) { await reader.cancel(); return null }
      text += decoder.decode(value, { stream: true })
    }
  } finally { reader.releaseLock() }
}

/** Two explicit actions: preview (zero writes), then confirm that exact preview.
 * This core is deliberately not a deployed Edge endpoint or registered MCP tool.
 * Missing rollout/bindings hold it; provider submission is not a dependency.
 */
export function socialPublicationAuthorizationHandler(ports: PublicationAuthorizationPorts, enabled: boolean, now: () => number = Date.now) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, value: Record<string, unknown>) => Response.json(value, { status,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
    if (request.method !== 'POST') return respond(405, { ok: false, error: 'POST_REQUIRED' })
    try {
      const actor = await ports.authenticate(request)
      if (!actor || !UUID.test(actor.id) || actor.active !== true || !['admin', 'manager'].includes(actor.role)) return respond(403, { ok: false, error: 'ACTIVE_MANAGER_REQUIRED' })
      // Bounded parsing also avoids consuming caller uploads as approval evidence.
      const raw = await readBoundedPublicationBody(request)
      if (raw === null) return respond(400, { ok: false, error: 'PUBLICATION_REQUEST_INVALID' })
      let body: unknown
      try { body = JSON.parse(raw) } catch { return respond(400, { ok: false, error: 'PUBLICATION_REQUEST_INVALID' }) }
      if (!record(body)) return respond(400, { ok: false, error: 'PUBLICATION_REQUEST_INVALID' })
      if (body.action === 'revoke') {
        if (!exactKeys(body, ['action', 'jobId', 'clientId']) || typeof body.jobId !== 'string' || !UUID.test(body.jobId)
          || typeof body.clientId !== 'string' || !UUID.test(body.clientId)) return respond(400, { ok: false, error: 'PUBLICATION_REQUEST_INVALID' })
        const result = await ports.revoke(body.jobId, body.clientId, actor.id)
        if (!result) return respond(404, { ok: false, error: 'PUBLICATION_NOT_FOUND' })
        if (result.jobId !== body.jobId || result.authorizationRevoked !== true || typeof result.providerMayHaveStarted !== 'boolean') return respond(503, { ok: false, error: 'PUBLICATION_RECEIPT_UNVERIFIED' })
        return respond(200, { ok: true, publication: { jobId: result.jobId, status: result.status, state: result.state,
          authorizationRevoked: true, providerMayHaveStarted: result.providerMayHaveStarted } })
      }
      // The kill switch stops NEW authority, never an authenticated withdrawal.
      if (!enabled) return respond(409, { ok: false, error: 'PUBLICATION_ROLLOUT_DISABLED' })
      const confirmation = body.action === 'confirm'
      const expectedKeys = confirmation ? ['action', 'target', 'expectedFingerprint', 'confirmPublication'] : ['action', 'target']
      const selected = target(body.target)
      if ((!confirmation && body.action !== 'preview') || !selected || !exactKeys(body, expectedKeys)
        || (confirmation && (body.confirmPublication !== true || !hash(body.expectedFingerprint)))) return respond(400, { ok: false, error: 'EXACT_PUBLICATION_CONFIRMATION_REQUIRED' })
      const current = await ports.readCandidate(selected, actor.id)
      const c = current.context, b = c.binding, r = c.review, d = c.deliverable
      if (r.id !== selected.reviewVersionId || d.id !== selected.deliverableId || r.client_id !== selected.clientId
        || b.connectionId !== selected.connectionId || b.accountId !== selected.accountId || b.route !== selected.route) return respond(409, { ok: false, error: 'EXACT_PUBLICATION_TARGET_CHANGED' })
      // Tentative server-generated authorization exists only in memory for
      // policy validation. It is NOT persisted by preview and confers no grant.
      const prepared = preparePublishingIntent({ ...c, authorization: { id: crypto.randomUUID(), reviewVersionId: r.id, clientId: r.client_id,
        connectionId: b.connectionId, accountId: b.accountId, route: b.route, scheduledAt: r.scheduled_at, assetSha256: c.assetSha256 } })
      const clock = now(), due = Date.parse(r.scheduled_at), expiry = Date.parse(b.tokenValidUntil ?? '')
      if (!prepared.intent || !Number.isFinite(clock) || !(due > clock) || !(expiry > clock + 120_000)) return respond(409, { ok: false, error: 'PUBLICATION_PREFLIGHT_BLOCKED', blockers: prepared.blockers })
      const intent = prepared.intent, fingerprint = await socialPublicationFingerprint(intent)
      if (!freshEvidence(current.evidence, fingerprint, clock)) return respond(409, { ok: false, error: 'FRESH_SERVER_PREFLIGHT_REQUIRED' })
      if (!confirmation) return respond(200, { ok: true, preview: { target: selected, platform: intent.platform, caption: intent.caption,
        mediaType: intent.mediaType, assetSha256: intent.assetSha256, scheduledAt: intent.scheduledAt, fingerprint } })
      if (body.expectedFingerprint !== fingerprint) return respond(409, { ok: false, error: 'PUBLICATION_PREVIEW_CHANGED' })
      const receipt = await ports.authorize(intent, actor.id, fingerprint, current.evidence)
      if (receipt.fingerprint !== fingerprint || !UUID.test(receipt.jobId) || !UUID.test(receipt.authorizationId)) return respond(503, { ok: false, error: 'PUBLICATION_RECEIPT_UNVERIFIED' })
      return respond(200, { ok: true, publication: { jobId: receipt.jobId, authorizationId: receipt.authorizationId,
        fingerprint: receipt.fingerprint, status: receipt.status, state: receipt.state } })
    } catch { return respond(503, { ok: false, error: 'PUBLICATION_VERIFICATION_UNAVAILABLE' }) }
  }
}
