import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveMetaGraphConfig } from '../_shared/meta.ts'
import { createMetaOAuthRequest } from '../_shared/metaOAuthRequest.ts'

/** Company-admin context is enforced by the dispatcher; actor comes ONLY from
 * its authenticated principal. No session copying, provider consent or publishing.
 * Each explicit call creates a fresh expiring OAuth state, NOT an idempotent job.
 */
export async function startFacebookPermissionSetup(sb: SupabaseClient, actorId: string, raw: Record<string, unknown>,
  get: (name: string) => string | undefined) {
  const unavailable = (error: string) => ({ error, canPublish: false, publishing_ready: false })
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)
    || Object.keys(raw).length !== 1 || raw.confirm_permission_request !== true) return unavailable('META_PUBLISHING_CONSENT_REQUEST_INVALID')
  try {
    const result = await createMetaOAuthRequest(sb, actorId, { appId: get('META_APP_ID') ?? '',
      redirectUri: get('META_REDIRECT_URI') ?? '', graphVersion: resolveMetaGraphConfig().version, publishing: true }, get)
    if (!result.ok) return unavailable(result.code)
    return { ...result, scope: 'facebook_permission_setup', canPublish: false, requiresOwnerConsent: true,
      next_action: 'Open this expiring Facebook permission link in the existing company browser. The account owner must review/complete consent; keep current client asset selections unchanged. Do not call this again automatically or report scheduling as enabled. After consent, inspect get_facebook_post_readiness with account_only:true for the exact client. Account binding, approved content, Teams freshness and separate publishing release gates still apply.' }
  } catch { return unavailable('META_OAUTH_SETUP_UNAVAILABLE') }
}
