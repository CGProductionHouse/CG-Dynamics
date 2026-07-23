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
    const discoverableAccounts = accounts.filter(account => !account.manager && account.status === 'ENABLED')
    const discoveredAt = new Date().toISOString()
    const { data: canonicalAccounts, error: upsertError } = discoverableAccounts.length > 0
      ? await auth.value.supabase
        .from('google_ads_accounts')
        .upsert(discoverableAccounts.map(account => ({
          customer_id: account.customerId,
          account_name: account.name ?? `Google Ads ${account.customerId}`,
          currency_code: account.currencyCode ?? 'XXX',
          time_zone: account.timeZone ?? 'UTC',
          last_discovered_at: discoveredAt,
        })), { onConflict: 'customer_id' })
        .select('id, customer_id, account_mode, is_active')
      : { data: [], error: null }
    if (upsertError || !canonicalAccounts) {
      return jsonResponse({ ok: false, error: 'Could not store Google Ads account discovery metadata.' }, 500)
    }

    const accountIds = canonicalAccounts.map(account => account.id)
    const { data: successfulRuns, error: runError } = accountIds.length > 0
      ? await auth.value.supabase
        .from('google_ads_sync_runs')
        .select('google_ads_account_id, finished_at')
        .in('google_ads_account_id', accountIds)
        .eq('status', 'succeeded')
        .order('finished_at', { ascending: false })
      : { data: [], error: null }
    if (runError) return jsonResponse({ ok: false, error: 'Could not load Google Ads sync history.' }, 500)

    const canonicalByCustomer = new Map(canonicalAccounts.map(account => [account.customer_id, account]))
    const lastSyncByAccount = new Map<string, string>()
    for (const run of successfulRuns ?? []) {
      if (run.finished_at && !lastSyncByAccount.has(run.google_ads_account_id)) {
        lastSyncByAccount.set(run.google_ads_account_id, run.finished_at)
      }
    }
    const enrichedAccounts = discoverableAccounts.map(account => {
      const canonical = canonicalByCustomer.get(account.customerId)
      return {
        ...account,
        googleAdsAccountId: canonical?.id ?? null,
        accountMode: canonical?.account_mode ?? null,
        isActive: canonical?.is_active ?? true,
        lastSyncedAt: canonical ? (lastSyncByAccount.get(canonical.id) ?? null) : null,
      }
    })
    return jsonResponse({ ok: true, accounts: enrichedAccounts, count: enrichedAccounts.length })
  } catch (error) {
    return jsonResponse({ ok: false, ...safeGoogleAdsError(error) }, 502)
  }
})
