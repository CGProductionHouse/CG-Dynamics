/** Permission setup only. Never connects an account, creates a job or publishes. */
export type MetaConsentInvoke = (name: string, options: { method: 'POST' }) => Promise<{ data: unknown; error: unknown }>
export type MetaConsentResult = { state: 'redirect'; url: string } | { state: 'blocked'; message: string }

const endpoint = 'meta-oauth-start?purpose=facebook_photo_publishing&confirm_permission_request=true'
const scopes = new Set(['pages_show_list', 'pages_read_engagement', 'read_insights', 'instagram_basic',
  'instagram_manage_insights', 'business_management', 'pages_manage_posts'])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const blocked = (message = 'Could not verify publishing permission setup. Your reporting connection is unchanged. Try again when the connection service is available.'): MetaConsentResult => ({ state: 'blocked', message })

function verifiedConsentUrl(data: unknown): string | null {
  if (!object(data) || data.ok !== true || data.consent_purpose !== 'facebook_photo_publishing'
    || data.publishing_ready !== false || typeof data.url !== 'string') return null
  try {
    const url = new URL(data.url), p = url.searchParams
    const keys = ['client_id', 'redirect_uri', 'response_type', 'state', 'scope', 'auth_type']
    const requested = (p.get('scope') ?? '').split(',')
    const callback = new URL(p.get('redirect_uri') ?? '')
    if (url.origin !== 'https://www.facebook.com' || url.username || url.password || url.hash
      || !/^\/v[0-9]+\.[0-9]+\/dialog\/oauth$/.test(url.pathname)
      || [...p.keys()].length !== keys.length || keys.some(key => p.getAll(key).length !== 1)
      || p.get('response_type') !== 'code' || p.get('auth_type') !== 'rerequest'
      || !/^[0-9]+$/.test(p.get('client_id') ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(p.get('state') ?? '')
      || callback.protocol !== 'https:' || callback.username || callback.password || callback.hash
      || requested.length !== scopes.size || new Set(requested).size !== scopes.size || requested.some(scope => !scopes.has(scope))) return null
    return data.url
  } catch { return null }
}

export async function startFacebookPublishingConsent(confirmed: unknown, invoke: MetaConsentInvoke): Promise<MetaConsentResult> {
  if (confirmed !== true) return blocked('Review and confirm the Facebook permission request first.')
  try {
    const { data, error } = await invoke(endpoint, { method: 'POST' })
    if (error) {
      // FunctionsHttpError carries the server response. Only known codes become
      // UI copy; never display a raw error, response, OAuth URL or credential.
      let details: unknown = data
      if (object(error) && error.context instanceof Response) {
        try { details = await error.context.clone().json() } catch { /* generic safe failure */ }
      }
      if (object(details) && details.code === 'META_PUBLISHING_CONSENT_DISABLED') return blocked('Publishing permission setup is not enabled yet. Your reporting connection is unchanged.')
      if (object(details) && details.code === 'ACTIVE_MANAGER_REQUIRED') return blocked('An active admin or manager must request this permission. Your reporting connection is unchanged.')
      return blocked()
    }
    const url = verifiedConsentUrl(data)
    return url ? { state: 'redirect', url } : blocked()
  } catch { return blocked() }
}
