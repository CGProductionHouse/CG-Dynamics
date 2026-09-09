// One-time OneDrive delegated-consent starter (#225).
//
// Redirects the operator to Microsoft's authorize page for the PERSONAL account so it
// can grant `Files.ReadWrite offline_access openid profile`. Gated by a setup token so
// only CA can initiate it. No tokens are handled here — the callback captures them.
//
// CA GATE: this only functions once ONEDRIVE_MS_* + ONEDRIVE_MS_REDIRECT_URI +
// ONEDRIVE_OAUTH_SETUP_TOKEN + token-store env are set (real client secret required).

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildAuthorizeUrl,
  isUploadAdapterConfigured,
  newPkce,
} from '../client-onboarding/onedrive-adapter.ts'
import { savePendingAuth } from '../client-onboarding/onedrive-token-store.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  const setupToken = Deno.env.get('ONEDRIVE_OAUTH_SETUP_TOKEN') ?? ''
  const redirectUri = Deno.env.get('ONEDRIVE_MS_REDIRECT_URI') ?? ''
  const url = new URL(req.url)
  const provided = url.searchParams.get('setup_token') ?? req.headers.get('x-setup-token') ?? ''

  if (!setupToken || provided !== setupToken) {
    return jsonResponse({ ok: false, error: 'Not authorized.' }, 403)
  }
  if (!isUploadAdapterConfigured() || !redirectUri) {
    return jsonResponse({ ok: false, error: 'OneDrive delegated OAuth is not configured yet.' }, 503)
  }

  const { state, verifier, challenge } = await newPkce()
  const saved = await savePendingAuth(state, verifier)
  if (!saved) return jsonResponse({ ok: false, error: 'Could not persist auth state.' }, 500)

  const authorizeUrl = buildAuthorizeUrl(state, challenge, redirectUri)
  if (!authorizeUrl) return jsonResponse({ ok: false, error: 'Could not build authorize URL.' }, 500)

  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: authorizeUrl } })
})
