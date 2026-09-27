import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { await server.close() })
const periods = await server.ssrLoadModule('/src/lib/reportPeriod.ts')

test('published partial-month reports remain visible and disclose their evidence cutoff', () => {
  const september = {
    id: 'september-mtd', platform: null, status: 'published',
    period_start: '2026-09-01', period_end: '2026-09-22', created_at: '2026-09-23T00:00:00Z',
  }
  assert.equal(periods.isPublishedMonthToDateReport(september), true)
  assert.equal(periods.selectMonthlyReports([september])[0]?.id, september.id)
  assert.match(periods.reportPeriodDisclosure(september), /Month to date · as of latest verified evidence on 22 September 2026/)
})

test('draft partial periods and malformed legacy ranges remain hidden', () => {
  const draft = { id: 'draft', platform: null, status: 'draft', period_start: '2026-09-01', period_end: '2026-09-22', created_at: '2026-09-23T00:00:00Z' }
  const legacy = { id: 'legacy', platform: null, status: 'published', period_start: '2026-09-03', period_end: '2026-09-22', created_at: '2026-09-23T00:00:00Z' }
  assert.equal(periods.isPublishedMonthToDateReport(draft), false)
  assert.equal(periods.isPublishedMonthToDateReport(legacy), false)
  assert.deepEqual(periods.selectMonthlyReports([draft, legacy]), [])
})

test('published current-month full-range reports remain selectable without admitting drafts or future months', () => {
  const now = new Date('2026-09-27T12:00:00+02:00')
  const published = {
    id: 'september-published', platform: null, status: 'published',
    period_start: '2026-09-01', period_end: '2026-09-30', created_at: '2026-09-24T00:00:00Z',
  }
  const draft = { ...published, id: 'september-draft', status: 'draft' }
  const future = {
    ...published, id: 'october-published', period_start: '2026-10-01', period_end: '2026-10-31',
  }

  assert.equal(periods.isPublishedCurrentMonthReport(published, now), true)
  assert.equal(periods.isPublishedCurrentMonthReport(draft, now), false)
  assert.equal(periods.isPublishedCurrentMonthReport(future, now), false)
  assert.deepEqual(periods.selectMonthlyReports([future, draft, published], now).map(report => report.id), [published.id])
  assert.equal(periods.reportPeriodDisclosure(published), null)
})
