import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const reportingScopes = ['pages_show_list', 'pages_read_engagement', 'read_insights',
  'instagram_basic', 'instagram_manage_insights', 'business_management']

type Configuration = { appId: string; redirectUri: string; graphVersion: string; publishing: boolean }
type Failure = { ok: false; code: string; error: string; status: number }
const failure = (code: string, error: string, status: number): Failure => ({ ok: false, code, error, status })

/** The existing reporting and explicit publishing setup share ONE state/scopes authority.
 * This creates only a short-lived login request; it never reads tokens, grants permission,
 * links an account, creates publication jobs or calls a provider API.
 */
export async function createMetaOAuthRequest(sb: SupabaseClient, actorId: string, config: Configuration,
  get: (name: string) => string | undefined) {
  const activeManager = async () => {
    const result = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
    return !result.error && result.data?.is_active === true && ['admin', 'manager'].includes(result.data.role)
  }
  try {
    if (config.publishing) {
      if (get('SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED') !== 'true') {
        return failure('META_PUBLISHING_CONSENT_DISABLED', 'Facebook publishing permission setup is not enabled.', 409)
      }
      if (!await activeManager()) return failure('ACTIVE_MANAGER_REQUIRED', 'Active admin or manager access required.', 403)
      // Server-owned settings only; fail before persisting a nonce if the URL
      // cannot meet the same HTTPS/code/scope contract used by the staff screen.
      const callback = new URL(config.redirectUri)
      if (!/^[0-9]+$/.test(config.appId) || !/^v[0-9]+\.[0-9]+$/.test(config.graphVersion)
        || callback.protocol !== 'https:' || callback.username || callback.password || callback.hash) {
        return failure('META_PUBLISHING_CONFIGURATION_INVALID', 'Publishing permission setup is not configured correctly.', 503)
      }
    }

    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const state = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state))
    const stateHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({ client_id: config.appId, redirect_uri: config.redirectUri,
      response_type: 'code', state, scope: (config.publishing ? [...reportingScopes, 'pages_manage_posts'] : reportingScopes).join(',') })
    if (config.publishing) params.set('auth_type', 'rerequest')
    const { error } = await sb.from('meta_oauth_states').insert({ state_hash: stateHash, user_id: actorId, expires_at: expiresAt })
    if (error) return failure('META_OAUTH_STATE_UNAVAILABLE', 'Could not start Meta connection.', 500)
    // A role revocation while the state was being saved must not release a URL.
    if (config.publishing && !await activeManager()) return failure('ACTIVE_MANAGER_REQUIRED', 'Active admin or manager access required.', 403)
    return { ok: true as const, url: `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params.toString()}`,
      ...(config.publishing ? {
        consent_purpose: 'facebook_photo_publishing' as const, publishing_ready: false as const, expires_at: expiresAt,
        note: 'Permission request only. Preserve existing asset selections. Owner consent, app eligibility and exact Page verification are still required; publishing remains separately disabled.',
      } : {}) }
  } catch {
    // Never echo configuration, state, provider URLs or a database error.
    return failure('META_OAUTH_SETUP_UNAVAILABLE', 'Could not start Meta connection.', 503)
  }
}
