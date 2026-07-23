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
  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)

  try {
    const accessToken = await refreshGoogleAccessToken(config)
    const accounts = await listAccessibleAccounts(config, accessToken)
    const { data: links } = await auth.value.supabase
      .from('google_ads_account_links')
      .select('id, customer_id, client_id')
      .eq('is_active', true)
    const linkIds = (links ?? []).map(link => link.id)
    const { data: successfulRuns } = linkIds.length > 0
      ? await auth.value.supabase
        .from('google_ads_sync_runs')
        .select('account_link_id, finished_at')
        .in('account_link_id', linkIds)
        .eq('status', 'succeeded')
        .order('finished_at', { ascending: false })
      : { data: [] }
    const linkByCustomer = new Map((links ?? []).map(link => [link.customer_id, link]))
    const lastSyncByLink = new Map<string, string>()
    for (const run of successfulRuns ?? []) {
      if (run.finished_at && !lastSyncByLink.has(run.account_link_id)) {
        lastSyncByLink.set(run.account_link_id, run.finished_at)
      }
    }
    const enrichedAccounts = accounts.map(account => {
      const link = linkByCustomer.get(account.customerId)
      return {
        ...account,
        activeLink: link ? { id: link.id, clientId: link.client_id } : null,
        lastSyncedAt: link ? (lastSyncByLink.get(link.id) ?? null) : null,
      }
    })
    return jsonResponse({ ok: true, accounts: enrichedAccounts, count: enrichedAccounts.length })
  } catch (error) {
    return jsonResponse({ ok: false, ...safeGoogleAdsError(error) }, 502)
  }
})
