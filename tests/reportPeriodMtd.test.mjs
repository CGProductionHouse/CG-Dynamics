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
  assert.equal(periods.selectMonthlyReports([september], new Date('2026-09-27T12:00:00Z'))[0]?.id, september.id)
  assert.match(periods.reportPeriodDisclosure(september), /Month to date · as of latest verified evidence on 22 September 2026/)
})

test('draft partial periods and malformed legacy ranges remain hidden', () => {
  const draft = { id: 'draft', platform: null, status: 'draft', period_start: '2026-09-01', period_end: '2026-09-22', created_at: '2026-09-23T00:00:00Z' }
  const legacy = { id: 'legacy', platform: null, status: 'published', period_start: '2026-09-03', period_end: '2026-09-22', created_at: '2026-09-23T00:00:00Z' }
  assert.equal(periods.isPublishedMonthToDateReport(draft), false)
  assert.equal(periods.isPublishedMonthToDateReport(legacy), false)
  assert.deepEqual(periods.selectMonthlyReports([draft, legacy], new Date('2026-10-01T12:00:00Z')), [])
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

const publishedSeptember = {
  id: 'september', status: 'published', platform: null,
  period_start: '2026-09-01', period_end: '2026-09-30',
}

test('supplied September clock remains authoritative when wall clock advances to October', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-01T12:00:00Z') })
  const now = new Date('2026-09-27T12:00:00Z')
  assert.equal(periods.isCompletedMonth('2026-09', now), false)
  const draft = { ...publishedSeptember, id: 'draft', status: 'draft', updated_at: '2026-10-01' }
  assert.deepEqual(periods.selectMonthlyReports([draft, publishedSeptember], now).map(row => row.id), ['september'])
})

test('supplied October clock admits published history even while wall clock is September', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-27T12:00:00Z') })
  const now = new Date('2026-10-01T12:00:00Z')
  assert.equal(periods.isCompletedMonth('2026-09', now), true)
  assert.deepEqual(periods.selectMonthlyReports([publishedSeptember], now), [publishedSeptember])
})

test('historical drafts and rows without explicit publication never enter selection', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  for (const status of ['draft', 'approved', 'archived', undefined]) {
    assert.deepEqual(periods.selectMonthlyReports([{ ...publishedSeptember, status }], now), [])
  }
})

test('future published partial and full ranges stay hidden regardless of wall clock', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T12:00:00Z') })
  const now = new Date('2026-09-27T12:00:00Z')
  for (const period_end of ['2026-10-20', '2026-10-31']) {
    assert.deepEqual(periods.selectMonthlyReports([{ ...publishedSeptember, period_start: '2026-10-01', period_end }], now), [])
  }
})

test('malformed, rollover, reversed and cross-month published ranges fail closed', () => {
  const now = new Date('2027-01-01T12:00:00Z')
  for (const [period_start, period_end] of [
    ['2026-09-03', '2026-09-22'], ['2026-09-01', '2026-09-31'],
    ['2026-09-01', '2026-08-31'], ['2026-09-01', '2026-10-01'],
    ['2026-13-01', '2026-13-31'], ['', '2026-09-30'],
    ['2026-09-01', 'invalid'], ['2026-09-01', '2026-09-2'],
  ]) {
    assert.deepEqual(periods.selectMonthlyReports([{ ...publishedSeptember, period_start, period_end }], now), [])
  }
})

test('published historical MTD and current MTD/full range preserve ordering and published deduplication', () => {
  const now = new Date('2026-09-27T12:00:00Z')
  const history = { ...publishedSeptember, id: 'august', period_start: '2026-08-01', period_end: '2026-08-20' }
  const mtd = { ...publishedSeptember, id: 'mtd', period_end: '2026-09-22', updated_at: '2026-09-23' }
  const full = { ...publishedSeptember, updated_at: '2026-09-24' }
  assert.deepEqual(periods.selectMonthlyReports([history, mtd], now).map(row => row.id), ['mtd', 'august'])
  assert.deepEqual(periods.selectMonthlyReports([history, mtd, full], now).map(row => row.id), ['september', 'august'])
})

test('month completion respects last-day boundary and invalid clocks fail closed', () => {
  assert.equal(periods.isCompletedMonth('2026-09', new Date('2026-09-30T23:00:00')), false)
  assert.equal(periods.isCompletedMonth('2026-09', new Date('2026-10-01T00:00:00')), true)
  assert.equal(periods.isCompletedMonth('2026-13', new Date('2027-01-01')), false)
  assert.deepEqual(periods.selectMonthlyReports([publishedSeptember], new Date('invalid')), [])
})
