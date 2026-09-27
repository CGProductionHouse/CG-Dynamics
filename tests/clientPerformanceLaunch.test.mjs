import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const reportView = read('../src/pages/client/ClientReportView.tsx')
const clientDashboard = read('../src/pages/client/Dashboard.tsx')
const staffPreview = read('../src/pages/admin/PublishedPreview.tsx')
const websiteFleetSource = read('../src/lib/cgWebsiteFleet.ts')

let server
let overview
let strategy
let websiteFleet

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  overview = await server.ssrLoadModule('/src/lib/overviewModel.ts')
  strategy = await server.ssrLoadModule('/src/lib/strategyEngine.ts')
  websiteFleet = await server.ssrLoadModule('/src/lib/cgWebsiteFleet.ts')
})

after(async () => server?.close())

test('verified TikTok facts render with provider-native labels and explicit zero remains visible', () => {
  const facts = [
    { platform: 'tiktok', metricKey: 'views', value: 420, availability: 'complete', comparableGroup: 'tiktok_views_v1', aggregation: 'sum', sourceMetric: 'video_views', periodStart: '2026-09-01', periodEnd: '2026-09-30' },
    { platform: 'tiktok', metricKey: 'likes', value: 0, availability: 'valid_zero', comparableGroup: 'tiktok_likes_v1', aggregation: 'sum', sourceMetric: 'likes', periodStart: '2026-09-01', periodEnd: '2026-09-30' },
  ]
  const lines = overview.buildOverviewSections(facts).flatMap(section => section.lines)
  assert.deepEqual(lines.map(line => [line.label, line.value, line.hasValue]), [
    ['TikTok video views', 420, true],
    ['TikTok likes', 0, true],
  ])
  assert.doesNotMatch(reportView, /TikTok performance is not yet available|activeTab === 'tiktok'.*Coming soon/)
})

test('client metrics hide unavailable cards while staff diagnostics retain the truth model', () => {
  assert.match(reportView, /filter\(line => line\.hasValue\)/)
  assert.match(reportView, /ConnectorDataHealth/)
  assert.match(reportView, /Taps on the website link from the Instagram profile/)
})

test('canonical strategy status is role-safe and legacy report prose is not an action-plan fallback', () => {
  assert.match(clientDashboard, /getClientPublishedMonthlyStrategy/)
  assert.match(staffPreview, /getMonthlyStrategy/)
  assert.match(reportView, /Draft — not visible to client/)
  assert.doesNotMatch(reportView, /report\.previous_month_reflection|Published report without strategy|Recommended focus/)
})

test('Piek failure fixture is rejected without blocking useful client-ready direction', () => {
  const bad = strategy.emptyStrategyData()
  bad.strategyGoingForward = 'Correct facts are only the starting point.'
  bad.goldStandard.objective = 'Use current CGProductionHouse/PiekGroup-Website verified facts from the evidence dossier.'
  assert.ok(strategy.clientFacingStrategyQualityIssues(bad).length >= 3)

  const generic = strategy.emptyStrategyData()
  generic.goldStandard.objective = 'Increase engagement and build brand awareness.'
  assert.deepEqual(strategy.clientFacingStrategyQualityIssues(generic), ['Generic marketing filler is not an exact client strategy.'])

  const internalIdentity = strategy.emptyStrategyData()
  internalIdentity.strategyDrivers = ['exact client ID: cdb11a82-339e-4b46-9b09-bde1a23efeaf']
  assert.deepEqual(strategy.clientFacingStrategyQualityIssues(internalIdentity), ['Internal record identifiers must not appear in client strategy.'])

  const good = strategy.emptyStrategyData()
  good.strategyGoingForward = 'Start from the actual image, video or poster and add a useful branch-specific reason to act.'
  good.goldStandard.objective = 'Make each Piek piece feel grounded in the supplied asset, correct branch and real occasion.'
  assert.deepEqual(strategy.clientFacingStrategyQualityIssues(good), [])
})

test('reviewed CG-built active-client website identities are exact and never inferred by name', () => {
  assert.equal(websiteFleet.cgManagedWebsiteForClient('ed7aa1ae-de21-4151-a8f9-54796b234c1f')?.canonicalHost, 'www.piekgroup.co.za')
  assert.equal(websiteFleet.cgManagedWebsiteForClient('cdb11a82-339e-4b46-9b09-bde1a23efeaf')?.canonicalHost, 'www.redoakgroup.co.za')
  assert.equal(websiteFleet.cgManagedWebsiteForClient('not-an-exact-client-id'), null)
  assert.doesNotMatch(websiteFleetSource, /websiteId|repository|provider/)
  assert.match(reportView, /CG manages \$\{managedWebsite\.canonicalHost\}/)
  assert.doesNotMatch(reportView, /CG manages.*Not connected/)
})
