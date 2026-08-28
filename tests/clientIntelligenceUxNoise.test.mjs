import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const clients = read('../src/pages/admin/ClientsList.tsx')
const performance = read('../src/pages/admin/ClientPerformancePage.tsx')
const reports = read('../src/pages/admin/ReportsManagement.tsx')
const reportEditor = read('../src/pages/admin/NewReport.tsx')
const preview = read('../src/pages/admin/PublishedPreview.tsx')
const packages = read('../src/pages/admin/PackageMasterPage.tsx')

test('Clients removes duplicate summaries while preserving identity and actions', () => {
  assert.doesNotMatch(clients, /Total clients/)
  assert.doesNotMatch(clients, /ClientOpsChips/)
  assert.doesNotMatch(clients, /Loading production summary/)
  assert.match(clients, /<PackageChips client=\{c\}/)
  assert.match(clients, /label=\"Client Dashboard\"/)
  assert.match(clients, /label=\"Client Schedule\"/)
  assert.match(clients, /<EmptyState[\s\S]*?compact/)
})

test('Performance removes the repeated workflow and does not show snapshots after load failure', () => {
  assert.doesNotMatch(performance, /WORKFLOW_STEPS/)
  assert.doesNotMatch(performance, /Month-end workflow/)
  assert.match(performance, /\) : error \? \([\s\S]*?title="Performance unavailable"/)
  assert.match(performance, /label=\"Published dashboards\"/)
  assert.match(performance, /title=\"Dashboard queue\"/)
  assert.match(performance, /linkedMetaClients === null/)
})

test('Reports keeps workflow truth without the repeated guide or raw backend errors', () => {
  assert.doesNotMatch(reports, /WorkflowGuide/)
  assert.doesNotMatch(reports, /Sync data, review performance, add CG strategy/)
  assert.doesNotMatch(reports, /setError\((?:loadError|error)\.message\)/)
  assert.match(reports, /<StatusBadge label=\{statusLabel\}/)
  assert.match(reports, /<SourceBadge source=\{sourceVariant\}/)
  assert.match(reports, /Last updated:/)
  assert.match(reports, /<EmptyState[\s\S]*?compact/)
})

test('Report editor keeps reporting evidence and publication gates with concise framing', () => {
  assert.doesNotMatch(reportEditor, /Combine every platform imported/)
  assert.doesNotMatch(reportEditor, /Exactly what .* sees in the published report/)
  assert.doesNotMatch(reportEditor, /The client never sees this/)
  assert.doesNotMatch(reportEditor, /setError\(error\.message\)/)
  assert.match(reportEditor, /Incomplete month - not available for client view yet/)
  assert.match(reportEditor, /title=\"Platform source details\"/)
  assert.match(reportEditor, /Staff-only: unavailable metrics/)
  assert.doesNotMatch(reportEditor, /phase-3j migration/)
  assert.match(reportEditor, /<SourceBadge/)
  assert.match(reportEditor, /<StrategyChecklist data=\{strategyData\}/)
})

test('Staff preview stays explicit and keeps report truth and publishing controls', () => {
  assert.match(preview, /Client Dashboard Preview/)
  assert.match(preview, /Staff preview and publishing controls/)
  assert.doesNotMatch(preview, /CG's working view/)
  assert.doesNotMatch(preview, /Legacy reports/)
  assert.doesNotMatch(preview, /setError\((?:loadError|error)\.message\)/)
  assert.match(preview, /<ClientReportView/)
  assert.match(preview, /dataHealth=\{dataHealth\}/)
  assert.match(preview, /contentExclusions=\{contentExclusions\}/)
  assert.match(preview, /onPublish=/)
  assert.match(preview, /<EmptyState[\s\S]*?compact/)
})

test('Package uses compact product language and preserves package quantities', () => {
  assert.doesNotMatch(packages, /Planner tables not set up/)
  assert.doesNotMatch(packages, /Run Phase 6 migrations/)
  assert.doesNotMatch(packages, />Add deliverable template</)
  assert.doesNotMatch(packages, />Title template</)
  assert.doesNotMatch(packages, /set(?:Pkg|Tpl)Error\(error\.message\)/)
  assert.match(packages, /title=\"Package setup required\"/)
  assert.match(packages, /title=\"No package\"/)
  assert.match(packages, /QUANTITY_FIELDS\.map/)
  assert.match(packages, /savePackageQuantities/)
  assert.match(packages, /<EmptyState[\s\S]*?compact/)
})
