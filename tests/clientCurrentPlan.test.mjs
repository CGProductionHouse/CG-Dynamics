import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, buildPublishedMonthlyStrategyPreview, businessMonthKey
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ buildPublishedMonthlyStrategyPreview } = await server.ssrLoadModule('/src/lib/clientPortal.ts'))
  ;({ businessMonthKey } = await server.ssrLoadModule('/src/lib/businessTime.ts'))
})
after(async () => { await server?.close() })

test('Overview working month and direction do not depend on an old report or legacy report strategy', () => {
  const home = readFileSync('src/pages/client/ClientPortalHome.tsx', 'utf8')
  assert.doesNotMatch(home, /actionMonthForReport|buildClientStrategyPreview\(data.report\)/)
  assert.match(home, /getClientPublishedMonthlyStrategy\(workingMonth\)/)
  assert.match(home, /previewClientId \?\? profile\?\.client_id/)
  assert.match(home, /fetchClientMonthAhead\(clientId, workingMonth\)/)
  assert.match(home, /businessMonthKey/)
})

test('Plan, strategy, calendar and guides default to the same Johannesburg month', () => {
  assert.equal(businessMonthKey(new Date('2026-09-30T22:00:00Z')), '2026-10')
  assert.equal(businessMonthKey(new Date('2026-09-30T21:59:59Z')), '2026-09')
  assert.equal(businessMonthKey(new Date('2026-12-31T22:00:00Z')), '2027-01')
  for (const file of ['ClientPlanPage', 'ClientStrategyPage', 'ClientContentCalendarPage', 'ClientContentGuidesPage']) {
    const code = readFileSync(`src/pages/client/${file}.tsx`, 'utf8')
    assert.match(code, /businessMonthKey/)
    assert.doesNotMatch(code, /getFullYear\(\)|getMonth\(\)/)
  }
})

const published = {
  strategy_month: '2026-10-01', published_at: '2026-10-02T10:00:00Z',
  strategy_data: { strategyGoingForward: 'Demonstrate the custom-cut PVC range in a before-and-after installation.', goldStandard: { objective: 'Show homeowners how the supplied panels fit a real kitchen renovation.' } },
}

test('exact published current-month gold-standard direction appears without report fallback', () => {
  const preview = buildPublishedMonthlyStrategyPreview(published, '2026-10')
  assert.equal(preview[0].label, 'Monthly objective')
  assert.equal(preview[0].value, published.strategy_data.goldStandard.objective)
  assert.equal(preview[1].value, published.strategy_data.strategyGoingForward)
})

test('missing, unpublished, malformed and different-month strategy evidence stays empty', () => {
  for (const row of [null, { ...published, published_at: null }, { ...published, published_at: 'invalid' }, { ...published, strategy_month: '2026-09-01' }, { ...published, strategy_month: '2026-10-02' }]) {
    assert.deepEqual(buildPublishedMonthlyStrategyPreview(row, '2026-10'), [])
  }
  assert.deepEqual(buildPublishedMonthlyStrategyPreview(published, '2026-13'), [])
})

test('known internal/filler copy is not promoted to current client direction', () => {
  for (const text of ['Published-content record: example', 'CGProductionHouse/CG-Dynamics evidence dossier', 'increase engagement']) {
    assert.deepEqual(buildPublishedMonthlyStrategyPreview({ ...published, strategy_data: { strategyGoingForward: text } }, '2026-10'), [])
  }
})

test('gold-standard-only published strategy is recognised by the existing content authority', () => {
  const page = readFileSync('src/pages/client/ClientStrategyPage.tsx', 'utf8')
  assert.match(page, /hasStrategyContent\(strategy\)/)
  const api = readFileSync('src/lib/monthlyStrategy.ts', 'utf8')
  const clientRead = api.slice(api.indexOf('export async function getClientPublishedMonthlyStrategy'))
  assert.match(clientRead, /rpc\('client_monthly_strategy'/)
  assert.doesNotMatch(clientRead, /p_client_id|\.from\(/)
})
