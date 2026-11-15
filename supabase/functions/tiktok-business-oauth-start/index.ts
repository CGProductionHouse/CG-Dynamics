import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { startBusinessOAuth } from '../_shared/tiktokBusinessOAuth.ts'
import { businessOAuthStore } from '../_shared/tiktokBusinessOAuthStore.ts'
import { businessOAuthConfig } from '../_shared/tiktokBusinessOAuthConfig.ts'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)
  if (Deno.env.get('TIKTOK_BUSINESS_OAUTH_ENABLED') !== 'true') return jsonResponse({ ok: false, error: 'TikTok Business connection rollout is disabled.' }, 409)
  try {
    const body = await request.json()
    const url = await startBusinessOAuth(businessOAuthConfig(name => Deno.env.get(name)), businessOAuthStore(auth.value.supabase), {
      clientId: body?.clientId, connectionId: body?.connectionId, actorId: auth.value.user.id,
      expectedHandle: body?.expectedHandle, confirmExactAccount: body?.confirmExactAccount === true,
    })
    return new Response(JSON.stringify({ ok: true, url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch {
    return jsonResponse({ ok: false, error: 'Connection preparation failed. Verify the exact client/account and reviewed server configuration.' }, 400)
  }
})
