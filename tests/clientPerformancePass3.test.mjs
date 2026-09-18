import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const performance = read('../src/pages/client/Dashboard.tsx')
const reportView = read('../src/pages/client/ClientReportView.tsx')
const legacyCampaigns = read('../src/pages/client/ClientCampaignsPage.tsx')
const providerIcons = read('../src/components/client/PerformanceProviderIcon.tsx')

test('Performance exposes the complete icon-led provider workspace', () => {
  for (const key of ['overview', 'facebook', 'instagram', 'google', 'tiktok', 'linkedin', 'web', 'email']) {
    assert.match(reportView, new RegExp(`key: '${key}'.*icon: '${key}'`))
  }
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
  assert.match(reportView, /googleAds !== null \|\| googleAdsState !== 'disconnected'/)
  assert.match(reportView, /No verified campaign source is configured/)
  assert.match(reportView, /Missing data is never presented as zero/)
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

test('Google stays grouped with URL-backed Ads and Business surfaces', () => {
  assert.match(reportView, /Google Performance/)
  assert.match(reportView, /Google performance services/)
  assert.match(reportView, /\(\['ads', 'business'\] as const\)/)
  assert.match(performance, /parseGoogleSurface\(searchParams\.get\('surface'\)\)/)
  assert.match(performance, /next\.set\('surface', surface\)/)
})

test('unavailable provider panels remain visible and never fabricate zero metrics', () => {
  assert.match(reportView, /title="Website Performance"/)
  assert.match(reportView, /Available for CG-built websites connected to Dynamics|available for CG-built websites connected to Dynamics/)
  assert.match(reportView, /title="Email Marketing"/)
  assert.match(reportView, /title="LinkedIn"/)
  assert.match(reportView, /status="Coming soon"/)
  assert.match(reportView, /status=\{activeTab === 'tiktok' \? 'Coming soon' : 'Not connected'\}/)
})

test('campaign direction comes only from the selected published report strategy', () => {
  assert.match(reportView, /readStrategyData\(report\.strategy_data\)/)
  assert.match(reportView, /strategy\.strategyGoingForward/)
  assert.match(reportView, /strategy\.clientDirection/)
  assert.match(reportView, /strategy\.actionPlan\.campaign_recommendation/)
})
