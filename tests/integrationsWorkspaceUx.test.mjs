import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/admin/IntegrationsPage.tsx', import.meta.url), 'utf8')

test('provider coverage is not described as all Facebook and Instagram connected', () => {
  assert.match(source, /Meta provider connected\. \$\{linkedClients\} client/)
  assert.doesNotMatch(source, /Facebook and Instagram are connected\./)
  assert.match(source, /Connection coverage and reporting freshness are separate/)
  assert.match(source, /Fleet freshness/)
  assert.match(source, /Reconciliation freshness/)
  assert.match(source, /metaFleetFreshnessEvidence\(metaCheckpoints/)
  assert.match(source, /microsoftFreshnessEvidence\(/)
})

test('Planner Import remains manager-gated but is not presented as a provider connection', () => {
  assert.match(source, /<section aria-label="Provider connections"/)
  assert.match(source, /<\/section>\s*\{canManageGoogleAds && <div/)
  assert.match(source, /navigate\('\/admin\/planner-import'\)/)
})
