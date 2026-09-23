import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = read('../src/App.tsx')
const page = read('../src/pages/admin/MonthlyStrategyPage.tsx')
const reports = read('../src/pages/admin/ReportsManagement.tsx')

test('monthly strategy staff workspace is manager-guarded and discoverable from reports', () => {
  const managerBlock = app.slice(app.indexOf('<Route element={<RequireManager />}>'), app.indexOf('<Route element={<RequireAdmin />}>'))
  assert.match(managerBlock, /path="\/admin\/monthly-strategy" element=\{<MonthlyStrategyPage \/>\}/)
  assert.match(reports, /Monthly strategies/)
  assert.match(reports, /\/admin\/monthly-strategy/)
})

test('staff resolves one exact client and month through the canonical strategy service', () => {
  assert.match(page, /getMonthlyStrategy\(clientId, month\)/)
  assert.match(page, /getClient\(clientId\)/)
  assert.match(page, /type="month"/)
  assert.match(page, /GuidedStrategyEditor/)
  assert.doesNotMatch(page, /\.from\('monthly_client_strategies'\)|listClientPublishedReports/)
})

test('seeding is explicit, idempotent and never auto-publishes', () => {
  assert.match(page, /onClick=\{\(\) => void runAction\('seed'/)
  assert.match(page, /seedMonthlyStrategy\(\{ clientId, month/)
  assert.match(page, /idempotencyKey: crypto\.randomUUID\(\)/)
  const effects = [...page.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map(match => match[1]).join('\n')
  assert.doesNotMatch(effects, /seedMonthlyStrategy|transitionMonthlyStrategy|amendMonthlyStrategy/)
})

test('save, approve and publish remain separate reviewed actions', () => {
  assert.match(page, /amendMonthlyStrategy\(\{ clientId, month, expectedVersion: strategy\.version/)
  assert.match(page, /targetStatus: 'approved'/)
  assert.match(page, /window\.confirm/)
  assert.match(page, /targetStatus: 'published'/)
  assert.match(page, /disabled=\{dirty \|\| qualityIssues\.length > 0\}/)
  assert.match(page, /It is not client-visible until published/)
})

test('staff UI keeps internal notes out of the client projection path', () => {
  assert.match(page, /Internal review notes/)
  assert.match(page, /Never included in the client projection/)
  assert.doesNotMatch(page, /getClientPublishedMonthlyStrategy/)
})
