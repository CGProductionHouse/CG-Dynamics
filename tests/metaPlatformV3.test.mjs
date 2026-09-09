import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMetaInsight } from '../supabase/functions/_shared/metaInsightResponse.ts'
import { metaBatchHealth } from '../src/lib/metaSyncHealth.ts'
import { readMetaUsage } from '../supabase/functions/_shared/metaUsage.ts'
import { expectedMetaDailyEnds, metaInsightsBounds } from '../supabase/functions/_shared/meta.ts'

test('Pacific daily coverage includes all August days and DST boundaries', () => {
  const august = metaInsightsBounds('2026-08-01', '2026-08-31')
  const days = expectedMetaDailyEnds(august.since, august.until)
  assert.equal(days.length, 31)
  assert.equal(days[0], Date.parse('2026-08-02T07:00:00Z'))
  assert.equal(days.at(-1), Date.parse('2026-09-01T07:00:00Z'))
  const march = metaInsightsBounds('2026-03-07', '2026-03-09')
  const spring = expectedMetaDailyEnds(march.since, march.until)
  assert.equal(spring.length, 3)
  assert.equal(spring[1] - spring[0], 23 * 3600 * 1000)
})

test('provider usage retains numeric scope evidence and Retry-After without arbitrary headers', () => {
  const usage = readMetaUsage(new Headers({
    'retry-after': 'Tue, 08 Sep 2026 06:02:00 GMT',
    'x-app-usage': JSON.stringify({ call_count: 97, total_time: 85, access_token: 'never-store' }),
    'x-business-use-case-usage': JSON.stringify({ '123': [{ call_count: 91, estimated_time_to_regain_access: 15 }] }),
  }), Date.parse('2026-09-08T06:00:00Z'))
  assert.equal(usage.retryAfterSeconds, 120)
  assert.deepEqual(usage.app, { call_count: 97, total_time: 85 })
  assert.equal(usage.business['123'][0].estimated_time_to_regain_access, 15)
  assert.equal(readMetaUsage(new Headers({ 'x-app-usage': '{invalid', 'retry-after': 'invalid' })).retryAfterSeconds, null)
})

test('actual daily response remains a time series even when total_value was requested', () => {
  const result = parseMetaInsight([{ name: 'page_media_view', period: 'day', values: [
    { value: 285, end_time: '2026-08-02T07:00:00+0000' },
    { value: 267, end_time: '2026-08-03T07:00:00+0000' },
  ] }], 'page_media_view', true)
  assert.deepEqual(result, { value: 552, responseShape: 'time_series', reason: null })
})

test('daily unique viewers cannot become a monthly audience by addition', () => {
  assert.equal(parseMetaInsight([{ name: 'page_total_media_view_unique', period: 'day', values: [
    { value: 137, end_time: '2026-08-02T07:00:00+0000' },
  ] }], 'page_total_media_view_unique', false).reason, 'daily_unique_series_not_summable')
})

test('a numeric series must cover exactly the requested calendar days', () => {
  const ends = ['2026-08-02T07:00:00Z', '2026-08-03T07:00:00Z'].map(Date.parse)
  const parse = values => parseMetaInsight([{ name: 'views', period: 'day', values }], 'views', true, undefined, ends)
  assert.equal(parse([{ value: 3, end_time: '2026-08-02T07:00:00Z' }]).value, null)
  assert.equal(parse([{ value: 3, end_time: '2026-08-02T07:00:00Z' }, { value: 4, end_time: '2026-08-04T07:00:00Z' }]).value, null)
  assert.equal(parse([{ value: 3, end_time: '2026-08-03T07:00:00Z' }, { value: 4, end_time: '2026-08-02T07:00:00Z' }]).value, 7)
})

test('missing/duplicate/non-numeric daily buckets cannot become complete totals', () => {
  for (const values of [
    [{ value: null, end_time: '2026-08-02T07:00:00Z' }],
    [{ value: 2 }],
    [{ value: 2, end_time: '2026-08-02T07:00:00Z' }, { value: 2, end_time: '2026-08-02T07:00:00Z' }],
  ]) assert.equal(parseMetaInsight([{ name: 'views', period: 'day', values }], 'views', true).value, null)
  assert.equal(parseMetaInsight([{ name: 'reach', total_value: { value: 2 } }], 'views', true).value, null)
  assert.equal(parseMetaInsight([{ name: 'views', total_value: { value: 0 } }], 'views', true).value, 0)
})

test('follows uses the named component even when provider also includes a combined total', () => {
  const data = [{ name: 'follows_and_unfollows', total_value: { value: 11, breakdowns: [{
    dimension_keys: ['follow_type'], results: [
      { dimension_values: ['FOLLOWER'], value: 9 },
      { dimension_values: ['NON_FOLLOWER'], value: 2 },
    ],
  }] } }]
  assert.equal(parseMetaInsight(data, 'follows_and_unfollows', true, 'follows').value, 9)
  assert.equal(parseMetaInsight(data, 'follows_and_unfollows', true, 'unfollows').value, 2)
  assert.equal(parseMetaInsight([{ name: 'follows_and_unfollows', total_value: { value: 11 } }], 'follows_and_unfollows', true, 'follows').value, null)
})

test('Cape Lumber healthy provider cooldown is never a stalled worker', () => {
  const now = Date.parse('2026-09-08T05:44:00Z')
  const health = metaBatchHealth({ status: 'running', cooldown_until: '2026-09-08T05:57:34Z', worker_heartbeat_at: '2026-09-08T05:43:39Z', last_worker_error: 'Meta rate-limited the page-token request.' }, now, true)
  assert.equal(health.coolingDown, true)
  assert.equal(health.stalled, false)
  assert.equal(health.retryAt, '2026-09-08T05:57:34.000Z')
  assert.equal(metaBatchHealth({ status: 'running', worker_heartbeat_at: '2026-09-08T05:43:39Z' }, now, true).stalled, false)
  assert.equal(metaBatchHealth({ status: 'running', cooldown_until: '2026-09-08T05:40:00Z', worker_heartbeat_at: '2026-09-08T05:30:00Z' }, now, true).stalled, true)
})
