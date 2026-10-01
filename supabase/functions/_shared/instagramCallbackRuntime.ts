import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleInstagramProviderCallback } from './instagramProviderCallbacks.ts'
import type { InstagramCallbackKind } from './instagramProviderCallbacks.ts'

// Provider callbacks remain available even with consent activation OFF, so
// revocation/deletion cannot be prevented by disabling future OAuth.
export function instagramCallbackRuntime(kind: InstagramCallbackKind) {
  return async (req: Request): Promise<Response> => {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return new Response(null, { status: 503 })
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    return handleInstagramProviderCallback(req, {
      kind, appSecret: Deno.env.get('INSTAGRAM_APP_SECRET'), appId: Deno.env.get('INSTAGRAM_APP_ID'),
      statusUrl: `${url}/functions/v1/instagram-data-deletion`,
      store: {
        async apply(callbackKind, verified) {
          const { error } = await sb.rpc('apply_instagram_provider_callback', {
            p_kind: callbackKind, p_app_id: verified.appId, p_app_scoped_user_id: verified.appScopedUserId,
            p_issued_at: verified.issuedAt, p_request_key: verified.requestKey,
            p_confirmation_hash: verified.confirmationHash,
          })
          if (error) throw new Error('Callback persistence unavailable.')
        },
        async status(hash) {
          const { data, error } = await sb.rpc('instagram_data_deletion_status', { p_confirmation_hash: hash })
          if (error) throw new Error('Callback status unavailable.')
          return data === 'completed' ? 'completed' : null
        },
      },
    })
  }
}
