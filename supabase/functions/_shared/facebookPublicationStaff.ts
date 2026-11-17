import { readBoundedPublicationBody, socialPublicationAuthorizationHandler, publicationPreparationBlocker, type PublicationAuthorizationPorts, type PublicationTarget } from './socialPublicationAuthorization.ts'
import type { FacebookInspection } from './facebookPublicationInspection.ts'

/** Browser supplies a review ID and exact preview confirmation only. Account,
 * client, media and schedule are resolved on the server; no proof booleans.
 */
export function photoPublicationStaffHandler(input: {
  authenticate: PublicationAuthorizationPorts['authenticate']
  runtime: { readCandidate: PublicationAuthorizationPorts['readCandidate']; targetForReview(reviewId: string): Promise<PublicationTarget> } | null
  persistence: Pick<PublicationAuthorizationPorts, 'authorize' | 'revoke'>
  inspect?: (reviewId: string, actorId: string) => Promise<FacebookInspection>
}) {
  return async (request: Request): Promise<Response> => {
    const response = (status: number, error: string) => Response.json({ ok: false, error }, { status,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
    if (request.method !== 'POST') return response(405, 'POST_REQUIRED')
    try {
      const actor = await input.authenticate(request)
      if (!actor?.active || !['admin', 'manager'].includes(actor.role)) return response(403, 'ACTIVE_MANAGER_REQUIRED')
      if (!input.runtime && !input.inspect) return response(409, 'PUBLICATION_ROLLOUT_DISABLED')
      const raw = await readBoundedPublicationBody(request)
      if (raw === null) return response(400, 'PUBLICATION_REQUEST_INVALID')
      let body
      try { body = JSON.parse(raw) } catch { return response(400, 'PUBLICATION_REQUEST_INVALID') }
      if (body?.action === 'inspect') {
        if (Array.isArray(body) || typeof body.reviewId !== 'string' || Object.keys(body).sort().join(',') !== 'action,reviewId') return response(400, 'PUBLICATION_REQUEST_INVALID')
        if (!input.inspect) return response(409, 'PUBLICATION_INSPECTION_DISABLED')
        return Response.json({ ok: true, inspection: await input.inspect(body.reviewId, actor.id) }, {
          headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
      }
      if (!input.runtime) return response(409, 'PUBLICATION_ROLLOUT_DISABLED')
      const confirm = body?.action === 'confirm'
      const keys = confirm ? ['action', 'reviewId', 'expectedFingerprint', 'confirmPublication'] : ['action', 'reviewId']
      if (!body || Array.isArray(body) || (!confirm && body.action !== 'preview') || typeof body.reviewId !== 'string'
        || Object.keys(body).sort().join(',') !== keys.sort().join(',')) return response(400, 'PUBLICATION_REQUEST_INVALID')
      const target = await input.runtime.targetForReview(body.reviewId)
      const core = socialPublicationAuthorizationHandler({ ...input.persistence, authenticate: async () => actor,
        readCandidate: input.runtime.readCandidate }, true)
      return await core(new Request(request.url, { method: 'POST', body: JSON.stringify({ action: body.action, target,
        ...(confirm ? { expectedFingerprint: body.expectedFingerprint, confirmPublication: body.confirmPublication } : {}) }) }))
    } catch (error) {
      const code = publicationPreparationBlocker(error)
      return code ? response(409, code) : response(503, 'PUBLICATION_VERIFICATION_UNAVAILABLE')
    }
  }
}

// Preserve the existing undeployed Facebook entry/import contract. Instagram's
// private composition can reuse the same confirmation flow, not another endpoint.
export const facebookPublicationStaffHandler = photoPublicationStaffHandler
