import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/admin/ImportHealthPage.tsx', import.meta.url), 'utf8')

test('System Health keeps actionable gaps visible and full source totals behind disclosure', () => {
  assert.match(page, /<LaunchReadinessPanel \/>/)
  assert.match(page, /<HealthStat label="Missing date"/)
  assert.match(page, /<HealthStat label="Missing client"/)
  assert.match(page, /<summary[^>]*>\s*Imported data totals and source/)
  assert.match(page, /<HealthNote title="Client Schedule source" value="monthly_deliverables"/)
})

test('all five imported-data breakdowns stay accessible and unmatched buckets stay signalled', () => {
  assert.match(page, /Explore imported-data breakdowns/)
  assert.match(page, /\{unmatchedClientBuckets\} unmatched client schedule buckets/)
  for (const title of ['Planner buckets with tasks', 'Monthly deliverables by client', 'Deliverables by month', 'Deliverables by status']) {
    assert.ok(page.includes(title))
  }
  assert.match(page, /<ClientMatchList rows=\{clientScheduleBuckets\}/)
})
