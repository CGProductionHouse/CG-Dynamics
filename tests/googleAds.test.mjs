import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const LIB_SOURCE = readFileSync(new URL('../src/lib/googleAds.ts', import.meta.url), 'utf8')
const PAGE_SOURCE = readFileSync(new URL('../src/pages/admin/GoogleAdsIntegrationPage.tsx', import.meta.url), 'utf8')
const REPORT_VIEW_SOURCE = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')
const SQL_SOURCE = readFileSync(new URL('../supabase/phase-20b-google-ads-shared-accounts.sql', import.meta.url), 'utf8')
const LIST_CAMPAIGNS_SOURCE = readFileSync(new URL('../supabase/functions/google-ads-list-campaigns/index.ts', import.meta.url), 'utf8')
const LINK_SOURCE = readFileSync(new URL('../supabase/functions/google-ads-link-account/index.ts', import.meta.url), 'utf8')

let server
let calculateGoogleAdsReport
let deriveGoogleAdsCampaignReview
let googleAdsCampaignQuery
let isGoogleAdsAccountReady
let isGoogleAdsManagerRole
let normalizeGoogleAdsName
let normalizeCustomerId
let suggestGoogleAdsClient
let validGoogleAdsDate
let validateGoogleAdsCampaignMappings
let validateGoogleAdsDateRange
let validateGoogleAdsModeCoexistence

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({
    calculateGoogleAdsReport,
    deriveGoogleAdsCampaignReview,
    isGoogleAdsAccountReady,
    normalizeGoogleAdsName,
    suggestGoogleAdsClient,
    validateGoogleAdsCampaignMappings,
    validateGoogleAdsModeCoexistence,
  } = await server.ssrLoadModule('/src/lib/googleAds.ts'))
  ;({
    googleAdsCampaignQuery,
    isGoogleAdsManagerRole,
    normalizeCustomerId,
    validGoogleAdsDate,
    validateGoogleAdsDateRange,
  } = await server.ssrLoadModule('/supabase/functions/_shared/google-ads-policy.ts'))
})

after(async () => { await server.close() })

test('customer IDs normalize to canonical ten digits and reject invalid values', () => {
  assert.equal(normalizeCustomerId('customers/123-456-7890'), '1234567890')
  assert.equal(normalizeCustomerId(1234567890), '1234567890')
  assert.equal(normalizeCustomerId('12345'), null)
  assert.equal(normalizeCustomerId('not-an-account'), null)
  assert.equal(normalizeCustomerId('unsafe1234567890suffix'), null)
})

test('date validation rejects impossible, reversed, future, and oversized ranges', () => {
  assert.equal(validGoogleAdsDate('2024-02-29'), true)
  assert.equal(validGoogleAdsDate('2025-02-29'), false)
  assert.match(validateGoogleAdsDateRange('2026-07-02', '2026-07-01', '2026-07-23'), /before startDate/)
  assert.match(validateGoogleAdsDateRange('2026-07-01', '2026-07-24', '2026-07-23'), /future/)
  assert.match(validateGoogleAdsDateRange('2025-01-01', '2026-01-02', '2026-07-23'), /366 days/)
  assert.equal(validateGoogleAdsDateRange('2026-07-01', '2026-07-23', '2026-07-23'), null)
})

test('GAQL is the fixed campaign reporting query with only validated dates interpolated', () => {
  const query = googleAdsCampaignQuery('2026-07-01', '2026-07-23')
  for (const field of ['campaign.id', 'campaign.name', 'campaign.status', 'segments.date', 'metrics.impressions', 'metrics.clicks', 'metrics.cost_micros', 'metrics.conversions', 'metrics.conversions_value']) {
    assert.ok(query.includes(field), `missing ${field}`)
  }
  assert.match(query, /FROM campaign/)
  assert.match(query, /segments\.date BETWEEN '2026-07-01' AND '2026-07-23'/)
  assert.throws(() => googleAdsCampaignQuery("2026-07-01' OR TRUE", '2026-07-23'), /invalid dates/)
})

test('metric calculations use weighted totals and provider conversion values', () => {
  const summary = calculateGoogleAdsReport([
    { date: '2026-07-01', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', currencyCode: 'ZAR', spendMicros: 2_000_000, impressions: 100, clicks: 10, conversions: 1.5, conversionValue: 300 },
    { date: '2026-07-02', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', currencyCode: 'ZAR', spendMicros: 1_000_000, impressions: 50, clicks: 5, conversions: 0.5, conversionValue: 100 },
  ])
  assert.equal(summary.spendMicros, 3_000_000)
  assert.equal(summary.impressions, 150)
  assert.equal(summary.clicks, 15)
  assert.equal(summary.ctr, 10)
  assert.equal(summary.averageCpcMicros, 200_000)
  assert.equal(summary.conversions, 2)
  assert.equal(summary.conversionValue, 400)
  assert.equal(summary.campaignCount, 1)
})

test('monetary totals are not combined across currencies', () => {
  const base = { date: '2026-07-01', customerId: '1234567890', campaignId: '1', campaignName: 'Search', campaignStatus: 'ENABLED', spendMicros: 1_000_000, impressions: 10, clicks: 1, conversions: 0, conversionValue: 0 }
  const summary = calculateGoogleAdsReport([{ ...base, currencyCode: 'ZAR' }, { ...base, customerId: '0987654321', currencyCode: 'USD' }])
  assert.equal(summary.hasMixedCurrencies, true)
  assert.equal(summary.spendMicros, null)
  assert.equal(summary.conversionValue, null)
})

test('only admin and manager roles pass Google Ads setup permission policy', () => {
  assert.equal(isGoogleAdsManagerRole('admin'), true)
  assert.equal(isGoogleAdsManagerRole('manager'), true)
  assert.equal(isGoogleAdsManagerRole('staff'), false)
  assert.equal(isGoogleAdsManagerRole('team'), false)
  assert.equal(isGoogleAdsManagerRole('client'), false)
  assert.equal(isGoogleAdsManagerRole(null), false)
})

test('name normalization ignores case, punctuation, whitespace, and harmless company suffixes', () => {
  assert.equal(normalizeGoogleAdsName('  ACME---Creative   (Pty) Ltd  '), 'acme creative')
  assert.equal(normalizeGoogleAdsName('Acme SA Group Marketing'), 'acme')
  assert.equal(normalizeGoogleAdsName('Acme North'), 'acme north')
})

test('exact normalized suggestions are high confidence and only preselected locally', () => {
  const clients = [{ id: 'dynamic-client', name: 'North Star Pty Ltd' }]
  const suggestion = suggestGoogleAdsClient('north-star marketing', clients)
  assert.deepEqual(
    { clientId: suggestion.clientId, confidence: suggestion.confidence, preselected: suggestion.preselected },
    { clientId: 'dynamic-client', confidence: 'high', preselected: true },
  )
  assert.match(PAGE_SOURCE, /suggestion\.preselected/)
  assert.match(PAGE_SOURCE, /Confirm selected mappings/)
})

test('campaign review initializes high-confidence suggestions as prefilled and selected', () => {
  const campaigns = [
    { id: 'account:enabled', accountId: 'account', customerId: '123', campaignId: 'enabled', name: 'North Star Marketing', status: 'ENABLED', channelType: 'SEARCH' },
    { id: 'account:paused', accountId: 'account', customerId: '123', campaignId: 'paused', name: 'North Star Pty Ltd', status: 'PAUSED', channelType: 'SEARCH' },
    { id: 'account:medium', accountId: 'account', customerId: '123', campaignId: 'medium', name: 'North Star Search', status: 'REMOVED', channelType: 'DISPLAY' },
  ]
  const review = deriveGoogleAdsCampaignReview(campaigns, [{ id: 'client', name: 'North Star Group' }], [])
  assert.equal(review.draftClientIds.enabled, 'client')
  assert.equal(review.draftClientIds.paused, 'client')
  assert.equal(review.draftClientIds.medium, '')
  assert.deepEqual(review.selectedCampaignIds, ['enabled', 'paused'])
})

test('existing mappings initialize with the current client and remain available for explicit selection', () => {
  const campaigns = [
    { id: 'account:100', accountId: 'account', customerId: '123', campaignId: '100', name: 'North Star Marketing', status: 'REMOVED', channelType: 'SEARCH' },
  ]
  const links = [{ id: 'link', accountId: 'account', campaignId: '100', clientId: 'current-client', active: true }]
  const review = deriveGoogleAdsCampaignReview(campaigns, [{ id: 'suggested-client', name: 'North Star' }], links)
  assert.equal(review.draftClientIds['100'], 'current-client')
  assert.deepEqual(review.selectedCampaignIds, [])
  assert.doesNotMatch(PAGE_SOURCE, /disabled=\{Boolean\(link\)\}/)
  assert.match(PAGE_SOURCE, /Current mapping:/)
  assert.match(PAGE_SOURCE, /setSelected\(current => new Set\(current\)\.add\(campaign\.campaignId\)\)/)
})

test('medium, low, and ambiguous suggestions remain unselected', () => {
  const medium = suggestGoogleAdsClient('North Star Search', [{ id: 'north', name: 'North Star' }])
  const low = suggestGoogleAdsClient('North Launch Search', [{ id: 'north', name: 'North Star Studio' }])
  const ambiguous = suggestGoogleAdsClient('North', [{ id: 'one', name: 'North One' }, { id: 'two', name: 'North Two' }])
  assert.equal(medium.confidence, 'medium')
  assert.equal(low.confidence, 'low')
  assert.equal(ambiguous.confidence, 'ambiguous')
  assert.equal(medium.preselected || low.preselected || ambiguous.preselected, false)
  assert.equal(ambiguous.clientId, null)
})

test('duplicate campaign name variants may independently suggest the same client', () => {
  const clients = [{ id: 'same-client', name: 'Dynamic Brand Pty Ltd' }]
  const variants = ['DYNAMIC BRAND SA', 'Dynamic.Brand Marketing']
  assert.deepEqual(variants.map(name => suggestGoogleAdsClient(name, clients).clientId), ['same-client', 'same-client'])
})

test('shared accounts support multiple clients and many campaigns for one client', () => {
  const mappings = [
    { accountId: 'shared-account', campaignId: '100', clientId: 'client-a' },
    { accountId: 'shared-account', campaignId: '101', clientId: 'client-a' },
    { accountId: 'shared-account', campaignId: '102', clientId: 'client-b' },
  ]
  assert.equal(validateGoogleAdsCampaignMappings(mappings), null)
})

test('campaign collision policy rejects two clients for the same raw account campaign identity', () => {
  const collision = [
    { accountId: 'account-a', campaignId: '100', clientId: 'client-a' },
    { accountId: 'account-a', campaignId: '100', clientId: 'client-b' },
  ]
  assert.match(validateGoogleAdsCampaignMappings(collision), /cannot be mapped to more than one client/)
  assert.equal(validateGoogleAdsCampaignMappings([
    { accountId: 'account-a', campaignId: '100', clientId: 'client-a' },
    { accountId: 'account-b', campaignId: '100', clientId: 'client-b' },
  ]), null)
})

test('dedicated and campaign mappings cannot coexist', () => {
  assert.match(validateGoogleAdsModeCoexistence('shared', [{ active: true }], []), /Deactivate the dedicated/)
  assert.match(validateGoogleAdsModeCoexistence('dedicated', [], [{ active: true }]), /Deactivate campaign mappings/)
  assert.equal(validateGoogleAdsModeCoexistence('dedicated', [{ active: true }], []), null)
  assert.equal(validateGoogleAdsModeCoexistence('shared', [], [{ active: true }]), null)
})

test('sync readiness requires an active mapping appropriate to account mode', () => {
  const dedicated = { id: 'dedicated', mode: 'dedicated' }
  const shared = { id: 'shared', mode: 'shared' }
  const unset = { id: 'unset', mode: null }
  const accountLinks = [
    { accountId: 'dedicated', active: true },
    { accountId: 'other', active: true },
  ]
  const campaignLinks = [
    { accountId: 'shared', active: true },
    { accountId: 'shared-inactive', active: false },
  ]
  assert.equal(isGoogleAdsAccountReady(dedicated, accountLinks, campaignLinks), true)
  assert.equal(isGoogleAdsAccountReady(shared, accountLinks, campaignLinks), true)
  assert.equal(isGoogleAdsAccountReady({ id: 'shared-inactive', mode: 'shared' }, accountLinks, campaignLinks), false)
  assert.equal(isGoogleAdsAccountReady({ id: 'other', mode: 'shared' }, accountLinks, campaignLinks), false)
  assert.equal(isGoogleAdsAccountReady(unset, accountLinks, campaignLinks), false)
})

test('raw account campaign metrics have canonical uniqueness independent of client mappings', () => {
  assert.match(SQL_SOURCE, /unique index[^;]+google_ads_campaign_daily_metrics[^;]+\(google_ads_account_id, campaign_id, metric_date\)/s)
  assert.match(SQL_SOURCE, /google_ads_campaign_links_one_active_campaign_idx[\s\S]+\(customer_id, campaign_id\)[\s\S]+where is_active/)
})

test('campaign discovery supplies identity, status, and channel before any mappings exist', () => {
  assert.match(LIST_CAMPAIGNS_SOURCE, /listAccountCampaigns/)
  assert.match(LIST_CAMPAIGNS_SOURCE, /statusLabel/)
  assert.match(LIST_CAMPAIGNS_SOURCE, /advertisingChannelTypeLabel/)
  assert.doesNotMatch(LIST_CAMPAIGNS_SOURCE, /google_ads_campaign_links/)
  assert.match(PAGE_SOURCE, /Discover campaigns/)
  assert.match(PAGE_SOURCE, /All statuses/)
  assert.match(PAGE_SOURCE, /All channels/)
})

test('resolved reporting isolates clients and excludes unmapped shared campaigns', () => {
  assert.match(SQL_SOURCE, /get_google_ads_client_campaign_metrics/)
  assert.match(SQL_SOURCE, /cl\.client_id = p_client_id/)
  assert.match(SQL_SOURCE, /cl\.campaign_id = m\.campaign_id/)
  assert.match(SQL_SOURCE, /cl\.is_active/)
  assert.match(SQL_SOURCE, /al\.client_id = p_client_id/)
  assert.match(LIB_SOURCE, /\.rpc\('get_google_ads_client_campaign_metrics'/)
  assert.doesNotMatch(LIB_SOURCE, /\.from\('google_ads_campaign_daily_metrics'\)/)
  assert.match(REPORT_VIEW_SOURCE, /Source: Google Ads Sync/)
})

test('frontend setup has no direct mutation endpoint or table mutation', () => {
  assert.doesNotMatch(LIB_SOURCE, /\.(insert|update|upsert|delete)\s*\(/)
  assert.doesNotMatch(PAGE_SOURCE, /from ['"]\.\.\/\.\.\/lib\/supabase['"]/)
  assert.doesNotMatch(PAGE_SOURCE, /\.from\s*\(/)
  assert.match(LIB_SOURCE, /action: 'set_mode'/)
  assert.match(LIB_SOURCE, /action: 'save_dedicated'/)
  assert.match(LIB_SOURCE, /action: 'save_campaigns'/)
  assert.match(LIB_SOURCE, /action: 'deactivate_campaign'/)
  assert.match(LIB_SOURCE, /action: 'deactivate_dedicated', googleAdsAccountId: accountId/)
  assert.match(LIB_SOURCE, /action: 'deactivate_campaign', googleAdsAccountId: accountId/)
  assert.match(PAGE_SOURCE, /window\.confirm/)
})

test('client and staff roles are denied Google Ads setup access in SQL and function source', () => {
  assert.match(SQL_SOURCE, /google_ads_accounts: manager select/)
  assert.match(SQL_SOURCE, /google_ads_campaign_links: manager select/)
  assert.match(SQL_SOURCE, /revoke all on public\.google_ads_accounts from anon, authenticated/)
  assert.match(SQL_SOURCE, /grant select on public\.google_ads_accounts to authenticated/)
  assert.match(LINK_SOURCE, /requireAdminOrManager/)
  assert.doesNotMatch(SQL_SOURCE, /google_ads_(accounts|campaign_links): client/)
})
