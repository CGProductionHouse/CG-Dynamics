import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const SOURCE = join(DIR, 'neshora-strategy-source-snapshot.json')
const DOSSIER_INDEX = join(DIR, 'index.json')
const OUTPUT = join(DIR, 'neshora-strategy-readiness-dry-run.json')

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

function sha(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const index = JSON.parse(readFileSync(DOSSIER_INDEX, 'utf8'))
const expectedId = '3c20fae1-8e91-41d5-98eb-1c331600e6e3'
const dossier = index.clients.find(client => client.id === expectedId)

if (source.write_count !== 0 || source.client?.id !== expectedId || source.client?.name !== 'Neshora Oxygen' || source.client?.active !== true) {
  throw new Error('Neshora source snapshot identity or read-only contract is invalid.')
}
if (!dossier || dossier.strategy_status !== 'blocked' || !dossier.blockers.includes('NO_EVIDENCE_BACKED_RECOMMENDATION')) {
  throw new Error('Neshora dossier must remain strategy-blocked until reviewed exact-client intelligence exists.')
}

const settings = source.client.package_settings
if (settings.professional_videos_per_month !== 1 || settings.photo_posts_per_month !== 4 || settings.design_posters_per_month !== 4) {
  throw new Error('Neshora confirmed package quantities drifted.')
}
for (const field of ['reels_per_month', 'animated_posters_per_month', 'campaign_management_included', 'monthly_campaign_budget']) {
  if (settings[field] !== null) throw new Error(`Neshora unknown field ${field} must remain null.`)
}

const missing = Object.entries(source.evidence_counts).filter(([, count]) => count === 0).map(([name]) => name)
const rows = ['2026-09-01', '2026-10-01'].map(strategyMonth => ({
  client_id: expectedId,
  client_name: source.client.name,
  strategy_month: strategyMonth,
  disposition: 'blocked',
  reason: 'MISSING_CANONICAL_STRATEGY_DRAFT_AND_REVIEWED_CLIENT_INTELLIGENCE',
  source_evidence_hash: dossier.evidence_hash,
  package: {
    professional_videos_per_month: 1,
    photo_posts_per_month: 4,
    design_posters_per_month: 4,
  },
  unavailable_evidence: missing,
  safe_next_action: 'Create the canonical draft through the existing monthly strategy contract only after reviewed exact-client intelligence is available; do not derive strategy from package quantities alone.',
}))

const core = {
  schema_version: 1,
  issue: 513,
  mode: 'dry_run',
  write_count: 0,
  preserves_reviewed_plan_hash: '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b',
  source_snapshot_hash: sha(source),
  counts: { blocked: 2, ready: 0 },
  rows,
}
const output = { ...core, plan_hash: sha(core) }
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ output: OUTPUT, plan_hash: output.plan_hash, ...output.counts }, null, 2)}\n`)
