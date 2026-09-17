import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const readSource = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const APP_SOURCE = readSource('../src/App.tsx')
const PLAN_SOURCE = readSource('../src/pages/client/ClientPlanPage.tsx')
const STRATEGY_SOURCE = readSource('../src/pages/client/ClientStrategyPage.tsx')
const CALENDAR_SOURCE = readSource('../src/pages/client/ClientContentCalendarPage.tsx')
const GUIDELINES_SOURCE = readSource('../src/pages/client/ClientContentGuidesPage.tsx')

test('Plan is one monthly experience with the three canonical tabs', () => {
  assert.match(APP_SOURCE, /path="\/client\/plan" element=\{<ClientPlanPage \/>\}/)
  assert.match(PLAN_SOURCE, /key: 'strategy', label: 'Strategy'/)
  assert.match(PLAN_SOURCE, /key: 'calendar', label: 'Calendar'/)
  assert.match(PLAN_SOURCE, /key: 'guidelines', label: 'Content Guidelines'/)
  assert.match(PLAN_SOURCE, /ClientStrategyPage embedded month=\{month\}/)
  assert.match(PLAN_SOURCE, /ClientContentCalendarPage embedded month=\{month\}/)
  assert.match(PLAN_SOURCE, /ClientContentGuidesPage embedded month=\{month\}/)
  assert.match(PLAN_SOURCE, /monthDisplayLabel\(month\)/)
})

test('legacy Strategy, Calendar and Content Guidelines links preserve query context in Plan', () => {
  assert.match(APP_SOURCE, /path="\/client\/strategy" element=\{<ClientPlanLegacyRedirect tab="strategy" \/>\}/)
  assert.match(APP_SOURCE, /path="\/client\/content-calendar" element=\{<ClientPlanLegacyRedirect tab="calendar" \/>\}/)
  assert.match(APP_SOURCE, /path="\/client\/content-guides" element=\{<ClientPlanLegacyRedirect tab="guidelines" \/>\}/)
  assert.match(PLAN_SOURCE, /new URLSearchParams\(location\.search\)/)
  assert.match(PLAN_SOURCE, /params\.set\('tab', tab\)/)
  assert.match(CALENDAR_SOURCE, /\/client\/plan\?tab=guidelines&month=/)
})

test('Plan reuses existing client-safe published reads and does not depend on the unapplied strategy migration', () => {
  assert.match(PLAN_SOURCE, /listClientPublishedReports\(\)/)
  assert.match(STRATEGY_SOURCE, /listClientPublishedReports\(\)/)
  assert.match(STRATEGY_SOURCE, /actionMonthForReport\(candidate\) === month/)
  assert.match(CALENDAR_SOURCE, /fetchClientMonthAhead\(profile\.client_id, month\)/)
  assert.match(GUIDELINES_SOURCE, /fetchPublishedGuides\(clientId, currentMonth\)/)
  for (const source of [PLAN_SOURCE, STRATEGY_SOURCE, CALENDAR_SOURCE, GUIDELINES_SOURCE]) {
    assert.doesNotMatch(source, /client_monthly_strategy|monthly_client_strategies/)
  }
})

test('Plan month controls and tabs expose accessible button state', () => {
  assert.match(PLAN_SOURCE, /aria-label="Previous month"/)
  assert.match(PLAN_SOURCE, /aria-label="Next month"/)
  assert.match(PLAN_SOURCE, /aria-pressed=\{tab === item\.key\}/)
  assert.match(PLAN_SOURCE, /min-h-11/)
})
