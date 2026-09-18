import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const worker = readFileSync(new URL('../supabase/functions/meta-sync-worker/index.ts', import.meta.url), 'utf8')
const clientReport = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')
const reportEditor = readFileSync(new URL('../src/pages/admin/NewReport.tsx', import.meta.url), 'utf8')

let server
let metaProviderPeriod
let isWithinMetaProviderPeriod

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ metaProviderPeriod, isWithinMetaProviderPeriod } = await server.ssrLoadModule('/supabase/functions/_shared/meta.ts'))
})

after(async () => { await server.close() })

test('provider request timeouts retry with a consumed attempt and stop at the cap', () => {
  assert.match(worker, /const MAX_PROVIDER_ATTEMPTS = 3/)
  assert.match(worker, /if \(e instanceof MetaProviderTimeoutError\) throw e/)
  assert.match(worker, /e instanceof MetaProviderTimeoutError[\s\S]*Provider request timeout exhausted \$\{MAX_PROVIDER_ATTEMPTS\} bounded attempts/)
  assert.match(worker, /refundAttempt = e instanceof RetryableIncompleteError \? e\.refundAttempt : e instanceof MetaSyncDeadlineError/)
  assert.doesNotMatch(worker, /refundAttempt =[^\n]*MetaProviderTimeoutError/)
})

test('pre-request budget yield refunds while transient provider errors consume attempts', () => {
  assert.match(worker, /assertWorkBudget[\s\S]*RetryableIncompleteError\([^\n]+, true\)/)
  assert.match(worker, /pre-request budget check/)
  assert.match(worker, /MetaFactRetryableError\) throw new RetryableIncompleteError\(e\.message, e\.rateLimited\)/)
})

test('rate-limit cooldown remains separately refundable and permission failures stay terminal', () => {
  assert.match(worker, /itemRateLimited \|\| refundAttempt/)
  assert.match(worker, /itemRateLimited \? 900 : null/)
  assert.match(worker, /permission blocked\. Post content was preserved\./)
  assert.doesNotMatch(worker, /permission_blocked[\s\S]{0,120}RetryableIncompleteError/)
})

test('Meta reporting period is one Pacific half-open window across DST', () => {
  const august = metaProviderPeriod('2026-08-01', '2026-08-31')
  assert.deepEqual(august, {
    timezone: 'America/Los_Angeles',
    start: '2026-08-01T07:00:00.000Z',
    endExclusive: '2026-09-01T07:00:00.000Z',
  })
  assert.equal(isWithinMetaProviderPeriod('2026-09-01T06:59:59.999Z', '2026-08-01', '2026-08-31'), true)
  assert.equal(isWithinMetaProviderPeriod('2026-09-01T07:00:00.000Z', '2026-08-01', '2026-08-31'), false)

  const march = metaProviderPeriod('2026-03-01', '2026-03-31')
  assert.equal((Date.parse(march.endExclusive) - Date.parse(march.start)) / 3_600_000, 743)
})

test('ingestion and report rendering retain the provider-period membership', () => {
  assert.match(worker, /isWithinMetaProviderPeriod\(publishTime, periodStart, periodEnd\)/)
  assert.match(worker, /providerPeriod\.start[\s\S]*providerPeriod\.endExclusive/)
  assert.match(clientReport, /isWithinMetaProviderPeriod\(post\.publish_time, start, end\)/)
  assert.match(reportEditor, /post\.raw\?\.source === 'meta_sync' \|\| post\.raw\?\.meta_sync/)
})
