import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const schedule = await import('../supabase/functions/_shared/monthlyStrategyAutopilotSchedule.ts')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('monthly strategy schedule uses Johannesburg date and one deterministic daily key', () => {
  assert.equal(schedule.monthlyStrategyAutopilotOperatingDate(new Date('2026-09-21T21:59:59.000Z')), '2026-09-21')
  assert.equal(schedule.monthlyStrategyAutopilotOperatingDate(new Date('2026-09-21T22:00:00.000Z')), '2026-09-22')
  assert.equal(schedule.monthlyStrategyAutopilotIdempotencyKey('2026-09-22'), 'monthly-strategy-autopilot:2026-09-22')
  assert.throws(() => schedule.monthlyStrategyAutopilotIdempotencyKey('22-09-2026'), /Invalid monthly strategy autopilot operating date/)
})

test('content may proceed only after the exact daily strategy job succeeded', () => {
  for (const status of [undefined, null, 'queued', 'running', 'failed', 'cancelled']) {
    assert.equal(schedule.monthlyStrategyReadyForContent(status), false, String(status))
  }
  assert.equal(schedule.monthlyStrategyReadyForContent('succeeded'), true)
})

test('background worker enqueues strategy before content and gates content on strategy completion', () => {
  const worker = read('../supabase/functions/background-worker/index.ts')
  const strategyCall = worker.indexOf('await ensureDailyMonthlyStrategyAutopilotJob(supabase)')
  const contentCall = worker.indexOf('await ensureDailyContentAutopilotJob(supabase, monthlyStrategyAutopilotSchedule)')

  assert.ok(strategyCall >= 0)
  assert.ok(contentCall > strategyCall)
  assert.match(worker, /job_type: MONTHLY_STRATEGY_AUTOPILOT_JOB_TYPE/)
  assert.match(worker, /max_attempts: 3/)
  assert.match(worker, /ignoreDuplicates: true/)
  assert.match(worker, /monthlyStrategyReadyForContent\(monthlyStrategySchedule\.jobStatus\)/)
  assert.match(worker, /state: 'waiting_for_monthly_strategy'/)
})

test('durable strategy job invokes only the accepted internal endpoint contract', () => {
  const worker = read('../supabase/functions/background-worker/index.ts')
  const handler = read('../supabase/functions/monthly-strategy-autopilot/index.ts')
  const shared = read('../supabase/functions/_shared/monthlyStrategyAutopilot.ts')

  assert.match(worker, /case MONTHLY_STRATEGY_AUTOPILOT_JOB_TYPE:/)
  assert.match(worker, /functions\/v1\/monthly-strategy-autopilot/)
  assert.match(worker, /'X-Internal-Worker-Token': workerToken/)
  assert.match(worker, /body\?\.ok !== true/)
  assert.match(handler, /jsr:@supabase\/supabase-js@2/)
  assert.match(handler, /runMonthlyStrategyAutopilot/)
  assert.match(shared, /rpc\('seed_monthly_client_strategy'/)
  assert.doesNotMatch(shared, /\.from\('monthly_client_strategies'\)\.insert|\.update\(/)
  assert.doesNotMatch(worker, /transition_monthly_client_strategy|workflow_status.*approved|workflow_status.*published/)
})

test('integration adds no scheduler or Content Autopilot flag mutation', () => {
  const scheduleSource = read('../supabase/functions/_shared/monthlyStrategyAutopilotSchedule.ts')
  const worker = read('../supabase/functions/background-worker/index.ts')

  assert.doesNotMatch(scheduleSource, /pg_cron|cron\.schedule|net\.http_post/)
  assert.doesNotMatch(worker, /Deno\.env\.set\(CONTENT_AUTOPILOT/)
})
