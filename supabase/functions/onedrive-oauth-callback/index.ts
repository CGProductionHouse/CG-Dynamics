// One-time OneDrive delegated-consent callback (#225).
//
// Receives the authorization code from Microsoft, validates the PKCE state, exchanges
// the code for tokens, and persists them encrypted via the token store. Never displays
// or returns any token. Register this function's URL as the app's Redirect URI.
//
// CA GATE: only functions with real ONEDRIVE_MS_* config after the interactive consent.

import { corsHeaders } from '../_shared/cors.ts'
import { exchangeAuthorizationCode } from '../client-onboarding/onedrive-adapter.ts'
import { takePendingAuth } from '../client-onboarding/onedrive-token-store.ts'

function html(body: string, status = 200): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><title>OneDrive connection</title>${body}`, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const redirectUri = Deno.env.get('ONEDRIVE_MS_REDIRECT_URI') ?? ''
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''

  if (error) {
    return html(`<p>Microsoft returned an error: ${escapeHtml(error)}. You can close this tab.</p>`, 400)
  }
  if (!code || !state || !redirectUri) {
    return html('<p>Missing code/state. Restart the connection from the setup link.</p>', 400)
  }

  const verifier = await takePendingAuth(state)
  if (!verifier) {
    return html('<p>This link has expired or was already used. Restart the connection.</p>', 400)
  }

  const ok = await exchangeAuthorizationCode(code, verifier, redirectUri)
  return ok
    ? html('<p>OneDrive connected. Tokens stored securely. You can close this tab.</p>')
    : html('<p>Could not complete the OneDrive connection. Ensure offline_access was granted and try again.</p>', 400)
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}
