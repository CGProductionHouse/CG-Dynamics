import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const performance = read('../src/pages/client/Dashboard.tsx')
const reportView = read('../src/pages/client/ClientReportView.tsx')
const legacyCampaigns = read('../src/pages/client/ClientCampaignsPage.tsx')

test('Campaigns is a first-class Performance report tab beside configured provider tabs', () => {
  assert.match(reportView, /key: 'campaigns', label: 'Campaigns'/)
  assert.match(reportView, /key: 'google_ads'.*label: 'Google Ads'/)
  assert.match(reportView, /reportPlatforms\.map/)
  assert.match(reportView, /activeTab === 'campaigns'/)
})

test('Campaigns reuses the published report and provider data already loaded by Performance', () => {
  assert.match(performance, /getClientPublishedReportWithPosts\(reportId\)/)
  assert.match(performance, /loadGoogleAdsDashboard\(data\.id, currentMonth\)/)
  assert.match(reportView, /report=\{report\}/)
  assert.match(reportView, /googleAds=\{googleAds\}/)
  assert.doesNotMatch(reportView, /listClientPublishedReports|loadGoogleAdsDashboard/)
})

test('legacy Campaigns deep link redirects to the Performance tab without another data path', () => {
  assert.match(app, /path="\/client\/campaigns" element=\{<ClientCampaignsPage \/>\}/)
  assert.match(legacyCampaigns, /Navigate to="\/client\/performance\?tab=campaigns" replace/)
  assert.match(performance, /parseReportTab\(searchParams\.get\('tab'\)\)/)
  assert.doesNotMatch(legacyCampaigns, /profile|client_id|listClientPublishedReports|loadGoogleAdsDashboard/)
})

test('only configured campaign sources render and missing values are not presented as zero', () => {
  assert.match(reportView, /googleAds !== null \|\| googleAdsState !== 'disconnected'/)
  assert.match(reportView, /No verified campaign source is configured/)
  assert.match(reportView, /Missing data is never presented as zero/)
  assert.doesNotMatch(reportView, /Meta Ads|TikTok Ads|Planned integration/)
})

test('campaign direction comes only from the selected published report strategy', () => {
  assert.match(reportView, /readStrategyData\(report\.strategy_data\)/)
  assert.match(reportView, /strategy\.strategyGoingForward/)
  assert.match(reportView, /strategy\.clientDirection/)
  assert.match(reportView, /strategy\.actionPlan\.campaign_recommendation/)
})
