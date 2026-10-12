import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../supabase/functions/piek-strategy-pilot-dispatch/index.ts', import.meta.url), 'utf8')
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')

test('temporary dispatcher is exact-Piek/November and keeps the R25 and JWT gates', () => {
  assert.match(config, /\[functions\.piek-strategy-pilot-dispatch\][\s\S]*verify_jwt = true/)
  assert.match(source, /PIEK_CLIENT_ID = 'ed7aa1ae-de21-4151-a8f9-54796b234c1f'/)
  assert.match(source, /PILOT_MONTH = '2026-11-01'/)
  assert.match(source, /MAX_ZAR_MICROS = 25_000_000/)
  assert.match(source, /payload\.role === 'service_role'/)
  assert.match(source, /pilotToken\.length < 32 \|\| suppliedPilotToken !== pilotToken/)
  assert.match(source, /readMonthlyStrategyPilotGrant\(/)
  assert.match(source, /grant\.maxZarMicros > MAX_ZAR_MICROS/)
  assert.match(source, /MONTHLY_STRATEGY_AI_ENABLED/)
  assert.match(source, /'X-Internal-Worker-Token': workerToken/)
  assert.match(source, /action: 'pilot_generate_next_month', clientId: PIEK_CLIENT_ID, strategyMonth: PILOT_MONTH/)
  assert.doesNotMatch(source, /console\.|secretKey|localStorage/)
})
