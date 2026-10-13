import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261013225255_client_strategy_gold_projection.sql')
const strategy = read('../src/lib/strategyEngine.ts')
const publish = read('../supabase/migrations/20260917173138_canonical_monthly_client_strategy.sql')
const clientReport = read('../src/pages/client/Dashboard.tsx')
const staffReport = read('../src/pages/admin/PublishedPreview.tsx')

const goldFields = Array.from(strategy.matchAll(/\{ key: '([^']+)', label: '[^']+' \}/g), match => match[1])
const goldProjection = migration.slice(migration.indexOf("'goldStandard', jsonb_build_object("), migration.indexOf('\n  ) end;'))

test('client-safe strategy projects every reviewed field by explicit allowlist', () => {
  assert.equal(goldFields.length, 10)
  const projectedFields = Array.from(goldProjection.matchAll(/^\s*'([^']+)', case when jsonb_typeof\(p_data #> '\{goldStandard,[^}]+\}'\)/gm), match => match[1])
  assert.deepEqual(projectedFields, goldFields)
  for (const field of goldFields) {
    assert.match(goldProjection, new RegExp(`'${field}', case when jsonb_typeof\\(p_data #> '\\{goldStandard,${field}\\}'\\) = 'string'`))
  }
  assert.doesNotMatch(goldProjection, /p_data\s*->\s*'goldStandard'|p_data\s*#>\s*'\{goldStandard\}'/)
  assert.match(migration, /revoke all on function public\.client_safe_strategy_data\(jsonb\) from public, anon, authenticated/)
})

test('migration leaves approved published snapshots and privilege gates untouched', () => {
  assert.match(publish, /published_strategy_data = public\.client_safe_strategy_data\(strategy_data\)/)
  assert.doesNotMatch(migration, /\b(update|insert\s+into|delete\s+from)\s+public\.monthly_client_strategies\b/i)
  assert.doesNotMatch(migration, /\bgrant\s+execute\b/i)
  assert.match(migration, /raise exception 'client-safe gold-standard projection contract failed'/)
})

test('old published snapshots normalize at both Performance read boundaries', async () => {
  for (const source of [clientReport, staffReport]) {
    assert.match(source, /strategyData: readStrategyData\(strategyResult\.data\.strategy_data\)/)
  }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
  try {
    const { readStrategyData, clientFacingStrategyQualityIssues } = await server.ssrLoadModule('/src/lib/strategyEngine.ts')
    const legacyPublished = { version: 1, strategyGoingForward: 'Show the exact branch and service.', strategyDrivers: ['Exact client direction'], clientActionsRequired: [], actionPlan: {} }
    const normalized = readStrategyData(legacyPublished)
    assert.equal(normalized.strategyGoingForward, legacyPublished.strategyGoingForward)
    assert.equal(Object.keys(normalized.goldStandard).length, 10)
    assert.ok(Object.values(normalized.goldStandard).every(value => value === ''))
    assert.doesNotThrow(() => clientFacingStrategyQualityIssues(normalized))
    assert.deepEqual(clientFacingStrategyQualityIssues(normalized), [])
  } finally {
    await server.close()
  }
})
