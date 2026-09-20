import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, audit
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  audit = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/googleAdsAudit.ts')
})
after(async () => { await server?.close() })

const A = '42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa'
const B = 'cdb11a82-339e-4b46-9b09-bde1a23efeaf'
const input = { client_id: A, start_date: '2026-08-01', end_date: '2026-08-31' }
const account = (mode = 'shared') => ({ id: 'account-a', customer_id: '4951506884', account_name: 'Exact account', account_mode: mode, currency_code: 'ZAR', time_zone: 'Africa/Johannesburg', is_active: true })
const metric = (overrides = {}) => ({ google_ads_account_id: 'account-a', client_id: null, customer_id: '4951506884', campaign_id: 'campaign-a', campaign_name: 'Campaign A', campaign_status: 'ENABLED', campaign_type: 'SEARCH', metric_date: '2026-08-25', impressions: 100, clicks: 5, interactions: null, cost_micros: 1230000, conversions: null, conversion_value: null,
  native_settings: { observed_at: '2026-09-01T10:00:00Z', budget_amount_micros: null }, ...overrides })
const link = (client = A, campaign = 'campaign-a') => ({ google_ads_account_id: 'account-a', customer_id: '4951506884', client_id: client, campaign_id: campaign, campaign_name: 'Mapped campaign', is_active: true })
const sync = (overrides = {}) => ({ google_ads_account_id: 'account-a', status: 'succeeded', period_start: '2026-08-01', period_end: '2026-08-31', finished_at: '2026-09-01T10:00:00Z', rows_upserted: 1, unmapped_campaigns: 0, ...overrides })
const rows = () => ({ accounts: [account()], dedicatedLinks: [], campaignLinks: [link()], metrics: [metric()], syncRuns: [sync()] })

test('exact client and explicit valid dates are required', () => {
  assert.match(audit.validateGoogleAdsAuditInput({ ...input, client_id: 'Cape Lumber' }), /UUID/)
  assert.match(audit.validateGoogleAdsAuditInput({ ...input, end_date: '2026-07-31' }), /before startDate/)
  assert.match(audit.validateGoogleAdsAuditInput({ ...input, start_date: '2026-02-30' }), /Valid startDate/)
  assert.equal(audit.validateGoogleAdsAuditInput(input), null)
})

test('unmapped and cross-client campaign facts fail closed', () => {
  assert.equal(audit.buildGoogleAdsAudit(input, { ...rows(), campaignLinks: [link(B)] }).mapping_state, 'not_mapped')
  const result = audit.buildGoogleAdsAudit(input, { ...rows(), metrics: [metric({ client_id: B }), metric({ campaign_id: 'other-client' })] })
  assert.deepEqual(result.accounts[0].campaigns.map(campaign => campaign.campaign_id), ['campaign-a'])
  assert.equal(result.accounts[0].campaigns[0].period_state, 'not_synced')
  assert.deepEqual(result.accounts[0].campaigns[0].daily_metrics, [])
  assert.equal(result.client_id, A)
})

test('dedicated mapping rejects conflicting active client link', () => {
  const data = { ...rows(), accounts: [account('dedicated')], dedicatedLinks: [link(A), link(B)] }
  assert.equal(audit.buildGoogleAdsAudit(input, data).mapping_state, 'not_mapped')
})

test('provider null stays null and account-local period/settings observation are explicit', () => {
  const result = audit.buildGoogleAdsAudit(input, rows())
  assert.equal(result.accounts[0].account.time_zone, 'Africa/Johannesburg')
  assert.equal(result.accounts[0].campaigns[0].daily_metrics[0].conversions, null)
  assert.equal(result.accounts[0].campaigns[0].daily_metrics[0].interactions, null)
  assert.equal(result.accounts[0].campaigns[0].current_settings.observed_at, '2026-09-01T10:00:00Z')
  assert.equal(result.accounts[0].campaigns[0].current_settings.values.budget_amount_micros, null)
  assert.equal(result.period.semantics, 'Google Ads account-local dates')
})

test('not_synced, stale, partial and unavailable settings are distinct', () => {
  const data = rows()
  assert.equal(audit.buildGoogleAdsAudit(input, { ...data, syncRuns: [] }).data_state, 'not_synced')
  assert.equal(audit.buildGoogleAdsAudit(input, { ...data, syncRuns: [sync({ period_end: '2026-08-10' })] }).data_state, 'stale')
  assert.equal(audit.buildGoogleAdsAudit(input, { ...data, truncated: true }).data_state, 'partial')
  assert.equal(audit.buildGoogleAdsAudit(input, { ...data, metrics: [metric({ native_settings: null })] }).accounts[0].campaigns[0].current_settings, null)
})

test('identical read is deterministic; missing audit surfaces and mutation boundary are explicit', () => {
  assert.deepEqual(audit.buildGoogleAdsAudit(input, rows()), audit.buildGoogleAdsAudit(input, rows()))
  const result = audit.buildGoogleAdsAudit(input, rows())
  assert.equal(result.mutation_capability, false)
  for (const surface of ['search_terms', 'change_history', 'google_recommendations', 'conversion_goal_detail']) assert.ok(result.missing_surfaces.includes(surface))
  const catalog = readFileSync('supabase/functions/cg-dynamics-mcp/toolCatalog.ts', 'utf8')
  const context = readFileSync('supabase/functions/cg-dynamics-mcp/projectContext.ts', 'utf8')
  const serverSource = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
  assert.match(catalog, /name: 'get_google_ads_audit'[\s\S]*?readOnlyHint: true/)
  assert.match(context, /COMPANY_ADMIN_TOOLS[\s\S]*?'get_google_ads_audit'/)
  assert.match(serverSource, /get_google_ads_audit: handleGetGoogleAdsAudit/)
  assert.doesNotMatch(serverSource.match(/const WRITE_TOOLS = new Set\(([^\n]+)/)?.[1] ?? '', /get_google_ads_audit/)
  const handler = serverSource.slice(serverSource.indexOf('const handleGetGoogleAdsAudit:'), serverSource.indexOf('const MISSING_RELATION_CODES'))
  assert.match(handler, /data_state: 'unavailable'/)
  assert.doesNotMatch(handler, /searchStream|refreshGoogleAccessToken|\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
})
