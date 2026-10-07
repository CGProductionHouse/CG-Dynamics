import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const performance = read('../src/pages/client/Dashboard.tsx')
const reportView = read('../src/pages/client/ClientReportView.tsx')
const serviceTabs = read('../src/lib/performanceServiceCatalog.ts')
const legacyCampaigns = read('../src/pages/client/ClientCampaignsPage.tsx')
const providerIcons = read('../src/components/client/PerformanceProviderIcon.tsx')

test('Performance exposes all service destinations without claiming provider evidence', () => {
  for (const key of ['overview', 'facebook', 'instagram', 'google', 'tiktok', 'web', 'linkedin', 'email']) {
    assert.match(serviceTabs, new RegExp(`key: '${key}'.*icon: '${key}'`))
  }
  assert.match(reportView, /reportPlatforms\.includes/)
  assert.match(reportView, /PerformanceProviderIcon/)
  assert.match(reportView, /aria-label=\{item\.label\}/)
  assert.match(reportView, /title=\{item\.label\}/)
  assert.doesNotMatch(reportView, />\{item\.label\}<\/button>/)
})

test('Google Ads reuses the published report and provider data already loaded by Performance', () => {
  assert.match(performance, /getClientPublishedReportWithPosts\(reportId\)/)
  assert.match(performance, /loadGoogleAdsDashboard\(data\.id, currentMonth\)/)
  assert.match(reportView, /report=\{report\}/)
  assert.match(reportView, /googleAds=\{googleAds\}/)
  assert.doesNotMatch(reportView, /listClientPublishedReports|loadGoogleAdsDashboard/)
})

test('legacy Campaigns deep link redirects to the Performance tab without another data path', () => {
  assert.match(app, /path="\/client\/campaigns" element=\{<ClientCampaignsPage \/>\}/)
  assert.match(legacyCampaigns, /Navigate to="\/client\/performance\?tab=google" replace/)
  assert.match(performance, /parseReportTab\(searchParams\.get\('tab'\)\)/)
  assert.doesNotMatch(legacyCampaigns, /profile|client_id|listClientPublishedReports|loadGoogleAdsDashboard/)
})

test('only configured campaign sources render and missing values are not presented as zero', () => {
  assert.match(reportView, /googleAds !== null \|\| \['data', 'not-synced', 'error', 'no-activity'\]\.includes\(googleAdsState\)/)
  assert.match(reportView, /PerformanceServiceStory service="google"/)
  assert.match(reportView, /googleAds !== null && \['data', 'no-activity'\]\.includes\(googleAdsState\)/)
  assert.doesNotMatch(reportView, /Meta Ads|TikTok Ads|Planned integration/)
})

test('branded providers use recognizable official glyph paths, not letter placeholders', () => {
  for (const provider of ['facebook', 'instagram', 'google', 'tiktok', 'linkedin']) {
    assert.match(providerIcons, new RegExp(`provider === '${provider}'`))
  }
  assert.match(providerIcons, /Official Facebook glyph sourced from Simple Icons/)
  assert.match(providerIcons, /Official Instagram camera glyph sourced from Simple Icons/)
  assert.match(providerIcons, /Official multicolour Google G/)
  assert.match(providerIcons, /Official TikTok note glyph sourced from Simple Icons/)
  assert.match(providerIcons, /Official LinkedIn favicon mark sourced from static\.licdn\.com/)
  assert.doesNotMatch(providerIcons, />\s*[FIGTL]\s*<\//)
})

test('Google renders verified Ads without a dead Business placeholder', () => {
  assert.match(reportView, /Google Performance/)
  assert.doesNotMatch(reportView, /Google performance services|Google Business Profile|Coming soon/)
})

test('provider panels are evidence-gated and never fabricate unavailable metrics', () => {
  assert.match(reportView, /title="Website Performance"/)
  assert.match(reportView, /<PublishedWebsitePerformance report=\{report\.website_report \?\? null\} managedWebsite=\{managedWebsite\} maintenanceIncluded=\{knownWebsiteMaintenance\} \/>/)
  assert.match(reportView, /no approved website snapshot was published with this monthly report/i)
  assert.doesNotMatch(reportView, /title="Email Marketing"|title="LinkedIn"/)
  assert.match(reportView, /status="Unavailable"/)
  assert.doesNotMatch(reportView, /activeTab === 'tiktok'.*Coming soon/)
})

test('monthly action direction comes only from the canonical monthly strategy', () => {
  assert.match(reportView, /monthlyStrategy\.strategyData/)
  assert.doesNotMatch(reportView, /buildStrategyCards|report\.previous_month_reflection/)
})
