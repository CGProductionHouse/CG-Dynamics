import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const browserFixtures = Object.freeze([
  'client-portal-shell-readonly-browser.mjs', 'client-overview-schedule-browser.mjs', 'client-plan-readonly-browser.mjs',
  'client-library-readonly-browser.mjs', 'client-brand-hub-setup-readonly-browser.mjs', 'report-cutoff-readonly-browser.mjs',
  'director-saved-context-browser.mjs', 'director-precise-edit-browser.mjs',
  'skill-card-review-browser.mjs', 'client-service-expansion-browser.mjs',
  'entitlement-resolution-browser.mjs',
])

export function assertLocalContract(vercel, packageJson) {
  if (vercel?.git?.deploymentEnabled !== false) throw new Error('Automatic deployment must remain disabled')
  if (packageJson?.scripts?.build !== 'tsc -b && vite build') throw new Error('Unknown build contract')
}

// Do not pass ambient production credentials/config to fixture subprocesses.
export function fixtureEnvironment(ambient) {
  const env = {}
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT']) {
    if (ambient[key]) env[key] = ambient[key]
  }
  if (ambient.CG_PLAYWRIGHT_MODULE) env.CG_PLAYWRIGHT_MODULE = ambient.CG_PLAYWRIGHT_MODULE
  env.VITE_SUPABASE_URL = 'http://127.0.0.1:1'
  env.VITE_SUPABASE_PUBLISHABLE_KEY = 'local-public-fixture'
  env.CG_RUN_LOCAL_DB = '1'
  return env
}

export function acceptancePlan(testFiles) {
  const files = testFiles.filter(name => /^[A-Za-z0-9_-]+\.test\.mjs$/.test(name) && name !== 'sesSetupScript.test.mjs').sort()
  if (!files.length) throw new Error('No supported tests found')
  return [
    { name: 'full-supported-suite', args: ['--test', '--test-concurrency=1', '--test-reporter=tap', ...files.map(name => `tests/${name}`)] },
    { name: 'typescript', args: ['node_modules/typescript/bin/tsc', '-b'] },
    { name: 'vite-local-build', args: ['node_modules/vite/bin/vite.js', 'build'] },
    ...browserFixtures.map(name => ({ name, args: [`scripts/${name}`] })),
  ]
}

export function testTotals(output) {
  const count = key => {
    const match = output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'))
    if (!match) throw new Error(`Missing ${key} test total`)
    return Number(match[1])
  }
  const totals = { total: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), cancelled: count('cancelled'), todo: count('todo') }
  if (totals.fail || totals.cancelled || totals.todo || totals.total !== totals.pass + totals.skipped) throw new Error('Incomplete or failed supported suite')
  return totals
}

export function localVerdict(steps, stableTree, evidenceComplete = false) {
  return evidenceComplete && stableTree && steps.length === 3 + browserFixtures.length && steps.every(step => step.exit === 0) ? 'LOCAL_CODE_ACCEPTANCE_PASS' : 'INCOMPLETE_OR_FAILED'
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', timeout: 10000 })
  if (result.status !== 0) throw new Error('Local Git evidence unavailable')
  return result.stdout.trim()
}

function run() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--plan', '--run'].includes(args[0])) throw new Error('Use --plan (no execution) or --run (local fixtures only)')
  assertLocalContract(JSON.parse(readFileSync('vercel.json', 'utf8')), JSON.parse(readFileSync('package.json', 'utf8')))
  const plan = acceptancePlan(readdirSync('tests'))
  if (args[0] === '--plan') { console.log(JSON.stringify(plan, null, 2)); return }
  if (git(['status', '--porcelain'])) throw new Error('Commit the exact local candidate before acceptance')
  const env = fixtureEnvironment(process.env)
  if (!env.CG_PLAYWRIGHT_MODULE) throw new Error('Approved existing local Playwright module is required')
  const receipt = {
    schema: 'cg-local-launch-acceptance/v1', started_at: new Date().toISOString(),
    source_sha: git(['rev-parse', 'HEAD']), source_tree: git(['rev-parse', 'HEAD^{tree}']),
    lock_sha256: digest(readFileSync('package-lock.json')), steps: [],
    excluded: [{ test: 'sesSetupScript.test.mjs', reason: 'Existing unsupported Windows Bash fixture; NOT passed' }],
    evidence_kind: 'synthetic_local_actual_components_and_disposable_sql',
    production_acceptance: 'NOT_RUN', semantic_strategy_acceptance: 'NOT_ESTABLISHED',
    production_artifact: 'NOT_PREPARED: local fixture public configuration; never upload dist',
    protected_actions: 'NOT_EXECUTED', vercel_operations: 0,
  }
  const receiptPath = join(tmpdir(), `cg-local-launch-${receipt.source_sha.slice(0, 12)}.json`)
  let evidenceComplete = false
  try {
    for (const step of plan) {
      console.log(`LOCAL ${step.name}`)
      const result = spawnSync(process.execPath, step.args, { env, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 })
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      const log = join(tmpdir(), `cg-local-launch-${receipt.source_sha.slice(0, 12)}-${step.name}.log`)
      writeFileSync(log, output)
      const item = { name: step.name, exit: result.status, log, log_sha256: digest(output) }
      receipt.steps.push(item)
      if (result.error || result.status !== 0) throw new Error(`Local acceptance stopped at ${step.name}; inspect local log`)
      if (step.name === 'full-supported-suite') item.totals = testTotals(output)
    }
    const bundle = readdirSync('dist/assets').filter(name => name.endsWith('.js'))
    if (!bundle.some(name => readFileSync(`dist/assets/${name}`, 'utf8').includes('client-schedule'))) throw new Error('No application route code in emitted bundle')
    receipt.local_bundle = bundle.sort().map(name => ({ name, sha256: digest(readFileSync(`dist/assets/${name}`)) }))
    evidenceComplete = true
  } finally {
    receipt.stable_tree = !git(['status', '--porcelain']) && git(['rev-parse', 'HEAD']) === receipt.source_sha
    receipt.verdict = localVerdict(receipt.steps, receipt.stable_tree, evidenceComplete)
    receipt.completed_at = new Date().toISOString()
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
    console.log(`${receipt.verdict}: ${receiptPath}; not production acceptance or release authorization`)
  }
  if (receipt.verdict !== 'LOCAL_CODE_ACCEPTANCE_PASS') throw new Error('Local candidate changed during acceptance')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) run()
