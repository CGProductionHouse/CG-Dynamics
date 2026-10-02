// Hermetic tests for scripts/ops/ses-af-south-1-setup.sh using stub aws/supabase CLIs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const script = fileURLToPath(new URL('../scripts/ops/ses-af-south-1-setup.sh', import.meta.url))
const stubs = fileURLToPath(new URL('./fixtures/ses-setup-stubs', import.meta.url))
for (const name of ['aws', 'supabase']) chmodSync(join(stubs, name), 0o755)

function run(args = [], env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cg-ses-setup-'))
  const files = { STUB_LOG: join(dir, 'calls.log'), STUB_SECRETS: join(dir, 'secrets.env'), STUB_VAULT: join(dir, 'vault.sql') }
  for (const file of Object.values(files)) writeFileSync(file, '')
  const result = spawnSync('bash', [script, ...args], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${stubs}${delimiter}${process.env.PATH}`, SUMMARY_FILE: join(dir, 'summary.txt'), ...files, ...env },
  })
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '')
  return {
    status: result.status, output: `${result.stdout}${result.stderr}`,
    calls: read(files.STUB_LOG).split('\n').filter(Boolean), secrets: read(files.STUB_SECRETS), vault: read(files.STUB_VAULT),
    summary: read(join(dir, 'summary.txt')),
  }
}
const MUTATING = /\b(create-|put-|update-|set-topic-attributes|subscribe|secrets set|db query)/

test('dry run performs read-only checks and zero mutating calls', () => {
  const r = run()
  assert.equal(r.status, 0, r.output)
  assert.deepEqual(r.calls.filter((call) => MUTATING.test(call)), [])
  assert.equal(r.secrets, '')
  assert.equal(r.vault, '')
  assert.match(r.output, /pricing plan: NONE/)
  assert.match(r.output, /Sending remains DISABLED/)
})

test('cost and region guards stop before any change', () => {
  for (const [env, pattern] of [
    [{ STUB_PLAN: 'ESSENTIALS' }, /pricing plan in af-south-1 is 'ESSENTIALS'.*Cancel plan/s],
    [{ STUB_PLAN: 'UNKNOWN' }, /not à-la-carte/],
    [{ STUB_POOLS: '1' }, /dedicated IP pools exist/],
    [{ STUB_VDM: 'ENABLED' }, /Virtual Deliverability Manager is ENABLED/],
    [{ STUB_OPT: 'DISABLED' }, /opt-in region/],
  ]) {
    const r = run(['--apply'], env)
    assert.equal(r.status, 2, JSON.stringify(env))
    assert.match(r.output, pattern)
    assert.deepEqual(r.calls.filter((call) => MUTATING.test(call)), [], JSON.stringify(env))
  }
})

test('apply converges the full setup in the safe order', () => {
  const r = run(['--apply'])
  assert.equal(r.status, 0, r.output)
  const order = [
    'sesv2 create-configuration-set --configuration-set-name cg-dynamics-events --sending-options SendingEnabled=true',
    'sesv2 create-email-identity --email-identity notify.cgdynamics.co.za --configuration-set-name cg-dynamics-events',
    'put-email-identity-mail-from-attributes --email-identity notify.cgdynamics.co.za --mail-from-domain mail.notify.cgdynamics.co.za --behavior-on-mx-failure USE_DEFAULT_VALUE',
    'sns create-topic --name cg-dynamics-ses-events --attributes SignatureVersion=2',
    'create-configuration-set-event-destination',
    'secrets set --project-ref ehtjfntukiwbgptqgbzy WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN=arn:aws:sns:af-south-1:123456789012:cg-dynamics-ses-events',
    'sns subscribe --topic-arn arn:aws:sns:af-south-1:123456789012:cg-dynamics-ses-events --protocol https --notification-endpoint https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/website-enquiry-ses-events',
    'iam put-user-policy --user-name cg-dynamics-ses-sender',
    'iam create-access-key --user-name cg-dynamics-ses-sender',
    'secrets set --project-ref ehtjfntukiwbgptqgbzy --env-file',
    'db query --linked --project-ref ehtjfntukiwbgptqgbzy -f',
  ]
  let cursor = -1
  for (const expected of order) {
    const index = r.calls.findIndex((call, i) => i > cursor && call.includes(expected))
    assert.ok(index > cursor, `missing or out of order: ${expected}`)
    cursor = index
  }
  // Only the paid-feature-free calls: no dedicated pools, VDM, plan changes or sends.
  for (const call of r.calls) assert.doesNotMatch(call, /dedicated-ip-pool (create|put)|put-account-vdm|vdm-options|send-email|put-account-pricing|pricing-plan|reputation-options/i, call)
  assert.ok(!r.calls.some((call) => /put-account-details/.test(call)), 'production access requested without opt-in')
  // Event types and SNS policy scoping.
  const destination = r.calls.find((call) => call.includes('create-configuration-set-event-destination'))
  assert.match(destination, /"MatchingEventTypes":\["SEND","DELIVERY","BOUNCE","COMPLAINT","REJECT"\]/)
  const policy = r.calls.find((call) => call.includes('--attribute-name Policy'))
  assert.match(policy, /"Service":"ses.amazonaws.com"/)
  assert.match(policy, /configuration-set\/cg-dynamics-events/)
  const sendPolicy = r.calls.find((call) => call.includes('put-user-policy'))
  assert.match(sendPolicy, /"Action":"ses:SendEmail"/)
  assert.match(sendPolicy, /"ses:FromAddress":"leads@notify.cgdynamics.co.za"/)
  assert.doesNotMatch(sendPolicy, /"Resource":"\*"|ses:\*/)
})

test('secrets reach Supabase and Vault only — never stdout — and sending stays disabled', () => {
  const r = run(['--apply'])
  assert.equal(r.status, 0, r.output)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID=AKIASTUBSTUBSTUBSTUB$/m)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY=STUBSECRETSTUBSECRETSTUBSECRETSTUBSECRET$/m)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_EMAIL_PROVIDER=ses$/m)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_EMAIL_FROM="CG Dynamics Leads <leads@notify.cgdynamics.co.za>"$/m)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_SES_REGION=af-south-1$/m)
  assert.match(r.secrets, /^WEBSITE_ENQUIRY_SES_CONFIGURATION_SET=cg-dynamics-events$/m)
  const worker = r.secrets.match(/^WEBSITE_ENQUIRY_WORKER_SECRET=([0-9a-f]{64})$/m)?.[1]
  assert.ok(worker, 'worker secret not generated')
  assert.ok(r.vault.includes(worker) && r.vault.includes("'website_enquiry_worker_secret'"), 'worker secret not stored in Vault')
  // update_secret returns void and create_secret uuid: they must not share one CASE (Postgres 42804).
  assert.doesNotMatch(r.vault, /\bcase\b/i)
  assert.match(r.vault, /select vault\.update_secret\(id, '[0-9a-f]{64}'\) from vault\.secrets where name = 'website_enquiry_worker_secret';/)
  assert.match(r.vault, /select vault\.create_secret\('[0-9a-f]{64}', 'website_enquiry_worker_secret', '[^']+'\)\s+where not exists \(select 1 from vault\.secrets where name = 'website_enquiry_worker_secret'\);/)
  assert.doesNotMatch(r.secrets, /WEBSITE_ENQUIRY_EMAIL_ENABLED/)
  for (const secret of ['STUBSECRETSTUBSECRET', worker]) {
    assert.ok(!r.output.includes(secret), 'a secret was printed')
    assert.ok(!r.summary.includes(secret), 'a secret reached the summary')
    assert.ok(!r.calls.join('\n').includes(secret), 'a secret was passed on a command line')
  }
})

test('existing access key is never duplicated; an existing ENABLED flag stops the run', () => {
  const stored = 'SUPABASE_URL WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY'
  const reuse = run(['--apply'], { STUB_KEYS: '1', STUB_SECRET_NAMES: stored })
  assert.equal(reuse.status, 0, reuse.output)
  assert.match(reuse.output, /both SES credential secrets exist; reusing them/)
  assert.ok(!reuse.calls.some((call) => call.includes('create-access-key')))
  assert.doesNotMatch(reuse.secrets, /SES_SECRET_ACCESS_KEY/)
  const enabled = run(['--apply'], { STUB_SECRET_NAMES: 'WEBSITE_ENQUIRY_EMAIL_ENABLED' })
  assert.equal(enabled.status, 2)
  assert.match(enabled.output, /must stay unset/)
  assert.deepEqual(enabled.calls.filter((call) => MUTATING.test(call)), [], 'changes made before the ENABLED guard')
})

test('pre-existing IAM keys without both SES credential secrets fail closed before any change', () => {
  for (const [keys, names] of [
    ['1', 'SUPABASE_URL'],
    ['2', 'SUPABASE_URL'],
    ['1', 'WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID'],
    ['1', 'WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY'],
    // A longer name must not satisfy the whole-name match.
    ['1', 'WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID_OLD WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY'],
  ]) {
    for (const args of [['--apply'], []]) {
      const label = JSON.stringify({ keys, names, args })
      const r = run(args, { STUB_KEYS: keys, STUB_SECRET_NAMES: names })
      assert.equal(r.status, 2, label)
      assert.match(r.output, /cannot be completed.*deactivate then delete the unused key\(s\).*Nothing was changed/s, label)
      assert.deepEqual(r.calls.filter((call) => MUTATING.test(call)), [], label)
      assert.ok(!r.calls.some((call) => /create-access-key|create-user|put-user-policy/.test(call)), label)
      assert.equal(r.secrets, '', label)
      assert.equal(r.vault, '', label)
    }
  }
})

test('an unreadable Supabase secret list fails closed before any change', () => {
  const r = run(['--apply'], { STUB_SECRETS_LIST_FAIL: '1' })
  assert.equal(r.status, 2, r.output)
  assert.match(r.output, /cannot list Supabase secret names/)
  assert.deepEqual(r.calls.filter((call) => MUTATING.test(call)), [])
})

test('production access is requested only with explicit opt-in, as TRANSACTIONAL', () => {
  const r = run(['--apply'], { REQUEST_PRODUCTION_ACCESS: 'yes' })
  const request = r.calls.find((call) => call.includes('put-account-details'))
  assert.ok(request)
  assert.match(request, /--production-access-enabled --mail-type TRANSACTIONAL/)
})

test('summary lists exact DNS records (DKIM via SigningHostedZone, MAIL FROM MX + SPF) and no secrets', () => {
  const r = run(['--apply'])
  for (const token of ['tokaaa', 'tokbbb', 'tokccc']) assert.match(r.summary, new RegExp(`CNAME ${token}\\._domainkey\\.notify\\.cgdynamics\\.co\\.za  ->  ${token}\\.dkim\\.amazonses\\.com`))
  assert.match(r.summary, /MX    mail\.notify\.cgdynamics\.co\.za  ->  10 feedback-smtp\.af-south-1\.amazonses\.com/)
  assert.match(r.summary, /TXT   mail\.notify\.cgdynamics\.co\.za  ->  "v=spf1 include:amazonses\.com ~all"/)
})

test('post-setup verifier parses the summary format the setup script writes', async () => {
  const { parseSummary, checkRecord, REQUIRED_SECRET_NAMES } = await import('../scripts/ops/ses-setup-verify.mjs')
  const r = run(['--apply'])
  const records = parseSummary(r.summary)
  assert.deepEqual(records.map((record) => record.type), ['CNAME', 'CNAME', 'CNAME', 'MX', 'TXT'])
  assert.deepEqual(records[3], { type: 'MX', name: 'mail.notify.cgdynamics.co.za', priority: 10, value: 'feedback-smtp.af-south-1.amazonses.com' })
  assert.deepEqual(records[4], { type: 'TXT', name: 'mail.notify.cgdynamics.co.za', value: 'v=spf1 include:amazonses.com ~all' })
  const fake = {
    resolveCname: async (name) => (name === records[0].name ? [`${records[0].value}.`] : []),
    resolveMx: async () => [{ exchange: 'feedback-smtp.af-south-1.amazonses.com', priority: 10 }],
    resolveTxt: async () => [['v=spf1 include:', 'amazonses.com ~all']],
  }
  assert.equal(await checkRecord(fake, records[0]), true)
  assert.equal(await checkRecord(fake, records[1]), false)
  assert.equal(await checkRecord(fake, records[3]), true)
  assert.equal(await checkRecord(fake, { ...records[3], priority: 20 }), false)
  assert.equal(await checkRecord(fake, records[4]), true)
  assert.ok(REQUIRED_SECRET_NAMES.includes('WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN'))
  assert.ok(!REQUIRED_SECRET_NAMES.includes('WEBSITE_ENQUIRY_EMAIL_ENABLED'))
})
