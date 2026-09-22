import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  resolveTiktokBusinessAuthorizationForClient,
  tiktokBusinessPublishingEnabled,
  tokenHealth,
} from '../_shared/tiktok-business.ts'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  let body: { clientId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  if (!body.clientId) return jsonResponse({ ok: false, error: 'clientId is required.' }, 400)

  const { authorization, error } = await resolveTiktokBusinessAuthorizationForClient(
    auth.value.supabase,
    body.clientId,
  )
  if (error) return jsonResponse({ ok: false, error }, 503)
  if (!authorization) {
    return jsonResponse({
      ok: true,
      connected: false,
      status: 'not_connected',
      publishingEnabled: false,
      message: 'No TikTok Business account is authorized for this client.',
    })
  }

  const health = tokenHealth(authorization)
  const providerEligible = authorization.status === 'connected'
    && authorization.publishing_eligibility !== 'not_approved'
    && authorization.publishing_eligibility !== 'suspended'
    && !health.refreshTokenExpired

  return jsonResponse({
    ok: true,
    connected: authorization.status === 'connected' || authorization.status === 'needs_reauth',
    status: authorization.status,
    publishingEnabled: providerEligible && tiktokBusinessPublishingEnabled(),
    rolloutEnabled: tiktokBusinessPublishingEnabled(),
    providerEligible,
    authorization: {
      accountHandle: authorization.account_handle,
      displayName: authorization.display_name,
      grantedPermissions: authorization.granted_permissions,
      publishingEligibility: authorization.publishing_eligibility,
      tokenExpiresAt: authorization.token_expires_at,
      refreshTokenExpiresAt: authorization.refresh_token_expires_at,
      accessTokenExpired: health.accessTokenExpired,
      refreshTokenExpired: health.refreshTokenExpired,
      lastTokenRefreshAt: authorization.last_token_refresh_at,
      lastVerifiedAt: authorization.last_verified_at,
    },
  })
})
