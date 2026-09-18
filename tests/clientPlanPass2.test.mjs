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

test('Plan uses the canonical exact-month published strategy projection', () => {
  assert.doesNotMatch(PLAN_SOURCE, /listClientPublishedReports\(\)/)
  assert.match(STRATEGY_SOURCE, /getClientPublishedMonthlyStrategy\(strategyMonth\)/)
  assert.match(STRATEGY_SOURCE, /GuidedStrategyView data=\{strategy\}/)
  assert.match(STRATEGY_SOURCE, /Strategy under review/)
  assert.doesNotMatch(STRATEGY_SOURCE, /listClientPublishedReports|actionMonthForReport|buildClientStrategyPreview/)
  assert.match(CALENDAR_SOURCE, /fetchClientMonthAhead\(profile\.client_id, month\)/)
  assert.match(GUIDELINES_SOURCE, /fetchPublishedGuides\(clientId, currentMonth\)/)
  assert.doesNotMatch(STRATEGY_SOURCE, /monthly_client_strategies/)
})

test('Plan canonicalizes a missing or invalid month immediately without report-driven fallback', () => {
  assert.match(PLAN_SOURCE, /const month = requestedMonth && MONTH_PATTERN\.test\(requestedMonth\) \? requestedMonth : currentMonth\(\)/)
  assert.match(PLAN_SOURCE, /canonical\.set\('month', month\)/)
  assert.match(PLAN_SOURCE, /\{ replace: true \}/)
  assert.doesNotMatch(PLAN_SOURCE, /fallbackMonth|actionMonthForReport|listClientPublishedReports|selectMonthlyReports/)
})

test('Plan preserves the exact month when switching tabs and changing months', () => {
  assert.match(PLAN_SOURCE, /updated\.set\('tab', next\.tab \?\? tab\)/)
  assert.match(PLAN_SOURCE, /updated\.set\('month', next\.month \?\? month\)/)
  assert.match(PLAN_SOURCE, /onClick=\{\(\) => updatePlan\(\{ tab: item\.key \}\)\}/)
})

test('Plan month controls and tabs expose accessible button state', () => {
  assert.match(PLAN_SOURCE, /aria-label="Previous month"/)
  assert.match(PLAN_SOURCE, /aria-label="Next month"/)
  assert.match(PLAN_SOURCE, /aria-pressed=\{tab === item\.key\}/)
  assert.match(PLAN_SOURCE, /min-h-11/)
})

test('an empty client month still renders its real calendar canvas', () => {
  assert.match(CALENDAR_SOURCE, /calendar \? \(/)
  assert.match(CALENDAR_SOURCE, /<CalendarSurface/)
  assert.match(CALENDAR_SOURCE, /<MonthGrid month=\{month\} posts=\{scheduledPosts\} events=\{calendar\.events\}/)
  assert.match(CALENDAR_SOURCE, /<Agenda month=\{month\} posts=\{scheduledPosts\} events=\{calendar\.events\}/)
  assert.doesNotMatch(CALENDAR_SOURCE, /calendar && \(calendar\.posts\.length > 0/)
  assert.match(CALENDAR_SOURCE, /Posts, shoots, content runs and client events will appear/)
})
