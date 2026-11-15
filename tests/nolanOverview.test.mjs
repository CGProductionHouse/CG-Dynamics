import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const page = readFileSync(new URL('../src/pages/admin/NolanOverview.tsx', import.meta.url), 'utf8')
const work = readFileSync(new URL('../src/pages/admin/MyWorkPage.tsx', import.meta.url), 'utf8')
test('Nolan overview composes existing canonical readers, never another write authority', () => {
  for (const reader of ['listTasks()', 'listPipelineVideos()', 'listMonthlyDeliverablesByMonth(month)']) assert.ok(page.includes(reader))
  assert.doesNotMatch(page, /supabase\.from|localStorage|\.insert\(|\.update\(|service_role|fetch\(/)
})
test('Nolan tab keeps existing manager boundary and deep links', () => {
  assert.ok(work.includes("(requestedTab === 'workload' || requestedTab === 'nolan') && canViewWorkload"))
  assert.ok(work.includes("tab === 'nolan' && canViewWorkload && <NolanOverview />"))
  assert.ok(work.includes("if (taskId) next.set('id', taskId)"))
})
test('Incomplete coverage and source failures are explicit, not passes', () => {
  for (const text of ['not connected yet', 'not a complete paid-entitlement audit', 'role="alert"', 'migrationNeeded', 'No matching records returned', 'not independent delivery or approval verification']) assert.ok(page.includes(text))
})
test('Refresh is bounded to opening, focus and explicit action; cleanup suppresses stale reads', () => {
  assert.ok(page.includes("window.addEventListener('focus', refresh)"))
  assert.ok(page.includes("window.removeEventListener('focus', refresh)"))
  assert.ok(page.includes('if (cancelled) return'))
  assert.doesNotMatch(page, /setInterval/)
})
test('Retains existing liked visual shell, scoped inside Dynamics without iframe or credential bridge', () => {
  for (const text of ['nolan-board', 'Here’s the situation.', 'YOUR WORKBOARD', 'grid list', 'Coverage & source freshness']) assert.ok(page.includes(text))
  assert.doesNotMatch(page, /iframe|postMessage|access_token/)
  const css = readFileSync(new URL('../src/pages/admin/nolanOverview.css', import.meta.url), 'utf8')
  assert.ok(css.includes('.nolan-board .card'))
  assert.doesNotMatch(css, /@import/)
})
