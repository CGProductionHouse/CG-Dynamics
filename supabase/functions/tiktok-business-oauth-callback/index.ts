import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { finishBusinessOAuth } from '../_shared/tiktokBusinessOAuth.ts'
import { businessOAuthStore } from '../_shared/tiktokBusinessOAuthStore.ts'
import { businessOAuthConfig } from '../_shared/tiktokBusinessOAuthConfig.ts'

Deno.serve(async request => {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Type': 'text/plain' }
  if (request.method !== 'GET') return new Response('Method not allowed.', { status: 405, headers })
  if (Deno.env.get('TIKTOK_BUSINESS_OAUTH_ENABLED') !== 'true') return new Response('TikTok Business connection rollout is disabled.', { status: 503, headers })
  try {
    const config = businessOAuthConfig(name => Deno.env.get(name))
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) throw new Error('Server configuration unavailable.')
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const ok = await finishBusinessOAuth(config, businessOAuthStore(sb), new URL(request.url))
    const destination = new URL('/admin/integrations/tiktok', config.appUrl)
    destination.searchParams.set('business', ok ? 'connected' : 'error')
    if (ok) destination.searchParams.set('client', ok.clientId)
    return new Response(null, { status: 303, headers: { ...headers, Location: destination.href } })
  } catch {
    // No exception/provider message, URL, code, state or token is reflected/logged.
    return new Response('TikTok Business connection could not be verified. Return to Dynamics and start a new exact-account connection.', { status: 400, headers })
  }
})
