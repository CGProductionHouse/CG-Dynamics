import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptancePlan, assertLocalContract, browserFixtures, fixtureEnvironment, localVerdict, testTotals } from '../scripts/local-launch-acceptance.mjs'

test('local acceptance refuses automatic deployment or unknown build hooks', () => {
  const pkg = { scripts: { build: 'tsc -b && vite build' } }
  assert.doesNotThrow(() => assertLocalContract({ git: { deploymentEnabled: false } }, pkg))
  for (const deploymentEnabled of [true, undefined, null]) assert.throws(() => assertLocalContract({ git: { deploymentEnabled } }, pkg))
  assert.throws(() => assertLocalContract({ git: { deploymentEnabled: false } }, { scripts: { build: 'vercel deploy' } }))
})

test('fixture subprocesses never inherit production credentials or config', () => {
  const env = fixtureEnvironment({ PATH: 'local-path', SUPABASE_SERVICE_ROLE_KEY: 'DO_NOT_COPY', WORKER_INTERNAL_TOKEN: 'DO_NOT_COPY', VERCEL_TOKEN: 'DO_NOT_COPY', VITE_SUPABASE_URL: 'https://production.invalid', CG_PLAYWRIGHT_MODULE: 'local-module', CG_APPLY: '1' })
  assert.deepEqual(env, { PATH: 'local-path', CG_PLAYWRIGHT_MODULE: 'local-module', VITE_SUPABASE_URL: 'http://127.0.0.1:1', VITE_SUPABASE_PUBLISHABLE_KEY: 'local-public-fixture', CG_RUN_LOCAL_DB: '1' })
  assert.doesNotMatch(JSON.stringify(env), /DO_NOT_COPY|production\.invalid|CG_APPLY/)
})

test('fixed local plan reuses actual fixtures and excludes unsupported fixture honestly', () => {
  const plan = acceptancePlan(['z.test.mjs', '../apply.test.mjs', 'a.test.mjs', 'sesSetupScript.test.mjs', 'provider-apply.mjs'])
  assert.equal(plan.length, 3 + browserFixtures.length)
  assert.deepEqual(plan[0].args.slice(3), ['tests/a.test.mjs', 'tests/z.test.mjs'])
  assert.deepEqual(plan.slice(3).map(step => step.name), browserFixtures)
  assert.doesNotMatch(JSON.stringify(plan), /vercel|supabase deploy|provider-apply|sesSetupScript|\.\.\//)
  assert.throws(() => acceptancePlan([]))
})

test('test totals never convert skipped, cancelled or incomplete checks into passed', () => {
  const totals = '# tests 10\n# pass 8\n# fail 0\n# skipped 2\n# cancelled 0\n# todo 0\n'
  assert.deepEqual(testTotals(totals), { total: 10, pass: 8, fail: 0, skipped: 2, cancelled: 0, todo: 0 })
  for (const output of ['', totals.replace('# fail 0', '# fail 1'), totals.replace('# cancelled 0', '# cancelled 1'), totals.replace('# todo 0', '# todo 1'), totals.replace('# tests 10', '# tests 11')]) assert.throws(() => testTotals(output))
})

test('only all required stable local checks earn the local-only verdict', () => {
  const steps = Array.from({ length: 3 + browserFixtures.length }, () => ({ exit: 0 }))
  assert.equal(localVerdict(steps, true, true), 'LOCAL_CODE_ACCEPTANCE_PASS')
  assert.equal(localVerdict(steps, true), 'INCOMPLETE_OR_FAILED', 'A failed bundle/count assertion cannot earn PASS')
  assert.equal(localVerdict(steps, false, true), 'INCOMPLETE_OR_FAILED')
  assert.equal(localVerdict(steps.slice(1), true, true), 'INCOMPLETE_OR_FAILED')
  assert.equal(localVerdict([...steps.slice(1), { exit: null }], true, true), 'INCOMPLETE_OR_FAILED')
})
