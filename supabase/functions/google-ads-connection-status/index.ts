import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import {
  googleAdsConfig,
  listAccessibleAccounts,
  refreshGoogleAccessToken,
  safeGoogleAdsError,
} from '../_shared/google-ads.ts'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  const configured = googleAdsConfig() !== null
  const { count, error } = await auth.value.supabase
    .from('google_ads_account_links')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  const { data: latestRun } = await auth.value.supabase
    .from('google_ads_sync_runs')
    .select('finished_at')
    .eq('status', 'succeeded')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baseStatus = {
    configured,
    linkedAccountsCount: error ? null : (count ?? 0),
    lastSyncedAt: latestRun?.finished_at ?? null,
    lastCheckedAt: new Date().toISOString(),
  }
  const config = googleAdsConfig()
  if (!config) {
    return jsonResponse({ ok: true, ...baseStatus, connected: false, status: 'not_configured', message: 'Google Ads is not configured.' })
  }

  try {
    const accessToken = await refreshGoogleAccessToken(config)
    await listAccessibleAccounts(config, accessToken)
    return jsonResponse({ ok: true, ...baseStatus, connected: true, status: 'connected', message: 'Google Ads connection test passed.' })
  } catch (connectionError) {
    return jsonResponse({
      ok: true,
      ...baseStatus,
      connected: false,
      status: 'connection_error',
      message: safeGoogleAdsError(connectionError).error,
    })
  }
})
