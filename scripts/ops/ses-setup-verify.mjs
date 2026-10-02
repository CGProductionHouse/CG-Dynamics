// Issue #405 — verifies the SES setup from the no-secrets summary written by
// scripts/ops/ses-af-south-1-setup.sh. Needs no AWS credentials; reads only public DNS and
// Supabase secret NAMES (never values).
//
//   node scripts/ops/ses-setup-verify.mjs ses-af-south-1-setup-summary.txt [--project-ref ref]
import { execFileSync } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import { readFileSync } from 'node:fs'

export const REQUIRED_SECRET_NAMES = [
  'WEBSITE_ENQUIRY_EMAIL_PROVIDER', 'WEBSITE_ENQUIRY_EMAIL_FROM', 'WEBSITE_ENQUIRY_SES_REGION',
  'WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID', 'WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY', 'WEBSITE_ENQUIRY_SES_CONFIGURATION_SET',
  'WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN', 'WEBSITE_ENQUIRY_WORKER_SECRET',
]

/** Parses the setup summary into expected DNS records. */
export function parseSummary(text) {
  const records = []
  for (const line of text.split(/\r?\n/)) {
    let match
    if ((match = line.match(/^CNAME (\S+)\s+->\s+(\S+)$/))) records.push({ type: 'CNAME', name: match[1], value: match[2] })
    else if ((match = line.match(/^MX\s+(\S+)\s+->\s+(\d+) (\S+)$/))) records.push({ type: 'MX', name: match[1], priority: Number(match[2]), value: match[3] })
    else if ((match = line.match(/^TXT\s+(\S+)\s+->\s+"(.+)"$/))) records.push({ type: 'TXT', name: match[1], value: match[2] })
  }
  return records
}

const norm = (value) => value.toLowerCase().replace(/\.$/, '')

export async function checkRecord(resolver, record) {
  try {
    if (record.type === 'CNAME') {
      const answers = await resolver.resolveCname(record.name)
      return answers.some((answer) => norm(answer) === norm(record.value))
    }
    if (record.type === 'MX') {
      const answers = await resolver.resolveMx(record.name)
      return answers.some((answer) => norm(answer.exchange) === norm(record.value) && answer.priority === record.priority)
    }
    const answers = await resolver.resolveTxt(record.name)
    return answers.some((parts) => parts.join('') === record.value)
  } catch {
    return false
  }
}

const hasName = (listing, name) => new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`, 'm').test(listing)

/**
 * Checks Supabase secret NAMES. `listing` is the `supabase secrets list` output, or null when it
 * could not be read — which fails closed (never reported as "ENABLED is unset").
 */
export function checkSecretNames(listing) {
  if (listing === null) {
    return { failed: 1, lines: ['FAIL could not list Supabase secret names; secrets and WEBSITE_ENQUIRY_EMAIL_ENABLED unverified'] }
  }
  const lines = []
  let failed = 0
  for (const name of REQUIRED_SECRET_NAMES) {
    const present = hasName(listing, name)
    if (!present) failed++
    lines.push(`${present ? 'OK  ' : 'MISS'} secret name ${name}`)
  }
  const enabled = hasName(listing, 'WEBSITE_ENQUIRY_EMAIL_ENABLED')
  if (enabled) failed++
  lines.push(`${enabled ? 'FAIL' : 'OK  '} WEBSITE_ENQUIRY_EMAIL_ENABLED is ${enabled ? 'SET (must stay unset)' : 'unset'}`)
  return { failed, lines }
}

function listSecretNames(projectRef) {
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error('invalid project ref')
  const args = ['secrets', 'list', '--project-ref', projectRef]
  // npm installs the Supabase CLI as a .cmd shim on Windows, which Node cannot spawn directly.
  const [command, argv] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'supabase', ...args]] : ['supabase', args]
  try {
    return execFileSync(command, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('ses-setup-verify.mjs')) {
  const file = process.argv[2]
  if (!file) { console.error('usage: node scripts/ops/ses-setup-verify.mjs <summary.txt> [--project-ref ref]'); process.exit(2) }
  const refIndex = process.argv.indexOf('--project-ref')
  const projectRef = refIndex > 0 ? process.argv[refIndex + 1] : 'ehtjfntukiwbgptqgbzy'
  const records = parseSummary(readFileSync(file, 'utf8'))
  if (!records.some((record) => record.type === 'CNAME')) { console.error('summary has no DKIM CNAMEs (was --apply run?)'); process.exit(2) }
  let failed = 0
  for (const servers of [['8.8.8.8'], ['1.1.1.1']]) {
    const resolver = new Resolver(); resolver.setServers(servers)
    for (const record of records) {
      const ok = await checkRecord(resolver, record)
      if (!ok) failed++
      console.log(`${ok ? 'OK  ' : 'MISS'} [${servers[0]}] ${record.type} ${record.name}`)
    }
  }
  const secrets = checkSecretNames(listSecretNames(projectRef))
  failed += secrets.failed
  for (const line of secrets.lines) console.log(line)
  console.log(failed ? `\n${failed} check(s) not yet satisfied` : '\nAll DNS records and secret names verified; sending remains disabled.')
  process.exit(failed ? 1 : 0)
}
