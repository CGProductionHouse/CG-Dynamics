import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/admin/ReportsManagement.tsx', import.meta.url), 'utf8')

test('staff report list is newest-month-first and initially bounded without losing history', () => {
  assert.match(source, /const \[visibleCount, setVisibleCount\] = useState\(25\)/)
  assert.match(source, /getReportMonthFromPeriod\(b\)\.localeCompare\(getReportMonthFromPeriod\(a\)\)/)
  assert.match(source, /visibleReports = filteredReports\.slice\(0, visibleCount\)/)
  assert.match(source, /visibleReports\.length < filteredReports\.length/)
  assert.match(source, /setVisibleCount\(count => count \+ 25\)/)
  assert.match(source, /value=\{monthFilter\}/)
  assert.match(source, /All months/)
  assert.doesNotMatch(source, /\{filteredReports\.map\(/)
})

test('staff report review remains primary and admin destructive actions require disclosure and confirmation', () => {
  assert.match(source, /<summary[^>]*>More actions<\/summary>/)
  assert.match(source, /window\.confirm\(/)
  assert.match(source, /handleStatus\(report\)/)
  assert.match(source, /handleDelete\(report\)/)
  assert.match(source, /Repair to calendar month/)
  assert.match(source, /\/admin\/published\?reportId=/)
})
