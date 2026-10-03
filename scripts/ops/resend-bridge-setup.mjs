// Issue #405: temporary Resend Free bridge for website-enquiry notifications (SES stays intact
// in parallel). Dry run by default; `--apply` makes changes; `--switch-provider` additionally
// points the worker at Resend once the domain is verified. Never prints, logs or passes a secret
// on a command line, and never sets WEBSITE_ENQUIRY_EMAIL_ENABLED.
//
//   RESEND_SETUP_API_KEY=<full-access key, set in your own shell> node scripts/ops/resend-bridge-setup.mjs [--apply] [--switch-provider]
//
// What it converges (Resend Free plan only — no paid features are used):
// - domain notify.cgproductionhouse.com (region eu-west-1, open/click tracking off);
// - a sending_access API key restricted to that domain -> Supabase WEBSITE_ENQUIRY_RESEND_API_KEY;
// - a webhook to website-enquiry-delivery-webhook for email.delivered/bounced/complained
//   -> Supabase WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET;
// - with --switch-provider, only when the domain is verified: WEBSITE_ENQUIRY_EMAIL_PROVIDER=resend
//   and WEBSITE_ENQUIRY_EMAIL_FROM (SES secrets, identity and schedule are left untouched).
// The full-access setup key is only used for these calls and is never stored.
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PROJECT_REF = 'ehtjfntukiwbgptqgbzy'
export const DOMAIN = 'notify.cgproductionhouse.com'
export const REGION = 'eu-west-1'
export const FROM_HEADER = 'CG Dynamics Leads <leads@notify.cgproductionhouse.com>'
export const KEY_NAME = 'cg-dynamics-website-enquiry-sending'
export const WEBHOOK_ENDPOINT = `https://${PROJECT_REF}.supabase.co/functions/v1/website-enquiry-delivery-webhook`
export const WEBHOOK_EVENTS = ['email.delivered', 'email.bounced', 'email.complained']
const API = 'https://api.resend.com'

export class Stop extends Error {}
const hasName = (listing, name) => new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`, 'm').test(listing)

/**
 * @param {object} deps
 * @param {(name: string) => string | undefined} deps.env
 * @param {string[]} deps.args
 * @param {typeof fetch} deps.fetch
 * @param {() => string | null} deps.listSecretNames  `supabase secrets list` output, or null if unreadable
 * @param {(envFileText: string) => void} deps.setSecrets  stores KEY=value lines in Supabase secrets
 * @param {(line: string) => void} deps.log
 * @returns {Promise<{ applied: boolean, summary: string }>}
 */
export async function run({ env, args, fetch, listSecretNames, setSecrets, log }) {
  const apply = args.includes('--apply')
  const switchProvider = args.includes('--switch-provider')
  const key = (env('RESEND_SETUP_API_KEY') ?? '').trim()

  log(`== 1. Guards (${apply ? 'APPLY' : 'dry run'})`)
  if (!/^re_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Stop('RESEND_SETUP_API_KEY is missing or not a Resend key (re_...). Create a Full access key in the Resend dashboard and set it in your own shell; it is not stored.')
  const names = listSecretNames()
  if (names === null) throw new Stop(`cannot list Supabase secret names for ${PROJECT_REF}`)
  if (hasName(names, 'WEBSITE_ENQUIRY_EMAIL_ENABLED')) throw new Stop('WEBSITE_ENQUIRY_EMAIL_ENABLED exists in Supabase secrets; it must stay unset until the CA activation gate.')

  const call = async (method, path, body) => {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'cg-dynamics-resend-bridge-setup' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* reported below */ }
    if (!response.ok) throw new Stop(`Resend ${method} ${path} failed: HTTP ${response.status}${json?.name ? ` ${json.name}` : ''}${json?.message ? ` — ${json.message}` : ''}`)
    return json
  }

  const domains = (await call('GET', '/domains'))?.data ?? []
  log(`  Resend key works; ${domains.length} domain(s) on the account`)
  // Each new credential is stored the moment it exists: Resend shows a key token and a webhook
  // signing secret only once, so a later failure must not lose an earlier one.
  const stored = []
  const store = (...lines) => {
    setSecrets(`${lines.join('\n')}\n`)
    stored.push(...lines.map((line) => line.split('=')[0]))
  }
  const wantKey = !hasName(names, 'WEBSITE_ENQUIRY_RESEND_API_KEY')
  const haveHookSecret = hasName(names, 'WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET')

  // Preflight: an existing webhook whose signing secret is not stored cannot be completed
  // (Resend returns the secret only at creation). Stop before any change.
  const hooks = (await call('GET', '/webhooks'))?.data ?? []
  const hook = hooks.find((item) => item.endpoint === WEBHOOK_ENDPOINT) ?? null
  if (hook && !haveHookSecret) {
    throw new Stop(`a Resend webhook for ${WEBHOOK_ENDPOINT} already exists (${hook.id}) but WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET is not set in Supabase. Resend only returns the signing secret at creation, so delete that webhook in the Resend dashboard and re-run. Nothing was changed.`)
  }
  if (hook) {
    const missing = WEBHOOK_EVENTS.filter((event) => !(hook.events ?? []).includes(event))
    if (missing.length) throw new Stop(`existing Resend webhook ${hook.id} is missing events ${missing.join(', ')}; add them in the Resend dashboard (or delete it and its Supabase secret) and re-run. Nothing was changed.`)
    if (hook.status && hook.status !== 'enabled') throw new Stop(`existing Resend webhook ${hook.id} is ${hook.status}; enable it in the Resend dashboard and re-run. Nothing was changed.`)
  }

  log(`== 2. Domain ${DOMAIN} (${REGION}, tracking off)`)
  let domain = domains.find((item) => item.name === DOMAIN) ?? null
  if (!domain && apply) {
    domain = await call('POST', '/domains', { name: DOMAIN, region: REGION, open_tracking: false, click_tracking: false })
    log(`  created domain ${domain.id}`)
  } else if (!domain) {
    log(`  [dry-run] would create domain ${DOMAIN} in ${REGION}`)
  } else {
    log(`  exists (${domain.id}), status ${domain.status}, region ${domain.region}`)
  }
  const detail = domain ? await call('GET', `/domains/${domain.id}`) : null

  log('== 3. Sending-only API key (restricted to this domain) -> WEBSITE_ENQUIRY_RESEND_API_KEY')
  if (!wantKey) {
    log('  WEBSITE_ENQUIRY_RESEND_API_KEY already set in Supabase; not creating another key')
  } else if (apply) {
    const created = await call('POST', '/api-keys', { name: KEY_NAME, permission: 'sending_access', domain_id: domain.id })
    if (typeof created?.token !== 'string' || !created.token.startsWith('re_')) throw new Stop('Resend did not return a sending key token')
    store(`WEBSITE_ENQUIRY_RESEND_API_KEY=${created.token}`)
    log(`  created sending_access key ${created.id}; stored in Supabase`)
  } else {
    log('  [dry-run] would create a sending_access key restricted to the domain')
  }

  log(`== 4. Webhook ${WEBHOOK_ENDPOINT} (${WEBHOOK_EVENTS.join(', ')}) -> WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET`)
  if (hook) {
    log(`  exists (${hook.id}) with the required events; signing secret already stored`)
  } else if (apply) {
    const created = await call('POST', '/webhooks', { endpoint: WEBHOOK_ENDPOINT, events: WEBHOOK_EVENTS })
    if (typeof created?.signing_secret !== 'string' || !created.signing_secret.startsWith('whsec_')) throw new Stop('Resend did not return a webhook signing secret')
    store(`WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET=${created.signing_secret}`)
    log(`  created webhook ${created.id}; signing secret stored in Supabase`)
  } else {
    log('  [dry-run] would create the webhook and store its signing secret')
  }

  log('== 5. Provider switch (WEBSITE_ENQUIRY_EMAIL_ENABLED is never set here)')
  const verified = detail?.status === 'verified'
  if (switchProvider && verified && apply) {
    store('WEBSITE_ENQUIRY_EMAIL_PROVIDER=resend', `WEBSITE_ENQUIRY_EMAIL_FROM="${FROM_HEADER}"`)
    log(`  switched provider to resend, From ${FROM_HEADER}`)
  } else if (switchProvider && !verified) {
    log(`  not switched: domain status is ${detail?.status ?? 'not created'}; add the DNS records, wait for "verified", re-run with --switch-provider`)
    if (apply && detail) {
      await call('POST', `/domains/${detail.id}/verify`)
      log('  requested a Resend verification check')
    }
  } else {
    log('  provider left unchanged (pass --switch-provider after the domain is verified)')
  }

  if (stored.length) log(`  stored in Supabase this run: ${stored.join(', ')}`)

  const records = detail?.records ?? []
  const summary = [
    `# Resend bridge summary (no secrets) — ${DOMAIN} / ${REGION}`,
    `domain_status=${detail?.status ?? 'not created'}`,
    `webhook=${WEBHOOK_ENDPOINT}`,
    '# DNS records for the cgproductionhouse.com zone (Afrihost). Names are as Resend reports them.',
    ...records.map((record) => `${record.type}\t${record.name}\t${record.type === 'MX' ? `${record.priority ?? 10} ` : ''}${record.value}\t[${record.record ?? ''} ${record.status ?? ''}]`),
  ].join('\n')
  log('== 6. DNS records')
  log(summary)
  log(`\nDone (${apply ? 'applied' : 'dry run'}). Sending remains DISABLED.`)
  return { applied: apply, summary, stored }
}

function cliListSecretNames() {
  const args = ['secrets', 'list', '--project-ref', PROJECT_REF]
  const [command, argv] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'supabase', ...args]] : ['supabase', args]
  try { return execFileSync(command, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
}

function cliSetSecrets(envFileText) {
  // 0600 temp file, removed immediately; values never reach argv, stdout or logs.
  const dir = mkdtempSync(join(tmpdir(), 'cg-resend-'))
  const file = join(dir, 'secrets.env')
  try {
    writeFileSync(file, envFileText, { mode: 0o600 })
    chmodSync(file, 0o600)
    const args = ['secrets', 'set', '--project-ref', PROJECT_REF, '--env-file', file]
    const [command, argv] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'supabase', ...args]] : ['supabase', args]
    execFileSync(command, argv, { stdio: ['ignore', 'ignore', 'ignore'] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1]?.endsWith('resend-bridge-setup.mjs')) {
  const summaryFile = process.env.SUMMARY_FILE || 'resend-bridge-summary.txt'
  run({
    env: (name) => process.env[name],
    args: process.argv.slice(2),
    fetch: globalThis.fetch,
    listSecretNames: cliListSecretNames,
    setSecrets: cliSetSecrets,
    log: (line) => console.log(line),
  }).then(({ summary }) => {
    writeFileSync(summaryFile, `${summary}\n`)
    console.log(`Share ${summaryFile} (no secrets) on #405.`)
  }).catch((error) => {
    console.error(`STOP: ${error instanceof Stop ? error.message : 'unexpected error (details withheld to avoid leaking secrets)'}`)
    process.exit(error instanceof Stop ? 2 : 1)
  })
}
